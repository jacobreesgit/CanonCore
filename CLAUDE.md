# CanonCore

## Overview

CanonCore is a media library management platform built with Next.js 16, React 19, and TypeScript. It turns Google Drive into a visual media library with metadata enrichment, progress tracking, and public sharing. Deployed on Vercel with Neon PostgreSQL.

## Tech Stack

- **Framework:** Next.js 16 (App Router, Turbopack), React 19
- **Language:** TypeScript 5.9
- **Styling:** Tailwind CSS 4, shadcn/ui (Radix primitives)
- **Icons:** Font Awesome 7 (`@fortawesome/react-fontawesome`, `free-solid-svg-icons`, `free-brands-svg-icons`)
- **ORM:** Prisma 7 with Neon PostgreSQL (serverless)
- **Auth:** NextAuth.js v5 (credentials provider, JWT sessions)
- **Cache/Rate Limiting:** Upstash Redis
- **Error Monitoring:** Sentry (client/server/edge)
- **Observability:** OpenTelemetry via @vercel/otel, Vercel Speed Insights
- **Testing:** Vitest, Playwright, Storybook
- **Package Manager:** pnpm 10

## Key Commands

```
pnpm run dev          # Start development server
pnpm run build        # Production build
pnpm run lint         # ESLint
pnpm run format       # Prettier
pnpm run type-check   # TypeScript check
pnpm run knip         # Unused code detection
pnpm run check        # Full quality gate (format + lint + type-check + knip + build)
pnpm run test         # Unit tests (Vitest)
pnpm run test:integration  # Integration tests (real DB)
pnpm run test:e2e     # E2E tests (Playwright)
pnpm run storybook    # Component dev environment
pnpm run analyze      # Bundle analyzer
pnpm run changelog    # Generate changelog
```

## Project Structure

```
app/
  (auth)/           # Sign-in, sign-up, forgot/reset password
  (public)/         # Landing, explore, user profiles, item detail, playlist detail, docs, legal
    docs/           # Fumadocs documentation at /docs (shared ContentLayout)
    legal/          # Legal pages at /legal (privacy, terms, cookies)
  api/              # Health check, streaming, artwork, playlist artwork, auth callbacks
  sitemap.ts        # Dynamic sitemap generation
  opengraph-image.tsx # Default OG image
components/
  hero/             # CinematicHero carousel (colour theming, logo overlays, fade transitions)
  homepage/         # Landing page sections (hero, feature accordion, manifesto CTA, media stack)
  items/            # Item CRUD, grid, tree, settings, TMDB editing, logo selection components
  playlists/        # Playlist CRUD, detail, grid items, context menus, sortable grid
  skeletons/        # Layout-matched loading skeletons (explore, profile, item, playlist)
  google-drive/     # Drive connection, sync, storage
  providers/        # Auth, theme, analytics providers
  ui/               # shadcn/ui primitives (includes CardShell shared card base)
  nav-collapsible-item.tsx  # Reusable collapsible sidebar nav item (Get Help, Legal sections)
lib/
  *-actions.ts      # Server Actions (item, auth, user, tmdb, drive, fork, playlist, watch, shelf)
  prisma.ts         # Prisma client singleton
  rate-limit.ts     # Upstash rate limiting
  tmdb-client.ts    # TMDB API client (includes logo fetching and getBestLogo selector)
  tmdb-image-utils.ts # Client-safe TMDB image URL builders (poster, backdrop, logo)
  colour-extract.ts # Server-only dominant colour extraction via sharp stats()
  colour-utils.ts   # Client-safe colour shading (createColourShades for CSS custom properties)
  validations.ts    # Zod schemas
  bot-patterns.ts   # Bot detection lists
  types.ts          # Shared types (items, playlists, public auth, shelves)
  watch-actions.ts  # Watch status server actions (create, mark, unmark, batch, status)
  watch-record-utils.ts # Shared dedup utility for WatchRecord creation
  system-playlists.ts   # System playlist definitions (Continue Watching, Watchlist, etc.)
  shelf-actions.ts      # Home shelf CRUD and data fetching
  shelf-query-utils.ts  # Shelf item query functions (system + user playlists, React.cache() deduplicated)
  motion-features.ts # LazyMotion async feature bundle (domAnimation)
  source.ts         # Fumadocs source loaders (docs + legal collections)
hooks/
  use-item-settings-form.ts  # Shared form state for item settings (desktop dialog + mobile sheet)
  use-settings-form.ts       # Profile settings form state (SettingsFormStep: main/password/email/username/delete-account)
  use-settings-dialog.ts     # Dialog lifecycle, file fetching, settings refresh
  use-playlist-url-state.ts  # Playlist detail URL state (view, sort, filter, tab)
  use-viewer-url-state.ts    # Profile viewer URL state (tab, filter)
  playlist-search-params.ts  # nuqs parser definitions for playlist params
content/
  docs/             # Fumadocs MDX content (user-facing help)
  legal/            # Legal page MDX content (privacy policy, terms of service, cookie policy)
tests/
  unit/             # Vitest unit tests (mocked deps)
  integration/      # Vitest integration tests (real DB)
e2e/                # Playwright E2E tests
  journeys/         # Test spec files
  fixtures/         # Page Object Models and test fixtures
  config/           # Shared utilities (item-locators.ts, timeouts.ts, test-data.ts)
prisma/
  schema.prisma     # Database schema (User, Item, ItemFile, Playlist, PlaylistItem, Fork, etc.)
  seed.ts           # Seeding script
```

