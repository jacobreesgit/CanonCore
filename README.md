# CanonCore

> Google Drive meets Netflix. Visual browsing, drag-and-drop organisation, watch progress, collections others can fork.

**Live:** [canoncore.com](https://canoncore.com) | **Storybook:** [canoncore-storybook.vercel.app](https://canoncore-storybook.vercel.app)

## The Product

CanonCore turns Google Drive into a fully featured media library: visual browsing, metadata enrichment, progress tracking, and public sharing, without moving or duplicating your files. Create folder structures for movies and TV shows, reorganise with drag and drop, enrich items from TMDB, track what you've watched, and share collections publicly. Your files live in your storage, not ours.

I use this daily for my own movie and TV library. Active development continues.

---

## Features

### Homepage

The landing page features a full-bleed animated mesh gradient background with a grid overlay and CRT scanline effect. Content scrolls over the sticky background. A two-column hero section combines a media stack (glass-morphism screenshot carousel) with a typed command-line pill and logo showcase. Below the hero, a feature accordion with image crossfade showcases core capabilities, followed by a closing manifesto CTA. All motion is async-loaded via LazyMotion (~15KB). Desktop Lighthouse: Performance 96, LCP 1.3s, TBT 0ms, total transfer 1,161 KiB.

### Browsing & Organisation

Two views: **Grid** is Netflix-style with poster cards and progress bars. **Tree** is file explorer-style showing all descendants at once. Every item page has a hero banner. I wanted it to feel like browsing a streaming service, not a file manager.

Edit mode enables drag-and-drop, bulk selection, and full keyboard navigation with screen reader announcements. Pinned items (max 10) appear in the sidebar for quick access. dnd-kit only loads in edit mode to keep browsing fast.

On mobile, bottom sheets replace desktop dialogues for sort, filter, view switching, and item creation. A bottom navigation bar provides access to My Items, Explore, Search, Help, and Account.

### Playlists

Cross-cutting collections that reference items from anywhere in your library without moving or duplicating them. Create themed lists — "Best Horror Films", "Weekend Watchlist" — and each item can belong to multiple playlists while staying in its original tree position.

Three visibility levels: private (default), public (discoverable on the Explore page), or unlisted (accessible only via a share link). Unlisted share tokens are generated with nanoid. Playlist cards show a poster collage mosaic of up to four item artworks, or a custom uploaded artwork image. Drag-to-reorder lets you arrange items within a playlist. Right-click context menus provide quick actions: edit, delete, toggle visibility, copy share link.

### Public Sharing

Make items and playlists public to share them. Your profile page shows your public items and playlists. The explore page has two tabs — **Collections** and **Playlists** — showing public content from everyone with a featured banner carousel.

Visibility inherits through the item hierarchy. Items can be public, private, or inherit from a parent. A public item with a private ancestor stays inaccessible. Moving a public item into a private folder triggers a confirmation dialogue. Playlists have their own independent visibility (private, public, or unlisted via share link).

### Forking

Other users can fork your collections into their own library. Forking copies names, descriptions, artwork, and hierarchy. Media files and subtitles stay private. Think of it like sharing a Spotify playlist: the structure is public, the files aren't.

### Media Playback

Vidstack-powered player streams media directly from Google Drive via HTTP range requests. Playback position auto-saves and resumes where you left off. Supports SRT, VTT, SUB, and ASS subtitle tracks. I always want to use subtitles. I watch a lot of anime.

### One-Click Metadata

You can enrich movies and TV shows with TMDB metadata. A four-step wizard lets you search for a title, review the description, select from multiple poster options, choose a backdrop image, and review everything before applying. For TV shows, an episode picker lets you navigate into seasons and episodes. Per-item display toggles control what metadata appears: tagline, cast, genres, providers, and videos.

### Progress Tracking

I built progress tracking because I kept losing my place in long series. Folders display watched and total counts for themselves and all descendant items, using a 90 percent completion threshold to account for credit skipping.

The "Go to next" action performs a depth-first traversal of the tree to locate your first incomplete item automatically.

### Google Drive Sync

All your media files stay in your Drive. I use Google's Changes API for incremental syncs, fetching only changed items since the last update. If incremental sync returns no results, a verification step triggers a full sync.

Conflict detection compares timestamps bidirectionally: if Drive's modifiedTime is newer than our stored value, local changes are rejected with a notification. Errors are isolated per file, so individual failures don't interrupt the overall process. If your Drive connection expires, a persistent banner appears across the app prompting you to reconnect.

### Spotlight Search

Press `/` to open Spotlight Search anywhere in the app. Results load in parallel across four sections: Your Items, Playlists, Public Collections, and People. A module-level cache with a 60-second TTL gives you instant responses on repeat searches. Breadcrumb paths reveal each item's full hierarchy.

### Cinematic Hero

The explore page features a cinematic hero carousel that auto-advances through featured collections with rich TMDB metadata — tagline, release year, runtime, genres, and content rating. Item detail pages show a single hero banner with the item's backdrop artwork. Playlist detail pages use a mosaic backdrop composited from the playlist's item artwork.

### URL State

Sort, filter, view mode, and tab selections persist in URL parameters via nuqs across items, playlists, explore, and profile views. Bookmarkable, shareable views with localStorage backup for direct navigation.

### Multi-Select Filters

Two filter groups — File Status (Has Files, No Files) and Sync Status (Synced, Pending Sync, Sync Error) — with AND logic across groups and OR within. Active filter count shown in toolbar badge.

### SEO & Social Sharing

Dynamic OpenGraph images generated server-side for every public profile, item, and playlist page. When someone shares a link on Twitter, Discord, or Slack, the preview card shows the item's TMDB backdrop, name, and description. Profile links show a branded card with the user's display name and item count. Playlist links show the playlist artwork and item count. JSON-LD structured data (Movie, TVSeries, Person, WebApplication schemas) helps search engines understand the content. A dynamic sitemap keeps all public profiles, items, and playlists indexed.

### Legal Pages

Privacy Policy, Terms of Service, and Cookie Policy rendered from MDX via Fumadocs, sharing the same layout and styling as the help documentation. Legal links appear in the site footer, sidebar, and sign-up form.

### Bot Protection

Multi-layer defence against aggressive AI crawlers: robots.txt for polite bots, edge-level blocking for non-compliant scrapers, and rate limiting (120 req/min) for beneficial search engines. Blocks 35+ AI scrapers while allowing Google, Bing, Apple, and others.

### Error Handling

Route-level error boundaries catch failures gracefully with styled recovery pages and a retry option. Custom 404 pages guide users back to relevant content. A global error boundary catches root layout failures as a last resort. Every error is reported to Sentry for monitoring.

### Account Management

You own your data. Download a complete export of your account as JSON — profile, items with file metadata and TMDB fields, playlists with memberships, and fork records — from Settings at any time. If you want to leave, permanent account deletion removes everything: items, playlists, files, forks, and audit records. Deletion requires your password and typing "DELETE" to confirm. If Google Drive is connected, the CanonCore folder is moved to trash before the account is removed. Prisma cascade relations handle all dependent records in a single operation.

### Audit Logging

Every database mutation is automatically logged via a Prisma extension. Context includes user, action, model, and record ID. Sensitive fields are redacted. 90-day retention in production.

---

## How It's Built

### Architecture Decisions

**Google Drive migration:** I originally built this on SFTP, but path-based matching meant every rename or move created duplicates. No stable IDs, no change detection API, read-only from the web. Google Drive solved all of it: permanent file IDs survive renames and moves, Changes API for incremental sync, full read/write access so users can create folders directly from CanonCore. Should have started here.

**Stack Auth → NextAuth.js v5:** I started with managed auth, then migrated to self-hosted JWT sessions after hitting rate limits. I added 15+ rate limiters via Upstash Redis with different thresholds per action (strict for auth, generous for browsing).

**Lucide → Font Awesome:** I migrated the entire icon system from lucide-react to Font Awesome 7 across 50+ components. Font Awesome's explicit icon imports give better control over bundle size, and the broader icon library covers every UI need without compromise. FOUC prevention handled via manual CSS import with `autoAddCss = false`.

### Security & Resilience

AES-256-GCM encryption for OAuth tokens with random IVs, HMAC-SHA256 signed upload tokens with timing-safe comparison, and OWASP-compliant security headers (HSTS with preload, CSP, X-Frame-Options: DENY). TMDB and Google Drive calls wrapped in a custom circuit breaker that opens after consecutive failures and tests recovery in half-open state. Multi-layer bot protection blocks 35+ AI scrapers at the edge while rate-limiting beneficial search engines.

### Observability & Monitoring

Sentry error tracking across client, server, and edge runtimes with source maps for readable stack traces. OpenTelemetry distributed tracing via Vercel's OTel integration. Vercel Speed Insights tracks Core Web Vitals in production. A health check endpoint at `/api/health` verifies database connectivity for uptime monitors.

### Performance

Google Drive operations batched up to 100 per request, reducing sync time for large folders from ~45s to ~3s. Edit mode separation extracts a view-only Grid from SortableGrid to avoid dnd-kit overhead in browse mode (~40KB saved). TMDB resolution and metadata fetches chained as a single promise running concurrently with other server-side fetches, eliminating sequential await waterfalls. Offline queue persists actions to IndexedDB when offline, replaying on reconnect with exponential backoff and jitter. Homepage performance pass cut total transfer by 65% (3,344 KiB → 1,161 KiB): replaced a 328KB noise texture with a CSS-generated SVG feTurbulence data URI, migrated all images to next/image with CDN support, async-loaded motion features via LazyMotion, and deduplicated `auth()` with `React.cache()` to eliminate redundant JWT decodes per request.

### Accessibility

WCAG 2.1 AA compliant throughout, enforced by automated testing. Every component has a Storybook story tested against axe-core — any a11y violation fails the build. Semantic roles for tabs, drag-and-drop, and carousel navigation. Live regions announce slide changes and drag operations to screen readers. Skip link, scrollable region focus management, and reduced motion support that disables autoplay and animations.

### CI/CD

GitHub Actions pipeline enforces quality on every push and pull request. A quality gate runs format check, lint, type check, and unused code detection. Tests and production build run in parallel after the gate passes. Conventional commits enforced by commitlint with pre-commit hooks running ESLint and Prettier on staged files.

### Testing

2,800+ tests across unit, integration, Storybook component, and E2E layers. Unit tests (Vitest) cover auth, items, playlists, Drive sync, and crypto operations. ~200 integration tests run against real PostgreSQL. 66 Storybook stories with component tests enforce accessibility via axe-core and verify interaction correctness. 34 E2E spec files across desktop and mobile Chrome with Playwright use 16 focused Page Object Models and composable fixtures with per-test user creation.

### Component Documentation

All custom components are documented in Storybook with stories, accessibility checks, and interaction tests.

---

## Tech Stack

**Front End:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, shadcn/ui, Font Awesome 7, Vidstack, dnd-kit, cmdk, nuqs, Embla Carousel

**Back End:** Prisma 7, NextAuth.js v5, Server Actions

**APIs:** Google Drive (OAuth 2.0, Changes API), TMDB

**Infrastructure:** Vercel, Neon PostgreSQL (serverless branching), Upstash Redis, Sentry, GitHub Actions CI/CD

---

## In Progress

- **Native iOS & tvOS apps** — React Native with Expo for mobile and living room playback
- **3D Graph Visualisation** — Three.js-powered interactive graph of your library hierarchy

---

See [DESIGN.md](./DESIGN.md) for detailed architecture, API design, and implementation decisions.
