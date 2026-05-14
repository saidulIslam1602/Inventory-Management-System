export const FEATURE_FLAG_KEYS = [
  "managerHub",
  "purchaseOrders",
  "employees",
  "projects",
  "customers",
  "reports",
] as const;

export type FeatureFlagKey = (typeof FEATURE_FLAG_KEYS)[number];

export type ResolvedFeatureFlags = Record<FeatureFlagKey, boolean>;

export const FEATURE_FLAG_DEFAULTS: ResolvedFeatureFlags = {
  managerHub: true,
  purchaseOrders: true,
  employees: true,
  projects: true,
  customers: true,
  reports: true,
};

/** Short descriptions for Settings UI */
export const FEATURE_FLAG_DESCRIPTIONS: Record<FeatureFlagKey, string> = {
  managerHub: "Manager hub (/manager) — approvals, transfers, exception queue.",
  purchaseOrders: "Purchase orders — list, create, receive-linked flows.",
  employees: "Employees directory — roster, attendance admin (not /me).",
  projects: "Projects — work orders and materials.",
  customers: "Customers — CRM-style accounts.",
  reports: "Reports & analytics.",
};

export const FEATURE_FLAG_LABELS: Record<FeatureFlagKey, string> = {
  managerHub: "Manager hub",
  purchaseOrders: "Purchase orders",
  employees: "Employees",
  projects: "Projects",
  customers: "Customers",
  reports: "Reports",
};

export function mergeFeatureFlags(stored: unknown): ResolvedFeatureFlags {
  const out: ResolvedFeatureFlags = { ...FEATURE_FLAG_DEFAULTS };
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) {
    return out;
  }
  const o = stored as Record<string, unknown>;
  for (const key of FEATURE_FLAG_KEYS) {
    if (key in o && typeof o[key] === "boolean") {
      out[key] = o[key];
    }
  }
  return out;
}
