---
title: "CanonCore"
category: "Personal Project"
description: "Google Drive meets Netflix. Visual browsing, drag-and-drop organisation, watch progress, collections others can fork."
technologies:
  [
    "Next.js 16",
    "React 19",
    "TypeScript",
    "PostgreSQL",
    "Prisma 7",
    "Tailwind CSS 4",
    "NextAuth.js v5",
    "Vitest",
    "Playwright",
  ]
link: "https://canoncore.com"
github: "https://github.com/jacobreesgit/canoncore-v2"
image: "/images/canoncore.webp"
year: "2025–Present"
featured: true
---

## The Product

CanonCore turns Google Drive into a fully featured media library: visual browsing, metadata enrichment, progress tracking, and public sharing, without moving or duplicating your files. Create folder structures for movies and TV shows, reorganise with drag and drop, enrich items from TMDB, track what you've watched, and share collections publicly. Your files live in your storage, not ours.

I use this daily for my own movie and TV library. Active development continues with planned features including character tagging and native iOS and tvOS apps.

---

## Features

### Browsing & Organisation

![Grid View](/portfolio/01-library-grid-thumb.webp)
![Tree View](/portfolio/02-tree-view-thumb.webp)

Two views: Grid is Netflix-style with poster cards and progress bars. Tree is file explorer-style showing all descendants at once. Every item page has a hero banner. I wanted it to feel like browsing a streaming service, not a file manager.

Edit mode enables drag-and-drop, bulk selection, and full keyboard navigation with screen reader announcements. Pinned items (max 10) appear in the sidebar for quick access. dnd-kit only loads in edit mode to keep browsing fast.

### Public Sharing

![Explore page with featured carousel](/portfolio/07-explore-page-thumb.webp)

Make items public to share them. Your profile page shows your public items. The explore page shows public items from everyone with a featured banner carousel.

Visibility inherits through the hierarchy. Items can be public, private, or inherit from a parent. A public item with a private ancestor stays inaccessible. Moving a public item into a private folder triggers a confirmation dialogue.

### Forking

![Fork to Library dialog](/portfolio/32-fork-dialog-thumb.webp)

Other users can fork your collections into their own library. Forking copies names, descriptions, artwork, and hierarchy. Media files and subtitles stay private. Think of it like sharing a Spotify playlist: the structure is public, the files aren't.

### Media Playback & Progress Tracking

![Video player with subtitle tracks](/portfolio/03-video-player-thumb.webp)

Vidstack-powered player streams media directly from Google Drive via HTTP range requests. Playback position auto-saves and resumes where you left off. Supports SRT, VTT, SUB, and ASS subtitle tracks. I always want to use subtitles. I watch a lot of anime.

I built progress tracking because I kept losing my place in long series. Folders display watched and total counts for themselves and all descendant items, using a 90 percent completion threshold to account for credit skipping. The "Go to next" action performs a depth-first traversal of the tree to locate your first incomplete item automatically.

### One-Click Metadata

![TMDB search wizard with poster selection](/portfolio/04-tmdb-wizard-thumb.webp)

You can enrich movies and TV shows with TMDB metadata. A three-step wizard lets you search for a title, select from multiple poster options, and choose a backdrop image for hero banners.

### Google Drive Sync

![Sync panel and Drive connection UI](/portfolio/06-google-drive-sync-thumb.webp)

All your media files stay in your Drive. I use Google's Changes API for incremental syncs, fetching only changed items since the last update. If incremental sync returns no results, a verification step triggers a full sync.

Conflict detection compares timestamps bidirectionally: if Drive's modifiedTime is newer than our stored value, local changes are rejected with a notification. Errors are isolated per file, so individual failures don't interrupt the overall process.

### Spotlight Search

![Spotlight search modal](/portfolio/08-spotlight-search-thumb.webp)

Press `/` to open Spotlight Search anywhere in the app. Results load in parallel across three sections: Your Items, Public Collections, and People. A module-level cache with a 60-second TTL gives you instant responses on repeat searches. Breadcrumb paths reveal each item's full hierarchy.

---

## How It's Built

### Architecture Decisions

**Google Drive migration:** I originally built this on SFTP, but path-based matching meant every rename or move created duplicates. No stable IDs, no change detection API, read-only from the web. Google Drive solved all of it: permanent file IDs survive renames and moves, Changes API for incremental sync, full read/write access so users can create folders directly from CanonCore. Should have started here.

**Stack Auth → NextAuth.js v5:** I started with managed auth, then migrated to self-hosted JWT sessions after hitting rate limits. I added 15+ rate limiters via Upstash Redis with different thresholds per action (strict for auth, generous for browsing).

---

### Security & Resilience

**OAuth Token Encryption:** AES-256-GCM with random IVs per encryption.

**Upload Security:** HMAC-SHA256 signed session tokens with timing-safe comparison, token expiry validation, and filename sanitisation.

**Circuit Breaker:** I wrapped TMDB and Google Drive calls in a custom circuit breaker that opens after consecutive failures and tests recovery in half-open state.

**Security Headers:** OWASP-compliant headers including HSTS with preload, CSP with trusted sources, and X-Frame-Options: DENY.

**CSRF Protection:** Signed OAuth state parameter to prevent authorization code interception.

**Bot Protection:** Edge-level defense blocks 35+ aggressive AI crawlers (Meta, OpenAI, Perplexity) with zero cost while rate-limiting beneficial bots to 120 req/min, using fast-path optimization for 99% of traffic.

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
