# Deployment 3.0.0 - Progress Tracking & Simplified Grid

**Date**: 2026-01-18
**Branch**: development

## Summary

Items now display progress bars showing how much content has been watched across the entire hierarchy. Progress is calculated as watched items divided by items with media, where "watched" means the primary media file is >= 90% complete. Grid cards have been simplified by removing the stats row for a cleaner appearance.

## Features

### Progress bars across item hierarchies

Visual progress tracking now appears on ItemHero, GridItem, and TreeItem:

**How progress is calculated:**

- Progress = watched items / items with media
- An item is "watched" when its primary media file is >= 90% complete
- Progress aggregates across the item and ALL its descendants
- Progress bar shows at 0% when media files exist but none watched
- Progress bar hidden when no media files in subtree

**Display locations:**

- **ItemHero**: Progress bar below stats with label (e.g., "5/10 watched (of 15 items)")
- **GridItem**: Thin progress bar at bottom of card
- **TreeItem**: Small inline progress bar next to name

**Edit mode behavior:**

Progress bars are hidden during edit mode (drag-and-drop reordering) to reduce visual clutter.

### Item-based progress with total counts

Progress now counts items, not files:

**Old format:** `5/10` (5 of 10 media files watched)

**New format:** `5/10 watched (of 15 items)` (5 of 10 items with media watched, 15 total items)

**Edge cases:**

| Scenario                                           | Display                      |
| -------------------------------------------------- | ---------------------------- |
| Movies folder: 5 watched, 10 with media, 15 total  | `5/10 watched (of 15 items)` |
| TV show: 8 episodes watched, 10 episodes, 12 items | `8/10 watched (of 12 items)` |
| Folder with 3 empty subfolders                     | `(3 items)`                  |
| Single movie, unwatched                            | `0/1 watched (of 1 item)`    |
| Empty leaf item                                    | Nothing (null)               |

### Simplified grid cards

The stats row has been removed from grid cards:

**Removed from GridItem:**

- Media file count
- Artwork count
- Subtitle count
- Child item count

**Why:** Progress bars and "(of X items)" text now provide item count context. The stats row was redundant and added visual clutter.

### Seed playback simulation

The seed system now generates realistic playback data:

**Watch state distribution:**

- ~25% unwatched (no position)
- ~25% partially watched (30-50%)
- ~25% almost done (70-85%, below 90% threshold)
- ~25% complete (91-100%)

**Duration ranges:**

- Movies: 1.5-3 hours (5400-10800 seconds)
- Episodes: 30-70 minutes (1800-4200 seconds)

**Configuration:**

```bash
SEED_SIMULATE_PLAYBACK=false  # Disable playback simulation
```

## Files Changed

### Added

```
lib/progress-utils.ts                              # Progress calculation utilities
tests/unit/lib/progress-utils.test.ts              # Unit tests for progress utils
tests/integration/items/item-progress.test.ts      # Integration tests for progress
e2e/journeys/items/item-progress.spec.ts           # E2E tests for progress bars
docs/plans/2026-01-18-descendant-progress-bars.md  # Design document
docs/plans/2026-01-18-progress-display-item-counts.md  # Design document
```

### Modified

```
lib/types.ts                                       # ItemProgress type, progress fields
lib/item-actions.ts                                # buildDescendantProgressMap, progress in getItems
lib/item-utils.ts                                  # Pass through progressPercentage in itemsToTree
components/items/item-hero.tsx                     # Progress bar, progress label props
components/items/item-detail-client.tsx            # Pass progress to ItemHero
components/items/items-view.tsx                    # Wire up progress to Grid/Tree
components/sortable-grid/GridItem.tsx              # Remove ItemStats, add progress bar
components/sortable-grid/Grid.tsx                  # Remove stats props
components/sortable-grid/SortableGrid.tsx          # Remove stats props
components/sortable-grid/SortableGridItem.tsx      # Remove stats props
components/sortable-tree/Tree.tsx                  # Pass progressPercentage
components/sortable-tree/components/TreeItem/*.tsx # Progress bar display
app/(my-items)/my-items/page.tsx                   # Pass progress to hero
app/(my-items)/my-items/[itemId]/page.tsx          # Pass progress to detail
prisma/seed.ts                                     # Playback simulation
prisma/seed-config.ts                              # SEED_SIMULATE_PLAYBACK, durations
```

