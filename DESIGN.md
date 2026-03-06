# CanonCore - Technical Documentation

Last updated: March 2026 (v12.2.0)

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
- Font Awesome 7 for icons (`@fortawesome/react-fontawesome`)
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
- Profile (username, isPublic, image/heroImage blobs, bio VARCHAR(300))
- Security hardening (tokenVersion for JWT invalidation, failedLoginAttempts, lockedUntil for account lockout)
- Seeding (seedContentHash for incremental updates)

**Item (hierarchical tree):**

- Self-referential: parentId → unlimited nesting
- Metadata: name, description, depth, order, pinnedOrder
- Visibility: isPublic, inheritVisibility
- Google Drive: driveFileId, syncStatus, driveModifiedAt, driveConnectionId
- TMDB: tmdbId, tmdbType, tmdbPosterPath, tmdbBackdropPath, tmdbLogoPath (CDN image paths)
- Visual pipeline: dominantColour (hex string extracted from backdrop for page-level colour theming)
- TMDB Display: 7 boolean fields (tmdbShowTagline, tmdbShowMetadata, tmdbShowGenres, tmdbShowCast, tmdbShowProviders, tmdbShowVideos, tmdbShowRecommendations) defaulting to true
- Forking: forkedFromId to track copies

**ItemFile:**

- File types: MEDIA (video/audio), ARTWORK (images), SUBTITLE (srt/vtt/etc)
- Google Drive: driveFileId, filename, mimeType, size
- Playback: playbackPosition (in seconds), isPrimary, isHero, isLogo

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
- System playlists: systemType (nullable SystemPlaylistType), shelfOrder (nullable Int)
- Unique constraint: @@unique([userId, systemType]) prevents duplicate system playlists per user
- Indexed: userId, userId+order, isPublic+updatedAt desc, shareToken

**PlaylistItem (join table):**

- Many-to-many between Playlist and Item with ordering
- Fields: order (for drag-to-reorder), addedAt
- Unique constraint: playlistId+itemId (no duplicates)
- Indexed: playlistId+order, itemId

**WatchRecord:**

- Tracks watch events per item per user
- Fields: itemId, userId, source (WatchSource enum: AUTO/MANUAL), watchedAt
- AUTO: triggered when playback crosses 80% threshold
- MANUAL: triggered by explicit user action (mark as watched)
- Composite indexes: [userId, watchedAt DESC], [itemId, userId, watchedAt DESC]

**Enums:**

- `WatchSource`: AUTO (playback scrobble) | MANUAL (user action)
- `SystemPlaylistType`: CONTINUE_WATCHING | WATCHLIST | RECENTLY_ADDED | WATCH_AGAIN

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
┌────────────────────┐
│       User         │
├────────────────────┤
│ id                 │──┐
│ email              │  │ 1:1
│ passwordHash       │  ├─────────┐
│ username           │  │         │
│ isPublic           │  │         ▼
│ bio                │  │  ┌─────────────────────┐
│ tokenVersion       │  │  │GoogleDriveConnection│
│ failedLoginAttempts│  │  ├─────────────────────┤
│ lockedUntil        │  │  │ accessToken (enc)   │
│ image (blob)       │  │  │ refreshToken (enc)  │
└────────────────────┘  │  │ rootFolderId        │
                        │  │ quotaBytesUsed      │
              1:N       │  └─────────────────────┘
              │         │
          ┌───▼─────┐   │
    │  Item   │◄──┘
    ├─────────┤
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
    │ isLogo   │
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
            │ systemType │
            │ shelfOrder │
            └─────┬──────┘
                  │ 1:N
            ┌─────▼────────┐
            │PlaylistItem  │
            ├──────────────┤     N:1
            │ order        │────────── Item
            │ addedAt      │
            └──────────────┘

┌──────────────┐         ┌──────────────┐
│     User     │──┐ 1:N  │     Item     │
└──────────────┘  │      └──────┬───────┘
            ┌─────▼────────┐    │ 1:N
            │ WatchRecord  │◄───┘
            ├──────────────┤
            │ source       │ (AUTO/MANUAL)
            │ watchedAt    │
            └──────────────┘

┌──────────────┐         ┌───────────────────────────┐
│     User     │──┐ 1:N  │  EmailVerificationToken   │
└──────────────┘  │      ├───────────────────────────┤
                  └─────▶│ token (unique)            │
                         │ email                     │
                         │ expires                   │
                         └───────────────────────────┘
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

**Progress Tracking (`ItemFile.playbackPosition` + `WatchRecord`):**

- Per-file tracking (needed for TV episodes, multi-file movies)
- 80% completion threshold counts as "watched" (Trakt standard, accounts for credits and post-credits scenes)
- Watch status tracked via WatchRecord existence, not playbackPosition percentage
- DFS traversal to find first incomplete item in hierarchy

