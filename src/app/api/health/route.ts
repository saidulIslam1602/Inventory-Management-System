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
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    // Verify DB connectivity with a lightweight query
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json(
      {
        status: "ok",
        service: "aqila-ims",
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch {
    return NextResponse.json(
      {
        status: "error",
        service: "aqila-ims",
        message: "Database connection failed",
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
