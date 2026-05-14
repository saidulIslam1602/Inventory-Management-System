/**
 * Scheduled reminders when POs stay in SUBMITTED past the org threshold (app settings).
 * In-app notifications + optional email; aligns with manager SLA / exception queue.
 */

import { NotificationType } from "@prisma/client";
import { differenceInCalendarDays, subDays, subHours } from "date-fns";
import { prisma } from "@/lib/db";
import { getAppSettings } from "@/lib/app-settings";
import { getOpsLeaderUserIds } from "@/lib/manager/notify-by-preference";
import { sendDigestEmail } from "@/lib/email/send-digest-email";
import { isDigestEmailConfigured } from "@/lib/email/nodemailer-transport";
import {
  parseNotificationPreferences,
  wantsEmailApprovalEscalation,
  wantsInstantPoEvent,
} from "@/lib/notification-preferences";

const EMAIL_COOLDOWN_MS = 22 * 60 * 60 * 1000;

export async function findPurchaseOrdersPastApprovalThreshold() {
  const settings = await getAppSettings();
  const cutoff = subDays(new Date(), settings.exceptionStaleSubmitDays);
  return prisma.purchaseOrder.findMany({
    where: { status: "SUBMITTED", createdAt: { lt: cutoff } },
    orderBy: { createdAt: "asc" },
    select: { id: true, poNumber: true, createdAt: true },
  });
}

export async function runApprovalEscalationInAppNotifications(): Promise<{
  overdueCount: number;
  notificationsCreated: number;
}> {
  const pos = await findPurchaseOrdersPastApprovalThreshold();
  if (pos.length === 0) return { overdueCount: 0, notificationsCreated: 0 };

  const opsIds = await getOpsLeaderUserIds();
  if (opsIds.length === 0) return { overdueCount: pos.length, notificationsCreated: 0 };

  const users = await prisma.user.findMany({
    where: { id: { in: opsIds }, isActive: true },
    select: { id: true, notificationPreferences: true },
  });

  const since = subHours(new Date(), 24);
  const recent = await prisma.notification.findMany({
    where: {
      type: NotificationType.PO_APPROVAL_OVERDUE,
      createdAt: { gte: since },
      userId: { in: opsIds },
    },
    select: { userId: true, actionHref: true },
  });
  const blocked = new Set(recent.map((r) => `${r.userId}\t${r.actionHref ?? ""}`));

  const now = new Date();
  const rows: Array<{
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    actionHref: string;
  }> = [];

  for (const po of pos) {
    const days = Math.max(0, differenceInCalendarDays(now, po.createdAt));
    const href = `/purchase-orders/${po.id}`;
    const title = "PO awaiting approval (overdue)";
    const message = `${po.poNumber} has waited ${days} day(s) — past the org approval queue threshold.`;

    for (const u of users) {
      if (!wantsInstantPoEvent(u.notificationPreferences, "poApprovalEscalation")) continue;
      if (blocked.has(`${u.id}\t${href}`)) continue;
      rows.push({
        userId: u.id,
        type: NotificationType.PO_APPROVAL_OVERDUE,
        title,
        message,
        actionHref: href,
      });
      blocked.add(`${u.id}\t${href}`);
    }
  }

  if (rows.length === 0) return { overdueCount: pos.length, notificationsCreated: 0 };

  await prisma.notification.createMany({ data: rows });

  return { overdueCount: pos.length, notificationsCreated: rows.length };
}

export async function runApprovalEscalationEmails(): Promise<{
  configured: boolean;
  sent: number;
  skipped: number;
  errors: number;
  candidates: number;
}> {
  if (!isDigestEmailConfigured()) {
    return { configured: false, sent: 0, skipped: 0, errors: 0, candidates: 0 };
  }

  const pos = await findPurchaseOrdersPastApprovalThreshold();
  if (pos.length === 0) {
    return { configured: true, sent: 0, skipped: 0, errors: 0, candidates: 0 };
  }

  const settings = await getAppSettings();
  const now = new Date();
  const lines = pos.map((p) => {
    const d = Math.max(0, differenceInCalendarDays(now, p.createdAt));
    return `  – ${p.poNumber} (${d}d in queue)`;
  });

  const body = [
    "The following purchase orders are still waiting for approval past your organisation threshold",
    `(${settings.exceptionStaleSubmitDays} full day(s) since submit).`,
    "",
    ...lines,
    "",
    "Open the portal to review and approve.",
  ].join("\n");

  const users = await prisma.user.findMany({
    where: { isActive: true, role: { in: ["ADMIN", "MANAGER"] } },
    select: { id: true, email: true, notificationPreferences: true },
  });
  const targets = users.filter((u) => wantsEmailApprovalEscalation(u.notificationPreferences));

  let sent = 0;
  let skipped = 0;
  let errors = 0;
  const nowMs = Date.now();

  for (const u of targets) {
    const prefs = parseNotificationPreferences(u.notificationPreferences);
    const lastRaw = prefs._lastApprovalEscalationEmailAt;
    const last = lastRaw ? Date.parse(lastRaw) : NaN;
    if (Number.isFinite(last) && nowMs - last < EMAIL_COOLDOWN_MS) {
      skipped++;
      continue;
    }

    try {
      await sendDigestEmail({
        to: u.email,
        subject: `Aqila IMS — ${pos.length} PO(s) past approval threshold`,
        text: ["Approval reminder (escalation).", "", body].join("\n"),
      });

      const raw = u.notificationPreferences;
      const next =
        raw && typeof raw === "object" && !Array.isArray(raw)
          ? { ...(raw as Record<string, unknown>) }
          : {};
      next._lastApprovalEscalationEmailAt = new Date().toISOString();

      await prisma.user.update({
        where: { id: u.id },
        data: { notificationPreferences: next as object },
      });
      sent++;
    } catch {
      errors++;
    }
  }

  return {
    configured: true,
    sent,
    skipped,
    errors,
    candidates: targets.length,
  };
}
