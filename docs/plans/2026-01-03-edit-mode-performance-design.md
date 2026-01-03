# Edit Mode Performance Optimization Design

## Overview

Optimize grid and tree view performance by separating view-only rendering from drag-and-drop functionality. Users toggle into "Edit mode" to enable reordering.

## Problem

Current implementation wraps every item with dnd-kit's sortable context, sensors, and collision detection—even when users are just viewing. This overhead scales with item count and impacts performance.

**dnd-kit overhead per item:**

- `useSortable` hook registration with SortableContext
- Transform listeners and calculations
- Collision detection candidates
- Event listeners for drag operations

## Solution

Introduce an "Edit mode" toggle that switches between lightweight view-only components and full DnD-enabled components.

---

## User Experience

### View Mode (default)

- Grid: Cards with artwork thumbnails, name, sync badge, click to navigate
- Tree: Collapsible hierarchy with artwork thumbnails, sync badge, click to navigate
- Full visual richness for browsing
- No drag handles visible, no sortable wrappers
- Context menu remains functional (Settings, Delete, Add Subfolder)

### Edit Mode

- User clicks "Edit" button (next to ViewToggle)
- Visual indicator: "Done" button replaces "Edit"
- **Simplified visuals for reordering:**
  - No artwork thumbnails (folder icon instead)
  - No sync badge
  - Drag handles visible
- Items become draggable
- Click navigation still works (drag requires handle or distance threshold)
- "Done" exits edit mode

### Automatic Exit

- Navigating away exits edit mode
- Switching view mode (grid ↔ tree) exits edit mode
- No persistence needed (edit mode is transient)

### Out of Scope

- Mobile long-press to trigger edit mode (future enhancement)

---

## Component Architecture

### File Structure

```
components/
├── items/
│   ├── edit-mode-toggle.tsx      # Edit/Done button (new)
│   └── items-view.tsx            # (modify) pass isEditing to children
├── sortable-grid/
│   ├── Grid.tsx                  # View-only grid container (new)
│   ├── GridItem.tsx              # (existing) display component
│   ├── SortableGrid.tsx          # (existing) DnD wrapper
│   └── SortableGridItem.tsx      # (existing) sortable wrapper
├── sortable-tree/
│   ├── Tree.tsx                  # View-only tree container (new)
│   ├── SortableTree.tsx          # (existing) DnD wrapper
│   ├── utilities.ts              # (existing) tree manipulation
│   └── components/
│       └── TreeItem/
│           ├── TreeItem.tsx      # (modify) add showArtwork, showSyncBadge props
│           └── SortableTreeItem.tsx  # (modify) pass showArtwork={false}
├── hooks/
│   └── use-tree-collapse.ts      # Shared collapse state logic (new)
```

### State Management

- `isEditing` boolean state lives in `ItemsView`
- Passed down to determine which container renders
- No React context needed

### Rendering Logic

```tsx
{viewMode === "grid" ? (
  isEditing ? <SortableGrid ... /> : <Grid ... />
) : (
  isEditing ? <SortableTree ... /> : <Tree ... />
)}
```

---

## Collapse State Management

Both `Tree.tsx` and `SortableTree.tsx` need collapse/expand functionality. Extract to shared hook:

### use-tree-collapse.ts

```tsx
interface UseTreeCollapseReturn {
  isCollapsed(id: UniqueIdentifier): boolean;
  toggleCollapse(id: UniqueIdentifier): void;
  collapseAll(): void;
  expandAll(): void;
}

function useTreeCollapse(items: TreeItems): UseTreeCollapseReturn {
  const [collapsedIds, setCollapsedIds] = useState<Set<UniqueIdentifier>>(
    new Set()
  );

  // Get all item IDs that have children (collapsible nodes)
  const collapsibleIds = useMemo(() => {
    const ids: UniqueIdentifier[] = [];
    const collectIds = (nodes: TreeItems) => {
      for (const node of nodes) {
        if (node.children.length > 0) {
          ids.push(node.id);
          collectIds(node.children);
        }
      }
    };
    collectIds(items);
    return ids;
  }, [items]);

  const isCollapsed = useCallback(
    (id: UniqueIdentifier) => collapsedIds.has(id),
    [collapsedIds]
  );

  const toggleCollapse = useCallback((id: UniqueIdentifier) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const collapseAll = useCallback(() => {
    setCollapsedIds(new Set(collapsibleIds));
  }, [collapsibleIds]);

  const expandAll = useCallback(() => {
    setCollapsedIds(new Set());
  }, []);

  return { isCollapsed, toggleCollapse, collapseAll, expandAll };
}
```