**Why WatchRecord over Playback Position?**

- Separates "has watched" (WatchRecord) from "current position" (playbackPosition) — two distinct concepts
- Enables play count tracking (multiple WatchRecords per item)
- Supports both auto-scrobble (playback crosses 80%) and manual marking (user action)
- 5-minute deduplication window prevents duplicate scrobbles from rapid playback events

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
- `lib/tmdb-actions.ts` - Metadata search, image fetching, per-field clearing, display options
- `lib/auth-actions.ts` - Sign up, forgot password, reset password, email verification, lockout check
- `lib/user-actions.ts` - Profile updates, image uploads, account deletion, data export
- `lib/fork-actions.ts` - Forking collections
- `lib/watch-actions.ts` - Watch status (create, mark, unmark, batch, status query)
- `lib/shelf-actions.ts` - Home shelf CRUD and data fetching

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
- Fumadocs documentation at `/docs` (shared ContentLayout)
- Legal pages at `/legal` (privacy policy, terms of service, cookie policy)

**`app/verify-email/`:**

- Email verification landing page (outside auth route group — works for both authenticated email changes and unauthenticated signup verification)
- Validates token from URL params, handles signup verification and email change flows

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
- Watch actions: 30 requests/minute
- Shelf mutations: 30 requests/minute
- Search: 30-60 requests/minute per section
- Account deletion: 3 requests/hour
- Data export: 5 requests/hour
- API routes (artwork/stream/avatar/hero): 60 requests/minute
- Bot crawlers: 120 requests/minute

Implementation in `lib/rate-limit.ts` with exponential backoff.

### Security Features

**Account Lockout:**

- 5 consecutive failed login attempts → 15-minute lockout
- Pure functions in `lib/lockout-utils.ts`: `isAccountLocked()`, `handleFailedLogin()`, `handleSuccessfulLogin()`
- Authorize callback checks lockout before password verification
- Anti-enumeration: `checkSignInStatus()` returns `{ status: "ok" }` for unknown emails

**Email Verification:**

- `EmailVerificationToken` model with 30-minute expiry
- Signup sends verification email via Resend (non-blocking)
- Email changes create verification token instead of updating directly
- Verification landing page at `/verify-email` handles both signup and email change flows
- Nudge banner in SiteHeader with resend button for unverified users

**JWT Token Version Invalidation:**

- `User.tokenVersion` (Int, default 0) incremented on password reset and change
- JWT callback stores tokenVersion on sign-in, checks against DB on subsequent requests
- Version mismatch clears `token.id` → session callback skips user population → forced sign-out
- Closes the stale-session gap inherent in stateless JWTs

**Password Reset:**

- 30-minute expiry tokens stored in database
- Sent via Resend transactional email
- Tokens hashed before storage
- Now increments `tokenVersion` to invalidate existing sessions

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

**Visibility at Creation:**

- `AddItemDialog` includes "Make public" switch (all items) and "Inherit from parent" switch (child items only, defaults ON)
- When inherit is ON, the public toggle is disabled — the child follows its parent's visibility
- `createItem` server action accepts optional `{ isPublic, inheritVisibility }`, validated via `createItemOptionsSchema`
- Root items cannot have `inheritVisibility: true` (server-side validation rejection)
- Visibility options flow through `onAddChild` callback across `ItemContextMenu`, `GridViewContent`, `SortableTree`, `ShelfRow`, and `ItemsView`

**View Modes:**

- Grid: Movie poster cards with progress bars (Netflix-style). Cards stay elevated (`z-10`, `scale-105`, shadow) while Radix dropdown is open via `has-[[data-state=open]]` CSS selectors. More-options button appears on hover/focus-within.
- Tree: Hierarchical list showing all descendants. Trailing action area shows Drive sync icon by default, swaps to more-options button on hover via paired opacity transitions.

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

- 80% completion threshold for "watched" (Trakt standard)
- Watch status tracked via WatchRecord existence (not playbackPosition percentage)
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
- **Responsive layout**: Mobile uses flex layout with `min-height` — content flows naturally below the backdrop via `mt-auto`, growing the hero to fit. Desktop keeps the fixed-height overlay (`lg:absolute lg:bottom-0`). Carousel backdrop is `absolute inset-0` on all viewports
- `backgroundElement` prop accepts custom React node rendered behind gradient overlay (used for mosaic tile backdrops)
- Embla Carousel fade plugin for smooth crossfade transitions between slides (replaces slide-based animation)
- Auto-advance every 5 seconds with pause on hover
- Respects `prefers-reduced-motion` (disables autoplay, ken-burns effect)
- TMDB metadata display: tagline, year, runtime, genres, content rating, vote average
- Navigation dots with `role="tablist"` semantics
- Screen reader `aria-live` slide announcements
- Attribution moved into `MetadataLine` component (inline with year, runtime, genres, sync status)
- Sync status indicators inline in metadata line: SYNCED (check icon), SYNCING (animated spinner), PENDING (dot), ERROR (warning triangle). `HeroSlide` type extended with optional `syncStatus` and `driveFileId`. Explore page fetches sync data server-side, filtered to current user's own items only (privacy).

