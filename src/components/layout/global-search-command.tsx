"use client";

import React, { startTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  Search,
  Package,
  ShoppingCart,
  FolderKanban,
  Users,
  Truck,
  Contact,
  Bookmark,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import type { StaffCmdPaletteEntry } from "@/lib/staff-cmd-palette-storage";
import {
  isStaffCmdHrefPinned,
  readStaffCmdPins,
  readStaffCmdRecents,
  staffCmdPaletteHref,
  staffCmdRouteLabel,
  subscribeStaffCmdPalette,
  toggleStaffCmdPin,
} from "@/lib/staff-cmd-palette-storage";

const EMPTY_STAFF_BOARD: { pins: StaffCmdPaletteEntry[]; recents: StaffCmdPaletteEntry[] } = {
  pins: [],
  recents: [],
};

/**
 * Staff palette data from localStorage. Loaded only after mount so the first
 * client render matches the server (avoids useSyncExternalStore hydration
 * failures when localStorage already has pins/recents).
 */
function useStaffCmdBoard(userId: string | undefined) {
  const [board, setBoard] = React.useState(EMPTY_STAFF_BOARD);

  React.useEffect(() => {
    if (!userId) {
      startTransition(() => setBoard(EMPTY_STAFF_BOARD));
      return;
    }
    const sync = () =>
      startTransition(() =>
        setBoard({
          pins: readStaffCmdPins(userId),
          recents: readStaffCmdRecents(userId),
        })
      );
    sync();
    return subscribeStaffCmdPalette(userId, sync);
  }, [userId]);

  return board;
}

type SearchPayload = {
  products: { id: string; name: string; sku: string; href: string }[];
  purchaseOrders: { id: string; poNumber: string; status: string }[];
  projects: {
    id: string;
    name: string;
    projectCode: string;
    clientName: string | null;
    clientPhone: string | null;
  }[];
  employees: { id: string; firstName: string; lastName: string; employeeCode: string }[];
  suppliers: { id: string; name: string }[];
  customers: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
  }[];
};

