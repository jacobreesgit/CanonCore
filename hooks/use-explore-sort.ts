/**
 * Hook for managing explore page sort state with localStorage persistence.
 * Uses separate storage key from my-items to preserve different defaults.
 * Implements versioned storage (Rule 4.4) and read caching (Rule 7.5).
 */

"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { SortOption } from "@/lib/types";
import { isValidSortOption } from "@/lib/types";

/** Versioned storage key (Rule 4.4: Version localStorage data). */
const STORAGE_KEY = "canoncore-explore-sort:v1";

/** Default sort for explore pages. */
const DEFAULT_SORT: SortOption = "updated-desc";

/** Module-level cache to avoid repeated localStorage reads (Rule 7.5). */
const sortCache = new Map<string, SortOption>();

/**
 * Gets the sort option from localStorage with caching.
 * Returns cached value if available, otherwise reads from storage.
 */
function getSnapshot(): SortOption {
  // Return cached value if available
  if (sortCache.has(STORAGE_KEY)) {
    return sortCache.get(STORAGE_KEY)!;
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    // Only allow explore-valid sorts (no "custom")
    const value =
      stored && isValidSortOption(stored) && stored !== "custom"
        ? stored
        : DEFAULT_SORT;
    sortCache.set(STORAGE_KEY, value);
    return value;
  } catch {
    // localStorage unavailable (incognito, quota exceeded)
    return DEFAULT_SORT;
  }
}

/**
 * Server snapshot always returns defaults (SSR-safe).
 */
function getServerSnapshot(): SortOption {
  return DEFAULT_SORT;
}

/**
 * Subscribe to storage events for cross-tab sync.
 * Invalidates cache when storage changes.
 */
function subscribe(callback: () => void): () => void {
  const handler = (e: StorageEvent) => {
    // Invalidate cache when storage changes
    if (e.key === STORAGE_KEY || e.key === null) {
      sortCache.delete(STORAGE_KEY);
    }
    callback();
  };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}

interface UseExploreSortFilterReturn {
  /** Current sort option. */
  sortBy: SortOption;
  /** Update sort option (ignores "custom"). */
  setSortBy: (sort: SortOption) => void;
}

/**
 * Manages sort state for explore/public pages with localStorage persistence.
 * Defaults to "updated-desc" (Recently Updated).
 * Excludes "custom" sort option (not applicable to public pages).
 *
 * @returns Sort state and setter
 *
 * @example
 * const { sortBy, setSortBy } = useExploreSortFilter();
 * // Use with SortDropdown
 * <SortDropdown value={sortBy} onChange={setSortBy} options={EXPLORE_SORT_OPTIONS} />
 */
export function useExploreSortFilter(): UseExploreSortFilterReturn {
  const sortBy = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );

  const setSortBy = useCallback((sort: SortOption) => {
    if (sort === "custom") return; // Ignore custom sort for explore
    try {
      localStorage.setItem(STORAGE_KEY, sort);
      sortCache.set(STORAGE_KEY, sort); // Keep cache in sync
    } catch {
      // localStorage unavailable (incognito, quota exceeded)
    }
    window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
  }, []);

  return { sortBy, setSortBy };
}
