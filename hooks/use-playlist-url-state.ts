/**
 * URL-based state hook for playlist detail pages.
 * Manages sort, view mode, filter, and tab state via nuqs URL search params.
 */

"use client";

import { useQueryStates } from "nuqs";
import { useCallback } from "react";
import { playlistParsers } from "./playlist-search-params";
import type {
  SortOption,
  PlaylistViewMode,
  PlaylistContentFilter,
} from "@/lib/types";

/**
 * Manages URL state for playlist detail pages.
 * Provides sort, view mode, filter, and tab controls.
 *
 * @returns URL state values and setters
 */
export function usePlaylistUrlState() {
  const [state, setState] = useQueryStates(playlistParsers, {
    history: "replace",
    scroll: false,
  });

  const setSortBy = useCallback(
    (sort: SortOption) => setState({ sort: sort as typeof state.sort }),
    [setState] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const setViewMode = useCallback(
    (view: PlaylistViewMode) => setState({ view }),
    [setState]
  );

  const toggleFilter = useCallback(
    (filter: PlaylistContentFilter) => {
      const current = state.filter ?? [];
      const next = current.includes(filter)
        ? current.filter((f) => f !== filter)
        : [...current, filter];
      setState({ filter: next });
    },
    [state.filter, setState]
  );

  const clearFilters = useCallback(() => setState({ filter: [] }), [setState]);

  const setTab = useCallback(
    (tab: "contents" | "about") => setState({ tab }),
    [setState]
  );

  return {
    sortBy: state.sort as SortOption,
    setSortBy,
    viewMode: (state.view ?? "grid") as PlaylistViewMode,
    setViewMode,
    filters: (state.filter ?? []) as PlaylistContentFilter[],
    toggleFilter,
    clearFilters,
    hasActiveFilters: (state.filter ?? []).length > 0,
    tab: state.tab as "contents" | "about" | null,
    setTab,
    isCustomSort: state.sort === "custom",
  };
}
