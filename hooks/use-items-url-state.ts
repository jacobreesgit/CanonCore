/**
 * URL-based state hook for items pages (library, item detail).
 * Replaces useItemsSortFilter + useStoredViewMode with nuqs-powered URL state.
 * Includes localStorage backup, migration from old keys, and mutual exclusion.
 */

"use client";

import { useQueryStates } from "nuqs";
import { useEffect, useCallback } from "react";

import { CONTENT_FILTERS, type ContentFilter } from "@/lib/types";
import { toggleContentFilter } from "@/lib/item-utils";

import { itemsParsers } from "./search-params";

/** localStorage keys (versioned). */
const LS_SORT_KEY = "canoncore-items-sort:v1";
const LS_FILTER_KEY = "canoncore-items-filter:v2";
const LS_VIEW_KEY = "canoncore-items-view:v1";

/** Old localStorage keys for one-time migration. */
const OLD_SORT_KEY = "canoncore-items-sort";
const OLD_FILTER_KEY = "canoncore-items-filter";
const OLD_VIEW_KEY = "items-view-mode";

/**
 * Migrates localStorage from old unversioned keys to versioned keys.
 * Runs once on mount; safe to call multiple times.
 */
function migrateLocalStorage(): void {
  try {
    // Migrate filter: single string -> JSON array
    const oldFilter = localStorage.getItem(OLD_FILTER_KEY);
    if (oldFilter && oldFilter !== "all") {
      localStorage.setItem(LS_FILTER_KEY, JSON.stringify([oldFilter]));
    }
    localStorage.removeItem(OLD_FILTER_KEY);

    // Migrate sort: add version suffix
    const oldSort = localStorage.getItem(OLD_SORT_KEY);
    if (oldSort) {
      localStorage.setItem(LS_SORT_KEY, oldSort);
      localStorage.removeItem(OLD_SORT_KEY);
    }

    // Migrate view: rename + add version suffix
    const oldView = localStorage.getItem(OLD_VIEW_KEY);
    if (oldView) {
      localStorage.setItem(LS_VIEW_KEY, oldView);
      localStorage.removeItem(OLD_VIEW_KEY);
    }
  } catch {
    // localStorage unavailable (Safari incognito, quota exceeded)
  }
}

/**
 * Manages sort, filter, view mode, and tab state via URL search params.
 * Falls back to localStorage when URL has no params (direct navigation).
 * Writes to localStorage as backup on every state change.
 *
 * @returns URL state values and setters
 */
export function useItemsUrlState() {
  const [state, setState] = useQueryStates(itemsParsers, {
    history: "replace",
    scroll: false,
  });

  // One-time localStorage migration from old keys
  useEffect(() => {
    migrateLocalStorage();
  }, []);

  // Restore from localStorage if URL has no relevant params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has("sort") && !params.has("filter") && !params.has("view")) {
      try {
        const savedSort = localStorage.getItem(LS_SORT_KEY);
        const savedFilter = localStorage.getItem(LS_FILTER_KEY);
        const savedView = localStorage.getItem(LS_VIEW_KEY);
        const restoredState: Record<string, unknown> = {};
        if (savedSort) restoredState.sort = savedSort;
        if (savedFilter) {
          const parsed: unknown = JSON.parse(savedFilter);
          if (Array.isArray(parsed)) {
            const valid = parsed.filter((v): v is ContentFilter =>
              CONTENT_FILTERS.includes(v as ContentFilter)
            );
            if (valid.length > 0) restoredState.filter = valid;
          }
        }
        if (savedView) restoredState.view = savedView;
        if (Object.keys(restoredState).length > 0) setState(restoredState);
      } catch {
        // localStorage unavailable or invalid JSON
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // localStorage backup: write on every change
  // Use JSON.stringify for filter array to avoid re-fires on referential changes
  const filterSerialized = JSON.stringify(state.filter);
  useEffect(() => {
    try {
      localStorage.setItem(LS_SORT_KEY, state.sort);
      localStorage.setItem(LS_FILTER_KEY, filterSerialized);
      localStorage.setItem(LS_VIEW_KEY, state.view);
    } catch {
      // localStorage unavailable
    }
  }, [state.sort, filterSerialized, state.view]);

  // Toggle with mutual exclusion (functional update for stale closure safety)
  const toggleFilter = useCallback(
    (filter: ContentFilter) => {
      setState((prev) => ({
        ...prev,
        filter: toggleContentFilter(prev.filter, filter),
      }));
    },
    [setState]
  );

  const clearFilters = useCallback(() => {
    setState((prev) => ({ ...prev, filter: [] }));
  }, [setState]);

  const setSortBy = useCallback(
    (sort: typeof state.sort) => setState({ sort }),
    [setState] // eslint-disable-line react-hooks/exhaustive-deps -- `state` used for type inference only
  );

  const setViewMode = useCallback(
    (view: typeof state.view) => setState({ view }),
    [setState] // eslint-disable-line react-hooks/exhaustive-deps -- `state` used for type inference only
  );

  const setTab = useCallback(
    (tab: typeof state.tab) => setState({ tab }),
    [setState] // eslint-disable-line react-hooks/exhaustive-deps -- `state` used for type inference only
  );

  return {
    /** Current sort option. */
    sortBy: state.sort,
    /** Update sort option. */
    setSortBy,
    /** Active content filters. */
    filters: state.filter,
    /** Toggle a content filter on/off with mutual exclusion. */
    toggleFilter,
    /** Clear all active filters. */
    clearFilters,
    /** Whether any filters are active. */
    hasActiveFilters: state.filter.length > 0,
    /** Current view mode (grid/tree). */
    viewMode: state.view,
    /** Update view mode. */
    setViewMode,
    /** Current active tab (contents/about), null if not set. */
    tab: state.tab,
    /** Update active tab. */
    setTab,
    /** Whether current sort allows drag-drop reordering. */
    isCustomSort: state.sort === "custom",
  };
}
