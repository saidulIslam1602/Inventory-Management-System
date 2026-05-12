/**
 * Optional once-per-window digest notification for users who opt in on /me.
 */

import { subDays, subHours } from "date-fns";
import { NotificationType, POAuditEventKind } from "@prisma/client";
import { prisma } from "@/lib/db";
import { wantsDigestDaily } from "@/lib/notification-preferences";
import { buildExceptionQueue } from "@/lib/queries/manager-overview";

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
  const tail = row.details ? ` — ${row.details}` : "";
  return `  – ${num}: receipt → ${row.toStatus ?? "—"}${tail}`;
}

export async function buildOpsDigestLines(): Promise<string[]> {
  const since = subDays(new Date(), 1);
  const [submittedWaiting, movements24h, exceptions, recentPoAudits] = await Promise.all([
    prisma.purchaseOrder.count({ where: { status: "SUBMITTED" } }),
    prisma.stockMovement.count({ where: { createdAt: { gte: since } } }),
    buildExceptionQueue(),
    prisma.purchaseOrderAuditLog.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 14,
      include: { purchaseOrder: { select: { poNumber: true } } },
    }),
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
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { notificationPreferences: true, isActive: true },
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
      actionHref: "/manager",
    },
  });
}
