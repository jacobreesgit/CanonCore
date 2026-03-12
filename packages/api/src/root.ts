import { createTRPCRouter } from "./trpc";
import { watchRouter } from "./routers/watch";
import { forkRouter } from "./routers/fork";
import { shelfRouter } from "./routers/shelf";
import { itemRouter } from "./routers/item";
import { itemFileRouter } from "./routers/item-file";
import { playlistRouter } from "./routers/playlist";
import { exploreRouter } from "./routers/explore";
import { publicRouter } from "./routers/public";
import { tmdbRouter } from "./routers/tmdb";
import { userRouter } from "./routers/user";
import { authRouter } from "./routers/auth";

/**
 * Root tRPC router — merges all domain sub-routers.
 * This is the single source of truth for the API type.
 *
 * Sub-routers added incrementally:
 * - watch: watch status (authed)
 * - fork: forking items (authed + public)
 * - shelf: home shelves (authed)
 * - item: item CRUD, hierarchy, visibility, progress (authed + public)
 * - itemFile: file operations, playback progress, item settings (authed)
 * - playlist: playlist CRUD + public views (authed + public)
 * - explore: public explore page (items + playlists)
 * - public: public profiles, item detail, playlists
 * - tmdb: TMDB metadata search, apply, images (authed)
 * - user: profile management, password, account (authed)
 * - auth: sign-up, email verification, password reset (public)
 */
export const appRouter = createTRPCRouter({
  watch: watchRouter,
  fork: forkRouter,
  shelf: shelfRouter,
  item: itemRouter,
  itemFile: itemFileRouter,
  playlist: playlistRouter,
  explore: exploreRouter,
  public: publicRouter,
  tmdb: tmdbRouter,
  user: userRouter,
  auth: authRouter,
});

/** Export type only — never import the router itself on the client */
export type AppRouter = typeof appRouter;
