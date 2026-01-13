/**
 * Hook for managing items sort and filter state with localStorage persistence.
 * Uses useSyncExternalStore for hydration-safe localStorage access.
 */

"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import type { SortOption, FilterOption } from "@/lib/types";
import { isValidSortOption, isValidFilterOption } from "@/lib/types";

/** Namespaced localStorage key for sort preference. */
const SORT_STORAGE_KEY = "canoncore-items-sort";

/** Namespaced localStorage key for filter preference. */
const FILTER_STORAGE_KEY = "canoncore-items-filter";

/** Default sort option. */
const DEFAULT_SORT: SortOption = "custom";

/** Default filter option. */
const DEFAULT_FILTER: FilterOption = "all";

interface UseItemsSortFilterReturn {
  /** Current sort option. */
  sortBy: SortOption;
  /** Current filter option. */
  filterBy: FilterOption;
  /** Update sort option. */
  setSortBy: (sort: SortOption) => void;
  /** Update filter option. */
  setFilterBy: (filter: FilterOption) => void;
  /** Whether current sort is custom (enables drag-drop). */
  isCustomSort: boolean;
  /** Whether a filter is active (not "all"). */
  hasActiveFilter: boolean;
  /** Reset to default sort and filter. */
  reset: () => void;
}

/**
 * Gets the sort option from localStorage, validating and returning default if invalid.
 */
function getSortSnapshot(): SortOption {
  const stored = localStorage.getItem(SORT_STORAGE_KEY);
  return stored && isValidSortOption(stored) ? stored : DEFAULT_SORT;
}

/**
 * Gets the filter option from localStorage, validating and returning default if invalid.
 */
function getFilterSnapshot(): FilterOption {
  const stored = localStorage.getItem(FILTER_STORAGE_KEY);
  return stored && isValidFilterOption(stored) ? stored : DEFAULT_FILTER;
}

/**
 * Server snapshot always returns defaults (SSR-safe).
 */
function getServerSortSnapshot(): SortOption {
  return DEFAULT_SORT;
}

/**
 * Server snapshot always returns defaults (SSR-safe).
 */
function getServerFilterSnapshot(): FilterOption {
  return DEFAULT_FILTER;
}

/**
 * Subscribe to storage events for cross-tab sync.
 */
function subscribeToStorage(callback: () => void): () => void {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

/**
 * Manages sort and filter state for items with localStorage persistence.
 * Uses useSyncExternalStore for hydration-safe localStorage access.
 *
 * @returns Sort/filter state and setters
 *
 * @example
 * const { sortBy, filterBy, setSortBy, setFilterBy, isCustomSort } = useItemsSortFilter();
 *
 * // Check if drag-drop should be disabled
 * const canReorder = isCustomSort;
 *
 * // Apply sort and filter to items
 * const displayItems = filterItems(sortItems(items, sortBy), filterBy);
 */
export function useItemsSortFilter(): UseItemsSortFilterReturn {
  // Use useSyncExternalStore for hydration-safe localStorage access
  const sortBy = useSyncExternalStore(
    subscribeToStorage,
    getSortSnapshot,
    getServerSortSnapshot
  );

  const filterBy = useSyncExternalStore(
    subscribeToStorage,
    getFilterSnapshot,
    getServerFilterSnapshot
  );

  const setSortBy = useCallback((sort: SortOption) => {
    localStorage.setItem(SORT_STORAGE_KEY, sort);
    // Trigger storage event for useSyncExternalStore to pick up
    window.dispatchEvent(
      new StorageEvent("storage", { key: SORT_STORAGE_KEY })
    );
  }, []);

  const setFilterBy = useCallback((filter: FilterOption) => {
    localStorage.setItem(FILTER_STORAGE_KEY, filter);
    // Trigger storage event for useSyncExternalStore to pick up
    window.dispatchEvent(
      new StorageEvent("storage", { key: FILTER_STORAGE_KEY })
    );
  }, []);

  const isCustomSort = useMemo(() => sortBy === "custom", [sortBy]);

  const hasActiveFilter = useMemo(() => filterBy !== "all", [filterBy]);

  const reset = useCallback(() => {
    setSortBy(DEFAULT_SORT);
    setFilterBy(DEFAULT_FILTER);
  }, [setSortBy, setFilterBy]);

  return {
    sortBy,
    filterBy,
    setSortBy,
    setFilterBy,
    isCustomSort,
    hasActiveFilter,
    reset,
  };
}
