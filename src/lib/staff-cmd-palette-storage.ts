/**
 * Staff-only Cmd+K palette: pinned + recent destinations (localStorage per user).
 */

import { z } from "zod";

export const STAFF_CMD_PALETTE_EVENT = "aqila-staff-cmd-palette-changed";

const entrySchema = z.object({
  href: z.string().min(1).max(2000),
  title: z.string().min(1).max(240),
  subtitle: z.string().max(280).optional(),
  ts: z.string(),
});

const bucketSchema = z.object({
  v: z.literal(1),
  pins: z.array(entrySchema),
  recents: z.array(entrySchema),
});

export type StaffCmdPaletteEntry = z.infer<typeof entrySchema>;

const PIN_CAP = 10;
const RECENT_CAP = 15;

export function staffCmdPaletteHref(pathname: string, searchParams: URLSearchParams): string {
  const q = searchParams.toString().trim();
  return q ? `${pathname}?${q}` : pathname;
}

/** Human-readable label for breadcrumbs / recorder (STAFF-heavy routes). */
export function staffCmdRouteLabel(
  pathname: string,
  searchParams: URLSearchParams
): { title: string; subtitle?: string } {
  const parts = pathname.split("/").filter(Boolean);
  const tail = (): string => {
    const p = parts[parts.length - 1];
    return p && p.length ? `${p.slice(0, 10)}…` : "Page";
  };

  if (parts.length === 0) return { title: "Home" };

  switch (parts[0]) {
    case "me":
      return { title: "My portal" };
    case "dashboard":
      return { title: "Dashboard" };
    case "manager":
      return { title: "Manager hub" };
    case "reports":
      return { title: "Reports" };
    case "settings":
      return { title: "Settings" };
    case "inventory":
      if (parts[1] === "movements") return { title: "Stock movements" };
      if (parts[1] === "receive") {
        const po = searchParams.get("po");
        return po
          ? { title: "Receive goods", subtitle: `PO ${po.slice(0, 12)}…` }
          : { title: "Receive goods" };
      }
      if (parts[1] === "new") return { title: "New product" };
      if (parts[1] && parts[2] === "edit") return { title: "Edit product" };
      return { title: "Inventory" };
    case "purchase-orders":
      if (parts[1] === "new") return { title: "New purchase order" };
      if (parts[1]) return { title: "Purchase order", subtitle: `#${parts[1]!.slice(0, 8)}…` };
      return { title: "Purchase orders" };
    case "projects":
      if (parts[1] === "new") return { title: "New project" };
      if (parts[1]) return { title: "Project", subtitle: tail() };
      return { title: "Projects" };
    case "employees":
      if (parts[1] === "attendance") return { title: "Attendance" };
      if (parts[1] === "new") return { title: "New employee" };
      if (parts[1]) return { title: "Employee", subtitle: tail() };
      return { title: "Employees" };
    case "customers":
      if (parts[1]) return { title: "Customer", subtitle: tail() };
      return { title: "Customers" };
    case "suppliers":
      if (parts[1]) return { title: "Supplier", subtitle: tail() };
      return { title: "Supplier" };
    default: {
      const last = parts[parts.length - 1];
      return { title: last ? last.replace(/-/g, " ") : "Page" };
    }
  }
}

export function labelStaffCmdHref(href: string): { title: string; subtitle?: string } {
  try {
    const u = new URL(href, "https://app.local/");
    return staffCmdRouteLabel(u.pathname, u.searchParams);
  } catch {
    return { title: "Page" };
  }
}

function storageKey(userId: string): string {
  return `aqila.staffCmdPalette.v1:${userId}`;
}

function parse(raw: string | null): z.infer<typeof bucketSchema> | null {
  if (!raw) return null;
  try {
    const p = bucketSchema.safeParse(JSON.parse(raw));
    return p.success ? p.data : null;
  } catch {
    return null;
  }
}

function readBucket(userId: string): z.infer<typeof bucketSchema> {
  if (typeof window === "undefined") return { v: 1, pins: [], recents: [] };
  return parse(window.localStorage.getItem(storageKey(userId))) ?? { v: 1, pins: [], recents: [] };
}

function writeBucket(userId: string, data: z.infer<typeof bucketSchema>): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(userId), JSON.stringify(data));
  window.dispatchEvent(
    new CustomEvent(STAFF_CMD_PALETTE_EVENT, { detail: { userId } as { userId: string } })
  );
}

export function readStaffCmdPins(userId: string): StaffCmdPaletteEntry[] {
  return readBucket(userId).pins;
}

export function readStaffCmdRecents(userId: string): StaffCmdPaletteEntry[] {
  return readBucket(userId).recents;
}

export function subscribeStaffCmdPalette(userId: string, onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const fn = (): void => {
    onChange();
  };
  const onStorage = (e: StorageEvent): void => {
    if (e.key === storageKey(userId)) fn();
  };
  window.addEventListener(STAFF_CMD_PALETTE_EVENT, fn);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(STAFF_CMD_PALETTE_EVENT, fn);
    window.removeEventListener("storage", onStorage);
  };
}

/** Record a navigation (deduped by href, newest first). */
export function pushStaffCmdRecent(userId: string, entry: Omit<StaffCmdPaletteEntry, "ts">): void {
  const now = new Date().toISOString();
  const b = readBucket(userId);
  let recents = b.recents.filter((r) => r.href !== entry.href);
  recents.unshift({ ...entry, ts: now });
  recents = recents.slice(0, RECENT_CAP);
  writeBucket(userId, { ...b, recents });
}

/** @returns true when pinned after call, false when unpinned */
export function toggleStaffCmdPin(
  userId: string,
  entry: Omit<StaffCmdPaletteEntry, "ts">
): boolean {
  const b = readBucket(userId);
  const idx = b.pins.findIndex((p) => p.href === entry.href);
  if (idx >= 0) {
    const pins = [...b.pins.slice(0, idx), ...b.pins.slice(idx + 1)];
    writeBucket(userId, { ...b, pins });
    return false;
  }
  const pins = [{ ...entry, ts: new Date().toISOString() }, ...b.pins].slice(0, PIN_CAP);
  writeBucket(userId, { ...b, pins });
  return true;
}

export function isStaffCmdHrefPinned(userId: string, href: string): boolean {
  return readStaffCmdPins(userId).some((p) => p.href === href);
}

export function recordStaffCmdNavigation(
  userId: string,
  href: string,
  title: string,
  subtitle?: string
): void {
  pushStaffCmdRecent(userId, { href, title, subtitle });
}
