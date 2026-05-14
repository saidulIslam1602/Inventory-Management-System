/**
 * Dashboard layout — wraps all protected routes with:
 * - SidebarProvider (shadcn/ui)
 * - AppSidebar (Aqila dark nav)
 * - Header (breadcrumb, notifications, user menu)
 * - TooltipProvider (required by shadcn components)
 *
 * Session is read server-side; unauthenticated access is blocked by the root proxy.
 */

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Header } from "@/components/layout/header";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import { getResolvedFeatureFlags } from "@/lib/feature-flags-server";
import { getActiveMaintenanceBannerMessage } from "@/lib/maintenance-banner-server";
import { MaintenanceBanner } from "@/components/layout/maintenance-banner";

/** Skip Prisma during `next build` static phase when no database is reachable (CI / fresh clone). */
export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  // Fetch sidebar badge counts (low-stock alerts, pending POs, unread notifications)
  // Low-stock requires a raw query since Prisma cannot compare two columns in a where clause
  const [
    lowStockResult,
    pendingPOCount,
    notificationCount,
    employeeForSidebar,
    featureFlags,
    maintenanceBannerMessage,
  ] = await Promise.all([
    prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) as count FROM stock WHERE quantity <= "reorderPoint" AND "reorderPoint" > 0
    `.catch(() => [{ count: BigInt(0) }]),
    prisma.purchaseOrder
      .count({
        where: { status: { in: ["DRAFT", "SUBMITTED", "APPROVED"] } },
      })
      .catch(() => 0),
    prisma.notification
      .count({
        where: { userId: session.user.id, isRead: false },
      })
      .catch(() => 0),
    prisma.employee
      .findUnique({
        where: { userId: session.user.id },
        select: { locationId: true },
      })
      .catch(() => null),
    getResolvedFeatureFlags(),
    getActiveMaintenanceBannerMessage(),
  ]);

  const lowStockCount = Number(lowStockResult[0]?.count ?? 0);

  const locLow =
    employeeForSidebar &&
    (session.user.role === "STAFF" ||
      session.user.role === "MANAGER" ||
      session.user.role === "ADMIN")
      ? await prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*)::bigint as count FROM stock s
        WHERE s."locationId" = ${employeeForSidebar.locationId}
          AND s.quantity <= s."reorderPoint" AND s."reorderPoint" > 0
      `.catch(() => [{ count: BigInt(0) }])
      : [{ count: BigInt(0) }];
  const myBranchLowStockCount = Number(locLow[0]?.count ?? 0);

  const inventoryBadgeCount = session.user.role === "STAFF" ? myBranchLowStockCount : lowStockCount;

  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar
          userRole={session.user.role}
          lowStockCount={inventoryBadgeCount}
          pendingPOCount={pendingPOCount}
          featureFlags={featureFlags}
        />
        <SidebarInset className="bg-transparent">
          {maintenanceBannerMessage ? (
            <MaintenanceBanner message={maintenanceBannerMessage} />
          ) : null}
          <Header user={session.user} notificationCount={notificationCount} />
          <div className="relative isolate flex min-h-[calc(100vh-3.5rem)] flex-1 flex-col">
            <div
              className="app-dashboard-backdrop pointer-events-none absolute inset-0 z-0"
              aria-hidden
            />
            <div className="relative z-[1] flex-1">
              <div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
                {children}
              </div>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
      <Toaster richColors position="top-right" />
      <ServiceWorkerRegister />
    </TooltipProvider>
  );
}
