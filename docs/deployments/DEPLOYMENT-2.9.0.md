# Deployment 2.9.0 - Pinned Items & Seed Improvements

**Date**: 2026-01-17
**Branch**: development

## Summary

Items can now be pinned to the sidebar for quick access. Right-click any item and select "Pin to Sidebar" to add it to a new "Pinned" section that appears below the main navigation. The seed system creates organized folder structures with "Movies" and "TV Shows" parent folders that are pinned by default.

## Features

### Pin items to sidebar

Pin frequently accessed items to the sidebar for one-click navigation:

**How to pin:**

1. Right-click any item in tree or grid view
2. Select "Pin to Sidebar"
3. Item appears in the new "Pinned" section

**Pinned items section:**

- Displays below main navigation with "Pinned" label
- Shows folder icons with item names
- Highlights active item based on current route
- Right-click context menu: Settings, Unpin, Delete

**Limits and behavior:**

- Maximum 10 pinned items per user
- Items ordered by pin time (earliest first)
- Pinning an already-pinned item is a no-op
- Deleting a pinned item removes it from both locations

**Rate limiting:**

- `itemPin`: 30 requests per minute (covers both pin and unpin)

### Grouped seed structure

The seed system now creates an organized folder hierarchy with pinned parent folders:

```
My Items/
├── Movies/ (pinned)
│   ├── The Shawshank Redemption
│   ├── The Dark Knight
│   └── ...
└── TV Shows/ (pinned)
    ├── Doctor Who
    │   ├── Classic (1963-1989)
    │   └── Modern (2005+)
    ├── Breaking Bad
    └── ...
```

**Doctor Who consolidation:**

Classic Doctor Who (1963-1989) and Modern Doctor Who (2005+) are now consolidated under a single "Doctor Who" parent folder with subfolders for each era.

**New environment variable:**

```bash
SEED_GROUPED_STRUCTURE=false  # Disable grouped structure (flat by default)
```

### Seed verification script

New utility script for quick seed validation:

```bash
npx tsx scripts/verify-seed.ts
```

Reports pinned items, folder structure, artwork counts, and Drive connections.

## Files Changed

### Added

```
components/nav-pinned-items.tsx                    # Sidebar pinned items component
prisma/migrations/20260117171208_add_pinned_order  # Add pinnedOrder column
scripts/verify-seed.ts                             # Seed verification utility
e2e/journeys/items/pinned-items.spec.ts            # E2E tests for pinning
tests/integration/items/item-pinning.test.ts       # Integration tests
tests/unit/lib/item-actions-pinning.test.ts        # Unit tests for actions
tests/unit/components/nav-pinned-items.test.tsx    # Component tests
```

### Modified

```
components/app-sidebar.tsx                         # Accept and render pinnedItems
components/items/item-context-menu.tsx             # Add Pin/Unpin options
components/items/items-view.tsx                    # handlePinItem/handleUnpinItem
components/sortable-tree/Tree.tsx                  # Pass pin props
components/sortable-tree/SortableTree.tsx          # Pass pin props
components/sortable-tree/components/TreeItem/*.tsx # Pin/unpin in context menu
components/sortable-grid/Grid.tsx                  # Pass pin props
components/sortable-grid/SortableGrid.tsx          # Pass pin props
components/sortable-grid/SortableGridItem.tsx      # Pin/unpin in context menu
app/(my-items)/layout.tsx                          # Fetch and pass pinnedItems
lib/item-actions.ts                                # pinItem, unpinItem, getPinnedItems
lib/types.ts                                       # PinnedItem type, pinnedOrder field
lib/item-utils.ts                                  # Include pinnedOrder in mapping
lib/rate-limit.ts                                  # Add itemPin rate limiter
prisma/schema.prisma                               # pinnedOrder field and index
prisma/seed.ts                                     # Grouped structure, Doctor Who
prisma/seed-config.ts                              # SEED_GROUPED_STRUCTURE, Doctor Who IDs
e2e/pages/items.page.ts                            # Pin/unpin page object methods
tests/unit/components/items/item-context-menu.test.tsx  # Pin/unpin tests
tests/unit/prisma/seed-config.test.ts              # New seed config tests
```

## Test Results

| Suite       | Tests | Result     |
| ----------- | ----- | ---------- |
| Unit        | 1327  | All passed |
| Integration | 102   | All passed |
| E2E         | ~430  | All passed |

## API Changes

### New server actions

```typescript
// lib/item-actions.ts

/**
 * Pins an item to the sidebar.
 * Limited to 10 pinned items per user.
 * Uses transaction to prevent race conditions.
 */
export async function pinItem(id: string): Promise<ItemResult>;

/**
 * Unpins an item from the sidebar.
 */
export async function unpinItem(id: string): Promise<ItemResult>;

/**
 * Fetches all pinned items for sidebar display.
 * Returns items sorted by pinnedOrder.
 */
export async function getPinnedItems(): Promise<ItemResult<PinnedItem[]>>;
```

### New types

```typescript
// lib/types.ts

interface PinnedItem {
  id: string;
  name: string;
  pinnedOrder: number;
}

// Added to Item and TreeItem interfaces
pinnedOrder: number | null;
```

### New component

```typescript
// components/nav-pinned-items.tsx
interface NavPinnedItemsProps {
  items: PinnedItem[];
}

export function NavPinnedItems({ items }: NavPinnedItemsProps): JSX.Element;
```

### Updated context menu props

```typescript
// components/items/item-context-menu.tsx
interface ItemContextMenuProps {
  // ... existing props
  isPinned?: boolean;
  onPin?(): Promise<void>;
  onUnpin?(): Promise<void>;
}
```

### Database schema

```prisma
model Item {
  // ... existing fields
  pinnedOrder Int?  // null = not pinned, 0+ = pinned with order

  @@index([userId, pinnedOrder])
}
```

### New seed configuration

```typescript
// prisma/seed-config.ts
export const SEED_GROUPED_STRUCTURE: boolean;
export const CLASSIC_DOCTOR_WHO_ID: number;  // 121
export const MODERN_DOCTOR_WHO_ID: number;   // 57243
export function isDoctorWho(id: number): boolean;
```

## Breaking Changes

None. All changes are additive and backward compatible.

## Migration Notes

The migration adds a nullable `pinnedOrder` column to the Item table with a composite index on `(userId, pinnedOrder)`. No data migration is required as existing items will have `pinnedOrder = null` (unpinned).

```sql
ALTER TABLE "Item" ADD COLUMN "pinnedOrder" INTEGER;
CREATE INDEX "Item_userId_pinnedOrder_idx" ON "Item"("userId", "pinnedOrder");
```
