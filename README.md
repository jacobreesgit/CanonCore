# CanonCore

> Google Drive meets Netflix. Visual browsing, drag-and-drop organisation, watch progress, collections others can fork.

**Live:** [canoncore.com](https://canoncore.com)

## The Product

CanonCore turns Google Drive into a fully featured media library: visual browsing, metadata enrichment, progress tracking, and public sharing, without moving or duplicating your files. Create folder structures for movies and TV shows, reorganise with drag and drop, enrich items from TMDB, track what you've watched, and share collections publicly. Your files live in your storage, not ours.

I use this daily for my own movie and TV library. Active development continues with planned features including character tagging and native iOS and tvOS apps.

---

## Features

### Browsing & Organisation

Two views: **Grid** is Netflix-style with poster cards and progress bars. **Tree** is file explorer-style showing all descendants at once. Every item page has a hero banner. I wanted it to feel like browsing a streaming service, not a file manager.

Edit mode enables drag-and-drop, bulk selection, and full keyboard navigation with screen reader announcements. Pinned items (max 10) appear in the sidebar for quick access. dnd-kit only loads in edit mode to keep browsing fast.

### Public Sharing

Make items public to share them. Your profile page shows your public items. The explore page shows public items from everyone with a featured banner carousel.

Visibility inherits through the hierarchy. Items can be public, private, or inherit from a parent. A public item with a private ancestor stays inaccessible. Moving a public item into a private folder triggers a confirmation dialogue.

### Forking

Other users can fork your collections into their own library. Forking copies names, descriptions, artwork, and hierarchy. Media files and subtitles stay private. Think of it like sharing a Spotify playlist: the structure is public, the files aren't.

### Media Playback

Vidstack-powered player streams media directly from Google Drive via HTTP range requests. Playback position auto-saves and resumes where you left off. Supports SRT, VTT, SUB, and ASS subtitle tracks. I always want to use subtitles. I watch a lot of anime.

### One-Click Metadata

You can enrich movies and TV shows with TMDB metadata. A three-step wizard lets you search for a title, select from multiple poster options, and choose a backdrop image for hero banners.

### Progress Tracking

I built progress tracking because I kept losing my place in long series. Folders display watched and total counts for themselves and all descendant items, using a 90 percent completion threshold to account for credit skipping.

The "Go to next" action performs a depth-first traversal of the tree to locate your first incomplete item automatically.

### Google Drive Sync

All your media files stay in your Drive. I use Google's Changes API for incremental syncs, fetching only changed items since the last update. If incremental sync returns no results, a verification step triggers a full sync.

Conflict detection compares timestamps bidirectionally: if Drive's modifiedTime is newer than our stored value, local changes are rejected with a notification. Errors are isolated per file, so individual failures don't interrupt the overall process.

### Spotlight Search

Press `/` to open Spotlight Search anywhere in the app. Results load in parallel across three sections: Your Items, Public Collections, and People. A module-level cache with a 60-second TTL gives you instant responses on repeat searches. Breadcrumb paths reveal each item's full hierarchy.

---

## How It's Built

### Architecture Decisions

**Google Drive migration:** I originally built this on SFTP, but path-based matching meant every rename or move created duplicates. No stable IDs, no change detection API, read-only from the web. Google Drive solved all of it: permanent file IDs survive renames and moves, Changes API for incremental sync, full read/write access so users can create folders directly from CanonCore. Should have started here.

**Stack Auth → NextAuth.js v5:** I started with managed auth, then migrated to self-hosted JWT sessions after hitting rate limits. I added 15+ rate limiters via Upstash Redis with different thresholds per action (strict for auth, generous for browsing).

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

Over 2,300 unit tests with Vitest cover auth, items, Google Drive sync, and crypto operations. Integration tests run against real PostgreSQL. E2E tests with Playwright use the Page Object Model pattern and test against a real Google Drive account, not mocked. Tests automatically create missing fixtures for self-healing reliability.

---

## Tech Stack

**Front End:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, shadcn/ui, Vidstack, dnd-kit, cmdk

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
pnpm run seed:quick         # Incremental seed (~5-30s)
pnpm run seed:full          # Full clean slate seed (~2-3min)
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
├── items/               # Items feature (30+ components)
├── google-drive/        # Drive integration UI
├── sortable-grid/       # Grid drag-and-drop (dnd-kit)
├── sortable-tree/       # Tree drag-and-drop (dnd-kit)
├── search/              # Spotlight search
├── profile/             # User profile components
└── ui/                  # shadcn/ui primitives

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
e2e/journeys/            # Playwright E2E tests by feature
e2e/pages/               # Page Object Models
e2e/fixtures/            # Reusable test fixtures
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
- `GOOGLE_SEED_ROOT_FOLDER_ID` - Folder ID where seed creates content
- `GOOGLE_SEED_EMAIL` - Email of seed account (optional)

E2E Testing (optional):

- `GOOGLE_E2E_REFRESH_TOKEN` - E2E test Drive account token
- `GOOGLE_E2E_ROOT_FOLDER_ID` - Folder ID for E2E tests
- `GOOGLE_E2E_EMAIL` - Email of E2E test account (optional)

Optional:

- `BYPASS_RATE_LIMIT` - Set to `"true"` to skip rate limiting (E2E tests only)
- `NEXT_PUBLIC_APP_URL` - Base URL for email links (default: `http://localhost:3000`)
- `LOG_LEVEL` - Pino log level: debug, info, warn, error (default: info)
- `SEED_INCREMENTAL` - Set to `false` to force full rebuild (default: true)

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

- Items feature: 30+ components in `components/items/`
- Google Drive UI: `components/google-drive/`
- Drag-and-drop: `sortable-grid/` and `sortable-tree/` (dnd-kit)
- shadcn/ui: `components/ui/` (don't document these)

**Database Schema:**

- Self-referential hierarchy: `Item.parentId` for unlimited nesting
- Inherited visibility: `Item.inheritVisibility` for public/private cascading
- Google Drive sync: `Item.driveFileId`, `syncStatus`, `driveModifiedAt`
- Progress tracking: `ItemFile.playbackPosition` (90% threshold for "watched")

**Testing:**

- Unit tests: `tests/unit/` with mocked Prisma, email, rate-limit
- Integration tests: `tests/integration/` with real database
- E2E tests: `e2e/journeys/` with Page Object Model pattern
- Coverage configured for `lib/**` only

## Documentation

See [DESIGN.md](./DESIGN.md) for detailed architecture, API design, and implementation decisions.
