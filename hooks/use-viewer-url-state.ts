/**
 * URL-based state hook for viewer profile pages.
 * Manages sort, content filters, and tab state via nuqs URL search params.
 * Separate from useExploreUrlState to avoid filter param leaking to /explore.
 */

"use client";

import { useCallback } from "react";
import { useQueryStates } from "nuqs";
import type { inferParserType } from "nuqs/server";

import { viewerParsers } from "./search-params";
import { toggleContentFilter } from "@/lib/item-utils";
import type { ContentFilter, SortOption } from "@/lib/types";

/**
 * Manages sort, filter, and tab state via URL search params for viewer profile pages.
 * Defaults to `updated-desc` sort. Filters are URL-backed for shareable filtered views.
 *
 * @returns URL state values and setters
 */
export function useViewerUrlState() {
  const [state, setState] = useQueryStates(viewerParsers, {
    history: "replace",
    scroll: false,
  });

  const setSortBy = useCallback(
    (sort: typeof state.sort) => setState({ sort }),
    [setState] // eslint-disable-line react-hooks/exhaustive-deps -- `state` used for type inference only
  );

  const toggleFilter = useCallback(
    (filter: ContentFilter) => {
      setState((prev) => ({
        ...prev,
        filter: toggleContentFilter(prev.filter ?? [], filter),
      }));
    },
    [setState]
  );

  const clearFilters = useCallback(() => setState({ filter: [] }), [setState]);

  const setTab = useCallback(
    (tab: inferParserType<typeof viewerParsers.tab>) => setState({ tab }),
    [setState]
  );

  return {
    /** Current sort option. */
    sortBy: state.sort as SortOption,
    /** Update sort option. */
    setSortBy,
    /** Current content filters. */
    filters: (state.filter ?? []) as ContentFilter[],
    /** Toggle a content filter on/off. */
    toggleFilter,
    /** Clear all content filters. */
    clearFilters,
    /** Current active tab (items/playlists), null if not set. */
    tab: state.tab,
    /** Update active tab. */
    setTab,
  };
}
