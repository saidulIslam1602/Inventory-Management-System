-- AlterTable
ALTER TABLE "app_settings" ADD COLUMN "maintenanceBannerEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "app_settings" ADD COLUMN "maintenanceBannerMessage" TEXT NOT NULL DEFAULT '';
ALTER TABLE "app_settings" ADD COLUMN "maintenanceBannerStartsAt" TIMESTAMP(3);
ALTER TABLE "app_settings" ADD COLUMN "maintenanceBannerEndsAt" TIMESTAMP(3);
