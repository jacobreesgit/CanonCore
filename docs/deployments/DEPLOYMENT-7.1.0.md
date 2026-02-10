# Deployment 7.1.0

**Date**: 2026-02-09
**Type**: Minor (new features, performance improvements)
**Migration Required**: No

## Overview

Adds a dedicated TMDB tab in the item settings dialog for post-wizard display option editing, redesigns the landing page with a cinematic editorial hero and animated feature card grid, improves carousel accessibility, optimises server-side data fetching across public pages, and adds 13 new Storybook story files (30 stories) with real TMDB API integration for about-section and wizard image stories.

52 files changed, 2,245 insertions, 1,161 deletions.

## New features

### TMDB display options in item settings dialog

Items with TMDB metadata now show a **TMDB** tab in the settings dialog. Users can toggle display sections (tagline, metadata, genres, cast, providers, videos, recommendations) without re-running the wizard. Changes auto-save with a 300ms debounce.

**Implementation:**

- `components/items/tmdb-display-options.tsx` — New shared `TmdbDisplayOptionsEditor` component (extracted from wizard summary step)
- `components/items/item-settings-dialog.tsx` — TMDB tab with debounced `updateTmdbDisplayOptions` calls, saving indicator, unmount-safe refs
- `components/items/item-dialog-tabs.tsx` — `ItemDialogTabs` now supports optional `filesContent` and new `tmdbContent` tab with dynamic grid columns (1–3 tabs)
- `lib/tmdb-actions.ts` — New `updateTmdbDisplayOptions()` server action with ownership + TMDB presence validation
- `components/items/wizards/tmdb-wizard/summary-step.tsx` — Refactored to use shared `TmdbDisplayOptionsEditor`
- `hooks/use-settings-dialog.ts` — Passes TMDB display fields through settings dialog lifecycle
- `components/items/item-detail-client.tsx` — Forwards TMDB display fields to settings dialog

### Cinematic landing page redesign

`app/(public)/landing-hero.tsx` rebuilt with centered editorial typography, atmospheric gradient orbs, CTA buttons (Get Started + Explore Collections), and a gradient divider.

**New component:**

- `components/feature-card-grid.tsx` — Animated 3×2 feature card grid using Framer Motion `AnimatePresence` + `layoutId` for hover highlight effects. Each card links to its relevant docs page.

### Hero carousel attribution links

Attribution text in the carousel (e.g., "Shared by @username") now links to the user's public profile.

- `components/hero/types.ts` — Added `attributionHref` field to `HeroSlide`
- `components/hero/cinematic-hero.tsx` — Renders attribution as `<Link>` when `attributionHref` is set
- `app/(public)/explore/explore-client.tsx` — Passes `attributionHref` to carousel slides

### Hero carousel accessibility

- Screen reader `aria-live` announcement on slide changes ("Slide N of M: Title")
- Reduced motion preference now bidirectional — auto-advance resumes if user disables `prefers-reduced-motion`

### Hero avatar glass-morphism redesign

`components/hero/hero-avatar.tsx` — Larger avatar sizes (`size-28` → `size-48` on lg), glass-morphism gradient border ring, glass overlay on initials fallback, updated responsive `sizes` attribute.

## Performance improvements

### Explore page: eliminate double-fetch

`app/(public)/explore/page.tsx` — Previously fetched all items with `null` userId, then re-fetched with the real userId for progress. Now awaits session first and passes `currentUserId` directly, saving one database round-trip for logged-in users.

### Item detail page: concurrent fetch start

`app/(public)/u/[username]/[itemId]/page.tsx` — Both owner and public viewer paths now start non-TMDB fetches (children, files, progress, Drive connection) concurrently with TMDB resolution using explicit promise variables. Previously all fetches waited for TMDB resolution to complete.

### TMDB actions: parallel auth + rate limit

Four server actions (`searchMediaAction`, `getMetadataPreviewAction`, `getEpisodesAction`, `getEpisodePreviewAction`) now run `auth()` and `checkRateLimit()` in parallel via `Promise.all`, following the codebase pattern already used elsewhere.

### Effect cleanup in item detail client

`components/items/item-detail-client.tsx` — File-fetching effect now returns a cleanup function with a `stale` flag, preventing state updates on unmounted components.

## New utilities

| File | Function | Purpose |
|------|----------|---------|
| `lib/tmdb-utils.ts` | `extractTmdbDisplayOptions()` | Converts item DB fields to `TmdbDisplayOptions` object |

## Refactoring

- `components/items/tmdb-display-options.tsx` — Display options checkboxes extracted from wizard `summary-step.tsx` into a shared component
- `components/items/item-dialog-tabs.tsx` — Made `filesContent` optional, added `tmdbContent`, dynamic `grid-cols-{1,2,3}`
- `app/(public)/page.tsx` — Removed `md:overflow-hidden` from landing page main (allows full-page scroll)
- `components/items/recommendations.tsx` — Added `aria-label` to recommendation cards, removed placeholder `href="#"` from `PosterCard`