### Test files modified

```
tests/unit/components/grid-item.test.tsx           # Remove stats tests, add progress tests
tests/unit/components/grid.test.tsx                # Update for removed props
tests/unit/components/sortable-grid.test.tsx       # Update for removed props
tests/unit/components/sortable-grid-item.test.tsx  # Update for removed props
tests/unit/components/items/item-hero.test.tsx     # Add progress bar tests
tests/unit/components/items/item-detail-client.test.tsx  # Update progress mocks
tests/unit/components/items-view.test.tsx          # Update for progress
tests/unit/lib/item-utils-sort-filter.test.ts      # Update for progress field
tests/unit/prisma/seed-config.test.ts              # Playback config tests
tests/unit/prisma/seed.test.ts                     # Playback simulation tests
```

### Deleted

```
docs/plans/2026-01-17-continue-watching-progress.md  # Superseded by new plans
```

## Test Results

| Suite       | Tests | Result     |
| ----------- | ----- | ---------- |
| Unit        | 1347  | All passed |
| Integration | 102   | All passed |
| E2E         | ~430  | All passed |

## API Changes

### New progress utilities

```typescript
// lib/progress-utils.ts

/** Threshold percentage to consider a file complete (90%). */
export const COMPLETION_THRESHOLD = 0.9;

/**
 * Determines if a media file is considered complete.
 * Complete = position >= 90% of duration.
 */
export function isFileComplete(
  position: number | null,
  duration: number | null
): boolean;

/**
 * Progress data for an item (self + all descendants).
 */
export interface ItemProgress {
  /** Items with primary media that are >= 90% watched */
  watchedItems: number;
  /** Items that have a primary media file */
  itemsWithMedia: number;
  /** Progress percentage (0-100), null if no items with media */
  percentage: number | null;
  /** Total descendant items (including self) */
  totalItems: number;
}

/**
 * Calculates progress from item data.
 */
export function calculateProgress(/* ... */): ItemProgress;

/**
 * Formats progress as a label string.
 * Returns: "5/10 watched (of 15 items)" or "(3 items)" or null
 */
export function formatProgressLabel(progress: ItemProgress): string | null;
```

### Updated types

```typescript
// lib/types.ts

// Re-export ItemProgress
export type { ItemProgress } from "./progress-utils";

// Added to ItemWithArtwork
interface ItemWithArtwork {
  // ... existing fields
  progress: ItemProgress | null;
}

// Added to TreeItem
interface TreeItem {
  // ... existing fields
  progressPercentage?: number | null;
}
```

### Updated ItemHero props

```typescript
// components/items/item-hero.tsx
interface ItemHeroProps {
  // ... existing props
  progressPercentage?: number | null;
  progressLabel?: string | null;
  watchedCount?: number;
  totalMediaCount?: number;
  totalItems?: number;
}
```

### Removed GridItem props

```typescript
// components/sortable-grid/GridItem.tsx
// REMOVED:
showCounts?: boolean;
fileCounts?: FileCounts;
childCount?: number;
mediaIconType?: "film" | "music" | "mixed" | null;
```

### New seed configuration

```typescript
// prisma/seed-config.ts

/** Enable playback progress simulation. */
export const SEED_SIMULATE_PLAYBACK: boolean;

/** Duration ranges in seconds. */
export const PLAYBACK_DURATIONS: {
  movie: { min: number; max: number };
  episode: { min: number; max: number };
};
```

## Breaking Changes

### Removed GridItem props

The following props have been removed from `GridItem` and `SortableGridItem`:

- `showCounts`
- `fileCounts`
- `childCount`
- `mediaIconType`

Components passing these props will need to be updated to remove them.

### ItemProgress type changed

The `ItemProgress` interface has new field names:

- `totalFiles` → `itemsWithMedia`
- `completedFiles` → `watchedItems`
- Added `totalItems` field

Code using the old field names will need to be updated.

## Migration Notes

No database migrations required. Progress is calculated on-the-fly using existing `playbackPosition` and `playbackDuration` fields on `ItemFile`.

For seeded data, run the seed with playback simulation:

```bash
SEED_SIMULATE_PLAYBACK=true pnpm prisma db seed
```
