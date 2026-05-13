/**
 * GET /api/health
 *
 * Health check endpoint used by:
 * - Docker HEALTHCHECK instruction
 * - CI/CD deployment pipeline (verifies container is alive before cutover)
 * - Uptime monitoring services
 *
 * Returns 200 when the app and DB connection are healthy.
 * Returns 503 if the DB cannot be reached.
 *
 * Optional JSON field **`revision`** when **`APP_VERSION`** or common CI env vars are set
 * (see `deployment-meta.ts`, `docs/application-observability.md`).
 */

import { NextResponse } from "next/server";
import { getDeploymentRevision } from "@/lib/deployment-meta";
import { prisma } from "@/lib/db";

function healthPayload(status: "ok" | "error", extras: Record<string, unknown>) {
  const revision = getDeploymentRevision();
  return {
    status,
    service: "aqila-ims",
    timestamp: new Date().toISOString(),
    ...(revision ? { revision } : {}),
    ...extras,
  };
}

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json(healthPayload("ok", {}), { status: 200 });
  } catch {
    return NextResponse.json(healthPayload("error", { message: "Database connection failed" }), {
      status: 503,
    });
  }
}
