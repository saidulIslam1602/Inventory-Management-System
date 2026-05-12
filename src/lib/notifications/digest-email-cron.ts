import { prisma } from "@/lib/db";
import { sendDigestEmail } from "@/lib/email/send-digest-email";
import { isDigestEmailConfigured } from "@/lib/email/nodemailer-transport";
import { parseNotificationPreferences } from "@/lib/notification-preferences";
import { buildOpsDigestLines } from "./daily-digest";

const COOLDOWN_MS = 22 * 60 * 60 * 1000;

/**
 * Sends one digest email per eligible user (see per-user cooldown).
 * Call from a scheduled job (e.g. `GET /api/cron/digest-email` with CRON_SECRET).
 */
export async function runScheduledDigestEmails(): Promise<{
  configured: boolean;
  sent: number;
  skipped: number;
  errors: number;
  candidates: number;
}> {
  if (!isDigestEmailConfigured()) {
    return { configured: false, sent: 0, skipped: 0, errors: 0, candidates: 0 };
  }

  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      notificationPreferences: {
        path: ["emailDigestDaily"],
        equals: true,
      },
    },
    select: { id: true, email: true, notificationPreferences: true },
  });

  const now = Date.now();
  let sent = 0;
  let skipped = 0;
  let errors = 0;

  const linesForAll = await buildOpsDigestLines();

  for (const u of users) {
    const prefs = parseNotificationPreferences(u.notificationPreferences);
    if (prefs.emailDigestDaily !== true) continue;

    const lastRaw = prefs._lastDigestEmailAt;
    const last = lastRaw ? Date.parse(lastRaw) : NaN;
    if (Number.isFinite(last) && now - last < COOLDOWN_MS) {
      skipped++;
      continue;
    }

    try {
      const text = ["Hi — your daily ops digest for Aqila IMS.", "", ...linesForAll].join("\n");
      await sendDigestEmail({
        to: u.email,
        subject: "Aqila IMS — Daily ops digest",
        text,
      });

      const raw = u.notificationPreferences;
      const next =
        raw && typeof raw === "object" && !Array.isArray(raw)
          ? { ...(raw as Record<string, unknown>) }
          : {};
      next._lastDigestEmailAt = new Date().toISOString();

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
    candidates: users.length,
  };
}
