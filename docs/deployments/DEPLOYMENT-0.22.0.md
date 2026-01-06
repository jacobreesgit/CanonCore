# Deployment 0.22.0 - Grid Item Redesign & SFTP Simplification

**Date**: 2026-01-06
**Branch**: development

## Summary

This release redesigns the grid item cards with a Feature222 movie poster aesthetic, simplifies SFTP connection management by removing complex nested pages, and adds a unified sync system. The UI now uses consistent "item" terminology (replacing "folder") throughout the application and documentation.

## Changes

### GridItem Product Card Redesign

Grid items now display as movie poster-style cards with full background images and dark overlays:

- **Full background artwork**: Items with artwork show the image as a full background
- **Dark overlay**: Semi-transparent black overlay (`bg-black/50`) for text readability
- **Hover effect**: Overlay lightens on hover (`bg-black/30`)
- **Fallback gradient**: Items without artwork show a gradient with folder icon
- **Aspect ratio**: Portrait style (`aspect-[2/3]`) on mobile/desktop, square on tablet

**Accessibility improvements:**

- `role="button"` for interactive semantics
- `aria-label` with item name and connection context
- Keyboard navigation (Enter/Space to activate)
- Focus-visible ring styling

**Files changed:**

- `components/sortable-grid/GridItem.tsx` - Complete redesign
- `components/sortable-grid/Grid.tsx` - Updated grid columns
- `components/sortable-grid/SortableGrid.tsx` - Updated props
- `tests/unit/components/grid-item.test.tsx` - 30 comprehensive tests

### SFTP Connection Simplification

Removed complex connection detail and nested item pages in favor of a streamlined connections list:

**Removed routes:**

- `/my-items/connections/[id]/page.tsx` - Connection detail page
- `/my-items/connections/[id]/[itemId]/page.tsx` - Connection item detail page

**New approach:**

- Connections page shows all connections with sync actions
- Items display connection badges showing sync source
- Connection filter lets users browse items by connection

### Unified Sync System

New sync components for consistent SFTP synchronization:

| Component           | Purpose                                     |
| ------------------- | ------------------------------------------- |
| `SyncAllButton`     | Syncs all connections at once with progress |
| `ItemSyncButton`    | Syncs individual item with its connection   |
| `ConnectionFilter`  | Dropdown to filter items by connection      |
| `FilteredItemsView` | Displays items from selected connection     |

**Files added:**

- `components/sftp/sync-all-button.tsx`
- `components/sftp/item-sync-button.tsx`
- `components/items/connection-filter.tsx`
- `components/items/filtered-items-view.tsx`

**New server action:**

- `syncAllConnections()` in `lib/sftp-actions.ts` - Batch sync with aggregated results

### Folder to Item Terminology

Consistent "item" terminology throughout the application:

| Before                   | After                  |
| ------------------------ | ---------------------- |
| `add-folder-dialog.tsx`  | `add-item-dialog.tsx`  |
| `add-folder-context.tsx` | `add-item-context.tsx` |
| "Create Folder"          | "Create Item"          |
| "Add Subfolder"          | "Add Child Item"       |

### Documentation Updates

Renamed and updated user documentation:

| Before              | After              |
| ------------------- | ------------------ |
| `create-folder.mdx` | `create-item.mdx`  |
| `manage-files.mdx`  | `manage-items.mdx` |
| `sync-files.mdx`    | `sync-items.mdx`   |

All documentation updated to use "item" terminology consistently.

## Files Changed

```
# Major additions
components/sftp/sync-all-button.tsx
components/sftp/item-sync-button.tsx
components/sftp/index.ts
components/items/connection-filter.tsx
components/items/filtered-items-view.tsx
tests/unit/components/sftp/sync-all-button.test.tsx
tests/unit/components/sftp/item-sync-button.test.tsx
tests/unit/components/sftp/connection-card.test.tsx
tests/unit/components/items/connection-filter.test.tsx
tests/unit/lib/sftp-actions-sync-all.test.ts
docs/plans/2026-01-05-grid-item-product-card-redesign.md
docs/plans/2026-01-05-sftp-connection-simplification.md
docs/plans/2026-01-05-unified-sync-button.md

# Renamed
components/items/add-folder-dialog.tsx → add-item-dialog.tsx
contexts/add-folder-context.tsx → add-item-context.tsx
content/docs/connections/manage-files.mdx → manage-items.mdx
content/docs/connections/sync-files.mdx → sync-items.mdx
content/docs/files-and-folders/create-folder.mdx → create-item.mdx
tests/unit/components/add-folder-dialog.test.tsx → add-item-dialog.test.tsx

# Deleted
app/(my-items)/my-items/connections/[id]/page.tsx
app/(my-items)/my-items/connections/[id]/[itemId]/page.tsx
components/ui/aspect-ratio.tsx (unused)

# Modified (key files)
components/sortable-grid/GridItem.tsx
components/sortable-grid/Grid.tsx
components/sortable-grid/SortableGrid.tsx
components/sortable-tree/Tree.tsx
components/sortable-tree/components/TreeItem/TreeItem.tsx
components/items/items-view.tsx
components/items/item-context-menu.tsx
components/sftp/connection-card.tsx
components/my-items-providers.tsx
lib/sftp-actions.ts
lib/item-actions.ts
lib/types.ts
```

## Test Results

- **Unit tests**: 362 passed
- **Integration tests**: 53 passed
- **E2E tests**: 122 passed

## Deployment Steps

1. Pull latest from development branch
2. Run `pnpm install`
3. Run `pnpm run check` to verify build
4. Deploy to Vercel

No new environment variables required.

## Visual Changes

### Grid Items - Before

- Card-based layout with small artwork thumbnails
- Limited visual hierarchy

### Grid Items - After

- Full background images with movie poster aesthetic
- Dark overlay for text contrast
- Prominent file count badges
- Connection source badges
- Portrait aspect ratio for visual impact

### Connections - Before

- Nested pages for connection details
- Complex navigation to manage items

### Connections - After

- Single connections list with all actions
- Sync All button for batch operations
- Connection filter for browsing items by source
