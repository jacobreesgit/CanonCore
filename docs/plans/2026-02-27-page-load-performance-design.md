# Page Load Performance Design

**Date**: 2026-02-27
**Branch**: `fix/page-load-performance`
**Approach**: Full optimisation (loading states + query deduplication + streaming)

## Problem

Navigating between pages feels extremely slow. When the user clicks a sidebar link, nothing happens for 700–1000ms — the old page stays frozen until the server finishes rendering the new page. There is zero visual feedback during navigation.

### Root Cause

1. **No route-level `loading.tsx` files** — Next.js App Router keeps the previous page visible while server-rendering the new one. Without `loading.tsx`, there is no instant skeleton feedback.
2. **All data fetching blocks the entire page** — each page awaits all queries (items, progress, TMDB metadata, playlists, shelves) before rendering anything, including the `SiteHeader`.
3. **Duplicate system shelf queries** — `getUserPlaylists()` and `getHomeShelves()` both independently call `getSystemShelfItems()` for each system playlist type (~4 duplicate complex SQL queries).

### Measurements (production build, localhost)

| Route | TTFB | HTML Size |
|-------|------|-----------|
| `/` (Landing) | 363ms | 89 KB |
| `/u/[username]` (My Items) | 695ms | 155 KB |
| `/u/[username]/[itemId]` (Item Detail) | 577ms | 42 KB |
| `/explore` | 788ms | 192 KB |

SPA navigations (client-side routing via sidebar clicks) measure 23–39ms — the router itself is not the problem. The bottleneck is full page renders during navigation, where the App Router waits for the entire server component tree before swapping.

### Current Architecture

Each page does all data fetching in the top-level server component, then passes everything as props to a single client component:

```
page.tsx (await ALL queries) → ClientComponent(all props)
```

This means `SiteHeader`, hero skeletons, and layout chrome are all blocked on the slowest query.

## Design

### 1. Route-Level Loading States

Add `loading.tsx` to four routes. Each replaces `{children}` in the layout — the sidebar stays visible while the content area shows a layout-matched skeleton.

| Route | File | Skeleton Layout |
|-------|------|-----------------|
| My Items | `app/(public)/u/[username]/loading.tsx` | Header bar + hero (avatar + name + stats) + toolbar (sort/filter/actions) + 8 poster grid cards |
| Item Detail | `app/(public)/u/[username]/[itemId]/loading.tsx` | Header bar + full-width backdrop + title/metadata lines + 6 children cards |
| Playlist Detail | `app/(public)/u/[username]/playlists/[playlistId]/loading.tsx` | Header bar + mosaic backdrop + title/description + 6 item rows |
| Explore | `app/(public)/explore/loading.tsx` | Header bar + hero carousel area (21:9 aspect) + tab bar + 12 poster grid cards |

**Routes NOT getting loading.tsx:**

- `/` (Landing) — 363ms TTFB, fast enough
- `/docs/[[...slug]]` — static MDX, instant
- `/legal/[[...slug]]` — static MDX, instant
- Auth pages (`/sign-in`, `/sign-up`, etc.) — simple forms, fast

Each skeleton uses the existing `Skeleton` component (`components/ui/skeleton.tsx`) with `animate-pulse`. Skeletons mirror the actual page layout to prevent layout shift when content replaces them.

### 2. Streaming with Suspense Boundaries

Restructure each page to render a fast shell immediately, then stream heavy content via Suspense:

```
page.tsx (fast: auth + profile) → SiteHeader renders immediately
  └─ <Suspense fallback={<ContentSkeleton />}>
       └─ AsyncContent server component (slow: items, TMDB, progress)
            └─ existing ClientComponent(all props)
     </Suspense>
```

#### My Items (`/u/[username]`)

- **Fast shell** (renders immediately): `SiteHeader` + JSON-LD + `OAuthToast` Suspense
- **Streamed content** (new `ProfileContent` async server component): `getItemsForProfile()`, owner queries (`getGoogleDriveConnection`, `getLibraryProgress`, `getUserPlaylists`), viewer queries (`getPublicLibraryProgress`, `getPublicPlaylistsForUser`) → passes all data to existing `ProfilePageContent` client component
- **Already streamed**: `HomeShelves` (existing Suspense + `ShelfSkeleton`) — moves inside `ProfileContent` to keep the Suspense boundary
- **Skeleton**: `ProfileContentSkeleton` — toolbar + poster grid + shelf rows

#### Explore (`/explore`)

