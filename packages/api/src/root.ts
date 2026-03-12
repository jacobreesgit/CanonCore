import { createTRPCRouter } from "./trpc";
import { watchRouter } from "./routers/watch";
import { forkRouter } from "./routers/fork";

/**
 * Root tRPC router — merges all domain sub-routers.
 * This is the single source of truth for the API type.
 *
 * Sub-routers added incrementally:
 * - watch: watch status (authed)
 * - fork: forking items (authed + public)
 *
 * TODO: item, itemFile, playlist, shelf, tmdb, user, auth, explore, public
 */
export const appRouter = createTRPCRouter({
  watch: watchRouter,
  fork: forkRouter,
});

/** Export type only — never import the router itself on the client */
export type AppRouter = typeof appRouter;
