# CanonCore

**Google Drive meets Netflix. Visual browsing, drag-and-drop organisation, watch progress, collections others can fork.**

Next.js 16 · React 19 · PostgreSQL · TypeScript

[Live Demo](https://canoncore.com) · [Source](https://github.com/jacobreesgit/canoncore-v2)

---

## The Product

CanonCore turns Google Drive into a fully featured media library: visual browsing, metadata enrichment, progress tracking, and public sharing, without moving or duplicating your files. Create folder structures for movies and TV shows, reorganise with drag and drop, enrich items from TMDB, track what you've watched, and share collections publicly. Your files live in your storage, not ours.

`[HERO SCREENSHOT: library grid view with posters]`

---

## Features

### Browsing & Organisation

Two views: Grid is Netflix-style with poster cards and progress bars. Tree is file explorer-style showing all descendants at once. Every item page has a hero banner.

Edit mode enables drag-and-drop, bulk selection, and full keyboard navigation with screen reader announcements. Pinned items (max 10) appear in the sidebar for quick access. dnd-kit only loads in edit mode to keep browsing fast.

`[SCREENSHOT: grid view]`

`[SCREENSHOT: tree view]`

---

### Public Profiles

Two ways to discover public content: user profiles at `/u/username` show one person's public items, the explore page shows public items from everyone with a featured banner carousel. Visitors can navigate the full hierarchy of any public collection. Other users can fork your organisational structure into their own library. Forking copies names, descriptions, artwork, and hierarchy. Media files and subtitles stay private in your Drive. Think of it like sharing a Spotify playlist: the structure is public, the files aren't.

Visibility inherits through the hierarchy. Items can be public, private, or inherit from a parent. A public item with a private ancestor stays inaccessible. Moving a public item into a private folder triggers a confirmation dialogue.

`[SCREENSHOT: public profile view]`

---

### Media Playback

Vidstack-powered player streams media directly from Google Drive via HTTP range requests. Playback position auto-saves and resumes where you left off. Supports SRT, VTT, SUB, and ASS subtitle tracks.

`[SCREENSHOT: video player]`

---

### One-Click Metadata

You can enrich movies and TV shows with TMDB metadata. A three-step wizard lets you search for a title, select from multiple poster options, and choose a backdrop image for hero banners.

`[SCREENSHOT: TMDB search wizard with poster selection]`

---

### Progress Tracking

I track watch progress at every level of the hierarchy. Folders display watched and total counts for themselves and all descendant items, using a 90 percent completion threshold to account for credit skipping.

The "Go to next" action performs a depth-first traversal of the tree to locate your first incomplete item automatically.

`[SCREENSHOT: folder with progress bar and "Go to next" button]`

---

### Google Drive Sync

All your media files stay in your Drive. I use Google's Changes API for incremental syncs, fetching only changed items since the last update. If incremental sync returns no results, a verification step triggers a full sync.

Conflict detection compares timestamps bidirectionally: if Drive's modifiedTime is newer than our stored value, local changes are rejected with a notification. Errors are isolated per file, so individual failures don't interrupt the overall process.

`[SCREENSHOT: sync panel or Drive connection UI]`

---

### Spotlight Search

Press `/` to open Spotlight Search anywhere in the app. Results load in parallel across three sections: Your Items, Public Collections, and People. A module-level cache with a 60-second TTL gives you instant responses on repeat searches. Breadcrumb paths reveal each item's full hierarchy.

`[SCREENSHOT: spotlight search modal]`

---

## How It's Built

### Architecture Decisions

**Google Drive migration:** I originally built this on SFTP, but path-based matching meant every rename or move created duplicates. No stable IDs, no change detection API, read-only from the web. Google Drive solved all of it: permanent file IDs survive renames and moves, Changes API for incremental sync, full read/write access so users can create folders directly from CanonCore.

**Stack Auth → NextAuth.js v5:** I started with managed auth, then migrated to self-hosted JWT sessions after hitting rate limits. I added 15+ rate limiters via Upstash Redis with different thresholds per action (strict for auth, generous for browsing).

---

### Security & Resilience

**OAuth Token Encryption:** AES-256-GCM with random IVs per encryption.

**Upload Security:** HMAC-SHA256 signed session tokens with timing-safe comparison, token expiry validation, and filename sanitisation.

**Circuit Breaker:** I wrapped TMDB and Google Drive calls in a custom circuit breaker that opens after consecutive failures and tests recovery in half-open state.

**Security Headers:** OWASP-compliant headers including HSTS with preload, CSP with trusted sources, and X-Frame-Options: DENY.

**CSRF Protection:** Signed OAuth state parameter to prevent authorization code interception.

---

### Performance

**Edit Mode Separation:** I extracted a view-only Grid from SortableGrid to avoid dnd-kit overhead in browse mode.

**Bulk Delete:** Recursive CTE for deleting nested hierarchies in a single query.

**Lazy Loading:** Intersection Observer with 200px preload margin and priority mode for above-fold images.

**Request Deduplication:** React.cache() on the server, module-level caching on client for search results.

**Offline Queue:** Actions queue to IndexedDB when offline, replay on reconnect with exponential backoff and jitter.

**Structured Logging:** Pino with request ID injection for distributed tracing.

**Batch API:** Google Drive operations batched up to 100 per request. Reduced sync time for large folders from ~45s to ~3s.

---

### Accessibility

WCAG 2.1 AA compliant throughout. Reduced motion support via a custom hook that disables carousel autoplay and animations. Skip link to main content. ARIA live regions for drag-and-drop announcements.

---

### Testing

Over 2,300 unit tests with Vitest cover auth, items, Google Drive sync, and crypto operations. Integration tests run against real PostgreSQL. E2E tests with Playwright use the Page Object Model pattern and test against a real Google Drive account, not mocked. Tests automatically create missing fixtures for self-healing reliability.

---

## Tech Stack

**Front End:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, shadcn/ui, Vidstack, dnd-kit, cmdk

**Back End:** Prisma 7, NextAuth.js v5, Server Actions

**APIs:** Google Drive (OAuth 2.0, Changes API), TMDB

**Infrastructure:** Vercel, Neon PostgreSQL (serverless branching), Upstash Redis

---

**Live:** [canoncore.com](https://canoncore.com)
**Source:** [github.com/jacobreesgit/canoncore-v2](https://github.com/jacobreesgit/canoncore-v2)
