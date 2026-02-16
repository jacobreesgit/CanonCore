# CanonCore

> Google Drive meets Netflix. Visual browsing, drag-and-drop organisation, watch progress, collections others can fork.

**Live:** [canoncore.com](https://canoncore.com) | **Storybook:** [canoncore-storybook.vercel.app](https://canoncore-storybook.vercel.app)

## The Product

CanonCore turns Google Drive into a fully featured media library: visual browsing, metadata enrichment, progress tracking, and public sharing, without moving or duplicating your files. Create folder structures for movies and TV shows, reorganise with drag and drop, enrich items from TMDB, track what you've watched, and share collections publicly. Your files live in your storage, not ours.

I use this daily for my own movie and TV library. Active development continues.

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

**Stack Auth → NextAuth.js v5:** I started with managed auth, then migrated to self-hosted JWT sessions after hitting rate limits. I added 15+ rate limiters via Upstash Redis with different thresholds per action (strict for auth, generous for browsing).

### Security & Resilience

AES-256-GCM encryption for OAuth tokens with random IVs, HMAC-SHA256 signed upload tokens with timing-safe comparison, and OWASP-compliant security headers (HSTS with preload, CSP, X-Frame-Options: DENY). TMDB and Google Drive calls wrapped in a custom circuit breaker that opens after consecutive failures and tests recovery in half-open state. Multi-layer bot protection blocks 35+ AI scrapers at the edge while rate-limiting beneficial search engines.

### Performance

Google Drive operations batched up to 100 per request, reducing sync time for large folders from ~45s to ~3s. Edit mode separation extracts a view-only Grid from SortableGrid to avoid dnd-kit overhead in browse mode (~40KB saved). TMDB resolution and metadata fetches chained as a single promise running concurrently with other server-side fetches, eliminating sequential await waterfalls. Offline queue persists actions to IndexedDB when offline, replaying on reconnect with exponential backoff and jitter.

### Accessibility

WCAG 2.1 AA compliant throughout, enforced by automated testing. Every component has a Storybook story tested against axe-core — any a11y violation fails the build. Semantic roles for tabs, drag-and-drop, and carousel navigation. Live regions announce slide changes and drag operations to screen readers. Skip link, scrollable region focus management, and reduced motion support that disables autoplay and animations.

### Testing

2,400+ tests across unit, integration, Storybook component, and E2E layers. Unit tests (Vitest) cover auth, items, Drive sync, and crypto operations. ~200 integration tests run against real PostgreSQL. 58 Storybook stories with 312 component tests enforce accessibility via axe-core and verify interaction correctness. 31 E2E spec files across desktop and mobile Chrome with Playwright use 15 focused Page Object Models and composable fixtures with per-test user creation.

### Component Documentation

All custom components are documented in Storybook with stories, accessibility checks, and interaction tests.

---

## Tech Stack

**Front End:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, shadcn/ui, Vidstack, dnd-kit, cmdk, nuqs, Embla Carousel

**Back End:** Prisma 7, NextAuth.js v5, Server Actions

**APIs:** Google Drive (OAuth 2.0, Changes API), TMDB

**Infrastructure:** Vercel, Neon PostgreSQL (serverless branching), Upstash Redis

---

## In Progress

- **Native iOS & tvOS apps** — React Native with Expo for mobile and living room playback
- **3D Graph Visualisation** — Three.js-powered interactive graph of your library hierarchy

---

See [DESIGN.md](./DESIGN.md) for detailed architecture, API design, and implementation decisions.