## Architecture Patterns

### Server Actions

All mutations go through server actions in `lib/*-actions.ts`. Every action runs rate limit + auth checks in parallel via `Promise.all`. Inputs validated with Zod schemas from `lib/validations.ts`. Playlist actions follow the same pattern in `lib/playlist-actions.ts` (14 actions covering CRUD, artwork, share tokens, item membership, and reordering). Watch actions in `lib/watch-actions.ts` (6 actions: create, mark, unmark, batch mark/unmark, status query). Shelf actions in `lib/shelf-actions.ts` (5 actions: getHomeShelves, getShelfConfig, add, remove, reorder). Account management actions (`deleteAccount`, `exportAccountData`) in `lib/user-actions.ts` handle GDPR data export and permanent account deletion with password verification, cascade cleanup, and best-effort Google Drive folder trash.

### Route Groups

- `(auth)` -- authentication pages, redirect guard for logged-in users
- `(public)` -- landing, explore (tabbed: Collections/Playlists), profiles (`/u/[username]`), item detail, playlist detail (`/u/[username]/playlists/[playlistId]`), docs (`/docs`), legal (`/legal`)

### Sidebar Navigation

The sidebar uses `NavCollapsibleItem` (`components/nav-collapsible-item.tsx`) for collapsible sections. Two modes:
- **Link mode** (`href` provided): label navigates, separate chevron toggles sub-items (used for My Items with pinned children, Get Help with doc sections)
- **Toggle mode** (no `href`): clicking label toggles collapse (used for Legal)

Get Help and Legal sections are defined in `nav-main.tsx` with their own link arrays (`docsLinks`, `legalLinks`). Both default to collapsed (`defaultOpen={false}`).

### Legal Pages

Legal content (privacy policy, terms of service, cookie policy) lives in `content/legal/` as MDX files, rendered via a second Fumadocs collection (`legalSource` in `lib/source.ts`, defined in `source.config.ts`). Route at `app/(public)/legal/[[...slug]]/page.tsx`. Legal links appear in the sidebar, auth page footers, and public layout footer. Legal pages are included in the sitemap.

### Error Handling

- Route-level error boundaries: `app/(auth)/error.tsx`, `app/(public)/error.tsx`
- Global error boundary: `app/global-error.tsx` (standalone HTML, no layout dependency)
- Custom 404 pages: `app/not-found.tsx`, `app/(public)/not-found.tsx`
- All error boundaries report to Sentry

### Observability