- **Fast shell**: `SiteHeader`
- **Streamed content** (new `ExploreContent` async server component): `getFeaturedItems` + TMDB enrichment chain, `getExploreItems`, `getExplorePlaylists`, sync data query → passes to existing `ExploreClient`
- **Skeleton**: `ExploreContentSkeleton` — hero carousel area + tabs + poster grid

#### Item Detail (`/u/[username]/[itemId]`)

- **Fast shell**: `SiteHeader` (requires `auth` + profile lookup for breadcrumbs — these are fast, ~50ms)
- **Streamed content** (new `ItemContent` / `PublicItemContent` async server components): `getDescendants`, `getItemFiles`, `getItemProgress`, TMDB chain (`resolveTmdbForItem` → `getItemTmdbMetadata` + `getItemTmdbDetails`), `getWatchStatus` → passes to existing `ItemDetailClient` / `PublicItemClient`
- **Skeleton**: `ItemContentSkeleton` — hero backdrop + title + metadata + children grid

#### Playlist Detail (`/u/[username]/playlists/[playlistId]`)

- **Fast shell**: `SiteHeader` (auth + profile for breadcrumbs)
- **Streamed content** (new `PlaylistContent` / `PublicPlaylistContent` async server components): `getPlaylist()` or `getPublicPlaylist()` → passes to existing `PlaylistDetailClient`
- **Skeleton**: `PlaylistContentSkeleton` — mosaic area + title + item rows

**Key constraint**: Existing client components (`ProfilePageContent`, `ExploreClient`, `ItemDetailClient`, `PlaylistDetailClient`) stay unchanged. The new async server components wrap the heavy fetching and pass the same props. No client component restructuring.

**Result**: TTFB drops from ~700ms to ~50ms (shell + Suspense fallback). The browser starts parsing CSS/JS immediately. Content streams in at the same total time, but the user sees the skeleton within 50ms of clicking.

### 3. Query Deduplication

Wrap `getSystemShelfItems()` in `lib/shelf-query-utils.ts` with `React.cache()`:

```ts
import { cache } from "react";

export const getSystemShelfItems = cache(
  async (userId: string, systemType: SystemPlaylistType) => {
    // existing implementation unchanged
  }
);
```

`React.cache()` deduplicates per-request (not across requests), so there is zero risk of stale data. The first call executes the query; the second call within the same server render returns the cached result.

**Impact**: Eliminates ~200–400ms of duplicate work on the My Items page where both `getUserPlaylists()` and `getHomeShelves()` call `getSystemShelfItems()` for the same system playlist types.

### 4. Skeleton Components

Four new route-specific skeleton components, co-located with their `loading.tsx` files:

#### `ProfileContentSkeleton`

- Hero area: round avatar skeleton (96px) + two text lines (name + username) + stats line
- Content toolbar: two button skeletons (sort + filter) + three action skeletons (add + edit + sync)
- Grid: 8 poster card skeletons in responsive grid (`grid-cols-1 md:grid-cols-3 lg:grid-cols-5`, `aspect-[2/3]`)
- Shelf rows: reuses existing `ShelfSkeleton` (3 sections × 8 cards)

#### `ExploreContentSkeleton`

- Hero: full-width backdrop skeleton (`aspect-[21/9]`) with gradient overlay area
- Tab bar: two tab skeletons (Collections + Playlists)
- Grid: 12 poster card skeletons in responsive grid

#### `ItemContentSkeleton`

- Hero: full-width backdrop skeleton with overlaid title line + two metadata lines + tagline
- Content area: description block + children grid (6 poster cards)

#### `PlaylistContentSkeleton`

- Hero: mosaic backdrop area skeleton + playlist title + description line + item count
- Item list: 6 horizontal item row skeletons

All use the existing `Skeleton` component from `components/ui/skeleton.tsx` with Tailwind's `animate-pulse`. Shared across their respective `loading.tsx` (route-level) and Suspense fallback (in-page streaming).

## Testing Strategy

### New tests

#### Unit tests

**`tests/unit/app/loading-skeletons.test.tsx`** — renders each skeleton component, asserts:
- Correct number of `data-slot="skeleton"` elements present
- No missing responsive classes
- Components render without errors

**`tests/unit/lib/shelf-query-cache.test.ts`** — verifies `React.cache()` deduplication:
- Mock underlying shelf query function
- Call `getSystemShelfItems` twice with same arguments in same React render context
- Assert underlying function called only once

#### E2E tests

**`e2e/journeys/navigation/page-transitions.spec.ts`** — new spec testing loading state visibility during sidebar navigation:
- My Items → Explore: skeleton visible, then content replaces it
- Explore → Item Detail (via sidebar pinned item): skeleton visible
- Item Detail → My Items: skeleton visible
- My Items → Playlist Detail: skeleton visible
- Asserts `[data-slot="skeleton"]` appears after click, then disappears when content loads
- Tests both desktop and mobile viewports

