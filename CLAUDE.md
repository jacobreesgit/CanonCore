# CLAUDE.md — CanonCore v2 Developer Reference

CanonCore turns Google Drive into a fully featured media library with visual browsing, metadata enrichment, progress tracking, and public sharing. Built with Next.js 16, React 19, Prisma 7, Tailwind CSS 4. Always dark mode. Cinematic design language throughout.

Current version: **13.1.0**

---

## Monorepo Structure

```
canoncore/
  apps/
    web/                    # Next.js 16 web app (all existing code)
    mobile/                 # Expo React Native app
  packages/                 # Shared packages (future — Plan 2+)
    db/                     # Prisma schema, client, migrations
    types/                  # Shared TypeScript types
    validators/             # Shared Zod schemas
    services/               # Business logic
    api/                    # tRPC router
    store/                  # Redux Toolkit
    utils/                  # Shared utilities
    config/                 # Shared ESLint, TypeScript, Prettier configs
```

All commands run from the repo root. Turborepo orchestrates builds across workspaces. Web app source code lives in `apps/web/` — all file paths in this document are relative to `apps/web/` unless explicitly prefixed.

---

## Commands

All commands run from the **repo root** via Turborepo or pnpm filter:

| Command | Description |
|---|---|
| `pnpm dev` | Start dev server (Turbopack) |
| `pnpm build` | Production build (via turbo) |
| `pnpm start` | Start production server |
| `pnpm lint` | ESLint (via turbo) |
| `pnpm format` | Prettier write (via turbo) |
| `pnpm format:check` | Prettier check (via turbo) |
| `pnpm type-check` | TypeScript `tsc --noEmit` (via turbo) |
| `pnpm knip` | Unused code detection (via turbo) |
| `pnpm run check` | Full pipeline: format + lint + type-check + knip + build |
| `pnpm run test` | Unit tests (Vitest) |
| `pnpm run test:watch` | Unit tests in watch mode |
| `pnpm run test:coverage` | Unit tests with coverage |
| `pnpm run test:integration` | Integration tests (Vitest, real DB) |
| `pnpm run test:e2e` | E2E tests (Playwright) |
| `pnpm run test:e2e:ui` | E2E with Playwright UI |
| `pnpm storybook` | Storybook dev server (port 6006) |
| `pnpm run test-storybook` | Storybook interaction + a11y tests |
| `pnpm seed` | Seed database (requires `ALLOW_SEEDING=true`) |
| `pnpm seed:development` | Seed dev data with TMDB + Drive |
| `pnpm seed:production` | Seed production data |
| `pnpm seed:screenshots` | Seed screenshot data for mockups |
| `pnpm run mockups` | Screenshot + mockup + webp pipeline (headed) |
| `pnpm run env:dev` | Switch `.env.local` to development Neon branch |
| `pnpm run env:demo` | Switch `.env.local` to demo Neon branch |
| `pnpm analyze` | Bundle analysis (`ANALYZE=true` build) |
| `pnpm changelog` | Generate changelog |
| `pnpm release` | Release with changelog |

**IMPORTANT:** Always use `pnpm run test` (not `pnpm vitest run` directly). Running vitest without the `--config` flag picks up E2E files and produces incorrect results. The `pnpm run test` command uses `tests/unit/vitest.config.ts` which scopes to unit tests only.

**Workspace-specific commands:** Use `pnpm --filter @canoncore/web <command>` to run a command directly in the web workspace (e.g., `pnpm --filter @canoncore/web exec prisma generate`).

---

## Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | Next.js 16 (App Router, Turbopack), React 19 (Server Components, Server Actions), TypeScript 5.9, Tailwind CSS 4, shadcn/ui (Radix primitives), Font Awesome 7, dnd-kit, Vidstack (media), Redux Toolkit (queue state), nuqs (URL state), Embla Carousel, cmdk (spotlight), motion (animations) |
| **Backend** | Next.js Server Actions (primary), API Routes (streaming only), Prisma 7 ORM, NextAuth.js v5 (credentials, JWT sessions) |
| **Database** | PostgreSQL on Neon (serverless), Upstash Redis (rate limiting) |
| **External APIs** | Google Drive API v3 (OAuth 2.0, Changes API), TMDB API v3 (metadata), Resend (email) |
| **Observability** | Sentry (client/server/edge), OpenTelemetry via @vercel/otel, Vercel Analytics + Speed Insights |
| **Testing** | Vitest (unit + integration), Playwright (E2E), Storybook 10 (component + a11y via axe-core), Testing Library |
| **CI/CD** | GitHub Actions (quality gate, schema migration, tests, build), Husky + lint-staged (pre-commit), commitlint (conventional commits) |

---

## Architecture

### Route Groups

```
app/
├── (auth)/                   # Sign-in, sign-up, forgot/reset password
│   └── layout.tsx            # Redirect guard (authed users -> home)
├── (public)/                 # All public-facing pages
│   ├── page.tsx              # Landing page (homepage)
│   ├── explore/              # Explore page (Collections/Playlists tabs)
│   ├── u/[username]/         # Public profile
│   │   ├── [itemId]/         # Public item detail
│   │   └── playlists/
│   │       └── [playlistId]/ # Public playlist detail
│   ├── docs/[[...slug]]/     # Fumadocs documentation
# NOTE: loading.tsx was removed from explore/, u/[username]/, u/[username]/[itemId]/,
# and u/[username]/playlists/[playlistId]/. Pages now fetch data at page level so the
# previous page stays visible during client-side navigation.
│   └── legal/[[...slug]]/    # Legal pages (privacy, terms, cookies)
├── api/
│   ├── artwork/[fileId]/     # Image streaming from Drive
│   ├── stream/[fileId]/      # Media streaming (HTTP Range)
│   ├── fork/[itemId]/        # Fork operation (streaming response)
│   ├── user/avatar/ & hero/  # Profile image endpoints
│   ├── public/avatar/ & hero/# Public profile image endpoints
│   ├── playlist/artwork/     # Playlist artwork upload
│   ├── health/               # Health check for uptime monitors
│   ├── auth/[...nextauth]/   # NextAuth handlers
│   └── username/check/       # Username availability check
└── verify-email/             # Email verification (outside auth group)
```

