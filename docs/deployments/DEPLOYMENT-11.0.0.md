# Deployment 11.0.0

**Date**: 2026-02-27
**Type**: Major (cinematic visual pipeline, TMDB logo support, carousel fade transitions)
**Branch**: `feat/cinematic-visual-pipeline`
**Migration Required**: Yes (3 new fields: `tmdbLogoPath`, `dominantColour`, `isLogo`)

## Overview

End-to-end cinematic visual pipeline that extracts dominant colours from item backdrops and themes the entire page dynamically. TMDB logo support replaces text titles in hero banners with transparent title treatment images. Carousel transitions upgraded from slide-based animation to Embla fade crossfade. The TMDB wizard gains a fifth step for logo selection (movies/shows), and item settings get a logo upload field on both desktop and mobile.

77 files changed, 2,894 insertions, 130 deletions across 19 commits.

## New features

### Cinematic visual pipeline

Four-stage colour theming system: extraction → shading → CSS registration → injection.

1. **Extraction** — `extractDominantColour()` in `lib/colour-extract.ts` uses `sharp.stats()` for colour frequency analysis. `boostSaturation()` ensures vibrant colours within a cinematic dark range (40% min saturation, 25% max lightness).
2. **Shading** — `createColourShades(hex)` in `lib/colour-utils.ts` generates 10 CSS custom property shades (`--dark-100` to `--dark-1000`) from a single hex colour. Client-safe, no external deps.
3. **CSS registration** — 10 `@property` rules in `globals.css` register custom properties with `syntax: "<color>"`, enabling CSS transitions on custom properties (impossible without type registration).
4. **Injection** — `CinematicHero` generates shades from the active slide's `dominantColour`, applies via inline styles, and uses `.transition-colours-pipeline` for 500ms crossfade. Hero overlays switched from hardcoded `rgba()` to `color-mix(in srgb, var(--dark-900) N%, transparent)`.

Page-level propagation via `HeroContentLayout` accepting `dominantColour` prop. Explore page tracks active colour via `onColourChange` callback.

### TMDB logo support

Transparent title treatment images displayed in hero banners instead of text titles.

- `TMDBImages` type extended with `logos: TMDBImage[]` array
- `getBestLogo()` selector prioritises English logos, then highest vote average
- `getLogoUrl()` and `getTmdbLogoUrl()` build CDN URLs
- `CinematicHero` renders logo via `next/image` with responsive `max-w`/`max-h` constraints, `object-contain`, and per-slide error fallback to text title
- Logo resolution priority: manual `isLogo` artwork file > `tmdbLogoPath` > text title fallback

### TMDB wizard logo step

Fifth step for movies and shows (text → poster → hero → logo → summary):

- `LogoSelectionStep` component with tabs (TMDB / existing files) and skip checkbox
- `LogoThumbnail` shared component renders transparent PNGs on `#0a0a0a` background
- `TMDBLogoStep` wraps selection step with navigation and state management
- Auto-select: `applyMetadataAction` calls `getBestLogo()` and `extractDominantColour()` during metadata application

### Logo in item settings

- `FileTypeCombobox` logo field added to both `ItemSettingsDialog` (desktop) and `MobileItemSheet` (mobile)
- `TmdbMetadataSection` shows logo artwork field with change/clear for movies and shows
- `TmdbArtworkChangeDialog` extended with `"logo"` type, rendering `LogoSelectionGrid` instead of `ImageSelectionGrid`
- `clearTmdbFieldAction` extended to accept `"logo"` field
- `useItemSettingsForm` hook gains `logoArtworkId` and `setLogoArtworkId`

### Carousel fade transitions

- Embla Carousel fade plugin (`embla-carousel-fade`) replaces default slide-based animation
- `watchDrag: false` disables drag since fade transitions don't support it
- Smooth crossfade between hero slides instead of horizontal slide

## Changes

### Hero overlay gradients