- Sentry: client (`sentry.client.config.ts`), server (`sentry.server.config.ts`), edge (`sentry.edge.config.ts`)
- OpenTelemetry registered in `instrumentation.ts`
- Speed Insights loaded via deferred analytics in `components/providers/deferred-analytics.tsx`
- Health check at `/api/health` (DB connectivity, no rate limiting)

### SEO

- Dynamic sitemap at `app/sitemap.ts` (static pages + public profiles + public items)
- Dynamic OG images for root, profiles, items, and playlists
- JSON-LD structured data on landing, profile, item, and playlist pages
- Twitter card metadata

### Playlists

Cross-cutting many-to-many reference lists. Items stay in their tree position and can appear in multiple playlists. Key patterns:

- **Schema:** `Playlist` (name, description, order, isPublic, artworkImage, shareToken) + `PlaylistItem` join table (order for drag-to-reorder)
- **Visibility:** Private (default), Public (appears on explore), Unlisted (accessible via share token URL only)
- **Share tokens:** Generated with `nanoid`, stored on `Playlist.shareToken`. Unlisted playlists are accessible at `/u/[username]/playlists/[playlistId]?token=[shareToken]`
- **Artwork:** Binary blob stored on Playlist model, uploaded via `/api/playlist/artwork` route. PlaylistGridItem shows 4-poster collage when no custom artwork
- **CardShell:** Shared visual base component (`components/ui/card-shell.tsx`) used by PlaylistGridItem. Glass background, border, hover glow
- **Explore tabs:** Collections tab (existing items) + Playlists tab (public playlists), URL-backed via `use-explore-url-state`
- **Profile tabs (viewer):** Items + Playlists tabs, URL-backed via `use-viewer-url-state`

### TMDB Editing

Item settings TMDB editing uses a decomposed component architecture with shared form state:

- **Components:** `TmdbSourceField` (Details tab, shows linked source + inline detach), `TmdbMetadataSection` (TMDB tab container), `TmdbArtworkField` (per-field artwork display with change/clear), `TmdbArtworkChangeDialog` (image gallery picker), `LogoSelectionGrid` (logo picker for change dialog), `LogoThumbnail` (shared thumbnail for transparent PNGs). All in `components/items/`.
- **Form state:** `useItemSettingsForm` hook (`hooks/use-item-settings-form.ts`) centralises all form fields, wizard state, and handlers. Includes `logoArtworkId` for manual logo uploads. Shared between `ItemSettingsDialog` (desktop) and `MobileItemSheet` (mobile).
- **Dialog lifecycle:** `useSettingsDialog` hook (`hooks/use-settings-dialog.ts`) wraps file fetching and settings refresh.
- **Server actions:** `clearTmdbFieldAction(itemId, "poster" | "backdrop" | "logo" | "all")` for per-field clearing or full detach. `updateTmdbDisplayOptions(itemId, options)` for display toggles. `applyMetadataAction` auto-extracts dominant colour from backdrop and selects best logo.
- **Validation:** `clearTmdbFieldSchema` (`z.enum(["poster", "backdrop", "logo", "all"])`) and `tmdbDisplayOptionsSchema` (7 boolean toggles) in `lib/validations.ts`.
- **Logo resolution priority:** Manual upload (`isLogo` artwork file) > TMDB logo (`tmdbLogoPath`) > text title fallback. Resolved in `item-detail-client.tsx`.
- **Wizard flow:** Movie/Show: text → poster → hero → logo → summary. Season: text → poster → summary. Episode: text → still → summary. Logo step uses `LogoSelectionStep` with skip checkbox and tabs for TMDB/existing files.
- **DOM parity:** `TmdbArtworkField` and `TmdbSourceField` mirror `FileTypeCombobox` layout (7px icon circle, label hierarchy, outline button, inline action icon) for visual consistency across tabs.
- **Override badges:** `FileTypeCombobox` accepts a `note` prop to show badges when TMDB artwork is set (e.g., "Currently using TMDB poster. Upload to override.").

### Cinematic Visual Pipeline