### Component Organisation

```
components/
├── hero/               # CinematicHero, HeroAvatar
├── homepage/           # Landing page sections (HeroSection, MediaStack, FeatureAccordion)
├── items/              # Item CRUD, grid/tree views, context menus, TMDB wizard
│   ├── wizards/        # TMDB metadata wizard, TV picker
│   └── move-to-dialog.tsx  # Move item to different parent
├── media/              # MediaPlayerShell, MiniPlayer, QueuePanel, ExpandedViewport, PlaybackKeyboardHandler
├── mobile/             # Bottom sheets, footer nav, swipeable tabs
├── playlists/          # Playlist CRUD, grid, sortable grid, context menu, mobile sheets
│   ├── mobile-add-to-playlist-sheet.tsx   # Mobile add-to-playlist bottom sheet
│   ├── mobile-create-playlist-sheet.tsx   # Mobile create playlist bottom sheet
│   └── mobile-edit-playlist-sheet.tsx     # Mobile edit playlist bottom sheet
├── profile/            # Profile page, settings dialog
├── providers/          # QueryProvider, StoreProvider, ThemeProvider, ErrorBoundary
├── search/             # Global spotlight search (cmdk)
├── skeletons/          # Skeleton fallbacks (explore, item, playlist, profile)
├── sortable-grid/      # dnd-kit grid (view + edit mode)
├── sortable-tree/      # dnd-kit hierarchical tree
├── ui/                 # Shared UI primitives (shadcn/ui + custom), media-badges.tsx (duration/resolution badges)
├── wizards/            # Wizard state machine, progress bar, step indicator
├── scroll-to-top.tsx   # Scroll restoration on route changes
├── app-sidebar.tsx     # Main sidebar
├── site-header.tsx     # Top navigation bar
└── nav-*.tsx           # Navigation components
```

### Hooks Directory

```
hooks/
├── search-params.ts           # nuqs parser definitions for items
├── playlist-search-params.ts  # nuqs parser definitions for playlists
├── use-infinite-items.ts      # Generic infinite scroll with React Query
├── use-search-param.ts        # Debounced URL search (?q=) via nuqs
├── use-items-url-state.ts     # Sort/filter/view/tab URL state for items
├── use-explore-url-state.ts   # Explore page URL state
├── use-playlist-url-state.ts  # Playlist detail URL state
├── use-viewer-url-state.ts    # Profile viewer URL state
├── use-bulk-selection.ts      # Checkbox selection with cascading
├── use-fork-dialog.ts         # Fork dialog state management
├── use-item-settings-form.ts  # 20+ field form shared by desktop dialog + mobile sheet
├── use-mobile.ts              # Responsive breakpoint detection
├── use-create-playlist-form.ts # Shared create playlist form state (desktop dialog + mobile sheet)
├── use-edit-playlist-form.ts  # Shared edit playlist form state (desktop dialog + mobile sheet)
├── use-sync-handler.ts        # Google Drive sync state machine
└── ...                        # Other hooks (lazy image, online status, reduced motion, etc.)
```

### Lib Directory

**Server Actions** — all mutations in `lib/*-actions.ts`:

| File | Responsibility |
|---|---|
| `item-actions.ts` | Item CRUD, reordering, pinning, progress, reparenting (move) |
| `item-file-actions.ts` | File upload, deletion, primary/hero assignment |
| `playlist-actions.ts` | Playlist CRUD, artwork, share tokens, item membership, reordering |
| `fork-actions.ts` | Forking collections |
| `watch-actions.ts` | Watch status (create, mark, unmark, batch, status query) |
| `shelf-actions.ts` | Home shelf CRUD and data fetching |
| `tmdb-actions.ts` | Metadata search, image fetching, per-field clearing, display options |
| `google-drive-actions.ts` | OAuth, sync, connection management |
| `auth-actions.ts` | Sign up, forgot/reset password, email verification, lockout check |
| `user-actions.ts` | Profile updates, image uploads, account deletion, data export |
| `queue-aware-actions.ts` | Offline queue-aware variants of item actions |
| `public-auth.ts` | Public data fetching with visibility enforcement |

**Key utilities:**

| File | Purpose |
|---|---|
| `types.ts` | All shared TypeScript types (`PaginatedResult<T>`, `ItemWithArtwork`, `PublicItemCard`, etc.). `ItemWithArtwork` includes `primaryDurationMs` and `primaryHeight` |
| `validations.ts` | Zod schemas for all inputs |
| `cursor.ts` | Cursor-based pagination (`encodeCursor`, `decodeCursor`, `PAGE_SIZE = 24`) |
| `colour-extract.ts` | Server-only dominant colour extraction via sharp |
| `colour-utils.ts` | Client-safe colour math (shade generation, saturation boost) |
| `auth.ts` | NextAuth configuration |
| `prisma.ts` | Prisma client singleton |
| `rate-limit.ts` | Upstash Redis rate limiting with per-action thresholds |
| `errors.ts` | Prisma error handling utilities |
| `logger.ts` | Pino structured logging |
| `format-time.ts` | Format seconds to `m:ss` or `h:mm:ss` for playback display |
| `media-metadata.ts` | Resolution labels (`getResolutionLabel`) and duration formatting (`formatDuration`) |
| `stream-utils.ts` | Shared `nodeStreamToWeb()` for artwork and stream routes |
| `icons.ts` | Custom Font Awesome icon definitions (`faSlashForward`) |
| `source.ts` | Fumadocs content sources (docs + legal collections) |

### Redux Store (`lib/store/`)

