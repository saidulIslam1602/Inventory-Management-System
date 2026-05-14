/**
 * Tenant-wide app settings (singleton row `default`).
 */

import { prisma } from "@/lib/db";

const DEFAULT_ID = "default";

export type AppSettingsRow = {
  id: string;
  exceptionStaleSubmitDays: number;
  exceptionOverdueReceiveDays: number;
  exceptionMinLowStockBranches: number;
  maintenanceBannerEnabled: boolean;
  maintenanceBannerMessage: string;
  maintenanceBannerStartsAt: Date | null;
  maintenanceBannerEndsAt: Date | null;
};

export async function getAppSettings(): Promise<AppSettingsRow> {
  const row = await prisma.appSettings.findUnique({
    where: { id: DEFAULT_ID },
  });
  if (row) {
    return {
      id: row.id,
      exceptionStaleSubmitDays: row.exceptionStaleSubmitDays,
      exceptionOverdueReceiveDays: row.exceptionOverdueReceiveDays,
      exceptionMinLowStockBranches: row.exceptionMinLowStockBranches,
      maintenanceBannerEnabled: row.maintenanceBannerEnabled,
      maintenanceBannerMessage: row.maintenanceBannerMessage,
      maintenanceBannerStartsAt: row.maintenanceBannerStartsAt,
      maintenanceBannerEndsAt: row.maintenanceBannerEndsAt,
    };
  }
  const created = await prisma.appSettings.create({
    data: {
      id: DEFAULT_ID,
      exceptionStaleSubmitDays: 2,
      exceptionOverdueReceiveDays: 7,
      exceptionMinLowStockBranches: 2,
    },
  });
  return {
    id: created.id,
    exceptionStaleSubmitDays: created.exceptionStaleSubmitDays,
    exceptionOverdueReceiveDays: created.exceptionOverdueReceiveDays,
    exceptionMinLowStockBranches: created.exceptionMinLowStockBranches,
    maintenanceBannerEnabled: created.maintenanceBannerEnabled,
    maintenanceBannerMessage: created.maintenanceBannerMessage,
    maintenanceBannerStartsAt: created.maintenanceBannerStartsAt,
    maintenanceBannerEndsAt: created.maintenanceBannerEndsAt,
  };
}