End-to-end colour theming system that extracts a dominant colour from item backdrops and propagates it through the entire page via CSS custom properties.

- **Colour extraction:** `lib/colour-extract.ts` (server-only) uses `sharp.stats()` for dominant colour analysis. Accepts Buffer or URL. `boostSaturation()` in `lib/colour-utils.ts` ensures extracted colours are vibrant enough for theming while clamping lightness to stay within cinematic dark range.
- **Colour shading:** `createColourShades(hex)` in `lib/colour-utils.ts` generates 10 shades (`--dark-100` through `--dark-1000`) by lerping from white → input colour → black. Shade 700 ≈ the input colour. Client-safe (no external deps).
- **CSS @property registration:** 10 `@property` rules in `globals.css` register `--dark-100` through `--dark-1000` with `syntax: "<color>"` and `inherits: true`. This enables CSS transitions on custom properties (normally impossible without registration). Initial values match the neutral dark theme.
- **Transition class:** `.transition-colours-pipeline` in `globals.css` transitions all 10 custom properties at 500ms ease — producing smooth crossfade between slide colours in the carousel.
- **Hero injection:** `CinematicHero` calls `createColourShades()` with the active slide's `dominantColour`, sets result as inline `style` on the section element, and adds the transition class. Hero overlay gradients use `color-mix(in srgb, var(--dark-900) N%, transparent)` instead of hardcoded `rgba()` — resolving from the hero's own inline colour scope.
- **Page propagation:** `HeroContentLayout` accepts `dominantColour` prop, wrapping the full page in a div with colour shade inline styles. Content below the hero inherits the themed CSS variables.
- **Carousel callback:** `CinematicHero` fires `onColourChange(colour)` when the active slide changes. Explore page uses this to update `HeroContentLayout`'s `dominantColour` in state.
- **Auto-extraction triggers:** (1) `applyMetadataAction` extracts colour from TMDB backdrop URL during metadata application. (2) `updateItemSettings` extracts colour from uploaded hero image buffer. Both store result in `Item.dominantColour`.
- **Logo support:** TMDB logos fetched via `TMDBImages.logos` array. `getBestLogo()` selector prioritises English logos > highest vote average. `getLogoUrl()` and `getTmdbLogoUrl()` build CDN URLs. `CinematicHero` renders logo image with responsive `max-w`/`max-h` constraints and text title fallback on error (per-slide `logoErrorIds` state).
- **Schema:** `Item.tmdbLogoPath` (String?), `Item.dominantColour` (String?), `ItemFile.isLogo` (Boolean, default false).
- **Utility script:** `scripts/reextract-colours.ts` backfills `dominantColour` for existing items with TMDB backdrops.

### Sync Status Indicators

The `MetadataLine` component (`components/items/metadata-line.tsx`) renders sync status with icon + label in the hero banner. Four states: SYNCED (check icon, when `driveFileId` present), SYNCING (animated spinner), PENDING (small dot), ERROR (warning triangle, `text-destructive`). `HeroSlide` type includes optional `syncStatus` and `driveFileId` props. On the explore page, sync data is fetched server-side and filtered to only the current user's own items (privacy: other users' Drive data not exposed). Grid cards use CSS `has-[[data-state=open]]` to keep cards elevated while Radix dropdowns are open. Tree items swap the sync icon for the more-options button on hover via paired opacity transitions.

### Mobile Account Management

`MobileSettingsSheet` (`components/profile/mobile-settings-sheet.tsx`) has full account management parity with desktop: data export and account deletion. The `SettingsFormStep` union type (`hooks/use-settings-form.ts`) includes a `"delete-account"` step for navigation within the mobile bottom sheet. Delete flow mirrors desktop: password + "DELETE" confirmation, calls `deleteAccount` server action, signs out on success.

### Homepage Performance

The homepage (`components/homepage/`) uses several performance patterns:

- **CSS Modules for layout:** `hero-section.module.css` and `media-stack.module.css` use container queries (`@container`) instead of viewport queries for sidebar-aware responsiveness. Hero uses a Payload-inspired 16-column grid (mobile: 8-col, desktop: 16-col) with `--gutter-h` and `--column` CSS variables. Breakpoints: 1024px (16-col, 4rem gutter), 1600px (8rem gutter).
- **MediaStack is a server component:** `media-stack.tsx` has no `"use client"` directive. Images animate via CSS `@keyframes stackFadeIn` in the module CSS, not JS. Zero client JavaScript for the image stack.
- **LazyMotion + `m` components:** Homepage wraps remaining animated content in `<LazyMotion features={loadFeatures} strict>` (in `homepage-content.tsx`). Child components import `m` from `motion/react-m` instead of `motion` from `motion/react`. The `strict` prop throws if any child accidentally uses `motion.*` instead of `m.*`. Feature bundle loaded async from `lib/motion-features.ts` (~15kb `domAnimation`).
- **`m` has no `.create()`:** The `m` export from `motion/react-m` only provides HTML/SVG elements (`m.div`, `m.h2`, etc.). It does NOT expose `.create()` — only the full `motion` object has that. To animate `next/image`, wrap `<Image>` in `<m.div>` instead.
- **`AnimatePresence` stays from `motion/react`:** It's a context component, not an animated element — it cannot come from `motion/react-m`.
- **All homepage images use `next/image`:** CDN images (Vercel Blob) and local images use `<Image>` with `sizes` props. Media stack IMAGE_1 has `priority` (LCP candidate), IMAGE_2 has `loading="eager"`.
- **Noise texture is CSS-generated:** `homepage-content.tsx` uses an inline SVG `feTurbulence` data URI instead of `noise.png` (saves 328KB).
- **Do NOT dynamically import MeshGradient:** `@mesh-gradient/react` must be imported statically. Dynamic importing it via `next/dynamic` causes a TBT regression (616ms long task from deferred chunk parsing).
- **`auth()` is deduplicated:** `lib/auth.ts` wraps the NextAuth `auth` function with `React.cache()` to deduplicate per-request JWT decode across layout, page, and server actions.
- **Lighthouse scores (desktop, localhost):** Performance 96 (+6), LCP 1.3s (-0.7s), SI 0.9s (-0.4s), TBT 0ms, CLS 0, FCP 0.3s, Total bytes 1,161 KiB (-2,183 KiB / -65%).

### Page Load Streaming

Four public pages (Explore, Profile, Item Detail, Playlist Detail) use Suspense boundaries to stream heavy content while rendering a fast shell immediately. Pattern:

- **Shell renders first:** `SiteHeader` + breadcrumbs render synchronously using minimal data (auth session, profile lookup). This gives the user instant visual feedback.
- **Heavy content streams:** An async server component (e.g., `ExploreContent`, `OwnerItemContent`) wraps all expensive fetches (TMDB enrichment, descendant queries, files, drive connection) inside `<Suspense fallback={<Skeleton />}>`.
- **Route-level `loading.tsx`:** Each page has a `loading.tsx` that renders the same skeleton during Next.js route transitions (e.g., sidebar navigation).
- **Layout-matched skeletons:** Four skeleton components in `components/skeletons/` match exact dimensions of their real pages — hero height (`55vh`/`65vh` + header), grid columns (`grid-cols-2/3/4/6`), glassmorphism toolbar, tabs — to prevent CLS.
- **Skeleton components:** `ExploreContentSkeleton` (hero carousel + dots + 12-card grid), `ProfileContentSkeleton` (avatar ring + grid + shelf), `ItemContentSkeleton` (hero + tabs + 6-card grid), `PlaylistContentSkeleton` (hero + tabs + 6-card grid).
- **Cache deduplication:** `getSystemShelfItems` in `lib/shelf-query-utils.ts` wrapped with `React.cache()` to deduplicate calls within a single request. Both args are primitives so `Object.is` equality works.
- **E2E coverage:** `e2e/journeys/navigation/page-transitions.spec.ts` tests loading state visibility and CLS during page transitions.

### Home Shelves

