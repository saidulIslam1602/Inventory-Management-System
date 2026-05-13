"use client";

/**
 * AppSidebar — Main navigation sidebar.
 *
 * Uses shadcn/ui Sidebar primitives.
 * Aqila dark surface (#0F172A equivalent) with green accents.
 * Collapses to icon-only on small screens.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  UserCircle2,
  LayoutDashboard,
  Package,
  ScanBarcode,
  ShoppingCart,
  Users,
  FolderKanban,
  Contact,
  BarChart3,
  Settings,
  Zap,
  LogOut,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuBadge,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import type { NavItem } from "@/types";
import type { UserRole } from "@prisma/client";
import { logout } from "@/lib/actions/auth";
import { clearAuthPageCaches } from "@/lib/pwa-cache";
import { canAccessSettingsPage } from "@/lib/rbac";

const STAFF_EXCLUDED_HREF = new Set(["/employees", "/reports", "/manager"]);

const NAV_CORE: NavItem[] = [
  {
    title: "My portal",
    href: "/me",
    icon: UserCircle2,
  },
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Manager hub",
    href: "/manager",
    icon: Building2,
    roles: ["ADMIN", "MANAGER", "VIEWER"],
  },
  {
    title: "Inventory",
    href: "/inventory",
    icon: Package,
  },
  {
    title: "Receive goods",
    href: "/inventory/receive",
    icon: ScanBarcode,
  },
  {
    title: "Purchase Orders",
    href: "/purchase-orders",
    icon: ShoppingCart,
  },
  {
    title: "Employees",
    href: "/employees",
    icon: Users,
  },
  {
    title: "Projects",
    href: "/projects",
    icon: FolderKanban,
  },
  {
    title: "Customers",
    href: "/customers",
    icon: Contact,
  },
  {
    title: "Reports",
    href: "/reports",
    icon: BarChart3,
  },
];

interface AppSidebarProps {
  userRole: UserRole;
  lowStockCount?: number;
  pendingPOCount?: number;
}

export function AppSidebar({ userRole, lowStockCount = 0, pendingPOCount = 0 }: AppSidebarProps) {
  const pathname = usePathname();

  const navItems = NAV_CORE.filter((item) => {
    if (userRole === "STAFF" && STAFF_EXCLUDED_HREF.has(item.href)) return false;
    if (item.roles?.length && !item.roles.includes(userRole)) return false;
    return true;
  });

  return (
    <Sidebar collapsible="icon" className="border-sidebar-border">
      {/* ── Brand header ── */}
      <SidebarHeader className="px-4 py-4">
        <div className="flex items-center gap-2.5">
          <div className="bg-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
            <Zap className="text-primary-foreground h-4 w-4" />
          </div>
          <div className="flex min-w-0 flex-col">
            <span className="text-sidebar-foreground truncate text-sm font-semibold leading-tight">
              Aqila IMS
            </span>
            <span className="text-sidebar-foreground/40 truncate text-xs leading-tight">
              Lofoten, Norway
            </span>
          </div>
        </div>
      </SidebarHeader>

      {/* ── Main navigation ── */}
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/40 text-[10px] uppercase tracking-wider">
            Navigation
          </SidebarGroupLabel>
          <SidebarMenu>
            {navItems.map((item) => {
              const Icon = item.icon!;
              const isActive =
                item.href === "/me" || item.href === "/manager"
                  ? pathname === item.href
                  : pathname === item.href ||
                    (item.href !== "/dashboard" && pathname.startsWith(item.href));
              const badge =
                item.href === "/inventory" && lowStockCount > 0
                  ? lowStockCount
                  : item.href === "/purchase-orders" && pendingPOCount > 0
                    ? pendingPOCount
                    : undefined;

              return (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    render={<Link href={item.href} />}
                    isActive={isActive}
                    tooltip={item.title}
                    className={cn(
                      "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors",
                      isActive &&
                        "bg-sidebar-primary/12 text-sidebar-foreground ring-sidebar-primary/35 font-medium ring-1"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{item.title}</span>
                    {badge !== undefined && badge > 0 && (
                      <SidebarMenuBadge className="bg-destructive text-destructive-foreground text-[10px]">
                        {badge}
                      </SidebarMenuBadge>
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>

        {/* ── Settings (reference data; admin-only edits on page) ── */}
        {canAccessSettingsPage(userRole) ? (
          <SidebarGroup className="mt-auto">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={<Link href="/settings" />}
                  isActive={pathname.startsWith("/settings")}
                  tooltip="Settings"
                  className={cn(
                    "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors",
                    pathname.startsWith("/settings") &&
                      "bg-sidebar-primary/12 text-sidebar-foreground ring-sidebar-primary/35 font-medium ring-1"
                  )}
                >
                  <Settings className="h-4 w-4 shrink-0" />
                  <span>Settings</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
        ) : null}
      </SidebarContent>

      {/* ── Footer: log out + version ── */}
      <SidebarFooter className="border-sidebar-border gap-2 border-t px-2 py-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              type="button"
              tooltip="Log out"
              className="text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent w-full"
              onClick={() => {
                clearAuthPageCaches();
                void logout();
              }}
            >
              <LogOut className="h-4 w-4 shrink-0" />
              <span>Log out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <div className="text-sidebar-foreground/30 px-2 text-[10px]">v1.0.0</div>
      </SidebarFooter>
    </Sidebar>
  );
}
