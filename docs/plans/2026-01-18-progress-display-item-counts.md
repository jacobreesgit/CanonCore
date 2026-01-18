# Progress Display: Item-Based Progress with Total Counts

## Overview

Change progress tracking from file-based to item-based, and show total item counts.

**Current format:** `5/10 watched` (5 of 10 media files watched)

**New format:** `5/10 watched (of 15 items)` (5 of 10 items with media watched, 15 total items)

## Requirements

1. **Item-based progress** - Count items, not files. An item is "watched" when its primary media file is >= 90% complete
2. **Total item count** - Show total descendant items in parentheses
3. **Remove hero stats row** - Remove the media/artwork/subtitle/child counts from item-hero (redundant)
4. **Primary media only** - Only the primary media file determines watched status (not trailers, extras)

## Data Model

### Progress Type Update

```typescript
// lib/progress-utils.ts
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
```

### Watched Calculation

An item counts as "watched" when its primary media file (`isPrimary = true`) is >= 90% complete.

Example: Shawshank Redemption with main video + trailer

- Has 2 media files, primary is the main video
- If main video is 95% watched → item is "watched"
- Counts as 1/1 watched, not based on all files

### Server-Side Query

Update recursive CTE in `lib/item-actions.ts`:

```sql
WITH RECURSIVE descendants AS (
  -- Base: root items
  SELECT id, id as "rootItemId" FROM "Item"
  WHERE id = ANY($1) AND "userId" = $2
  UNION ALL
  -- Recursive: children
  SELECT i.id, d."rootItemId"
  FROM "Item" i
  INNER JOIN descendants d ON i."parentId" = d.id
)
SELECT
  d."rootItemId",
  COUNT(DISTINCT d.id) as "totalItems",
  COUNT(DISTINCT CASE WHEN f.id IS NOT NULL THEN d.id END) as "itemsWithMedia",
  COUNT(DISTINCT CASE
    WHEN f."playbackPosition" >= f."playbackDuration" * 0.9
    THEN d.id
  END) as "watchedItems"
FROM descendants d
LEFT JOIN "ItemFile" f ON f."itemId" = d.id
  AND f."fileType" = 'MEDIA'
  AND f."isPrimary" = true
GROUP BY d."rootItemId"
```

Key points:

- JOIN only on `isPrimary = true` media files
- COUNT DISTINCT items, not files
- Single query returns all three counts

## Display Logic

### Format Function

```typescript
export function formatProgressLabel(progress: ItemProgress): string | null {
  // Nothing to show for leaf items without media
  if (progress.itemsWithMedia === 0 && progress.totalItems <= 1) {
    return null;
  }

  // Has items with media: "5/10 watched (of 15 items)"
  if (progress.itemsWithMedia > 0) {
    const itemWord = progress.totalItems === 1 ? "item" : "items";
    return `${progress.watchedItems}/${progress.itemsWithMedia} watched (of ${progress.totalItems} ${itemWord})`;
  }

  // No media, has children: "(3 items)"
  const itemWord = progress.totalItems === 1 ? "item" : "items";
  return `(${progress.totalItems} ${itemWord})`;
}
```

### Edge Cases

| Scenario                                           | Display                      |
| -------------------------------------------------- | ---------------------------- |
| Movies folder: 5 watched, 10 with media, 15 total  | `5/10 watched (of 15 items)` |
| TV show: 8 episodes watched, 10 episodes, 12 items | `8/10 watched (of 12 items)` |
| Folder with 3 empty subfolders                     | `(3 items)`                  |
| Single movie, unwatched                            | `0/1 watched (of 1 item)`    |
| Empty leaf item                                    | Nothing (null)               |

## UI Changes

### Remove Hero Stats Row

Delete the stats row in `item-hero.tsx` showing:

- X media files
- X artwork
- X subtitles
- X items

This is redundant now that progress shows "(of X items)".

### Props to Remove from ItemHero

```typescript
// Remove these props:
mediaCount?: number;
artworkCount?: number;
subtitleCount?: number;
childCount?: number;
```

## Files to Modify

### Source Files

| File                                                        | Change                                                |
| ----------------------------------------------------------- | ----------------------------------------------------- |
| `lib/progress-utils.ts`                                     | Change to item-based progress, rename fields          |
| `lib/item-actions.ts`                                       | Update CTE to count items with primary media watched  |
| `lib/types.ts`                                              | Update ItemProgress type if exported there            |
| `components/items/item-hero.tsx`                            | Remove stats row, remove unused props                 |
| `components/items/item-detail-client.tsx`                   | Stop passing stats props to hero                      |
| `components/sortable-grid/GridItem.tsx`                     | Update progress display                               |
| `components/sortable-tree/components/TreeItem/TreeItem.tsx` | Update progress display                               |
| `app/(my-items)/my-items/page.tsx`                          | Update library progress display                       |
| `prisma/seed.ts`                                            | Add auto-sync after seeding, ensure primary media set |
| `prisma/seed-config.ts`                                     | Verify primary media config is correct                |

### Test Files

| File                                                      | Change                             |
| --------------------------------------------------------- | ---------------------------------- |
| `tests/unit/lib/progress-utils.test.ts`                   | Rewrite for item-based progress    |
| `tests/integration/items/item-progress.test.ts`           | Update for primary media logic     |
| `e2e/journeys/items/item-progress.spec.ts`                | Update format assertions           |
| `tests/unit/components/grid-item.test.tsx`                | Update mock progress data          |
| `tests/unit/components/items/item-detail-client.test.tsx` | Update mock progress, remove stats |

## Seed Changes

### Auto-Sync After Seeding

Currently: User must manually log in and click "Sync" after seeding.

New: Seed script automatically triggers Google Drive sync after creating items.

```typescript
// prisma/seed.ts - at the end
try {
  await syncUserItems(userId);
  console.log("✓ Synced items to Google Drive");
} catch (error) {
  console.warn("⚠ Google Drive sync failed (items created locally):", error);
  // Don't fail seed - user can sync manually later
}
```

**Error handling:**

- If `GOOGLE_TEST_REFRESH_TOKEN` not set: Skip sync, log info message
- If sync fails: Log warning, continue (items exist locally)
- If partial sync: Log which items failed, continue

### Primary Media Setup

Seed already marks primary media correctly via existing upload logic. Verify in tests that:

- Movies: main video file is `isPrimary = true`
- TV episodes: episode video is `isPrimary = true`

## Implementation Order

1. Update `ItemProgress` type in `lib/progress-utils.ts` (rename fields)
2. Update `formatProgressLabel` function for new format
3. Update `isFileComplete` → keep as-is (used for primary media check)
4. Update server queries in `lib/item-actions.ts` for item-based counting
5. Update unit tests for progress-utils
6. Update integration tests for primary media logic
7. Remove stats row from `item-hero.tsx`
8. Update components (hero, grid, tree) for new progress format
9. Update component unit tests
10. Update E2E tests
11. Update seed to set primary media correctly
12. Add auto-sync to seed script after completion