| File | Purpose |
|---|---|
| `types.ts` | `QueueTrack`, `RepeatMode`, `PlaybackState`, `UiPrefsState` types |
| `playback-slice.ts` | Queue management, skip, shuffle, repeat, expanded state (16 actions) |
| `ui-prefs-slice.ts` | Sidebar collapsed, default view mode |
| `index.ts` | Store factory with `configureStore`, preloaded state from localStorage |
| `hooks.ts` | Typed `useAppDispatch` / `useAppSelector` hooks |
| `selectors.ts` | Memoised selectors (`selectCurrentTrack`, `selectQueue`, `selectUpNext`, `selectIsVideoFile`, etc.) |
| `persistence-middleware.ts` | Listener middleware persisting repeat/sidebar/viewMode to localStorage |
| `track-helpers.ts` | `buildQueueTrack()` factory from item + file data, prefers Drive durationMs over playbackDuration |

**Key principle:** Playback transport (play/pause, time, volume, seeking) is owned by Vidstack. Redux manages queue lifecycle, shuffle/repeat mode, and expanded view state only. Never subscribe to `currentTime` in Redux.

### Content

- `content/docs/` — Fumadocs MDX user documentation (British English)
- `content/legal/` — Legal pages MDX (privacy, terms, cookies) via second Fumadocs collection (`legalSource`)

---

## Code Conventions

### Dark Mode Only

The app is **always** dark mode. `forcedTheme="dark"` and `className="dark"` on the `<html>` element. Single unified `:root` in `globals.css` with cinematic dark values. There is no light mode and no `.dark {}` override. Do not add light mode styles.

### Icons

**All icons use Font Awesome 7** (`@fortawesome/react-fontawesome`). lucide-react was removed from the project. FOUC prevention: `config.autoAddCss = false` in `app/layout.tsx` with manual CSS import of `@fortawesome/fontawesome-svg-core/styles.css`.

```typescript
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFolder } from "@fortawesome/free-solid-svg-icons";

<FontAwesomeIcon icon={faFolder} className="h-4 w-4" />
```

### ESLint

Unused destructured parameters must be prefixed with `_`:

```typescript
// Correct
export async function someAction({ currentUserId: _currentUserId }) { ... }

// Wrong — ESLint error
export async function someAction({ currentUserId }) { ... }
```

### Dynamic Imports

`next/dynamic()` requires **default exports**. Components with only named exports will cause type errors:

```typescript
// Correct — wrapper provides default export
const AddItemDialog = dynamic(
  () => import("./add-item-dialog").then((mod) => ({ default: mod.AddItemDialog })),
  { ssr: false }
);
```

### Server Actions Pattern

Every server action follows the same structure: parallel rate limit + auth checks, Zod validation, then operation:

```typescript
"use server";

import { auth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { itemNameSchema } from "@/lib/validations";
import type { ItemResult } from "@/lib/types";

export async function createItem(
  name: string,
  parentId: string | null
): Promise<ItemResult<{ id: string }>> {
  // 1. Parallel auth + rate limit
  const [rateLimitResult, session] = await Promise.all([
    checkRateLimit("createItem"),
    auth(),
  ]);

  if (!rateLimitResult.success) return { error: "Rate limit exceeded" };
  if (!session?.user?.id) return { error: "Not authenticated" };

  // 2. Validate input
  const parsed = itemNameSchema.safeParse(name);
  if (!parsed.success) return { error: "Invalid name" };

  // 3. Perform operation
  try {
    const item = await prisma.item.create({ ... });
    return { success: true, data: { id: item.id } };
  } catch (error) {
    return handlePrismaError(error);
  }
}
```

### Validation

All Zod schemas live in `lib/validations.ts`. Key schemas:

- `itemNameSchema` — alphanumeric, spaces, hyphens, underscores, parens; 1-255 chars
- `itemDescriptionSchema` — max 1000 chars, trimmed
- `playlistNameSchema` — any printable chars, 1-255, trimmed
- `playlistVisibilitySchema` — `"private" | "unlisted" | "public"`
- `usernameSchema` — 3-20 chars, `[a-z0-9_]`, no leading/trailing/consecutive underscores, not reserved
- `passwordSchema` — 8+ chars, uppercase + lowercase + number
- `tmdbDisplayOptionsSchema` — 7 boolean fields for per-item TMDB display toggles

### Result Types

Server actions return `ItemResult<T>`:

```typescript
type ItemResult<T = void> =
  | { success: true; data?: T; error?: never }
  | { success?: never; error: string };
```

### Section Padding

Individual sections handle their own padding via the `<Section>` component. Do **not** add padding to server component page wrappers — this breaks full-bleed heroes:

```typescript
import { Section } from "@/components/ui/section";

// Section uses responsive CSS variables for horizontal padding
<Section>
  <h2>Content here</h2>
</Section>
```

### Dialog Reset Pattern

Dialogs use the React "adjust state during render" pattern for synchronous reset instead of `useEffect`:

```typescript
const [prevOpen, setPrevOpen] = useState(false);
if (open && !prevOpen) {
  setPrevOpen(true);
  // Reset state synchronously
  setSelectedFolder(null);
  setSearchQuery("");
}
if (!open && prevOpen) {
  setPrevOpen(false);
}
```

This avoids the flash of stale state that `useEffect` cleanup causes.

---

## Cinematic Design System

### Colour Pipeline

10 `@property`-registered CSS custom properties (`--dark-100` through `--dark-1000`) enable animated colour transitions. The pipeline:

1. **Extraction** — `extractDominantColour()` in `lib/colour-extract.ts` (server-only, sharp) analyses backdrop images
2. **Shading** — `createColourShades(hex)` in `lib/colour-utils.ts` (client-safe) generates 10 shades from one colour
3. **CSS Registration** — `@property` rules in `globals.css` register each as `<color>` type (enables CSS transitions on custom properties)
4. **Injection** — `CinematicHero` sets shades as inline styles + adds `.transition-colours-pipeline` class (500ms crossfade)

Hero overlay gradients use `color-mix(in srgb, var(--dark-900) N%, transparent)` — they resolve from the item's colour scope.

### CSS Tokens

```css
:root {
  /* Core tokens */
  --background: #0a0a0a;
  --foreground: rgba(255, 255, 255, 0.95);
  --card: #141414;
  --border: rgba(255, 255, 255, 0.1);

  /* Extended tokens */
  --tertiary-foreground, --glow, --glass-bg, --glass-border, --glass-hover

  /* Section spacing */
  --section-px-mobile through --section-px-2xl

  /* Gradients */
  --gradient-hero-overlay (3-layer diagonal using color-mix with --dark-900)
  --gradient-card
}
```

