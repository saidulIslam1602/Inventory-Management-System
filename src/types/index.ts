/**
 * Global TypeScript types for Aqila IMS.
 * Re-exports Prisma enums and defines shared UI/API types.
 */

import type {
  UserRole,
  LocationType,
  MovementType,
  POStatus,
  ProjectStatus,
  AttendanceStatus,
  NotificationType,
} from "@prisma/client";
import type { FeatureFlagKey } from "@/lib/feature-flags";

// Re-export Prisma enums for use throughout the app
export type {
  UserRole,
  LocationType,
  MovementType,
  POStatus,
  ProjectStatus,
  AttendanceStatus,
  NotificationType,
};

// ── Navigation ────────────────────────────────────────────────────────────────

export interface NavItem {
  title: string;
  href: string;
  icon?: React.ComponentType<{ className?: string }>;
  badge?: number;
  children?: NavItem[];
  /** If set, only these roles see the item (STAFF filter still applies). */
  roles?: UserRole[];
  /** Hide when this feature flag is off (admin-controlled). */
  featureFlag?: FeatureFlagKey;
}

// ── API response wrapper ──────────────────────────────────────────────────────

export type ActionResult<T = void> =
  | { success: true; data: T; message?: string; offlineQueued?: boolean }
  | { success: false; error: string };

// ── Table / pagination ────────────────────────────────────────────────────────

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ── Dashboard KPIs ────────────────────────────────────────────────────────────

export interface DashboardStats {
  totalProducts: number;
  lowStockCount: number;
  pendingPOCount: number;
  activeEmployeesToday: number;
  activeProjectsCount: number;
}

// ── Extend NextAuth types to include role ─────────────────────────────────────
declare module "next-auth" {
  interface User {
    role: UserRole;
    mustChangePassword?: boolean;
  }
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role: UserRole;
      mustChangePassword?: boolean;
    };
  }
}

declare module "@auth/core/adapters" {
  interface AdapterUser {
    role: UserRole;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    role: UserRole;
    mustChangePassword?: boolean;
  }
}
