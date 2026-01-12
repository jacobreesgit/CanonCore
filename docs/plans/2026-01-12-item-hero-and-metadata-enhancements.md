# Item Hero Images & Metadata Enhancements

**Date:** 2026-01-12
**Status:** Draft

## Overview

Enhance items with dedicated hero images, improve the metadata lookup UX with a confirmation dialog, and reorganize Item Settings into a tabbed interface.

## Goals

1. Add hero image support for items (separate from primary artwork)
2. Use TMDB backdrop images as hero source (textless, high quality)
3. Add confirmation dialog with checkboxes when applying metadata
4. Reorganize Item Settings into tabbed interface
5. Add metadata lookup to Add Item dialog
6. Update seed to download high-quality backdrops for hero banners

## Design

### 1. Item Hero Image Field

Add `isHero` field to ItemFile (already exists in schema). The hero image is separate from primary artwork:

- **Primary Artwork**: Used as thumbnail in grid/tree views
- **Hero Image**: Used as banner background on detail pages

When multiple artwork files exist, user can designate one as hero via Item Settings.

### 2. TMDB Backdrop Integration

TMDB provides two image types:

| Field           | Aspect         | Content                       |
| --------------- | -------------- | ----------------------------- |
| `poster_path`   | 2:3 portrait   | Movie poster with title text  |
| `backdrop_path` | 16:9 landscape | Scene shots, usually textless |

**Image quality**: Use `w1280` for both posters and backdrops (high quality, reasonable file size).

Update `tmdb-client.ts`:

- Add `downloadBackdrop()` function
- Add `backdrop_path` to TMDBMovie and TMDBTVShow interfaces (already present in seed types)

### 3. Metadata Confirmation Dialog

When user selects a TMDB result, show confirmation dialog before applying:

```
┌─────────────────────────────────────────────┐
│  Apply Metadata from TMDB                   │
├─────────────────────────────────────────────┤
│  Select which fields to update:             │
│                                             │
│  ☑ Name                                     │
│    "My Movie" → "The Shawshank Redemption   │
│                  (1994)"                    │
│                                             │
│  ☑ Description                              │
│    "..." → "Andy Dufresne, a banker who..." │
│                                             │
│  ☑ Poster (Primary Artwork)                 │
│    [current] → [new thumbnail]              │
│                                             │
│  ☑ Backdrop (Hero Image)                    │
│    [none] → [new image]                     │
│                                             │
├─────────────────────────────────────────────┤
│              [Cancel]  [Apply Selected]     │
└─────────────────────────────────────────────┘
```

- All checkboxes checked by default (quick apply still one-click after selection)
- User can uncheck fields to preserve existing data
- Shows before/after preview for each field

**New component**: `MetadataConfirmDialog`

### 4. Tabbed Item Settings Dialog

Reorganize the growing Item Settings dialog into two tabs:

**Details Tab:**

- Name input
- Description textarea
- Metadata Lookup (TMDB search combobox)

**Files Tab:**

- Primary Media (FileTypeCombobox)
- Primary Artwork (FileTypeCombobox)
- Hero Image (FileTypeCombobox) - always visible, not just when 2+ artwork
- Default Subtitle (FileTypeCombobox)

Use shadcn/ui Tabs component for the tabbed interface.

### 5. Add Item Dialog

Update Add Item to match Details tab layout:

- Name input
- Description textarea
- Metadata Lookup (TMDB search combobox)

No tabs needed - Files section not relevant until item exists. When metadata is applied during creation:

1. Item created with name/description
2. Poster and backdrop downloaded in background after creation
3. User can open Item Settings to see/modify files

### 6. Seed Improvements

Update seed to download high-quality backdrop images:

**For movies and TV show parents:**

- Download poster (w1280) → Primary Artwork
- Download backdrop (w1280) → Hero Image

**For episodes:**

