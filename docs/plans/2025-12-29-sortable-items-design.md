# Sortable Items Design

## Overview

A sortable item system for a bidirectional SFTP media manager. Items represent folders that mirror the filesystem. Users can organize items in tree view (full hierarchy manipulation) or grid view (same-level reorder only).

## Summary

| Feature    | Implementation                                                           |
| ---------- | ------------------------------------------------------------------------ |
| Data model | `Item` (database) + `TreeItem` (display) with self-referential hierarchy |
| Tree view  | Full dnd-kit SortableTree - reorder, nest, unnest (max 10 levels)        |
| Grid view  | Flat sortable grid with `rectSortingStrategy` - same-level reorder only  |
| Navigation | Click item → `/dashboard/[itemId]`                                       |
| CRUD       | Add button + context menus + site header ellipsis                        |
| State      | Server Actions with optimistic updates                                   |

## Data Model

### Database Model (Prisma)

```typescript
// From prisma/schema.prisma - stored in database
interface Item {
  id: string;
  name: string;
  parentId: string | null; // null = root level
  order: number; // position among siblings
  userId: string; // ownership
  createdAt: Date;
  updatedAt: Date;
}
```

### Display Types (dnd-kit pattern)

```typescript
// lib/types.ts - for UI/dnd-kit operations

import type { UniqueIdentifier } from "@dnd-kit/core";

/**
 * Tree item for hierarchical display.
 * Used by SortableTree component.
 */
export interface TreeItem {
  id: UniqueIdentifier;
  children: TreeItem[];
  collapsed?: boolean;
  name: string;
}

export type TreeItems = TreeItem[];

/**
 * Flattened tree item for drag operations.
 * Created by flattenTree(), consumed by getProjection().
 */
export interface FlattenedItem extends TreeItem {
  parentId: UniqueIdentifier | null;
  depth: number;
  index: number;
}

/**
 * Sensor context for keyboard navigation.
 */
export type SensorContext = MutableRefObject<{
  items: FlattenedItem[];
  offset: number;
}>;
```

### Type Conversion

```typescript
// lib/item-utils.ts

/**
 * Converts database Items to TreeItems for display.
 */
export function itemsToTree(items: Item[]): TreeItems;

/**
 * Converts TreeItems back to Item updates for database.
 */
export function treeToItems(tree: TreeItems, userId: string): Partial<Item>[];
```

## Route Structure

```
app/
├── (dashboard)/
│   ├── dashboard/
│   │   ├── page.tsx              # Root level - shows all top-level items
│   │   └── [itemId]/
│   │       └── page.tsx          # Item page - shows children of that item
│   └── layout.tsx                # Shared layout with sidebar
```

Behavior:

- `/dashboard` → shows root items (parentId = null)
- `/dashboard/abc123` → shows children of item `abc123`
- Single `[itemId]` segment - use breadcrumbs for navigation context
- Invalid `itemId` → redirect to `/dashboard` with toast

## Component Architecture

Based on dnd-kit GitHub examples:

```
components/
├── sortable-tree/
│   ├── index.ts                      # Barrel export
│   ├── SortableTree.tsx              # Container: DndContext, sensors, projection
│   ├── keyboardCoordinates.ts        # Custom keyboard nav for indentation
│   ├── types.ts                      # Re-export from lib/types.ts
│   ├── utilities.ts                  # flatten(), buildTree(), getProjection()
│   └── components/
│       ├── index.ts                  # Barrel export
│       └── TreeItem/
│           ├── index.ts              # Barrel export
│           ├── TreeItem.tsx          # Base UI: handle, collapse, indentation
│           └── SortableTreeItem.tsx  # Wrapper: useSortable + animateLayoutChanges
├── sortable-grid/
│   ├── index.ts                      # Barrel export
│   ├── SortableGrid.tsx              # Container: DndContext, SortableContext
│   ├── GridItem.tsx                  # Card UI
│   └── SortableGridItem.tsx          # Wrapper with useSortable
├── items/
│   ├── index.ts                      # Barrel export
│   ├── view-toggle.tsx               # Switch between tree/grid
│   ├── add-item-button.tsx           # "+" button for creating items
│   └── item-context-menu.tsx         # Right-click menu (rename/delete/add child)
├── site-header.tsx                   # Dynamic title + breadcrumbs + ellipsis menu
```

Dashboard page renders:

```tsx
<ViewToggle />;
{
  view === "tree" ? (
    <SortableTree items={items} />
  ) : (
    <SortableGrid items={items} />
  );
}
<AddItemButton />;
```

