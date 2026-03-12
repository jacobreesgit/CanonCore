import { TRPCError } from "@trpc/server";
import { t } from "../trpc";

/**
 * Create a rate-limiting middleware for a specific action name.
 * Usage: protectedProcedure.use(rateLimit("itemCreate")).mutation(...)
 *
 * The actual rate limit function is injected into context by the API route handler.
 * If no rate limit function is provided (e.g., RSC caller, tests), the middleware is a no-op.
 */
export function rateLimit(action: string) {
  return t.middleware(async ({ ctx, next }) => {
    if (ctx.checkRateLimit) {
      const result = await ctx.checkRateLimit(action);
      if (result !== null) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: result.error,
        });
      }
    }

    return next();
  });
}
