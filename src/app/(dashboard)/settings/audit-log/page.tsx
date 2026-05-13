import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canAccessAuditLogPage } from "@/lib/rbac";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AuditEventCategory } from "@prisma/client";

export const metadata: Metadata = { title: "Audit log" };

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

function categoryBadgeVariant(
  cat: AuditEventCategory
): "default" | "secondary" | "outline" | "destructive" {
  switch (cat) {
    case "SETTINGS":
      return "secondary";
    case "EXPORT":
      return "outline";
    case "SECURITY":
      return "destructive";
    case "AUTH":
      return "default";
    case "DATA":
      return "outline";
    default:
      return "outline";
  }
}

function MetadataCell({ value }: { value: unknown }) {
  if (value == null) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <details className="max-w-[220px]">
      <summary className="text-muted-foreground cursor-pointer text-xs">Details</summary>
      <pre className="border-border mt-1 max-h-36 overflow-auto whitespace-pre-wrap rounded border p-2 font-mono text-[10px] leading-snug">
        {JSON.stringify(value, null, 2)}
      </pre>
    </details>
  );
}

type Props = { searchParams: Promise<{ page?: string }> };

export default async function AuditLogPage({ searchParams }: Props) {
  const session = await auth();
  if (!session?.user || !canAccessAuditLogPage(session.user.role)) {
    redirect("/settings");
  }

  const sp = await searchParams;
  const page = Math.max(1, Math.floor(Number(sp.page) || 1));

  const rows = await prisma.auditEvent.findMany({
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE + 1,
    include: {
      actor: { select: { email: true, name: true } },
    },
  });

  const hasNext = rows.length > PAGE_SIZE;
  const displayRows = hasNext ? rows.slice(0, PAGE_SIZE) : rows;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit log"
        description="Append-only record of settings changes, invitations, password events, sensitive CSV exports, and key directory updates (employees / customers)."
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" render={<Link href="/settings" />}>
          ← Back to settings
        </Button>
        <span className="text-muted-foreground text-xs">
          Newest first · {PAGE_SIZE} per page · PO/stock line-item history stays on those screens.
        </span>
      </div>

      <div className="border-border bg-card rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[150px]">Time</TableHead>
              <TableHead className="w-[100px]">Category</TableHead>
              <TableHead className="w-[160px]">Action</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead className="min-w-[200px]">Summary</TableHead>
              <TableHead className="w-[120px]">IP</TableHead>
              <TableHead>Metadata</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-muted-foreground py-10 text-center text-sm">
                  No audit events yet.
                </TableCell>
              </TableRow>
            ) : (
              displayRows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="text-muted-foreground whitespace-nowrap align-top font-mono text-xs">
                    {format(row.createdAt, "yyyy-MM-dd HH:mm:ss")}
                  </TableCell>
                  <TableCell className="align-top">
                    <Badge variant={categoryBadgeVariant(row.category)} className="text-[10px]">
                      {row.category}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[160px] break-all align-top font-mono text-xs">
                    {row.action}
                  </TableCell>
                  <TableCell className="align-top text-sm">
                    <div className="font-medium">{row.actorEmail ?? row.actor?.email ?? "—"}</div>
                    {row.actor?.name ? (
                      <div className="text-muted-foreground text-xs">{row.actor.name}</div>
                    ) : null}
                  </TableCell>
                  <TableCell className="align-top text-sm leading-snug">{row.summary}</TableCell>
                  <TableCell className="text-muted-foreground align-top font-mono text-xs">
                    {row.ipAddress ?? "—"}
                  </TableCell>
                  <TableCell className="align-top">
                    <MetadataCell value={row.metadata} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between gap-4">
        {page <= 1 ? (
          <Button variant="outline" size="sm" disabled>
            Newer
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            render={<Link href={`/settings/audit-log?page=${page - 1}`} />}
          >
            Newer
          </Button>
        )}
        <span className="text-muted-foreground text-sm">Page {page}</span>
        {!hasNext ? (
          <Button variant="outline" size="sm" disabled>
            Older
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            render={<Link href={`/settings/audit-log?page=${page + 1}`} />}
          >
            Older
          </Button>
        )}
      </div>
    </div>
  );
}
