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

**Stack:** Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind CSS 4, NextAuth.js v5, Prisma, shadcn/ui

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

**Server Actions Convention:**

- `lib/*-actions.ts` - All server actions (auth, items, fork, google-drive, item-file, tmdb, user, queue-aware)
- Parallel async execution for rate limit + auth checks
- Use Zod schemas from `lib/validations.ts`

**Components Organisation:**

- `components/items/` - Items feature (30+ components for dialogs, toolbars, views)
  - `wizards/tv-picker/` - TV show navigation for selecting shows, seasons, or episodes
  - `wizards/tmdb-wizard/` - 4-step metadata wizard (text, poster, hero, summary)
- `components/wizards/` - Reusable wizard infrastructure (state machine hook, step indicator)
- `components/google-drive/` - Drive integration UI (oauth-toast, settings-section, sync-history, storage-bar)
- `components/sortable-grid/` and `sortable-tree/` - dnd-kit drag-drop with view/edit modes
- `components/media/` - Media player with Vidstack (media-player, media-player-icons)
- `components/diceui/` - Third-party DiceUI components (file-upload with drag-drop, previews)
- `components/mobile/` - Mobile navigation (footer nav, bottom sheets, search/user/help sheets)
- `components/ui/` - shadcn/ui primitives (do not document)
- Shared components: `logo.tsx` (reusable logo), `floating-paths.tsx` (animated SVG background)
- Stories: Co-located `*.stories.tsx` files for Storybook component documentation

**Utilities & Helpers:**

- `lib/*-utils.ts` - Feature utilities (item, progress, file-type, upload, sync)
- `lib/*-client.ts` - External API clients (google-drive, tmdb)
- `lib/audit-context.ts` - AsyncLocalStorage context for audit logging (userId, source, requestId)
- `lib/audit-logger.ts` - Prisma extension for automatic mutation logging with redaction
- `lib/bot-patterns.ts` - Centralised bot lists for robots.txt and proxy middleware
- `lib/constants/messages.ts` - Centralised user-facing messages (SYNC, SETTINGS, ITEM)
- `lib/types.ts` - Shared TypeScript types
- `hooks/use-reduced-motion.ts` - Reduced motion preference detection with localStorage override

**Testing:**

- `tests/unit/` - Vitest unit tests with mocks
- `tests/integration/` - Vitest integration tests with real DB
- `tests/integration/audit/` - Audit logger integration tests
- `e2e/journeys/` - Playwright E2E tests by feature
- `e2e/pages/` - Page Object Models
- `e2e/fixtures/` - Reusable test fixtures

### Authentication

- **NextAuth.js v5** with Credentials provider for email/password auth
- Server-side: `await auth()` from `lib/auth.ts`, redirect unauthenticated users
- Client-side: `signIn()` and `signOut()` from `next-auth/react`
- Server actions: `signUp()`, `forgotPassword()`, `resetPassword()` in `lib/auth-actions.ts`
- Password hashing with bcryptjs, password reset emails via Resend (30 min expiry)
- **Rate limiting**: Upstash Redis (sign-in: 5/min, sign-up: 3/min, forgot: 2/min, botCrawl: 120/min)
- **Validation**: Zod schemas in `lib/validations.ts` (8+ chars, uppercase, lowercase, number)
- **Security logging**: All auth events logged with IP and timestamp via Pino

### Database

**Prisma 7** with PostgreSQL (Neon)

**Key Schema Patterns:**

- User has optional `username` (unique, case-insensitive), `isPublic`, `image`/`heroImage` blobs, `defaultViewMode`/`defaultSortBy` (String?, not enum)
- Item has self-referential parent/child hierarchy, `pinnedOrder` (null or 0+), `isPublic`, `inheritVisibility`, `forkedFromId`
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

Simple seed script that always does a full wipe and rebuild:

```bash
pnpm run seed         # Wipes Drive + DB, then creates all content
```

**Flow:**

1. Validate environment (ALLOW_SEEDING, TMDB_API_KEY, Drive credentials)
2. Wipe Google Drive content (delete all files, empty trash)
3. Delete all seed users from database
4. Create seed users with TMDB metadata, artwork, and progress data

**Configuration:**

