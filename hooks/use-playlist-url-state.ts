/**
 * URL-based state hook for playlist detail pages.
 * Manages sort and tab state via nuqs URL search params.
 */

"use client";

import { useQueryStates } from "nuqs";
import { useCallback } from "react";
import { playlistParsers } from "./playlist-search-params";
import type { SortOption } from "@/lib/types";

/**
 * Manages URL state for playlist detail pages.
 * Provides sort and tab controls.
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

  const setTab = useCallback(
    (tab: "contents" | "about") => setState({ tab }),
    [setState]
  );

  return {
    sortBy: state.sort as SortOption,
    setSortBy,
    tab: state.tab as "contents" | "about" | null,
    setTab,
    isCustomSort: state.sort === "custom",
  };
}
