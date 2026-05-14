"use client";

/**
 * Dashboard header — breadcrumb, notifications bell, user menu.
 * Sits above all dashboard pages.
 */

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { logout } from "@/lib/actions/auth";
import { clearAuthPageCaches } from "@/lib/pwa-cache";
import { LogOut, ChevronRight, MoreVertical } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Suspense } from "react";
import { GlobalSearchCommand } from "@/components/layout/global-search-command";
import { StaffCmdPaletteRouteRecorder } from "@/components/layout/staff-cmd-palette-route-recorder";
import { HeaderNotificationsMenu } from "@/components/layout/header-notifications-menu";

// Map route paths to human-readable breadcrumb labels
const PATH_LABELS: Record<string, string> = {
  me: "My portal",
  profile: "Profile",
  dashboard: "Dashboard",
  manager: "Manager hub",
  inventory: "Inventory",
  "purchase-orders": "Purchase Orders",
  employees: "Employees",
  projects: "Projects",
  reports: "Reports",
  settings: "Settings",
};

interface HeaderProps {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    role: string;
  };
  notificationCount?: number;
}

export function Header({ user, notificationCount = 0 }: HeaderProps) {
  const pathname = usePathname();
  const router = useRouter();

  // Build breadcrumb segments from the URL path
  const segments = pathname.split("/").filter(Boolean);
  const breadcrumbs = segments.map((seg, i) => ({
    label: PATH_LABELS[seg] ?? seg.charAt(0).toUpperCase() + seg.slice(1),
    href: "/" + segments.slice(0, i + 1).join("/"),
    isLast: i === segments.length - 1,
  }));

  const initials = user.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "??";

  return (
    <header className="border-border/80 bg-background/90 supports-[backdrop-filter]:bg-background/75 sticky top-0 z-40 flex h-14 items-center gap-3 border-b px-4 backdrop-blur-md">
      {/* Sidebar toggle (mobile + collapsed desktop) */}
      <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
      <Separator orientation="vertical" className="h-5" />

      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex min-w-0 flex-1 items-center gap-1.5 text-sm">
        {breadcrumbs.map((crumb) => (
          <span key={crumb.href} className="flex min-w-0 items-center gap-1.5">
            {!crumb.isLast && (
              <>
                <span className="text-muted-foreground truncate">{crumb.label}</span>
                <ChevronRight className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
              </>
            )}
            {crumb.isLast && (
              <span className="text-foreground truncate font-medium">{crumb.label}</span>
            )}
          </span>
        ))}
      </nav>

      {/* Quick search */}
      {user.role === "STAFF" && user.id ? (
        <Suspense fallback={null}>
          <StaffCmdPaletteRouteRecorder userId={user.id} />
        </Suspense>
      ) : null}
      <GlobalSearchCommand staffPaletteUserId={user.role === "STAFF" ? user.id : null} />

      {/* Right actions */}
      <div className="flex items-center gap-2">
        {/* Notifications bell */}
        <HeaderNotificationsMenu unreadCount={notificationCount} />

        {/* Profile: direct link on initials; overflow menu for password + logout */}
        <div className="flex items-center gap-0.5">
          <Link
            href="/profile"
            className="bg-primary text-primary-foreground focus-visible:ring-ring inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold outline-none transition-opacity hover:opacity-90 focus-visible:ring-2"
            aria-label="My profile"
            title="My profile"
          >
            {initials}
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger
              className="text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring inline-flex h-8 w-8 items-center justify-center rounded-md outline-none focus-visible:ring-2"
              aria-label="Account menu"
            >
              <MoreVertical className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={6} className="w-52">
              <DropdownMenuLabel>
                <div className="text-sm font-medium">{user.name ?? "User"}</div>
                <div className="text-muted-foreground text-xs font-normal">{user.email}</div>
                <Badge variant="secondary" className="mt-1 text-[10px] capitalize">
                  {user.role.toLowerCase()}
                </Badge>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={() => {
                  router.push("/profile");
                }}
              >
                My profile
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={() => {
                  router.push("/change-password");
                }}
              >
                Change password
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                className="cursor-pointer"
                onClick={() => {
                  clearAuthPageCaches();
                  void logout();
                }}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
