import { createTRPCRouter } from "./trpc";

/**
 * Root tRPC router — merges all domain sub-routers.
 * This is the single source of truth for the API type.
 *
 * Sub-routers are added as they are built:
 * - item, itemFile: private CRUD (authed)
 * - playlist: playlist CRUD (authed)
 * - watch: watch status (authed)
 * - shelf: home page shelves (authed)
 * - tmdb: TMDB metadata operations (authed)
 * - user: profile/account management (authed)
 * - auth: sign in/up, password reset (public)
 * - explore: browse/search public content (public)
 * - public: public profile/item/playlist detail (public)
 * - fork: forking items (authed)
 */
export const appRouter = createTRPCRouter({});

/** Export type only — never import the router itself on the client */
export type AppRouter = typeof appRouter;
