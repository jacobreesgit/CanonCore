# Sortable Items Implementation Plan

> **Status:** Phase 1 COMPLETE - Core implementation finished. See Phase 2 plan for tests and remaining work.

**Goal:** Implement sortable item system with tree/grid views using dnd-kit for a bidirectional SFTP media manager.

**Architecture:** Database-backed Item model with self-referential hierarchy. Server Actions for CRUD with ownership verification. dnd-kit SortableTree for full tree manipulation, SortableGrid for flat reordering. React state with optimistic updates.

**Tech Stack:** Next.js 16, React 19, TypeScript, Prisma 7, dnd-kit, Tailwind CSS 4, shadcn/ui

**Reference Files:** `temp/dnd-kit-reference/tree/` contains source from dnd-kit examples.

---

## ✅ Phase 1: Core Implementation (COMPLETED)

### Task 1: Install Dependencies ✅

- Installed `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`

### Task 2: Add Item Model to Prisma Schema ✅

- Added Item model with self-referential hierarchy
- Added items relation to User model
- Created migration `add_item_model`

### Task 3: Add Item Validation Schema ✅

- Added `itemNameSchema` to `lib/validations.ts`

### Task 4: Create Types File ✅

- Created `lib/types.ts` with Item, TreeItem, FlattenedItem, SensorContext, ItemResult, BreadcrumbItem types

### Task 5-8: Create Item Actions ✅

- Created `lib/item-actions.ts` with:
  - `getItems()` - fetches all user items
  - `getItem()` - fetches single item with breadcrumbs
  - `createItem()` - creates with max depth enforcement
  - `updateItem()` - updates owned items
  - `deleteItem()` - deletes with cascade
  - `reorderItems()` - batch reorder with ownership verification

### Task 9: Create Tree Utilities ✅

- Created `components/sortable-tree/utilities.ts` with flatten/build tree, projection calculation

### Task 10: Create Keyboard Coordinates ✅

- Created `components/sortable-tree/keyboardCoordinates.ts` for tree navigation

### Task 11: Create TreeItem Component ✅

- Created `components/sortable-tree/components/TreeItem/TreeItem.tsx`
- Refined utility aesthetic with smooth transitions

### Task 12: Create SortableTreeItem Component ✅

- Created `components/sortable-tree/components/TreeItem/SortableTreeItem.tsx`
- Created barrel exports

### Task 13: Create SortableTree Container ✅

- Created `components/sortable-tree/SortableTree.tsx`
- Full dnd-kit integration with DragOverlay

### Task 14: Create GridItem Component ✅

- Created `components/sortable-grid/GridItem.tsx`
- Refined folder card with hover effects

### Task 15: Create SortableGridItem and SortableGrid ✅

- Created `components/sortable-grid/SortableGridItem.tsx`
- Created `components/sortable-grid/SortableGrid.tsx`
- Created barrel exports

### Task 16: Create ViewToggle Component ✅

- Created `components/items/view-toggle.tsx`
- Segmented control with localStorage persistence

### Task 17: Create AddItemButton Component ✅

- Created `components/items/add-item-button.tsx`
- Expandable inline input with smooth animation

### Task 18: Create ItemContextMenu Component ✅

- Created `components/items/item-context-menu.tsx`
- Installed shadcn context-menu
- Dialogs for rename, delete, add subfolder

### Task 19: Create Item Utilities ✅

- Created `lib/item-utils.ts` with:
  - `itemsToTree()` - converts flat items to tree
  - `treeToItemUpdates()` - extracts updates for database
  - `findItemInTree()`, `getItemPath()`, `countItems()`, `getMaxDepth()`

### Task 20: Update Dashboard Page ✅

- Updated `app/(dashboard)/dashboard/page.tsx`
- Created `components/items/items-view.tsx` client component
- Integrated tree/grid views with breadcrumb navigation

### Task 21: Create Item Detail Page ✅

- Created `app/(dashboard)/dashboard/[itemId]/page.tsx`
- Shows children of specific folder with breadcrumbs

---

## 🔄 Remaining from Design Document

The following items from the design document are NOT YET implemented:

### Site Header Updates

- Dynamic title + breadcrumbs in header
- Ellipsis menu for rename/delete current item

### Tests

- Unit tests for item actions
- Integration tests for item hierarchy
- E2E tests for items CRUD, drag operations, navigation

### Cleanup

- Remove `components/section-cards.tsx` (if not used elsewhere)

---

## Files Created/Modified

### New Files Created:

- `lib/types.ts`
- `lib/item-actions.ts`
- `lib/item-utils.ts`
- `lib/validations.ts` (modified - added itemNameSchema)
- `components/sortable-tree/utilities.ts`
- `components/sortable-tree/keyboardCoordinates.ts`
- `components/sortable-tree/SortableTree.tsx`
- `components/sortable-tree/index.ts`
- `components/sortable-tree/components/index.ts`
- `components/sortable-tree/components/TreeItem/TreeItem.tsx`
- `components/sortable-tree/components/TreeItem/SortableTreeItem.tsx`
- `components/sortable-tree/components/TreeItem/index.ts`
- `components/sortable-grid/GridItem.tsx`
- `components/sortable-grid/SortableGridItem.tsx`
- `components/sortable-grid/SortableGrid.tsx`
- `components/sortable-grid/index.ts`
- `components/items/view-toggle.tsx`
- `components/items/add-item-button.tsx`
- `components/items/item-context-menu.tsx`
- `components/items/items-view.tsx`
- `components/items/index.ts`
- `app/(dashboard)/dashboard/[itemId]/page.tsx`

### Modified Files:

- `prisma/schema.prisma` - Added Item model
- `package.json` - Added dnd-kit dependencies
- `tsconfig.json` - Added temp to exclude
- `app/(dashboard)/dashboard/page.tsx` - Replaced with ItemsView

---

## Notes

- Used `frontend-design` skill for UI components (TreeItem, GridItem, ViewToggle, AddItemButton, ItemContextMenu, dashboard pages)
- Fixed several TypeScript issues during implementation:
  - session.user.id possibly undefined
  - temp folder type errors (excluded from tsconfig)
  - FlattenedItem missing maxDepth/minDepth
  - parentId implicit any type in SortableTree
