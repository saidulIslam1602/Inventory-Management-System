/**
 * Personal CSV export attestations — EXPORT-category audit rows for the signed-in user only.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuditEventCategory } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BUSINESS_TIME_ZONE } from "@/lib/business-calendar";

export const metadata: Metadata = { title: "My CSV exports" };

export const dynamic = "force-dynamic";

const PAGE_SIZE = 40;

type Props = { searchParams: Promise<{ page?: string }> };

export default async function MyExportsAttestationsPage({ searchParams }: Props) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const sp = await searchParams;
  const page = Math.max(1, Math.floor(Number(sp.page) || 1));

  const where = {
    actorUserId: session.user.id,
    category: AuditEventCategory.EXPORT,
  };

  const [total, rows] = await Promise.all([
    prisma.auditEvent.count({ where }),
    prisma.auditEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <PageHeader
        title="My CSV exports"
        description="Record of spreadsheet downloads you triggered through Aqila export links (employees, purchase orders, stock movements, projects, attendance — according to your permissions). Oslo timestamps."
      />

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" render={<Link href="/me" />}>
          ← Back to My portal
        </Button>
        <p className="text-muted-foreground max-w-xl text-xs leading-relaxed">
          Browser-only exports (for example “Export CSV” from a page that builds the file in your
          browser) are not listed here — only downloads served by the server’s export API, which the
          org audit log also captures for administrators.
        </p>
      </div>

      <div className="border-border bg-card rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[168px]">Time</TableHead>
              <TableHead className="w-[180px]">Export</TableHead>
              <TableHead>Summary</TableHead>
              <TableHead className="w-[120px]">IP</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground py-12 text-center text-sm">
                  No server-tracked CSV downloads yet for your account.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="text-muted-foreground whitespace-nowrap align-top text-xs">
                    {row.createdAt.toLocaleString("nb-NO", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                      timeZone: BUSINESS_TIME_ZONE,
                    })}
                  </TableCell>
                  <TableCell className="align-top">
                    <Badge variant="outline" className="font-mono text-[10px] font-normal">
                      {row.action.replace(/^export\./, "")}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-md align-top text-sm leading-snug">
                    {row.summary}
                  </TableCell>
                  <TableCell className="text-muted-foreground align-top font-mono text-xs">
                    {row.ipAddress ?? "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {total > 0 ? (
        <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-3 text-xs">
          <span>
            {totalPages > 1 ? `Page ${page} of ${totalPages} · ` : ""}
            {total} event{total === 1 ? "" : "s"}
          </span>
          {totalPages > 1 ? (
            <div className="flex gap-2">
              {page <= 1 ? (
                <Button variant="outline" size="sm" disabled>
                  Previous
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  render={<Link href={`/me/my-exports?page=${page - 1}`} />}
                >
                  Previous
                </Button>
              )}
              {page >= totalPages ? (
                <Button variant="outline" size="sm" disabled>
                  Next
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  render={<Link href={`/me/my-exports?page=${page + 1}`} />}
                >
                  Next
                </Button>
              )}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
