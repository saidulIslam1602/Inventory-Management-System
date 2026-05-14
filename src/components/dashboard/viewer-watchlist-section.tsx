import Link from "next/link";
import { Bookmark } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseDashboardPins } from "@/lib/dashboard-pins";
import { getResolvedFeatureFlags } from "@/lib/feature-flags-server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardPinToggle } from "@/components/dashboard/dashboard-pin-toggle";

function orderByIds<T extends { id: string }>(rows: T[], ids: string[]): T[] {
  const rank = new Map(ids.map((id, i) => [id, i]));
  return [...rows].sort((a, b) => (rank.get(a.id) ?? 999) - (rank.get(b.id) ?? 999));
}

export async function ViewerWatchlistSection() {
  const session = await auth();
  if (session?.user?.role !== "VIEWER") return null;

  const flags = await getResolvedFeatureFlags();
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { dashboardPins: true },
  });
  const pins = parseDashboardPins(user?.dashboardPins);

  const [products, projects] = await Promise.all([
    pins.productIds.length > 0
      ? prisma.product.findMany({
          where: { id: { in: pins.productIds }, isActive: true },
          select: { id: true, sku: true, name: true },
        })
      : Promise.resolve([]),
    flags.projects && pins.projectIds.length > 0
      ? prisma.project.findMany({
          where: { id: { in: pins.projectIds } },
          select: { id: true, projectCode: true, name: true },
        })
      : Promise.resolve([]),
  ]);

  const orderedProducts = orderByIds(products, pins.productIds);
  const orderedProjects = orderByIds(projects, pins.projectIds);

  const resolvedAny =
    orderedProducts.length > 0 || (flags.projects ? orderedProjects.length > 0 : false);

  return (
    <Card className="border-border shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Bookmark className="text-primary h-4 w-4" />
          My watchlist
        </CardTitle>
        <CardDescription>
          Pinned SKUs and projects for quick access. Use the bookmark on Inventory or Projects to
          add or remove (stored with your account).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {!resolvedAny ? (
          <p className="text-muted-foreground text-sm leading-relaxed">
            Nothing pinned yet. Open{" "}
            <Link href="/inventory" className="text-primary underline-offset-4 hover:underline">
              Inventory
            </Link>
            {flags.projects ? (
              <>
                {" "}
                or{" "}
                <Link href="/projects" className="text-primary underline-offset-4 hover:underline">
                  Projects
                </Link>
              </>
            ) : null}{" "}
            and tap the bookmark icon on a row.
          </p>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <h3 className="text-muted-foreground mb-2 text-xs font-semibold uppercase tracking-wide">
                Products
              </h3>
              {orderedProducts.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No pinned products (or they were deactivated).
                </p>
              ) : (
                <ul className="divide-border divide-y rounded-md border">
                  {orderedProducts.map((p) => (
                    <li key={p.id} className="flex items-center gap-2 px-3 py-2">
                      <DashboardPinToggle
                        kind="product"
                        entityId={p.id}
                        initialPinned
                        className="shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/inventory/movements?product=${p.id}`}
                          className="text-foreground truncate font-medium hover:underline"
                        >
                          {p.name}
                        </Link>
                        <div className="text-muted-foreground font-mono text-xs">{p.sku}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {flags.projects ? (
              <div>
                <h3 className="text-muted-foreground mb-2 text-xs font-semibold uppercase tracking-wide">
                  Projects
                </h3>
                {orderedProjects.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No pinned projects.</p>
                ) : (
                  <ul className="divide-border divide-y rounded-md border">
                    {orderedProjects.map((p) => (
                      <li key={p.id} className="flex items-center gap-2 px-3 py-2">
                        <DashboardPinToggle
                          kind="project"
                          entityId={p.id}
                          initialPinned
                          className="shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/projects/${p.id}`}
                            className="text-foreground truncate font-medium hover:underline"
                          >
                            {p.name}
                          </Link>
                          <div className="text-muted-foreground font-mono text-xs">
                            {p.projectCode}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