## DndContext Configuration

### Sensors Setup

```typescript
// Both Tree and Grid views use this pattern
const sensors = useSensors(
  useSensor(PointerSensor, {
    activationConstraint: {
      distance: 8, // Prevent accidental drags
    },
  }),
  useSensor(KeyboardSensor, {
    coordinateGetter: sortableKeyboardCoordinates, // or custom for tree
  }),
  useSensor(TouchSensor, {
    activationConstraint: {
      delay: 200,
      tolerance: 5,
    },
  })
);
```

### Sorting Strategies

| View | Strategy              | Description                                  |
| ---- | --------------------- | -------------------------------------------- |
| Tree | Custom projection     | Uses `getProjection()` for depth calculation |
| Grid | `rectSortingStrategy` | Standard grid reordering                     |

### DragOverlay Configuration

```typescript
// Required for visual feedback during drag
const dropAnimationConfig: DropAnimation = {
  sideEffects: defaultDropAnimationSideEffects({
    styles: {
      active: {
        opacity: '0.5',
      },
    },
  }),
};

// In render:
<DragOverlay dropAnimation={dropAnimationConfig}>
  {activeId ? <TreeItem item={activeItem} clone /> : null}
</DragOverlay>
```

## State Management

```typescript
// hooks/use-items.ts
export function useItems(parentId: string | null) {
  const [items, setItems] = useState<Item[]>([]);
  const [view, setView] = useState<"tree" | "grid">("tree");
  // Fetch items, handle optimistic updates
}
```

Data Flow:

| Action         | Flow                                                    |
| -------------- | ------------------------------------------------------- |
| Load page      | Server component fetches items → passes to client       |
| Reorder (drag) | Optimistic update → Server Action → revalidate on error |
| Add item       | Server Action → prepend to list → revalidate            |
| Rename/Delete  | Server Action → update/remove → revalidate              |

### Server Actions (`lib/item-actions.ts`)

```typescript
"use server";

/**
 * Result type for item actions.
 * Either success with data or error message.
 */
type ItemResult<T = void> =
  | { success: true; data?: T; error?: never }
  | { success?: never; error: string };

/**
 * Fetches items for a given parent.
 * Returns root items if parentId is null.
 *
 * @param parentId - Parent item ID or null for root
 * @returns Items array or error
 */
export async function getItems(
  parentId: string | null
): Promise<ItemResult<Item[]>>;

/**
 * Fetches a single item with its ancestors for breadcrumbs.
 *
 * @param id - Item ID
 * @returns Item with ancestors or error
 */
export async function getItem(
  id: string
): Promise<ItemResult<{ item: Item; ancestors: Item[] }>>;

/**
 * Creates a new item.
 *
 * @param parentId - Parent item ID or null for root
 * @param name - Item name
 * @returns Created item or error
 */
export async function createItem(
  parentId: string | null,
  name: string
): Promise<ItemResult<Item>>;

/**
 * Updates an item's properties.
 * Verifies ownership before update.
 *
 * @param id - Item ID
 * @param data - Partial item data to update
 * @returns Success or error
 */
export async function updateItem(
  id: string,
  data: Partial<Pick<Item, "name">>
): Promise<ItemResult>;

/**
 * Deletes an item and all descendants.
 * Verifies ownership before delete.
 *
 * @param id - Item ID
 * @returns Success or error
 */
export async function deleteItem(id: string): Promise<ItemResult>;

/**
 * Batch reorders items. Used after drag operations.
 * Verifies ownership of ALL items before update.
 *
 * @param updates - Array of item updates with new order/parentId
 * @returns Success or error
 */
export async function reorderItems(
  updates: { id: string; order: number; parentId?: string | null }[]
): Promise<ItemResult>;
```

### Authorization Pattern

```typescript
// lib/item-actions.ts - batch authorization for reorderItems

export async function reorderItems(updates) {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Unauthorized" };
  }

  // Verify ownership of ALL items in batch
  const itemIds = updates.map((u) => u.id);
  const items = await prisma.item.findMany({
    where: { id: { in: itemIds } },
    select: { id: true, userId: true },
  });

  // Check all items exist and belong to user
  if (items.length !== itemIds.length) {
    return { error: "Some items not found" };
  }

  const unauthorized = items.some((item) => item.userId !== session.user.id);
  if (unauthorized) {
    return { error: "Unauthorized" };
  }

  // Proceed with batch update...
}
```

