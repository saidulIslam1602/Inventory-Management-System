import type { Prisma } from "@prisma/client";
import { AuditEventCategory } from "@prisma/client";
import { prisma } from "@/lib/db";

export type RecordAuditEventInput = {
  actorUserId: string | null;
  actorEmail?: string | null;
  category: AuditEventCategory;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  summary: string;
  metadata?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
};

function clampSummary(s: string): string {
  return s.length > 1024 ? `${s.slice(0, 1021)}...` : s;
}

function normalizeMetadata(meta: unknown): Prisma.InputJsonValue | undefined {
  if (meta === undefined) return undefined;
  try {
    const s = JSON.stringify(meta);
    if (s.length > 12000) {
      return { _truncated: true, approxBytes: s.length } as Prisma.InputJsonValue;
    }
    return JSON.parse(s) as Prisma.InputJsonValue;
  } catch {
    return { _invalidMetadata: true } as Prisma.InputJsonValue;
  }
}

/** Never throws — failures are logged only so user flows are not blocked. */
export async function recordAuditEventSafe(input: RecordAuditEventInput): Promise<void> {
  try {
    const meta = normalizeMetadata(input.metadata);
    await prisma.auditEvent.create({
      data: {
        actorUserId: input.actorUserId,
        actorEmail: input.actorEmail?.trim() || null,
        category: input.category,
        action: input.action.slice(0, 128),
        targetType: input.targetType ? input.targetType.slice(0, 64) : null,
        targetId: input.targetId ? input.targetId.slice(0, 64) : null,
        summary: clampSummary(input.summary),
        ...(meta !== undefined ? { metadata: meta } : {}),
        ipAddress: input.ipAddress ? input.ipAddress.slice(0, 64) : null,
        userAgent: input.userAgent ? input.userAgent.slice(0, 512) : null,
      },
    });
  } catch (e) {
    console.error("[audit_event]", e);
  }
}

export function extractAuditMetaFromRequest(req: Request): {
  ipAddress: string | null;
  userAgent: string | null;
} {
  const h = req.headers;
  const fwd = h.get("x-forwarded-for");
  const ip = fwd?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
  const ua = h.get("user-agent")?.slice(0, 512) || null;
  return { ipAddress: ip, userAgent: ua };
}

export async function extractAuditMetaFromNextHeaders(): Promise<{
  ipAddress: string | null;
  userAgent: string | null;
}> {
  const { headers } = await import("next/headers");
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  const ip = fwd?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
  const ua = h.get("user-agent")?.slice(0, 512) || null;
  return { ipAddress: ip, userAgent: ua };
}

export async function auditCsvExportDownload(opts: {
  req: Request;
  actor: { id: string; email?: string | null };
  exportKind: string;
  summary: string;
  metadata?: unknown;
}): Promise<void> {
  const { ipAddress, userAgent } = extractAuditMetaFromRequest(opts.req);
  await recordAuditEventSafe({
    actorUserId: opts.actor.id,
    actorEmail: opts.actor.email,
    category: AuditEventCategory.EXPORT,
    action: `export.${opts.exportKind}`,
    summary: opts.summary,
    metadata: opts.metadata,
    ipAddress,
    userAgent,
  });
}

/** Domain mutations (inventory, PO, projects, attendance, etc.) — “who did what”. */
export async function auditDataChange(opts: {
  session: { user: { id: string; email?: string | null | undefined } };
  action: string;
  summary: string;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: unknown;
}): Promise<void> {
  const h = await extractAuditMetaFromNextHeaders();
  await recordAuditEventSafe({
    actorUserId: opts.session.user.id,
    actorEmail: opts.session.user.email ?? null,
    category: AuditEventCategory.DATA,
    action: opts.action.slice(0, 128),
    targetType: opts.targetType ?? null,
    targetId: opts.targetId ?? null,
    summary: opts.summary,
    metadata: opts.metadata,
    ...h,
  });
}

export { AuditEventCategory };
