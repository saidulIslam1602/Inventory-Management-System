/**
 * Optional once-per-window digest notification for users who opt in on /me.
 */

import { subDays, subHours, differenceInCalendarDays } from "date-fns";
import { NotificationType, POAuditEventKind } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getAppSettings } from "@/lib/app-settings";
import { wantsDigestDaily } from "@/lib/notification-preferences";
import { buildExceptionQueue } from "@/lib/queries/manager-overview";
import { findPurchaseOrdersPastApprovalThreshold } from "./approval-escalation";
import { canAccessManagerHub } from "@/lib/rbac";

const DIGEST_COOLDOWN_HOURS = 22;

function formatAuditDigestLine(row: {
  kind: POAuditEventKind;
  fromStatus: string | null;
  toStatus: string | null;
  details: string | null;
  purchaseOrder: { poNumber: string };
}): string {
  const num = row.purchaseOrder.poNumber;
  if (row.kind === "STATUS_CHANGE") {
    const from = row.fromStatus ?? "—";
    const to = row.toStatus ?? "—";
    return `  – ${num}: ${from} → ${to}`;
  }
  if (row.kind === "ESCALATION_NOTE") {
    const tail = row.details?.trim() ? ` — ${row.details.trim()}` : "";
    return `  – ${num}: escalation note${tail}`;
  }
  const tail = row.details ? ` — ${row.details}` : "";
  return `  – ${num}: receipt → ${row.toStatus ?? "—"}${tail}`;
}

export async function buildOpsDigestLines(): Promise<string[]> {
  const since = subDays(new Date(), 1);
  const [submittedWaiting, movements24h, exceptions, recentPoAudits, overdueApprovals, settings] =
    await Promise.all([
      prisma.purchaseOrder.count({ where: { status: "SUBMITTED" } }),
      prisma.stockMovement.count({ where: { createdAt: { gte: since } } }),
      buildExceptionQueue(),
      prisma.purchaseOrderAuditLog.findMany({
        where: { createdAt: { gte: since } },
        orderBy: { createdAt: "desc" },
        take: 14,
        include: { purchaseOrder: { select: { poNumber: true } } },
      }),
      findPurchaseOrdersPastApprovalThreshold(),
      getAppSettings(),
    ]);

  const lines: string[] = [
    `• ${submittedWaiting} PO(s) currently waiting approval.`,
    `• ${movements24h} stock movement(s) recorded in the last 24 hours.`,
    `• Manager hub: ${exceptions.length} open exception(s). Highlights:`,
  ];
  for (const ex of exceptions.slice(0, 5)) {
    lines.push(`  – ${ex.title}`);
  }
  if (exceptions.length === 0) {
    lines.push("  – (none right now)");
  }

  if (overdueApprovals.length > 0) {
    const now = new Date();
    lines.push(
      `• POs past approval threshold (${settings.exceptionStaleSubmitDays}d since submit):`
    );
    for (const po of overdueApprovals.slice(0, 10)) {
      const d = Math.max(0, differenceInCalendarDays(now, po.createdAt));
      lines.push(`  – ${po.poNumber} (${d}d waiting)`);
    }
    if (overdueApprovals.length > 10) {
      lines.push(`  – …and ${overdueApprovals.length - 10} more`);
    }
  }

  if (recentPoAudits.length > 0) {
    lines.push(`• PO audit trail (last 24h, newest first):`);
    for (const a of recentPoAudits) {
      lines.push(formatAuditDigestLine(a));
    }
  } else {
    lines.push(`• PO audit trail (last 24h): no logged events.`);
  }

  return lines;
}

export async function ensureDailyDigestForUser(userId: string): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { notificationPreferences: true, isActive: true, role: true },
    });
    if (!user?.isActive || !wantsDigestDaily(user.notificationPreferences)) return;

    const cooldownSince = subHours(new Date(), DIGEST_COOLDOWN_HOURS);
    const recent = await prisma.notification.findFirst({
      where: {
        userId,
        type: NotificationType.DAILY_DIGEST,
        createdAt: { gte: cooldownSince },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (recent) return;

    const lines = await buildOpsDigestLines();
    await prisma.notification.create({
      data: {
        userId,
        type: NotificationType.DAILY_DIGEST,
        title: "Daily ops digest",
        message: lines.join("\n"),
        actionHref: canAccessManagerHub(user.role) ? "/manager" : "/dashboard",
      },
    });
  } catch (err) {
    // Digest is optional UX — never fail portal/dashboard renders if ops queries glitch.
    console.error("[daily-digest] ensureDailyDigestForUser:", err);
  }
}
