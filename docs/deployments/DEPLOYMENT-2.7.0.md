# Deployment 2.7.0 - Bulk Delete & Contextual Empty States

**Date**: 2026-01-14
**Branch**: development

## Summary

Edit mode now supports bulk delete with checkbox selection. Select individual items or use select-all to delete multiple items at once, with a confirmation dialog protecting against accidents. Empty states are context-aware, showing different messages for first-time users, empty folders, and empty filter results.

## Features

### Bulk delete with selection

In edit mode, each item shows a selection checkbox. The bulk actions toolbar displays selection count and a delete button when items are selected.

**Selection controls:**

- Individual checkboxes on each item
- Select-all checkbox in toolbar (indeterminate when partially selected)
- Selection count display ("3 selected" or "Select items")
- Delete button appears only when items are selected

**Deletion flow:**

1. Enter edit mode
2. Select items via checkboxes or select-all
3. Click "Delete X" button
4. Confirm in dialog
5. Items deleted with success toast

**Performance optimization:**

The `deleteItems` server action uses a single recursive CTE query with PostgreSQL's `ANY()` operator instead of N separate queries for descendants:

```sql
WITH RECURSIVE descendants AS (
  SELECT id, "driveFileId"
  FROM "Item"
  WHERE "parentId" = ANY($1) AND "userId" = $2
  UNION ALL
  SELECT i.id, i."driveFileId"
  FROM "Item" i
  INNER JOIN descendants d ON i."parentId" = d.id
  WHERE i."userId" = $2
)
SELECT "driveFileId" FROM descendants
```

### Contextual empty states

The `EmptyState` component displays context-appropriate messages with actionable buttons:

| Variant        | Title             | Action        | When Shown                          |
| -------------- | ----------------- | ------------- | ----------------------------------- |
| `first-time`   | No items yet      | Add Item      | Root page, no items                 |
| `no-children`  | No child items    | Add Child     | Item detail page, no children       |
| `filter-empty` | No matching items | Clear Filter  | Filter active, no results           |
| `search-empty` | No results        | Clear Search  | Search active, no results (future)  |

Empty state logic now checks `currentLevelItems.length` (filtered items) instead of `items.length` (raw items), so the filter-empty variant displays correctly.

## Files Changed

### Added

```
hooks/use-bulk-selection.ts                        # Selection state management hook
components/items/bulk-actions-toolbar.tsx          # Toolbar with select-all and delete
components/items/empty-state.tsx                   # Config-driven empty state component
e2e/journeys/items/bulk-delete.spec.ts             # E2E tests for bulk delete flow
e2e/journeys/items/empty-states.spec.ts            # E2E tests for empty state variants
tests/unit/hooks/use-bulk-selection.test.ts        # 8 tests
tests/unit/components/items/bulk-actions-toolbar.test.tsx  # 10 tests
tests/unit/components/items/empty-state.test.tsx   # 8 tests
tests/unit/prisma/seed-config.test.ts              # 15 tests
```

### Modified

```
components/items/items-view.tsx                    # Bulk selection integration, empty state logic fix
components/sortable-tree/SortableTree.tsx          # Pass selection props
components/sortable-tree/components/TreeItem/TreeItem.tsx      # Selection checkbox
components/sortable-tree/components/TreeItem/SortableTreeItem.tsx
components/sortable-grid/SortableGrid.tsx          # Pass selection props
components/sortable-grid/GridItem.tsx              # Selection checkbox
components/sortable-grid/SortableGridItem.tsx
lib/item-actions.ts                                # deleteItems N+1 optimization
e2e/pages/items.page.ts                            # Bulk selection test helpers
tests/unit/components/items-view.test.tsx          # Bulk delete tests
tests/unit/lib/item-actions.test.ts                # deleteItems tests
tests/unit/setup.ts                                # Mock updates
prisma/seed.ts                                     # Seed improvements
prisma/seed-config.ts                              # Seed configuration
```

## Test Results

| Suite       | Tests | Result                 |
| ----------- | ----- | ---------------------- |
| Unit        | 1283  | All passed             |
| Integration | 92    | All passed             |
| E2E         | 416   | Passed (8 skip, 2 flaky) |

## API Changes

### New hook

```typescript
// hooks/use-bulk-selection.ts
interface UseBulkSelectionReturn<T> {
  selectedIds: Set<string>;
  selectionCount: number;
  isAllSelected: boolean;
  isPartiallySelected: boolean;
  selectedItems: T[];
  isSelected: (id: string) => boolean;
  toggleItem: (id: string) => void;
  selectAll: () => void;
  deselectAll: () => void;
  toggleAll: () => void;
}

export function useBulkSelection<T extends { id: string }>(
  items: T[]
): UseBulkSelectionReturn<T>;
```

### New component

```typescript
// components/items/empty-state.tsx
type EmptyStateVariant = "first-time" | "no-children" | "filter-empty" | "search-empty";

interface EmptyStateProps {
  variant: EmptyStateVariant;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({ variant, onAction, className }: EmptyStateProps): JSX.Element;
```

### New server action

```typescript
// lib/item-actions.ts
export async function deleteItems(
  ids: string[]
): Promise<{ success: boolean; data?: { deleted: number; skipped: number }; error?: string }>;
```

### Updated component props

```typescript
// TreeItem and GridItem now accept selection props
interface SelectionProps {
  isSelected?: boolean;
  onSelectChange?: (selected: boolean) => void;
}
```

## Breaking Changes

None. All changes are additive.
