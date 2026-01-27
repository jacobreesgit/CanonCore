# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
pnpm run dev          # Start development server
pnpm run build        # Production build
pnpm run check        # Run all checks (format, lint, type-check, knip, build)
pnpm run seed:quick   # Incremental seed (fast - only changed users)
pnpm run seed:full    # Full clean slate seed (slow - rebuilds everything)

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
```

## Architecture

**Stack:** Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind CSS 4, NextAuth.js v5, Prisma, shadcn/ui

### Project Structure Patterns

**Route Groups:**

- `app/(auth)/` - Auth pages (sign-in, sign-up, forgot/reset-password) with redirect guard layout
- `app/(public)/` - Public pages (landing, explore, /u/[username], /u/[username]/[itemId])
- `app/(docs)/` - Fumadocs documentation at /docs

**API Routes:**

- `app/api/artwork/[fileId]/route.ts` - Artwork streaming from Google Drive
- `app/api/stream/[fileId]/route.ts` - Media streaming with Range header support
- `app/api/user/avatar/route.ts` and `hero/route.ts` - User image endpoints

**Server Actions Convention:**

- `lib/*-actions.ts` - All server actions (auth, items, fork, google-drive, item-file, tmdb, user, queue-aware)
- Parallel async execution for rate limit + auth checks
- Use Zod schemas from `lib/validations.ts`

**Components Organization:**

- `components/items/` - Items feature (30+ components for dialogs, toolbars, views, TMDB wizard)
- `components/google-drive/` - Drive integration UI (oauth-toast, settings-section, sync-history, storage-bar)
- `components/sortable-grid/` and `sortable-tree/` - dnd-kit drag-drop with view/edit modes
- `components/ui/` - shadcn/ui primitives (do not document)

**Utilities & Helpers:**

- `lib/*-utils.ts` - Feature utilities (item, progress, file-type, upload, sync)
- `lib/*-client.ts` - External API clients (google-drive, tmdb)
- `lib/types.ts` - Shared TypeScript types

**Testing:**

- `tests/unit/` - Vitest unit tests with mocks
- `tests/integration/` - Vitest integration tests with real DB
- `e2e/journeys/` - Playwright E2E tests by feature
- `e2e/pages/` - Page Object Models
- `e2e/fixtures/` - Reusable test fixtures

### Authentication

- **NextAuth.js v5** with Credentials provider for email/password auth
- Server-side: `await auth()` from `lib/auth.ts`, redirect unauthenticated users
- Client-side: `signIn()` and `signOut()` from `next-auth/react`
- Server actions: `signUp()`, `forgotPassword()`, `resetPassword()` in `lib/auth-actions.ts`
- Password hashing with bcryptjs, password reset emails via Resend (30 min expiry)
- **Rate limiting**: Upstash Redis (sign-in: 5/min, sign-up: 3/min, forgot: 2/min)
- **Validation**: Zod schemas in `lib/validations.ts` (8+ chars, uppercase, lowercase, number)
- **Security logging**: All auth events logged with IP and timestamp via Pino

### Database

**Prisma 7** with PostgreSQL (Neon)

**Key Schema Patterns:**

- User has optional `username` (unique, case-insensitive), `isPublic`, `image`/`heroImage` blobs, `defaultViewMode`/`defaultSortBy` (String?, not enum), `seedContentHash` (String?, for incremental seeding)
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

Run migrations: `npx prisma migrate dev`

### Database Seeding

The seeding system uses hash-based change detection for fast incremental updates:

```bash
pnpm run seed:quick   # Incremental - only rebuilds changed users (~5-30s)
pnpm run seed:full    # Clean slate - rebuilds everything (~2-3min)
```

**How it works:**

1. Hash each user's seed configuration (items, files, TMDB content)
2. Compare SHA-256 hash against `User.seedContentHash` in database
3. Skip unchanged users, rebuild only modified ones
4. Store new hash after successful seed

**Performance:**

- Full seed (4 users): ~2-3 minutes
- Incremental seed (0 changes): ~5 seconds
- Incremental seed (1 user changed): ~30-45 seconds

**Configuration:**

- `prisma/seed-config.ts` - Centralized user definitions, item trees, file metadata
- `prisma/seed.ts` - Seeding logic with hash comparison
- `SEED_INCREMENTAL=false` - Environment variable to force full rebuild

**Files created:**

- Seed creates content in Google Drive folder specified by `GOOGLE_SEED_ROOT_FOLDER_ID`
- 4 seeded users: demo, filmfan, bingewatcher, scifi_jordan (password: `SeedPassword123!`)
- Each user gets library structure with items, files, and TMDB metadata

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
- 3-step wizard: Title/Description → Poster → Hero/Backdrop
- Selective metadata application (choose which fields to update)

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

- Page Object Model pattern in `e2e/pages/`
- Fixtures in `e2e/fixtures/` for auth, DB, Google Drive
- Runs on desktop Chrome and mobile Chrome (iPhone 14)
- Google Drive tests use real test account with refresh token
- Run: `pnpm run test:e2e`

**Screenshot Automation:**

- Portfolio screenshots for marketing in `e2e/screenshots/`
- 35 test cases capturing UI states (see `docs/SCREENSHOT-PLAN.md`)
- Run: `npx playwright test --config=e2e/screenshots/playwright.config.ts`

### Security

**OWASP Headers** configured in `next.config.mjs`:

- HSTS: 1-year max-age with includeSubDomains and preload
- CSP: Restricts resource loading to trusted sources
- X-Frame-Options: DENY (prevents clickjacking)
- X-Content-Type-Options: nosniff
- Referrer-Policy: strict-origin-when-cross-origin

### Observability

- **Structured logging**: Pino logger with JSON output in production
- **Request tracing**: Middleware injects `x-request-id` header
- **Child loggers**: `createRequestLogger(requestId)` and `createUserLogger(userId)`
- **Log levels**: Configurable via `LOG_LEVEL` env var (debug, info, warn, error)

### Styling

- Tailwind CSS 4 with CSS variables
- shadcn/ui "new-york" style
- Prettier with tailwindcss plugin for class sorting
- Auth pages use rounded-full inputs/buttons (signup10 design pattern)

### Accessibility

- Skip link: "Skip to main content" for keyboard/screen reader navigation (WCAG 2.1 Level A)
- Reduced motion: `@media (prefers-reduced-motion)` disables animations globally
- HeroCarousel respects reduced motion preference (disables autoplay)
- Touch optimization: 300ms tap delay removal, iOS highlight suppression
- Safe area support: CSS variables for notched devices (iPhone X+)
- Decorative icons: `aria-hidden="true"` on non-interactive icons
- Navigation a11y: `aria-current="page"` on active sidebar items

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
