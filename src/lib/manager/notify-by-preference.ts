import { NotificationType } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { InstantPoPreferenceKey } from "@/lib/notification-preferences";
import { wantsInstantPoEvent } from "@/lib/notification-preferences";

export async function notifyUsersForInstantPoPreference(input: {
  preferenceKey: InstantPoPreferenceKey;
  type: NotificationType;
  title: string;
  message: string;
  /** In-app path or URL for “open related record” (e.g. `/purchase-orders/:id`). */
  actionHref?: string | null;
  candidateUserIds: string[];
}): Promise<void> {
  const unique = [...new Set(input.candidateUserIds.filter(Boolean))];
  if (unique.length === 0) return;

  const users = await prisma.user.findMany({
    where: { id: { in: unique }, isActive: true },
    select: { id: true, notificationPreferences: true },
  });

  const targets = users.filter((u) =>
    wantsInstantPoEvent(u.notificationPreferences, input.preferenceKey)
  );
  if (targets.length === 0) return;

  await prisma.notification.createMany({
    data: targets.map((u) => ({
      userId: u.id,
      type: input.type,
      title: input.title,
      message: input.message,
      actionHref: input.actionHref ?? undefined,
    })),
  });
}

export async function getOpsLeaderUserIds(): Promise<string[]> {
  const rows = await prisma.user.findMany({
    where: { isActive: true, role: { in: ["ADMIN", "MANAGER"] } },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}
