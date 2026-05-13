export type MaintenanceBannerConfig = {
  enabled: boolean;
  message: string;
  startsAt: Date | null;
  endsAt: Date | null;
};

/** Whether the banner should render now (message non-empty, optional window). */
export function isMaintenanceBannerVisibleAt(config: MaintenanceBannerConfig, now: Date): boolean {
  if (!config.enabled || !config.message.trim()) return false;
  if (config.startsAt && now < config.startsAt) return false;
  if (config.endsAt && now > config.endsAt) return false;
  return true;
}