- Download poster only (w1280) → Primary Artwork
- No backdrop (episodes don't need hero banners)

Update `prisma/seed.ts`:

- Add `downloadBackdrop()` function using w1280 size
- Create two ItemFile records for top-level items (poster + backdrop)
- Set `isHero: true` on backdrop file

## API Changes

### tmdb-client.ts

```typescript
// Add backdrop download function
export async function downloadBackdrop(
  backdropPath: string | null
): Promise<Buffer | null> {
  const url = getBackdropUrl(backdropPath, "w1280");
  if (!url) return null;
  // ... same pattern as downloadPoster
}

// Add backdrop URL helper
export function getBackdropUrl(
  backdropPath: string | null,
  size: BackdropSize = "w1280"
): string | null {
  if (!backdropPath) return null;
  return `${TMDB_IMAGE_BASE}/${size}${backdropPath}`;
}

// Update poster to use w1280
export async function downloadPoster(
  posterPath: string | null
): Promise<Buffer | null> {
  const url = getPosterUrl(posterPath, "w1280"); // Changed from w500
  // ...
}
```

### tmdb-actions.ts

Update `applyMetadataAction` to accept field selection:

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

Add new action to fetch metadata preview (for confirmation dialog):

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

## Component Changes

### New Components

1. **MetadataConfirmDialog** (`components/items/metadata-confirm-dialog.tsx`)
   - Props: `open`, `onOpenChange`, `currentItem`, `tmdbResult`, `onConfirm`
   - Shows checkbox list with before/after preview
   - Calls `applyMetadataAction` with selected options

### Updated Components

1. **ItemSettingsDialog** (`components/items/item-settings-dialog.tsx`)
   - Add Tabs wrapper with Details and Files tabs
   - Move Metadata Lookup to Details tab
   - Move all FileTypeCombobox components to Files tab
   - Hero Image always visible (not conditional on artwork count)
   - Integrate MetadataConfirmDialog

2. **AddItemDialog** (`components/items/add-item-dialog.tsx`)
   - Add Description textarea
   - Add MediaSearchCombobox for metadata lookup
   - Integrate MetadataConfirmDialog
   - After creation, trigger background download of poster/backdrop

3. **MediaSearchCombobox** (`components/items/media-search-combobox.tsx`)
   - No changes needed - already works with the v3 API key fix

## Database Changes

No schema changes needed. The `isHero` field already exists on ItemFile.

## Test Plan

### Unit Tests (Add)

- `tests/unit/components/items/metadata-confirm-dialog.test.tsx`
  - Renders checkbox list with current/new values
  - Checkboxes default to checked
  - Unchecking excludes field from apply
  - Cancel closes without applying
  - Apply calls action with selected options

- `tests/unit/lib/tmdb-client.test.ts`
  - Add tests for `downloadBackdrop()`
  - Add tests for `getBackdropUrl()`
  - Update `downloadPoster()` tests for w1280

### Unit Tests (Update)

- `tests/unit/components/items/item-settings-dialog.test.tsx`
  - Update for tabbed interface
  - Test tab switching
  - Test Hero Image always visible

- `tests/unit/components/add-item-dialog.test.tsx`
  - Add metadata lookup tests
  - Test confirmation dialog integration

- `tests/unit/lib/tmdb-actions.test.ts`
  - Update `applyMetadataAction` tests for options param
  - Add `getMetadataPreviewAction` tests

### Integration Tests (Update)

- `tests/integration/tmdb/apply-metadata.test.ts`
  - Test selective field updates
  - Test backdrop download and storage

### E2E Tests (Add)

- `e2e/journeys/items/metadata-lookup.spec.ts`
  - Test full flow: search → select → confirm → apply
  - Test unchecking fields preserves data
  - Test in both Add Item and Item Settings

### Seed Tests (Update)

- `tests/unit/prisma/seed.test.ts`
  - Test backdrop download for movies/shows
  - Test no backdrop for episodes
  - Test w1280 image quality

## Implementation Order

1. Fix TMDB v3 auth (DONE)
2. Add backdrop support to tmdb-client.ts
3. Update tmdb-actions.ts with options and preview
4. Create MetadataConfirmDialog component
5. Update ItemSettingsDialog to tabbed layout
6. Integrate confirmation dialog into ItemSettingsDialog
7. Update AddItemDialog with description and metadata lookup
8. Update seed for backdrop downloads
9. Add/update tests
10. E2E testing

## Out of Scope

- Bulk metadata application
- Auto-refresh of TMDB data
- Alternative image sources beyond TMDB