### Animation Classes

Defined in `app/globals.css` with `prefers-reduced-motion` support:

- `.ken-burns` — slow zoom effect on hero backdrops
- `.animate-fade-in` — opacity fade
- `.animate-slide-up` — slide + fade from below
- `.stagger-grid` — cascading entrance for grid children
- `.skeleton-shimmer` — loading placeholder animation
- `.transition-colours-pipeline` — 500ms crossfade on all 10 colour properties

---

## Key Patterns

### Suspense Streaming

Shell renders immediately (SiteHeader, skeleton), heavy content streams via Suspense:

```typescript
export default async function ExplorePage() {
  const session = await auth();
  return (
    <>
      <SiteHeader title="Explore" />
      <Suspense fallback={<ExploreContentSkeleton />}>
        <ExploreContent currentUserId={session?.user?.id} />
      </Suspense>
    </>
  );
}
```

Pages using this: Explore, Profile/My Items, Item Detail, Playlist Detail. Skeleton components in `components/skeletons/` match exact layout dimensions to prevent CLS.

**Note:** The four public routes (Explore, Profile, Item Detail, Playlist Detail) had their `loading.tsx` removed in favour of page-level data fetching — the previous page stays visible during client-side navigation, preventing double-skeleton flash. A `<ScrollToTop />` component in the public layout handles scroll restoration.

### URL State (nuqs)

Sort, filter, view mode, and tab persisted to URL query parameters:

```
?sort=name-asc&filter=has-files&view=grid&tab=contents
```

- Parsers defined in `hooks/search-params.ts` and `hooks/playlist-search-params.ts`
- URL state hooks: `use-items-url-state.ts`, `use-explore-url-state.ts`, `use-playlist-url-state.ts`, `use-viewer-url-state.ts`
- localStorage backup for direct navigation (no query params)

### Infinite Scroll

`useInfiniteItems<T>` hook wraps React Query's `useInfiniteQuery` with cursor-based pagination:

```typescript
const { items, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteItems({
  queryKey: ["explore-items", sort, filter, search],
  fetchAction: (cursor) => getPublicItems({ cursor, sort, filter, search }),
  initialData,  // SSR data for first page
  maxPages: 5,  // Cap pages in memory
});
```

`InfiniteScrollTrigger` component uses Intersection Observer (200px rootMargin) to trigger `fetchNextPage`.

### Search

`useSearchParam` hook provides debounced URL sync:

```typescript
const { inputValue, committedValue, setInputValue, clear } = useSearchParam("q", 300);
// inputValue — immediate for <input> binding
// committedValue — debounced for queries (syncs to ?q= after 300ms)
```

### Cursor-Based Pagination

`lib/cursor.ts` provides encode/decode utilities for compound cursors:

- `encodeCursor(updatedAt, id)` / `decodeCursor(cursor)` — for `updatedAt DESC` sorts
- `encodeOrderCursor(order, id)` / `decodeOrderCursor(cursor)` — for `order ASC` sorts
- `encodeDescendantCursor(depth, order, id)` — for hierarchical lists
- `PAGE_SIZE = 24`
- `PaginatedResult<T> = { items: T[]; nextCursor: string | null }`

### Edit Mode Separation

- **View mode** uses `Grid` component (no dnd-kit, no drag overhead)
- **Edit mode** uses `SortableGrid` component (dnd-kit loaded, drag handles + checkboxes)
- Saves ~40KB client bundle when just viewing

### ItemTreePicker

Shared virtualised tree picker (`@tanstack/react-virtual`) in `components/items/item-tree-picker.tsx`:

- **Single-select mode** — used by ForkDestinationDialog (pick destination folder)
- **Multi-select mode** — used by CreatePlaylistDialog (pick items to add)
- Searchable with filtering

### ViewerItemContextMenu

Right-click context menu for items the current user does not own:

- Fork — opens ForkDestinationDialog
- Add to Playlist — opens AddToPlaylistDialog
- Located in `components/items/viewer-item-context-menu.tsx`

### PrivateResourceNotice

Helpful notice shown when the owner visits their own private resource via a public URL. Tells them the content is not visible to others.

### useSyncExternalStore

Used for hydration-safe synchronous reads (e.g., tab mount state). Avoids the `useState` + `useEffect` pattern that causes hydration mismatches.

### Media Playback Architecture

Single `<MediaPlayer>` (Vidstack) wraps the entire app at root layout level (`app/layout.tsx`). Key design:

- **`MediaPlayerShell`** (`components/media/media-player-shell.tsx`) — outer shell keeps `<MediaPlayer>` mounted forever once the first track plays (prevents React remounts and CSS animation replays). When no track is loaded, src is an empty array (Vidstack idles). Inner component handles auto-play, MediaSession API, position persistence (30s interval + `visibilitychange`), idle timer
- **`<MediaProvider>`** (the `<video>`/`<audio>` element) is always mounted, CSS-repositioned between collapsed (off-screen) and expanded (visible) — no remount, no playback interruption
- **`MiniPlayer`** (`components/media/mini-player.tsx`) — persistent bottom bar with Plex-style full-bleed seek bar (3px track, thumb on hover). 2-column layout on mobile. `MiniPlayerProgress` subscribes to `currentTime`/`duration` independently to avoid re-rendering the parent at 60fps. Separate `MiniPlayerTimestamps` component
- **`QueuePanel`** (`components/media/queue-panel.tsx`) — side sheet with now-playing card, up-next list, dnd-kit drag reorder. Mobile bottom sheet variant using MobileBottomSheet (85% snap)
- **`PlaybackKeyboardHandler`** (`components/media/playback-keyboard-handler.tsx`) — renders `null`. Space, M, arrows, F shortcuts. Skips interactive elements
- **`ExpandedViewport`** (`components/media/expanded-viewport.tsx`) — video (empty container, MediaProvider CSS-repositioned), audio with artwork (poster + blur), audio without artwork (MeshGradient)

