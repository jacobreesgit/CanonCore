# CanonCore

> Google Drive meets Netflix. Visual browsing, drag-and-drop organisation, watch progress, collections others can fork.

**Live:** [canoncore.com](https://canoncore.com) | **Storybook:** [canoncore-storybook.vercel.app](https://canoncore-storybook.vercel.app)

## The Product

CanonCore turns Google Drive into a fully featured media library: visual browsing, metadata enrichment, progress tracking, and public sharing, without moving or duplicating your files. Create folder structures for movies and TV shows, reorganise with drag and drop, enrich items from TMDB, track what you've watched, and share collections publicly. Your files live in your storage, not ours.

I use this daily for my own movie and TV library. Active development continues with planned features including character tagging and native iOS and tvOS apps.

---

## Features

### Browsing & Organisation

Two views: **Grid** is Netflix-style with poster cards and progress bars. **Tree** is file explorer-style showing all descendants at once. Every item page has a hero banner. I wanted it to feel like browsing a streaming service, not a file manager.

Edit mode enables drag-and-drop, bulk selection, and full keyboard navigation with screen reader announcements. Pinned items (max 10) appear in the sidebar for quick access. dnd-kit only loads in edit mode to keep browsing fast.

On mobile, bottom sheets replace desktop dialogs for sort, filter, view switching, and item creation. A bottom navigation bar provides access to My Items, Explore, Search, Help, and Account.

### Public Sharing

Make items public to share them. Your profile page shows your public items. The explore page shows public items from everyone with a featured banner carousel.

Visibility inherits through the hierarchy. Items can be public, private, or inherit from a parent. A public item with a private ancestor stays inaccessible. Moving a public item into a private folder triggers a confirmation dialogue.

### Forking

Other users can fork your collections into their own library. Forking copies names, descriptions, artwork, and hierarchy. Media files and subtitles stay private. Think of it like sharing a Spotify playlist: the structure is public, the files aren't.

### Media Playback

Vidstack-powered player streams media directly from Google Drive via HTTP range requests. Playback position auto-saves and resumes where you left off. Supports SRT, VTT, SUB, and ASS subtitle tracks. I always want to use subtitles. I watch a lot of anime.

### One-Click Metadata

You can enrich movies and TV shows with TMDB metadata. A four-step wizard lets you search for a title, review the description, select from multiple poster options, choose a backdrop image, and review everything before applying. For TV shows, an episode picker lets you navigate into seasons and episodes. Per-item display toggles control what metadata appears: tagline, cast, genres, providers, videos, and recommendations.

### Progress Tracking

I built progress tracking because I kept losing my place in long series. Folders display watched and total counts for themselves and all descendant items, using a 90 percent completion threshold to account for credit skipping.

The "Go to next" action performs a depth-first traversal of the tree to locate your first incomplete item automatically.

### Google Drive Sync

All your media files stay in your Drive. I use Google's Changes API for incremental syncs, fetching only changed items since the last update. If incremental sync returns no results, a verification step triggers a full sync.

Conflict detection compares timestamps bidirectionally: if Drive's modifiedTime is newer than our stored value, local changes are rejected with a notification. Errors are isolated per file, so individual failures don't interrupt the overall process. If your Drive connection expires, a persistent banner appears across the app prompting you to reconnect.

### Spotlight Search

Press `/` to open Spotlight Search anywhere in the app. Results load in parallel across three sections: Your Items, Public Collections, and People. A module-level cache with a 60-second TTL gives you instant responses on repeat searches. Breadcrumb paths reveal each item's full hierarchy.

### Cinematic Hero

The explore page features a cinematic hero carousel that auto-advances through featured collections with rich TMDB metadata — tagline, release year, runtime, genres, and content rating. Item detail pages show a single hero banner with the item's backdrop artwork.

### URL State

Sort, filter, view mode, and tab selections persist in URL parameters via nuqs. Bookmarkable, shareable views with localStorage backup for direct navigation.

### Multi-Select Filters

Two filter groups — File Status (Has Files, No Files) and Sync Status (Synced, Pending Sync, Sync Error) — with AND logic across groups and OR within. Active filter count shown in toolbar badge.

### Bot Protection

Multi-layer defence against aggressive AI crawlers: robots.txt for polite bots, edge-level blocking for non-compliant scrapers, and rate limiting (120 req/min) for beneficial search engines. Blocks 35+ AI scrapers while allowing Google, Bing, Apple, and others.

### Audit Logging

Every database mutation is automatically logged via a Prisma extension. Context includes user, action, model, and record ID. Sensitive fields are redacted. 90-day retention in production.

---

## How It's Built

### Architecture Decisions

**Google Drive migration:** I originally built this on SFTP, but path-based matching meant every rename or move created duplicates. No stable IDs, no change detection API, read-only from the web. Google Drive solved all of it: permanent file IDs survive renames and moves, Changes API for incremental sync, full read/write access so users can create folders directly from CanonCore. Should have started here.

**Stack Auth → NextAuth.js v5:** I started with managed auth, then migrated to self-hosted JWT sessions after hitting rate limits. I added 20+ rate limiters via Upstash Redis with different thresholds per action (strict for auth, generous for browsing).

### Security & Resilience

**OAuth Token Encryption:** AES-256-GCM with random IVs per encryption.

**Upload Security:** HMAC-SHA256 signed session tokens with timing-safe comparison, token expiry validation, and filename sanitisation.

**Circuit Breaker:** I wrapped TMDB and Google Drive calls in a custom circuit breaker that opens after consecutive failures and tests recovery in half-open state.

**Security Headers:** OWASP-compliant headers including HSTS with preload, CSP with trusted sources, and X-Frame-Options: DENY.

**CSRF Protection:** Signed OAuth state parameter to prevent authorization code interception.

### Performance

**Edit Mode Separation:** I extracted a view-only Grid from SortableGrid to avoid dnd-kit overhead in browse mode.

**Bulk Delete:** Recursive CTE for deleting nested hierarchies in a single query.

**Lazy Loading:** Intersection Observer with 200px preload margin and priority mode for above-fold images.

**Request Deduplication:** React.cache() on the server, module-level caching on client for search results.

**Offline Queue:** Actions queue to IndexedDB when offline, replay on reconnect with exponential backoff and jitter.

**Structured Logging:** Pino with request ID injection for distributed tracing.

**Batch API:** Google Drive operations batched up to 100 per request. Reduced sync time for large folders from ~45s to ~3s.

### Accessibility

WCAG 2.1 AA compliant throughout. Reduced motion support via a custom hook that disables carousel autoplay and animations. Skip link to main content. ARIA live regions for drag-and-drop announcements.

### Testing

Over 2,400 unit tests with Vitest cover auth, items, Google Drive sync, and crypto operations. Integration tests run against real PostgreSQL. 31 E2E spec files across desktop and mobile Chrome with Playwright use 15 focused Page Object Models, composable fixtures with per-test user creation, and curated `data-testid` attributes for targeted selectors. Unit tests use role-based and text-based selectors following Testing Library best practices.

---

## Tech Stack

**Front End:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, shadcn/ui, Vidstack, dnd-kit, cmdk, nuqs, Embla Carousel

**Back End:** Prisma 7, NextAuth.js v5, Server Actions

**APIs:** Google Drive (OAuth 2.0, Changes API), TMDB

**Infrastructure:** Vercel, Neon PostgreSQL (serverless branching), Upstash Redis

---

## Development

### Commands

#### Development

```bash
pnpm run dev          # Start dev server with Turbopack
pnpm run build        # Production build
pnpm run start        # Start production server
pnpm run check        # Run all checks (format, lint, type-check, knip, build)
```

#### Database

```bash
npx prisma migrate dev      # Create and apply migrations
npx prisma generate         # Generate Prisma Client
npx prisma studio           # Open Prisma Studio
pnpm run seed               # Seed development (default)
pnpm run seed:production    # Seed production branch
pnpm run seed:e2e           # Seed E2E branch
```

#### Code Quality

```bash
pnpm run format       # Format with Prettier
pnpm run lint         # Lint with ESLint
pnpm run type-check   # TypeScript type checking
pnpm run knip         # Check for unused code/dependencies
```

#### Testing

```bash
# Unit & Integration Tests (Vitest)
pnpm run test              # Run unit tests
pnpm run test:unit         # Explicit unit tests
pnpm run test:integration  # Integration tests with real DB
pnpm run test:coverage     # Coverage report
pnpm run test:watch        # Watch mode

# E2E Tests (Playwright)
pnpm run test:e2e                           # All E2E tests
pnpm run test:e2e --project=chromium        # Desktop only
pnpm run test:e2e --project=mobile-chrome   # Mobile only
pnpm run test:e2e:debug                     # Debug mode
pnpm run test:e2e:ui                        # UI mode

# Storybook
pnpm run storybook           # Dev server at localhost:6006
pnpm run build-storybook     # Build static Storybook
pnpm run test-storybook      # Run smoke & a11y tests
pnpm run test-storybook:ci   # CI mode with 2 workers
```

#### Setup Scripts

```bash
pnpm run setup:e2e       # Setup E2E Drive account
pnpm run setup:seed      # Setup seed Drive account
pnpm run setup:e2e-drive # Setup E2E test data
pnpm run setup:verify    # Verify Drive accounts
pnpm run setup:all       # Run both OAuth setups
```

## Project Structure

```
app/
├── (auth)/              # Auth pages (sign-in, sign-up, forgot/reset-password)
├── (public)/            # Public pages (landing, explore, /u/[username])
├── (docs)/              # Fumadocs documentation
├── api/                 # API routes
│   ├── artwork/[fileId]/route.ts  # Artwork streaming
│   ├── stream/[fileId]/route.ts   # Media streaming (Range headers)
│   └── user/avatar|hero/route.ts  # User images
└── globals.css

components/
├── hero/                # Cinematic hero system (carousel, avatar)
├── items/               # Items feature (60+ components, wizards, detail sections)
├── wizards/             # Reusable wizard infrastructure (state machine, indicators)
├── google-drive/        # Drive integration UI
├── sortable-grid/       # Grid drag-and-drop (dnd-kit)
├── sortable-tree/       # Tree drag-and-drop (dnd-kit)
├── media/               # Media player (Vidstack)
├── mobile/              # Mobile navigation, bottom sheets, swipeable tabs
├── search/              # Spotlight search
├── profile/             # User profile and settings
├── providers/           # App-level providers (theme, error boundary, nuqs)
├── diceui/              # File upload with drag-drop and previews
└── ui/                  # shadcn/ui primitives + shared UI

hooks/
├── search-params.ts     # Shared nuqs URL state parsers
├── use-items-url-state.ts  # URL-backed sort/filter/view/tab state
├── use-explore-url-state.ts # URL-backed explore page state
├── use-add-item-form.ts    # Add item form state (shared desktop/mobile)
├── use-settings-form.ts    # Profile settings form state
└── use-reduced-motion.ts   # Reduced motion preference detection

lib/
├── *-actions.ts         # Server actions
├── *-client.ts          # External API clients (google-drive, tmdb)
├── *-utils.ts           # Feature utilities
├── auth.ts              # NextAuth config
├── prisma.ts            # Prisma client
├── types.ts             # Shared TypeScript types
└── validations.ts       # Zod schemas

prisma/
├── schema.prisma        # Database schema
├── seed.ts              # Seeding logic
└── seed-config.ts       # Seed user definitions

tests/unit/              # Vitest unit tests (mocked)
tests/integration/       # Vitest integration tests (real DB)
e2e/journeys/            # Playwright E2E tests by feature (31 spec files)
e2e/pages/               # 15 focused Page Object Models
e2e/fixtures/            # Composable test fixtures (authenticated, public, drive)
e2e/config/              # Centralised timeouts and test data utilities
```

## Environment Variables

Required:

- `DATABASE_URL` - Neon PostgreSQL connection string
- `AUTH_SECRET` - NextAuth secret (generate: `openssl rand -base64 32`)
- `RESEND_API_KEY` - Resend API key for password reset emails
- `EMAIL_FROM` - Sender email (default: `noreply@canoncore.com`)
- `UPSTASH_REDIS_REST_URL` - Upstash Redis URL
- `UPSTASH_REDIS_REST_TOKEN` - Upstash Redis token
- `ENCRYPTION_KEY` - Base64 32-byte key (generate: `openssl rand -base64 32`)

Google Drive (required for Drive integration):

- `GOOGLE_CLIENT_ID` - OAuth client ID
- `GOOGLE_CLIENT_SECRET` - OAuth client secret

TMDB (optional):

- `TMDB_API_KEY` - TMDB v3 API key for metadata

Seed (required for seeding):

- `GOOGLE_SEED_REFRESH_TOKEN` - Seed Drive account token
- `GOOGLE_SEED_ROOT_FOLDER_ID` - Development Drive root folder
- `GOOGLE_SEED_EMAIL` - Email of seed account (optional)
- `SEED_TARGET` - Target branch: development (default), production, e2e
- `SEED_PRODUCTION_DATABASE_URL` - Production Neon connection string
- `SEED_PRODUCTION_ROOT_FOLDER_ID` - Production Drive root folder
- `SEED_E2E_ROOT_FOLDER_ID` - E2E Drive root folder

E2E Testing (optional):

- `E2E_DATABASE_URL` - Neon connection string for E2E branch
- `GOOGLE_E2E_REFRESH_TOKEN` - E2E test Drive account token
- `GOOGLE_E2E_ROOT_FOLDER_ID` - Folder ID for E2E tests
- `GOOGLE_E2E_EMAIL` - Email of E2E test account (optional)

Optional:

- `BYPASS_RATE_LIMIT` - Set to `"true"` to skip rate limiting (E2E tests only)
- `NEXT_PUBLIC_APP_URL` - Base URL for email links (default: `http://localhost:3000`)
- `LOG_LEVEL` - Pino log level: debug, info, warn, error (default: info)

## Branching Strategy

| Git Branch    | Neon Branch   | Vercel Environment |
| ------------- | ------------- | ------------------ |
| `development` | `development` | Preview            |
| `production`  | `production`  | Production         |

Local dev uses `.env.local` pointing to Neon `development` branch.
Vercel production uses environment variables for Neon `production` branch.

---

## Implementation Patterns

**Server Actions Convention:**

- All server actions in `lib/*-actions.ts`
- Parallel async execution for rate limit + auth checks
- Zod schemas from `lib/validations.ts`

**Route Groups:**

- `app/(auth)/` - Auth pages with redirect guard layout
- `app/(public)/` - Public pages (landing, explore, profiles)
- `app/(docs)/` - Fumadocs documentation

**Component Organization:**

- Items feature: 60+ components in `components/items/`
- Google Drive UI: `components/google-drive/`
- Drag-and-drop: `sortable-grid/` and `sortable-tree/` (dnd-kit)
- shadcn/ui: `components/ui/` (don't document these)

**Database Schema:**

- Self-referential hierarchy: `Item.parentId` for unlimited nesting
- Inherited visibility: `Item.inheritVisibility` for public/private cascading
- Google Drive sync: `Item.driveFileId`, `syncStatus`, `driveModifiedAt`
- Progress tracking: `ItemFile.playbackPosition` (90% threshold for "watched")

**Testing:**

- Unit tests: `tests/unit/` with mocked Prisma, email, rate-limit (role-based selectors)
- Integration tests: `tests/integration/` with real database
- E2E tests: `e2e/journeys/` with 15 focused Page Object Models and composable fixtures
- Coverage configured for `lib/**` only

## Documentation

See [DESIGN.md](./DESIGN.md) for detailed architecture, API design, and implementation decisions.