export function GlobalSearchCommand({
  staffPaletteUserId,
}: {
  staffPaletteUserId?: string | null;
} = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [data, setData] = React.useState<SearchPayload | null>(null);
  const [loading, setLoading] = React.useState(false);
  const staffBoard = useStaffCmdBoard(staffPaletteUserId ?? undefined);
  const browsingStaffPalette = Boolean(staffPaletteUserId) && query.trim().length < 2;
  const currentPaletteHref = staffPaletteUserId ? staffCmdPaletteHref(pathname, searchParams) : "";
  const currentPaletteLabel = staffPaletteUserId
    ? staffCmdRouteLabel(pathname, searchParams)
    : { title: "" };
  const currentIsPinned = staffPaletteUserId
    ? isStaffCmdHrefPinned(staffPaletteUserId, currentPaletteHref)
    : false;

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  React.useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      const clearId = window.setTimeout(() => {
        setData(null);
        setLoading(false);
      }, 0);
      return () => window.clearTimeout(clearId);
    }
    const t = window.setTimeout(() => {
      setLoading(true);
      void fetch(`/api/search?q=${encodeURIComponent(q)}`)
        .then((r) => r.json() as Promise<SearchPayload>)
        .then((json) =>
          setData({
            ...json,
            suppliers: json.suppliers ?? [],
            projects: json.projects ?? [],
            customers: json.customers ?? [],
          })
        )
        .catch(() => setData(null))
        .finally(() => setLoading(false));
    }, 200);
    return () => window.clearTimeout(t);
  }, [query]);

  function go(href: string) {
    setOpen(false);
    setQuery("");
    setData(null);
    router.push(href);
  }

  const empty =
    query.trim().length < 2
      ? staffPaletteUserId
        ? "Type at least 2 characters to search the catalog…"
        : "Type at least 2 characters…"
      : loading
        ? "Searching…"
        : "No matches.";

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="text-muted-foreground hidden h-8 gap-1.5 border-dashed px-2 font-normal md:flex"
        onClick={() => setOpen(true)}
      >
        <Search className="h-3.5 w-3.5" />
        Search…
        <kbd className="text-muted-foreground/80 bg-muted pointer-events-none ml-1 hidden rounded border px-1 font-mono text-[10px] lg:inline">
          ⌘K
        </kbd>
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="text-muted-foreground md:hidden"
        aria-label="Open search"
        onClick={() => setOpen(true)}
      >
        <Search className="h-4 w-4" />
      </Button>

      {/*
        Mount only while open so the dialog portal is not left attached across navigations
        (reduces React/FloatingPortal removeChild races).
      */}
      {open ? (
        <CommandDialog
          open
          onOpenChange={(o) => {
            setOpen(o);
            if (!o) {
              setQuery("");
              setData(null);
            }
          }}
          title="Search"
          description={
            staffPaletteUserId
              ? "Pinned & recent (this device), then search products, POs, suppliers, customers, projects"
              : "Find products, POs, suppliers, customers, projects, and employees"
          }
          className="sm:max-w-lg"
        >
          <Command shouldFilter={!browsingStaffPalette} className="overflow-visible">
            <CommandInput
              placeholder="Search SKU, PO, supplier, customer, project, employee…"
              value={query}
              onValueChange={setQuery}
            />
            <CommandList className="max-h-[min(24rem,70vh)]">
              <CommandEmpty className={browsingStaffPalette ? "hidden" : ""}>{empty}</CommandEmpty>
              {browsingStaffPalette && staffPaletteUserId ? (
                <CommandGroup heading="This page">
                  <CommandItem
                    value="pin-toggle-current"
                    onSelect={() => {
                      toggleStaffCmdPin(staffPaletteUserId, {
                        href: currentPaletteHref,
                        title: currentPaletteLabel.title,
                        subtitle: currentPaletteLabel.subtitle,
                      });
                    }}
                  >
                    <Bookmark className="h-4 w-4" />
                    <span>{currentIsPinned ? "Unpin this page" : "Pin this page"}</span>
                    <CommandShortcut className="font-normal">Palette</CommandShortcut>
                  </CommandItem>
                </CommandGroup>
              ) : null}
              {browsingStaffPalette && staffBoard.pins.length > 0 ? (
                <CommandGroup heading="Pinned">
                  {staffBoard.pins.map((p) => (
                    <CommandItem
                      key={`pin-${p.href}`}
                      value={`pin-${p.href}-${p.title}`}
                      onSelect={() => go(p.href)}
                    >
                      <Bookmark className="h-4 w-4" />
                      <span className="min-w-0 flex-1">
                        <span className="truncate font-medium">{p.title}</span>
                        {p.subtitle ? (
                          <span className="text-muted-foreground block truncate text-xs">
                            {p.subtitle}
                          </span>
                        ) : null}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : null}
              {browsingStaffPalette && staffBoard.recents.length > 0 ? (
                <CommandGroup heading="Recent">
                  {staffBoard.recents.map((r, i) => (
                    <CommandItem
                      key={`${r.href}:${i}`}
                      value={`recent-${r.href}-${r.title}-${i}`}
                      onSelect={() => go(r.href)}
                    >
                      <Clock className="h-4 w-4" />
                      <span className="min-w-0 flex-1">
                        <span className="truncate font-medium">{r.title}</span>
                        {r.subtitle ? (
                          <span className="text-muted-foreground block truncate text-xs">
                            {r.subtitle}
                          </span>
                        ) : (
                          <span className="text-muted-foreground block truncate font-mono text-xs">
                            {r.href}
                          </span>
                        )}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : null}
              {data && data.products.length > 0 ? (
                <CommandGroup heading="Products">
                  {data.products.map((p) => (
                    <CommandItem
                      key={p.id}
                      value={`product-${p.id}-${p.sku}`}
                      onSelect={() => go(p.href)}
                    >
                      <Package className="h-4 w-4" />
                      <span className="truncate">
                        <span className="font-mono text-xs">{p.sku}</span> · {p.name}
                      </span>
                      <CommandShortcut className="hidden font-normal sm:inline">
                        {p.href.includes("movements") ? "Movements" : "Edit"}
                      </CommandShortcut>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : null}
              {data && data.purchaseOrders.length > 0 ? (
                <CommandGroup heading="Purchase orders">
                  {data.purchaseOrders.map((po) => (
                    <CommandItem
                      key={po.id}
                      value={`po-${po.id}-${po.poNumber}`}
                      onSelect={() => go(`/purchase-orders/${po.id}`)}
                    >
                      <ShoppingCart className="h-4 w-4" />
                      <span className="font-mono">{po.poNumber}</span>
                      <CommandShortcut className="capitalize">
                        {po.status.toLowerCase()}
                      </CommandShortcut>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : null}
              {data && data.suppliers.length > 0 ? (
                <CommandGroup heading="Suppliers">
                  {data.suppliers.map((s) => (
                    <CommandItem
                      key={s.id}
                      value={`supplier-${s.id}-${s.name}`}
                      onSelect={() => go(`/suppliers/${s.id}`)}
                    >
                      <Truck className="h-4 w-4" />
                      <span className="truncate">{s.name}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : null}
              {data && data.customers.length > 0 ? (
                <CommandGroup heading="Customers">
                  {data.customers.map((c) => (
                    <CommandItem
                      key={c.id}
                      value={`customer-${c.id}-${c.name}`}
                      onSelect={() => go(`/customers/${c.id}`)}
                    >
                      <Contact className="h-4 w-4" />
                      <span className="min-w-0 flex-1">
                        <span className="truncate">{c.name}</span>
                        {c.email || c.phone ? (
                          <span className="text-muted-foreground block truncate text-xs">
                            {[c.email, c.phone].filter(Boolean).join(" · ")}
                          </span>
                        ) : null}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : null}
              {data && data.projects.length > 0 ? (
                <CommandGroup heading="Projects">
                  {data.projects.map((pr) => (
                    <CommandItem
                      key={pr.id}
                      value={`project-${pr.id}-${pr.projectCode}`}
                      onSelect={() => go(`/projects/${pr.id}`)}
                    >
                      <FolderKanban className="h-4 w-4" />
                      <span className="min-w-0 flex-1">
                        <span className="truncate">
                          <span className="font-mono text-xs">{pr.projectCode}</span> · {pr.name}
                        </span>
                        {pr.clientName || pr.clientPhone ? (
                          <span className="text-muted-foreground block truncate text-xs">
                            {pr.clientName ? `Client: ${pr.clientName}` : "Client"}
                            {pr.clientPhone
                              ? `${pr.clientName ? " · " : ": "}${pr.clientPhone}`
                              : ""}
                          </span>
                        ) : null}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : null}
              {data && data.employees.length > 0 ? (
                <CommandGroup heading="Employees">
                  {data.employees.map((e) => (
                    <CommandItem
                      key={e.id}
                      value={`emp-${e.id}-${e.employeeCode}`}
                      onSelect={() => go(`/employees/${e.id}`)}
                    >
                      <Users className="h-4 w-4" />
                      <span className="truncate">
                        {e.firstName} {e.lastName}{" "}
                        <span className="text-muted-foreground font-mono text-xs">
                          ({e.employeeCode})
                        </span>
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : null}
            </CommandList>
          </Command>
        </CommandDialog>
      ) : null}
    </>
  );
}
