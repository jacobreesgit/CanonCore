import type { PrismaClient } from "@prisma/client";

/**
 * Rate limit check function type.
 * Matches the signature of checkRateLimit() from apps/web/lib/rate-limit.ts.
 * Returns null if allowed, { error: string } if rate limited.
 * Injected by the API route handler — keeps Upstash Redis as a web-only dep.
 */
export type RateLimitFn = (
  action: string
) => Promise<{ error: string } | null>;

/**
 * Context available to every tRPC procedure.
 * userId is null for unauthenticated requests (public procedures).
 */
export interface TRPCContext {
  prisma: PrismaClient;
  userId: string | null;
  /** Source of auth: "session" (web/NextAuth) or "jwt" (mobile/Bearer) */
  authSource: "session" | "jwt" | null;
  /**
   * Rate limit function — injected by API route handler.
   * null when called via createCallerFactory (RSC) where rate limiting is unnecessary.
   */
  checkRateLimit: RateLimitFn | null;
}

/**
 * Options for creating context — passed from the API route handler.
 * Web passes NextAuth session, mobile passes JWT from Authorization header.
 */
export interface CreateContextOptions {
  prisma: PrismaClient;
  userId: string | null;
  authSource: "session" | "jwt" | null;
  /** Pass checkRateLimit from apps/web/lib/rate-limit.ts. Null for RSC callers. */
  checkRateLimit?: RateLimitFn | null;
}

/**
 * Create the tRPC context from resolved auth info.
 * Auth resolution happens in the API route handler (app/api/trpc/[trpc]/route.ts)
 * because NextAuth and JWT verification are web-specific concerns.
 */
export function createTRPCContext(opts: CreateContextOptions): TRPCContext {
  return {
    prisma: opts.prisma,
    userId: opts.userId,
    authSource: opts.authSource,
    checkRateLimit: opts.checkRateLimit ?? null,
  };
}
