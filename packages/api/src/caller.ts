import { createCallerFactory } from "./trpc";
import { appRouter } from "./root";
import { createTRPCContext } from "./context";
import type { CreateContextOptions } from "./context";

/**
 * Create a server-side tRPC caller.
 * Used in React Server Components for zero-overhead procedure calls.
 *
 * NOTE: Do NOT add `import "server-only"` here — this is a shared package.
 * The server-only guard is in apps/web/lib/trpc/server.ts.
 *
 * Usage in RSC:
 *   const caller = createCaller({ prisma, userId, authSource: "session" });
 *   const items = await caller.item.list({ parentId: null });
 */
const callerFactory = createCallerFactory(appRouter);

export function createCaller(opts: CreateContextOptions) {
  const ctx = createTRPCContext(opts);
  return callerFactory(ctx);
}