Configurable horizontal scroll rows on the authenticated home page. Any playlist with a non-null `shelfOrder` appears as a shelf. System playlists (Continue Watching, Watchlist, Recently Added, Watch Again) are virtual — computed at query time, not stored as PlaylistItem rows.

- **Server actions:** `lib/shelf-actions.ts` — `getHomeShelves()` (cached), `getShelfConfig()`, `addPlaylistAsShelf()`, `removeShelf()`, `reorderShelves()`. System shelf items dispatched via `getSystemShelfItems()`.
- **Components:** `components/homepage/home-shelves.tsx` (server, renders shelf sections), `components/homepage/shelf-row.tsx` (client, horizontal scroll with gradient fades, snap scroll, arrow key navigation). Shelf cards use the shared `GridItem` component — not a custom card.
- **ShelfItem type:** Minimal for server serialisation: `{ id, name, tmdbPosterPath, artworkId, childCount, playbackProgress }`. Intentionally lighter than `ItemWithArtwork`.
- **Two progress concepts:**
  - **Playback progress** (shelves): `playbackPosition / playbackDuration * 100` from the primary media file. Shows how far through a single video the user is (e.g., 40% through a film). Available on all shelf items via `resolveShelfItems()`; null when no primary media or no position data.
  - **Descendant completion** (library grid): `watchedItems / itemsWithMedia * 100` from `buildDescendantProgressMap()`. Shows series-level progress (e.g., 3/10 episodes watched). Used by `GridItem` in the main library view.
- **Continue Watching query:** Raw SQL merging two sources: (1) resume items — `playbackPosition > 0` with no `WatchRecord`, (2) up-next items — first unwatched child in series with at least one watched child. Deduplicated and sorted by recency.
- **System playlist definitions:** `lib/system-playlists.ts` — `SYSTEM_PLAYLIST_DEFS` array with default shelf orders. `ensureSystemPlaylists()` creates missing ones idempotently (protected by `@@unique([userId, systemType])` + `skipDuplicates`).

### Watch Status Tracking

Explicit watch event tracking via `WatchRecord` model. Replaces playback-position-based "watched" detection with discrete scrobble events.

- **Schema:** `WatchRecord` (itemId, userId, source, watchedAt). `WatchSource` enum: `AUTO` (playback ≥ 80%) or `MANUAL` (user action). Composite indexes on `[userId, watchedAt DESC]` and `[itemId, userId, watchedAt DESC]`.
- **Auto-scrobble:** `updatePlaybackPosition` in `lib/item-actions.ts` checks if playback crosses 80% threshold (Trakt standard). Calls `createWatchRecordIfNotRecent()` from `lib/watch-record-utils.ts`.
- **Deduplication:** 5-minute window prevents rapid duplicate scrobbles from seeking or replaying. Shared between auto-scrobble and manual `createWatchRecord` action.
- **Server actions:** `lib/watch-actions.ts` — `createWatchRecord`, `markAsWatched`, `markAsUnwatched` (removes most recent, preserves history), `getWatchStatus` (no rate limit — read-only), `markAllWatched`, `markAllUnwatched` (batch with recursive CTE).
- **Completion threshold:** 80% (Trakt standard, changed from 90%). `progress-utils.ts` uses WatchRecord existence for `isWatched`, not playback position percentage.
- **Context menu:** `components/items/item-context-menu.tsx` — watch status actions in item right-click menus.

## Design System

