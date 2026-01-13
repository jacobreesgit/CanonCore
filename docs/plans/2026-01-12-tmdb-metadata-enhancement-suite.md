# TMDB Metadata Enhancement Suite

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Date:** 2026-01-12
**Status:** Validated
**Replaces:** 2026-01-12-item-hero-and-metadata-enhancements.md, 2026-01-12-tmdb-metadata-wizard.md

## Overview

Enhance the TMDB metadata experience with a confirmation dialog, tabbed settings interface, backdrop hero images, and rich image selection. Built in three phases for incremental delivery.

## Current State (v2.0.0)

Already implemented:

- MediaSearchCombobox for TMDB search
- Immediate metadata apply (name, description, poster)
- Poster upload to Google Drive
- Description field expanded to 1000 chars
- Seed system with TMDB integration

## Goals

1. Add confirmation dialog before applying metadata (checkboxes for each field)
2. Reorganize Item Settings into tabbed interface (Details/Files)
3. Download TMDB backdrops as hero images (16:9 landscape)
4. Add image selection grids for poster and hero
5. Support episode hierarchical drill-down (show → season → episode)

---

## Phase A: Foundation

**Scope:** Simple confirmation + tabs + backdrop support
**Effort:** 3-4 days

### A1. Tabbed Item Settings Dialog

Reorganize the growing settings dialog into two tabs:

**Details Tab:**

- Name input
- Description textarea
- Metadata Lookup (MediaSearchCombobox)

**Files Tab:**

- Primary Media (FileTypeCombobox)
- Primary Artwork (FileTypeCombobox)
- Hero Image (FileTypeCombobox) - always visible, not just when 2+ artwork
- Default Subtitle (FileTypeCombobox)

```
┌─────────────────────────────────────────┐
│ Item Settings                           │
├─────────────────────────────────────────┤
│ [Details] [Files]                       │
├─────────────────────────────────────────┤
│ Name: [___________________________]     │
│                                         │
│ Description:                            │
│ [___________________________________]   │
│ [___________________________________]   │
│                                         │
│ Lookup Metadata:                        │
│ [Search movies & TV shows...        🔍] │
│                                         │
│              [Cancel] [Save Changes]    │
└─────────────────────────────────────────┘
```

**Files:** `components/items/item-settings-dialog.tsx`

### A2. Metadata Confirmation Dialog

When user selects a TMDB result, show confirmation dialog:

```
┌─────────────────────────────────────────┐
│ Apply Metadata from TMDB                │
├─────────────────────────────────────────┤
│ Select which fields to update:          │
│                                         │
│ ☑ Name                                  │
│   "My Movie" → "The Shawshank           │
│   Redemption (1994)"                    │
│                                         │
│ ☑ Description                           │
│   "" → "Andy Dufresne, a banker..."     │
│                                         │
│ ☑ Poster (Primary Artwork)              │
│   [none] → [thumbnail]                  │
│                                         │
│ ☑ Backdrop (Hero Image)                 │
│   [none] → [thumbnail]                  │
│                                         │
│              [Cancel] [Apply Selected]  │
└─────────────────────────────────────────┘
```

- All checkboxes checked by default (quick apply)
- User can uncheck to preserve existing data
- Shows before/after preview

**Files:** `components/items/metadata-confirm-dialog.tsx`

### A3. Backdrop Support in TMDB Client

TMDB provides two image types:

| Field           | Aspect         | Content                 |
| --------------- | -------------- | ----------------------- |
| `poster_path`   | 2:3 portrait   | Movie poster with title |
| `backdrop_path` | 16:9 landscape | Scene shots, textless   |

Add to `lib/tmdb-client.ts`:

```typescript
export async function downloadBackdrop(
  backdropPath: string | null
): Promise<Buffer | null> {
  const url = getBackdropUrl(backdropPath, "w1280");
  if (!url) return null;
  // Same pattern as downloadPoster
}

export function getBackdropUrl(
  backdropPath: string | null,
  size: "w300" | "w780" | "w1280" | "original" = "w1280"
): string | null {
  if (!backdropPath) return null;
  return `${TMDB_IMAGE_BASE}/${size}${backdropPath}`;
}
```

### A4. Update applyMetadataAction

Accept field selection options:

```typescript
interface ApplyMetadataOptions {
  updateName?: boolean;
  updateDescription?: boolean;
  updatePoster?: boolean;
  updateBackdrop?: boolean;
}

export async function applyMetadataAction(
  itemId: string,
  tmdbId: number,
  mediaType: "movie" | "tv",
  options: ApplyMetadataOptions = {
    updateName: true,
    updateDescription: true,
    updatePoster: true,
    updateBackdrop: true,
  }
): Promise<ActionResult>;
```

Add preview action for confirmation dialog:

```typescript
export async function getMetadataPreviewAction(
  tmdbId: number,
  mediaType: "movie" | "tv"
): Promise<
  ActionResult<{
    name: string;
    description: string;
    posterUrl: string | null;
    backdropUrl: string | null;
  }>
>;
```

### A5. Update Seed for Backdrops

For movies and TV show parents:

- Download poster (w1280) → Primary Artwork
- Download backdrop (w1280) → Hero Image (isHero: true)

For episodes:

- Download poster only (no backdrop needed)

---

## Phase B: Rich Image Selection

**Scope:** Convert dialog to wizard, add image grids
**Effort:** 2-3 days
**Depends on:** Phase A complete

### B1. TMDB Images API

Add functions to fetch all available images:

```typescript
interface TMDBImage {
  file_path: string;
  vote_average: number;
  iso_639_1: string | null; // null = textless
  width: number;
  height: number;
}

interface TMDBImages {
  backdrops: TMDBImage[];
  posters: TMDBImage[];
}

export async function getMovieImages(id: number): Promise<TMDBImages | null>;
export async function getTVShowImages(id: number): Promise<TMDBImages | null>;
export function getBestTextlessBackdrop(images: TMDBImages): string | null;
```

### B2. Image Selection Grid

Reusable tabbed grid component:

```
┌─────────────────────────────────────────┐
│ Select Poster                           │
├─────────────────────────────────────────┤
│ [From TMDB] [My Uploads]                │
├─────────────────────────────────────────┤
│ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐         │
│ │ ✓  │ │     │ │     │ │     │         │
│ │     │ │     │ │     │ │     │         │
│ └─────┘ └─────┘ └─────┘ └─────┘         │
│ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐         │
│ │     │ │     │ │     │ │     │         │
│ │     │ │     │ │     │ │     │         │
│ └─────┘ └─────┘ └─────┘ └─────┘         │
│                                         │
│ ☐ Skip poster selection                 │
└─────────────────────────────────────────┘
```

- From TMDB: Fetches `/movie/{id}/images`, sorts by vote average
- My Uploads: Shows existing artwork files
- First image pre-selected
- Skip checkbox available

**Files:** `components/items/image-selection-grid.tsx`

### B3. Convert to Wizard

Replace confirmation dialog with 3-step wizard:

1. **Step 1: Title & Description** - Checkboxes to apply (from Phase A)
2. **Step 2: Poster Selection** - Image grid
3. **Step 3: Hero Selection** - Image grid with backdrops

```
┌─────────────────────────────────────────┐
│ Apply Metadata     Step 2 of 3          │
├─────────────────────────────────────────┤
│ Select Poster                           │
│                                         │
│ [Image Selection Grid]                  │
│                                         │
│         [Back] [Next] [Skip All]        │
└─────────────────────────────────────────┘
```

**Files:**

- `components/items/metadata-wizard-modal.tsx`
- `components/items/title-description-step.tsx`
- `components/items/poster-selection-step.tsx`
- `components/items/hero-selection-step.tsx`

---

## Phase C: Episode Support

**Scope:** Hierarchical drill-down for TV shows
**Effort:** 2 days
**Depends on:** Phase B complete

### C1. Episode Picker

When user selects a TV show, enable drill-down:

1. Search results → Select show
2. Season list → Pick season (with episode counts)
3. Episode list → Pick episode
4. Wizard opens with episode metadata

```
┌─────────────────────────────────────────┐
│ Select Season                           │
├─────────────────────────────────────────┤
│ Breaking Bad (2008)                     │
│                                         │
│ ▶ Season 1 (7 episodes)                 │
│ ▶ Season 2 (13 episodes)                │
│ ▶ Season 3 (13 episodes)                │
│ ▶ Season 4 (13 episodes)                │
│ ▶ Season 5 (16 episodes)                │
│                                         │
│ [Use Show Metadata Instead]    [Cancel] │
└─────────────────────────────────────────┘
```

Escape hatches at each level:

- "Use Show Metadata Instead"
- "Use Season Metadata Instead"

### C2. Episode Metadata API

Add functions:

```typescript
export async function getTVSeasons(showId: number): Promise<TMDBSeason[]>;
export async function getTVEpisodes(
  showId: number,
  seasonNumber: number
): Promise<TMDBEpisode[]>;
export async function getEpisodeDetails(
  showId: number,
  seasonNumber: number,
  episodeNumber: number
): Promise<TMDBEpisodeDetails>;
```

**Files:** `components/items/episode-picker.tsx`

---

## Validation Checklist

Validated using code-review-excellence, Context7 (codebase analysis), and sequential thinking.

### Blocking Issues (Must Address in Phase A)

| #   | Issue                                                                          | Resolution                                      |
| --- | ------------------------------------------------------------------------------ | ----------------------------------------------- |
| 1   | `components/ui/tabs.tsx` doesn't exist                                         | Run `npx shadcn@latest add tabs` before A1      |
| 2   | `backdrop_path` missing from TMDBMovie/TMDBTVShow interfaces in tmdb-client.ts | Add to interfaces (lines 23-29, 32-39)          |
| 3   | `getBackdropUrl()` and `downloadBackdrop()` don't exist                        | Add functions as specified in A3                |
| 4   | `applyMetadataAction` has no options parameter (lines 91-95)                   | Update signature to accept ApplyMetadataOptions |
| 5   | `getMetadataPreviewAction` doesn't exist                                       | Create new action as specified in A4            |
| 6   | Hero Image picker conditional on hasMultipleArtwork (line 453)                 | Remove condition - always show per A1 spec      |

