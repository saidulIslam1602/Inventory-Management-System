import { getCachedAppSettings } from "@/lib/app-settings-cache";
import { isMaintenanceBannerVisibleAt } from "@/lib/maintenance-banner";

/** Non-null trimmed message when the maintenance banner should show for `now`. */
export async function getActiveMaintenanceBannerMessage(now = new Date()): Promise<string | null> {
  const row = await getCachedAppSettings();
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