- Always dark mode (`forcedTheme="dark"`, `className="dark"` on html). Single unified `:root` with cinematic dark values. No `.dark {}` override needed.
- Single `:root` in `globals.css` with all tokens (no light/dark split)
- Extended tokens: `--tertiary-foreground`, `--glow`, `--glass-bg`, `--glass-border`, `--glass-hover`
- Section spacing: `--section-px-mobile` through `--section-px-2xl`
- Cinematic visual pipeline: 10 `@property`-registered CSS vars (`--dark-100` to `--dark-1000`) enable animated colour transitions. `transition-colours-pipeline` class crossfades all 10 at 500ms. Hero overlays use `color-mix()` with `var(--dark-900)` for per-item gradient theming.
- Gradients: `--gradient-hero-overlay` (diagonal 3-layer using `color-mix()` with `--dark-900`), `--gradient-card`
- Animations: `ken-burns`, `fade-in`, `fade-in-up`, `slide-up`, `shimmer` (all respect `prefers-reduced-motion`)
- Mock data in `lib/mock-data.ts` for development (MOCK_GENRES, MOCK_CAST, MOCK_PROVIDERS, etc.)
- Server component wrappers that add padding must be removed for full-bleed heroes -- let individual sections handle their own padding via `<Section>` component

## Testing

- **Unit tests** (`tests/unit/`): Use `pnpm run test`. Config at `tests/unit/vitest.config.ts`. Mocks Prisma, Redis, external APIs.
- **Integration tests** (`tests/integration/`): Use `pnpm run test:integration`. Config at `tests/integration/vitest.config.ts`. Real PostgreSQL.
- **E2E tests** (`e2e/`): Use `pnpm run test:e2e`. Playwright with Page Object Model pattern. 16 focused POMs. Dedicated port 3001 and build dir `.next-e2e` to avoid conflicts with dev server. Shared item locator utilities in `e2e/config/item-locators.ts` (`getItemLocator`, `openItemMoreMenu`) used across POMs — hover-then-click pattern for Radix interactability. Radix hydration retry via `expect().toPass()` for server-rendered triggers not yet hydrated. Suspense-streamed pages require waiting for content to stream in before interacting — POMs use `waitForContent()` methods or wait for specific selectors rather than `networkidle`.
- **Storybook** (`*.stories.tsx`): Use `pnpm run storybook`. axe-core a11y testing on every story.
- Both unit and integration configs inherit from root `vitest.config.ts` via `mergeConfig`.
- `next-auth` (ESM) requires `test.server.deps.inline: ["next-auth"]` in root vitest config.
- E2E server uses `NEXT_DIST_DIR=.next-e2e` and `PORT=3001` (set via `e2e/playwright.config.ts` webServer env). This keeps E2E builds isolated from the dev server's `.next` directory.

Important: Do NOT run `pnpm vitest run` directly -- it picks up E2E files. Always use the npm scripts.

## Conventions

- British English in user-facing copy (organise, colour, etc.)
- **Icons:** All icons use Font Awesome (`@fortawesome/react-fontawesome` + `FontAwesomeIcon`). Import icons from `@fortawesome/free-solid-svg-icons` or `@fortawesome/free-brands-svg-icons`. Do NOT use lucide-react (removed). FOUC prevention configured in `app/layout.tsx` via `config.autoAddCss = false` with manual CSS import. Global CSS reset (`.svg-inline--fa { width: auto; height: auto }`) allows Tailwind `size-*` utilities to work without `!important`.
- **Radix hover persistence:** Grid cards and tree items use `has-[[data-state=open]]` CSS selectors to keep elevated/hover state while Radix dropdown menus are open. More-options buttons appear on `group-hover` / `group-focus-within` / `group-has-[[data-state=open]]`.
- Unused destructured params prefixed with `_` (ESLint rule)
- `next/dynamic()` requires default exports -- components with only named exports will cause type errors
- Conventional commits enforced by commitlint (feat:, fix:, chore:, etc.)
- Pre-commit hooks run ESLint + Prettier on staged files via lint-staged
- Pre-existing knip warnings: `playlist-button.tsx` (unused file), `embla-carousel-autoplay` (unused dep) -- these are expected

## Deployment

Three Vercel projects deploy from this repo (team: `jacobreesnew-7380s-projects`):

| Project | URL | Root Dir | Purpose |
|---|---|---|---|
| `canoncore` | https://www.canoncore.com | `.` | Production app (Next.js) |
| `canoncore-demo` | canoncore-demo-...vercel.app | `.` | Demo environment for recordings/showcases |
| `canoncore-storybook` | https://canoncore-storybook.vercel.app | `storybook-vercel/` | Storybook component library |

