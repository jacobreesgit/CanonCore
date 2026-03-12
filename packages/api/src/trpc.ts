import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TRPCContext } from "./context";

/**
 * tRPC initialisation — done once per app.
 * superjson handles Date, BigInt, Map, Set serialisation.
 */
const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape }) {
    return shape;
  },
});

/** Export t for middleware that needs direct access */
export { t };

/** Create a router */
export const createTRPCRouter = t.router;

/** Create a caller factory for server-side calls (RSC) */
export const createCallerFactory = t.createCallerFactory;

/**
 * Public procedure — no auth required.
 * Used for: explore, public profiles, auth (sign-in/up).
 */
export const publicProcedure = t.procedure;

/**
 * Auth middleware — rejects unauthenticated requests.
 * Narrows ctx.userId from `string | null` to `string`.
 */
const enforceAuth = t.middleware(({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Not authenticated",
    });
  }
  return next({
    ctx: {
      userId: ctx.userId,
    },
  });
});

/**
 * Protected procedure — requires authenticated user.
 * Used for: all CRUD operations, user settings, etc.
 */
export const protectedProcedure = t.procedure.use(enforceAuth);
