import Link from "next/link";
import { ListFilter, Package, Truck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Props = {
  locationId: string;
  locationName: string;
};

/**
 * One-tap URLs for common warehouse list filters — STAFF complements SavedViewsBar presets on target pages.
 */
export function PortalStaffListShortcuts({ locationId, locationName }: Props) {
  const base = `/purchase-orders?location=${encodeURIComponent(locationId)}`;
  const inboundOrdered = `${base}&status=${encodeURIComponent("ORDERED")}`;
  const inboundPartial = `${base}&status=${encodeURIComponent("PARTIALLY_RECEIVED")}`;
  const movementsMyBranch = `/inventory/movements?location=${encodeURIComponent(locationId)}`;

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">My lists & saved views</CardTitle>
        <CardDescription>
          Jump to <span className="text-foreground font-medium">{locationName}</span> with filters
          applied. On each page, use <span className="font-medium">Saved views</span> to store names
          such as <span className="italic">&quot;My inbound POs&quot;</span> or{" "}
          <span className="italic">&quot;Dock movements&quot;</span> — your presets stay under your
          login on this device.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <Button
          variant="outline"
          className="h-auto min-h-11 shrink-0 justify-start gap-2 whitespace-normal py-3 text-left sm:justify-center sm:text-center xl:justify-start xl:text-left"
          asChild
        >
          <Link href={inboundOrdered}>
            <Truck className="text-primary shrink-0" aria-hidden />
            <span>Inbound POs — ordered ({locationName})</span>
          </Link>
        </Button>
        <Button
          variant="outline"
          className="h-auto min-h-11 shrink-0 justify-start gap-2 whitespace-normal py-3 text-left sm:justify-center sm:text-center xl:justify-start xl:text-left"
          asChild
        >
          <Link href={inboundPartial}>
            <Package className="text-primary shrink-0" aria-hidden />
            <span>Partially received ({locationName})</span>
          </Link>
        </Button>
        <Button
          variant="outline"
          className="h-auto min-h-11 shrink-0 justify-start gap-2 whitespace-normal py-3 text-left sm:col-span-2 sm:justify-center sm:text-center xl:col-span-1 xl:justify-start xl:text-left"
          asChild
        >
          <Link href={movementsMyBranch}>
            <ListFilter className="text-primary shrink-0" aria-hidden />
            <span>Stock movements — my branch</span>
          </Link>
        </Button>
        <Button variant="outline" className="h-auto min-h-11 shrink-0 py-3" asChild>
          <Link href="/purchase-orders">All purchase orders</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
