import { prisma } from "@/lib/db";
import { isMaintenanceBannerVisibleAt } from "@/lib/maintenance-banner";

/** Non-null trimmed message when the maintenance banner should show for `now`. */
export async function getActiveMaintenanceBannerMessage(now = new Date()): Promise<string | null> {
  const row = await prisma.appSettings.findUnique({
    where: { id: "default" },
    select: {
      maintenanceBannerEnabled: true,
      maintenanceBannerMessage: true,
      maintenanceBannerStartsAt: true,
      maintenanceBannerEndsAt: true,
    },
  });
  if (!row) return null;
  const config = {
    enabled: row.maintenanceBannerEnabled,
    message: row.maintenanceBannerMessage,
    startsAt: row.maintenanceBannerStartsAt,
    endsAt: row.maintenanceBannerEndsAt,
  };
  if (!isMaintenanceBannerVisibleAt(config, now)) return null;
  return config.message.trim();
}