### Important Issues (Addressed in Plan)

| #   | Issue                                           | Resolution                                                   |
| --- | ----------------------------------------------- | ------------------------------------------------------------ |
| 7   | Confirmation dialog needs current item values   | A2 shows before/after preview - fetch in handleApplyMetadata |
| 8   | Backdrop aspect ratio differs from poster       | Use w1280 for backdrops (16:9), w500 for posters (2:3)       |
| 9   | TMDB images API adds more requests              | Use existing circuit breaker, add 100ms delay                |
| 10  | No rate limit key for backdrop/images endpoints | Extend rate-limit.ts with `tmdbImages` key                   |
| 11  | Image grid could be slow with many images       | Lazy load, limit initial display to 12 (Phase B)             |

### Suggestions (Incorporated)

| #   | Suggestion                               | Resolution                                          |
| --- | ---------------------------------------- | --------------------------------------------------- |
| 12  | Remember last selected tab               | Use localStorage for tab persistence                |
| 13  | Show image dimensions in grid            | Add small badge with resolution (Phase B)           |
| 14  | Add "textless only" filter for backdrops | Filter by `iso_639_1: null` (Phase B)               |
| 15  | Cancel confirmation if unsaved changes   | Add dirty state tracking (already exists in dialog) |
| 16  | Preload next step images                 | Prefetch during current step (Phase B)              |

---

## Test Plan

### Phase A Tests

**Unit Tests (New):**

- `tests/unit/components/items/metadata-confirm-dialog.test.tsx`
  - Renders checkbox list with current/new values
  - Checkboxes default to checked
  - Unchecking excludes field from apply
  - Cancel closes without applying
  - Apply calls action with selected options

- `tests/unit/lib/tmdb-client.test.ts`
  - Add tests for `downloadBackdrop()`
  - Add tests for `getBackdropUrl()`

**Unit Tests (Update):**

- `tests/unit/components/items/item-settings-dialog.test.tsx`
  - Test tabbed interface
  - Test tab switching
  - Test Hero Image always visible

- `tests/unit/lib/tmdb-actions.test.ts`
  - Update for options param
  - Add getMetadataPreviewAction tests

### Phase B Tests

**Unit Tests (New):**

- `tests/unit/components/items/image-selection-grid.test.tsx`
- `tests/unit/components/items/metadata-wizard-modal.test.tsx`
- `tests/unit/lib/tmdb-client.test.ts` (getMovieImages, getTVShowImages)

### Phase C Tests

**Unit Tests (New):**

- `tests/unit/components/items/episode-picker.test.tsx`
- `tests/unit/lib/tmdb-client.test.ts` (getTVSeasons, getTVEpisodes)

### E2E Tests

- `e2e/journeys/items/metadata-wizard.spec.ts`
  - Full flow: search → confirm → select images → apply
  - Test unchecking fields preserves data
  - Test in both Add Item and Item Settings

---

## Security Review

- [ ] TMDB API key remains server-side only (tmdb-client.ts uses server-only functions)
- [ ] User input validated before API calls (tmdbId is number, mediaType is union type)
- [ ] Image URLs validated: only allow `image.tmdb.org` domain in getBackdropUrl/getPosterUrl
- [ ] Rate limiting applied to image endpoints (add `tmdbImages` rate limit key)
- [ ] No XSS vectors in TMDB descriptions (React escapes by default)
- [ ] Backdrop/poster paths validated: must start with "/" and contain only valid characters

## Performance Review

- [ ] Image grid lazy loads (only visible images)
- [ ] Backdrop downloads use w1280 (not original)
- [ ] TMDB API calls cached per session
- [ ] Wizard steps prefetch next step data
- [ ] No N+1 queries for existing artwork files

---

## Implementation Order

### Phase A

0. Install Tabs component: `npx shadcn@latest add tabs`
1. Add backdrop_path to TMDBMovie/TMDBTVShow interfaces
2. Add getBackdropUrl and downloadBackdrop to tmdb-client.ts
3. Add tabbed interface to ItemSettingsDialog (Details/Files tabs)
4. Make Hero Image picker always visible (remove hasMultipleArtwork condition)
5. Update applyMetadataAction with ApplyMetadataOptions parameter
6. Add getMetadataPreviewAction for confirmation dialog
7. Create MetadataConfirmDialog component with field checkboxes
8. Integrate confirmation dialog into handleApplyMetadata
9. Update seed for backdrop downloads (isHero: true)
10. Add/update tests

### Phase B

1. Add getMovieImages/getTVShowImages to tmdb-client.ts
2. Create ImageSelectionGrid component
3. Create wizard modal with 3 steps
4. Replace confirmation dialog with wizard
5. Add/update tests

### Phase C

1. Add episode API functions
2. Create EpisodePicker component
3. Integrate with wizard
4. Add/update tests

---

## Out of Scope

- Bulk metadata application to multiple items
- Auto-refresh of TMDB data over time
- Alternative image sources (Fanart.tv, etc.)
- Person metadata (actors, directors)
- Collection metadata (film series grouping)