## Storybook changes

### New story files (13 files, 30 stories)

| File | Stories |
|------|---------|
| `components/hero/cinematic-hero.stories.tsx` | ExploreCarousel, ItemDetailOwner, ItemDetailViewer, AlreadyForked, ProfileViewer, ProfileOwner, NoBackground |
| `components/hero/hero-avatar.stories.tsx` | Default |
| `components/items/cast-row.stories.tsx` | Default |
| `components/items/expandable-description.stories.tsx` | Default |
| `components/items/item-context-menu.stories.tsx` | Default |
| `components/items/item-more-button.stories.tsx` | AllOptions, PinnedItem, Minimal |
| `components/items/recommendations.stories.tsx` | Default, NoPosterImages |
| `components/items/tmdb-display-options.stories.tsx` | AllEnabled, SomeDisabled, AllDisabled |
| `components/items/video-row.stories.tsx` | Default |
| `components/items/watch-providers.stories.tsx` | Default |
| `components/items/wiki-accordion.stories.tsx` | Default |
| `components/profile/preferences-tab.stories.tsx` | Default |
| `components/ui/content-toolbar.stories.tsx` | FullToolbar, SortAndFilter, FilterOnly, Syncing, NoDriveConnection, Disabled, Mobile |
| `components/ui/underline-tabs.stories.tsx` | Default, ThreeTabs, KeyboardNavigation |

### Deleted story files

| File | Reason |
|------|--------|
| `components/hero/hero-carousel.stories.tsx` | Replaced by `cinematic-hero.stories.tsx` |
| `components/items/about-tab-content.stories.tsx` | Split into individual about-section stories (CastRow, VideoRow, etc.) |
| `components/items/item-hero.stories.tsx` | Replaced by `cinematic-hero.stories.tsx` |
| `components/profile/profile-hero.stories.tsx` | Replaced by `cinematic-hero.stories.tsx` |

### Real TMDB API in Storybook

About-section and wizard image stories now fetch real data from the TMDB API instead of hardcoded Inception data. Any movie/show can be displayed by changing the `tmdbId` arg.

**Infrastructure:**

- `.storybook/main.ts` — `webpack.DefinePlugin` injects `TMDB_API_KEY` into the browser bundle
- `.storybook/lib/tmdb.ts` — New browser-safe TMDB client with in-memory cache (`fetchTmdbDetails`, `fetchTmdbOverview`, `fetchTmdbImages`, `fetchEpisodeStills`)

**Modified wizard stories** (now use real TMDB image galleries via Storybook loaders):

| File | New loader-based stories |
|------|--------------------------|
| `wizards/tmdb-wizard/poster-step.stories.tsx` | Default (Inception), TheDarkKnight |
| `wizards/tmdb-wizard/hero-step.stories.tsx` | Default (Inception), Interstellar |
| `wizards/tmdb-wizard/still-step.stories.tsx` | Default (Breaking Bad S01E01), GameOfThrones |

Edge case stories (Skipped, NoPosters, NoBackdrops, NoStills, WithError, etc.) retained with inline data.

## Test changes

### New E2E tests

| Test file | Coverage |
|-----------|----------|
| `e2e/journeys/items/tmdb-display-options.spec.ts` | 3 new tests: TMDB tab visibility, toggle persistence, persistence after reload |

### New integration tests

| Test file | Coverage |
|-----------|----------|
| `tests/integration/tmdb/apply-metadata.test.ts` | `updateTmdbDisplayOptions` — persistence, rejection without TMDB, rejection for missing item |

### New unit tests

| Test file | Coverage |
|-----------|----------|
| `tests/unit/components/items/item-settings-dialog.test.tsx` | 7 new tests: TMDB tab visibility, checkbox states, debounced save, saving indicator, error toast |

### Modified tests

- `tests/unit/components/items/item-detail-client.test.tsx` — Added TMDB display fields to test fixture
- `tests/unit/components/grid.test.tsx` — Added `renderMenuItems` to `ItemContextMenu` mock
- `tests/unit/components/nav-main.test.tsx` — Updated assertion for pinned items auto-expand behaviour
- `tests/unit/lib/public-auth.test.ts` — Added TMDB display fields and `fileCounts` to mock items

## Configuration changes

| File | Change |
|------|--------|
| `components.json` | Added shadcnblocks registry auth header |

## Deployment notes

### No migration needed

All schema changes (TMDB display option columns) were applied in 7.0.0. This release only adds application code that reads/writes those existing columns.

### No environment variable changes

No new variables required.

### Verification

1. **Build passes**: `pnpm run build`
2. **Type check passes**: `pnpm run type-check`
3. **Unit tests pass**: `pnpm run test`
4. **E2E tests pass**: `pnpm run test:e2e --project=chromium`
5. **Landing page**: Visit `/` — cinematic hero with feature cards linking to docs
6. **TMDB tab**: Open settings on an item with TMDB metadata — verify TMDB tab appears with toggles
7. **Attribution links**: Visit `/explore` — click "Shared by @username" links to profile
