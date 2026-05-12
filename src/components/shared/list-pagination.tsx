/**
 * Server-rendered prev/next links for URL-driven list pagination.
 */

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toQueryString } from "@/lib/search-params";

export function ListPagination({
  page,
  pageSize,
  total,
  baseParams,
}: {
  page: number;
  pageSize: number;
  total: number;
  baseParams: Record<string, string | undefined>;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const buildHref = (p: number) => {
    const q = toQueryString({
      ...baseParams,
      page: String(p),
      pageSize: String(pageSize),
    });
    return q ? `?${q}` : "?";
  };

  if (totalPages <= 1 && total <= pageSize) return null;

  return (
    <div className="text-muted-foreground border-border bg-muted/5 flex items-center justify-between gap-3 border-t px-4 py-3 text-sm">
      <span>
        Page {page} of {totalPages} · {total.toLocaleString("nb-NO")} row{total === 1 ? "" : "s"}
      </span>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon" className="h-8 w-8" disabled={page <= 1} asChild>
          <Link href={buildHref(page - 1)} aria-label="Previous page">
            <ChevronLeft className="h-4 w-4" />
          </Link>
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          disabled={page >= totalPages}
          asChild
        >
          <Link href={buildHref(page + 1)} aria-label="Next page">
            <ChevronRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
