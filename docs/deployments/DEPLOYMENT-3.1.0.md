# Deployment 3.1.0 - Go To Button for Continue Watching

**Date**: 2026-01-18
**Branch**: development

## Summary

Items now display a "Go to [ItemName]" button that navigates to the first incomplete item in DFS (depth-first search) order. This enables a "continue watching" workflow where users can quickly jump to the next unwatched content in their library or within a specific item's hierarchy.

## Features

### "Go to" button on hero components

A new button appears in the ItemHero component when incomplete items exist:

**Button behavior by scenario:**

| Scenario                                   | Buttons Shown                   |
| ------------------------------------------ | ------------------------------- |
| Item has media, no incomplete children     | Resume/Play only                |
| Item has media, has incomplete children    | Resume/Play + Go to [ChildName] |
| Item has no media, has incomplete children | Go to [ChildName] only          |
| Item has no media, no incomplete children  | No buttons                      |
| My Items with incomplete item in library   | Go to [ItemName]                |
| My Items with all items complete           | No Go to button                 |

Both Resume/Play and Go to buttons use the same `variant="glass"` style for visual consistency.

### DFS traversal for finding next incomplete item

The system traverses the item hierarchy depth-first:

**How "next item" is determined:**

- Traverses items in DFS order (depth-first, visiting children before siblings)
- Children are sorted by `order` field at each level
- An item is "incomplete" when its primary media is < 90% watched
- Items without media are skipped but their children are still checked
- Returns the first incomplete item found, or null if all complete

**Example traversal:**

```
Movies (folder)              <- visited first
  ├── Star Wars (complete)   <- checked, skipped
  └── Empire Strikes Back    <- FOUND (incomplete)
TV Shows (folder)            <- never reached
  └── Breaking Bad
```

### Server action for efficient querying

A new `getFirstIncompleteItem` server action uses a recursive CTE to efficiently query descendants:

**Features:**

- Accepts optional `parentId` to search within a subtree
- Uses PostgreSQL recursive CTE for descendant enumeration
- Single query retrieves all items with their primary media progress
- DFS traversal performed in JavaScript for correct ordering

**API:**

```typescript
const result = await getFirstIncompleteItem(parentId);
// Returns: { success: true, data: { id: string, name: string } | null }
```

### Client-side hook for navigation

A new `useGoToItem` hook provides reusable navigation logic:

```typescript
const { nextItem, isLoading, goToNext, refetch } = useGoToItem({
  parentId: item.id, // Optional: filter to descendants
  enabled: true, // Optional: disable fetching
});
```

## Files Changed

### Added

```
hooks/use-go-to-item.ts                            # Hook for fetching and navigating to next item
e2e/journeys/items/go-to-button.spec.ts            # E2E tests for go-to button
docs/plans/2026-01-18-continue-watching-dfs.md     # Design document
docs/plans/2026-01-18-public-profiles-and-templates-design.md  # Future design
```

### Modified

```
lib/types.ts                                       # NextItem type
lib/progress-utils.ts                              # findFirstIncompleteItem utility, IncompleteItemInput type
lib/item-actions.ts                                # getFirstIncompleteItem server action
components/items/item-hero.tsx                     # nextItem, onGoToNext props, Go to button
components/items/item-detail-client.tsx            # Wire up go-to functionality
components/items/items-view.tsx                    # Uses useGoToItem hook internally for hero
tests/unit/lib/progress-utils.test.ts              # Tests for findFirstIncompleteItem
tests/unit/components/items/item-hero.test.tsx     # Tests for Go to button
tests/integration/items/item-progress.test.ts      # Integration tests for getFirstIncompleteItem
```

## Test Results

| Suite       | Tests | Result     |
| ----------- | ----- | ---------- |
| Unit        | 1347+ | All passed |
| Integration | 102+  | All passed |
| E2E         | ~430  | All passed |

## API Changes

### New types

```typescript
// lib/types.ts

/**
 * Minimal item data for "Go to" button display.
 * Returned by getFirstIncompleteItem() server action.
 */
export interface NextItem {
  /** Item ID for navigation */
  id: string;
  /** Item name for button label ("Go to [name]") */
  name: string;
}
```

### New progress utilities

```typescript
// lib/progress-utils.ts

/**
 * Input type for findFirstIncompleteItem.
 */
export interface IncompleteItemInput {
  id: string;
  order: number;
  parentId: string | null;
  hasPrimaryMedia: boolean;
  position: number | null;
  duration: number | null;
}

/**
 * Finds the first incomplete item in DFS order.
 * @param items - Flat array of items with order, parentId, and media info
 * @param startFromParentId - Optional parent ID to start traversal from
 * @returns ID of first incomplete item, or null if all complete/no media
 */
export function findFirstIncompleteItem(
  items: IncompleteItemInput[],
  startFromParentId?: string | null
): string | null;
```

### New server action

```typescript
// lib/item-actions.ts

/**
 * Gets the first incomplete item in DFS order.
 * @param parentId - Optional parent ID to search within (null = entire library)
 * @returns First incomplete item data or null if all complete
 */
export async function getFirstIncompleteItem(
  parentId?: string | null
): Promise<ItemResult<NextItem | null>>;
```

### Updated ItemHero props

```typescript
// components/items/item-hero.tsx
interface ItemHeroProps {
  // ... existing props
  /** Next incomplete item to navigate to (for "Go to" button). */
  nextItem?: NextItem | null;
  /** Callback when "Go to" button clicked. */
  onGoToNext?: (item: NextItem) => void;
}
```

### New hook

```typescript
// hooks/use-go-to-item.ts

interface UseGoToItemOptions {
  parentId?: string | null;
  enabled?: boolean;
}

interface UseGoToItemReturn {
  nextItem: NextItem | null | undefined;
  isLoading: boolean;
  goToNext: (item: NextItem) => void;
  refetch: () => Promise<void>;
}

export function useGoToItem(options?: UseGoToItemOptions): UseGoToItemReturn;
```

## Breaking Changes

None. All changes are additive and backwards compatible.

## Migration Notes

No database migrations required. The feature uses existing `playbackPosition` and `playbackDuration` fields on `ItemFile`.