`body:has([data-player-active])` in `globals.css` adds bottom padding when mini-player is visible.

### Detail Settings Menus

Hero action buttons consolidated into dropdown menus accessed via a gear icon:

- **`DetailSettingsMenu`** — owner: edit, pin, add child, Drive link, playlist, watch status, delete
- **`ViewerDetailSettingsMenu`** — viewer: fork, add to playlist, sign-in prompt
- **`PlaylistDetailSettingsMenu`** — playlist owner: edit, share, delete

Located in `components/items/` and `components/playlists/`. Context menu "Settings" action renamed to "Edit Item".

`DetailSettingsMenu` and `ViewerDetailSettingsMenu` use `MobileAddToPlaylistSheet` on mobile for the Add to Playlist action.

### Mobile Bottom Sheets

Mobile playlist sheets: `MobileCreatePlaylistSheet`, `MobileEditPlaylistSheet`, `MobileAddToPlaylistSheet` in `components/playlists/`. These share hooks with their desktop dialog counterparts (`useCreatePlaylistForm`, `useEditPlaylistForm`).

### Item Context Menu Actions

`ItemContextMenu` (`components/items/item-context-menu.tsx`) includes:

- **Copy Link** — builds `/u/{username}/{itemId}` URL
- **Move to...** — opens MoveToDialog for reparenting items
- **Play** — replaces queue with the item's tracks

### TMDB Wizard

Skip buttons moved from inline checkboxes to the dialog footer via `onSkipCurrent` in `TMDBWizardFooterProps`.

### Dynamic Imports for Heavy Dialogs

Dialogs like AddItemDialog, ForkDestinationDialog, CreatePlaylistDialog are loaded via `next/dynamic` with `{ ssr: false }` — saves ~25KB per dialog from the initial bundle.

---

## Database

### Stack

Prisma 7 ORM with Neon PostgreSQL (serverless). Connection via `@prisma/adapter-pg`.

### Key Models

| Model | Purpose |
|---|---|
| `User` | Auth (email, bcrypt hash), profile (username, isPublic, image/hero blobs, bio), security (tokenVersion, lockout) |
| `Item` | Self-referential tree (parentId), metadata, TMDB fields, Drive sync, visibility, dominant colour |
| `ItemFile` | Files attached to items (MEDIA/ARTWORK/SUBTITLE), Drive sync, playback position, video dimensions (durationMs, width, height) |
| `GoogleDriveConnection` | OAuth tokens (AES-256-GCM encrypted), quota tracking, one per user |
| `Playlist` | Cross-cutting reference lists, visibility (private/unlisted/public), shareToken, artwork blob |
| `PlaylistItem` | Many-to-many join (Playlist + Item) with ordering |
| `WatchRecord` | Watch events per item per user, source (AUTO/MANUAL), 5-min dedup window |
| `Fork` | Tracks item copies (sourceItemId, targetItemId), unique per user+source |
| `AuditLog` | Automatic mutation tracking via Prisma extension, sensitive field redaction |
| `SyncLog` | Google Drive sync operation history |

### Item Visibility

An item is "fully public" when ALL of these are true:

1. `item.isPublic === true`
2. `profile.isPublic === true` (user has public profile)
3. All ancestor items are public

`inheritVisibility: true` means the item follows its parent's visibility. The Explore page only shows items with `isPublic: true, inheritVisibility: false` (explicitly public roots).

### Incremental Seeding

`User.seedContentHash` stores a SHA-256 hash of the user's seed configuration. The seed script compares hashes before seeding to skip unchanged users. Performance: ~5s for 0 changes, ~30s for 1 user, ~3min for full rebuild.

---

## Testing

### Test Pyramid

```
3,500+ tests total across all layers

Unit (~3,100)     — Vitest, mocked deps, fast/isolated
Integration (~200) — Vitest, real PostgreSQL
Storybook (77)     — Component stories, axe-core a11y, interaction tests
E2E (33 specs)     — Playwright, real browser, real APIs
```

### Unit Tests

- **Config:** `tests/unit/vitest.config.ts` (inherits from root via `mergeConfig`)
- **Run:** `pnpm run test` (NEVER `pnpm vitest run` directly)
- **Environment:** jsdom
- **Mocked:** Prisma, Resend, Upstash Redis, Google Drive API, TMDB API
- **Coverage:** `lib/**` only

### Integration Tests

- **Config:** `tests/integration/vitest.config.ts`
- **Run:** `pnpm run test:integration`
- **Real:** PostgreSQL database (Prisma queries hit real DB)
- **Mocked:** External APIs, email, rate limiting (`BYPASS_RATE_LIMIT=true`)

### Both configs inherit from root `vitest.config.ts`:

```typescript
// vitest.config.ts (root)
export default defineConfig({
  test: {
    globals: true,
    server: {
      deps: {
        // next-auth is ESM and imports next/server without .js extension
        inline: ["next-auth"],
      },
    },
  },
  resolve: { alias: { "@": path.resolve(__dirname, "./") } },
});
```

### E2E Tests (Playwright)

- **Location:** `e2e/journeys/` (33 spec files)
- **Run:** `pnpm run test:e2e`
- **Pattern:** Page Object Model with composable fixtures
- **Fixtures:** `e2e/fixtures/` — per-test user creation, browser auth injection, cleanup
- **Page Objects:** 16 focused POMs in `e2e/pages/`
- **Config:** `e2e/config/` — centralised timeouts, collision-free test data, shared locators
- **Projects:** Desktop Chrome + Mobile Chrome (Pixel 7)
- **Real:** Full Next.js app (port 3001, separate `.next-e2e` build dir), real PostgreSQL, real TMDB API

### Storybook

- **Location:** Co-located `*.stories.tsx` files (77 stories)
- **A11y:** Every story tested against axe-core — any violation fails the build
- **Run:** `pnpm storybook` (dev), `pnpm run test-storybook` (CI)
- **MSW:** Mock server in `.storybook/mocks/` for server actions

---