This hook is used by both `Tree.tsx` and `SortableTree.tsx`, ensuring collapse state is consistent when switching between view and edit modes.

---

## View-Only Components

### Visual Differences

View mode and edit mode have intentionally different appearances:

| Feature            | View Mode    | Edit Mode      |
| ------------------ | ------------ | -------------- |
| Artwork thumbnail  | ✅ Shown     | ❌ Folder icon |
| Sync badge         | ✅ Shown     | ❌ Hidden      |
| Drag handle (tree) | ❌ Hidden    | ✅ Visible     |
| DnD functionality  | ❌ Disabled  | ✅ Enabled     |
| Context menu       | ✅ Available | ✅ Available   |
| Click navigation   | ✅ Works     | ✅ Works       |

This separation means:

- View components (`Grid.tsx`, `Tree.tsx`) show full visual richness by default
- Edit components pass `showArtwork={false}` to simplify during reordering
- Clear visual distinction helps users understand current mode

### Grid.tsx (View Mode)

```tsx
interface GridProps {
  items: ItemWithArtwork[];
  onItemClick?(id: string): void;
  onOpenSettings?(id: string): void;
  onDeleteItem?(id: string): Promise<void>;
}
```

- Simple CSS grid layout (same responsive columns)
- **Shows artwork thumbnails** (fetched via artworkId)
- **Shows sync badge** for SFTP-linked items
- Maps items to `GridItem` directly
- No DndContext, SortableContext, sensors, or DragOverlay

### Tree.tsx (View Mode)

```tsx
interface TreeProps {
  items: TreeItems;
  onItemClick?(id: string): void;
  onOpenSettings?(id: string): void;
  onDeleteItem?(id: string): Promise<void>;
  onAddChild?(parentId: string, name: string): Promise<string | undefined>;
  indentationWidth?: number;
}
```

- Uses `useTreeCollapse` hook for collapse state
- Flattened list render (same as SortableTree)
- **Shows artwork thumbnails** in tree nodes
- **Shows sync badge** for SFTP-linked items
- **No drag handle** (not needed in view mode)
- Maps to `TreeItem` directly
- No DndContext, sensors, or DragOverlay

### SortableGrid / SortableTree (Edit Mode)

Existing components remain largely unchanged:

- **No artwork thumbnails** (folder icon instead)
- **No sync badge**
- Drag handles visible
- Full DnD functionality

Minor updates needed:

- Remove artwork rendering from edit mode components
- Remove sync badge rendering from edit mode components

### Component Changes Summary

| Component              | Change                                               |
| ---------------------- | ---------------------------------------------------- |
| `GridItem.tsx`         | Add `showArtwork` prop (default true)                |
| `TreeItem.tsx`         | Add `showArtwork`, `showSyncBadge` props             |
| `SortableGridItem.tsx` | Pass `showArtwork={false}` to GridItem               |
| `SortableTreeItem.tsx` | Pass `showArtwork={false}`, `showSyncBadge={false}`  |
| `Grid.tsx`             | New - view-only, shows artwork/badge                 |
| `Tree.tsx`             | New - view-only, shows artwork/badge, no drag handle |

---

## Testing Strategy

### Unit Tests (Vitest)

| Component              | Tests                                                             |
| ---------------------- | ----------------------------------------------------------------- |
| `edit-mode-toggle.tsx` | Toggle state, button text changes, aria labels                    |
| `Grid.tsx`             | Renders items with artwork, click handlers fire, no DnD imports   |
| `Tree.tsx`             | Renders hierarchy with artwork, collapse works, no DnD imports    |
| `GridItem.tsx`         | `showArtwork` prop toggles thumbnail vs folder icon               |
| `TreeItem.tsx`         | `showArtwork`, `showSyncBadge` props toggle visibility            |
| `SortableGridItem.tsx` | Passes `showArtwork={false}` to GridItem                          |
| `SortableTreeItem.tsx` | Passes `showArtwork={false}`, `showSyncBadge={false}` to TreeItem |
| `use-tree-collapse.ts` | Toggle, collapseAll, expandAll, isCollapsed                       |

### Integration Tests

None needed—no new server actions.

### E2E Tests (Playwright)

**View mode (default):**

- Grid/Tree renders with artwork thumbnails visible
- Sync badge visible on SFTP-linked items
- No drag handles visible
- Click navigates to item detail
- Context menu works (Settings, Delete, Add Subfolder)
- Collapse/expand works in tree

**Edit mode:**

- Click "Edit" shows drag handles, button becomes "Done"
- Artwork thumbnails replaced with folder icons
- Sync badge hidden
- Drag and drop reorders items
- Click "Done" returns to view mode with artwork

**Mode transitions:**

