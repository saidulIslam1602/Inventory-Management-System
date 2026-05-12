/**
 * Dashboard layout — wraps all protected routes with:
 * - SidebarProvider (shadcn/ui)
 * - AppSidebar (Aqila dark nav)
 * - Header (breadcrumb, notifications, user menu)
 * - TooltipProvider (required by shadcn components)
 *
 * Session is read server-side; unauthenticated access is blocked by middleware.
 */

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Header } from "@/components/layout/header";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  // Fetch sidebar badge counts (low-stock alerts, pending POs, unread notifications)
  // Low-stock requires a raw query since Prisma cannot compare two columns in a where clause
  const [lowStockResult, pendingPOCount, notificationCount] = await Promise.all([
    prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) as count FROM stock WHERE quantity <= "reorderPoint" AND "reorderPoint" > 0
    `.catch(() => [{ count: BigInt(0) }]),
    prisma.purchaseOrder.count({
      where: { status: { in: ["DRAFT", "SUBMITTED", "APPROVED"] } },
    }).catch(() => 0),
    prisma.notification.count({
      where: { userId: session.user.id, isRead: false },
    }).catch(() => 0),
  ]);
  const lowStockCount = Number(lowStockResult[0]?.count ?? 0);

  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar lowStockCount={lowStockCount} pendingPOCount={pendingPOCount} />
        <SidebarInset>
          <Header
            user={session.user}
            notificationCount={notificationCount}
          />
          <main className="flex-1 p-6 bg-background min-h-[calc(100vh-3.5rem)]">
            {children}
          </main>
        </SidebarInset>
      </SidebarProvider>
      <Toaster richColors position="top-right" />
    </TooltipProvider>
  );
}
