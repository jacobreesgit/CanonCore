/**
 * TMDB resolution utilities for mapping season/episode items to their parent show.
 * Used by server pages to resolve TMDB IDs before fetching extended details.
 *
 * Re-exports client-safe image URL helpers from tmdb-image-utils.ts so that
 * server code can import everything from a single module.
 */

import { cache } from "react";
import { prisma } from "@/lib/prisma";
import type { TmdbDisplayOptions } from "@/lib/types";

// Re-export client-safe image URL utilities
export { getTmdbPosterUrl, getTmdbBackdropUrl } from "@/lib/tmdb-image-utils";

/** Fields required by extractTmdbDisplayOptions. */
interface TmdbDisplayFields {
  tmdbShowTagline: boolean;
  tmdbShowMetadata: boolean;
  tmdbShowGenres: boolean;
  tmdbShowCast: boolean;
  tmdbShowProviders: boolean;
  tmdbShowVideos: boolean;
  tmdbShowRecommendations: boolean;
}

/**
 * Extracts TMDB display options from an item's database fields.
 *
 * @param item - Item with TMDB display boolean fields
 * @returns TmdbDisplayOptions object
 */
export function extractTmdbDisplayOptions(
  item: TmdbDisplayFields
): TmdbDisplayOptions {
  return {
    showTagline: item.tmdbShowTagline,
    showMetadata: item.tmdbShowMetadata,
    showGenres: item.tmdbShowGenres,
    showCast: item.tmdbShowCast,
    showProviders: item.tmdbShowProviders,
    showVideos: item.tmdbShowVideos,
    showRecommendations: item.tmdbShowRecommendations,
  };
}

/**
 * Resolved TMDB reference for an item.
 * Season/episode items resolve to their parent TV show.
 */
export interface ResolvedTmdb {
  tmdbId: number;
  tmdbType: "movie" | "tv";
}

/**
 * Resolves an item's TMDB reference, walking up ancestors for season/episode types.
 * Movies and TV shows return directly. Seasons and episodes walk up the item tree
 * to find the parent show's TMDB ID.
 *
 * Cached per-request via React.cache().
 *
 * @param itemId - Item ID (used for ancestor walk on season/episode types)
 * @param tmdbId - Item's TMDB ID (nullable)
 * @param tmdbType - Item's TMDB type (nullable)
 * @returns Resolved TMDB reference or null if no TMDB data
 */
export const resolveTmdbForItem = cache(
  async (
    itemId: string,
    tmdbId: number | null,
    tmdbType: string | null
  ): Promise<ResolvedTmdb | null> => {
    if (!tmdbId || !tmdbType) return null;

    if (tmdbType === "movie") {
      return { tmdbId, tmdbType: "movie" };
    }

    if (tmdbType === "tv") {
      return { tmdbId, tmdbType: "tv" };
    }

    // Season/episode: walk up ancestors to find parent show with tmdbType "tv"
    // Depth guard (max 11) prevents infinite recursion if circular parent refs exist
    const ancestors = await prisma.$queryRaw<
      Array<{ tmdbId: number | null; tmdbType: string | null }>
    >`
      WITH RECURSIVE anc AS (
        SELECT "parentId", "tmdbId", "tmdbType", 0 AS depth
        FROM "Item" WHERE id = ${itemId}
        UNION ALL
        SELECT i."parentId", i."tmdbId", i."tmdbType", a.depth + 1
        FROM "Item" i INNER JOIN anc a ON i.id = a."parentId"
        WHERE a.depth < 11
      )
      SELECT "tmdbId", "tmdbType" FROM anc WHERE "tmdbType" = 'tv' LIMIT 1
    `;

    if (ancestors.length > 0 && ancestors[0].tmdbId) {
      return { tmdbId: ancestors[0].tmdbId, tmdbType: "tv" };
    }

    return null;
  }
);
