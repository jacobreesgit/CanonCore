/**
 * URL-based state hook for the explore page.
 * Replaces useExploreSortFilter with nuqs-powered URL state.
 * Manages sort and exclude-mine toggle via URL search params.
 */

"use client";

import { useCallback } from "react";
import { useQueryStates } from "nuqs";

import { exploreParsers } from "./search-params";

/**
 * Manages sort and exclude-mine state via URL search params for the explore page.
 * Defaults to `updated-desc` sort. Excludes "custom" from valid sort options.
 *
 * @returns URL state values and setters
 */
export function useExploreUrlState() {
  const [state, setState] = useQueryStates(exploreParsers, {
    history: "replace",
    scroll: false,
  });

  const setSortBy = useCallback(
    (sort: typeof state.sort) => setState({ sort }),
    [setState] // eslint-disable-line react-hooks/exhaustive-deps -- `state` used for type inference only
  );

  const setExcludeMine = useCallback(
    (v: boolean) => setState({ excludeMine: v }),
    [setState]
  );

  return {
    /** Current sort option. */
    sortBy: state.sort,
    /** Update sort option. */
    setSortBy,
    /** Whether to exclude the current user's items. */
    excludeMine: state.excludeMine,
    /** Toggle the exclude-mine filter. */
    setExcludeMine,
  };
}
