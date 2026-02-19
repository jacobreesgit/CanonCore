/**
 * Shared nuqs parser definitions for playlist URL query state.
 * Reuses existing SortOption values for compatibility with ContentToolbar.
 */

import { parseAsStringLiteral, parseAsArrayOf } from "nuqs/server";
import type { SortOptionConfig } from "@/lib/item-utils";
import { PLAYLIST_VIEW_MODES, PLAYLIST_CONTENT_FILTERS } from "@/lib/types";

/** Playlist sort options (subset of SortOption). */
const PLAYLIST_SORT_VALUES = ["custom", "updated-desc", "name-asc"] as const;

/** Playlist tab options. */
const PLAYLIST_TAB_VALUES = ["contents", "about"] as const;

/** Type-safe URL query parsers for playlist detail pages. */
export const playlistParsers = {
  sort: parseAsStringLiteral(PLAYLIST_SORT_VALUES).withDefault("custom"),
  view: parseAsStringLiteral(PLAYLIST_VIEW_MODES).withDefault("grid"),
  filter: parseAsArrayOf(
    parseAsStringLiteral(PLAYLIST_CONTENT_FILTERS)
  ).withDefault([]),
  tab: parseAsStringLiteral(PLAYLIST_TAB_VALUES),
};

/** Sort options for the playlist toolbar. */
export const PLAYLIST_SORT_OPTIONS: SortOptionConfig[] = [
  { value: "custom", label: "Custom Order" },
  { value: "updated-desc", label: "Date Added" },
  { value: "name-asc", label: "Name A-Z" },
];