- `prisma/seed-config.ts` - User definitions, content distribution, progress ranges
- `prisma/seed.ts` - Seeding logic
- Hardcoded limits: 5 seasons per show, 10 episodes per season
- Original quality TMDB images for movies/shows (seasons/episodes skip artwork for speed)

**Users created:**

- 3 users: demo, filmfan (for screenshots), testuser (for E2E tests)
- Password: `SeedPassword123!`
- demo and filmfan get library with TMDB content, filmfan has higher progress

### Items System

**Core Patterns:**

- Hierarchical tree with drag-and-drop reordering (dnd-kit), max 10 levels deep
- Dual view modes: Tree (hierarchical) and Grid (movie poster cards)
- Edit mode toggle: "Edit" enables drag-and-drop, "Done" returns to view (only in custom sort)
- View mode: Full background artwork with dark overlay
- Edit mode: Simplified icons with drag handles

**Key Features:**

- HeroCarousel: Single-slide mode on item details, multi-slide on Explore (respects prefers-reduced-motion)
- Sort: Custom Order, Name A-Z/Z-A, Newest/Oldest, Recently Updated
- Filter: All Items, Has Files, No Files, Synced, Pending
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
- `WizardStepIndicator` - Accessible progress indicator (WCAG 2.1 Level A)
- TMDB-specific wizard in `components/items/wizards/tmdb-wizard/`
- TV picker in `components/items/wizards/tv-picker/`

**Server Actions:** `lib/tmdb-actions.ts`

- `searchMediaAction`, `getMetadataPreviewAction`, `getImagesAction`
- `getSeasonsAction`, `getEpisodesAction` for TV shows
- Circuit breaker: 5 failures → 60s recovery
- Graceful degradation if TMDB_API_KEY not set

**Artwork Handling:**

- Downloads posters/backdrops from TMDB
- Uploads to Google Drive as ARTWORK files
- Updates item with new file references

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

- ~548 tests across desktop Chrome and mobile Chrome (iPhone 14)
- Page Object Model pattern in `e2e/pages/` (includes `mobile-footer.page.ts`)
- Helpers in `e2e/helpers/` (includes `mobile-nav-helpers.ts`)
- Fixtures in `e2e/fixtures/` for auth, DB, Google Drive
- Google Drive tests use real test account with refresh token
- Run: `pnpm run test:e2e`

**Storybook (Component Documentation):**

- Storybook 10 with Next.js framework and Tailwind CSS 4
- Stories co-located with components (`*.stories.tsx`)
- MSW mocking in `.storybook/mocks/` for server actions
- Decorators: Theme (light/dark), auth state, reduced motion
- Accessibility testing via `@storybook/addon-a11y`
- Run: `pnpm run storybook` (dev), `pnpm run test-storybook` (tests)

**Screenshot Automation:**

- Portfolio screenshots for marketing in `e2e/screenshots/`
- 8 active scenarios × 2 themes (light/dark) × 2 devices (desktop/mobile) = 32 screenshots
- Desktop: 5760×3723 (1920×1241 @ 3× scale), Mobile: 1170×2732 (390×844 @ 3× scale + 200px top padding)
- Mobile screenshots have 200px top padding for iPhone notch clearance (white for light, black for dark)
- Run: `npx playwright test --config=e2e/screenshots/playwright.config.ts`

**Adding Mobile Top Padding (if regenerating screenshots):**

After generating mobile screenshots, add theme-matched top padding for iPhone mockups:

```bash
cd public/portfolio

# Add theme-matched bars (white for light, black for dark)
for img in *-mobile.png; do
  if [[ $img == *"-dark-"* ]]; then
    magick "$img" -gravity north -background black -splice 0x200 "${img}.new"
  else
    magick "$img" -gravity north -background white -splice 0x200 "${img}.new"
  fi
  mv "${img}.new" "$img"
done

# Special case: gray bars for dialogs with semi-transparent backgrounds
magick 04-tmdb-wizard-mobile.png -gravity north -background "#7e7e7e" -splice 0x200 04-tmdb-wizard-mobile.png.new && mv 04-tmdb-wizard-mobile.png.new 04-tmdb-wizard-mobile.png
magick 04-tmdb-wizard-dark-mobile.png -gravity north -background "#7e7e7e" -splice 0x200 04-tmdb-wizard-dark-mobile.png.new && mv 04-tmdb-wizard-dark-mobile.png.new 04-tmdb-wizard-dark-mobile.png
magick 05-progress-tracking-mobile.png -gravity north -background "#7e7e7e" -splice 0x200 05-progress-tracking-mobile.png.new && mv 05-progress-tracking-mobile.png.new 05-progress-tracking-mobile.png
magick 05-progress-tracking-dark-mobile.png -gravity north -background "#7e7e7e" -splice 0x200 05-progress-tracking-dark-mobile.png.new && mv 05-progress-tracking-dark-mobile.png.new 05-progress-tracking-dark-mobile.png
magick 06-google-drive-sync-mobile.png -gravity north -background "#7e7e7e" -splice 0x200 06-google-drive-sync-mobile.png.new && mv 06-google-drive-sync-mobile.png.new 06-google-drive-sync-mobile.png
magick 08-spotlight-search-mobile.png -gravity north -background "#7e7e7e" -splice 0x200 08-spotlight-search-mobile.png.new && mv 08-spotlight-search-mobile.png.new 08-spotlight-search-mobile.png
magick 08-spotlight-search-dark-mobile.png -gravity north -background "#7e7e7e" -splice 0x200 08-spotlight-search-dark-mobile.png.new && mv 08-spotlight-search-dark-mobile.png.new 08-spotlight-search-dark-mobile.png
magick 32-fork-dialog-mobile.png -gravity north -background "#7e7e7e" -splice 0x200 32-fork-dialog-mobile.png.new && mv 32-fork-dialog-mobile.png.new 32-fork-dialog-mobile.png
magick 32-fork-dialog-dark-mobile.png -gravity north -background "#7e7e7e" -splice 0x200 32-fork-dialog-dark-mobile.png.new && mv 32-fork-dialog-dark-mobile.png.new 32-fork-dialog-dark-mobile.png
```

This adds 200px bars (black for dark mode, white for light mode, gray #7e7e7e for dialogs) to prevent UI from being hidden by iPhone notch.

### Security

**OWASP Headers** configured in `next.config.mjs`:

- HSTS: 1-year max-age with includeSubDomains and preload
- CSP: Restricts resource loading to trusted sources
- X-Frame-Options: DENY (prevents clickjacking)
- X-Content-Type-Options: nosniff
- Referrer-Policy: strict-origin-when-cross-origin

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
- Auth pages use split-panel layout (decorative left panel with FloatingPaths, form right panel)
- Landing page uses Apple-inspired hero with feature card grid and Framer Motion animations

### Accessibility

- Skip link: "Skip to main content" for keyboard/screen reader navigation (WCAG 2.1 Level A)
- Reduced motion: `@media (prefers-reduced-motion)` disables animations globally; `useReducedMotion` hook for JS control
- HeroCarousel respects reduced motion preference (disables autoplay)
- Touch optimisation: 300ms tap delay removal, iOS highlight suppression, 44px minimum touch targets
- Safe area support: CSS variables for notched devices (iPhone X+), mobile footer respects safe areas
- Decorative icons: `aria-hidden="true"` on non-interactive icons
- Navigation a11y: `aria-current="page"` on active sidebar and mobile footer items
- Mobile navigation: Bottom sheets have accessible titles, focus trapping, swipe-to-dismiss gesture support
- Auth form a11y: Error messages use `role="alert"` and `aria-live="polite"` for screen reader announcements; inputs get `aria-invalid` and `aria-describedby` when validation fails

### Dark Mode

- next-themes for theme management with system preference detection
- ThemeProvider wraps app in `app/layout.tsx`
- ThemeToggle button in header with sun/moon icons
- color-scheme CSS: Browser-native dark mode for scrollbars and form controls
- Preference persists to localStorage

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

- `GOOGLE_SEED_REFRESH_TOKEN` - Refresh token for seed Drive account
- `GOOGLE_SEED_ROOT_FOLDER_ID` - Folder ID where seed creates content
- `GOOGLE_SEED_EMAIL` - Email of seed account (optional, for display)

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