Hero overlay gradients now use `color-mix(in srgb, var(--dark-900) N%, transparent)` instead of hardcoded `rgba(10, 10, 10, N)`. The gradient is built inline so it resolves `--dark-900` from the hero's own colour scope (inline styles) rather than the `:root` initial value. The `--gradient-hero-overlay` CSS variable in `:root` was updated to use the same `color-mix()` approach.

### Attribution moved to MetadataLine

Attribution text (e.g., "Shared by @username") moved from a standalone paragraph above the title to an inline item within `MetadataLine`. `MetadataLine` gained `attribution` and `attributionHref` props. This consolidates all hero metadata into a single line.

### Hero background colour

`CinematicHero` section element gained `bg-[var(--dark-900)]` to prevent white flash during slide transitions when no backdrop image is loaded.

### Spacing adjustments

Tagline `mt-2` → `mt-5`, progress bar `mt-5` → `mt-6`, actions `mt-5` → `mt-6` to accommodate logo image above title area.

### Explore page background

Removed `bg-background` from explore page wrapper div to allow colour pipeline to bleed through.

### Seed script

`prisma/seed.ts` extended to populate `tmdbLogoPath` and `dominantColour` for seeded items with TMDB backdrops.

## New files

| File | Purpose |
|------|---------|
| `lib/colour-extract.ts` | Server-only dominant colour extraction via sharp stats() |
| `lib/colour-utils.ts` | Client-safe colour shading (createColourShades, boostSaturation, rgbToHex) |
| `components/items/logo-thumbnail.tsx` | Shared logo thumbnail for transparent PNGs with selection state |
| `components/items/logo-selection-grid.tsx` | Logo grid for the artwork change dialog |
| `components/items/wizards/tmdb-wizard/logo-step.tsx` | Logo wizard step wrapper with navigation |
| `components/items/wizards/tmdb-wizard/logo-selection-step.tsx` | Logo selection content with tabs and skip |
| `scripts/reextract-colours.ts` | Utility to backfill dominantColour for existing items |
| `prisma/migrations/20260226_add_logo_colour_fields/migration.sql` | Schema migration for 3 new fields |
| `tests/unit/lib/colour-extract.test.ts` | Unit tests for colour extraction |
| `tests/unit/lib/colour-utils.test.ts` | Unit tests for colour shading |
| `tests/unit/components/items/wizards/tmdb-wizard/logo-step.test.ts` | Unit tests for logo wizard step |

## Deployment notes

### Migration required

Three new fields added via Prisma migration:

```sql
ALTER TABLE "Item" ADD COLUMN "tmdbLogoPath" TEXT;
ALTER TABLE "Item" ADD COLUMN "dominantColour" TEXT;
ALTER TABLE "ItemFile" ADD COLUMN "isLogo" BOOLEAN NOT NULL DEFAULT false;
```

All nullable or defaulted — no data backfill required. Run `prisma migrate deploy` against all Neon branches.

### New dependency

- `embla-carousel-fade` (^8.6.0) — Embla plugin for fade transitions between carousel slides

### Backfill utility

`scripts/reextract-colours.ts` can backfill `dominantColour` for existing items that have TMDB backdrops but no colour yet. Run manually: `npx tsx scripts/reextract-colours.ts`. Processes items in batches of 50 with 200ms delay between items.

### No new environment variables

No new secrets or environment variables required.

### Verification

1. **Build passes**: `pnpm run build`
2. **Type check passes**: `pnpm run type-check`
3. **Unit tests pass**: `pnpm run test`
4. **Integration tests pass**: `pnpm run test:integration` (includes logo/colour persistence tests)
5. **E2E test**: Hero colour theming presence test (`e2e/journeys/items/cinematic-hero.spec.ts`)
6. **Migration**: `prisma migrate deploy` succeeds on all Neon branches
7. **Visual**: Navigate to an item with TMDB metadata → hero shows logo + page tints to dominant colour
8. **Wizard**: Apply TMDB metadata → logo step appears after hero step → logo auto-selected
9. **Settings**: Item settings → Logo field visible on Files tab, TMDB tab shows logo artwork field
10. **Carousel**: Explore page → hero crossfades between slides with smooth colour transitions
