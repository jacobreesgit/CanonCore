/**
 * Shared nuqs parser definitions for URL query state management.
 * Importable by both server and client code.
 * Defines type-safe parsers for items and explore page URL params.
 */

import {
  parseAsStringLiteral,
  parseAsArrayOf,
  parseAsBoolean,
} from "nuqs/server";

import {
  SORT_OPTIONS_TUPLE,
  EXPLORE_SORT_OPTIONS_TUPLE,
  VIEW_MODES,
  CONTENT_FILTERS,
} from "@/lib/types";

// --- Items page parsers ---

const TAB_OPTIONS = ["contents", "about", "items", "playlists"] as const;

/** Type-safe URL query parsers for items pages (library, item detail). */
export const itemsParsers = {
  sort: parseAsStringLiteral(SORT_OPTIONS_TUPLE).withDefault("custom"),
  filter: parseAsArrayOf(parseAsStringLiteral(CONTENT_FILTERS)).withDefault([]),
  view: parseAsStringLiteral(VIEW_MODES).withDefault("grid"),
  tab: parseAsStringLiteral(TAB_OPTIONS),
};

// --- Explore page parsers (different defaults, no "custom" sort) ---

/** Type-safe URL query parsers for explore page. */
export const exploreParsers = {
  sort: parseAsStringLiteral(EXPLORE_SORT_OPTIONS_TUPLE).withDefault(
    "updated-desc"
  ),
  excludeMine: parseAsBoolean.withDefault(false),
  autoplay: parseAsBoolean.withDefault(true),
  tab: parseAsStringLiteral(TAB_OPTIONS),
};
