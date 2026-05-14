/**
 * Manager hub — multi-store oversight: scorecards, exceptions, PO inbox,
 * receiving backlog, transfers, attendance, projects, weekly digest.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import {
  AlertTriangle,
  ArrowRightLeft,
  BarChart3,
  Building2,
  ClipboardList,
  FileText,
  Package,
  Users,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { canAccessManagerHub } from "@/lib/rbac";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/status-badge";
import { cn, formatQuantityNbNo } from "@/lib/utils";
import {
  managerPendingRowAccentClass,
  pendingApprovalAgingTier,
  receivingPipelineAgingTier,
} from "@/lib/manager-aging";
import { ManagerPendingAgingBadge } from "@/components/manager/manager-pending-aging-badge";
import { BUSINESS_TIME_ZONE } from "@/lib/business-calendar";
import { ManagerDecisionQueueSection } from "@/components/manager/manager-decision-queue-section";
import { ManagerHubTeamBar } from "@/components/manager/manager-hub-team-bar";
import { ManagerExceptionEscalateButton } from "@/components/manager/manager-exception-escalate-dialog";
import { ManagerTransferSuggestionsTable } from "@/components/manager/manager-transfer-suggestions-table";
import { purchaseOrderIdFromException } from "@/lib/manager-exception-escalation";
import {
  buildExceptionQueue,
  buildManagerDecisionQueue,
  getAggregatedLowStockAlerts,
  getAttendanceSnapshotByLocation,
  getLocationScorecards,
  getLowStockSkusAtBranch,
  getManagerBranchOptions,
  getManagerDigestStats,
  getPendingApprovalPOs,
  getProjectPortfolio,
  getReceiveBacklog,
  getTransferSuggestions,
} from "@/lib/queries/manager-overview";

export const metadata: Metadata = { title: "Manager hub" };

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ManagerHubPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role === "STAFF") redirect("/me");
  if (!canAccessManagerHub(session.user.role)) redirect("/dashboard");

  const sp = await searchParams;
  const rawLoc = sp.location;
  const locationParam =
    typeof rawLoc === "string" ? rawLoc : Array.isArray(rawLoc) ? rawLoc[0] : undefined;

  const branchLocations = await getManagerBranchOptions();
  const branchLocationId =
    locationParam && branchLocations.some((l) => l.id === locationParam)
      ? locationParam
      : undefined;
  const branchName = branchLocationId
    ? branchLocations.find((b) => b.id === branchLocationId)?.name
    : undefined;

  const [
    scorecards,
    exceptions,
    approvals,
    receiveBacklog,
    transfers,
    attendance,
    portfolio,
    reorderAgg,
    digest,
  ] = await Promise.all([
    getLocationScorecards(branchLocationId),
    buildExceptionQueue({ locationId: branchLocationId }),
    getPendingApprovalPOs(branchLocationId),
    getReceiveBacklog(branchLocationId),
    getTransferSuggestions(20, branchLocationId),
    getAttendanceSnapshotByLocation(branchLocationId),
    getProjectPortfolio(branchLocationId),
    branchLocationId
      ? getLowStockSkusAtBranch(branchLocationId, 15)
      : getAggregatedLowStockAlerts(15),
    getManagerDigestStats(),
  ]);

  const decisionQueue = buildManagerDecisionQueue({
    exceptions,
    approvals,
    receiveBacklog,
    transfers,
    transferLimit: 15,
  }).slice(0, 35);

  const scorecardsHeading = branchLocationId ? "Branch scorecard" : "Location scorecards";
  const lowStockTitle = branchLocationId
    ? `Low stock — ${branchName ?? "branch"}`
    : "Multi-branch low stock (buy / transfer batch candidates)";
  const lowStockDesc = branchLocationId
    ? "SKUs at or below reorder for this branch."
    : "SKUs below reorder in two or more locations — consolidation view.";
  const lowStockEmpty = branchLocationId
    ? "No SKUs below reorder at this branch."
    : "No SKUs are low in multiple branches simultaneously.";

  return (
    <div className="space-y-10">
      <PageHeader
        title="Manager hub"
        description="Cross-store operations, procurement queue, and exceptions — Oslo date for attendance."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard">
                <BarChart3 className="mr-1.5 h-4 w-4" />
                Dashboard
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/manager/docs" target="_blank" rel="noopener noreferrer">
                <FileText className="mr-1.5 h-4 w-4" />
                Document portal
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/purchase-orders">
                <ClipboardList className="mr-1.5 h-4 w-4" />
                All purchase orders
              </Link>
            </Button>
          </div>
        }
      />

      <Suspense fallback={null}>
        <ManagerHubTeamBar branches={branchLocations} scopeKey={session.user.id} />
      </Suspense>

      {branchLocationId && branchName ? (
        <p className="text-muted-foreground border-border/80 bg-muted/15 rounded-lg border px-3 py-2 text-sm">
          Data below is scoped to <span className="text-foreground font-medium">{branchName}</span>{" "}
          where applicable. The 7-day digest remains org-wide.
        </p>
      ) : null}

      <ManagerDecisionQueueSection items={decisionQueue} />

      {/* Weekly digest */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <BarChart3 className="text-primary h-4 w-4" />
            7-day activity snapshot
          </CardTitle>
          <p className="text-muted-foreground text-xs font-normal">
            Since {digest.since.toLocaleDateString("nb-NO", { timeZone: BUSINESS_TIME_ZONE })} —
            audit and planning aid
            {branchLocationId ? (
              <span className="text-muted-foreground/90">
                {" "}
                · Totals are not filtered by branch.
              </span>
            ) : null}
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              { label: "Stock IN movements", value: digest.movementsIn },
              { label: "Stock OUT movements", value: digest.movementsOut },
              { label: "POs touched (excl. draft)", value: digest.posSubmitted },
              { label: "New projects opened", value: digest.projectsNew },
            ].map((k) => (
              <div
                key={k.label}
                className="border-border/80 bg-muted/20 rounded-xl border px-4 py-3"
              >
                <div className="text-muted-foreground text-xs">{k.label}</div>
                <div className="mt-1 text-2xl font-semibold tabular-nums">{k.value}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Exceptions */}
      <section className="space-y-3">
        <h2 className="text-foreground flex items-center gap-2 text-lg font-semibold">
          <AlertTriangle className="text-warning-foreground h-5 w-5" />
          Exception queue
        </h2>
        {exceptions.length === 0 ? (
          <p className="text-muted-foreground text-sm">No automated exceptions right now.</p>
        ) : (
          <ul className="space-y-2">
            {exceptions.map((ex) => {
              const poForNote = purchaseOrderIdFromException(ex);
              const prefill = `[${ex.category}] ${ex.title}. ${ex.detail}`;
              return (
                <li key={ex.id}>
                  <div className="border-border/80 bg-card flex flex-col gap-3 rounded-xl border p-4 shadow-sm transition-colors sm:flex-row sm:items-stretch">
                    <Link
                      href={ex.href}
                      className="hover:bg-muted/30 flex min-w-0 flex-1 flex-col gap-1 rounded-lg transition-colors sm:flex-row sm:items-start sm:justify-between"
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={ex.severity === "high" ? "destructive" : "secondary"}>
                            {ex.severity}
                          </Badge>
                          <span className="text-muted-foreground text-xs">{ex.category}</span>
                        </div>
                        <p className="mt-1 font-medium">{ex.title}</p>
                        <p className="text-muted-foreground text-sm">{ex.detail}</p>
                      </div>
                      <span className="text-primary mt-2 whitespace-nowrap text-sm font-medium sm:mt-0 sm:shrink-0 sm:self-start sm:pt-1">
                        Open →
                      </span>
                    </Link>
                    {poForNote ? (
                      <div className="flex shrink-0 justify-end sm:flex-col sm:justify-start sm:pt-0.5">
                        <ManagerExceptionEscalateButton
                          purchaseOrderId={poForNote}
                          prefill={prefill}
                        />
                      </div>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Location scorecards */}
      <section className="space-y-3">
        <h2 className="text-foreground flex items-center gap-2 text-lg font-semibold">
          <Building2 className="h-5 w-5" />
          {scorecardsHeading}
        </h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {scorecards.map((loc) => (
            <Card key={loc.id} className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-base font-semibold">
                  <span>{loc.name}</span>
                  <Badge variant="outline" className="font-normal capitalize">
                    {loc.type.toLowerCase()}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-2 text-sm">
                <div className="bg-muted/25 rounded-lg px-3 py-2">
                  <div className="text-muted-foreground text-xs">Low SKUs</div>
                  <div
                    className={
                      loc.lowStockSkus > 0 ? "text-warning-foreground font-semibold" : "font-medium"
                    }
                  >
                    {loc.lowStockSkus}
                  </div>
                </div>
                <div className="bg-muted/25 rounded-lg px-3 py-2">
                  <div className="text-muted-foreground text-xs">Open POs</div>
                  <div className="font-medium">{loc.openPoCount}</div>
                </div>
                <div className="bg-muted/25 rounded-lg px-3 py-2">
                  <div className="text-muted-foreground text-xs">Receiving</div>
                  <div className="font-medium">{loc.receivingPipelineCount}</div>
                </div>
                <div className="bg-muted/25 rounded-lg px-3 py-2">
                  <div className="text-muted-foreground text-xs">Active projects</div>
                  <div className="font-medium">{loc.activeProjects}</div>
                </div>
                <div className="bg-muted/25 col-span-2 rounded-lg px-3 py-2">
                  <div className="text-muted-foreground text-xs">Present today / headcount</div>
                  <div className="font-medium">
                    {loc.presentToday} / {loc.activeEmployees}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        {/* PO approvals */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">PO approval inbox</CardTitle>
            <p className="text-muted-foreground text-xs font-normal">
              Submitted, oldest first.{" "}
              <span className="text-muted-foreground/90">
                SLA: due soon from 2d queued, over SLA from 3d.
              </span>
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            {approvals.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nothing waiting for approval.</p>
            ) : (
              approvals.slice(0, 12).map((po) => {
                const tier = pendingApprovalAgingTier(po.daysWaiting);
                return (
                  <div
                    key={po.id}
                    className={cn(
                      "flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2",
                      managerPendingRowAccentClass(tier)
                    )}
                  >
                    <div>
                      <Link
                        href={`/purchase-orders/${po.id}`}
                        className="text-primary font-mono text-sm font-semibold hover:underline"
                      >
                        {po.poNumber}
                      </Link>
                      <p className="text-muted-foreground text-xs">
                        {po.supplierName} · {po.locationName}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-sm">
                        kr {po.totalAmount.toLocaleString("nb-NO", { minimumFractionDigits: 2 })}
                      </div>
                      <div className="mt-1 flex flex-col items-end gap-1">
                        <ManagerPendingAgingBadge tier={tier} />
                        {po.daysWaiting > 0 ? (
                          <span className="text-muted-foreground text-[10px]">
                            {po.daysWaiting}d in queue
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-[10px]">Queued today</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Receive backlog */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Receiving pipeline</CardTitle>
            <p className="text-muted-foreground text-xs font-normal">
              Ordered / partially received — chase suppliers and post goods-in.{" "}
              <span className="text-muted-foreground/90">
                SLA: due soon from 4d since last PO update, over SLA from 7d.
              </span>
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            {receiveBacklog.length === 0 ? (
              <p className="text-muted-foreground text-sm">No POs in receiving states.</p>
            ) : (
              receiveBacklog.slice(0, 12).map((po) => {
                const tier = receivingPipelineAgingTier(po.daysSinceOrder);
                return (
                  <div
                    key={po.id}
                    className={cn(
                      "flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2",
                      managerPendingRowAccentClass(tier)
                    )}
                  >
                    <div>
                      <Link
                        href={`/purchase-orders/${po.id}`}
                        className="text-primary font-mono text-sm font-semibold hover:underline"
                      >
                        {po.poNumber}
                      </Link>
                      <p className="text-muted-foreground text-xs">
                        {po.supplierName} · {po.locationName}
                      </p>
                    </div>
                    <div className="text-right">
                      <StatusBadge status={po.status} />
                      <div className="mt-1 flex flex-col items-end gap-1">
                        <ManagerPendingAgingBadge tier={tier} />
                        <span className="text-muted-foreground text-[10px]">
                          {po.daysSinceOrder}d since update
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* Aggregated low stock */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Package className="h-4 w-4" />
            {lowStockTitle}
          </CardTitle>
          <p className="text-muted-foreground text-xs font-normal">{lowStockDesc}</p>
        </CardHeader>
        <CardContent className="p-0">
          {reorderAgg.length === 0 ? (
            <p className="text-muted-foreground px-6 py-8 text-center text-sm">{lowStockEmpty}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/30 border-b text-left text-xs uppercase tracking-wide">
                    <th className="px-4 py-2">SKU</th>
                    <th className="px-4 py-2">Product</th>
                    <th className="px-4 py-2">{branchLocationId ? "At branch" : "Branches low"}</th>
                    <th className="px-4 py-2">Total on hand</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {reorderAgg.map((r) => (
                    <tr key={r.productId}>
                      <td className="px-4 py-2 font-mono text-xs">{r.sku}</td>
                      <td className="px-4 py-2">{r.name}</td>
                      <td className="px-4 py-2 font-medium">{r.lowLocationCount}</td>
                      <td className="px-4 py-2 font-mono">
                        {formatQuantityNbNo(r.totalQty, r.unitSymbol)} {r.unitSymbol}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transfer suggestions */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <ArrowRightLeft className="h-4 w-4" />
            Suggested internal transfers
          </CardTitle>
          <p className="text-muted-foreground text-xs font-normal">
            Rule-based: surplus branch vs branch at/below reorder for the same SKU. Post a transfer
            here (with optional note) or use manual movements in Inventory.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <ManagerTransferSuggestionsTable transfers={transfers} />
          <div className="border-t px-4 py-3">
            <Button asChild variant="outline" size="sm">
              <Link href="/inventory">Open inventory & movements</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        {/* Attendance */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Users className="h-4 w-4" />
              Attendance by branch (today)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/30 border-b text-left text-xs uppercase tracking-wide">
                    <th className="px-4 py-2">Location</th>
                    <th className="px-4 py-2">Present</th>
                    <th className="px-4 py-2">Late</th>
                    <th className="px-4 py-2">Absent</th>
                    <th className="px-4 py-2">No row</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {attendance.map((a) => (
                    <tr key={a.locationId}>
                      <td className="px-4 py-2 font-medium">{a.locationName}</td>
                      <td className="px-4 py-2 tabular-nums">{a.present}</td>
                      <td className="text-warning-foreground px-4 py-2 tabular-nums">{a.late}</td>
                      <td className="px-4 py-2 tabular-nums">{a.absent}</td>
                      <td className="text-muted-foreground px-4 py-2 tabular-nums">{a.noRow}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Projects */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Project portfolio</CardTitle>
            <div className="flex flex-wrap gap-2 pt-1">
              {portfolio.byStatus.map((g) => (
                <span
                  key={g.status}
                  className="border-border/80 bg-muted/30 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1"
                >
                  <StatusBadge status={g.status} />
                  <span className="text-muted-foreground text-xs tabular-nums">{g.count}</span>
                </span>
              ))}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
                In progress
              </p>
              <ul className="space-y-1">
                {portfolio.active.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/projects/${p.id}`}
                      className="hover:text-primary text-sm font-medium"
                    >
                      {p.projectCode} — {p.name}
                    </Link>
                    <span className="text-muted-foreground text-xs"> · {p.locationName}</span>
                  </li>
                ))}
              </ul>
            </div>
            {portfolio.onHold.length > 0 && (
              <div>
                <p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
                  On hold
                </p>
                <ul className="space-y-1">
                  {portfolio.onHold.map((p) => (
                    <li key={p.id}>
                      <Link
                        href={`/projects/${p.id}`}
                        className="text-warning-foreground text-sm font-medium hover:underline"
                      >
                        {p.projectCode} — {p.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <Button asChild variant="outline" size="sm">
              <Link href="/projects">All projects</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <p className="text-muted-foreground text-center text-xs">
        Email digests and escalation rules can plug into the same metrics later — notifications are
        created when staff submit POs for approval.
      </p>
    </div>
  );
}
