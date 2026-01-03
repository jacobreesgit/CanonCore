# Deployment 0.16.0 - Edit Mode Performance Optimization

**Date**: 2026-01-03
**Branch**: development

## Summary

This release introduces an Edit Mode toggle that separates view-only rendering from drag-and-drop functionality. View mode uses lightweight components without dnd-kit overhead, improving performance when browsing. Edit mode enables reordering with simplified visuals.

## Changes

### Edit Mode Toggle

Added an **Edit/Done** button to toggle between browsing and reordering:

- **View Mode** (default): Full visual richness with artwork thumbnails
- **Edit Mode**: Simplified visuals with folder icons and drag handles
- Automatic exit when switching view modes (grid/tree)
- Hidden when folder list is empty

### View-Only Components

Created lightweight view components without dnd-kit dependencies:

| Component | Purpose                                    |
| --------- | ------------------------------------------ |
| `Grid`    | View-only grid with artwork, click to open |
| `Tree`    | View-only tree with collapse, no drag      |

### useTreeCollapse Hook

Extracted collapse/expand logic to a shared hook:

```typescript
const { isCollapsed, toggleCollapse, collapseAll, expandAll } =
  useTreeCollapse(items);
```

Used by both Tree (view mode) and SortableTree (edit mode) for consistent behavior.

### Component Props

Added display control props to base components:

- `showArtwork` - Toggle artwork thumbnail vs folder icon
- `showDragHandle` - Toggle drag handle visibility

View mode: `showArtwork={true}`, `showDragHandle={false}`
Edit mode: `showArtwork={false}`, `showDragHandle={true}`

### Accessibility

- Drag handles have `aria-label="Drag handle"`
- Collapse buttons have dynamic `aria-label="Expand folder"` / `"Collapse folder"`
- Edit toggle has `aria-label="Edit items"` / `"Done editing"`

## Files Changed

```
components/
├── items/
│   ├── edit-mode-toggle.tsx    # NEW - Edit/Done button
│   ├── index.ts                # Export EditModeToggle
│   └── items-view.tsx          # Integrate edit mode state
├── sortable-grid/
│   ├── Grid.tsx                # NEW - View-only grid
│   ├── GridItem.tsx            # Add showArtwork prop
│   ├── SortableGridItem.tsx    # Pass showArtwork={false}
│   └── index.ts                # Export Grid
└── sortable-tree/
    ├── Tree.tsx                # NEW - View-only tree
    ├── components/TreeItem/
    │   ├── TreeItem.tsx        # Add showArtwork, showDragHandle
    │   └── SortableTreeItem.tsx # Pass props for edit mode
    └── index.ts                # Export Tree

hooks/
└── use-tree-collapse.ts        # NEW - Shared collapse state

tests/unit/
├── components/
│   ├── edit-mode-toggle.test.tsx  # NEW
│   ├── grid.test.tsx              # NEW
│   ├── grid-item.test.tsx         # NEW
│   ├── tree.test.tsx              # NEW
│   └── tree-item.test.tsx         # NEW
└── hooks/
    └── use-tree-collapse.test.ts  # NEW

e2e/
├── journeys/items/
│   ├── edit-mode.spec.ts          # NEW - E2E tests
│   ├── items-grid-drag.spec.ts    # Enter edit mode before drag
│   └── items-tree-drag.spec.ts    # Enter edit mode before drag
└── pages/
    └── items.page.ts              # Add enterEditMode, exitEditMode
```

## Test Results

- **Unit tests**: 218 passed
- **Integration tests**: 43 passed
- **E2E tests**: 95 passed (chromium)

## Performance Impact

View mode no longer loads dnd-kit sensors, contexts, or collision detection per item. This reduces initial render overhead and improves responsiveness when browsing large folder lists.

## Deployment Steps

1. Pull latest from development branch
2. Run `pnpm install` (no new dependencies)
3. Run `pnpm run check` to verify build
4. Deploy to Vercel

## Rollback

If issues occur, revert to v0.15.0. No database migrations in this release.
