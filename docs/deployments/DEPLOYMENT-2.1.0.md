# Deployment 2.1.0 - TMDB Metadata Wizard

**Date**: 2026-01-12
**Branch**: development

## Summary

Choose exactly which metadata to apply with a new 3-step wizard. When you select a TMDB result, the wizard walks you through: title and description options, poster selection from multiple choices, and hero backdrop selection. Combined with unified Add/Edit dialogs and TV episode support, this release gives you complete control over your metadata.

## Features

### Metadata wizard for selective updates

Instead of applying everything at once, the wizard lets you pick and choose. Each step shows previews and lets you skip if you want to keep existing values.

**Step 1: Title & Description**
Toggle which text fields to update. See your current values side-by-side with TMDB data before deciding.

**Step 2: Poster Selection**
Browse all available posters from TMDB, sorted by community rating. Switch to "My Uploads" tab to keep your existing artwork instead.

**Step 3: Hero Selection**
Choose from available backdrops for the hero banner. Same option to use existing uploads or skip entirely.

### Unified Add and Edit dialogs

Both Add Item and Item Settings now use the same MediaSearchCombobox for the name field. Start typing to search TMDB, or just enter text manually. The experience is identical whether creating new items or editing existing ones.

### Categorized file uploads in Add Item dialog

Add Item now uses the same `FileTypeCombobox` component as Item Settings, giving users 4 separate dropzones:

- **Primary Media** - Video/audio files for playback
- **Artwork** - Poster images for thumbnails
- **Hero** - Landscape backdrops for hero banners
- **Default Subtitle** - SRT/VTT/ASS subtitle files

Files queue until the item is created, then upload in order with automatic primary/hero flags. Uses discriminated union types for type-safe props:

```typescript
// Upload-only mode for AddItemDialog
interface FileTypeComboboxUploadModeProps {
  uploadOnly: true;
  queuedFiles: QueuedFile[];
  onQueueFilesChange: (files: QueuedFile[]) => void;
}

// Select mode for ItemSettingsDialog
interface FileTypeComboboxSelectModeProps {
  uploadOnly?: false;
  files: ItemFile[];
  selectedFileId: string | null;
  onSelectFile: (fileId: string | null) => void;
}
```

### TV episode metadata

For TV shows, the system now fetches season and episode data. New server actions support:

- `getSeasonsAction` - List all seasons with episode counts
- `getEpisodesAction` - List episodes for a specific season
- `getEpisodePreviewAction` - Get episode details with still images

### Image gallery APIs

New TMDB client functions fetch complete image galleries:

- `getMovieImages` / `getTVShowImages` - All posters and backdrops
- Images sorted by community vote average
- Path validation prevents malicious injection

### Backdrop/hero image support

TMDB backdrops now upload as hero images (16:9 landscape). The system handles:

- Downloading original quality backdrops
- Uploading to Google Drive with `isHero: true`
- Updating existing hero artwork without duplicates

## Files Changed

### Added

```
components/items/metadata-wizard-modal.tsx      # 3-step wizard dialog
components/items/episode-picker.tsx             # Season/episode selection
components/items/image-selection-grid.tsx       # Poster/backdrop grid component
components/items/hero-selection-step.tsx        # Wizard step for hero selection
components/items/poster-selection-step.tsx      # Wizard step for poster selection
components/items/title-description-step.tsx     # Wizard step for text options
components/items/item-dialog-tabs.tsx           # Tabbed interface component
components/ui/checkbox.tsx                      # shadcn Checkbox component
components/ui/tabs.tsx                          # shadcn Tabs component
tests/unit/components/items/episode-picker.test.tsx
tests/unit/components/items/image-selection-grid.test.tsx
tests/unit/components/items/metadata-wizard-modal.test.tsx
docs/plans/2026-01-12-tmdb-metadata-enhancement-suite.md
docs/plans/2026-01-12-file-type-combobox-upload-only-mode.md
```

### Modified

```
components/items/add-item-dialog.tsx            # MediaSearchCombobox + categorized file uploads
components/items/file-type-combobox.tsx         # uploadOnly mode with discriminated unions
components/items/item-settings-dialog.tsx       # Unified with Add dialog, metadata wizard
components/items/media-search-combobox.tsx      # Empty state when focused
components/profile/settings-dialog.tsx          # Profile dropzone matches hero style
components/ui/tabs.tsx                          # Cursor pointer on triggers
lib/tmdb-actions.ts                             # New actions: preview, images, episodes
lib/tmdb-client.ts                              # New APIs: images, episodes, backdrop download
lib/types.ts                                    # QueuedFile, TMDBMetadataSelection types
lib/rate-limit.ts                               # tmdbPreview, tmdbImages rate limits
lib/item-actions.ts                             # Minor updates
e2e/journeys/items/media-lookup.spec.ts         # Comprehensive E2E coverage
e2e/journeys/items/items-settings.spec.ts       # Description selector fixes
e2e/pages/items.page.ts                         # Updated selectors for unified dialogs
tests/unit/components/items/file-type-combobox.test.tsx
tests/unit/components/items/item-settings-dialog.test.tsx
tests/unit/components/items/media-search-combobox.test.tsx
tests/unit/lib/tmdb-actions.test.ts
tests/unit/lib/tmdb-client.test.ts
tests/integration/tmdb/apply-metadata.test.ts
```

## Technical Details

### Wizard state management

The wizard tracks selections across all three steps. State resets when the modal reopens (component remounts):