## Common Gotchas

1. **`pnpm vitest run` picks up E2E files** — always use `pnpm run test` which passes the correct config.

2. **`knip` reports "Duplicate exports"** when both named + default exports exist in the same file. This is expected for components used with `next/dynamic()`. Do not "fix" by removing the named export.

3. **Pre-existing knip warnings** (do not try to fix):
   - `embla-carousel-autoplay` — unused dependency

4. **`next-auth` ESM resolution** — `next-auth` imports `next/server` without `.js` extension, which fails under Node.js ESM resolution. The root `vitest.config.ts` has `test.server.deps.inline: ["next-auth"]` to fix this.

5. **Server component padding and full-bleed heroes** — server component wrappers that add padding (`px-4 py-6 md:px-6 lg:px-8`) break full-bleed heroes. Let individual sections handle their own padding via `<Section>`.

6. **CSS `@property` registration required** — without `@property` registration, CSS custom properties are strings and cannot animate. The 10 `--dark-*` properties must stay registered in `globals.css`.

7. **`MeshGradient` must be imported statically** — dynamic import causes a 616ms TBT regression on the homepage.

8. **Radix portal selectors in Storybook** — Radix dialogs/dropdowns portal to `document.body`. Tests must use `within(document.body)` instead of `canvasElement`.

9. **CardShell `.first()` in E2E** — CardShell renders item names twice (default + hover overlay). Playwright selectors use `.first()` to avoid strict mode violations.

10. **BigInt serialisation** — `ItemFile.size` is `bigint` from Prisma. Use `serializeItemFile()` from `lib/types.ts` before passing to client components.

11. **Vidstack `<MediaPlayer>` at root layout** — the single `<MediaPlayer>` in `app/layout.tsx` wraps the entire app. Never create additional `<MediaPlayer>` instances. Use `useMediaState`/`useMediaRemote` hooks to interact with it from any component.

12. **Redux for queue only, not transport** — playback transport (play/pause, currentTime, volume) is owned by Vidstack. Redux manages queue lifecycle, shuffle/repeat, and expanded state. Never subscribe to `currentTime` in Redux — use Vidstack's `useMediaState("currentTime")` in isolated components to avoid 60fps re-renders.

13. **Public route `loading.tsx` files removed** — the four public routes (Explore, Profile, Item Detail, Playlist Detail) no longer have `loading.tsx`. Data is fetched at page level so the previous page stays visible during client-side navigation. `<ScrollToTop />` in the public layout handles scroll restoration.

---

## Documentation

| File | Audience | Purpose |
|---|---|---|
| `CLAUDE.md` (this file) | AI assistants | Dev-facing reference for working on the codebase |
| `DESIGN.md` | Portfolio viewers | Deep architecture, API design, implementation decisions |
| `README.md` | Portfolio viewers | Engineering achievements showcase |
| `content/docs/` | End users | Fumadocs user documentation (British English) |
| `content/legal/` | End users | Privacy policy, terms of service, cookie policy |

For deep architecture details, API design patterns, CI/CD pipeline specifics, and implementation decisions, see `DESIGN.md`.

---

## Deployment

### Vercel Projects

Three separate Vercel projects, each restricted to specific branches via `git.deploymentEnabled` in `vercel.json`:

| Project | Branch | Purpose |
|---|---|---|
| **canoncore** | `production` | Main Next.js app |
| **canoncore-demo** | `demo` | Demo environment (same code, different env vars) |
| **canoncore-storybook** | `storybook` | Storybook static build |

All other branches (including `development`) are blocked with `"*": false` to prevent deploy spam.

**Branch structure differs between production and development:**
- **production** — flat structure, `vercel.json` at repo root
- **development** — monorepo structure, `vercel.json` at `apps/web/`

Both branches have matching `git.deploymentEnabled` configs.

### Neon Database Branches

| Branch | Purpose |
|---|---|
| `main` | Production database |
| `development` | Local dev + CI |
| `demo` | Demo environment (seeded showcase data) |
| `e2e` | E2E test isolation |

### Environment Switching

`pnpm run env:dev` and `pnpm run env:demo` copy the corresponding `.env.*` file to `.env.local`. All env vars are also uploaded to all three Vercel projects, so `vercel env pull` after `vercel link` won't lose configuration.

---

## Mobile App (`apps/mobile/`)

Expo React Native app. Dark mode only. Cinematic design matching the web app.

### Mobile Tech Stack

| Layer | Technologies |
|---|---|
| **Framework** | Expo SDK 54, Expo Router 6, React Native 0.81, React 19 |
| **Navigation** | Expo Router (file-based), React Navigation 7 (bottom tabs) |
| **Styling** | NativeWind 5 (Tailwind CSS 4 for RN), react-native-css |
| **State** | Redux Toolkit, Redux Persist (MMKV), React Query, tRPC |
| **Media** | expo-video (PiP, background playback), react-native-track-player |
| **Storage** | expo-secure-store (tokens), expo-sqlite (offline), MMKV (preferences) |
| **Testing** | Maestro (E2E), Jest + Testing Library (unit) |
| **Build** | EAS Build (local + cloud), EAS Submit |

### Mobile Commands

All commands run from `apps/mobile/`:

| Command | Description |
|---|---|
| `npx expo start --dev-client` | Start dev server (requires dev client installed on simulator) |
| `pnpm lint` | ESLint |
| `pnpm type-check` | TypeScript `tsc --noEmit` |
| `pnpm test` | Jest unit tests |
| `pnpm test:e2e` | Maestro smoke tests |
| `pnpm test:e2e:all` | All Maestro flows |

### Mobile Route Structure

```
app/
├── _layout.tsx           # Root Stack navigator + providers
├── (auth)/               # Auth screens (sign-in, sign-up, forgot-password)
│   └── _layout.tsx       # Auth Stack
├── (tabs)/               # Main tab navigator (4 tabs)
│   ├── _layout.tsx       # Tab bar config with tabBarButtonTestID
│   ├── index.tsx         # Home tab
│   ├── explore.tsx       # Explore tab
│   ├── library.tsx       # Library tab
│   └── profile.tsx       # Profile tab
└── item/[id].tsx         # Item detail (pushed on Stack)
```

