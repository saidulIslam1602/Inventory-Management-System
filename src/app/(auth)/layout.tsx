import { getActiveMaintenanceBannerMessage } from "@/lib/maintenance-banner-server";
import { MaintenanceBanner } from "@/components/layout/maintenance-banner";

export const dynamic = "force-dynamic";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const maintenanceMessage = await getActiveMaintenanceBannerMessage();
  return (
    <>
      {maintenanceMessage ? <MaintenanceBanner message={maintenanceMessage} /> : null}
      {children}
    </>
  );
}
