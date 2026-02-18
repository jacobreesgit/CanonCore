/**
 * Shared nuqs parser definitions for playlist URL query state.
 * Reuses existing SortOption values for compatibility with ContentToolbar.
 */

import { parseAsStringLiteral } from "nuqs/server";
import type { SortOptionConfig } from "@/lib/item-utils";

/** Playlist sort options (subset of SortOption). */
const PLAYLIST_SORT_VALUES = ["custom", "updated-desc", "name-asc"] as const;

/** Type-safe URL query parsers for playlist detail pages. */
export const playlistParsers = {
  sort: parseAsStringLiteral(PLAYLIST_SORT_VALUES).withDefault("custom"),
};

/** Sort options for the playlist toolbar. */
export const PLAYLIST_SORT_OPTIONS: SortOptionConfig[] = [
  { value: "custom", label: "Custom Order" },
  { value: "updated-desc", label: "Date Added" },
  { value: "name-asc", label: "Name A-Z" },
];
