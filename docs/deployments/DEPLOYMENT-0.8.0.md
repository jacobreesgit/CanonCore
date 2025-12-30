# Deployment 0.8.0 - Sortable Items System

**Date:** 2025-12-30
**Branch:** development

## Summary

This release adds a complete hierarchical items (folders) system with drag-and-drop reordering, dual view modes (tree/grid), and full CRUD operations. Includes toast notifications, context menus, and comprehensive test coverage.

## Changes

### Items System

- **Hierarchical folders** with unlimited nesting depth
- **Dual view modes**: Tree view (hierarchical) and Grid view (flat cards)
- **Drag-and-drop reordering** using dnd-kit library
- **Breadcrumb navigation** for folder drill-down
- **Context menu actions**: Rename, Delete, Add Subfolder
- **Inline add button** with expandable input field
- **View preference persistence** via localStorage

### Database

- **Item model** with self-referential parent/child relationships
- **Position field** for manual ordering within siblings
- **Cascade delete** for removing folders with children
- **Migration**: `add_item_model` creates Item table with indexes

### UI Components

- **Toast notifications** via Sonner for success/error feedback
- **Context menus** for right-click item actions
- **Dialog components** for rename/delete confirmations
- **Sortable tree** with collapse/expand and indent guides
- **Sortable grid** with responsive card layout

### Testing

- **26 new unit tests** for item-actions validation
- **12 new integration tests** for item CRUD and hierarchy
- **12 new E2E tests** for items functionality (6 desktop + 6 mobile)
- Total: 57 unit tests, 20 integration tests, 46 E2E tests

## New Files

| File                                          | Purpose                         |
| --------------------------------------------- | ------------------------------- |
| `lib/item-actions.ts`                         | Server actions for item CRUD    |
| `lib/item-utils.ts`                           | Tree/flat conversion utilities  |
| `lib/types.ts`                                | Shared TypeScript types         |
| `app/(dashboard)/dashboard/[itemId]/page.tsx` | Folder detail page              |
| `components/items/`                           | Items view, add button, context |
| `components/sortable-tree/`                   | Tree view with dnd-kit          |
| `components/sortable-grid/`                   | Grid view with dnd-kit          |
| `components/ui/context-menu.tsx`              | shadcn context menu             |
| `components/ui/dialog.tsx`                    | shadcn dialog                   |
| `components/ui/sonner.tsx`                    | Toast notification wrapper      |
| `e2e/journeys/items/`                         | E2E tests for items feature     |
| `e2e/pages/items.page.ts`                     | Page object for items           |
| `tests/unit/lib/item-actions.test.ts`         | Unit tests for item actions     |
| `tests/integration/items/`                    | Integration tests for items     |

## Modified Files

| File                                 | Changes                            |
| ------------------------------------ | ---------------------------------- |
| `app/(dashboard)/dashboard/page.tsx` | Renders ItemsView instead of cards |
| `app/layout.tsx`                     | Added Toaster component            |
| `components/site-header.tsx`         | Updated header layout              |
| `lib/validations.ts`                 | Added item name validation schema  |
| `prisma/schema.prisma`               | Added Item model                   |
| `package.json`                       | Added dnd-kit, sonner dependencies |

## Removed Files

| File                           | Reason                   |
| ------------------------------ | ------------------------ |
| `components/section-cards.tsx` | Replaced by items system |

## Database Migration

Run after deploying:

```bash
npx prisma migrate deploy
```

Migration `add_item_model`:

- Creates `Item` table with id, name, parentId, position, userId, timestamps
- Adds foreign key constraints and indexes

## New Dependencies

```json
{
  "@dnd-kit/core": "^6.3.1",
  "@dnd-kit/sortable": "^10.0.0",
  "@dnd-kit/utilities": "^3.2.2",
  "@radix-ui/react-context-menu": "^2.2.16",
  "@radix-ui/react-dialog": "^1.1.15",
  "sonner": "^2.0.7"
}
```

## Verification

All checks pass:

- Format, lint, type-check, knip, build
- 57 unit tests
- 20 integration tests
- 46 E2E tests (23 desktop + 23 mobile)