- Switching view mode (grid ↔ tree) exits edit mode
- Navigation exits edit mode
- Edit toggle hidden when items empty

### Test File Locations

```
tests/unit/components/edit-mode-toggle.test.ts
tests/unit/components/grid.test.ts
tests/unit/components/tree.test.ts
tests/unit/components/grid-item.test.ts
tests/unit/components/tree-item.test.ts
tests/unit/components/sortable-grid-item.test.ts
tests/unit/components/sortable-tree-item.test.ts
tests/unit/hooks/use-tree-collapse.test.ts
e2e/journeys/items/edit-mode.spec.ts
```

---

## Implementation Plan

### Phase 1: Create Shared Infrastructure

- Create `use-tree-collapse.ts` hook
- Add `showArtwork` and `showSyncBadge` props to `TreeItem` and `GridItem`
- Add unit tests for hook and component prop changes

### Phase 2: Create View-Only Components

- Create `Grid.tsx` (extract rendering from `SortableGrid`)
- Create `Tree.tsx` (extract rendering from `SortableTree`, use collapse hook)
- Refactor `SortableTree.tsx` to use collapse hook
- Add unit tests for Grid and Tree

### Phase 3: Add Edit Mode Toggle

- Create `EditModeToggle` component
- Add `isEditing` state to `ItemsView`
- Conditionally render view-only vs sortable components
- Default to view mode

### Phase 4: Update E2E Tests

- Update existing drag tests (add "Edit" click before drag)
- Add new E2E tests for edit mode toggle
- Add mode transition tests

### Phase 5: Cleanup

- Remove dead code
- Run `pnpm run knip` to verify
- Run `pnpm run check` for full validation

### Files Changed

| Action | File                                                        |
| ------ | ----------------------------------------------------------- | ---------------------------------------- |
| Create | `hooks/use-tree-collapse.ts`                                |
| Create | `components/sortable-grid/Grid.tsx`                         |
| Create | `components/sortable-tree/Tree.tsx`                         |
| Create | `components/items/edit-mode-toggle.tsx`                     |
| Modify | `components/sortable-grid/GridItem.tsx`                     | Add `showArtwork` prop                   |
| Modify | `components/sortable-grid/SortableGridItem.tsx`             | Pass `showArtwork={false}`               |
| Modify | `components/sortable-tree/components/TreeItem/TreeItem.tsx` | Add `showArtwork`, `showSyncBadge` props |
| Modify | `components/sortable-tree/SortableTreeItem.tsx`             | Pass props to hide artwork/badge         |
| Modify | `components/sortable-tree/SortableTree.tsx`                 | Use collapse hook                        |
| Modify | `components/items/items-view.tsx`                           | Add edit mode state/toggle               |
| Create | `tests/unit/components/*.test.ts`                           |
| Create | `tests/unit/hooks/use-tree-collapse.test.ts`                |
| Create | `e2e/journeys/items/edit-mode.spec.ts`                      |
| Modify | `e2e/journeys/items/*.spec.ts`                              |

---

## Edge Cases

| Scenario                           | Behavior                               |
| ---------------------------------- | -------------------------------------- |
| Toggle view mode while editing     | Exit edit mode, switch view            |
| Navigate away while editing        | Exit edit mode (unmount)               |
| Empty state (`items.length === 0`) | Hide edit toggle                       |
| Single item                        | Show toggle, drag has no effect        |
| Reorder during pending state       | Toggle remains functional              |
| Reorder fails                      | Toast error, items revert              |
| Items change during edit (sync)    | Safe—reorder saves immediately on drop |

---

## Accessibility

**Edit Mode Toggle:**

- Edit/Done button focusable with keyboard
- Button labels: "Edit items" / "Done editing"
- `aria-live` region announces mode changes ("Now editing" / "Editing complete")

**View Mode:**

- No drag handles in DOM (view-only components)
- Standard keyboard navigation (Tab, Enter to navigate)

**Edit Mode:**

- Drag handles always visible and focusable
- Existing keyboard DnD works (Space to pick up, arrows to move)
- Tab order includes drag handles

**Both Modes:**

- Context menu accessible via keyboard
- Collapse/expand in tree works with Enter key

---

## Alternatives Considered

### Virtualization

Using `@tanstack/react-virtual` to render only visible items.

**Rejected because:**

- dnd-kit + virtualization is complex (scroll position issues during drag)
- Tree virtualization especially tricky with nesting
- Edit mode toggle is simpler and sufficient

### Hybrid (Virtualization + Edit Mode)

Virtualize in view mode, render all in edit mode.

**Rejected because:**

- Unnecessary complexity
- Edit mode toggle alone solves the performance issue
