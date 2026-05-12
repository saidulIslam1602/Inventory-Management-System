"use client";

/**
 * DataTable — Generic, reusable table with:
 * - Column definitions (header, accessor, render function)
 * - Search input
 * - Pagination
 * - Empty state
 * - Loading skeleton
 *
 * Used by inventory, employees, PO, and project list pages.
 */

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  /** Renders above the search field (e.g. filters). */
  toolbar?: React.ReactNode;
  searchPlaceholder?: string;
  searchKeys?: (keyof T)[];
  isLoading?: boolean;
  emptyState?: React.ReactNode;
  pageSize?: number;
  className?: string;
}

const PAGE_SIZE = 15;

export function DataTable<T extends { id?: string }>({
  data,
  columns,
  toolbar,
  searchPlaceholder = "Search...",
  searchKeys = [],
  isLoading = false,
  emptyState,
  pageSize = PAGE_SIZE,
  className,
}: DataTableProps<T>) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  // Client-side search across specified keys
  const filtered = search
    ? data.filter((row) =>
        searchKeys.some((key) =>
          String(row[key] ?? "")
            .toLowerCase()
            .includes(search.toLowerCase())
        )
      )
    : data;

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  function handleSearch(value: string) {
    setSearch(value);
    setPage(1); // Reset to first page on search change
  }

  return (
    <div className={cn("space-y-3", className)}>
      {toolbar}
      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
        <Input
          placeholder={searchPlaceholder}
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      <div className="border-border overflow-hidden rounded-lg border">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-border bg-muted/50 border-b">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={cn(
                      "text-muted-foreground whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider",
                      col.className
                    )}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {columns.map((col) => (
                      <td key={col.key} className="px-4 py-3">
                        <div className="bg-muted h-4 animate-pulse rounded" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-12 text-center">
                    {emptyState ?? (
                      <div className="text-muted-foreground text-sm">
                        {search ? "No results found for your search." : "No data available."}
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                paginated.map((row, i) => (
                  <tr key={row.id ?? i} className="hover:bg-muted/30 transition-colors">
                    {columns.map((col) => (
                      <td key={col.key} className={cn("px-4 py-3", col.className)}>
                        {col.render(row)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="text-muted-foreground flex items-center justify-between text-sm">
          <span>
            Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} of{" "}
            {filtered.length} results
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => setPage((p) => p - 1)}
              disabled={page === 1}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-2">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => setPage((p) => p + 1)}
              disabled={page === totalPages}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
