/**
 * Health check endpoint for uptime monitoring.
 * Verifies application and database connectivity.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-cache, no-store, must-revalidate",
};

/**
 * GET /api/health
 * Returns application health status including database connectivity.
 * Excluded from rate limiting — used by uptime monitors.
 *
 * @returns 200 with status "ok" if healthy, 503 if database unreachable
 */
export async function GET() {
  const timestamp = new Date().toISOString();

  try {
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json(
      { status: "ok", timestamp, database: "connected" },
      { status: 200, headers: NO_CACHE_HEADERS }
    );
  } catch {
    return NextResponse.json(
      { status: "error", timestamp, database: "disconnected" },
      { status: 503, headers: NO_CACHE_HEADERS }
    );
  }
}