```typescript
// Poster selection state
const [posterValue, setPosterValue] = useState<string | null>(null);
const [posterSource, setPosterSource] = useState<"tmdb" | "existing" | null>(
  null
);
const [posterSkipped, setPosterSkipped] = useState(false);
```

The final result distinguishes between TMDB paths and existing file IDs:

```typescript
interface MetadataWizardResult {
  textOptions: TitleDescriptionOptions;
  posterPath: string | null; // TMDB path
  posterFileId: string | null; // Existing file ID
  posterSkipped: boolean;
  backdropPath: string | null;
  backdropFileId: string | null;
  backdropSkipped: boolean;
}
```

### Selective metadata application

The `applyMetadataAction` now accepts options for which fields to update:

```typescript
export interface ApplyMetadataOptions {
  updateName?: boolean;
  updateDescription?: boolean;
  updatePoster?: boolean;
  updateBackdrop?: boolean;
}

// Only update what was selected
await applyMetadataAction(itemId, tmdbId, mediaType, {
  updateName: true,
  updateDescription: false, // Keep existing
  updatePoster: true,
  updateBackdrop: false, // Keep existing
});
```

### Image validation

All TMDB image paths are validated before use to prevent injection:

```typescript
const VALID_IMAGE_PATH_PATTERN = /^\/[a-zA-Z0-9]+\.(jpg|png)$/;

export function isValidImagePath(imagePath: string | null): boolean {
  if (!imagePath) return false;
  return VALID_IMAGE_PATH_PATTERN.test(imagePath);
}
```

### New rate limits

Additional rate limits protect the new endpoints:

```typescript
tmdbPreview: { limit: 20, window: "1m" },
tmdbImages: { limit: 10, window: "1m" },
```

## Dialog Pathways

Comprehensive E2E coverage for all user flows in both Add Item and Item Settings dialogs.

### AddItemDialog Pathways (7 paths)

| Path | Description                              | Test Coverage                                    |
| ---- | ---------------------------------------- | ------------------------------------------------ |
| 1    | Manual entry without TMDB                | Type name → Create → Item appears                |
| 2    | Manual entry with description            | Type name + description → Create                 |
| 3    | TMDB search shows results                | Type movie name → Results dropdown appears       |
| 4    | TMDB search no results → manual fallback | Search obscure term → No results → Type manually |
| 5    | Focused empty input shows helper         | Focus name field → "Type to search" hint visible |
| 6    | Create button disabled when empty        | Empty name → Button disabled; Add text → Enabled |
| 7    | Cancel closes without creating           | Type name → Cancel → Dialog closes, no item      |

### ItemSettingsDialog Pathways (8 paths)

| Path | Description                         | Test Coverage                                      |
| ---- | ----------------------------------- | -------------------------------------------------- |
| 1    | Manual rename                       | Change name → Save → Item renamed                  |
| 2    | Update description only             | Add/edit description → Save → Description persists |
| 3    | Shows current item name             | Open settings → Name field pre-filled              |
| 4    | Save button disabled when unchanged | No changes → Disabled; Make change → Enabled       |
| 5    | Empty name shows error              | Clear name → Save → "Name is required" toast       |
| 6    | TMDB search available               | Type in name field → Search results appear         |
| 7    | Cancel closes without saving        | Make changes → Cancel → Original values preserved  |
| 8    | Tabs navigation                     | Details tab ↔ Files tab switching works            |

### Dialog Consistency (2 paths)

| Path | Description                         | Test Coverage                               |
| ---- | ----------------------------------- | ------------------------------------------- |
| 1    | Both dialogs have "Item name" field | Add and Edit both use same label            |
| 2    | Both use MediaSearchCombobox        | Same TMDB search experience in both dialogs |

### Edge Cases (2 paths)

| Path | Description                   | Test Coverage                      |
| ---- | ----------------------------- | ---------------------------------- |
| 1    | Special characters in name    | Numbers, spaces work correctly     |
| 2    | Whitespace-only name rejected | " " → Create button stays disabled |

## Test Results

| Suite       | Result     |
| ----------- | ---------- |
| Unit tests  | 964 passed |
| Integration | 82 passed  |
| E2E Desktop | 180 passed |
| E2E Mobile  | 176 passed |
| Lint        | 0 errors   |
| Types       | 0 errors   |
| Knip        | 0 unused   |

New test coverage includes:

- Metadata wizard modal tests (step navigation, selections)
- Episode picker tests (season/episode loading)
- Image selection grid tests (TMDB and existing tabs)
- FileTypeCombobox uploadOnly mode tests (22 tests)
- Media-lookup E2E tests (19 dialog pathways across 4 test suites)

## Deployment Steps

1. Pull latest changes
2. Run `pnpm install` (no new dependencies)
3. Run `pnpm run check` to verify build
4. Deploy to Vercel

No new environment variables or migrations required.

## Version History

| Version | Date       | Summary                                       |
| ------- | ---------- | --------------------------------------------- |
| 2.1.0   | 2026-01-12 | TMDB metadata wizard with selective updates   |
| 2.0.0   | 2026-01-12 | TMDB metadata integration                     |
| 1.6.0   | 2026-01-11 | Spotlight search with artwork and breadcrumbs |
| 1.5.0   | 2026-01-11 | Dropzone upload for settings dialog           |
| 1.4.0   | 2026-01-11 | Google Drive improvements, sidebar cleanup    |
| 1.3.0   | 2026-01-10 | Dedicated password and email change modals    |
