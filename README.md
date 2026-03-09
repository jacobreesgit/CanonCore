# CanonCore

> Google Drive meets Netflix. Visual browsing, drag-and-drop organisation, watch progress, collections others can fork.

**Live:** [canoncore.com](https://canoncore.com) | **Storybook:** [canoncore-storybook.vercel.app](https://canoncore-storybook.vercel.app)

## The Product

CanonCore turns Google Drive into a fully featured media library: visual browsing, metadata enrichment, progress tracking, and public sharing, without moving or duplicating your files. Create folder structures for movies and TV shows, reorganise with drag and drop, enrich items from TMDB, track what you've watched, and share collections publicly. Your files live in your storage, not ours.

I use this daily for my own movie and TV library. Active development continues.

---

## Features

### Homepage

The landing page features a full-bleed animated mesh gradient background with a grid overlay and CRT scanline effect. Content scrolls over the sticky background. A Payload-inspired 16-column grid hero section uses CSS Modules with container queries for sidebar-aware responsiveness — the layout adapts to its container width, not the viewport. The media stack (glass-morphism screenshot pair) is a server component with pure CSS animations, shipping zero client JavaScript. Below the hero, a feature accordion with image crossfade showcases core capabilities, followed by a closing manifesto CTA. Remaining motion is async-loaded via LazyMotion (~15KB). Desktop Lighthouse: Performance 96, LCP 1.3s, TBT 0ms, total transfer 1,161 KiB.

### Browsing & Organisation

Two views: **Grid** is Netflix-style with poster cards and progress bars. **Tree** is file explorer-style showing all descendants at once. Every item page has a hero banner. Grid cards stay elevated while their context menu is open using CSS `has-[[data-state=open]]` selectors. Tree items swap the Google Drive sync icon for a more-options button on hover. I wanted it to feel like browsing a streaming service, not a file manager.

Edit mode enables drag-and-drop, bulk selection, and full keyboard navigation with screen reader announcements. Pinned items (max 10) appear in the sidebar for quick access. dnd-kit only loads in edit mode to keep browsing fast.

On mobile, bottom sheets replace desktop dialogues for sort, filter, view switching, and item creation. A bottom navigation bar provides access to My Items, Explore, Search, Help, and Account.

### Playlists

Cross-cutting collections that reference items from anywhere in your library without moving or duplicating them. Create themed lists — "Best Horror Films", "Weekend Watchlist" — and each item can belong to multiple playlists while staying in its original tree position.

Three visibility levels chosen at creation time via an icon-labelled radio group: private (default), public (discoverable on the Explore page), or unlisted (accessible only via a share link). Share tokens are generated eagerly at creation so playlists are immediately shareable when switched to unlisted. You can also pre-select items from your library during creation using a virtualised tree picker with search filtering — no need to create first and add items later. Playlist cards show a poster collage mosaic of up to four item artworks, or a custom uploaded artwork image. Drag-to-reorder lets you arrange items within a playlist. Right-click context menus provide quick actions: edit, delete, toggle visibility, copy share link.

### Public Sharing

Make items and playlists public to share them. Your profile page shows your public items and playlists. The explore page has two tabs — **Collections** and **Playlists** — showing public content from everyone with a featured banner carousel. Both tabs support client-side search with debounced URL sync and cursor-based infinite scroll pagination, so you can browse thousands of public items without loading them all at once.

Right-clicking any item you don't own opens a viewer context menu with quick actions: **Fork** copies it to your library, **Add to Playlist** saves it to one of your playlists. Owners see their own familiar context menu with settings, delete, pin, and the new **Add to Playlist** action. If an owner visits their own private item or profile via a public URL, they see a helpful notice explaining why the content isn't visible publicly, with a link to change visibility — instead of a generic 404.

Visibility is set at creation time, not just after the fact. When creating an item, a "Make public" switch lets you go public immediately. Child items default to inheriting their parent's visibility, keeping your hierarchy consistent without manual per-item configuration. Playlists offer a three-option radio picker — private, unlisted (share link only), or public — right in the creation dialog. A public item with a private ancestor stays inaccessible. Moving a public item into a private folder triggers a confirmation dialogue. Playlists have their own independent visibility (private, public, or unlisted via share link).

Profile pages for viewers also support search and infinite scroll pagination, making it easy to browse large public libraries.

### Forking

Other users can fork your collections into their own library — from the hero carousel, from item detail pages, or by right-clicking any item on the explore page or a public profile. An `isForkedByCurrentUser` flag prevents double-forking and updates on hover via route prefetching. Forking copies names, descriptions, artwork, and hierarchy. Media files and subtitles stay private. Think of it like sharing a Spotify playlist: the structure is public, the files aren't.

### Media Playback

A persistent media player powered by Vidstack and Redux Toolkit. A single `<MediaPlayer>` wraps the entire app at the root layout level — it never unmounts during navigation, so playback continues as you browse. A mini-player bar sticks to the bottom of the screen with play/pause, skip, seek, volume, shuffle, and repeat controls. Click expand to open a full viewport: video shows the Vidstack player, audio shows album artwork with a blurred backdrop (or an animated MeshGradient when there's no artwork).

Queue management lets you build a playlist on the fly — right-click any item to "Play Next" or "Add to Queue", then drag to reorder in the queue panel. The queue panel slides in from the side with the current track, up-next list, and a clear button with an undo toast. Global keyboard shortcuts work anywhere: Space for play/pause, M to mute, arrow keys to seek and adjust volume, F for fullscreen. The MediaSession API surfaces track metadata on your OS lock screen, notification centre, and Touch Bar. Playback position auto-saves every 30 seconds and on tab switch, so you always resume where you left off. Supports SRT, VTT, SUB, and ASS subtitle tracks. I always want to use subtitles. I watch a lot of anime.

### One-Click Metadata

You can enrich movies and TV shows with TMDB metadata. A five-step wizard lets you search for a title, review the description, select from multiple poster options, choose a backdrop image, pick a logo title treatment, and review everything before applying. The wizard auto-extracts the backdrop's dominant colour and selects the best English logo during application. For TV shows, an episode picker lets you navigate into seasons and episodes. Per-item display toggles control what metadata appears: tagline, cast, genres, providers, and videos.

After the initial wizard, per-field artwork editing lets you change an individual poster, backdrop, logo, or episode still without re-applying all metadata. An inline detach flow removes all TMDB data with a single confirmation while preserving the item's name and description. Override badges on the Files tab show when uploaded artwork takes precedence over TMDB artwork. The same settings form powers both the desktop dialog and mobile bottom sheet through a shared hook.

### Progress Tracking

I built progress tracking because I kept losing my place in long series. Progress is driven by explicit watch records rather than raw playback position — when playback crosses the 80 percent completion threshold (matching Trakt's industry standard for scrobbling), a watch record is created automatically. Items can also be manually marked as watched or unwatched from context menus and item detail pages, and batch operations let you mark an entire TV series or folder at once using recursive database traversal. Folders display watched and total counts for themselves and all descendant items.

The "Go to next" action performs a depth-first traversal of the tree to locate your first incomplete item automatically.

### Home Shelves

The authenticated home page shows personalised horizontal scroll rows, following the Netflix/Disney+ single-row pattern. Continue Watching picks up where you left off and surfaces the next episode in a series. Watchlist holds items you plan to watch. Recently Added and Watch Again round out the defaults — four system shelves that compute their items at query time rather than storing static membership.

Each shelf is backed by a playlist. System playlists are virtual — Continue Watching merges partially played items with up-next episodes using raw SQL, deduplicating and sorting by recency. User-created playlists use their real item membership. Any playlist can be promoted to a shelf, removed, or reordered from the settings panel. Shelves cap at 10 items each, scroll with snap points and arrow key navigation, and use gradient fade edges to hint at off-screen content.

### Watch Status

Items are automatically marked as watched when playback reaches 80 percent, matching Trakt's scrobble standard. A five-minute deduplication window prevents rapid duplicate entries from seeking or replaying.

You can also mark items manually — right-click context menus and item detail pages both expose mark and unmark actions. Batch operations let you mark an entire TV series or folder as watched in one click, using recursive database traversal to find all descendants with media files.

Every watch event is logged with a timestamp and source (auto or manual), building a play history for each item.

### Google Drive Sync

All your media files stay in your Drive. I use Google's Changes API for incremental syncs, fetching only changed items since the last update. If incremental sync returns no results, a verification step triggers a full sync.

Conflict detection compares timestamps bidirectionally: if Drive's modifiedTime is newer than our stored value, local changes are rejected with a notification. Errors are isolated per file, so individual failures don't interrupt the overall process — and failed syncs surface an inline retry button alongside a toast notification with a retry action. A pre-upload quota check blocks file uploads when Google Drive storage exceeds 95%, preventing uploads that would silently fail. Token refreshes use a per-connection mutex to prevent concurrent refresh races from invalidating each other's tokens. If your Drive connection expires, a persistent banner appears across the app prompting you to reconnect. Disconnecting permanently deletes the CanonCore folder from Google Drive and revokes the OAuth token at Google's end.

### Spotlight Search

Press `/` to open Spotlight Search anywhere in the app. Results load in parallel across four sections: Your Items, Playlists, Public Collections, and People. A module-level cache with a 60-second TTL gives you instant responses on repeat searches. Breadcrumb paths reveal each item's full hierarchy.

### Cinematic Visual Pipeline

Every item page adapts its colour palette to the content. When you apply TMDB metadata, the system extracts the dominant colour from the backdrop image using sharp's colour frequency analysis, boosts its saturation to stay vibrant within a dark theme, and generates ten colour shades that propagate through the entire page via CSS custom properties. Hero overlays, gradient fades, and background tones all shift to match the item's mood — a cool blue for ocean scenes, warm amber for desert landscapes. The carousel crossfades smoothly between colours as slides advance, using `@property`-registered CSS variables that enable transitions on custom properties (normally impossible without explicit type registration). All colour math runs client-side with zero external dependencies.

TMDB logos — transparent title treatment images — replace text titles in the hero banner when available. The system auto-selects the best English logo during metadata application, with responsive sizing constraints that adapt from mobile to ultrawide. Manual logo uploads take priority over TMDB logos, with a text title fallback if both fail.

### Cinematic Hero

The explore page features a cinematic hero carousel with Embla fade transitions that crossfades between featured collections with rich TMDB metadata — tagline, release year, runtime, genres, and content rating. Item detail pages show a single hero banner with the item's backdrop artwork and logo overlay. Playlist detail pages use a mosaic backdrop composited from the playlist's item artwork. Sync status indicators appear inline in the hero metadata line for the current user's own items — a check icon for synced, animated spinner for syncing, dot for pending, and warning triangle for errors. Sync data is filtered server-side so other users' Drive state is never exposed.

### URL State

Sort, filter, view mode, and tab selections persist in URL parameters via nuqs across items, playlists, explore, and profile views. Bookmarkable, shareable views with localStorage backup for direct navigation.

### Multi-Select Filters

Two filter groups — File Status (Has Files, No Files) and Sync Status (Synced, Pending Sync, Sync Error) — with AND logic across groups and OR within. Active filter count shown in toolbar badge.

### SEO & Social Sharing

Dynamic OpenGraph images generated server-side for every public profile, item, and playlist page. When someone shares a link on Twitter, Discord, or Slack, the preview card shows the item's TMDB backdrop, name, and description. Profile links show a branded card with the user's display name and item count. Playlist links show the playlist artwork and item count. JSON-LD structured data (Movie, TVSeries, Person, WebApplication, BreadcrumbList schemas) helps search engines understand the content — every public profile, item detail, and playlist page includes BreadcrumbList markup for rich search result navigation. A dynamic sitemap keeps all public profiles, items, and playlists indexed.

### Legal Pages

Privacy Policy, Terms of Service, and Cookie Policy rendered from MDX via Fumadocs, sharing the same layout and styling as the help documentation. Legal links appear in the site footer, sidebar, and sign-up form.

### Bot Protection

Multi-layer defence against aggressive AI crawlers: robots.txt for polite bots, edge-level blocking for non-compliant scrapers, and rate limiting (120 req/min) for beneficial search engines. Blocks 35+ AI scrapers while allowing Google, Bing, Apple, and others.

### Error Handling

Route-level error boundaries catch failures gracefully with styled recovery pages and a retry option. Custom 404 pages guide users back to relevant content. A global error boundary catches root layout failures as a last resort. Every error is reported to Sentry for monitoring.

### Account Management

You own your data. Download a complete export of your account as JSON — profile, items with file metadata and TMDB fields, playlists with memberships, and fork records — from Settings at any time. If you want to leave, permanent account deletion removes everything: items, playlists, files, forks, and audit records. Deletion requires your password and typing "DELETE" to confirm. If Google Drive is connected, the CanonCore folder and all its contents are permanently deleted from Google Drive and the OAuth token is revoked before the account is removed. Prisma cascade relations handle all dependent records in a single operation. Both data export and account deletion work on mobile through the settings bottom sheet, matching full desktop parity.

### Auth Security Hardening

Account lockout after 5 consecutive failed login attempts with a 15-minute cooldown — the sign-in form shows remaining lockout time. Anti-enumeration: the lockout check returns the same response for unknown emails so attackers can't discover which accounts exist. Email verification on signup and email changes — changing your email now sends a verification link to the new address rather than updating it directly, preventing account takeover via email hijack. JWT token version invalidation: password resets and changes increment a version counter; on each request, the JWT callback checks the token's version against the database and forces sign-out on mismatch, closing the stale-session gap that stateless JWTs normally have. User bios (300 characters) editable in settings and displayed on the public profile hero.

### Audit Logging

Every database mutation is automatically logged via a Prisma extension. Context includes user, action, model, and record ID. Sensitive fields are redacted. 90-day retention in production.

---

## How It's Built

### Architecture Decisions

**Google Drive migration:** I originally built this on SFTP, but path-based matching meant every rename or move created duplicates. No stable IDs, no change detection API, read-only from the web. Google Drive solved all of it: permanent file IDs survive renames and moves, Changes API for incremental sync, full read/write access so users can create folders directly from CanonCore. Should have started here.

**Stack Auth → NextAuth.js v5:** I started with managed auth, then migrated to self-hosted JWT sessions after hitting rate limits. I added 15+ rate limiters via Upstash Redis with different thresholds per action (strict for auth, generous for browsing). I later hardened the auth layer with account lockout, email verification, and JWT token version invalidation to close the gaps that stateless JWTs leave open.

**Lucide → Font Awesome:** I migrated the entire icon system from lucide-react to Font Awesome 7 across 50+ components. Font Awesome's explicit icon imports give better control over bundle size, and the broader icon library covers every UI need without compromise. FOUC prevention handled via manual CSS import with `autoAddCss = false`.

### Security & Resilience

AES-256-GCM encryption for OAuth tokens with random IVs, HMAC-SHA256 signed upload tokens with timing-safe comparison, and OWASP-compliant security headers (HSTS with preload, CSP, X-Frame-Options: DENY). Account lockout (5 attempts, 15-minute cooldown) with anti-enumeration protection. Email verification for signup and email changes with token-based verification flow. JWT token version invalidation forces sign-out on password reset or change, closing the stateless JWT stale-session gap. TMDB and Google Drive calls wrapped in a custom circuit breaker that opens after consecutive failures and tests recovery in half-open state. Multi-layer bot protection blocks 35+ AI scrapers at the edge while rate-limiting beneficial search engines.

### Observability & Monitoring

Sentry error tracking across client, server, and edge runtimes with source maps for readable stack traces. OpenTelemetry distributed tracing via Vercel's OTel integration. Vercel Speed Insights tracks Core Web Vitals in production. A health check endpoint at `/api/health` verifies database connectivity for uptime monitors.

### Performance

Google Drive operations batched up to 100 per request, reducing sync time for large folders from ~45s to ~3s. Edit mode separation extracts a view-only Grid from SortableGrid to avoid dnd-kit overhead in browse mode (~40KB saved). TMDB resolution and metadata fetches chained as a single promise running concurrently with other server-side fetches, eliminating sequential await waterfalls. Offline queue persists actions to IndexedDB when offline, replaying on reconnect with exponential backoff and jitter. Homepage performance pass cut total transfer by 65% (3,344 KiB → 1,161 KiB): replaced a 328KB noise texture with a CSS-generated SVG feTurbulence data URI, migrated all images to next/image with CDN support, async-loaded motion features via LazyMotion, and deduplicated `auth()` with `React.cache()` to eliminate redundant JWT decodes per request. The hero section's media stack ships as a server component with CSS-only animations — no client JavaScript for the image stack at all.

The four heaviest pages — Explore, Profile, Item Detail, and Playlist Detail — use React Suspense boundaries to stream content progressively. The header and breadcrumbs render immediately from minimal data (auth session, profile lookup), then heavy content (TMDB enrichment, descendant queries, file lookups, drive connection checks) streams in as it resolves. Route-level `loading.tsx` files show layout-matched skeleton screens during navigation that exactly mirror the real page structure — hero dimensions, grid column counts, glassmorphism toolbar, tab positions — so there's zero cumulative layout shift when content replaces the skeleton. Shelf queries are deduplicated per request via `React.cache()`. Public-facing pages use cursor-based infinite scroll powered by React Query, loading additional pages via Intersection Observer as you scroll — the server renders the first page and the client seamlessly fetches more, with server-side rate limiting protecting against abuse.

### Accessibility

WCAG 2.1 AA compliant throughout, enforced by automated testing. Every component has a Storybook story tested against axe-core — any a11y violation fails the build. Semantic roles for tabs, drag-and-drop, and carousel navigation. Live regions announce slide changes and drag operations to screen readers. Skip link, scrollable region focus management, and reduced motion support that disables autoplay and animations.

### CI/CD

GitHub Actions pipeline enforces quality on every push and pull request. A quality gate runs format check, lint, type check, and unused code detection. Schema migrations deploy automatically via `prisma migrate deploy` across four Neon database branches — development, production, demo, and seed — scoped by Git branch to prevent advisory lock contention between parallel runs. Tests and production build run in parallel after both the quality gate and migrations pass, with conditional logic so PRs (which skip migrations) still run tests normally.

A separate seed workflow repopulates databases on manual dispatch, targeting development, demo, or screenshot environments independently. An integration test verifies migration idempotency — running `prisma migrate deploy` twice in a row always succeeds.

Conventional commits enforced by commitlint with pre-commit hooks running ESLint and Prettier on staged files.

### Testing

3,500+ tests across unit, integration, Storybook component, and E2E layers. Unit tests (Vitest) cover auth, items, playlists, watch records, Drive sync, media playback, and crypto operations. ~200 integration tests run against real PostgreSQL. 77 Storybook stories with component tests enforce accessibility via axe-core and verify interaction correctness. 41 E2E spec files across desktop and mobile Chrome with Playwright use 16 focused Page Object Models and composable fixtures with per-test user creation.

### Component Documentation

All custom components are documented in Storybook with stories, accessibility checks, and interaction tests.

---

## Tech Stack

**Front End:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, shadcn/ui, Font Awesome 7, Vidstack, Redux Toolkit, dnd-kit, cmdk, nuqs, React Query, Embla Carousel (fade transitions)

**Back End:** Prisma 7, NextAuth.js v5, Server Actions

**APIs:** Google Drive (OAuth 2.0, Changes API), TMDB

**Infrastructure:** Vercel, Neon PostgreSQL (serverless branching), Upstash Redis, Sentry, GitHub Actions CI/CD

---

## In Progress

- **Native iOS & tvOS apps** — React Native with Expo for mobile and living room playback
- **3D Graph Visualisation** — Three.js-powered interactive graph of your library hierarchy

---

See [DESIGN.md](./DESIGN.md) for detailed architecture, API design, and implementation decisions.