### Tests to update

Existing E2E specs that navigate to these four routes may need updated wait strategies. Currently they use `waitForLoadState('domcontentloaded')`, which fires when the shell renders (before Suspense streaming completes). Specs that assert content after navigation should wait for the specific content element:

- `e2e/journeys/items/cinematic-hero.spec.ts` — wait for hero element, not just DOM ready
- `e2e/journeys/public/explore.spec.ts` — wait for grid content, not just DOM ready
- `e2e/journeys/public/explore-features.spec.ts` — same
- Any other spec navigating to My Items, Item Detail, Explore, or Playlist Detail and immediately asserting on streamed content

The pattern change:
```ts
// Before
await page.goto(url);
await page.waitForLoadState('domcontentloaded');

// After
await page.goto(url);
await page.waitForSelector('[data-testid="content-loaded"]');
// OR wait for a specific element that only appears after streaming
```

### Tests NOT changing

- All unit tests for server actions — query logic unchanged
- All integration tests — database queries unchanged
- Storybook stories — component props unchanged
- Unit tests for client components — props interfaces unchanged

### No tests to remove

No existing tests become invalid. We are adding loading states and restructuring server components, not changing client component APIs.

## Files Changed (estimated)

### New files (12)

| File | Purpose |
|------|---------|
| `app/(public)/u/[username]/loading.tsx` | My Items route loading state |
| `app/(public)/u/[username]/[itemId]/loading.tsx` | Item Detail route loading state |
| `app/(public)/u/[username]/playlists/[playlistId]/loading.tsx` | Playlist Detail route loading state |
| `app/(public)/explore/loading.tsx` | Explore route loading state |
| `components/skeletons/profile-content-skeleton.tsx` | My Items page skeleton |
| `components/skeletons/explore-content-skeleton.tsx` | Explore page skeleton |
| `components/skeletons/item-content-skeleton.tsx` | Item Detail page skeleton |
| `components/skeletons/playlist-content-skeleton.tsx` | Playlist Detail page skeleton |
| `tests/unit/app/loading-skeletons.test.tsx` | Skeleton component unit tests |
| `tests/unit/lib/shelf-query-cache.test.ts` | React.cache deduplication test |
| `e2e/journeys/navigation/page-transitions.spec.ts` | Loading state E2E tests |
| `e2e/pages/page-transition.page.ts` | POM for page transition tests (optional) |

### Modified files (5–8)

| File | Change |
|------|--------|
| `app/(public)/u/[username]/page.tsx` | Extract heavy fetching into `ProfileContent` async server component, wrap in Suspense |
| `app/(public)/u/[username]/[itemId]/page.tsx` | Extract into `ItemContent`/`PublicItemContent`, wrap in Suspense |
| `app/(public)/u/[username]/playlists/[playlistId]/page.tsx` | Extract into `PlaylistContent`/`PublicPlaylistContent`, wrap in Suspense |
| `app/(public)/explore/page.tsx` | Extract into `ExploreContent`, wrap in Suspense |
| `lib/shelf-query-utils.ts` | Wrap `getSystemShelfItems` with `React.cache()` |
| E2E specs (2–3 files) | Update wait strategies for streamed content |

## Expected Impact

| Metric | Before | After |
|--------|--------|-------|
| Perceived navigation time | 700–1000ms (frozen page) | <50ms (skeleton appears) |
| My Items TTFB | 695–1065ms | ~50ms (shell), ~600–800ms (streamed content) |
| Explore TTFB | 788ms | ~50ms (shell), ~600ms (streamed content) |
| Item Detail TTFB | 577ms | ~50ms (shell), ~400ms (streamed content) |
| Duplicate shelf queries | 4 extra queries (~200–400ms) | 0 (React.cache deduplication) |

## Risks

- **Suspense boundary placement**: If the Suspense fallback skeleton doesn't match the loading.tsx skeleton, there can be a visual "jump" when the page shell replaces loading.tsx. Mitigated by reusing the same skeleton component in both places.
- **E2E test flakiness**: Streaming means `domcontentloaded` fires before content is visible. Existing E2E tests may need updated waits. Mitigated by auditing all affected specs.
- **`React.cache()` scope**: Only deduplicates within a single server render. If `getSystemShelfItems` is called from different request contexts (e.g., API routes), caching doesn't apply. This is the intended behaviour — no stale data risk.
