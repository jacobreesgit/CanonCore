/**
 * TMDB resolution utilities for mapping season/episode items to their parent show.
 * Used by server pages to resolve TMDB IDs before fetching extended details.
 */

import { cache } from "react";
import { prisma } from "@/lib/prisma";

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
 * @param item - Item with TMDB fields
 * @returns Resolved TMDB reference or null if no TMDB data
 */
export const resolveTmdbForItem = cache(
  async (item: {
    id: string;
    tmdbId: number | null;
    tmdbType: string | null;
  }): Promise<ResolvedTmdb | null> => {
    if (!item.tmdbId || !item.tmdbType) return null;

    if (item.tmdbType === "movie") {
      return { tmdbId: item.tmdbId, tmdbType: "movie" };
    }

    if (item.tmdbType === "tv") {
      return { tmdbId: item.tmdbId, tmdbType: "tv" };
    }

    // Season/episode: walk up ancestors to find parent show with tmdbType "tv"
    // Depth guard (max 11) prevents infinite recursion if circular parent refs exist
    const ancestors = await prisma.$queryRaw<
      Array<{ tmdbId: number | null; tmdbType: string | null }>
    >`
      WITH RECURSIVE anc AS (
        SELECT "parentId", "tmdbId", "tmdbType", 0 AS depth
        FROM "Item" WHERE id = ${item.id}
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
