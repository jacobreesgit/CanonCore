# Deployment 0.23.0 - Context-Aware Connection Filter UI

**Date**: 2026-01-06
**Branch**: development

## Summary

This release makes the sync buttons and connection badges context-aware based on the connection filter selection. When viewing "All Items", the "Sync All" button appears and connection badges display on items. When filtered to a specific connection, the "Sync Connection" button appears and badges hide (since all visible items are from that connection).

## Changes

### Context-Aware Sync Buttons

Sync buttons now adapt based on filter selection:

| Filter Selection                   | Sync Button       |
| ---------------------------------- | ----------------- |
| "All Items" (multiple connections) | "Sync All"        |
| Individual connection selected     | "Sync Connection" |
| Single connection (auto-selected)  | "Sync Connection" |

**Implementation:**

- Added `label` prop to `SyncButton` component for custom button text
- `ItemsView` derives `effectiveSelectedConnection` from filter state
- `isFilteredToConnection` determines which sync button to render

### Context-Aware Connection Badges

Connection badges on items now show/hide based on filter context:

| Filter Selection                   | Connection Badges |
| ---------------------------------- | ----------------- |
| "All Items" (multiple connections) | Visible           |
| Individual connection selected     | Hidden            |
| Single connection (auto-selected)  | Hidden            |

When filtered to a specific connection, badges are redundant since all visible items belong to that connection.

**Implementation:**

- Added `showConnectionBadge` prop to `Grid`, `Tree`, `GridItem`, and `TreeItem` components
- Prop cascades from `ItemsView` through view components to individual items
- `SortableGrid` and `SortableTree` (edit mode) don't pass the prop since they use simplified visuals

### Single Connection Auto-Selection

When only one SFTP connection exists:

- `ConnectionFilter` auto-selects it (no "All Items" option needed)
- `ItemsView` detects this via `connections.length === 1` check
- Shows "Sync Connection" button (not "Sync All")
- Hides connection badges (redundant)

## Files Changed

```
# Modified
components/items/items-view.tsx           # Core context-aware logic
components/sftp/sync-button.tsx           # Added label prop
components/sortable-grid/Grid.tsx         # Added showConnectionBadge prop
components/sortable-grid/GridItem.tsx     # Conditional badge rendering
components/sortable-grid/SortableGrid.tsx # Pass through for type safety
components/sortable-tree/Tree.tsx         # Added showConnectionBadge prop
components/sortable-tree/SortableTree.tsx # Pass through for type safety
components/sortable-tree/components/TreeItem/TreeItem.tsx  # Conditional badge rendering

# E2E tests updated
e2e/journeys/sftp/sftp-sync.spec.ts       # +6 new connection filter tests
e2e/journeys/sftp/sftp-server-to-web.spec.ts  # Updated sync button locators
e2e/journeys/sftp/sftp-web-to-server.spec.ts  # Updated sync button locators
e2e/journeys/media/media-playback.spec.ts     # Updated sync button locators

# Unit tests added
tests/unit/components/sftp/sync-button.test.tsx  # Label prop tests
tests/unit/components/grid-item.test.tsx         # showConnectionBadge tests
tests/unit/components/tree-item.test.tsx         # showConnectionBadge tests

# Design document
docs/plans/2026-01-06-connection-filter-context-aware-ui.md
```

## Test Results

- **Unit tests**: 375 passed
- **E2E tests**: 118 passed

### New E2E Tests

Six new tests verify connection filter sync behavior:

1. `shows Sync All button when All Items selected`
2. `shows Sync Connection button when individual connection selected`
3. `shows Sync Connection when only one connection exists`
4. `shows connection badges when All Items selected`
5. `hides connection badges when filtered to individual connection`

## Deployment Steps

1. Pull latest from development branch
2. Run `pnpm install`
3. Run `pnpm run check` to verify build
4. Deploy to Vercel

No new environment variables required.

## UX Improvements

### Before

- "Sync All" button always visible regardless of filter
- Connection badges always shown on items
- Users couldn't tell which items belonged to which connection when viewing all

### After

- Sync button label matches context (user knows what will sync)
- Badges only show when useful (comparing items across connections)
- Cleaner UI when working with single connection
