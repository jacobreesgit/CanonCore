/**
 * URL-based state hook for playlist detail pages.
 * Manages sort state via nuqs URL search params.
 */

"use client";

import { useQueryStates } from "nuqs";
import { useCallback } from "react";
import { playlistParsers } from "./playlist-search-params";
import type { SortOption } from "@/lib/types";

/**
 * Manages sort state for playlist detail pages via URL search params.
 *
 * @returns Sort state value and setter
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

  return {
    /** Current sort option (cast to SortOption for ContentToolbar compatibility). */
    sortBy: state.sort as SortOption,
    /** Update sort option. */
    setSortBy,
    /** Whether current sort allows drag-drop reordering. */
    isCustomSort: state.sort === "custom",
  };
}
