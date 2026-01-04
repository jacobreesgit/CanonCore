# Deployment 0.17.0 - Item Short Description

**Date**: 2026-01-04
**Branch**: development

## Summary

This release adds an optional short description field to items. Descriptions are editable through the settings dialog and display in grid and tree views during view mode. The field supports up to 200 characters with automatic whitespace trimming.

## Changes

### Database Schema

Added `description` column to the Item model:

```prisma
model Item {
  description String?  @db.VarChar(200)
}
```

Migration: `20260104154405_add_item_description`

### Validation

New `itemDescriptionSchema` using Zod's transform-before-validate pattern:

```typescript
export const itemDescriptionSchema = z
  .string()
  .transform((val) => val.trim())
  .pipe(z.string().max(200, "Description must be 200 characters or less"));
```

Whitespace is trimmed before length validation, preventing edge cases with padded strings.

### Settings Dialog

Added description section to **Item Settings**:

- Text input with 200 character limit
- Live character count (X/200)
- Separate Save button (independent from name save)
- Enter key triggers save
- Empty string clears description (stores as null)

### View Components

Description displays in view mode, hidden in edit mode:

| Component    | showDescription |
| ------------ | --------------- |
| Grid         | true            |
| SortableGrid | false           |
| Tree         | true            |
| SortableTree | false           |

Display styling:

- Grid: Below item name, left-aligned with folder icon
- Tree: Below item name, truncated with ellipsis

### Server Actions

Updated `createItem` and `updateItem` in `lib/item-actions.ts`:

```typescript
// Create with optional description
createItem(parentId, name, description?)

// Update description (empty string clears it)
updateItem(id, { description: "New description" })
updateItem(id, { description: "" }) // clears to null
```

## Files Changed

```
prisma/
├── schema.prisma                    # Add description field
└── migrations/
    └── 20260104154405_add_item_description/
        └── migration.sql            # NEW

lib/
├── types.ts                         # Add description to Item, TreeItem
├── validations.ts                   # Add itemDescriptionSchema
├── item-actions.ts                  # Update createItem, updateItem
├── item-utils.ts                    # Include description in tree conversion
└── sftp-actions.ts                  # Include description in mappings

components/
├── items/
│   ├── item-settings-dialog.tsx     # Add description section
│   └── items-view.tsx               # Add handleUpdateDescription
├── sortable-grid/
│   ├── Grid.tsx                     # Pass description, showDescription
│   ├── GridItem.tsx                 # Display description
│   └── SortableGrid.tsx             # Pass showDescription={false}
└── sortable-tree/
    ├── Tree.tsx                     # Pass description, showDescription
    ├── SortableTree.tsx             # Pass showDescription={false}
    └── components/TreeItem/
        └── TreeItem.tsx             # Display description

tests/
├── unit/lib/
│   ├── validations.test.ts          # Add itemDescriptionSchema tests
│   └── item-actions.test.ts         # Add description tests
├── unit/components/
│   └── grid.test.tsx                # Update mock items
└── integration/items/
    └── item-crud.test.ts            # Add description integration tests

e2e/
├── pages/items.page.ts              # Add description helpers
└── journeys/items/
    └── items-settings.spec.ts       # Add 7 description E2E tests
```

## Test Results

- **Unit tests**: 232 passed (+14)
- **Integration tests**: 48 passed (+5)
- **E2E tests**: 101 passed (+7)

## Deployment Steps

1. Pull latest from development branch
2. Run `pnpm install` (no new dependencies)
3. Run `npx prisma migrate deploy` to apply migration
4. Run `npx prisma generate` to update client
5. Run `pnpm run check` to verify build
6. Deploy to Vercel

## Rollback

If issues occur, revert to v0.16.0 and run:

```sql
ALTER TABLE "Item" DROP COLUMN "description";
```

Delete migration folder: `prisma/migrations/20260104154405_add_item_description/`
