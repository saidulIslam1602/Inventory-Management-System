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
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  FolderKanban,
  BarChart3,
  Settings,
  Zap,
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

const NAV_ITEMS: NavItem[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Inventory",
    href: "/inventory",
    icon: Package,
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
    title: "Reports",
    href: "/reports",
    icon: BarChart3,
  },
];

interface AppSidebarProps {
  lowStockCount?: number;
  pendingPOCount?: number;
}

export function AppSidebar({ lowStockCount = 0, pendingPOCount = 0 }: AppSidebarProps) {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon" className="border-sidebar-border">
      {/* ── Brand header ── */}
      <SidebarHeader className="px-4 py-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <Zap className="w-4 h-4 text-primary-foreground" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sidebar-foreground font-semibold text-sm leading-tight truncate">
              Aqila IMS
            </span>
            <span className="text-sidebar-foreground/40 text-xs leading-tight truncate">
              Lofoten, Norway
            </span>
          </div>
        </div>
      </SidebarHeader>

      {/* ── Main navigation ── */}
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/40 uppercase text-[10px] tracking-wider">
            Navigation
          </SidebarGroupLabel>
          <SidebarMenu>
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon!;
              const isActive =
                pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
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
                      "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors",
                      isActive && "text-sidebar-foreground bg-sidebar-accent font-medium"
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

        {/* ── Settings group ── */}
        <SidebarGroup className="mt-auto">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                render={<Link href="/settings" />}
                isActive={pathname.startsWith("/settings")}
                tooltip="Settings"
                className="text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
              >
                <Settings className="h-4 w-4 shrink-0" />
                <span>Settings</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      {/* ── Footer: version info ── */}
      <SidebarFooter className="px-4 py-3 border-t border-sidebar-border">
        <div className="text-sidebar-foreground/30 text-[10px]">v1.0.0</div>
      </SidebarFooter>
    </Sidebar>
  );
}