**Cinematic Visual Pipeline:**

Each item can have a dominant colour extracted from its backdrop, used to theme the entire page. The pipeline works in four stages:

1. **Extraction** — `extractDominantColour()` in `lib/colour-extract.ts` uses sharp's `stats()` API for colour frequency analysis (more accurate than 1×1 resize averaging). Accepts a Buffer (uploaded images) or URL string (TMDB images). `boostSaturation()` ensures the result is vibrant enough for theming: minimum 40% saturation with 1.5× boost, lightness clamped to 25% maximum so bright backdrops stay dark.

2. **Shading** — `createColourShades(hex)` in `lib/colour-utils.ts` generates 10 shades from one colour. Shades 100–700 lerp from white towards the input colour. Shades 800–1000 lerp from the input colour towards black. Shade 700 ≈ the input. All pure math, no external dependencies — safe for client bundles.

3. **CSS Registration** — 10 `@property` rules in `globals.css` register `--dark-100` through `--dark-1000` as `<color>` type with `inherits: true`. Without `@property`, CSS custom properties are strings and can't animate — registration gives the browser type information to interpolate between colour values. Initial values match the neutral dark theme so un-themed pages look normal.

4. **Injection** — `CinematicHero` calls `createColourShades()` with the active slide's `dominantColour`, spreads the result as inline `style` on the section element, and adds the `.transition-colours-pipeline` class. This class transitions all 10 properties at 500ms ease, producing a smooth crossfade as the carousel advances. Hero overlay gradients use `color-mix(in srgb, var(--dark-900) N%, transparent)` instead of hardcoded `rgba()` values, resolving from the hero's own colour scope.

