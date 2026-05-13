import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { format, parseISO } from "date-fns";
import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { canAccessDataQualityPage } from "@/lib/rbac";
import { getDataQualityReport } from "@/lib/data-quality/report";
import type { DqSeverity } from "@/lib/data-quality/report";

export const metadata: Metadata = { title: "Data quality" };

export const dynamic = "force-dynamic";

function severityBadgeVariant(s: DqSeverity): "default" | "secondary" | "outline" | "destructive" {
  switch (s) {
    case "error":
      return "destructive";
    case "warning":
      return "default";
    case "informational":
      return "secondary";
    default:
      return "outline";
  }
}

export default async function DataQualityPage() {
  const session = await auth();
  if (!session?.user || !canAccessDataQualityPage(session.user.role)) {
    redirect("/settings");
  }

  const report = await getDataQualityReport();

  const failedControls = report.scorecard.filter((r) => r.state === "fail").length;
  const passedControls = report.scorecard.filter((r) => r.state === "pass").length;

  const sectionsEmpty =
    report.duplicateCustomersByName.length === 0 &&
    report.duplicateCustomersByPhone.length === 0 &&
    report.activeEmployeesInactiveUsers.length === 0 &&
    report.activeProductsInactiveSupplier.length === 0 &&
    report.projectsUnlinkedButNameMatchesCustomer.length === 0 &&
    report.stockMovementsWithoutUser.total === 0 &&
    report.purchaseOrdersCreatedByInactiveUser.length === 0;

  const snapshotLabel = format(parseISO(report.generatedAt), "yyyy-MM-dd HH:mm:ss");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Data quality"
        description="Internal DQ scorecard: deterministic rules only (no fuzzy matching). Use for remediation queues; authoritative transaction history remains on operational screens."
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" render={<Link href="/settings" />}>
          ← Back to settings
        </Button>
        <span className="text-muted-foreground text-xs">
          Snapshot <span className="text-foreground font-mono">{snapshotLabel}</span> · Methodology{" "}
          <span className="text-foreground font-mono">{report.methodologyVersion}</span> · Controls{" "}
          <span className="text-foreground font-medium">{passedControls}</span> pass /{" "}
          <span
            className={
              failedControls > 0 ? "text-destructive font-medium" : "text-foreground font-medium"
            }
          >
            {failedControls}
          </span>{" "}
          fail
        </span>
      </div>

      <Card className="border-border border shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Scorecard</CardTitle>
          <CardDescription>
            Rule codes support screenshots and change management. Severity reflects triage priority,
            not SOC paging.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[110px]">Rule</TableHead>
                <TableHead className="w-[110px]">Dimension</TableHead>
                <TableHead className="w-[110px]">Severity</TableHead>
                <TableHead className="w-[72px]">State</TableHead>
                <TableHead>Result</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.scorecard.map((row) => (
                <TableRow key={row.ruleCode}>
                  <TableCell className="font-mono text-xs">{row.ruleCode}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px] font-normal">
                      {row.dimension}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={severityBadgeVariant(row.severity)}
                      className="text-[10px] font-normal capitalize"
                    >
                      {row.severity}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={row.state === "pass" ? "secondary" : "destructive"}
                      className="text-[10px]"
                    >
                      {row.state === "pass" ? "Pass" : "Fail"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm leading-snug">{row.narrative}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {sectionsEmpty ? (
        <Card className="border-border border shadow-none">
          <CardHeader>
            <CardTitle className="text-base">No drill-down queues</CardTitle>
            <CardDescription>
              All listed controls passed — no row-level lists to triage. Re-run after imports or
              bulk edits.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {report.duplicateCustomersByName.length > 0 ? (
        <Card className="border-border border shadow-none">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-base font-semibold">
                CUST-UNI-NAME — duplicate name clusters
              </CardTitle>
              <Badge variant="outline" className="text-[10px] font-normal">
                UNIQUENESS
              </Badge>
            </div>
            <CardDescription>
              Match key: trimmed · lowercased · internal whitespace collapsed. Clusters with any{" "}
              <span className="font-medium">active</span> customer are warning-tier; inactive-only
              clusters are informational.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {report.duplicateCustomersByName.map((cluster) => (
              <div key={`name:${cluster.key}`} className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-muted-foreground font-mono text-xs">{cluster.key}</span>
                  <Badge
                    variant={severityBadgeVariant(cluster.severity)}
                    className="text-[10px] capitalize"
                  >
                    {cluster.severity}
                  </Badge>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead className="w-[100px]">Status</TableHead>
                      <TableHead className="w-[120px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cluster.rows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium">{row.name}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {row.phone ?? "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {row.email ?? "—"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={row.isActive ? "secondary" : "outline"}
                            className="text-[10px]"
                          >
                            {row.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="link"
                            size="sm"
                            className="h-auto px-0"
                            render={<Link href={`/customers/${row.id}`} />}
                          >
                            Open
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {report.duplicateCustomersByPhone.length > 0 ? (
        <Card className="border-border border shadow-none">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-base font-semibold">
                CUST-UNI-PHONE — duplicate phone clusters
              </CardTitle>
              <Badge variant="outline" className="text-[10px] font-normal">
                UNIQUENESS
              </Badge>
            </div>
            <CardDescription>
              Match key: digits stripped from formatting (minimum 8 digits). Same tiering as name
              clusters.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {report.duplicateCustomersByPhone.map((cluster) => (
              <div key={`phone:${cluster.key}`} className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-muted-foreground font-mono text-xs">{cluster.key}</span>
                  <Badge
                    variant={severityBadgeVariant(cluster.severity)}
                    className="text-[10px] capitalize"
                  >
                    {cluster.severity}
                  </Badge>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead className="w-[100px]">Status</TableHead>
                      <TableHead className="w-[120px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cluster.rows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium">{row.name}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {row.phone ?? "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {row.email ?? "—"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={row.isActive ? "secondary" : "outline"}
                            className="text-[10px]"
                          >
                            {row.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="link"
                            size="sm"
                            className="h-auto px-0"
                            render={<Link href={`/customers/${row.id}`} />}
                          >
                            Open
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {report.projectsUnlinkedButNameMatchesCustomer.length > 0 ? (
        <Card className="border-border border shadow-none">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-base font-semibold">
                PRJ-LNK-CUST — project ↔ customer alignment
              </CardTitle>
              <Badge variant="outline" className="text-[10px] font-normal">
                CONSISTENCY
              </Badge>
            </div>
            <CardDescription>
              Free-text <span className="font-medium">clientName</span> equals a master customer
              after the same normalization as CUST-UNI-NAME;{" "}
              <span className="font-medium">customerId</span> is still null.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead>Ad-hoc client</TableHead>
                  <TableHead>Matching customer</TableHead>
                  <TableHead className="w-[140px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.projectsUnlinkedButNameMatchesCustomer.map((row) => (
                  <TableRow key={row.projectId}>
                    <TableCell>
                      <div className="font-medium">{row.projectCode}</div>
                      <div className="text-muted-foreground text-xs">{row.projectName}</div>
                    </TableCell>
                    <TableCell className="text-sm">{row.clientName}</TableCell>
                    <TableCell className="text-sm">{row.customerName}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="link"
                          size="sm"
                          className="h-auto px-0"
                          render={<Link href={`/projects/${row.projectId}`} />}
                        >
                          Project
                        </Button>
                        <Button
                          variant="link"
                          size="sm"
                          className="h-auto px-0"
                          render={<Link href={`/customers/${row.customerId}`} />}
                        >
                          Customer
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      {report.activeEmployeesInactiveUsers.length > 0 ? (
        <Card className="border-border border shadow-none">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-base font-semibold">EMP-USR-ALIGN — HR vs IAM</CardTitle>
              <Badge variant="outline" className="text-[10px] font-normal">
                CONSISTENCY
              </Badge>
              <Badge variant="destructive" className="text-[10px]">
                error
              </Badge>
            </div>
            <CardDescription>
              Remediation: deactivate employee record, reactivate login, or correct provisioning —
              pick one coherent lifecycle state.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>User email</TableHead>
                  <TableHead className="w-[100px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.activeEmployeesInactiveUsers.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono text-sm">{row.employeeCode}</TableCell>
                    <TableCell>{row.displayName}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{row.userEmail}</TableCell>
                    <TableCell>
                      <Button
                        variant="link"
                        size="sm"
                        className="h-auto px-0"
                        render={<Link href={`/employees/${row.id}`} />}
                      >
                        Open
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      {report.activeProductsInactiveSupplier.length > 0 ? (
        <Card className="border-border border shadow-none">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-base font-semibold">
                PRD-SUP-ALIGN — catalog ↔ supplier lifecycle
              </CardTitle>
              <Badge variant="outline" className="text-[10px] font-normal">
                CONSISTENCY
              </Badge>
            </div>
            <CardDescription>
              Active SKU must not default to an inactive vendor master.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead className="w-[160px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.activeProductsInactiveSupplier.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono text-sm">{row.sku}</TableCell>
                    <TableCell>{row.name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {row.supplierName}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="link"
                          size="sm"
                          className="h-auto px-0"
                          render={<Link href={`/inventory/${row.id}/edit`} />}
                        >
                          Edit product
                        </Button>
                        <Button
                          variant="link"
                          size="sm"
                          className="h-auto px-0"
                          render={<Link href={`/suppliers/${row.supplierId}`} />}
                        >
                          Supplier
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      {report.purchaseOrdersCreatedByInactiveUser.length > 0 ? (
        <Card className="border-border border shadow-none">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-base font-semibold">
                PO-USR-HISTORY — historical attribution
              </CardTitle>
              <Badge variant="outline" className="text-[10px] font-normal">
                VALIDITY
              </Badge>
              <Badge variant="secondary" className="text-[10px] capitalize">
                informational
              </Badge>
            </div>
            <CardDescription>
              Latest {report.purchaseOrdersCreatedByInactiveUser.length} row(s) where creator login
              is disabled — ordinarily acceptable; no automatic remediation.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PO</TableHead>
                  <TableHead>Creator email</TableHead>
                  <TableHead className="w-[100px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.purchaseOrdersCreatedByInactiveUser.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono text-sm">{row.poNumber}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {row.creatorEmail ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="link"
                        size="sm"
                        className="h-auto px-0"
                        render={<Link href={`/purchase-orders/${row.id}`} />}
                      >
                        Open
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      {report.stockMovementsWithoutUser.total > 0 ? (
        <Card className="border-border border shadow-none">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-base font-semibold">
                MOV-USR-COMPLETE — movement attribution
              </CardTitle>
              <Badge variant="outline" className="text-[10px] font-normal">
                COMPLETENESS
              </Badge>
            </div>
            <CardDescription>
              Immutable ledger rows with null <span className="font-medium">userId</span> (
              {report.stockMovementsWithoutUser.total} total). Sample below; operational truth
              remains on the movements screen.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button variant="outline" size="sm" render={<Link href="/inventory/movements" />}>
              Open movements log
            </Button>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[155px]">Time</TableHead>
                  <TableHead className="w-[90px]">Type</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>SKU</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.stockMovementsWithoutUser.recent.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="text-muted-foreground whitespace-nowrap font-mono text-xs">
                      {format(parseISO(m.createdAt), "yyyy-MM-dd HH:mm")}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{m.type}</TableCell>
                    <TableCell className="font-mono text-xs">{m.quantity}</TableCell>
                    <TableCell className="font-mono text-xs">{m.productSku}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-border border shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Methodology & limitations</CardTitle>
          <CardDescription>
            Disclosure expected for internal audits — what this console proves vs what it does not.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground space-y-3 text-sm leading-relaxed">
          <ul className="list-inside list-disc space-y-2">
            <li>
              <span className="text-foreground font-medium">Deterministic rules only.</span> No
              probabilistic/fuzzy matching — avoids false merges and makes peer review
              straightforward.
            </li>
            <li>
              <span className="text-foreground font-medium">Survivorship not automated.</span>{" "}
              “Redundant row” counts assume one keeper per duplicate cluster; merging/deactivating
              records stays a governed manual action in CRM/catalog screens.
            </li>
            <li>
              <span className="text-foreground font-medium">Project scan window.</span> Only the
              latest 200 projects with blank <code className="text-foreground">customerId</code> are
              scanned for textual alignment — expand in code if imports exceed that.
            </li>
            <li>
              <span className="text-foreground font-medium">PO sample.</span> At most 40 purchase
              orders are listed for inactive-creator visibility.
            </li>
            <li>
              <span className="text-foreground font-medium">Not a data catalog.</span> For lineage
              and external feeds, extend with a dedicated catalog tool — out of scope here.
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