### Bundle ID & App Config

- **Bundle ID (iOS):** `com.canoncore.mobile`
- **Package (Android):** `com.canoncore.mobile`
- **URL Scheme:** `canoncore` (defined in `app.config.ts`)
- **SDK Version:** 54.0.0

### Dev Client (CRITICAL)

**The app MUST run as a dev client, NOT Expo Go.** Maestro needs `appId: com.canoncore.mobile` to launch/control the app. Expo Go registers as `host.exp.Exponent`, so Maestro can't target our app inside it.

```bash
# Build for iOS simulator (local)
npx eas-cli build --profile development-simulator --platform ios --local

# Output: build-<timestamp>.tar.gz (~234MB, gitignored)
# Extract and install:
tar -xzf build-*.tar.gz -C /tmp/eas-build
xcrun simctl install booted /tmp/eas-build/CanonCore.app

# Start dev server
npx expo start --dev-client
```

On first launch, the dev client shows a launcher screen with Metro server URLs. After connecting to `http://localhost:8081` once, it remembers. **Do NOT use `clearState` in Maestro `launchApp`** — it resets this connection.

A first-run welcome dialog ("Continue") and dev menu overlay may appear. The dev menu can be dismissed with `pressKey: back`.

### EAS Build Profiles

| Profile | Purpose |
|---|---|
| `development-simulator` | iOS simulator dev client (`ios.simulator: true`) |
| `development` | Physical device dev client (`distribution: internal`) |
| `preview` | Internal testing |
| `production` | App Store / Play Store submission |

---

## Maestro E2E Testing

### Maestro iOS Tap Bug (CRITICAL)