- **`.vercel/project.json`** links the repo root to the `canoncore` production project. CLI commands (`vercel`, `vercel env pull`) target production by default.
- **`vercel.json`** (root) configures the production build (`pnpm run build`, Next.js framework).
- **`storybook-vercel/vercel.json`** configures the Storybook build (`cd .. && pnpm build-storybook`, no framework preset, outputs to `../storybook-static`).
- **`canoncore-demo`** is a separate Vercel project deploying the same Next.js app. Used alongside `e2e/demo/` Playwright scripts for demo video recordings.
- **Demo scripts:** `e2e/demo/playwright.demo.config.ts` runs headed Playwright against the app (local or deployed) for screen recording. Usage: `npx playwright test --config e2e/demo/playwright.demo.config.ts -g "Part 1"`.

## CI/CD Workflows

Three GitHub Actions workflows in `.github/workflows/`:

### CI Pipeline (`ci.yml`)

Four-job pipeline on push to `development`/`production` and PRs targeting those branches:

```
quality → migrate → test + build (parallel)
```

- **Quality Gate** — format:check, lint, type-check, knip. Uses dummy `DATABASE_URL` (no DB access needed).
- **Schema Migration** — runs `prisma migrate deploy` against Neon branches. Only runs on push (`if: github.event_name == 'push'`), skipped for PRs. Branch-scoped to prevent advisory lock contention:
  - `development` push → migrates development Neon branch only
  - `production` push → migrates production, demo, and seed Neon branches
- **Tests** — unit + integration tests. Depends on quality + migrate (uses `if: always()` with conditional success checks so it runs when migrate is skipped on PRs).
- **Build** — production build verification. Same dependency pattern as tests.

Concurrency groups cancel in-progress runs for the same ref (except production pushes, which always complete).

### Seed Workflow (`seed.yml`)

Manual dispatch only (`workflow_dispatch`). Three targets:

| Target | Neon Branch | Seed Target | DATABASE_URL Secret |
|---|---|---|---|
| development | development | development | `DATABASE_URL` |
| demo | demo | demo | `DEMO_DATABASE_URL` |
| seed | seed | screenshots | `SEED_DATABASE_URL` |

The "seed" Neon branch maps to the "screenshots" seed target — the GH secret `SEED_DATABASE_URL` is set as env var `SCREENSHOT_DATABASE_URL` (what `seed.ts` expects).

### Storybook (`storybook.yml`)

Builds Storybook and runs interaction/a11y tests on push and PRs. Uses dummy `DATABASE_URL` for prisma generate during install.

### Gotchas

- **Dummy DATABASE_URL:** `pnpm install` triggers prisma's postinstall hook (`prisma generate`), which requires `DATABASE_URL` even though it doesn't connect. Jobs that don't need real DB access use `DATABASE_URL: "postgresql://user:pass@localhost:5432/db"`.
- **Migration scoping:** The original separate `schema-migrate.yml` ran all 4 Neon migrations on every push regardless of branch, causing advisory lock contention. Now merged into `ci.yml` with branch-conditional steps.
- **Seed concurrency:** `cancel-in-progress: false` — seed jobs must run to completion to avoid partial data.
- **Integration test:** `tests/integration/prisma/schema-migrate.test.ts` verifies migration idempotency (running `prisma migrate deploy` twice succeeds).

## Environment Variables

Key variables (see `.env.example` for full list):

- `DATABASE_URL` -- Neon PostgreSQL connection string
- `NEXTAUTH_SECRET` -- JWT signing secret
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` -- Drive OAuth
- `TMDB_API_KEY` -- TMDB metadata API
- `ENCRYPTION_KEY` -- AES-256-GCM key for OAuth tokens
- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` -- Rate limiting
- `NEXT_PUBLIC_SENTRY_DSN` -- Sentry error tracking (optional, disabled when absent)
- `NEXT_PUBLIC_APP_URL` -- Canonical URL (defaults to https://canoncore.com)
