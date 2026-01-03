# Edit Mode Performance Optimization - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Separate view-only rendering from drag-and-drop to improve grid/tree performance.

**Architecture:** View mode uses lightweight components (Grid.tsx, Tree.tsx) without dnd-kit. Edit mode uses existing Sortable\* components. Toggle controlled by isEditing state in ItemsView.

**Tech Stack:** React 19, dnd-kit, Tailwind CSS, Vitest, Playwright

---

## Task 1: Create useTreeCollapse Hook

**Files:**

- Create: `hooks/use-tree-collapse.ts`
- Create: `tests/unit/hooks/use-tree-collapse.test.ts`

**Step 1: Write the failing test**

Create `tests/unit/hooks/use-tree-collapse.test.ts`:

```typescript
/**
 * Unit tests for useTreeCollapse hook.
 */

import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTreeCollapse } from "@/hooks/use-tree-collapse";
import type { TreeItems } from "@/lib/types";

const mockItems: TreeItems = [
  {
    id: "1",
    name: "Parent 1",
    order: 0,
    depth: 0,
    parentId: null,
    children: [
      {
        id: "1-1",
        name: "Child 1",
        order: 0,
        depth: 1,
        parentId: "1",
        children: [],
      },
    ],
  },
  {
    id: "2",
    name: "Parent 2",
    order: 1,
    depth: 0,
    parentId: null,
    children: [],
  },
];

describe("useTreeCollapse", () => {
  it("should return isCollapsed as false by default", () => {
    const { result } = renderHook(() => useTreeCollapse(mockItems));
    expect(result.current.isCollapsed("1")).toBe(false);
  });

  it("should toggle collapse state", () => {
    const { result } = renderHook(() => useTreeCollapse(mockItems));

    act(() => {
      result.current.toggleCollapse("1");
    });

    expect(result.current.isCollapsed("1")).toBe(true);

    act(() => {
      result.current.toggleCollapse("1");
    });

    expect(result.current.isCollapsed("1")).toBe(false);
  });

  it("should collapse all items with children", () => {
    const { result } = renderHook(() => useTreeCollapse(mockItems));

    act(() => {
      result.current.collapseAll();
    });

    expect(result.current.isCollapsed("1")).toBe(true);
    expect(result.current.isCollapsed("2")).toBe(false); // No children
  });

  it("should expand all items", () => {
    const { result } = renderHook(() => useTreeCollapse(mockItems));

    act(() => {
      result.current.collapseAll();
    });

    act(() => {
      result.current.expandAll();
    });

    expect(result.current.isCollapsed("1")).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit -- tests/unit/hooks/use-tree-collapse.test.ts`
Expected: FAIL with "Cannot find module '@/hooks/use-tree-collapse'"

**Step 3: Write the implementation**

Create `hooks/use-tree-collapse.ts`:

```typescript
/**
 * Hook for managing tree collapse/expand state.
 * Used by both Tree.tsx (view mode) and SortableTree.tsx (edit mode).
 */

"use client";

import { useState, useCallback, useMemo } from "react";
import type { UniqueIdentifier } from "@dnd-kit/core";
import type { TreeItems } from "@/lib/types";

export interface UseTreeCollapseReturn {
  /** Check if an item is collapsed. */
  isCollapsed(id: UniqueIdentifier): boolean;
  /** Toggle collapse state for an item. */
  toggleCollapse(id: UniqueIdentifier): void;
  /** Collapse all items that have children. */
  collapseAll(): void;
  /** Expand all items. */
  expandAll(): void;
}

/**
 * Manages collapse/expand state for tree items.
 *
 * @param items - Tree items to manage collapse state for
 * @returns Collapse state and control functions
 */
export function useTreeCollapse(items: TreeItems): UseTreeCollapseReturn {
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

**Step 4: Run test to verify it passes**

Run: `pnpm run test:unit -- tests/unit/hooks/use-tree-collapse.test.ts`
Expected: PASS (4 tests)

**Step 5: Commit**

```bash
git add hooks/use-tree-collapse.ts tests/unit/hooks/use-tree-collapse.test.ts
git commit -m "feat(hooks): add useTreeCollapse hook for shared collapse state"
```

---

## Task 2: Add showArtwork Prop to GridItem

**Files:**

- Modify: `components/sortable-grid/GridItem.tsx`
- Create: `tests/unit/components/grid-item.test.tsx`

**Step 1: Write the failing test**

Create `tests/unit/components/grid-item.test.tsx`:

```typescript
/**
 * Unit tests for GridItem component.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { GridItem } from "@/components/sortable-grid/GridItem";

describe("GridItem", () => {
  it("should render artwork when showArtwork is true and artworkId exists", () => {
    render(
      <GridItem
        id="1"
        name="Test Item"
        artworkId="artwork-123"
        showArtwork={true}
      />
    );

    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("src", "/api/stream/artwork-123");
  });

  it("should render folder icon when showArtwork is false even with artworkId", () => {
    render(
      <GridItem
        id="1"
        name="Test Item"
        artworkId="artwork-123"
        showArtwork={false}
      />
    );

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("should default showArtwork to true", () => {
    render(<GridItem id="1" name="Test Item" artworkId="artwork-123" />);

    const img = screen.getByRole("img");
    expect(img).toBeInTheDocument();
  });

  it("should render folder icon when no artworkId", () => {
    render(<GridItem id="1" name="Test Item" showArtwork={true} />);

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit -- tests/unit/components/grid-item.test.tsx`
Expected: FAIL (showArtwork prop doesn't exist yet)

**Step 3: Modify GridItem to add showArtwork prop**

Update `components/sortable-grid/GridItem.tsx`:

```typescript
/**
 * Grid item card component for sortable grid view.
 * Displays item container with refined hover states and smooth transitions.
 */

"use client";

