# CanonCore - Technical Documentation

Last updated: February 2026 (v8.0.0)

This doc covers architecture, implementation patterns, and design decisions for CanonCore. Written as technical reference for understanding how everything works.

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Database Design](#database-design)
3. [API Design & Server Actions](#api-design--server-actions)
4. [Authentication & Security](#authentication--security)
5. [Feature Implementation](#feature-implementation)
6. [Performance](#performance)
7. [Observability & Error Handling](#observability--error-handling)
8. [SEO & Social Sharing](#seo--social-sharing)
9. [CI/CD Pipeline](#cicd-pipeline)
10. [Testing Strategy](#testing-strategy)
11. [Infrastructure](#infrastructure)
12. [Design Decisions](#design-decisions)

---

## System Architecture

### Stack

**Frontend:**

- Next.js 16 (App Router with Turbopack)
- React 19 (Server Components, Server Actions)
- TypeScript 5.9
- Tailwind CSS 4
- shadcn/ui (radix-ui primitives)
- dnd-kit for drag-and-drop
- Vidstack for media playback
- nuqs for URL state management
- Embla Carousel for swipeable tabs
- cmdk for spotlight search
- nanoid for share token generation

**Backend:**

- Next.js Server Actions (primary)
- API Routes (streaming endpoints only)
- Prisma 7 ORM
- PostgreSQL (Neon serverless)
- Upstash Redis (rate limiting)
- Sentry (error monitoring across client/server/edge)
- OpenTelemetry via @vercel/otel (distributed tracing)

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
│  ┌──────────┐  ┌───────────────┐       │
│  │  Sentry  │  │  OpenTelemetry│       │
│  │(errors)  │  │  (tracing)    │       │
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
- Seeding (seedContentHash for incremental updates)

**Item (hierarchical tree):**

- Self-referential: parentId → unlimited nesting
- Metadata: name, description, depth, order, pinnedOrder
- Visibility: isPublic, inheritVisibility
- Google Drive: driveFileId, syncStatus, driveModifiedAt, driveConnectionId
- TMDB: tmdbId, tmdbType, tmdbPosterPath, tmdbBackdropPath (CDN image paths)
- TMDB Display: 7 boolean fields (tmdbShowTagline, tmdbShowMetadata, tmdbShowGenres, tmdbShowCast, tmdbShowProviders, tmdbShowVideos, tmdbShowRecommendations) defaulting to true
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

**Playlist:**

- Cross-cutting reference list: name, description, order, isPublic
- Artwork: artworkImage (binary blob), artworkMime
- Sharing: shareToken (unique, nanoid-generated) for unlisted access
- Indexed: userId, userId+order, isPublic+updatedAt desc, shareToken

**PlaylistItem (join table):**

- Many-to-many between Playlist and Item with ordering
- Fields: order (for drag-to-reorder), addedAt
- Unique constraint: playlistId+itemId (no duplicates)
- Indexed: playlistId+order, itemId

**SyncLog:**

- Operation history: action (CREATE/RENAME/DELETE/MOVE/UPLOAD/etc)
- Status tracking: SUCCESS/FAILED/PENDING
- Performance: durationMs for each operation

**AuditLog:**

- Automatic mutation tracking via Prisma extension
- Fields: environment, database (hashed), model, action, recordId, userId, source, requestId
- Sensitive fields (password, token, secret) automatically redacted
- Fire-and-forget logging (non-blocking)
- 90-day retention production, 7-day development

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

    ┌────────────┐
    │ AuditLog   │
    ├────────────┤
    │ model      │
    │ action     │
    │ recordId   │
    │ userId     │
    │ changes    │
    └────────────┘

┌──────────────┐
│     User     │──┐ 1:N
└──────────────┘  │
            ┌─────▼──────┐
            │  Playlist  │
            ├────────────┤
            │ name       │
            │ description│
            │ isPublic   │
            │ shareToken │
            │ artwork    │
            └─────┬──────┘
                  │ 1:N
            ┌─────▼────────┐
            │PlaylistItem  │
            ├──────────────┤     N:1
            │ order        │────────── Item
            │ addedAt      │
            └──────────────┘
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
- `lib/playlist-actions.ts` - Playlist CRUD, artwork, share tokens, item membership, reordering
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
  auth(),
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

**`/api/playlist/artwork/route.ts`:**

- Playlist artwork upload (POST with multipart form data)
- Validates file type and size, stores as binary blob on Playlist model
- Rate limited, requires authentication

**`/api/health/route.ts`:**

- Database connectivity check for uptime monitors
- Returns 200 (healthy) or 503 (database unreachable)
- Excluded from rate limiting, no-cache headers

### Route Groups

**`app/(auth)/`:**

- Pages: sign-in, sign-up, forgot-password, reset-password
- Layout with redirect guard (authenticated users → home)

**`app/(public)/`:**

- Landing page, explore (tabbed: Collections/Playlists), user profiles (`/u/[username]`)
- Item detail pages (`/u/[username]/[itemId]`)
- Playlist detail pages (`/u/[username]/playlists/[playlistId]`) with share token support

**`app/(docs)/`:**

- Fumadocs documentation at `/docs`

---

## Authentication & Security

### NextAuth.js v5

**Credentials Provider:**

- Email/password auth (bcryptjs hashing, 12 rounds)
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
- Forgot/reset password: 2 requests/minute
- Item mutations: 30 requests/minute
- Playlist mutations: 30 requests/minute
- Search: 30-60 requests/minute per section
- API routes (artwork/stream/avatar/hero): 60 requests/minute
- Bot crawlers: 120 requests/minute

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

### Bot Protection

Multi-layer defence against aggressive AI crawlers:

**Layer 1 — robots.txt (Polite):**

- `app/robots.ts` dynamically generates robots.txt
- Blocks AI scrapers, allows search engines

**Layer 2 — Edge Blocking (Enforcement):**

- `proxy.ts` blocks non-compliant bots at edge with 403
- Zero compute cost (rejected before app logic)

**Layer 3 — Rate Limiting (Control):**

- Beneficial bots throttled to 120 req/min via Upstash Redis
- Key: IP + user-agent

**Bot Lists** (`lib/bot-patterns.ts`):

- Blocked (35+): GPTBot, ClaudeBot, Perplexity, Meta, SEO tools
- Allowed (7): Googlebot, Bingbot, Applebot, DuckDuckBot, Slurp, Yandex, Baiduspider

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

- Multi-select grouped checkboxes with active filter count badge
- File Status group: Has Files, No Files
- Sync Status group: Synced, Pending Sync, Sync Error
- AND logic across groups, OR within groups
- "Clear filters" button when filters are active

**URL State (nuqs):**

- Sort, filter, view mode, and tab persisted to URL query parameters
- Pattern: `?sort=name-asc&filter=has-files&view=grid&tab=contents`
- localStorage backup for direct navigation (no query params)
- Shareable/bookmarkable views

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

### Cinematic Hero

**CinematicHero Component:**

- Multi-mode: carousel (explore page), single-slide (item detail), profile avatar mode, custom backdrop (playlist detail)
- `backgroundElement` prop accepts custom React node rendered behind gradient overlay (used for mosaic tile backdrops)
- Auto-advance every 5 seconds with pause on hover
- Respects `prefers-reduced-motion` (disables autoplay, ken-burns effect)
- TMDB metadata display: tagline, year, runtime, genres, content rating, vote average
- Navigation dots with `role="tablist"` semantics
- Screen reader `aria-live` slide announcements
- Attribution text with optional linking via `attributionHref`

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

**Reconnect Banner:**

- Persistent amber banner when Drive connection needs reauthentication (`needsReauth`)
- Desktop: rendered in site header below breadcrumbs
- Mobile: fixed banner at top of viewport
- `role="alert"` and `aria-live="assertive"` for screen reader announcement

**Special Cases:**

- Trashed folder detection with recovery guidance
- Circuit breaker: 5 consecutive failures → 60s recovery period

### TMDB Metadata

**4-Step Wizard:**

1. Search by title, review description and metadata
2. Select poster from multiple options
3. Choose hero/backdrop image
4. Review and apply (selective field application)

**TV Show Support:**

- Episode picker: navigate shows → seasons → episodes
- "Use Show" applies show-level metadata, "Use Season" applies show-level
- Episode selection skips artwork steps (stills only, no poster/backdrop galleries)

**TMDB Display Options:**

- Per-item toggles: tagline, metadata, genres, cast, providers, videos (recommendations toggle soft-disabled)
- All default to true, configurable in item settings dialog
- Debounced save via `updateTmdbDisplayOptions` server action

**Artwork Handling:**

- TMDB poster/backdrop paths stored directly on items (`tmdbPosterPath`, `tmdbBackdropPath`)
- CDN-first resolution: TMDB CDN → Drive-hosted artwork → fallback icon
- Drive artwork used as fallback when no TMDB path available
- Wizard allows selecting specific poster/backdrop from TMDB image galleries

**Error Handling:**

- Circuit breaker: 5 failures → 60s recovery
- Graceful degradation if TMDB_API_KEY not set (manual metadata only)

### Spotlight Search

**Keyboard-First:**

- Press "/" to open from any page
- Escape to close, arrow keys to navigate

**Four Sections:**

1. Your Items (fuzzy search with breadcrumb paths)
2. Playlists (user's playlists with artwork and item counts)
3. Public Collections (all users' public items)
4. People (search users by username)

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

### Playlists

**Cross-Cutting Collections:**

- Many-to-many reference lists — items stay in their tree position and can appear in multiple playlists
- 14 server actions in `lib/playlist-actions.ts` following the same auth + rate limit + validation pattern
- Zod schemas for playlist name (1-255 chars), description (max 1000 chars), and artwork (max 5MB, image MIME types)

**Visibility Model:**

- Private (default) — only visible to the owner
- Public — discoverable on the Explore page's Playlists tab
- Unlisted — accessible only via share token URL (`?token=[nanoid]`)
- Share tokens generated with `nanoid` (21 chars), stored as unique index on `Playlist.shareToken`
- Regenerating a share token invalidates the previous link

**Artwork:**

- Binary blob storage on Playlist model (artworkImage + artworkMime)
- Upload via `/api/playlist/artwork` route (multipart form data)
- PlaylistGridItem shows a 4-poster collage mosaic when no custom artwork is set
- CardShell component provides shared visual base (glass background, border, hover glow)

**Drag-to-Reorder:**

- `PlaylistSortableGrid` uses dnd-kit for drag-to-reorder within playlists
- `reorderPlaylistItems` server action does batch order updates
- Same pattern as item reordering in SortableGrid

**Components:**

- `PlaylistGridItem` — poster collage card with up to 4 item artworks
- `PlaylistDetailClient` — full detail page with Contents/About tabs, edit mode toolbar
- `PlaylistSection` — reusable grid section with responsive columns
- `PlaylistSortableGrid` — dnd-kit drag-to-reorder for playlist items
- `PlaylistContextMenu` — right-click actions (edit, delete, visibility, share link)
- `CreatePlaylistDialog` / `EditPlaylistDialog` / `AddToPlaylistDialog` — CRUD dialogs

**URL State:**

- `use-playlist-url-state` — view, sort, filter, tab state for playlist detail pages
- `use-viewer-url-state` — tab and filter state for profile viewer mode
- `playlist-search-params` — nuqs parser definitions
- Pattern: `?view=grid&sort=custom&tab=contents`

**Integration Points:**

- Explore page: Collections/Playlists tabs with URL-backed tab state
- Profile page (viewer): Items/Playlists tabs
- Spotlight search: Playlists section with artwork thumbnails
- Sidebar: Playlists section with artwork and item counts
- CinematicHero: `backgroundElement` prop for mosaic backdrop on playlist detail pages

### Mobile Experience

**Bottom Sheets:**

- Replace desktop dialogs on mobile (< 1024px)
- `MobileItemSheet`: combines sort, filter, view, and settings
- `MobileAddItemSheet`: item creation with TMDB search
- `MobileOptionsSheet`: sort, filter, and view controls
- Swipe-to-dismiss gesture support

**Bottom Navigation:**

- Fixed footer: My Items, Explore, Search, Help, Account
- `aria-current="page"` on active items
- Safe area support for notched devices

**Swipeable Tabs:**

- Embla Carousel-powered horizontal swiping between tabs
- `SwipeableUnderlineTabs` for item detail (Contents/About)
- `role="tablist"` / `role="tabpanel"` semantics
- `inert` / `aria-hidden` on inactive panels

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

### Audit Logging

**Automatic Tracking:**

- Prisma Client Extension logs every mutation (create, update, delete)
- AsyncLocalStorage context passes userId, source, requestId through call stack
- Non-blocking fire-and-forget (doesn't fail main operation)

**Data Captured:**

- Environment, database (hashed), model, action, recordId
- userId, source (server action name), requestId
- Full changes payload (JSON, truncated for large values)

**Security:**

- Sensitive fields (password, token, secret) automatically redacted
- 90-day retention in production, 7-day in development

---

## Performance

### Server-Side

**Parallel Async Execution:**

```typescript
const [rateLimitResult, session, user] = await Promise.all([
  checkRateLimit("action", userId),
  auth(),
  prisma.user.findUnique({ where: { id: userId } }),
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
  },
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
  () =>
    import("./add-item-dialog").then((mod) => ({ default: mod.AddItemDialog })),
  { ssr: false }
);
```

**TMDB Promise Chaining:**
Resolution and metadata fetch chained as a single promise running concurrently with other server-side fetches. Eliminates sequential await waterfalls on explore and item detail pages.

**CSS Transitions over JS Animation:**
Sidebar animation migrated from framer-motion AnimatePresence to CSS `grid-template-rows` transition. Poster cards, tree items, and site header use specific `transition-property` instead of `transition-all`.

**useSyncExternalStore:**
Tab mount state uses `useSyncExternalStore` instead of `useState` + `useEffect` for synchronous hydration-safe reads.

**useMemo for Expensive Derivations:**

```typescript
const sortedItems = useMemo(() => sortItems(items, sortBy), [items, sortBy]);
const filteredItems = useMemo(
  () => filterItems(sortedItems, filterBy),
  [sortedItems, filterBy]
);
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

## Observability & Error Handling

### Error Monitoring — Sentry

Full-stack error tracking with three separate Sentry configurations for different runtimes:

**Client** (`sentry.client.config.ts`):

- Browser error tracking with session replay on errors
- 10% trace sampling in production, 100% in development
- Ignores expected errors: `NEXT_NOT_FOUND`, `NEXT_REDIRECT`, 429 rate limit responses

**Server** (`sentry.server.config.ts`):

- Node.js server component and API route error tracking
- Same trace sampling strategy as client

**Edge** (`sentry.edge.config.ts`):

- Edge middleware and edge API route error tracking

**Integration:**

- `instrumentation.ts` registers Sentry alongside OpenTelemetry, conditionally loading server or edge config based on `NEXT_RUNTIME`
- `onRequestError` hook captures unhandled request errors
- Source maps uploaded during build and deleted afterward (readable stack traces without serving maps to browsers)
- Sentry requests tunnelled through `/monitoring` to bypass ad-blockers
- Gracefully disabled when `NEXT_PUBLIC_SENTRY_DSN` is not set

### Error Boundaries

Layered error boundary hierarchy catches failures at appropriate scope:

```
app/global-error.tsx          ← Root layout failures (standalone HTML)
├── app/(auth)/error.tsx      ← Auth route failures (retry + sign-in link)
├── app/(public)/error.tsx    ← Public route failures (retry + explore link)
├── app/not-found.tsx         ← Application-wide 404 (home + explore links)
└── app/(public)/not-found.tsx ← Public route 404 (profile/item not found)
```

Every error boundary reports to Sentry via `useEffect`. The global error boundary renders standalone HTML (no layout dependency) with inline styles for the dark theme.

### Distributed Tracing — OpenTelemetry

`@vercel/otel` registered in the Next.js instrumentation hook provides distributed tracing across server components, API routes, and middleware. Service name: `canoncore`.

### Performance Monitoring — Speed Insights

Vercel Speed Insights tracks Core Web Vitals (LCP, FID, CLS, TTFB) in production. Loaded via `next/dynamic` alongside Vercel Analytics in the deferred analytics component, keeping performance tracking out of the critical rendering path.

### Health Check

`/api/health` endpoint for uptime monitors:

- `GET` returns `200` with `{ status: "ok", database: "connected" }` when healthy
- Returns `503` with `{ status: "error", database: "disconnected" }` when database unreachable
- No-cache headers prevent stale monitoring responses
- Excluded from rate limiting

---

## SEO & Social Sharing

### Dynamic Sitemap

`app/sitemap.ts` generates a comprehensive sitemap with three categories:

- **Static pages** — landing, explore, docs (with priority and change frequency)
- **Public profiles** — all users with `isPublic: true` and a username, with `lastModified` dates
- **Public items** — explicitly public items (not inheriting) from public users, with `lastModified` dates
- **Public playlists** — public playlists from public users, with `lastModified` dates

Profile and item queries run in parallel for performance.

### Dynamic OpenGraph Images

Server-side generated OG images using Next.js `ImageResponse` (Satori):

**Default** (`app/opengraph-image.tsx`):

- Edge runtime for fast generation
- CanonCore branding with cinematic gradient background
- 1200x630px PNG

**Profile** (`app/(public)/u/[username]/opengraph-image.tsx`):

- Node.js runtime (requires Prisma)
- Shows avatar initial, display name, public item count
- Falls back gracefully for non-existent users

**Item** (`app/(public)/u/[username]/[itemId]/opengraph-image.tsx`):

- Node.js runtime (requires Prisma)
- Shows item name, truncated description, owner name
- TMDB backdrop overlay at 30% opacity when available

**Playlist** (`app/(public)/u/[username]/playlists/[playlistId]/opengraph-image.tsx`):

- Node.js runtime (requires Prisma)
- Shows playlist name, description, item count, owner name
- Playlist artwork as background when available

### JSON-LD Structured Data

Schema.org markup on three page types:

- **Landing page** — `WebApplication` schema with name, URL, category
- **Profile pages** — `Person` schema with name and profile URL
- **Item detail pages** — `Movie` or `TVSeries` schema (based on `tmdbType`) with genre, poster image, and `AggregateRating` from TMDB vote data
- **Playlist detail pages** — `CollectionPage` schema with playlist name, description, and item count

All JSON-LD output sanitised with `replace(/</g, "\\u003c")` to prevent XSS via script injection.

### Twitter Cards

`summary_large_image` card type set in root layout metadata and explore page metadata. Combined with the dynamic OG images, shared links display rich preview cards across Twitter, Discord, Slack, and other platforms.

---

## CI/CD Pipeline

### GitHub Actions

Three-job pipeline in `.github/workflows/ci.yml`:

```
┌──────────────┐
│ Quality Gate │  Format check, lint, type check, knip
└──────┬───────┘
       │ depends on
  ┌────┴────┐
  ▼         ▼
┌──────┐ ┌───────┐
│Tests │ │ Build │  Run in parallel
└──────┘ └───────┘
```

**Quality Gate** — runs format:check, lint, type-check, and knip (unused code detection). Uses a dummy `DATABASE_URL` since no database access needed.

**Tests** — unit tests and integration tests against real PostgreSQL via `E2E_DATABASE_URL` secret. Depends on quality gate passing.

**Build** — production build verification. Depends on quality gate passing. Runs in parallel with tests.

**Triggers:** Push to `development`/`production` branches and all PRs targeting those branches. Concurrency groups cancel in-progress runs for the same ref (except production pushes, which always complete).

### Pre-commit Hooks

Husky manages Git hooks:

- **pre-commit** — lint-staged runs ESLint (`--fix`) and Prettier (`--write`) on staged `.ts`/`.tsx` files, and Prettier on staged `.json`/`.md`/`.css` files
- **commit-msg** — commitlint enforces [Conventional Commits](https://www.conventionalcommits.org/) format (feat:, fix:, chore:, etc.)

---

## Testing Strategy

### Test Pyramid

```
          ┌─────────┐
          ┌─────────┐
          │   E2E   │  34 spec files (Playwright)
          │  Tests  │  Real browser, real APIs
          └─────────┘
        ┌─────────────┐
        │  Storybook  │  66 stories
        │  Component  │  axe a11y + interactions
        └─────────────┘
      ┌─────────────────┐
      │  Integration    │  ~200 tests (Vitest)
      │     Tests       │  Real database
      └─────────────────┘
    ┌─────────────────────┐
    │     Unit Tests      │  ~2800 tests (Vitest)
    │    (Mocked deps)    │  Fast, isolated
    └─────────────────────┘
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

### Storybook Component Tests

**Location:** Co-located `*.stories.tsx` files (66 stories)

**What's tested:**

- Accessibility: Every story tested against axe-core with `test: "error"` in `preview.tsx` — any a11y violation fails the build
- Interaction tests: `play` functions verify tab switching, keyboard navigation, dialog flows, dropdown selection
- Visual variants: Default states, edge cases, boundary conditions (e.g. 3 tabs = swipeable, 4 tabs = select dropdown)

**Key patterns:**

- Portal dialogs tested with `within(document.body)` instead of `canvasElement` (Radix portals render outside story root)
- Embla Carousel initialisation: Click active tab first to trigger React render cycle before asserting on target tab
- MSW mocking in `.storybook/mocks/` for server actions (items, TMDB, Drive, auth)
- Decorators: Theme (dark only), auth state, reduced motion

### E2E Tests (Playwright)

**Location:** `e2e/journeys/` (34 spec files)

**Pattern:** Page Object Model with composable fixtures

**Test Accounts:**

- 3 seeded users (demo, filmfan for screenshots; testuser for E2E)
- Password: `SeedPassword123!` for all
- Per-test user creation via `authenticated.fixture.ts` (unique user per test, cleaned up after)

**Real dependencies:**

- Full Next.js application (webServer block starts dev server)
- Real PostgreSQL database (E2E branch via `E2E_DATABASE_URL`)
- Real TMDB API (uses production API key)

**Fixtures:**

- `e2e/fixtures/authenticated.fixture.ts` - Per-test user creation, browser auth injection, cleanup
- `e2e/fixtures/public.fixture.ts` - Unauthenticated tests (landing, explore, sign-in/up)
- `e2e/fixtures/drive.fixture.ts` - Drive-specific test fixture
- `e2e/fixtures/index.ts` - Composed fixture wiring all POMs as fixture properties

**Page Objects (16 focused POMs):**

- `auth.page.ts` - Sign-in, sign-up, forgot/reset password
- `explore.page.ts` - Explore carousel, grid, filtering
- `item-detail.page.ts` - Item detail hero, tabs, metadata
- `items-crud.page.ts` - Create, delete, empty state, counts
- `items-drag.page.ts` - Grid and tree drag-and-drop
- `items-hierarchy.page.ts` - Parent/child navigation, breadcrumbs
- `items-pinned.page.ts` - Pin/unpin, sidebar list
- `items-settings.page.ts` - Item settings dialog
- `items-sort-filter.page.ts` - Sort, filter, view toggle
- `media.page.ts` - Media player overlay
- `nav.page.ts` - Sidebar, header, mobile footer
- `public-profile.page.ts` - Public profile, fork button
- `settings.page.ts` - Profile settings tabs
- `spotlight.page.ts` - Spotlight search dialog
- `tmdb-wizard.page.ts` - TMDB metadata wizard
- `playlist.page.ts` - Playlist CRUD, items, visibility

**Config:**

- `e2e/config/timeouts.ts` - Centralised timeout constants (animation, navigation, api, upload, heavy)
- `e2e/config/test-data.ts` - Collision-free test data (UUID-based IDs, emails, usernames)

**Projects:**

- Desktop: Chrome (Desktop Chrome)
- Mobile: Chrome (Pixel 7)

**Selectors:**

- Curated `data-testid` attributes on ~30 components (~85 testids)
- `slugify()` utility for deterministic item testids: `item-card-${slug}`, `item-tree-${slug}`
- Unit tests use role-based and text-based selectors (Testing Library best practices)

### Screenshot Automation

Portfolio screenshots for marketing/documentation using POM patterns and fixtures. Outputs to `public/portfolio/*.png`.

---

## Infrastructure

**Hosting:** Vercel — automatic deployments, edge network, serverless functions

**Database:** Neon PostgreSQL — serverless, auto-scaling, branch-per-environment

**Redis:** Upstash — rate limiting, serverless, pay-per-request

**Email:** Resend — transactional emails (password reset)

**Error Monitoring:** Sentry — client, server, and edge error tracking with session replay

**Tracing:** OpenTelemetry via @vercel/otel — distributed tracing across all runtimes

**Performance:** Vercel Speed Insights — Core Web Vitals monitoring (LCP, FID, CLS, TTFB)

**CI/CD:** GitHub Actions — quality gate, tests, and build verification on every push and PR

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
- Added 20+ rate limiters via Upstash Redis

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

### Why Cross-Cutting Playlists over Nested Playlists?

**Chose Many-to-Many Reference Lists because:**

- Items stay in their tree position — no moving or duplicating required
- One item can appear in multiple playlists (e.g. "Weekend Watchlist" + "Best Horror")
- Playlists have independent visibility from the item hierarchy (private/public/unlisted)
- Share tokens enable unlisted sharing without making the playlist fully public

**Tradeoff:**

- Join table (PlaylistItem) adds complexity vs simple parent-child
- Need separate reordering logic for playlist item order vs tree order
- Artwork resolution falls back through: custom upload → 4-poster collage → empty state

### Why Page Object Model for E2E Tests?

**Chose POM because:**

- Centralised selectors (change once, updates all tests)
- 16 focused POMs replace monolithic page objects (single-responsibility per feature area)
- Reusable methods (`itemsCrud.createItem()` used across multiple tests)
- Composable fixtures wire POMs as properties — tests destructure only what they need
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

That's the technical reference. For a product overview, see [README.md](./README.md).
