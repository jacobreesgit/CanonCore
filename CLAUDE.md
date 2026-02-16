# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
pnpm run dev          # Start development server
pnpm run build        # Production build
pnpm run check        # Run all checks (format, lint, type-check, knip, build)
pnpm run seed         # Full seed (wipes Drive + DB, then recreates content)

# Code quality
pnpm run format       # Format code with Prettier
pnpm run lint         # Run ESLint
pnpm run type-check   # TypeScript type checking
pnpm run knip         # Check for unused code/dependencies

# Unit & Integration tests (Vitest)
pnpm run test              # Run unit tests
pnpm run test:unit         # Run unit tests (explicit)
pnpm run test:integration  # Run integration tests (real DB)
pnpm run test:coverage     # Unit tests with coverage
pnpm run test:watch        # Watch mode

# E2E tests (Playwright)
pnpm run test:e2e                           # All tests (desktop + mobile)
pnpm run test:e2e --project=chromium        # Desktop only
pnpm run test:e2e --project=mobile-chrome   # Mobile only
pnpm run test:e2e:debug                     # Debug mode
pnpm run test:e2e:ui                        # UI mode

# Storybook (component documentation)
pnpm run storybook           # Start dev server (port 6006)
pnpm run build-storybook     # Build static Storybook
pnpm run test-storybook      # Run story tests
pnpm run test-storybook:ci   # CI mode with limited workers
```

## Architecture

**Stack:** Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind CSS 4, NextAuth.js v5, Prisma, shadcn/ui, nuqs (URL state)

### Project Structure Patterns

**Route Groups:**

- `app/(auth)/` - Auth pages (sign-in, sign-up, forgot/reset-password) with redirect guard layout
- `app/(public)/` - Public pages (landing, explore, /u/[username], /u/[username]/[itemId])
- `app/(docs)/` - Fumadocs documentation at /docs
- `app/robots.ts` - Dynamic robots.txt generation for bot management

**API Routes:**

- `app/api/artwork/[fileId]/route.ts` - Artwork streaming from Google Drive
- `app/api/stream/[fileId]/route.ts` - Media streaming with Range header support
- `app/api/user/avatar/route.ts` and `hero/route.ts` - User image endpoints
- All API routes are rate limited via `apiRoute` limiter (60/min per IP)

**Server Actions Convention:**

- `lib/*-actions.ts` - All server actions (auth, items, fork, google-drive, item-file, tmdb, user, queue-aware)
- Parallel async execution for rate limit + auth checks
- Use Zod schemas from `lib/validations.ts`

**Components Organisation:**

- `components/hero/` - Cinematic hero system (cinematic-hero, hero-avatar, types)
- `components/items/` - Items feature (40+ components for dialogs, toolbars, views, detail sections)
  - `wizards/tv-picker/` - TV show navigation for selecting shows, seasons, or episodes
  - `wizards/tmdb-wizard/` - 4-step metadata wizard (text, poster, hero, summary) plus artwork/image selection steps
  - Detail components: `about-tab-content`, `recommendations` (soft-disabled), `wiki-accordion` (soft-disabled), `cast-row`, `video-row`, `watch-providers`, `metadata-line`, `expandable-description`
  - `tmdb-display-options` - Shared TMDB display option toggles (used in wizard summary + settings dialog TMDB tab)
  - Action components: `hero-button`, `item-more-button`, `poster-card`, `playlist-button`
  - `grid-view-content` - Extracted grid view rendering from items-view
  - Mobile sheets: `mobile-item-sheet` (combined sort/filter/view/settings), `mobile-add-item-sheet` (add item), `mobile-options-sheet` (sort/filter/view)
- `components/wizards/` - Reusable wizard infrastructure (state machine hook, step indicator, progress bar)
- `components/google-drive/` - Drive integration UI (oauth-toast, settings-section, sync-history, storage-bar)
- `components/sortable-grid/` and `sortable-tree/` - dnd-kit drag-drop with view/edit modes (kebab-case filenames)
- `components/media/` - Media player with Vidstack (media-player, media-player-icons)
- `components/diceui/` - Third-party DiceUI components (file-upload with drag-drop, previews)
- `components/mobile/` - Mobile navigation and shared mobile components (footer nav, bottom sheets, swipeable-tabs with Embla Carousel, discard-changes-alert, search/help sheets)
- `components/profile/` - Profile UI (settings-dialog with 4 tabs: Profile/Account/Connections/Activity, mobile-settings-sheet, profile-page)
- `components/providers/` - App-level providers (theme-provider, error-boundary, deferred-analytics); `NuqsAdapter` wraps app in root layout for URL state management
- `components/ui/` - shadcn/ui primitives + shared UI (content-toolbar with ViewDropdown, hero-content-layout, section, underline-tabs, swipeable-underline-tabs, progress-bar)
- `components/search/` - Spotlight search (spotlight-search, global-spotlight, item-thumbnail, user-thumbnail)
- Shared components: `logo.tsx`, `floating-paths.tsx`, `shader-background.tsx`, `feature-card-grid.tsx`
- Stories: Co-located `*.stories.tsx` files for Storybook component documentation

**Utilities & Helpers:**

- `lib/*-utils.ts` - Feature utilities (item, progress, file-type, upload, sync, avatar, tmdb); `lib/item-utils.ts` exports `toggleContentFilter()` and `CONTENT_FILTER_OPTIONS` for filter state management
- `lib/*-client.ts` - External API clients (google-drive, tmdb)
- `lib/avatar-utils.ts` - Avatar initials and gradient background generation
- `lib/tmdb-image-utils.ts` - Client-safe TMDB image URL builders (`getTmdbPosterUrl`, `getTmdbBackdropUrl`) and `resolveArtworkId()` for CDN-first image resolution
- `lib/tmdb-utils.ts` - TMDB resolution for season/episode items (recursive CTE ancestry walk), `extractTmdbDisplayOptions()` helper, re-exports from `tmdb-image-utils.ts`
- `lib/mock-data.ts` - Static data constants for cinematic UI (wiki sections, about tab filters)
- `lib/audit-context.ts` - AsyncLocalStorage context for audit logging (userId, source, requestId)
- `lib/audit-logger.ts` - Prisma extension for automatic mutation logging with redaction
- `lib/slugify.ts` - URL-safe kebab-case slug generation (used for deterministic `data-testid` values on tree/grid items)
- `lib/bot-patterns.ts` - Centralised bot lists for robots.txt and proxy middleware
- `lib/constants/messages.ts` - Centralised user-facing messages (SYNC, SETTINGS, ITEM, DRIVE)
- `lib/types.ts` - Shared TypeScript types (includes `TmdbDisplayOptions`, `DEFAULT_TMDB_DISPLAY`, `ContentFilter`, `CONTENT_FILTERS`, `SORT_OPTIONS_TUPLE`, `VIEW_MODES`); `ItemWithArtwork` and `SearchableItem` include `tmdbPosterPath`/`tmdbBackdropPath` for CDN-first image resolution
- `hooks/search-params.ts` - Shared nuqs parser definitions for URL query state (`itemsParsers`, `exploreParsers`)
- `hooks/use-items-url-state.ts` - URL-backed sort/filter/view/tab state for items pages (replaces useItemsSortFilter + useStoredViewMode), with localStorage backup and migration
- `hooks/use-explore-url-state.ts` - URL-backed sort and exclude-mine state for explore page (replaces useExploreSortFilter)
- `hooks/use-reduced-motion.ts` - Reduced motion preference detection with localStorage override
- `hooks/use-settings-dialog.ts` - Item settings dialog lifecycle management
- `hooks/use-sync-handler.ts` - Sync operation handler for Drive sync
- `hooks/use-add-item-form.ts` - Add item form state (TMDB search, wizard, file uploads) shared by desktop dialog and mobile sheet
- `hooks/use-item-settings-form.ts` - Item settings form state (dirty detection, TMDB display, save/cancel) shared by desktop dialog and mobile sheet
- `hooks/use-settings-form.ts` - Profile settings form state (avatar/hero uploads, password/email changes) shared by desktop dialog and mobile sheet

**Testing:**

- `tests/unit/` - Vitest unit tests with mocks
- `tests/integration/` - Vitest integration tests with real DB
- `tests/integration/audit/` - Audit logger integration tests
- `e2e/journeys/` - Playwright E2E tests by feature (31 spec files)
- `e2e/pages/` - 15 focused Page Object Models (auth, explore, item-detail, items-crud, items-drag, items-hierarchy, items-pinned, items-settings, items-sort-filter, media, nav, public-profile, settings, spotlight, tmdb-wizard)
- `e2e/fixtures/` - Composable test fixtures (authenticated, public, drive)
- `e2e/config/` - Centralised timeouts and collision-free test data utilities

### Authentication

- **NextAuth.js v5** with Credentials provider for email/password auth
- Server-side: `await auth()` from `lib/auth.ts`, redirect unauthenticated users
- Client-side: `signIn()` and `signOut()` from `next-auth/react`
- Server actions: `signUp()`, `forgotPassword()`, `resetPassword()` in `lib/auth-actions.ts`
- Password hashing with bcryptjs (12 rounds), password reset emails via Resend (30 min expiry)
- **Rate limiting**: Upstash Redis (sign-in: 5/min, sign-up: 3/min, forgot/resetPassword: 2/min, botCrawl: 120/min)
- **Validation**: Zod schemas in `lib/validations.ts` (8+ chars, uppercase, lowercase, number)
- **Security logging**: All auth events logged with IP and timestamp via Pino

### Database

**Prisma 7** with PostgreSQL (Neon)

**Key Schema Patterns:**

- User has optional `username` (unique, case-insensitive), `isPublic`, `image`/`heroImage` blobs
- Item has self-referential parent/child hierarchy, `pinnedOrder` (null or 0+), `isPublic`, `inheritVisibility`, `forkedFromId`
- Item has TMDB image paths: `tmdbPosterPath`, `tmdbBackdropPath` (nullable String, stores TMDB CDN path fragments like `/abc123.jpg`)
- Item has TMDB display preferences: 7 boolean fields (`tmdbShowTagline`, `tmdbShowMetadata`, `tmdbShowGenres`, `tmdbShowCast`, `tmdbShowProviders`, `tmdbShowVideos`, `tmdbShowRecommendations`) all defaulting to `true`
- Item has Google Drive fields: `driveFileId`, `driveModifiedAt`, `syncStatus`, `driveConnectionId`
- ItemFile has `fileType` (MEDIA/ARTWORK/SUBTITLE), `isPrimary`, `isHero`, `playbackPosition`
- Fork tracks copies: `sourceItemId`, `targetItemId`, `userId` (unique constraint on source+user)
- GoogleDriveConnection stores AES-256-GCM encrypted OAuth tokens
- SyncLog tracks sync operations with action type, status, duration

**Enums:**

- `FileType`: MEDIA, ARTWORK, SUBTITLE
- `SyncStatus`: SYNCED, PENDING, SYNCING, ERROR
- `SyncLogAction`: CREATE, RENAME, DELETE, MOVE, UPLOAD, DOWNLOAD, SYNC
- `SyncLogStatus`: SUCCESS, FAILED, PENDING

**Audit Logging:**

- AuditLog model tracks all database mutations (create, update, delete) automatically
- Prisma Client Extension in `lib/prisma.ts` logs every mutation with context
- `lib/audit-context.ts` - AsyncLocalStorage for passing userId/source through call stack
- `lib/audit-logger.ts` - Extension logic, sensitive field redaction, JSON truncation
- Context includes: environment, database (hashed), model, action, recordId, userId, source, requestId
- Sensitive fields (password, token, secret) automatically redacted
- Fire-and-forget logging (non-blocking, doesn't fail main operation)
- Query helper: `getRecentAuditLogs(prisma, { model, action, userId, source, limit })`
- Retention: 90 days production, 7 days development (manual cleanup required)

Run migrations: `npx prisma migrate dev`

### Database Seeding

Seed script supports all 3 Neon branches via `SEED_TARGET`. Same Google Drive account with separate root folders per branch:

```bash
pnpm run seed              # Seeds development (default)
pnpm run seed:production   # Seeds production Neon branch
pnpm run seed:e2e          # Seeds E2E Neon branch
```

**Branch Mapping:**

| SEED_TARGET   | DATABASE_URL source              | Drive Root Folder source         |
| ------------- | -------------------------------- | -------------------------------- |
| `development` | `DATABASE_URL`                   | `GOOGLE_SEED_ROOT_FOLDER_ID`     |
| `production`  | `SEED_PRODUCTION_DATABASE_URL`   | `SEED_PRODUCTION_ROOT_FOLDER_ID` |
| `e2e`         | `E2E_DATABASE_URL`               | `SEED_E2E_ROOT_FOLDER_ID`        |

**Flow:**

1. Resolve `SEED_TARGET` to pick correct DATABASE_URL and Drive root folder
2. Validate environment (ALLOW_SEEDING, TMDB_API_KEY, Drive credentials)
3. Wipe Google Drive content in the target root folder
4. Delete all seed users from database
5. Create seed users with TMDB metadata (including `tmdbId`/`tmdbType` on all items), artwork, and progress data

**Configuration:**

- `prisma/seed-config.ts` - User definitions, content distribution, progress ranges
- `prisma/seed.ts` - Seeding logic
- Hardcoded limits: 5 seasons per show, 10 episodes per season
- TMDB poster/backdrop paths stored directly on items (CDN serving, not downloaded to Drive)
- Original quality TMDB images for movies/shows (seasons/episodes skip artwork for speed)

**Users created:**

- 3 users: demo, filmfan (for screenshots), testuser (for E2E tests)
- Password: `SeedPassword123!`
- demo and filmfan get library with TMDB content, filmfan has higher progress

### Items System

**Core Patterns:**

- Hierarchical tree with drag-and-drop reordering (dnd-kit), max 10 levels deep
- Dual view modes: Tree (hierarchical) and Grid (movie poster cards), switched via ViewDropdown in ContentToolbar
- Edit mode toggle: "Edit" enables drag-and-drop, "Done" returns to view (only in custom sort)
- View mode: Full background artwork with dark overlay
- Edit mode: Simplified icons with drag handles
- Mobile (< 1024px): Bottom sheets replace desktop dialogs; `MobileItemSheet` combines sort/filter/view/settings; `MobileAddItemSheet` for item creation
- Item detail tabs: Desktop uses `UnderlineTabs`, mobile uses `SwipeableUnderlineTabs` (Embla Carousel) for Contents/About with swipe gestures; loaded via `next/dynamic` to keep Embla out of desktop bundle

**Key Features:**

- CinematicHero: Multi-mode hero (carousel with auto-advance on Explore, single-slide on item detail, profile avatar mode). Respects `prefers-reduced-motion`. Attribution text supports linking via `attributionHref`. Screen reader `aria-live` slide announcements.
- Sort: Custom Order, Name A-Z/Z-A, Newest/Oldest, Recently Updated
- Filter: Multi-select grouped checkboxes (File Status: Has Files, No Files; Sync Status: Synced, Pending, Error). AND across groups, OR within groups. Explore page has "Exclude Mine" toggle button instead.
- URL state: Sort/filter/view/tab persisted to URL via `nuqs` (`NuqsAdapter` in root layout), with localStorage backup for direct navigation
- TMDB display options: Per-item toggles for tagline, metadata, genres, cast, providers, videos (recommendations toggle hidden — feature soft-disabled)
- Pinned items: Max 10, shown in sidebar with folder icons
- Progress tracking: 90% threshold for "watched", DFS traversal for first incomplete
- Bulk operations: Edit mode shows checkboxes, select-all in toolbar
- Context menu: Right-click for Settings, Pin/Unpin, Delete, Add Child Item
- Contextual empty states: Different messages for first-time, empty folders, filter results

**Server Actions:** `lib/item-actions.ts`

- All actions use parallel async for rate limit + auth
- CRUD: `createItem`, `updateItem`, `deleteItem`, `deleteItems`
- Reordering: `reorderItems`
- Pinning: `pinItem`, `unpinItem`, `getPinnedItems` (max 10)
- Progress: `getFirstIncompleteItem` (DFS traversal)
- Visibility: `updateVisibility`, `updateInheritVisibility`

### Public Profiles & Forking

**Route Pattern:**

- `/u/[username]` - Unified profile (owners see edit mode, viewers see fork option)
- `/u/[username]/[itemId]` - Public item detail

**Visibility Rules:**

- Item is "fully public" only when profile AND all ancestors are public
- `inheritVisibility: true` items inherit from parent (reduces Explore clutter)
- Explore page shows only explicitly public items (`isPublic: true, inheritVisibility: false`)

**Forking:**

- Fork creates copy in your library via `forkItem()` in `lib/fork-actions.ts`
- Cannot fork own items, cannot fork same item twice
- Forked items start private with `inheritVisibility: false`
- Fork destination dialog: Choose root or any folder (virtualized for large libraries)

**Public Auth Utilities:** `lib/public-auth.ts`

- `isItemFullyPublic()` - Checks profile and ancestor chain
- `getFeaturedItems()` - Returns 5 most recently updated items with artwork for carousel
- `getPublicLibraryProgress()` - Library progress stats for profile viewers
- `PublicItem` includes TMDB display preferences and `fileCounts`
- All functions use `React.cache()` for request deduplication

### TMDB Metadata Integration

**Integration Points:**

- MediaSearchCombobox in Add Item and Item Settings dialogs
- 4-step wizard: Title/Description → Poster → Hero/Backdrop → Review & Apply
- Selective metadata application (choose which fields to update)
- Summary step allows reviewing and changing selections before applying

**TV Show Episode Picker:**

- When selecting a TV show, an episode picker allows navigating to specific content
- Options: Use show metadata, navigate into seasons to view episodes, or select an individual episode
- "Use Season" applies show-level metadata (same as "Use Show")
- Episode selection skips artwork steps (episodes have only a still image, not poster/backdrop galleries)

**Wizard Architecture:** `components/wizards/`

- `useWizardMachine` - Generic reducer-based state machine for any multi-step flow
- `WizardStepIndicator` - Accessible step indicator with numbered circles (WCAG 2.1 Level A)
- `WizardProgressBar` - Minimal segmented progress bar with sr-only announcements
- TMDB-specific wizard in `components/items/wizards/tmdb-wizard/`
- TV picker in `components/items/wizards/tv-picker/`

**Server Actions:** `lib/tmdb-actions.ts`

- `searchMediaAction`, `getMetadataPreviewAction`, `getImagesAction`
- `getSeasonsAction`, `getEpisodesAction` for TV shows
- `applyMetadataAction` - Always persists `tmdbId`/`tmdbType`/`tmdbPosterPath`/`tmdbBackdropPath`, accepts optional `TmdbDisplayOptions`
- `updateTmdbDisplayOptions` - Updates display preference booleans for an item (debounced from settings dialog)
- Circuit breaker: 5 failures → 60s recovery
- Graceful degradation if TMDB_API_KEY not set

**TMDB Client:** `lib/tmdb-client.ts`

- Exported types: `CastMember`, `WatchProvider`, `Video`, `Recommendation`, `TmdbItemMetadata`, `TmdbItemDetails`
- `getItemTmdbMetadata()` - Cached normalised metadata (tagline, runtime, genres, content rating) via `React.cache()`
- `getItemTmdbDetails()` - Cached extended details (cast, providers, videos) via `React.cache()` — recommendations API call disabled, returns empty array
- `formatRuntime()` - Format minutes to "2h 46m" display
- `getBestTextlessBackdrop()` - Select optimal textless backdrop from image collection
- `TMDBMovie`/`TMDBTVShow` include `tagline`, `runtime`, `genres`, `vote_average`
- TV season/episode types: `TMDBSeasonSummary`, `TMDBSeasonDetail`, `TMDBEpisodeDetails`, `TMDBSeasonImages`, `TMDBEpisodeImages`

**TMDB Image Utilities:** `lib/tmdb-image-utils.ts`

- `getTmdbPosterUrl(path, size)` - Constructs full TMDB poster URL from stored path fragment
- `getTmdbBackdropUrl(path, size)` - Constructs full TMDB backdrop URL from stored path fragment
- `resolveArtworkId(item)` - Returns `null` when TMDB poster exists (CDN), falls back to primary/first Drive artwork file
- Priority: TMDB CDN → Primary artwork file → First artwork file → null

**TMDB Resolution & Utilities:** `lib/tmdb-utils.ts`

- `resolveTmdbForItem()` - Walks item ancestry via recursive CTE to find parent TV show for season/episode items
- `extractTmdbDisplayOptions()` - Converts item DB fields (`tmdbShow*`) to `TmdbDisplayOptions` object
- Re-exports `getTmdbPosterUrl`, `getTmdbBackdropUrl` from `tmdb-image-utils.ts`

**Artwork Handling:**

- TMDB poster/backdrop paths stored directly on items (`tmdbPosterPath`, `tmdbBackdropPath`) for CDN serving
- `resolveArtworkId()` prioritises TMDB CDN over Drive-hosted artwork across all item-returning functions
- Drive-hosted artwork used as fallback when no TMDB path available
- Wizard allows selecting specific poster/backdrop from TMDB galleries

### Spotlight Search

**Keyboard-First Design:**

- Press "/" to open from any page
- Three sections: Your Items, Public Collections, People
- Fuzzy filtering via cmdk library
- Breadcrumb paths for nested items (e.g., "Movies / Star Wars")

**Performance:**

- 60-second TTL module-level cache for instant results
- Parallel fetching: All three sections load concurrently
- Independent loading: Each section renders with skeletons
- Rate limiting: itemSearch 30/min, userSearch 60/min, publicItemSearch 60/min

**Components:**

- `SpotlightProvider` context manages dialog state and "/" keyboard listener
- `SpotlightSearch` main dialog, `GlobalSpotlight` wrapper
- `ItemThumbnail` reusable thumbnail resolving TMDB poster → Drive artwork → fallback icon

### Google Drive Integration

**OAuth Flow:**

- CSRF protection via signed state parameter
- Single connection per user, managed in Settings dialog
- AES-256-GCM encrypted tokens in database
- Auto token refresh with 5-minute buffer before expiry

**Sync Patterns:**

- Bidirectional sync between Drive and web interface
- Auto-sync on connect: Existing CanonCore folders synced automatically
- Batch API: Combines up to 100 operations per HTTP request
- Rate limiting: Bottleneck library (10 concurrent, 100ms min interval)

**Offline Support:**

- IndexedDB-based queue for operations when offline (max 100 ops)
- Exponential backoff retry (5 retries)
- PendingIndicator component shows queued operation count

**Streaming:**

- `/api/artwork/[fileId]` - Artwork streaming
- `/api/stream/[fileId]` - Media streaming with HTTP Range header support

**Server Actions:**

- `google-drive-actions.ts` - Connection management
- `google-drive-sync.ts` - Bidirectional sync
- `google-drive-upload.ts` - Browser-to-Drive uploads

**Reconnect Banner:**

- When `needsReauth` is true on a Drive connection, a persistent amber banner appears on all pages
- Desktop: `SiteHeader` renders banner below breadcrumb row (all layouts pass `driveNeedsReauth` prop)
- Mobile: `MobileNavProvider` renders fixed banner at top of viewport (`lg:hidden`)
- Both banners use `role="alert"`, `aria-live="assertive"`, and call `initiateGoogleDriveOAuth()` on click
- Message constant: `DRIVE_MESSAGES.DISCONNECTED_BANNER` in `lib/constants/messages.ts`

**Special Handling:**

- Trashed folder detection with recovery guidance
- Storage quota display: Warning at 80%, critical at 95%
- Circuit breaker: 5 failures → 60s recovery

### Media Playback

- Vidstack player with default controls for video/audio
- Full-screen media overlay with tabbed file navigation
- Subtitle support: SRT, VTT, SUB, ASS tracks
- Playback tracking: Auto-save/resume position via `lib/item-file-actions.ts`
- File types: MEDIA (video/audio), ARTWORK (images), SUBTITLE

### Testing

**Unit Tests (Vitest):**

- `tests/unit/` - Mocked Prisma, email, rate-limit
- Coverage configured for `lib/**`
- Run: `pnpm run test`

**Integration Tests (Vitest):**

- `tests/integration/` - Real database
- DB cleanup between tests, rate-limit bypass
- Run: `pnpm run test:integration`

**E2E Tests (Playwright):**

- 31 spec files across desktop Chrome and mobile Chrome (Pixel 7)
- 15 focused Page Object Models in `e2e/pages/` (auth, explore, item-detail, items-crud, items-drag, items-hierarchy, items-pinned, items-settings, items-sort-filter, media, nav, public-profile, settings, spotlight, tmdb-wizard)
- Composable fixtures in `e2e/fixtures/` (authenticated, public, drive) with per-test user creation and cleanup
- Centralised timeouts (`e2e/config/timeouts.ts`) and collision-free test data (`e2e/config/test-data.ts`)
- Curated `data-testid` attributes on ~30 components for targeted E2E selectors
- `slugify()` utility generates deterministic testids: `item-card-${slugify(name)}`, `item-tree-${slugify(name)}`
- Run: `pnpm run test:e2e`

**Storybook (Component Documentation):**

- Storybook 10 with Next.js framework and Tailwind CSS 4
- Stories co-located with components (`*.stories.tsx`)
- MSW mocking in `.storybook/mocks/` for server actions
- Decorators: Theme (dark only), auth state, reduced motion
- Accessibility testing via `@storybook/addon-a11y` with `test: "error"` in `preview.tsx` (no custom test-runner hooks needed)
- Portal dialogs: Test with `within(document.body)` instead of `canvasElement`
- Run: `pnpm run storybook` (dev), `pnpm run test-storybook` (tests)

**Screenshot Automation:**

- Portfolio screenshots for marketing in `e2e/screenshots/`
- Dark mode only — scenarios × 2 devices (desktop/mobile)
- Desktop: 5760×3723 (1920×1241 @ 3× scale), Mobile: 1170×2732 (390×844 @ 3× scale + 200px top padding)
- Mobile screenshots have 200px top padding for iPhone notch clearance (black for dark, gray #7e7e7e for dialogs)
- Run: `npx playwright test --config=e2e/screenshots/playwright.config.ts`

**Adding Mobile Top Padding (if regenerating screenshots):**

After generating mobile screenshots, add top padding for iPhone mockups:

```bash
cd public/portfolio

# Add black bars for standard pages
for img in *-mobile.png; do
  magick "$img" -gravity north -background black -splice 0x200 "${img}.new"
  mv "${img}.new" "$img"
done

# Special case: gray bars for dialogs with semi-transparent backgrounds
for img in 04-tmdb-wizard-mobile.png 05-progress-tracking-mobile.png 06-google-drive-sync-mobile.png 08-spotlight-search-mobile.png 32-fork-dialog-mobile.png; do
  magick "$img" -gravity north -background "#7e7e7e" -splice 0x200 "${img}.new" && mv "${img}.new" "$img"
done
```

### Security

**OWASP Headers** configured in `next.config.mjs`:

- HSTS: 1-year max-age with includeSubDomains and preload
- CSP: Restricts resource loading to trusted sources
- X-Frame-Options: DENY (prevents clickjacking)
- X-Content-Type-Options: nosniff
- Referrer-Policy: strict-origin-when-cross-origin
- **API route rate limiting**: All `/api/*` routes protected by `apiRoute` limiter (60/min per IP) to prevent abuse of streaming and image endpoints

### Bot Protection

Multi-layer defense against aggressive AI crawlers to prevent cost overruns while maintaining proper search engine indexing.

**Architecture (3 Layers):**

1. **robots.txt (Polite Layer)**: `app/robots.ts` dynamically generates robots.txt blocking AI scrapers, allowing search engines
2. **Edge Blocking (Enforcement Layer)**: `proxy.ts` blocks non-compliant bots at edge with 403 (zero cost)
3. **Rate Limiting (Control Layer)**: Beneficial bots throttled to 120 req/min via `lib/rate-limit.ts`

**Bot Lists**: `lib/bot-patterns.ts`

- **Blocked (35+)**: Meta (GPTBot, meta-externalagent), OpenAI (GPTBot, OAI-SearchBot), Anthropic (claudebot), Perplexity, DeepSeek, SEO tools (Semrush, Ahrefs, etc.)
- **Allowed (7)**: Googlebot, Bingbot, Applebot, DuckDuckBot, Slurp, Yandex, Baiduspider
- **Maintenance**: Review monthly, sources linked in file header

**Key Features:**

- **Fast Path**: 99% of traffic (browsers) skips bot detection entirely
- **Zero User Impact**: Browser requests bypass all bot checks
- **Security Logging**: All blocked attempts logged with IP, user-agent, path via Pino
- **Transparency**: X-RateLimit headers on beneficial bot responses
- **Graceful Degradation**: Works even if Redis rate limiting fails

**Proxy Behavior**: `proxy.ts`

1. Common browsers → Fast path (no bot checks)
2. Blocked bots → 403 immediately (logged for audit)
3. Beneficial bots → Rate limited (120 req/min per IP+user-agent)
4. All requests → Request ID injection for tracing

**Rate Limiting**: `lib/rate-limit.ts`

- `botCrawl`: 120 requests/minute (2 req/sec)
- `apiRoute`: 60 requests/minute per IP (protects artwork/stream/avatar/hero routes)
- Key composition: IP + user-agent (prevents single bot with multiple IPs)
- Based on Google/Bing recommendations (typical crawl rate: 5-10 req/sec)

**Important Notes:**

- robots.txt is advisory only; Perplexity and others ignore it (hence edge-level blocking)
- Industry data shows bot traffic up 6900% YoY
- Public profile pages (`/u/[username]`) are primary targets for aggressive crawling
- Monitor logs for `"Blocked aggressive bot crawler"` and `"Rate limited beneficial bot"` events

See `docs/deployments/DEPLOYMENT-6.0.2.md` for detailed implementation and monitoring guidance.

### Observability

- **Structured logging**: Pino logger with JSON output in production
- **Request tracing**: Middleware injects `x-request-id` header
- **Child loggers**: `createRequestLogger(requestId)` and `createUserLogger(userId)`
- **Log levels**: Configurable via `LOG_LEVEL` env var (debug, info, warn, error)

### Styling

- Tailwind CSS 4 with CSS variables
- shadcn/ui "new-york" style
- Prettier with tailwindcss plugin for class sorting
- Cinematic design system tokens in `globals.css`:
  - Glass: `--glass-bg`, `--glass-border`, `--glass-hover`, `--glow`
  - Typography: `--tertiary-foreground` (40% white)
  - Section spacing: `--section-px-mobile` through `--section-px-2xl`
  - Gradients: `--gradient-hero-overlay` (diagonal 3-layer), `--gradient-card`
- Keyframe animations: `ken-burns`, `fade-in`, `fade-in-up`, `slide-up`, `shimmer`
- Utility classes: `.ken-burns`, `.animate-fade-in`, `.animate-slide-up`, `.stagger-grid`, `.skeleton-shimmer`
- All animations respect `prefers-reduced-motion`
- Auth pages use split-panel layout (decorative left panel with FloatingPaths, form right panel)
- Landing page uses hero with feature card grid and Framer Motion animations
- Site header auto-hides on scroll down, reappears on scroll up; shows Drive reconnect banner when `driveNeedsReauth` is true

### Accessibility

- Skip link: "Skip to main content" for keyboard/screen reader navigation (WCAG 2.1 Level A)
- Reduced motion: `@media (prefers-reduced-motion)` disables animations globally; `useReducedMotion` hook for JS control
- CinematicHero respects reduced motion preference (disables autoplay, ken-burns)
- Touch optimisation: 300ms tap delay removal, iOS highlight suppression, 44px minimum touch targets
- Safe area support: CSS variables for notched devices (iPhone X+), mobile footer respects safe areas
- Decorative icons: `aria-hidden="true"` on non-interactive icons
- Navigation a11y: `aria-current="page"` on active sidebar and mobile footer items
- Mobile navigation: Bottom sheets have accessible titles, focus trapping, swipe-to-dismiss gesture support, `SwipeableTabs` and `SwipeableUnderlineTabs` with `role="tablist"`/`role="tabpanel"` semantics, `inert`/`aria-hidden` on inactive panels
- Discard changes confirmation: `DiscardChangesAlert` shown when closing mobile sheets with unsaved changes
- Drive reconnect banner: `role="alert"` and `aria-live="assertive"` for immediate screen reader announcement when Drive needs reauthentication
- Auth form a11y: Error messages use `role="alert"` and `aria-live="polite"` for screen reader announcements; inputs get `aria-invalid` and `aria-describedby` when validation fails; auth pages have `id="main-content"` on `<main>` for skip link target
- MobileBottomSheet: Uses `React.useId()` for unique `aria-describedby` IDs
- Sort options: `role="radiogroup"`/`role="radio"` semantics in mobile sheets
- Filter options: `role="group"`/`role="checkbox"` semantics in mobile sheets
- TreeItem: Interactive items get `role="button"`, `tabIndex={0}`, and Enter/Space keyboard handlers
- Username validation: Error messages use `role="alert"` in settings dialog

### Dark Mode

- App is permanently dark — no light mode or theme toggle
- `<html className="dark">` in `app/layout.tsx`
- `ThemeProvider` with `forcedTheme="dark"` (overrides any stored preference)
- `color-scheme: dark` in `:root` for browser-native scrollbars and form controls
- Single unified `:root` with cinematic dark values — no `.dark {}` override block

## Branching Strategy

| Git Branch    | Neon Branch   | Vercel Environment |
| ------------- | ------------- | ------------------ |
| `development` | `development` | Preview            |
| `production`  | `production`  | Production         |

- Local development uses `.env.local` pointing to Neon `development` branch
- Vercel production uses environment variables pointing to Neon `production` branch

## Environment Variables

Required in `.env.local` (development):

- `DATABASE_URL` - Neon PostgreSQL connection string (development branch)
- `AUTH_SECRET` - NextAuth secret (generate with: `openssl rand -base64 32`)
- `RESEND_API_KEY` - Resend API key for password reset emails
- `EMAIL_FROM` - Sender email address (default: `noreply@canoncore.com`)
- `UPSTASH_REDIS_REST_URL` - Upstash Redis URL for rate limiting
- `UPSTASH_REDIS_REST_TOKEN` - Upstash Redis token
- `ENCRYPTION_KEY` - Base64 32-byte key for credential encryption (generate with: `openssl rand -base64 32`)

Optional:

- `BYPASS_RATE_LIMIT` - Set to `"true"` to skip rate limiting (for E2E tests)
- `NEXT_PUBLIC_APP_URL` - Base URL for email links (default: `http://localhost:3000`)
- `LOG_LEVEL` - Pino log level: debug, info, warn, error (default: info)

Google Drive (required for Drive integration):

- `GOOGLE_CLIENT_ID` - OAuth client ID from Google Cloud Console
- `GOOGLE_CLIENT_SECRET` - OAuth client secret from Google Cloud Console

TMDB (optional - for metadata lookup):

- `TMDB_API_KEY` - TMDB v3 API key for movie/TV metadata lookup

Seed (required for database seeding with Drive integration):

- `GOOGLE_SEED_REFRESH_TOKEN` - Refresh token for seed Drive account (shared across all targets)
- `GOOGLE_SEED_ROOT_FOLDER_ID` - Folder ID where development seed creates content
- `GOOGLE_SEED_EMAIL` - Email of seed account (optional, for display)
- `SEED_TARGET` - Target branch: "development" (default), "production", "e2e"
- `SEED_PRODUCTION_DATABASE_URL` - Production Neon connection string (for SEED_TARGET=production)
- `SEED_PRODUCTION_ROOT_FOLDER_ID` - Production Drive root folder (for SEED_TARGET=production)
- `SEED_E2E_ROOT_FOLDER_ID` - E2E Drive root folder (for SEED_TARGET=e2e, reuses E2E_DATABASE_URL)

E2E Testing (required for E2E tests):

- `E2E_DATABASE_URL` - Neon PostgreSQL connection string (dedicated E2E branch, isolates test cleanup from dev/seed data)

E2E Testing (optional - for Google Drive E2E tests):

- `GOOGLE_E2E_REFRESH_TOKEN` - Refresh token for E2E test Drive account
- `GOOGLE_E2E_ROOT_FOLDER_ID` - Folder ID where E2E tests create/delete items
- `GOOGLE_E2E_EMAIL` - Email of E2E test account (optional, for display)

**Setup Scripts:**

```bash
pnpm run setup:e2e       # Setup E2E Drive account (interactive OAuth flow)
pnpm run setup:seed      # Setup seed Drive account (interactive OAuth flow)
pnpm run setup:e2e-drive # Setup E2E test data (wipe, upload video)
pnpm run setup:verify    # Verify both accounts are configured correctly
pnpm run setup:all       # Run both OAuth setups sequentially
```

## Documentation Standards

All custom code (excluding `components/ui/*` shadcn components) follows these JSDoc conventions:

### File Headers

Every file starts with a brief descriptive comment:

```typescript
/**
 * Brief description of what this file does.
 * Optional second line for additional context.
 */
```

### Function Documentation

Use standard JSDoc with `@param`, `@returns`, and `@example` (for complex functions):

```typescript
/**
 * Brief description of what the function does.
 *
 * @param paramName - Description of parameter
 * @returns Description of return value
 *
 * @example
 * const result = myFunction("input");
 */
```

### Guidelines

- **File headers**: Required for all files (lib, hooks, components, app pages)
- **Function JSDoc**: Required for exported functions and React components
- **`@example`**: Include for complex utilities and server actions; skip for simple functions and React components
- **React props**: Document inline with TypeScript types, not JSDoc
- **Skip**: `components/ui/*` (shadcn generated code)