## Database Schema

```prisma
// prisma/schema.prisma

model Item {
  id        String   @id @default(cuid())
  name      String
  order     Int      @default(0)
  depth     Int      @default(0)  // Track depth for max limit enforcement

  // Hierarchy (max 10 levels deep)
  parentId  String?
  parent    Item?    @relation("ItemChildren", fields: [parentId], references: [id], onDelete: Cascade)
  children  Item[]   @relation("ItemChildren")

  // Ownership
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Timestamps
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([parentId])
  @@index([userId])
  @@index([userId, parentId, order])
}

model User {
  // ... existing fields
  items     Item[]
}
```

Key points:

- Self-referential relation for parent/children
- `depth` column to enforce max 10 levels
- `onDelete: Cascade` - deleting parent removes all descendants
- Composite index for efficient sibling queries

### Max Depth Enforcement

```typescript
// lib/item-actions.ts

const MAX_DEPTH = 10;

export async function createItem(parentId: string | null, name: string) {
  // ... auth check ...

  let depth = 0;
  if (parentId) {
    const parent = await prisma.item.findUnique({
      where: { id: parentId },
      select: { depth: true, userId: true },
    });

    if (!parent || parent.userId !== session.user.id) {
      return { error: "Parent not found" };
    }

    if (parent.depth >= MAX_DEPTH - 1) {
      return { error: "Maximum nesting depth reached" };
    }

    depth = parent.depth + 1;
  }

  // Create with calculated depth...
}

// Also enforce in reorderItems when parentId changes
```

## Validations

Add to `lib/validations.ts`:

```typescript
/**
 * Item name validation schema.
 * Allows alphanumeric, spaces, hyphens, underscores.
 * Compatible with filesystem naming.
 */
export const itemNameSchema = z
  .string()
  .min(1, "Name is required")
  .max(255, "Name too long")
  .regex(
    /^[a-zA-Z0-9\s\-_]+$/,
    "Name can only contain letters, numbers, spaces, hyphens, and underscores"
  );
```

## UI/UX Details

### Tree View (`SortableTree`)

- Indentation shows hierarchy (20px per level)
- Drag handle on left of each item
- Horizontal drag = change depth (nest/unnest) - respects max 10 levels
- Vertical drag = reorder among siblings
- Collapse/expand toggle for items with children
- Right-click → context menu (Add child, Rename, Delete)

### Grid View (`SortableGrid`)

- Cards in responsive grid (2 cols mobile, 3-4 cols desktop)
- Drag anywhere on card to reorder
- Same-level only, no nesting via drag
- Right-click → context menu (Rename, Delete)

### View Toggle

- Segmented control: `[Tree] [Grid]`
- Persisted in localStorage
- Top-right of content area, next to Add button

### Site Header (on item pages)

```
[≡] | Breadcrumb: Home > Parent > Current Item    [...]
```

- Breadcrumbs for navigation up the tree
- Ellipsis menu: Rename, Delete

Props interface:

```typescript
interface SiteHeaderProps {
  title?: string;
  breadcrumbs?: { id: string; name: string }[];
  showItemMenu?: boolean;
}
```

### Add Item Button

- Fixed position or inline at bottom of list
- Opens inline input field (not modal)
- Enter to submit, Escape to cancel

## Error Handling

| Scenario                   | Handling                                 |
| -------------------------- | ---------------------------------------- |
| Drag fails                 | Rollback to previous state + toast error |
| Empty name                 | Revert to previous, validation message   |
| Invalid itemId URL         | Redirect to `/dashboard` with toast      |
| Item deleted while viewing | Redirect to parent or `/dashboard`       |
| Cascade delete             | Confirm dialog showing child count       |
| Max depth exceeded         | Toast error, prevent nesting             |

## Accessibility

- Keyboard drag support via dnd-kit's keyboard sensor
- Arrow keys navigate tree, Enter to select/open
- Screen reader announcements for drag operations
- Custom keyboard coordinates for tree indentation
- Announcements: "Picked up {name}", "Moved to position X", "Dropped at position X"

## Testing Strategy

### Unit Tests (`tests/unit/lib/item-actions.test.ts`)

Mock Prisma and `auth()` session:

| Test           | Description                                         |
| -------------- | --------------------------------------------------- |
| `getItems`     | Returns items for parentId, respects userId         |
| `getItem`      | Returns item with ancestors for breadcrumbs         |
| `createItem`   | Creates with correct userId, parentId, order, depth |
| `createItem`   | Validates name (empty, too long, invalid chars)     |
| `createItem`   | Rejects when max depth exceeded                     |
| `updateItem`   | Only updates owned items                            |
| `updateItem`   | Rejects update of non-existent item                 |
| `deleteItem`   | Verifies ownership before delete                    |
| `reorderItems` | Batch updates order correctly                       |
| `reorderItems` | Verifies ownership of ALL items                     |
| `reorderItems` | Handles parentId changes (tree view)                |
| `reorderItems` | Rejects when new depth exceeds max                  |

### Integration Tests (`tests/integration/items/`)

Real database operations:

| File                     | Description                                                |
| ------------------------ | ---------------------------------------------------------- |
| `item-crud.test.ts`      | Create, read, update, delete with real DB                  |
| `item-hierarchy.test.ts` | Parent/child relationships, cascade delete, depth tracking |
| `item-reorder.test.ts`   | Order updates persist correctly                            |
| `item-auth.test.ts`      | Ownership verification, cross-user access denied           |

### E2E Tests (`e2e/journeys/items/`)

New Page Objects:

```
e2e/pages/
├── items-tree.page.ts    # Tree view interactions
├── items-grid.page.ts    # Grid view interactions
└── item-detail.page.ts   # Single item page
```

Journey Tests:

| File                        | Description                           |
| --------------------------- | ------------------------------------- |
| `items-crud.spec.ts`        | Create, rename, delete via UI         |
| `items-tree-drag.spec.ts`   | Drag to reorder and nest in tree view |
| `items-grid-drag.spec.ts`   | Drag to reorder in grid view          |
| `items-navigation.spec.ts`  | Click card → item page, breadcrumbs   |
| `items-view-toggle.spec.ts` | Switch between tree/grid views        |
| `items-max-depth.spec.ts`   | Cannot nest beyond 10 levels          |

## Files to Create/Modify

### New Files

- `lib/types.ts` - TreeItem, FlattenedItem, SensorContext types
- `lib/item-actions.ts` - Server actions (getItems, getItem, createItem, updateItem, deleteItem, reorderItems)
- `lib/item-utils.ts` - itemsToTree, treeToItems conversion utilities
- `lib/validations.ts` - Add itemNameSchema
- `hooks/use-items.ts` - Client-side item state management
- `components/sortable-tree/index.ts` - Barrel export
- `components/sortable-tree/SortableTree.tsx`
- `components/sortable-tree/keyboardCoordinates.ts`
- `components/sortable-tree/utilities.ts`
- `components/sortable-tree/components/index.ts`
- `components/sortable-tree/components/TreeItem/index.ts`
- `components/sortable-tree/components/TreeItem/TreeItem.tsx`
- `components/sortable-tree/components/TreeItem/SortableTreeItem.tsx`
- `components/sortable-grid/index.ts` - Barrel export
- `components/sortable-grid/SortableGrid.tsx`
- `components/sortable-grid/GridItem.tsx`
- `components/sortable-grid/SortableGridItem.tsx`
- `components/items/index.ts` - Barrel export
- `components/items/view-toggle.tsx`
- `components/items/add-item-button.tsx`
- `components/items/item-context-menu.tsx`
- `app/(dashboard)/dashboard/[itemId]/page.tsx` - Item detail page
- `tests/unit/lib/item-actions.test.ts`
- `tests/integration/items/item-crud.test.ts`
- `tests/integration/items/item-hierarchy.test.ts`
- `tests/integration/items/item-reorder.test.ts`
- `tests/integration/items/item-auth.test.ts`
- `e2e/pages/items-tree.page.ts`
- `e2e/pages/items-grid.page.ts`
- `e2e/pages/item-detail.page.ts`
- `e2e/journeys/items/items-crud.spec.ts`
- `e2e/journeys/items/items-tree-drag.spec.ts`
- `e2e/journeys/items/items-grid-drag.spec.ts`
- `e2e/journeys/items/items-navigation.spec.ts`
- `e2e/journeys/items/items-view-toggle.spec.ts`
- `e2e/journeys/items/items-max-depth.spec.ts`

### Modified Files

- `prisma/schema.prisma` - Add Item model with depth column
- `components/site-header.tsx` - Add props for dynamic title, breadcrumbs, ellipsis menu
- `app/(dashboard)/dashboard/page.tsx` - Replace SectionCards with sortable views

### Removed Files

- `components/section-cards.tsx`

## Dependencies

```bash
pnpm add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```
