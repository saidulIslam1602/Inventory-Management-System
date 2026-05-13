/**
 * Persists viewer “watchlist” shortcuts on `User.dashboardPins` (JSON).
 */

export const DASHBOARD_PINS_MAX_PRODUCTS = 10;
export const DASHBOARD_PINS_MAX_PROJECTS = 10;

export type DashboardPinsState = {
  productIds: string[];
  projectIds: string[];
};

export function parseDashboardPins(raw: unknown): DashboardPinsState {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return { productIds: [], projectIds: [] };
  }
  const o = raw as Record<string, unknown>;
  const productIds = Array.isArray(o.productIds)
    ? o.productIds.filter((x): x is string => typeof x === "string" && x.length > 0)
    : [];
  const projectIds = Array.isArray(o.projectIds)
    ? o.projectIds.filter((x): x is string => typeof x === "string" && x.length > 0)
    : [];
  return {
    productIds: dedupeKeepOrder(productIds).slice(0, DASHBOARD_PINS_MAX_PRODUCTS),
    projectIds: dedupeKeepOrder(projectIds).slice(0, DASHBOARD_PINS_MAX_PROJECTS),
  };
}

function dedupeKeepOrder(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/** Newest-first cap */
export function addProductPin(state: DashboardPinsState, productId: string): DashboardPinsState {
  const next = [productId, ...state.productIds.filter((id) => id !== productId)];
  return {
    ...state,
    productIds: next.slice(0, DASHBOARD_PINS_MAX_PRODUCTS),
  };
}

export function removeProductPin(state: DashboardPinsState, productId: string): DashboardPinsState {
  return { ...state, productIds: state.productIds.filter((id) => id !== productId) };
}

export function addProjectPin(state: DashboardPinsState, projectId: string): DashboardPinsState {
  const next = [projectId, ...state.projectIds.filter((id) => id !== projectId)];
  return {
    ...state,
    projectIds: next.slice(0, DASHBOARD_PINS_MAX_PROJECTS),
  };
}

export function removeProjectPin(state: DashboardPinsState, projectId: string): DashboardPinsState {
  return { ...state, projectIds: state.projectIds.filter((id) => id !== projectId) };
}
