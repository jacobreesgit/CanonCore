/**
 * Hook for managing bulk item selection state.
 * Used for bulk operations like delete in edit mode.
 */

"use client";

import { useState, useCallback, useMemo } from "react";

interface SelectableItem {
  id: string;
}

interface UseBulkSelectionReturn<T extends SelectableItem> {
  /** Set of selected item IDs */
  selectedIds: Set<string>;
  /** Number of selected items */
  selectionCount: number;
  /** Whether all items are selected */
  isAllSelected: boolean;
  /** Whether some but not all items are selected */
  isPartiallySelected: boolean;
  /** Selected item objects */
  selectedItems: T[];
  /** Toggle selection for a single item */
  toggleItem: (id: string) => void;
  /** Check if an item is selected */
  isSelected: (id: string) => boolean;
  /** Select all items */
  selectAll: () => void;
  /** Deselect all items */
  deselectAll: () => void;
  /** Toggle between all selected and none selected */
  toggleAll: () => void;
}

/**
 * Manages bulk selection state for a list of items.
 * Selection automatically filters out IDs no longer in items.
 *
 * @param items - Array of items with id property
 * @returns Selection state and control functions
 *
 * @example
 * const { selectedIds, toggleItem, selectAll, deselectAll } = useBulkSelection(items);
 *
 * // Check if item is selected
 * const isChecked = isSelected(item.id);
 *
 * // Toggle item on checkbox click
 * <Checkbox checked={isChecked} onCheckedChange={() => toggleItem(item.id)} />
 */
export function useBulkSelection<T extends SelectableItem>(
  items: T[]
): UseBulkSelectionReturn<T> {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Create set of valid item IDs for efficient lookup
  const validIds = useMemo(
    () => new Set(items.map((item) => item.id)),
    [items]
  );

  // Filter selected IDs to only include valid ones (handles item removal)
  const validSelectedIds = useMemo(() => {
    const filtered = new Set<string>();
    for (const id of selectedIds) {
      if (validIds.has(id)) {
        filtered.add(id);
      }
    }
    return filtered;
  }, [selectedIds, validIds]);

  const toggleItem = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const isSelected = useCallback(
    (id: string) => validSelectedIds.has(id),
    [validSelectedIds]
  );

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(items.map((item) => item.id)));
  }, [items]);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const selectionCount = validSelectedIds.size;
  const isAllSelected = selectionCount === items.length && items.length > 0;
  const isPartiallySelected = selectionCount > 0 && !isAllSelected;

  const toggleAll = useCallback(() => {
    if (isAllSelected) {
      deselectAll();
    } else {
      selectAll();
    }
  }, [isAllSelected, selectAll, deselectAll]);

  const selectedItems = useMemo(
    () => items.filter((item) => validSelectedIds.has(item.id)),
    [items, validSelectedIds]
  );

  return {
    selectedIds: validSelectedIds,
    selectionCount,
    isAllSelected,
    isPartiallySelected,
    selectedItems,
    toggleItem,
    isSelected,
    selectAll,
    deselectAll,
    toggleAll,
  };
}