import React, { forwardRef, HTMLAttributes } from "react";
import type { UniqueIdentifier } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import { Folder } from "lucide-react";

export interface GridItemProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "id"> {
  id: UniqueIdentifier;
  name: string;
  isDragging?: boolean;
  isOverlay?: boolean;
  handleProps?: Record<string, unknown>;
  onClick?(): void;
  /** SFTP path if linked to remote server. */
  sftpPath?: string | null;
  /** Artwork file ID for thumbnail display. */
  artworkId?: string | null;
  /** Whether to show artwork thumbnail. Defaults to true. */
  showArtwork?: boolean;
}

export const GridItem = forwardRef<HTMLDivElement, GridItemProps>(
  function GridItem(
    {
      id,
      name,
      isDragging,
      isOverlay,
      handleProps,
      onClick,
      className,
      style,
      artworkId,
      showArtwork = true,
      ...props
    },
    ref
  ) {
    const shouldShowArtwork = showArtwork && artworkId;

    return (
      <div
        ref={ref}
        data-id={String(id)}
        onClick={onClick}
        className={cn(
          "group relative flex cursor-pointer flex-col overflow-hidden",
          "bg-card rounded-xl border",
          "transition-all duration-200 ease-out",
          "hover:bg-accent/40 hover:border-accent-foreground/20 hover:shadow-md",
          "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
          isDragging && "scale-[0.98] opacity-40",
          isOverlay && [
            "ring-primary/50 shadow-2xl ring-2 shadow-black/25",
            "bg-card/95 backdrop-blur-sm",
            "scale-[1.03]",
            "border-primary/30",
          ],
          className
        )}
        style={style}
        {...handleProps}
        {...props}
      >
        {/* Artwork Thumbnail or Folder Icon */}
        {shouldShowArtwork ? (
          <div className="relative h-24 w-full overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/stream/${artworkId}`}
              alt=""
              className={cn(
                "h-full w-full object-cover",
                "transition-transform duration-300",
                "group-hover:scale-105"
              )}
            />
            <div
              className={cn(
                "absolute inset-0",
                "from-card/60 bg-gradient-to-t via-transparent to-transparent"
              )}
            />
          </div>
        ) : (
          <div
            className={cn(
              "flex h-24 w-full items-center justify-center",
              "from-muted/80 to-muted bg-gradient-to-br"
            )}
          >
            <Folder
              className={cn(
                "size-10 transition-colors duration-200",
                "text-muted-foreground/50",
                "group-hover:text-primary/60"
              )}
              strokeWidth={1.5}
            />
          </div>
        )}

        {/* Item Name */}
        <div className="flex items-center gap-2 p-3">
          <Folder
            className={cn(
              "size-4 shrink-0 transition-colors duration-200",
              "text-muted-foreground/70",
              "group-hover:text-primary/80"
            )}
            strokeWidth={1.75}
          />
          <span
            className={cn(
              "truncate text-sm font-medium",
              "text-foreground/85 transition-colors duration-150",
              "group-hover:text-foreground"
            )}
          >
            {name}
          </span>
        </div>

        {/* Subtle drag indicator on hover */}
        <div
          className={cn(
            "absolute inset-x-0 top-0 h-1 rounded-t-xl",
            "via-primary/0 bg-gradient-to-r from-transparent to-transparent",
            "transition-all duration-200",
            "group-hover:via-primary/30"
          )}
        />
      </div>
    );
  }
);
```

**Step 4: Run test to verify it passes**

Run: `pnpm run test:unit -- tests/unit/components/grid-item.test.tsx`
Expected: PASS (4 tests)

**Step 5: Commit**

```bash
git add components/sortable-grid/GridItem.tsx tests/unit/components/grid-item.test.tsx
git commit -m "feat(GridItem): add showArtwork prop for view/edit mode toggle"
```

---

## Task 3: Add showArtwork and showDragHandle Props to TreeItem

**Files:**

- Modify: `components/sortable-tree/components/TreeItem/TreeItem.tsx`
- Create: `tests/unit/components/tree-item.test.tsx`

**Step 1: Write the failing test**

Create `tests/unit/components/tree-item.test.tsx`:

```typescript
/**
 * Unit tests for TreeItem component.
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TreeItem } from "@/components/sortable-tree/components/TreeItem/TreeItem";

describe("TreeItem", () => {
  const defaultProps = {
    id: "1",
    value: "Test Item",
    depth: 0,
    indentationWidth: 20,
  };

  it("should render artwork when showArtwork is true and artworkId exists", () => {
    render(
      <TreeItem {...defaultProps} artworkId="artwork-123" showArtwork={true} />
    );

    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("src", "/api/stream/artwork-123");
  });

  it("should render folder icon when showArtwork is false", () => {
    render(
      <TreeItem {...defaultProps} artworkId="artwork-123" showArtwork={false} />
    );

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("should hide drag handle when showDragHandle is false", () => {
    render(<TreeItem {...defaultProps} showDragHandle={false} />);

    // Drag handle should not be visible
    const dragHandle = screen.queryByRole("button", { name: "Drag handle" });
    expect(dragHandle).not.toBeInTheDocument();
  });

  it("should show drag handle by default", () => {
    render(<TreeItem {...defaultProps} />);

    // Should have the drag handle button
    const dragHandle = screen.getByRole("button", { name: "Drag handle" });
    expect(dragHandle).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit -- tests/unit/components/tree-item.test.tsx`
Expected: FAIL (showArtwork and showDragHandle props don't exist)

**Step 3: Modify TreeItem to add props**

Update `components/sortable-tree/components/TreeItem/TreeItem.tsx`:

```typescript
/**
 * Base tree item component with drag handle, collapse toggle, and actions.
 * Features refined micro-interactions and subtle visual feedback.
 */

"use client";

import React, { forwardRef, HTMLAttributes } from "react";
import type { UniqueIdentifier } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import {
  ChevronRight,
  Folder,
  FolderOpen,
  GripVertical,
  Trash2,
} from "lucide-react";

