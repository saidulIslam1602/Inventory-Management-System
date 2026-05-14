/**
 * Per-request cached AppSettings loader.
 *
 * `React.cache()` deduplicates calls within a single RSC render tree —
 * layout + feature-flags + maintenance-banner each calling this will only
 * produce one DB round-trip per request.
 */

import { cache } from "react";
import { prisma } from "@/lib/db";

export const getCachedAppSettings = cache(async () => {
  return prisma.appSettings.findUnique({
    where: { id: "default" },
    select: {
      featureFlags: true,
      maintenanceBannerEnabled: true,
      maintenanceBannerMessage: true,
      maintenanceBannerStartsAt: true,
      maintenanceBannerEndsAt: true,
    },
  });
});