`HeroContentLayout` wraps the entire page below the hero, accepting a `dominantColour` prop and an `animateColour` boolean that conditionally enables the 500ms colour crossfade (only used by the explore page's multi-slide carousel — single-slide pages apply colour instantly). Explore page tracks the active colour via `onColourChange` callback and passes it down.

**Logo Overlay:**

TMDB logos are transparent title treatment images (usually PNG) displayed in the hero instead of text titles:

- `TMDBImages` type extended with `logos: TMDBImage[]` array
- `getBestLogo()` prioritises English logos, then highest vote average
- `CinematicHero` renders logo with `next/image`, responsive `max-w`/`max-h` constraints, and `object-contain` + `object-left` for left-aligned display
- Per-slide `logoErrorIds` state tracks failed logo loads — text title fallback only suppresses the logo for the specific slide that errored
- Logo resolution priority: manual `isLogo` artwork file > `tmdbLogoPath` > text title fallback
- `LogoThumbnail` shared component renders transparent PNGs on `#0a0a0a` background with selection state, loading placeholder, and badge content via children

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

**5-Step Wizard (movies/shows):**

1. Search by title, review description and metadata
2. Select poster from multiple options
3. Choose hero/backdrop image
4. Pick a logo title treatment (with skip option)
5. Review and apply (selective field application, auto-extracts dominant colour and selects best logo)

**TV Show Support:**

- Episode picker: navigate shows → seasons → episodes
- "Use Show" applies show-level metadata, "Use Season" applies show-level
- Episode selection skips artwork steps (stills only, no poster/backdrop galleries)

**Per-Field Artwork Editing:**

After initial wizard application, individual artwork fields (poster, backdrop, logo, episode still) can be changed in isolation:

- `TmdbArtworkChangeDialog` opens an image gallery scoped to a single field
- Fetches images via `getImagesAction`, `getSeasonImagesAction`, or `getEpisodeImagesAction`
- `AnimatedDialogContent` slot API provides smooth loading → gallery transitions
- Content-type-aware: movies show poster + backdrop + logo, TV shows show poster + backdrop + logo, seasons show poster only, episodes show still only
- Logo change dialog uses `LogoSelectionGrid` (simplified grid without tabs/skip) instead of `ImageSelectionGrid`

**Inline Detach:**

- `TmdbSourceField` on the Details tab shows the linked TMDB source with an inline trash icon
- Detach calls `clearTmdbFieldAction(itemId, "all")` which clears tmdbId, tmdbType, all paths, and resets display options to defaults
- Preserves item name and description
- Individual field clearing via `clearTmdbFieldAction(itemId, "poster" | "backdrop" | "logo")` removes a single artwork path

**Component Architecture:**

- `TmdbSourceField` — Details tab, shows linked source with poster thumbnail, type badge, and inline detach
- `TmdbMetadataSection` — TMDB tab container, renders artwork fields based on content type
- `TmdbArtworkField` — per-field artwork display with change/clear actions, mirrors `FileTypeCombobox` DOM structure
- `TmdbArtworkChangeDialog` — modal image gallery picker with apply/cancel
- All components share visual parity with `FileTypeCombobox` (7px icon circle, label hierarchy, outline buttons, inline action icons)

**Shared Form State:**

- `useItemSettingsForm` hook centralises 20+ form fields, handlers, and wizard navigation state
- Shared between `ItemSettingsDialog` (desktop) and `MobileItemSheet` (mobile) — identical logic, different UX surfaces
- `useSettingsDialog` hook wraps file fetching and dialog lifecycle
- Memoised computations prevent unnecessary wizard re-renders

**Override Badges:**

- `FileTypeCombobox` accepts a `note` prop for override indicators
- When TMDB artwork is set, badge text reads "Currently using TMDB poster. Upload to override."
- `TmdbArtworkField` shows matching badge when an uploaded file overrides TMDB artwork

**TMDB Display Options:**

- Per-item toggles: tagline, metadata, genres, cast, providers, videos, recommendations
- All default to true, configurable in item settings TMDB tab
- `updateTmdbDisplayOptions` server action with `tmdbDisplayOptionsSchema` validation
- Changes save automatically — no need to click Save

**Artwork Handling:**

- TMDB poster/backdrop/logo paths stored directly on items (`tmdbPosterPath`, `tmdbBackdropPath`, `tmdbLogoPath`)
- CDN-first resolution: TMDB CDN → Drive-hosted artwork → fallback icon
- Logo resolution: manual `isLogo` artwork file → TMDB logo path → text title fallback
- Drive artwork used as fallback when no TMDB path available
- Wizard allows selecting specific poster/backdrop/logo from TMDB image galleries
- `applyMetadataAction` auto-extracts dominant colour from backdrop and auto-selects best English logo during metadata application
- Dominant colour stored as hex string on `Item.dominantColour` for page-level colour theming

**Error Handling:**

- Circuit breaker: 5 failures → 60s recovery
- Graceful degradation if TMDB_API_KEY not set (manual metadata only)
- `TmdbArtworkChangeDialog` shows actionable error messages ("Try closing and reopening the dialog.")

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
- Share tokens generated eagerly with `nanoid(21)` at playlist creation time — playlists are immediately shareable via link when switched to unlisted
- Regenerating a share token invalidates the previous link

**Creation Flow:**

- `CreatePlaylistDialog` uses a 3-option RadioGroup (Private/Unlisted/Public) with icon labels, replacing the earlier binary public Switch
- Optional item pre-selection via `ItemTreePicker` (multi-select, virtualised, searchable)
- `createPlaylist` accepts optional `itemIds` — uses Prisma `$transaction` for ownership verification + `PlaylistItem` row creation
- Validated via `createPlaylistItemsSchema` (max 500 items)
- `ItemTreePicker` shared with `ForkDestinationDialog` (single-select mode) — extracted from inline virtualisation code

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
- `CreatePlaylistDialog` / `EditPlaylistDialog` / `AddToPlaylistDialog` — CRUD dialogs (CreatePlaylistDialog includes visibility RadioGroup and ItemTreePicker for item pre-selection)
- `ItemTreePicker` — shared virtualised tree picker (`@tanstack/react-virtual`), supports single-select (fork) and multi-select (playlist) modes with search filtering

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

### Watch Status Tracking

**WatchRecord Model:**

- Two sources: AUTO (playback reaches 80% threshold) and MANUAL (explicit user action)
- Auto-scrobble: `updatePlaybackPosition` checks threshold, calls `createWatchRecordIfNotRecent`
- Deduplication: 5-minute window prevents rapid duplicate scrobbles from repeated playback events
- Manual actions: mark as watched (creates WatchRecord), mark as unwatched (removes most recent record, preserves history)
- Batch operations: `markAllWatched` / `markAllUnwatched` use recursive CTEs for hierarchy traversal
- `getWatchStatus`: read-only query, no rate limiting (auth check only)
- Server actions in `lib/watch-actions.ts`, shared utility in `lib/watch-record-utils.ts`

### Home Shelves

**Configurable Shelf Rows:**

- Horizontal scroll rows on the authenticated home page
- Any playlist with a non-null `shelfOrder` appears as a shelf
- System playlists (Continue Watching, Watchlist, Recently Added, Watch Again) are virtual — computed at query time, not stored as PlaylistItem rows
- System playlists created per user via `ensureSystemPlaylists()` (idempotent, `skipDuplicates`)
- `SHELF_LIMIT = 10` items per shelf

**Continue Watching Query:**

- Raw SQL merging two sources: (1) resume items — `playbackPosition > 0` with no WatchRecord, (2) up-next items — first unwatched child in series with at least one watched child
- Deduplicated and sorted by recency

**Shelf Configuration:**

- Add/remove/reorder any playlist as a shelf
- System playlists can be toggled on/off like user-created playlists
- `@@unique([userId, systemType])` prevents duplicates; `skipDuplicates` handles race conditions

**Components:**

- `home-shelves.tsx` — Server component, renders shelf sections
- `shelf-row.tsx` — Client component with horizontal scroll, gradient fades, snap scroll, arrow key navigation
- `shelf-settings.tsx` — Configuration panel for managing shelf visibility and order
- Shelf cards use the shared `GridItem` component — not a custom card

**ShelfItem Type:**

- Minimal for server serialisation: `{ id, name, tmdbPosterPath, artworkId, childCount, playbackProgress }`
- Intentionally lighter than `ItemWithArtwork`

### Homepage

**Payload-Inspired Layout:**

The landing page uses a full-bleed animated mesh gradient background (`@mesh-gradient/react`) with a grid overlay and CRT scanline effect. The background is sticky (`position: sticky; top: 0`) and content scrolls over it with a negative top margin.

**CSS Modules + Container Queries:**

Hero section and media stack use CSS Modules (`hero-section.module.css`, `media-stack.module.css`) with container queries instead of viewport queries. Container queries respond to the component's container width — when the sidebar is open, the layout adapts without needing sidebar-aware viewport breakpoints. This mirrors Payload CMS's 16-column grid system.

- Mobile-first 8-column grid, 16-column on `@container (min-width: 1024px)`
- `--gutter-h` and `--column` CSS variables for Payload-style column sizing
- `container-type: inline-size` on the hero wrapper enables container query evaluation

**Sections:**

- `HeroSection` — 16-col grid with headline (cols 1-4 desktop, full mobile), media stack (cols 8-16 desktop), command-line terminal pill, and logo showcase
- `MediaStack` — Server component (no `"use client"`), pure CSS animations via `@keyframes stackFadeIn`, column-based sizing via inherited `--column` variable, glass morphism, `prefers-reduced-motion: reduce` support
- `FeatureAccordion` — Expandable feature list with image crossfade using `AnimatePresence` and `m.div` opacity transitions
- `ManifestoCta` — Closing manifesto with gradient text and dual CTAs

**Performance:**

- `MediaStack` is a server component — zero client JavaScript for the image stack (CSS-only animation)
- `LazyMotion` wraps remaining animated content with `strict` mode. Child components use `m` from `motion/react-m` (not `motion` from `motion/react`). Feature bundle (~15KB `domAnimation`) loaded async from `lib/motion-features.ts`.
- CSS-generated noise texture via inline SVG `feTurbulence` data URI replaces a 328KB PNG
- All images use `next/image` with `sizes` props; Media stack IMAGE_1 has `priority` (LCP candidate)
- `MeshGradient` must be imported statically — dynamic import causes a 616ms TBT regression
- `auth()` deduplicated via `React.cache()` to prevent redundant JWT decode per request
- Desktop Lighthouse: Performance 96, LCP 1.3s, SI 0.9s, TBT 0ms, total bytes 1,161 KiB (65% reduction)

### Legal Pages

**Content:**

- Privacy Policy, Terms of Service, Cookie Policy as MDX in `content/legal/`
- Rendered via a second Fumadocs collection (`legal` in `source.config.ts`, `legalSource` in `lib/source.ts`)
- Route: `app/(public)/legal/[[...slug]]/page.tsx`
- Shared `ContentLayout` component extracted from docs layout for consistent styling

**Integration Points:**

- Sidebar: Collapsible "Legal" section in `nav-main.tsx` with Privacy Policy, Terms of Service, Cookie Policy links
- Auth pages: Terms and privacy links in sign-up form footer
- Public layout: Legal links in site footer
- Sitemap: Legal pages included in `app/sitemap.ts`

### Sidebar Navigation

**Collapsible Sections:**

- `NavCollapsibleItem` component (`components/nav-collapsible-item.tsx`) supports link mode and toggle mode
- Link mode (`href` provided): label navigates, separate chevron action toggles sub-items
- Toggle mode (no `href`): clicking label toggles collapse
- "Get Help" renders as link mode with doc section sub-items, collapsed by default
- "Legal" renders as toggle mode with legal page sub-items, collapsed by default
- "My Items" uses link mode with pinned items as sub-items when pinned items exist

### Mobile Experience

**Bottom Sheets:**

- Replace desktop dialogs on mobile (< 1024px)
- `MobileItemSheet`: combines sort, filter, view, and settings (shares `useItemSettingsForm` hook with desktop dialog)
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

### Account Management

**Account Deletion:**

- Accessible from Settings > Account > Danger Zone
- Requires password verification (bcryptjs compare) and typing "DELETE" to confirm
- Validated with `deleteAccountSchema` (Zod) in `lib/validations.ts`
- Best-effort Google Drive folder trash before deletion (logs warning on failure, proceeds)
- `prisma.user.delete()` triggers cascade deletion: Items, ItemFiles, Playlists, PlaylistItems, Forks, SyncLogs, PasswordResets, EmailVerificationTokens, GoogleDriveConnection
- Security event logging at each stage via `logSecurityEvent()`: rate limited, wrong password, confirmed, completed
- Non-blocking completion logging via `after()` from `next/server`
- Client-side `signOut({ callbackUrl: "/" })` after successful deletion
- Mobile parity: `MobileSettingsSheet` includes full delete account flow via `"delete-account"` step in `SettingsFormStep`, and data export button in the account section

**Data Export:**

- Accessible from Settings > Account > Your Data
- `exportAccountData` server action returns typed `AccountExportData` interface
- Includes: user profile, items (with files metadata and TMDB fields), playlists (with item memberships), fork records
- Excludes: binary data (artwork blobs, uploaded files), password hashes, OAuth tokens
- Client creates `Blob` from JSON response, triggers download as `canoncore-export-YYYY-MM-DD.json`
- Delayed `URL.revokeObjectURL()` (60s) to prevent download cancellation from immediate revocation

**Rate Limiting:**

- `accountDeletion`: 3 requests per hour (sliding window)
- `dataExport`: 5 requests per hour (sliding window)

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

Multiple Server Components calling `getItems()` in same request = 1 database query. Also used for `getSystemShelfItems()` in `lib/shelf-query-utils.ts` — both arguments are primitives (string, string enum) so `Object.is` equality works correctly for deduplication.

**Suspense Page Streaming:**

The four heaviest public pages use Suspense boundaries to stream heavy content while rendering a fast shell immediately:

```typescript
// Pattern: shell renders first, content streams via Suspense
export default async function ExplorePage() {
  const session = await auth(); // minimal data for shell
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

Pages using this pattern:

- **Explore** — streams featured items, TMDB enrichment, explore grid, playlists
- **Profile / My Items** — streams items grid, playlists, shelves
- **Item Detail** — streams TMDB chain, descendants, files, progress, watch status
- **Playlist Detail** — streams playlist items, TMDB enrichment, fork status

Each page also has a `loading.tsx` that renders the same skeleton during route transitions. Skeleton components in `components/skeletons/` match exact layout dimensions (hero height, grid columns, toolbar glassmorphism) to prevent cumulative layout shift.

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

Three GitHub Actions workflows handle quality, schema migration, database seeding, and component testing.

### CI Pipeline (`ci.yml`)

Four-job pipeline on push to `development`/`production` and PRs targeting those branches:

```
┌──────────────┐
│ Quality Gate │  Format check, lint, type check, knip
└──────┬───────┘
       │
       ▼
┌─────────────────┐
│ Schema Migration│  prisma migrate deploy (push only, skipped for PRs)
└──────┬──────────┘
       │ depends on both
  ┌────┴────┐
  ▼         ▼
┌──────┐ ┌───────┐
│Tests │ │ Build │  Run in parallel after quality + migrate
└──────┘ └───────┘
```

**Quality Gate** — runs format:check, lint, type-check, and knip (unused code detection). Uses a dummy `DATABASE_URL` since Prisma's postinstall hook runs `prisma generate` during `pnpm install`, which requires the env var even without a real database connection.

**Schema Migration** — runs `prisma migrate deploy` against Neon database branches, scoped by the Git branch that triggered the push:

```
development push           production push
       │                         │
       ▼                    ┌────┼────┐
 ┌───────────┐              ▼    ▼    ▼
 │    dev    │         ┌──────┐┌────┐┌────┐
 │  (Neon)   │         │ prod ││demo││seed│
 └───────────┘         │(Neon)││    ││    │
                       └──────┘└────┘└────┘
```

This branch-scoping was a deliberate fix for advisory lock contention. The original design used a separate `schema-migrate.yml` workflow that ran all four Neon migrations on every push regardless of which Git branch triggered it. When development and production pushes happened close together, both workflows tried to acquire Prisma's advisory lock on the same Neon branches simultaneously, causing failures. Merging migration into the CI workflow and scoping each step to the triggering Git branch eliminated the contention entirely.

Only runs on push events (`if: github.event_name == 'push'`), not PRs. Tests and build use `if: always()` with conditional success checks (`needs.migrate.result == 'success' || needs.migrate.result == 'skipped'`) so they run normally when migration is skipped for PRs.

**Tests** — unit and integration tests against real PostgreSQL. Depends on both quality gate and migration passing (or migration being skipped).

**Build** — production build verification. Same dependency pattern as tests, runs in parallel.

**Concurrency:** Groups cancel in-progress runs for the same ref, except production pushes which always run to completion.

### Seed Workflow (`seed.yml`)

Manual-dispatch workflow for populating databases. Three targets, each running independently:

| Target      | Neon Branch | Seed Script Target | Purpose                                       |
| ----------- | ----------- | ------------------ | --------------------------------------------- |
| development | development | `development`      | Dev data with TMDB metadata and Drive folders |
| demo        | demo        | `demo`             | Demo environment for recordings and showcases |
| seed        | seed        | `screenshots`      | Screenshot data for portfolio automation      |

The "seed" Neon branch maps to the "screenshots" seed target — a naming quirk because the Neon branch was created before the seed script's target naming was finalised. The workflow handles the translation: GitHub secret `SEED_DATABASE_URL` is set as env var `SCREENSHOT_DATABASE_URL` (what `seed.ts` expects).

Concurrency is set to `cancel-in-progress: false` so seed jobs always run to completion, avoiding partially seeded databases.

The seed workflow was originally triggered automatically after successful schema migrations, but this was removed in favour of manual dispatch only. Automatic seeding caused unnecessary re-seeds when schema changes didn't affect data, and the long runtime (~3 minutes per target) blocked other workflows.

### Storybook CI (`storybook.yml`)

Builds Storybook and runs interaction/accessibility tests via Playwright on every push and PR. Serves the static build via `http-server` and runs `test-storybook:ci` against it. Uploads the Storybook build as an artifact (7-day retention).

### Neon Branch Topology

Four Neon database branches serve different environments:

```
         neon/main (production schema)
         ├── development  ← dev pushes migrate here
         ├── demo         ← production pushes migrate here
         └── seed         ← production pushes migrate here
```

Each branch has its own connection string stored as a GitHub secret:

| Neon Branch | GitHub Secret             | Used By                           |
| ----------- | ------------------------- | --------------------------------- |
| development | `DATABASE_URL`            | CI tests, dev migration, dev seed |
| production  | `PRODUCTION_DATABASE_URL` | Production migration              |
| demo        | `DEMO_DATABASE_URL`       | Demo migration, demo seed         |
| seed        | `SEED_DATABASE_URL`       | Seed migration, screenshot seed   |

### Migration Safety

An integration test (`tests/integration/prisma/schema-migrate.test.ts`) verifies migration idempotency by running `prisma migrate deploy` twice consecutively. The second run confirms "No pending migrations to apply" — this catches cases where a migration might fail on rerun due to non-idempotent SQL statements.

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
          │   E2E   │  35 spec files (Playwright)
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

**Location:** `e2e/journeys/` (35 spec files)

**Pattern:** Page Object Model with composable fixtures

**Test Accounts:**

- 3 seeded users (demo, filmfan for screenshots; testuser for E2E)
- Password: `SeedPassword123!` for all
- Per-test user creation via `authenticated.fixture.ts` (unique user per test, cleaned up after)

**Real dependencies:**

- Full Next.js application (webServer starts dev server on dedicated port 3001 with separate `.next-e2e` build directory to avoid conflicts with the dev server on port 3000)
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
- `e2e/config/item-locators.ts` - Shared `getItemLocator` (visible=true filter for card/tree coexistence) and `openItemMoreMenu` (hover-then-click for Radix interactability) used across 6 POMs

**Patterns:**

- **Hover-then-click:** More-options buttons are hidden (`opacity-0`) until hover. POMs hover the parent item first, then click the revealed button — `force: true` clicks removed in favour of natural pointer event sequences
- **Radix hydration retry:** `expect().toPass()` wraps click → visibility assertion pairs with 1s inner timeout, retrying up to the outer timeout. Handles server-rendered Radix triggers not yet hydrated on first click
- **CardShell `.first()`:** CardShell renders item names twice (default + hover overlay). Selectors use `.first()` to avoid strict mode violations

**Projects:**

- Desktop: Chrome (Desktop Chrome)
- Mobile: Chrome (Pixel 7)

**Selectors:**

- Curated `data-testid` attributes on ~30 components (~85 testids)
- `slugify()` utility for deterministic item testids: `item-card-${slug}`, `item-tree-${slug}`
- Unit tests use role-based and text-based selectors (Testing Library best practices)

### Screenshot & Mockup Pipeline

A unified Playwright pipeline (`pnpm run mockups`) captures app screenshots and generates device mockups in a single command. Three Playwright projects run in sequence:

1. **laptop** (1152×745 @3x) and **mobile** (390×844 @3x) — capture 11 screenshots across 10 test scenarios per viewport, outputting PNGs to a gitignored `e2e/output/screenshots/` directory. Media-stack images (item detail, explore page) are converted inline to webp via sharp during capture
2. **mockups** (depends on laptop + mobile) — uploads screenshots to LS Graphics mockup templates (MacBook and iPhone scenes), downloads the rendered frames, converts to webp (quality 82), and deletes the intermediate PNGs. Supports both single-screen and multi-screen scenes

Multi-screen mockups (`MultiScreenMockupEntry`) handle scenes with multiple device screens (e.g., two side-by-side laptops). Each screen is configured with a source screenshot and relative click coordinates (0–1) within the scene canvas. The pipeline navigates to the editor once, then uploads each screenshot at its configured position before downloading the composited result. An optional resize step can scale the final output.

Outputs:

- `public/images/*.webp` — 5 accordion mockups + 2 media-stack screenshots + 1 multi-screen mockup for the homepage (8 total)
- `public/portfolio/*.webp` — 18 device mockups (9 features × MacBook + iPhone) for the portfolio

The pipeline must run headed (`headless: false`) because LS Graphics uses canvas/WebGL compositing that fails silently in headless Chrome. Configuration lives in `e2e/mockups/mockup-config.ts` with scene-to-screenshot mappings.

---

## Infrastructure

**Hosting:** Vercel — automatic deployments, edge network, serverless functions

**Database:** Neon PostgreSQL — serverless, auto-scaling, branch-per-environment

**Redis:** Upstash — rate limiting, serverless, pay-per-request

**Email:** Resend — transactional emails (password reset)

**Error Monitoring:** Sentry — client, server, and edge error tracking with session replay

**Tracing:** OpenTelemetry via @vercel/otel — distributed tracing across all runtimes

**Performance:** Vercel Speed Insights — Core Web Vitals monitoring (LCP, FID, CLS, TTFB)

**CI/CD:** GitHub Actions — quality gate, schema migration across 4 Neon branches, tests, build verification, database seeding (manual dispatch), and Storybook interaction testing on every push and PR

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

### Why 80% Completion Threshold (Trakt Standard)?

**Problem:** Users skip credits, marking items unwatched at 99%
**Previous:** 90% threshold — still too high for films with extended credits and post-credits scenes
**Solution:** 80% threshold, matching Trakt's industry-standard completion threshold
**Result:** More accurate progress tracking. Better accounts for end credits and post-credits scenes in films, and anime episodes where credits can be 10-15% of runtime

### Why System Playlists over Hardcoded Shelves?

**Chose System Playlists (real Playlist rows with a systemType discriminator) because:**

- Items in system playlists are computed at query time (virtual), not stored as PlaylistItem rows
- "Continue Watching" always reflects current watch state without needing to maintain a separate data structure
- Users can toggle system playlists on/off as shelves just like user-created playlists
- `@@unique([userId, systemType])` prevents duplicates; `skipDuplicates` handles race conditions

**Tradeoff:**

- System playlist queries are more complex (raw SQL for Continue Watching merges two sources)
- Virtual items require custom query logic per system playlist type rather than a simple join table lookup

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

### Why Visibility at Creation Time?

**Problem:** Visibility could only be set after item/playlist creation via edit dialogs. Creating a public playlist required: create → open edit → toggle public → save. Extra steps for a common action.

**Solution:** Embedded visibility controls directly in creation dialogs. Items get a "Make public" switch with optional parent inheritance. Playlists get a 3-option RadioGroup (Private/Unlisted/Public). Share tokens generated eagerly so playlists are immediately shareable.

**Tradeoff:**

- Creation dialogs are slightly more complex (more form fields)
- Acceptable because visibility is a fundamental property users want to set upfront, not an afterthought

### Why a Shared ItemTreePicker?

**Problem:** ForkDestinationDialog and CreatePlaylistDialog both needed a virtualised item selection tree. ForkDestinationDialog had inline virtualisation code (~270 lines) that would be duplicated.

**Solution:** Extracted `ItemTreePicker` component supporting both single-select (fork) and multi-select (playlist) modes. `ForkDestinationDialog` reduced by ~270 lines. Same virtualisation performance, consistent UX.

**Tradeoff:**

- Multi-select mode is a prop but visual differentiation (checkbox vs radio indicators) is not yet implemented — both modes use the same glassmorphism highlight

### Why Font Awesome over Lucide?

**Initially used lucide-react:**

- Popular with shadcn/ui ecosystem
- Simple named imports

**Migrated to Font Awesome 7 because:**

- Broader icon library (solid, brands, regular sets)
- Explicit icon imports give full control over which icons are bundled
- Font Awesome's SVG core handles icon sizing, alignment, and accessibility attributes consistently
- Brand icons (GitHub, Google, social media) available in the same library

**Implementation:**

- `@fortawesome/fontawesome-svg-core` configured with `config.autoAddCss = false` in `app/layout.tsx` to prevent FOUC
- Manual CSS import from `@fortawesome/fontawesome-svg-core/styles.css`
- Migrated 50+ components in a single pass across items, playlists, mobile, search, media, google-drive, profile, UI, and wizard directories

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