export interface TreeItemProps
  extends Omit<HTMLAttributes<HTMLLIElement>, "id"> {
  id: UniqueIdentifier;
  value: string;
  depth: number;
  indentationWidth: number;
  collapsed?: boolean;
  clone?: boolean;
  childCount?: number;
  indicator?: boolean;
  ghost?: boolean;
  disableSelection?: boolean;
  disableInteraction?: boolean;
  handleProps?: Record<string, unknown>;
  wrapperRef?(node: HTMLLIElement): void;
  onCollapse?(): void;
  onRemove?(): void;
  onClick?(): void;
  /** SFTP path if linked to remote server. */
  sftpPath?: string | null;
  /** Artwork file ID for thumbnail display. */
  artworkId?: string | null;
  /** Whether to show artwork thumbnail. Defaults to true. */
  showArtwork?: boolean;
  /** Whether to show the drag handle. Defaults to true. */
  showDragHandle?: boolean;
}

export const TreeItem = forwardRef<HTMLDivElement, TreeItemProps>(
  function TreeItem(
    {
      id,
      value,
      depth,
      indentationWidth,
      collapsed,
      clone,
      childCount,
      indicator,
      ghost,
      disableSelection,
      disableInteraction,
      handleProps,
      wrapperRef,
      onCollapse,
      onRemove,
      onClick,
      style,
      className,
      artworkId,
      showArtwork = true,
      showDragHandle = true,
      ...props
    },
    ref
  ) {
    const hasChildren = Boolean(onCollapse);
    const shouldShowArtwork = showArtwork && artworkId;

    return (
      <li
        ref={wrapperRef}
        data-id={String(id)}
        className={cn(
          "list-none",
          clone && "pointer-events-none inline-block pt-1",
          ghost && !clone && "opacity-40",
          disableSelection && "select-none",
          disableInteraction && "pointer-events-none",
          className
        )}
        style={{
          paddingLeft: clone ? 10 : `${depth * indentationWidth}px`,
          ...style,
        }}
        {...props}
      >
        <div
          ref={ref}
          onClick={onClick}
          className={cn(
            "group bg-card relative flex items-center gap-1.5 rounded-lg border px-2 py-1.5",
            "transition-all duration-200 ease-out",
            "hover:bg-accent/50 hover:border-accent-foreground/20",
            "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
            clone && [
              "ring-primary/50 shadow-xl ring-2 shadow-black/20",
              "bg-card/95 backdrop-blur-sm",
              "scale-[1.02]",
            ],
            ghost &&
              indicator && [
                "border-primary bg-primary/20 h-1.5 px-0 py-0",
                "before:absolute before:top-1/2 before:-left-1.5 before:-translate-y-1/2",
                "before:border-primary before:bg-background before:size-2.5 before:rounded-full before:border-2",
              ],
            onClick && "cursor-pointer"
          )}
        >
          {/* Drag Handle */}
          {!ghost && showDragHandle && (
            <button
              type="button"
              aria-label="Drag handle"
              className={cn(
                "flex-shrink-0 touch-none rounded p-0.5",
                "text-muted-foreground/50 transition-colors duration-150",
                "hover:text-muted-foreground hover:bg-muted/50",
                "focus-visible:ring-ring focus-visible:ring-1 focus-visible:outline-none",
                "cursor-grab active:cursor-grabbing"
              )}
              {...handleProps}
            >
              <GripVertical className="size-3.5" strokeWidth={2.5} />
            </button>
          )}

          {/* Collapse Toggle */}
          {!ghost && onCollapse && (
            <button
              type="button"
              aria-label={collapsed ? "Expand folder" : "Collapse folder"}
              onClick={(e) => {
                e.stopPropagation();
                onCollapse();
              }}
              className={cn(
                "flex-shrink-0 rounded p-0.5",
                "text-muted-foreground transition-all duration-200",
                "hover:text-foreground hover:bg-muted/50",
                "focus-visible:ring-ring focus-visible:ring-1 focus-visible:outline-none"
              )}
            >
              <ChevronRight
                className={cn(
                  "size-3.5 transition-transform duration-200 ease-out",
                  !collapsed && "rotate-90"
                )}
                strokeWidth={2.5}
              />
            </button>
          )}

          {/* Item Icon - Show artwork thumbnail or folder icon */}
          {!ghost && (
            <span className="flex-shrink-0">
              {shouldShowArtwork ? (
                <div className="size-5 overflow-hidden rounded">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/stream/${artworkId}`}
                    alt=""
                    className="size-full object-cover"
                  />
                </div>
              ) : hasChildren && !collapsed ? (
                <FolderOpen
                  className="text-muted-foreground/70 size-4"
                  strokeWidth={1.75}
                />
              ) : (
                <Folder
                  className="text-muted-foreground/70 size-4"
                  strokeWidth={1.75}
                />
              )}
            </span>
          )}

          {/* Item Name */}
          {!ghost && (
            <span
              className={cn(
                "flex-1 truncate text-sm font-medium",
                "text-foreground/90 group-hover:text-foreground",
                "transition-colors duration-150"
              )}
            >
              {value}
            </span>
          )}

          {/* Child Count Badge (for clone/drag overlay) */}
          {clone && childCount && childCount > 1 && (
            <span
              className={cn(
                "absolute -top-2 -right-2 z-10",
                "flex items-center justify-center",
                "size-5 rounded-full",
                "bg-primary text-primary-foreground",
                "text-xs font-semibold",
                "shadow-primary/30 shadow-md",
                "ring-background ring-2"
              )}
            >
              {childCount}
            </span>
          )}

          {/* Remove Button */}
          {!ghost && onRemove && !clone && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              className={cn(
                "flex-shrink-0 rounded p-1",
                "text-muted-foreground/0 transition-all duration-150",
                "group-hover:text-muted-foreground hover:!text-destructive hover:bg-destructive/10",
                "focus-visible:ring-destructive focus-visible:ring-1 focus-visible:outline-none",
                "opacity-0 group-hover:opacity-100"
              )}
            >
              <Trash2 className="size-3.5" strokeWidth={2} />
            </button>
          )}
        </div>
      </li>
    );
  }
);
```

**Step 4: Run test to verify it passes**

Run: `pnpm run test:unit -- tests/unit/components/tree-item.test.tsx`
Expected: PASS (4 tests)

**Step 5: Commit**

```bash
git add components/sortable-tree/components/TreeItem/TreeItem.tsx tests/unit/components/tree-item.test.tsx
git commit -m "feat(TreeItem): add showArtwork and showDragHandle props"
```

---

## Task 4: Update SortableGridItem to Pass showArtwork={false}

**Files:**

- Modify: `components/sortable-grid/SortableGridItem.tsx`

**Step 1: Modify SortableGridItem**

Update `components/sortable-grid/SortableGridItem.tsx` to pass `showArtwork={false}`:

```typescript
/**
 * Sortable wrapper for GridItem with dnd-kit integration.
 * Includes context menu for settings and delete actions.
 * Edit mode: simplified visuals (no artwork).
 */

"use client";

import React from "react";
import type { UniqueIdentifier } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { GridItem, GridItemProps } from "./GridItem";
import { ItemContextMenu } from "@/components/items/item-context-menu";

interface SortableGridItemProps extends Omit<GridItemProps, "handleProps"> {
  id: UniqueIdentifier;
  /** Opens the item settings dialog */
  onSettings?(): void;
  onDelete?(): Promise<void>;
  /** SFTP path if linked to remote server. */
  sftpPath?: string | null;
  /** Artwork file ID for thumbnail display. */
  artworkId?: string | null;
}

export function SortableGridItem({
  id,
  name,
  onSettings,
  onDelete,
  sftpPath,
  artworkId,
  ...props
}: SortableGridItemProps) {
  const {
    attributes,
    isDragging,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <ItemContextMenu
      itemName={name}
      showAddChild={false}
      onSettings={onSettings}
      onDelete={onDelete}
    >
      <GridItem
        ref={setNodeRef}
        id={id}
        name={name}
        style={style}
        isDragging={isDragging}
        handleProps={{
          ...attributes,
          ...listeners,
        }}
        sftpPath={sftpPath}
        artworkId={artworkId}
        showArtwork={false}
        {...props}
      />
    </ItemContextMenu>
  );
}
```

**Step 2: Run type check**

Run: `pnpm run type-check`
Expected: No errors

**Step 3: Commit**

```bash
git add components/sortable-grid/SortableGridItem.tsx
git commit -m "feat(SortableGridItem): hide artwork in edit mode"
```

---

## Task 5: Update SortableTreeItem to Pass showArtwork={false}

**Files:**

- Modify: `components/sortable-tree/components/TreeItem/SortableTreeItem.tsx`

**Step 1: Modify SortableTreeItem**

Update `components/sortable-tree/components/TreeItem/SortableTreeItem.tsx`:

```typescript
/**
 * Sortable wrapper for TreeItem with dnd-kit integration.
 * Includes context menu for settings, delete, and add child actions.
 * Edit mode: simplified visuals (no artwork), drag handle always visible.
 */

"use client";

import React from "react";
import type { UniqueIdentifier } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { AnimateLayoutChanges } from "@dnd-kit/sortable";

import { TreeItem, TreeItemProps } from "./TreeItem";
import { ItemContextMenu } from "@/components/items/item-context-menu";

interface SortableTreeItemProps extends Omit<TreeItemProps, "handleProps"> {
  id: UniqueIdentifier;
  /** Opens the item settings dialog */
  onSettings?(): void;
  onDelete?(): Promise<void>;
  onAddChild?(name: string): Promise<string | undefined>;
  /** SFTP path if linked to remote server. */
  sftpPath?: string | null;
  /** Artwork file ID for thumbnail display. */
  artworkId?: string | null;
}

const animateLayoutChanges: AnimateLayoutChanges = ({
  isSorting,
  wasDragging,
}) => (isSorting || wasDragging ? false : true);

export function SortableTreeItem({
  id,
  value,
  onSettings,
  onDelete,
  onAddChild,
  sftpPath,
  artworkId,
  ...props
}: SortableTreeItemProps) {
  const {
    attributes,
    isDragging,
    isSorting,
    listeners,
    setDraggableNodeRef,
    setDroppableNodeRef,
    transform,
    transition,
  } = useSortable({
    id,
    animateLayoutChanges,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  return (
    <ItemContextMenu
      itemName={value}
      onSettings={onSettings}
      onDelete={onDelete}
      onAddChild={onAddChild}
    >
      <TreeItem
        ref={setDraggableNodeRef}
        wrapperRef={setDroppableNodeRef}
        id={id}
        value={value}
        style={style}
        ghost={isDragging}
        disableSelection={isSorting}
        disableInteraction={isSorting}
        handleProps={{
          ...attributes,
          ...listeners,
        }}
        sftpPath={sftpPath}
        artworkId={artworkId}
        showArtwork={false}
        showDragHandle={true}
        {...props}
      />
    </ItemContextMenu>
  );
}
```

**Step 2: Run type check**

Run: `pnpm run type-check`
Expected: No errors

**Step 3: Commit**

```bash
git add components/sortable-tree/components/TreeItem/SortableTreeItem.tsx
git commit -m "feat(SortableTreeItem): hide artwork in edit mode"
```

---

## Task 6: Create View-Only Grid Component (frontend-design skill)

**Files:**

- Create: `components/sortable-grid/Grid.tsx`
- Create: `tests/unit/components/grid.test.tsx`
- Modify: `components/sortable-grid/index.ts`

**Step 1: Write the failing test**

Create `tests/unit/components/grid.test.tsx`:

```typescript
/**
 * Unit tests for Grid component (view-only mode).
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Grid } from "@/components/sortable-grid/Grid";
import type { ItemWithArtwork } from "@/lib/types";

const mockItems: ItemWithArtwork[] = [
  {
    id: "1",
    name: "Item 1",
    parentId: null,
    order: 0,
    depth: 0,
    userId: "user-1",
    createdAt: new Date(),
    updatedAt: new Date(),
    sftpPath: null,
    sftpModifiedAt: null,
    connectionId: null,
    artworkId: "artwork-1",
  },
  {
    id: "2",
    name: "Item 2",
    parentId: null,
    order: 1,
    depth: 0,
    userId: "user-1",
    createdAt: new Date(),
    updatedAt: new Date(),
    sftpPath: "/remote/path",
    sftpModifiedAt: null,
    connectionId: "conn-1",
    artworkId: null,
  },
];

describe("Grid", () => {
  it("should render all items", () => {
    render(<Grid items={mockItems} />);

    expect(screen.getByText("Item 1")).toBeInTheDocument();
    expect(screen.getByText("Item 2")).toBeInTheDocument();
  });

  it("should call onItemClick when item is clicked", () => {
    const onItemClick = vi.fn();
    render(<Grid items={mockItems} onItemClick={onItemClick} />);

    fireEvent.click(screen.getByText("Item 1"));
    expect(onItemClick).toHaveBeenCalledWith("1");
  });

  it("should render artwork for items with artworkId", () => {
    render(<Grid items={mockItems} />);

    const images = screen.getAllByRole("img");
    expect(images).toHaveLength(1);
    expect(images[0]).toHaveAttribute("src", "/api/stream/artwork-1");
  });

  it("should render sync badge for SFTP-linked items", () => {
    render(<Grid items={mockItems} />);

    // Item 2 has sftpPath, should show sync indicator
    // (Verify via visual inspection or specific test attribute)
    expect(screen.getByText("Item 2")).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit -- tests/unit/components/grid.test.tsx`
Expected: FAIL with "Cannot find module '@/components/sortable-grid/Grid'"

**Step 3: Create Grid component**

Create `components/sortable-grid/Grid.tsx`:

```typescript
/**
 * View-only grid container for items display.
 * Renders items with full visual richness (artwork, sync badges).
 * No drag-and-drop functionality - use SortableGrid for edit mode.
 */

"use client";

import React from "react";

import { GridItem } from "./GridItem";
import { ItemContextMenu } from "@/components/items/item-context-menu";
import type { ItemWithArtwork } from "@/lib/types";

interface GridProps {
  /** Items to display in the grid. */
  items: ItemWithArtwork[];
  /** Callback when an item is clicked. */
  onItemClick?(id: string): void;
  /** Callback to open settings dialog for an item. */
  onOpenSettings?(id: string): void;
  /** Callback to delete an item. */
  onDeleteItem?(id: string): Promise<void>;
}

/**
 * View-only grid component for browsing items.
 * Shows artwork thumbnails and sync badges.
 * For reordering, use SortableGrid in edit mode.
 *
 * @param props - Grid properties
 */
export function Grid({
  items,
  onItemClick,
  onOpenSettings,
  onDeleteItem,
}: GridProps) {
  return (
    <div
      data-testid="items-grid-view"
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
    >
      {items.map((item) => (
        <ItemContextMenu
          key={item.id}
          itemName={item.name}
          showAddChild={false}
          onSettings={onOpenSettings ? () => onOpenSettings(item.id) : undefined}
          onDelete={onDeleteItem ? () => onDeleteItem(item.id) : undefined}
        >
          <GridItem
            id={item.id}
            name={item.name}
            onClick={() => onItemClick?.(item.id)}
            sftpPath={item.sftpPath}
            artworkId={item.artworkId}
            showArtwork={true}
          />
        </ItemContextMenu>
      ))}
    </div>
  );
}
```

**Step 4: Update index.ts**

Update `components/sortable-grid/index.ts`:

```typescript
export { Grid } from "./Grid";
export { GridItem } from "./GridItem";
export { SortableGrid } from "./SortableGrid";
export { SortableGridItem } from "./SortableGridItem";
```

**Step 5: Run test to verify it passes**

Run: `pnpm run test:unit -- tests/unit/components/grid.test.tsx`
Expected: PASS (4 tests)

**Step 6: Commit**

```bash
git add components/sortable-grid/Grid.tsx components/sortable-grid/index.ts tests/unit/components/grid.test.tsx
git commit -m "feat(Grid): add view-only grid component with artwork"
```

---

## Task 7: Create View-Only Tree Component (frontend-design skill)

**Files:**

- Create: `components/sortable-tree/Tree.tsx`
- Create: `tests/unit/components/tree.test.tsx`
- Modify: `components/sortable-tree/index.ts`

**Step 1: Write the failing test**

Create `tests/unit/components/tree.test.tsx`:

```typescript
/**
 * Unit tests for Tree component (view-only mode).
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Tree } from "@/components/sortable-tree/Tree";
import type { TreeItems } from "@/lib/types";

const mockItems: TreeItems = [
  {
    id: "1",
    name: "Parent",
    order: 0,
    depth: 0,
    parentId: null,
    sftpPath: null,
    artworkId: "artwork-1",
    children: [
      {
        id: "1-1",
        name: "Child",
        order: 0,
        depth: 1,
        parentId: "1",
        sftpPath: null,
        artworkId: null,
        children: [],
      },
    ],
  },
];

describe("Tree", () => {
  it("should render all items", () => {
    render(<Tree items={mockItems} />);

    expect(screen.getByText("Parent")).toBeInTheDocument();
    expect(screen.getByText("Child")).toBeInTheDocument();
  });

  it("should call onItemClick when item is clicked", () => {
    const onItemClick = vi.fn();
    render(<Tree items={mockItems} onItemClick={onItemClick} />);

    fireEvent.click(screen.getByText("Parent"));
    expect(onItemClick).toHaveBeenCalledWith("1");
  });

  it("should render artwork for items with artworkId", () => {
    render(<Tree items={mockItems} />);

    const images = screen.getAllByRole("img");
    expect(images).toHaveLength(1);
  });

  it("should hide drag handles in view mode", () => {
    render(<Tree items={mockItems} />);

    // Should not have grip vertical icons
    const dragHandles = screen.queryAllByLabelText("Drag handle");
    expect(dragHandles).toHaveLength(0);
  });

  it("should support collapse/expand", () => {
    render(<Tree items={mockItems} />);

    // Both parent and child visible initially
    expect(screen.getByText("Child")).toBeInTheDocument();

    // Click collapse button (has aria-label "Collapse folder")
    const collapseButton = screen.getByRole("button", {
      name: "Collapse folder",
    });
    fireEvent.click(collapseButton);

    // Child should be hidden
    expect(screen.queryByText("Child")).not.toBeInTheDocument();

    // Click expand button
    const expandButton = screen.getByRole("button", { name: "Expand folder" });
    fireEvent.click(expandButton);

    // Child should be visible again
    expect(screen.getByText("Child")).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit -- tests/unit/components/tree.test.tsx`
Expected: FAIL with "Cannot find module '@/components/sortable-tree/Tree'"

**Step 3: Create Tree component**

Create `components/sortable-tree/Tree.tsx`:

```typescript
/**
 * View-only tree container for hierarchical items display.
 * Renders items with full visual richness (artwork, sync badges).
 * No drag-and-drop functionality - use SortableTree for edit mode.
 */

"use client";

import React, { useMemo } from "react";

import { TreeItem } from "./components/TreeItem/TreeItem";
import { ItemContextMenu } from "@/components/items/item-context-menu";
import { useTreeCollapse } from "@/hooks/use-tree-collapse";
import { flattenTree, removeChildrenOf } from "./utilities";
import type { TreeItems, FlattenedItem } from "@/lib/types";
import type { UniqueIdentifier } from "@dnd-kit/core";

interface TreeProps {
  /** Tree items to display. */
  items: TreeItems;
  /** Callback when an item is clicked. */
  onItemClick?(id: string): void;
  /** Callback to open settings dialog for an item. */
  onOpenSettings?(id: string): void;
  /** Callback to delete an item. */
  onDeleteItem?(id: string): Promise<void>;
  /** Callback to add a child item. */
  onAddChild?(parentId: string, name: string): Promise<string | undefined>;
  /** Indentation width per depth level. Defaults to 20. */
  indentationWidth?: number;
}

/**
 * View-only tree component for browsing hierarchical items.
 * Shows artwork thumbnails, sync badges, and collapse/expand.
 * No drag handles - for reordering, use SortableTree in edit mode.
 *
 * @param props - Tree properties
 */
export function Tree({
  items,
  onItemClick,
  onOpenSettings,
  onDeleteItem,
  onAddChild,
  indentationWidth = 20,
}: TreeProps) {
  const { isCollapsed, toggleCollapse } = useTreeCollapse(items);

  // Flatten tree and remove children of collapsed items
  const flattenedItems = useMemo(() => {
    const flattened = flattenTree(items);
    const collapsedIds = flattened.reduce<UniqueIdentifier[]>(
      (acc, { children, id }) =>
        isCollapsed(id) && children.length ? [...acc, id] : acc,
      []
    );
    return removeChildrenOf(flattened, collapsedIds);
  }, [items, isCollapsed]);

  return (
    <ul data-testid="items-tree-view" className="space-y-0.5">
      {flattenedItems.map(
        ({ id, name, children, depth, sftpPath, artworkId }) => (
          <ItemContextMenu
            key={id}
            itemName={name}
            onSettings={
              onOpenSettings ? () => onOpenSettings(String(id)) : undefined
            }
            onDelete={
              onDeleteItem ? () => onDeleteItem(String(id)) : undefined
            }
            onAddChild={
              onAddChild
                ? (childName) => onAddChild(String(id), childName)
                : undefined
            }
          >
            <TreeItem
              id={id}
              value={name}
              depth={depth}
              indentationWidth={indentationWidth}
              collapsed={isCollapsed(id)}
              onCollapse={
                children.length > 0 ? () => toggleCollapse(id) : undefined
              }
              onClick={() => onItemClick?.(String(id))}
              sftpPath={sftpPath}
              artworkId={artworkId}
              showArtwork={true}
              showDragHandle={false}
            />
          </ItemContextMenu>
        )
      )}
    </ul>
  );
}
```

**Step 4: Update index.ts**

Update `components/sortable-tree/index.ts`:

```typescript
export { Tree } from "./Tree";
export { SortableTree } from "./SortableTree";
```

**Step 5: Run test to verify it passes**

Run: `pnpm run test:unit -- tests/unit/components/tree.test.tsx`
Expected: PASS (5 tests)

**Step 6: Commit**

```bash
git add components/sortable-tree/Tree.tsx components/sortable-tree/index.ts tests/unit/components/tree.test.tsx
git commit -m "feat(Tree): add view-only tree component with artwork"
```

---

## Task 8: Create EditModeToggle Component (frontend-design skill)

**Files:**

- Create: `components/items/edit-mode-toggle.tsx`
- Create: `tests/unit/components/edit-mode-toggle.test.tsx`

**Step 1: Write the failing test**

Create `tests/unit/components/edit-mode-toggle.test.tsx`:

```typescript
/**
 * Unit tests for EditModeToggle component.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EditModeToggle } from "@/components/items/edit-mode-toggle";

describe("EditModeToggle", () => {
  it("should show 'Edit' when not editing", () => {
    render(<EditModeToggle isEditing={false} onToggle={() => {}} />);

    expect(screen.getByRole("button")).toHaveTextContent("Edit");
  });

  it("should show 'Done' when editing", () => {
    render(<EditModeToggle isEditing={true} onToggle={() => {}} />);

    expect(screen.getByRole("button")).toHaveTextContent("Done");
  });

  it("should call onToggle when clicked", () => {
    const onToggle = vi.fn();
    render(<EditModeToggle isEditing={false} onToggle={onToggle} />);

    fireEvent.click(screen.getByRole("button"));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("should have correct aria-label", () => {
    const { rerender } = render(
      <EditModeToggle isEditing={false} onToggle={() => {}} />
    );

    expect(screen.getByRole("button")).toHaveAttribute(
      "aria-label",
      "Edit items"
    );

    rerender(<EditModeToggle isEditing={true} onToggle={() => {}} />);

    expect(screen.getByRole("button")).toHaveAttribute(
      "aria-label",
      "Done editing"
    );
  });

  it("should be hidden when disabled", () => {
    render(
      <EditModeToggle isEditing={false} onToggle={() => {}} disabled={true} />
    );

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit -- tests/unit/components/edit-mode-toggle.test.tsx`
Expected: FAIL with "Cannot find module"

**Step 3: Create EditModeToggle component**

Create `components/items/edit-mode-toggle.tsx`:

```typescript
/**
 * Toggle button for switching between view and edit modes.
 * In edit mode, items can be reordered via drag-and-drop.
 */

"use client";

import React from "react";
import { Pencil, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EditModeToggleProps {
  /** Whether edit mode is currently active. */
  isEditing: boolean;
  /** Callback to toggle edit mode. */
  onToggle(): void;
  /** If true, the toggle is hidden (e.g., when no items). */
  disabled?: boolean;
}

/**
 * Button to toggle between view and edit modes.
 * Shows "Edit" in view mode, "Done" in edit mode.
 *
 * @param props - Toggle properties
 */
export function EditModeToggle({
  isEditing,
  onToggle,
  disabled = false,
}: EditModeToggleProps) {
  if (disabled) {
    return null;
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onToggle}
      aria-label={isEditing ? "Done editing" : "Edit items"}
      className="gap-1.5"
    >
      {isEditing ? (
        <>
          <Check className="size-4" />
          Done
        </>
      ) : (
        <>
          <Pencil className="size-4" />
          Edit
        </>
      )}
    </Button>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm run test:unit -- tests/unit/components/edit-mode-toggle.test.tsx`
Expected: PASS (5 tests)

**Step 5: Commit**

```bash
git add components/items/edit-mode-toggle.tsx tests/unit/components/edit-mode-toggle.test.tsx
git commit -m "feat(EditModeToggle): add edit/done toggle button"
```

---

## Task 9: Integrate Edit Mode into ItemsView

**Files:**

- Modify: `components/items/items-view.tsx`
- Modify: `components/items/index.ts`

**Step 1: Add imports for new components**

Add these imports at the top of `components/items/items-view.tsx`:

```typescript
import { SortableTree, Tree } from "@/components/sortable-tree";
import { SortableGrid, Grid } from "@/components/sortable-grid";
import { ViewToggle, useStoredViewMode } from "./view-toggle";
import { AddItemButton } from "./add-item-button";
import { EditModeToggle } from "./edit-mode-toggle";
```

**Step 2: Add isEditing state**

After the `viewMode` state, add:

```typescript
// Edit mode state - when true, shows DnD-enabled components
const [isEditing, setIsEditing] = useState(false);

// Exit edit mode when switching view modes
const [viewMode] = useStoredViewMode();
```

**Step 3: Add effect to exit edit mode on view change**

Add this effect after the state declarations:

```typescript
// Exit edit mode when view mode changes
useEffect(() => {
  setIsEditing(false);
}, [viewMode]);
```

**Step 4: Update the controls section**

Replace the controls `<div>` (around line 398-411) with:

```typescript
{/* Controls - hide add button when showing empty state */}
<div className="flex items-center gap-3">
  {/* SFTP Sync button - only show when connected */}
  {connectionId && (
    <SyncButton
      connectionId={connectionId}
      size="sm"
      onSyncComplete={async () => {
        await refetchItems();
      }}
    />
  )}
  {items.length > 0 && <AddItemButton onAdd={handleCreateItem} />}
  {items.length > 0 && (
    <EditModeToggle
      isEditing={isEditing}
      onToggle={() => setIsEditing((prev) => !prev)}
    />
  )}
  <ViewToggle />
</div>
```

**Step 5: Update the items display section**

Replace the items display `<div>` (around line 415-436) with:

```typescript
{/* Items display */}
<div className="min-h-[200px]">
  {items.length === 0 ? (
    <EmptyState onAdd={handleCreateItem} />
  ) : viewMode === "grid" ? (
    isEditing ? (
      <SortableGrid
        items={currentLevelItems}
        onItemsChange={handleGridItemsChange}
        onItemClick={handleItemClick}
        onOpenSettings={handleOpenSettings}
        onDeleteItem={handleDeleteItem}
      />
    ) : (
      <Grid
        items={currentLevelItems}
        onItemClick={handleItemClick}
        onOpenSettings={handleOpenSettings}
        onDeleteItem={handleDeleteItem}
      />
    )
  ) : isEditing ? (
    <SortableTree
      items={treeItems}
      onItemsChange={handleTreeItemsChange}
      onItemClick={handleItemClick}
      onOpenSettings={handleOpenSettings}
      onDeleteItem={handleDeleteItem}
      onAddChild={handleAddChild}
    />
  ) : (
    <Tree
      items={treeItems}
      onItemClick={handleItemClick}
      onOpenSettings={handleOpenSettings}
      onDeleteItem={handleDeleteItem}
      onAddChild={handleAddChild}
    />
  )}
</div>
```

**Step 6: Add useEffect import**

Ensure `useEffect` is imported:

```typescript
import { useState, useCallback, useTransition, useEffect } from "react";
```

**Step 7: Update index.ts**

Update `components/items/index.ts`:

```typescript
export { AddItemButton } from "./add-item-button";
export { EditModeToggle } from "./edit-mode-toggle";
export { ItemContextMenu } from "./item-context-menu";
export { ItemSettingsDialog } from "./item-settings-dialog";
export { ItemsView } from "./items-view";
export { ViewToggle, useStoredViewMode } from "./view-toggle";
```

**Step 8: Run type check**

Run: `pnpm run type-check`
Expected: No errors

**Step 9: Commit**

```bash
git add components/items/items-view.tsx components/items/index.ts
git commit -m "feat(ItemsView): integrate edit mode toggle with view/sortable components"
```

---

## Task 10: Update E2E Tests for Edit Mode

**Files:**

- Modify: `e2e/journeys/items/items-grid-drag.spec.ts`
- Modify: `e2e/journeys/items/items-tree-drag.spec.ts`
- Create: `e2e/journeys/items/edit-mode.spec.ts`
- Modify: `e2e/pages/items.page.ts`

**Step 1: Update ItemsPage page object**

Add edit mode methods to `e2e/pages/items.page.ts`:

```typescript
// Add to ItemsPage class:

/** Click the Edit button to enter edit mode */
async enterEditMode() {
  await this.page.getByRole("button", { name: "Edit items" }).click();
}

/** Click the Done button to exit edit mode */
async exitEditMode() {
  await this.page.getByRole("button", { name: "Done editing" }).click();
}

/** Check if currently in edit mode */
async isInEditMode(): Promise<boolean> {
  return this.page.getByRole("button", { name: "Done editing" }).isVisible();
}
```

**Step 2: Update drag tests to enter edit mode first**

Update `e2e/journeys/items/items-grid-drag.spec.ts` and `items-tree-drag.spec.ts` to call `enterEditMode()` before drag operations.

**Step 3: Create edit-mode.spec.ts**

Create `e2e/journeys/items/edit-mode.spec.ts`:

```typescript
/**
 * E2E tests for edit mode toggle functionality.
 */

import { test, expect } from "@/e2e/fixtures";

test.describe("Edit Mode", () => {
  test.beforeEach(async ({ itemsPage }) => {
    // Create test items
    await itemsPage.createItem("Test Folder 1");
    await itemsPage.createItem("Test Folder 2");
  });

  test("should toggle between view and edit mode", async ({ itemsPage }) => {
    // Start in view mode
    await expect(
      itemsPage.page.getByRole("button", { name: "Edit items" })
    ).toBeVisible();

    // Enter edit mode
    await itemsPage.enterEditMode();

    // Should show Done button
    await expect(
      itemsPage.page.getByRole("button", { name: "Done editing" })
    ).toBeVisible();

    // Exit edit mode
    await itemsPage.exitEditMode();

    // Should show Edit button again
    await expect(
      itemsPage.page.getByRole("button", { name: "Edit items" })
    ).toBeVisible();
  });

  test("should show artwork in view mode only", async ({ itemsPage }) => {
    // In view mode, artwork should be visible (if item has artwork)
    // This test uses items without artwork, so folder icons should show

    // Enter edit mode - still folder icons, no change
    await itemsPage.enterEditMode();

    // Exit - back to view mode
    await itemsPage.exitEditMode();
  });

  test("should exit edit mode when switching view modes", async ({
    itemsPage,
  }) => {
    // Enter edit mode
    await itemsPage.enterEditMode();
    expect(await itemsPage.isInEditMode()).toBe(true);

    // Switch to tree view
    await itemsPage.switchToTreeView();

    // Should exit edit mode
    expect(await itemsPage.isInEditMode()).toBe(false);
  });

  test("should hide edit toggle when no items", async ({ itemsPage, page }) => {
    // Delete all items
    await itemsPage.deleteItem("Test Folder 1");
    await itemsPage.deleteItem("Test Folder 2");

    // Edit button should not be visible
    await expect(
      page.getByRole("button", { name: "Edit items" })
    ).not.toBeVisible();
  });
});
```

**Step 4: Run E2E tests**

Run: `pnpm run test:e2e -- e2e/journeys/items/edit-mode.spec.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add e2e/journeys/items/*.spec.ts e2e/pages/items.page.ts
git commit -m "test(e2e): add edit mode tests and update drag tests"
```

---

## Task 11: Final Validation and Cleanup

**Step 1: Run all checks**

```bash
pnpm run check
```

Expected: All checks pass (format, lint, type-check, knip, build)

**Step 2: Run all unit tests**

```bash
pnpm run test:unit
```

Expected: All tests pass

**Step 3: Run all E2E tests**

```bash
pnpm run test:e2e
```

Expected: All tests pass

**Step 4: Final commit**

```bash
git add -A
git commit -m "chore: edit mode performance optimization complete"
```

---

## Summary

This implementation plan covers:

1. **Task 1:** useTreeCollapse hook for shared collapse state
2. **Task 2:** showArtwork prop for GridItem
3. **Task 3:** showArtwork and showDragHandle props for TreeItem
4. **Task 4:** SortableGridItem passes showArtwork={false}
5. **Task 5:** SortableTreeItem passes showArtwork={false}
6. **Task 6:** View-only Grid component (frontend-design)
7. **Task 7:** View-only Tree component (frontend-design)
8. **Task 8:** EditModeToggle component (frontend-design)
9. **Task 9:** ItemsView integration
10. **Task 10:** E2E test updates
11. **Task 11:** Final validation

Total: 11 tasks, ~15-20 commits
