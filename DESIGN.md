# CanonCore - Technical Documentation

Last updated: January 2026 (v6.0.0)

This doc covers architecture, implementation patterns, and design decisions for CanonCore. Written as technical reference for understanding how everything works.

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Database Design](#database-design)
3. [API Design & Server Actions](#api-design--server-actions)
4. [Authentication & Security](#authentication--security)
5. [Feature Implementation](#feature-implementation)
6. [Performance](#performance)
7. [Testing Strategy](#testing-strategy)
8. [Documentation Standards](#documentation-standards)
9. [Deployment](#deployment)
10. [Design Decisions](#design-decisions)

---

## System Architecture

### Stack

**Frontend:**
- Next.js 16 (App Router with Turbopack)
- React 19 (Server Components, Server Actions)
- TypeScript 5.7
- Tailwind CSS 4
- shadcn/ui (radix-ui primitives)
- dnd-kit for drag-and-drop
- Vidstack for media playback

**Backend:**
- Next.js Server Actions (primary)
- API Routes (streaming endpoints only)
- Prisma 7 ORM
- PostgreSQL (Neon serverless)
- Upstash Redis (rate limiting)

**External APIs:**
- Google Drive API v3 (OAuth 2.0, Changes API for sync)
- TMDB API v3 (metadata enrichment)
- Resend (transactional email)

### Architecture Diagram

```
┌─────────────────────────────────────────┐
│         Client (Browser)                 │
│  ┌────────────────────────────────────┐  │
│  │  React 19 Components               │  │
│  │  - Server Components (SSR)         │  │
│  │  - Client Components (interactive) │  │
│  │  - Server Actions (mutations)      │  │
│  └────────────────────────────────────┘  │
└─────────────────────────────────────────┘
              ↕
┌─────────────────────────────────────────┐
│      Next.js Application Layer           │
│  ┌──────────┐  ┌───────────┐           │
│  │ Server   │  │ API Routes │           │
│  │ Actions  │  │ (streaming)│           │
│  └──────────┘  └───────────┘           │
└─────────────────────────────────────────┘
              ↕
┌─────────────────────────────────────────┐
│           Prisma ORM                     │
│  - Type-safe queries                     │
│  - Connection pooling                    │
│  - Migration management                  │
└─────────────────────────────────────────┘
              ↕
┌─────────────────────────────────────────┐
│        External Services                 │
│  ┌──────────┐  ┌───────────────┐       │
│  │PostgreSQL│  │ Google Drive  │       │
│  │  (Neon)  │  │  TMDB / Redis │       │
│  └──────────┘  └───────────────┘       │
└─────────────────────────────────────────┘
```

### Component Patterns

**Server Components (default):**
- Used for data fetching (direct database queries)
- No client-side JavaScript bundle
- Can use `React.cache()` for request-level deduplication
- Examples: Page layouts, item lists, profile displays

**Client Components (`"use client"`):**
- Used for interactivity (forms, dialogs, drag-and-drop)
- State management with React hooks
- Examples: AddItemDialog, SortableGrid, MediaPlayer

**Server Actions:**
- Type-safe mutations callable from client
- Validation with Zod schemas
- Parallel execution pattern for rate limit + auth checks
- Convention: All in `lib/*-actions.ts` files

---

## Database Design

### Schema Overview

Built on PostgreSQL with Prisma ORM. Key tables:

**User:**
- Authentication (email, passwordHash via bcryptjs)
- Profile (username, isPublic, image/heroImage blobs)
- Settings (defaultViewMode, defaultSortBy as strings not enums)
- Seeding (seedContentHash for incremental updates)

**Item (hierarchical tree):**
- Self-referential: parentId → unlimited nesting
- Metadata: name, description, depth, order, pinnedOrder
- Visibility: isPublic, inheritVisibility
- Google Drive: driveFileId, syncStatus, driveModifiedAt, driveConnectionId
- Forking: forkedFromId to track copies

**ItemFile:**
- File types: MEDIA (video/audio), ARTWORK (images), SUBTITLE (srt/vtt/etc)
- Google Drive: driveFileId, filename, mimeType, size
- Playback: playbackPosition (in seconds), isPrimary, isHero

**GoogleDriveConnection:**
- OAuth tokens (AES-256-GCM encrypted)
- Quota tracking: quotaBytesUsed, quotaBytesTotal
- One connection per user

**Fork:**
- Tracks item copies: sourceItemId, targetItemId, userId
- Unique constraint: user can only fork an item once

**SyncLog:**
- Operation history: action (CREATE/RENAME/DELETE/MOVE/UPLOAD/etc)
- Status tracking: SUCCESS/FAILED/PENDING
- Performance: durationMs for each operation

### Entity-Relationship Diagram

```
┌──────────────┐
│     User     │
├──────────────┤
│ id           │──┐
│ email        │  │ 1:1
│ passwordHash │  ├─────────┐
│ username     │  │         │
│ isPublic     │  │         ▼
│ image (blob) │  │  ┌─────────────────────┐
└──────────────┘  │  │GoogleDriveConnection│
                  │  ├─────────────────────┤
        1:N       │  │ accessToken (enc)   │
        │         │  │ refreshToken (enc)  │
    ┌───▼─────┐   │  │ rootFolderId        │
    │  Item   │◄──┘  │ quotaBytesUsed      │
    ├─────────┤      └─────────────────────┘
    │ id      │
    │ parentId│──┐ Self-referential
    │ name    │  │ (tree structure)
    │ depth   │◄─┘
    │ order   │
    └────┬────┘
         │ 1:N
         │
    ┌────▼─────┐
    │ItemFile  │
    ├──────────┤
    │ fileType │ (MEDIA/ARTWORK/SUBTITLE)
    │ isPrimary│
    │ isHero   │
    │ playback │
    │ Position │
    └──────────┘
```

### Key Schema Decisions

**Self-Referential Hierarchy (`Item.parentId`):**
- Allows unlimited nesting without complex joins
- Tradeoff: Need DFS/BFS for tree traversal operations
- Depth tracking (max 10 levels) prevents UI performance issues

**Inherited Visibility (`Item.inheritVisibility`):**
- Reduces clutter in Explore page (only show root-level public collections)
- Children inherit parent's public/private setting when true
- Item is "fully public" only when: item.isPublic && profile.isPublic && all ancestors public

**Progress Tracking (`ItemFile.playbackPosition`):**
- Per-file tracking (needed for TV episodes, multi-file movies)
- 90% completion threshold counts as "watched" (accounts for credit skipping)
- DFS traversal to find first incomplete item in hierarchy

**Incremental Seeding (`User.seedContentHash`):**
- SHA-256 hash of user's seed configuration (items, files, metadata)
- Compare hash before seeding to skip unchanged users
- Performance: ~5s for 0 changes, ~30s for 1 user, ~3min for full rebuild

---

## API Design & Server Actions

### Convention

**Server Actions Pattern:**
All mutations go through server actions in `lib/*-actions.ts`:
- `lib/item-actions.ts` - CRUD, reordering, pinning, progress
- `lib/google-drive-actions.ts` - OAuth, sync, connection management
- `lib/tmdb-actions.ts` - Metadata search, image fetching
- `lib/auth-actions.ts` - Sign up, forgot password, reset password
- `lib/user-actions.ts` - Profile updates, image uploads
- `lib/fork-actions.ts` - Forking collections

**Parallel Async Pattern:**
Every server action runs rate limit + auth checks in parallel:
```typescript
const [rateLimitResult, session] = await Promise.all([
  checkRateLimit("action-name", userId),
  auth()
]);
```

**Validation:**
All inputs validated with Zod schemas from `lib/validations.ts`:
```typescript
const parsed = createItemSchema.safeParse({ name, parentId });
if (!parsed.success) {
  return { success: false, error: "Invalid input" };
}
```

### API Routes (Streaming Only)

Server Actions can't stream responses, so these use API Routes:

**`/api/stream/[fileId]/route.ts`:**
- Media streaming from Google Drive
- HTTP Range header support for seeking
- Returns 206 Partial Content responses

**`/api/artwork/[fileId]/route.ts`:**
- Image streaming from Google Drive
- Cache headers for browser caching

**`/api/user/avatar/route.ts` and `hero/route.ts`:**
- User profile/hero image endpoints
- Serves blobs from database

### Route Groups

**`app/(auth)/`:**
- Pages: sign-in, sign-up, forgot-password, reset-password
- Layout with redirect guard (authenticated users → home)

**`app/(public)/`:**
- Landing page, explore, user profiles (`/u/[username]`)
- Item detail pages (`/u/[username]/[itemId]`)

**`app/(docs)/`:**
- Fumadocs documentation at `/docs`

---

## Authentication & Security

### NextAuth.js v5

**Credentials Provider:**
- Email/password auth (bcryptjs hashing, 10 rounds)
- JWT sessions (not database sessions)
- Session token in HTTP-only cookie

**Server-side auth:**
```typescript
import { auth } from "@/lib/auth";
const session = await auth();
if (!session) redirect("/sign-in");
```

**Client-side auth:**
```typescript
import { signIn, signOut } from "next-auth/react";
await signIn("credentials", { email, password });
```

### Rate Limiting

Upstash Redis with different thresholds per action:
- Sign-in: 5 requests/minute
- Sign-up: 3 requests/minute
- Forgot password: 2 requests/minute
- Item mutations: 30 requests/minute
- Search: 30-60 requests/minute per section

Implementation in `lib/rate-limit.ts` with exponential backoff.

### Security Features

**Password Reset:**
- 30-minute expiry tokens stored in database
- Sent via Resend transactional email
- Tokens hashed before storage

**OAuth Token Encryption:**
- AES-256-GCM for Google Drive tokens
- Random IV per encryption (stored alongside ciphertext)
- Encryption key from `ENCRYPTION_KEY` env var

**Upload Security:**
- HMAC-SHA256 signed session tokens
- Token expiry validation (15-minute window)
- Filename sanitization (prevent path traversal)
- Timing-safe comparison for signatures

**CSRF Protection:**
- OAuth state parameter signed with secret
- Prevents authorization code interception

**OWASP Headers** (in `next.config.mjs`):
- HSTS with preload and includeSubDomains
- CSP with trusted sources only
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- Referrer-Policy: strict-origin-when-cross-origin

**Security Logging:**
- All auth events logged with IP and timestamp
- Structured logging via Pino
- Request ID injection in middleware

---

## Feature Implementation

### Items System

**Hierarchy:**
- Self-referential tree with parentId
- Max 10 levels deep (UI performance limit)
- Drag-and-drop reordering with dnd-kit

**View Modes:**
- Grid: Movie poster cards with progress bars (Netflix-style)
- Tree: Hierarchical list showing all descendants

**Edit Mode:**
- Toggle between View and Edit
- Edit shows drag handles and checkboxes
- Only available in Custom Order sort

**Sorting:**
- Custom Order (drag-and-drop)
- Name A-Z / Z-A
- Newest / Oldest
- Recently Updated

**Filtering:**
- All Items
- Has Files / No Files
- Synced / Pending (Google Drive sync status)

**Pinning:**
- Max 10 pinned items per user
- Shown in sidebar with folder icons
- Quick access to frequently used collections

**Progress Tracking:**
- 90% completion threshold for "watched"
- DFS traversal to find first incomplete item
- Folder shows watched/total counts for all descendants

**Bulk Operations:**
- Edit mode shows checkboxes
- Select all / deselect all in toolbar
- Batch delete with recursive CTE (single query for entire hierarchy)
- Cascading selection: selecting parent selects all children

### Google Drive Integration

**OAuth Flow:**
- Google Cloud Console OAuth 2.0
- Scopes: drive.file (only app-created files), drive.appdata
- CSRF protection via signed state parameter
- AES-256-GCM token encryption

**Bidirectional Sync:**
- Changes API for incremental sync (only changed items since last update)
- Timestamp comparison for conflict detection
- Batch API: up to 100 operations per HTTP request

**Offline Support:**
- IndexedDB queue for operations when offline
- Exponential backoff retry (5 attempts, max 30s delay)
- Jitter to prevent thundering herd
- PendingIndicator shows queued operation count

**Storage Monitoring:**
- Quota display in settings
- Warning at 80% (yellow), critical at 95% (red)

**Special Cases:**
- Trashed folder detection with recovery guidance
- Circuit breaker: 5 consecutive failures → 60s recovery period

### TMDB Metadata

**3-Step Wizard:**
1. Search by title (movie or TV show)
2. Select poster from multiple options
3. Choose hero/backdrop image

**Selective Application:**
- Choose which fields to update (title, description, artwork)
- TV show support: seasons and episodes with full hierarchy

**Artwork Handling:**
- Download poster/backdrop from TMDB
- Upload to Google Drive as ARTWORK files
- Link to item via ItemFile records

**Error Handling:**
- Circuit breaker: 5 failures → 60s recovery
- Graceful degradation if TMDB_API_KEY not set (manual metadata only)

### Spotlight Search

**Keyboard-First:**
- Press "/" to open from any page
- Escape to close, arrow keys to navigate

**Three Sections:**
1. Your Items (fuzzy search with breadcrumb paths)
2. Public Collections (all users' public items)
3. People (search users by username)

**Performance:**
- 60-second TTL module-level cache
- Parallel fetching (all three sections load concurrently)
- Independent loading states (each section renders with skeletons)

**Implementation:**
- cmdk library for fuzzy matching
- SpotlightProvider context manages dialog state
- "/" keyboard listener in useEffect

### Public Profiles & Forking

**Routes:**
- `/u/[username]` - User profile with public items
- `/u/[username]/[itemId]` - Public item detail

**Visibility Rules:**
- Item is "fully public" when: item.isPublic && profile.isPublic && all ancestors public
- `inheritVisibility: true` items inherit from parent
- Explore page shows only explicitly public items (`isPublic: true, inheritVisibility: false`)

**Forking:**
- One-click fork from explore page or profile
- Choose destination folder (virtualized selector for large libraries)
- Copies structure, metadata, artwork (not media files)
- Cannot fork own items, cannot fork same item twice
- Forked items start private with `inheritVisibility: false`

### Media Playback

**Vidstack Player:**
- HTML5 video/audio with custom controls
- HTTP Range header support for seeking
- Subtitle tracks: SRT, VTT, SUB, ASS

**Resume Playback:**
- Auto-save position every 5 seconds
- Resumes where you left off on next play

**Full-Screen Overlay:**
- Tabbed navigation for multiple files
- Keyboard shortcuts (Space = play/pause, F = fullscreen)

---

## Performance

### Server-Side

**Parallel Async Execution:**
```typescript
const [rateLimitResult, session, user] = await Promise.all([
  checkRateLimit("action", userId),
  auth(),
  prisma.user.findUnique({ where: { id: userId } })
]);
```

**React.cache() for Deduplication:**
```typescript
export const getItems = cache(async function getItems(parentId: string) {
  return await prisma.item.findMany({ where: { parentId } });
});
```
Multiple Server Components calling `getItems()` in same request = 1 database query.

**Selective Field Projection:**
All Prisma queries use minimal `select`:
```typescript
await prisma.item.findMany({
  select: {
    id: true,
    name: true,
    order: true,
    // Only fields needed for this view
  }
});
```

**Module-Level Caching:**
60-second TTL for frequently accessed data (search results):
```typescript
let cache = { data: null, timestamp: 0 };
if (Date.now() - cache.timestamp < 60000) return cache.data;
```

### Client-Side

**Dynamic Imports:**
Code-split heavy dialogs (~25KB savings):
```typescript
const AddItemDialog = dynamic(
  () => import("./add-item-dialog").then((mod) => ({ default: mod.AddItemDialog })),
  { ssr: false }
);
```

**useMemo for Expensive Derivations:**
```typescript
const sortedItems = useMemo(() => sortItems(items, sortBy), [items, sortBy]);
const filteredItems = useMemo(() => filterItems(sortedItems, filterBy), [sortedItems, filterBy]);
```

**React.memo for Stateless Components:**
```typescript
export const BulkActionsToolbar = memo(function BulkActionsToolbar({ ... }) {
  // Component avoids re-renders when parent state changes
});
```

**Edit Mode Separation:**
- View mode uses `Grid` component (no dnd-kit overhead)
- Edit mode uses `SortableGrid` component (with dnd-kit)
- Saves ~40KB bundle when just viewing

**Lazy Loading:**
- Intersection Observer for images (200px preload margin)
- Priority mode for above-the-fold content
- Content visibility CSS for large lists

---

## Testing Strategy

### Test Pyramid

```
        ┌─────────┐
        │   E2E   │  ~50 tests (Playwright)
        │  Tests  │  Real browser, real APIs
        └─────────┘
      ┌─────────────┐
      │ Integration │  ~100 tests (Vitest)
      │    Tests    │  Real database
      └─────────────┘
    ┌─────────────────┐
    │   Unit Tests    │  ~2200 tests (Vitest)
    │   (Mocked deps) │  Fast, isolated
    └─────────────────┘
```

### Unit Tests (Vitest)

**Location:** `tests/unit/`

**What's mocked:**
- Prisma (via `vitest-mock-extended`)
- Email sending (Resend)
- Rate limiting (Upstash Redis)
- Google Drive API
- TMDB API

**Coverage:** Configured for `lib/**` only

**Run:**
```bash
pnpm run test              # Run all unit tests
pnpm run test:watch        # Watch mode
pnpm run test:coverage     # Coverage report
```

### Integration Tests (Vitest)

**Location:** `tests/integration/`

**Real dependencies:**
- PostgreSQL database (test database)
- Prisma queries hit real database

**Mocked:**
- External APIs (Google Drive, TMDB)
- Email sending
- Rate limiting (via `BYPASS_RATE_LIMIT=true`)

**Setup:**
- Database cleanup between tests
- Transaction rollback for isolation

**Run:**
```bash
pnpm run test:integration
```

### E2E Tests (Playwright)

**Location:** `e2e/journeys/`

**Pattern:** Page Object Model

**Test Accounts:**
- 4 seeded users (demo, filmfan, bingewatcher, scifi_jordan)
- Password: `SeedPassword123!` for all

**Real dependencies:**
- Full Next.js application
- Real PostgreSQL database
- Real Google Drive account (test account with refresh token)
- Real TMDB API (uses production API key)

**Fixtures:**
- `e2e/fixtures/auth.ts` - Authentication helpers
- `e2e/fixtures/database.ts` - Database setup/teardown
- `e2e/fixtures/google-drive.ts` - Drive API helpers

**Page Objects:**
- `e2e/pages/items-page.ts` - Items feature interactions
- `e2e/pages/profile-page.ts` - Profile interactions
- `e2e/pages/settings-page.ts` - Settings interactions

**Projects:**
- Desktop: Chromium 1920x1080
- Mobile: Chrome (iPhone 14) 390x844

**Run:**
```bash
pnpm run test:e2e                           # All tests
pnpm run test:e2e --project=chromium        # Desktop only
pnpm run test:e2e --project=mobile-chrome   # Mobile only
pnpm run test:e2e:debug                     # Debug mode (headed)
pnpm run test:e2e:ui                        # UI mode (interactive)
```

### Screenshot Automation

**Location:** `e2e/screenshots/`

35 portfolio screenshots for marketing/documentation:
- 9 main features
- 4 example libraries
- 4 dark mode variants
- 5 detail views
- 13 UI states

**Run:**
```bash
pnpm run screenshots
# or
npx playwright test --config=e2e/screenshots/playwright.config.ts
```

**Output:** `public/portfolio/*.png`

---

## Documentation Standards

All custom code follows JSDoc conventions (excluding `components/ui/*` shadcn components).

### File Headers

Every file starts with a brief comment:
```typescript
/**
 * Brief description of what this file does.
 * Optional second line for additional context.
 */
```

### Function Documentation

Standard JSDoc with `@param`, `@returns`, `@example`:
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

- **File headers:** Required for all files (lib, hooks, components, app pages)
- **Function JSDoc:** Required for exported functions and React components
- **`@example`:** Include for complex utilities and server actions; skip for simple functions
- **React props:** Document inline with TypeScript types, not JSDoc
- **Skip:** `components/ui/*` (shadcn generated code - don't document)

---

## Deployment

### Infrastructure

**Hosting:** Vercel
- Automatic deployments from git branches
- Edge network for static assets
- Serverless functions for API routes and Server Actions

**Database:** Neon PostgreSQL
- Serverless, auto-scaling
- Branch-per-environment (development, production)
- Connection pooling via Prisma

**Redis:** Upstash
- Rate limiting
- Serverless, pay-per-request

**Email:** Resend
- Transactional emails (password reset)
- React Email templates

### Branching Strategy

| Git Branch    | Neon Branch   | Vercel Environment |
| ------------- | ------------- | ------------------ |
| `development` | `development` | Preview            |
| `production`  | `production`  | Production         |

**Workflow:**
1. Local development → `development` branch → Vercel Preview
2. Merge to `production` → Vercel Production deployment
3. Database migrations run automatically on Vercel build

### Environment Variables

**Local:** `.env.local` (gitignored)
**Vercel:** Environment Variables in project settings

See [README.md](./README.md) for full environment variable list.

---

## Design Decisions

### Why Next.js Server Actions over API Routes?

**Chose Server Actions because:**
- Type-safe function calls (no need for fetch + JSON parsing)
- Automatic error handling with try/catch
- Simpler code (no need to define HTTP methods, headers, etc.)

**Use API Routes only for:**
- Streaming responses (Server Actions can't stream)
- Webhook endpoints

### Why Self-Referential Hierarchy over Nested Sets?

**Chose Self-Referential (parentId) because:**
- Simpler to understand and implement
- No need to update left/right values on every insert/move
- Good enough performance for expected tree depth (~10 levels max)

**Tradeoff:**
- Need DFS/BFS for tree operations (finding descendants, ancestors)
- Recursive CTEs for bulk delete

### Why Prisma over Raw SQL?

**Chose Prisma because:**
- Type-safe queries (catch errors at compile time)
- Automatic migrations with `prisma migrate`
- Great developer experience (autocomplete, IntelliSense)

**Tradeoff:**
- Slightly less performant than hand-tuned SQL
- Learning curve for complex queries

### Why NextAuth.js v5 over Stack Auth?

**Initially used Stack Auth:**
- Managed authentication service
- Easy setup, no boilerplate

**Migrated to NextAuth.js v5 because:**
- Hit rate limits on Stack Auth free tier
- Wanted full control over auth flow
- Self-hosted = no external dependencies

**Tradeoff:**
- More code to maintain (password hashing, session management)
- Added 15+ rate limiters via Upstash Redis

### Why Google Drive over SFTP?

**Initially built with SFTP:**
- Direct file access, no OAuth
- Simple path-based file matching

**Migrated to Google Drive because:**
- SFTP path-based matching created duplicates on rename/move (no stable IDs)
- No change detection API (had to scan entire directory tree)
- Read-only from web (no folder creation from UI)
- Google Drive solves all these: stable file IDs, Changes API, full read/write access

**Tradeoff:**
- More complex OAuth flow
- Need to handle token refresh, rate limits
- Batch API required for performance (100 ops per request)

### Why Incremental Seeding?

**Problem:** Full seeding took ~3 minutes for 4 users
**Solution:** SHA-256 hash of each user's seed config, skip unchanged users
**Result:** ~5s for 0 changes, ~30s for 1 user, ~3min for full rebuild

**Implementation:**
- Hash user definition (items, files, TMDB content)
- Store hash in `User.seedContentHash`
- Compare before seeding, skip if unchanged

### Why 90% Completion Threshold?

**Problem:** Users skip credits, marking items unwatched at 99%
**Solution:** 90% threshold counts as "watched"
**Result:** More accurate progress tracking

### Why Module-Level Cache for Search?

**Problem:** Spotlight search makes 3 parallel API calls every time it opens
**Solution:** 60-second TTL module-level cache
**Result:** Instant results on repeat searches (within 60s)

**Tradeoff:**
- Stale data for up to 60 seconds
- Acceptable for search (not critical data)

### Why Page Object Model for E2E Tests?

**Chose POM because:**
- Centralized selectors (change once, updates all tests)
- Reusable methods (`itemsPage.createItem()` used in 20+ tests)
- Easier to maintain than inline selectors

**Example:**
```typescript
// Instead of this in every test:
await page.getByRole("button", { name: /add item/i }).click();
await page.getByLabel(/name/i).fill("Movies");
await page.getByRole("button", { name: /create/i }).click();

// Use this:
await itemsPage.createItem("Movies");
```

---

That's the technical reference. For quick commands and setup, see [README.md](./README.md).
