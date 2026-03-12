import "server-only";
import { cache } from "react";
import type { PrismaClient } from "@prisma/client";
import { createCaller } from "@canoncore/api/caller";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { makeQueryClient } from "./query-client";

/**
 * Stable per-request query client (for RSC prefetching).
 */
export const getQueryClient = cache(makeQueryClient);

/**
 * Server-side tRPC caller for React Server Components.
 * Calls tRPC procedures directly in-process (zero HTTP overhead).
 *
 * Usage:
 *   const trpc = await getServerCaller();
 *   const items = await trpc.item.list({ parentId: null });
 */
export async function getServerCaller() {
  const session = await auth();
  return createCaller({
    prisma: prisma as unknown as PrismaClient,
    userId: session?.user?.id ?? null,
    authSource: session?.user?.id ? "session" : null,
    // No rate limiting for RSC — server-side calls, no abuse vector
    checkRateLimit: null,
  });
}
