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