**`tapOn` does NOT trigger `onPress` on many iOS elements.** Known Maestro bug ([Issue #2448](https://github.com/mobile-dev-inc/maestro/issues/2448)). The tap mechanically "succeeds" (element found, tap synthesised) but the callback never fires. Affects ALL selector strategies — `id`, `text`, accessibility labels. Affects both Expo Go AND standalone dev clients.

**Affected elements:**
- React Navigation tab bar buttons
- Elements inside React Native `<Modal>` (`presentationStyle="formSheet"`)
- Elements inside Expo Router `presentation: "modal"` screens
- FAB buttons positioned `absolute` over FlatList scroll areas

**Elements that DO work with `tapOn`:** Item cards (Link > Pressable), play button, mini-player, download button, search input/clear, sign-in button, sign-out button, TextInput focus.

**Workarounds:**
- **Tab navigation:** Use `openLink` with the app's URL scheme via `navigate-tab.yaml`
- **Modal dismissal:** Use `swipe: direction: DOWN, duration: 400` instead of tapping close buttons
- **FAB buttons:** Use deep link with query params (e.g., `canoncore:///(tabs)/library?create=1`)
- **Form submission in modals:** Use `pressKey: Enter` with `onSubmitEditing` on TextInputs (Pressable confirm buttons don't respond to tap)

### Tab Navigation Pattern

All tab navigation uses the `navigate-tab.yaml` subflow:

```yaml
- runFlow:
    file: subflows/navigate-tab.yaml
    env:
      TAB: "library"   # one of: index, explore, library, profile
```

The subflow uses `openLink: canoncore:///(tabs)/${TAB}` and handles the one-time iOS "Open in CanonCore?" confirmation dialog. **Never use `tapOn` for tab switching** — it reports COMPLETED but the screen won't change.

### Tab Bar

Default React Navigation tab bar (not a custom `tabBar` component). Styled via `screenOptions.tabBarStyle`. Each tab has `tabBarButtonTestID` set — useful for `assertVisible` even though taps don't work.

```
tabBarButtonTestID values: tab-home, tab-explore, tab-library, tab-profile
```

**Important:** The prop is `tabBarButtonTestID` (React Navigation 7 / Expo Router 6), NOT `tabBarTestID` (React Navigation 6).

### Maestro Flow Structure

```
.maestro/
├── config.yaml                    # Workspace config (appId, env vars)
├── auth-flow.yaml                 # Sign in / sign out
├── browse-flow.yaml               # Navigate tabs, view items
├── playback-flow.yaml             # Media playback
├── download-flow.yaml             # Offline downloads
├── playlist-flow.yaml             # Playlist UI (create sheet, form)
├── screenshots/                   # App Store screenshot capture flows
│   ├── screenshot-explore.yaml
│   ├── screenshot-library.yaml
│   ├── screenshot-item-detail.yaml
│   └── screenshot-player.yaml
└── subflows/
    ├── launch-and-sign-in.yaml    # Launch app + authenticate
    ├── navigate-tab.yaml          # Deep link tab navigation
    └── sign-out.yaml              # Sign out flow
```

### Test Credentials

Hardcoded in `launch-and-sign-in.yaml` (not env vars — Maestro's flow-level `env` block does NOT support `${VAR:-default}` bash syntax; it evaluates as JavaScript and errors):
- Email: `demo@canoncore.com`
- Password: `SeedPassword123!`

The workspace `config.yaml` also defines these with `${VAR:-default}` syntax which works at workspace level only.

### Running Maestro Tests

```bash
# Prerequisites (ALL three must be running):
# 1. Simulator booted with dev client installed
xcrun simctl boot <UDID>
# 2. Expo dev server (Metro bundler)
npx expo start --dev-client --port 8081  # in apps/mobile/
# 3. API server (web app) — auth calls hit localhost:3000
pnpm dev                                  # in apps/web/ or repo root

# Run tests (from apps/mobile/)
maestro test .maestro/auth-flow.yaml        # Single flow
maestro test .maestro/ --include-tags smoke  # Smoke suite
maestro test .maestro/                       # All flows
```

### launch-and-sign-in.yaml Pattern

The launch subflow handles all possible app states after `launchApp`:

1. **Wait for bundle** — `extendedWaitUntil: visible: "Welcome back|Home"` (regex, 45s timeout). The `|` works because Maestro's `visible` uses regex matching.
2. **Dismiss alerts** — conditional `runFlow: when: visible: "OK"` clears leftover error dialogs.
3. **Dismiss dev menu** — conditional `runFlow: when: visible: "Toggle performance monitor"` then `pressKey: back`.
4. **Handle existing session** — if "Home" is visible, run `sign-out.yaml` first.
5. **Sign in** — `eraseText: 30` to clear fields, `inputText` credentials, `pressKey: back` to dismiss keyboard (not `hideKeyboard` which is flaky on iOS), tap sign-in button.

### Maestro Conditional Elements

There is **no `optional: true` on `tapOn`**. Handle optional elements with conditional flows:

```yaml
# Correct — conditional execution
- runFlow:
    when:
      visible: "Some Optional Element"
    commands:
      - tapOn: "Some Optional Element"

# WRONG — optional is not a valid tapOn parameter
- tapOn:
    text: "Some Optional Element"
    optional: true  # Does not exist!
```

### Key testIDs

| Element | testID |
|---|---|
| Tab bar buttons | `tab-home`, `tab-explore`, `tab-library`, `tab-profile` |
| Auth inputs | `email-input`, `password-input` |
| Sign in button | `sign-in-button` |
| Sign out button | `sign-out-button` |
| Home screen | `home-screen` |
| Section headers | `section-{title-kebab}` (e.g., `section-recently-updated`) |
| Search input | `search-input`, `search-clear` |
| Item grid | `search-results`, `item-card-0`, `item-card-1`, ... |
| Item cards (by ID) | `item-{cuid}` (e.g., `item-cmmm3c9gt000g9hl0zkyad8k7`) |
| Explore tabs | `explore-tab-items`, `explore-tab-playlists` |
| Item detail | `item-detail-screen`, `play-button`, `item-settings-button` |
| Download button | `download-button` / `download-progress` / `download-complete` (dynamic by status) |
| Mini player | `mini-player` |
| Expanded player | `expanded-player`, `close-player`, `queue-button` |
| Playback controls | `play-pause-button`, `skip-previous-button`, `skip-next-button`, `shuffle-button`, `repeat-button` |
| Queue panel | `queue-panel` |
| Create playlist | `create-playlist-button`, `playlist-name-input`, `create-playlist-confirm` |
| Playlist detail | `playlist-detail-screen` |
| Profile downloads | `profile-downloads-link` |
| Downloads list | `downloads-list` |

### Maestro Gotchas

1. **`tapOn` on tabs "succeeds" but doesn't navigate** — Maestro iOS bug. Use deep links via `navigate-tab.yaml`.

2. **`clearState` breaks dev client** — Resets the Metro server connection. App shows launcher screen instead of loading.

3. **Dev menu overlay blocks tests** — Dismiss with `pressKey: back` before asserting elements.

4. **"Open in CanonCore?" dialog** — iOS shows this once per session when a deep link is opened. `navigate-tab.yaml` handles it with a conditional `runFlow`.

5. **Flow-level `env` doesn't support bash defaults** — `${VAR:-default}` syntax causes `SyntaxError` (Maestro evaluates as JS). Hardcode credentials or use workspace `config.yaml`.

6. **`eraseText` needs a character count** — Bare `eraseText` may not clear all text. Use `eraseText: 30` to reliably clear fields.

7. **Bundle still loading after launch** — Use `extendedWaitUntil` with a long timeout (45s) to wait for the JS bundle to finish downloading before asserting UI elements.

8. **Build artifacts are huge** — `build-*.tar.gz` ~234MB. Gitignored via `build-*.tar.gz` in `.gitignore`. Delete after installing.

9. **API server must be running** — Auth calls hit `localhost:3000`. If the web app dev server isn't running, sign-in fails with "Invalid email or password". Run `pnpm dev` from repo root.

10. **`hideKeyboard` is flaky on iOS** — No native API; Maestro uses a scroll heuristic that often fails. Use `pressKey: back` instead to dismiss the keyboard.

11. **`extendedWaitUntil` supports regex** — `visible: "Welcome back|Home"` matches either string. Useful for detecting multiple possible app states after launch.

12. **`SafeAreaView` hides children from accessibility tree** — `SafeAreaView` from `react-native-safe-area-context` wrapping tab content causes: (1) `TextInput` elements hidden from Maestro's view hierarchy, (2) white background rendering bug. Fix: remove `SafeAreaView` wrapper, let Tabs handle safe areas via `headerStyle`. Use plain `<View>` instead.

13. **`scrollUntilVisible` scrolls BEFORE checking** — If an element is already visible, `scrollUntilVisible` pushes it out of view. Use `assertVisible` or `extendedWaitUntil` instead when the element is likely already on screen.

14. **`wait` is not a valid Maestro command** — Use `extendedWaitUntil` for conditional waiting or `waitForAnimationToEnd` for animations.

15. **Downloads fail in simulator** — No real Google Drive files to download. The download button shows "Retry" immediately. Don't assert `download-progress` in E2E tests; just verify the button exists and the downloads screen is accessible.

16. **`run_flow` (MCP) subflow paths break** — MCP `run_flow` runs from a temp directory, so relative `runFlow: file:` paths don't resolve. Use `run_flow_files` for flows with subflows. Use `run_flow` only for ad-hoc single commands.

17. **Deep link for create playlist** — Library screen supports `?create=1` query parameter to auto-open CreatePlaylistSheet, bypassing the FAB tap bug: `openLink: "canoncore:///(tabs)/library?create=1"`.

### Reference Repos

- **[EvanBacon/expo-router-maestro-test](https://github.com/EvanBacon/expo-router-maestro-test)** — By Expo Router creator. Uses `openLink` for navigation. Our deep link approach is based on this.
- **[MathieuFedrigo/maestro-expo](https://github.com/MathieuFedrigo/maestro-expo)** — CI integration example. Uses `tabBarTestID` with default tab bar. Runs on **Maestro Cloud** (paid SaaS with different tap mechanism), NOT local CLI. Do not assume their `tapOn` patterns work locally.
