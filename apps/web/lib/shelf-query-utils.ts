/**
 * Shelf query utilities — pure database queries for resolving shelf items.
 * NOT a "use server" file so these functions are not exposed as client-callable
 * server actions. Imported by both shelf-actions.ts and playlist-actions.ts.
 */

import { cache } from "react";

import { prisma } from "@/lib/prisma";
import { resolveArtworkId } from "@/lib/tmdb-image-utils";
import type { ShelfItem } from "@/lib/types";
import type { SystemPlaylistType } from "@prisma/client";

/** Max items per shelf. */
export const SHELF_LIMIT = 10;

async function _getSystemShelfItems(
  userId: string,
  systemType: SystemPlaylistType
): Promise<ShelfItem[]> {
  switch (systemType) {
    case "CONTINUE_WATCHING":
      return getContinueWatchingItems(userId);
    case "WATCHLIST":
      return getWatchlistItems(userId);
    case "RECENTLY_ADDED":
      return getRecentlyAddedItems(userId);
    case "WATCH_AGAIN":
      return getWatchAgainItems(userId);
    default: {
      const _exhaustive: never = systemType;
      return [];
    }
  }
}

/**
 * Dispatches to the correct query function for a system playlist type.
 * Wrapped with React.cache() to deduplicate calls within a single request.
 * Both args are primitives (string, string enum) so Object.is equality works.
 */
export const getSystemShelfItems = cache(_getSystemShelfItems);

/**
 * Items from a user-created playlist (real PlaylistItem rows).
 */
export async function getUserPlaylistShelfItems(
  playlistId: string
): Promise<ShelfItem[]> {
  const playlistItems = await prisma.playlistItem.findMany({
    where: { playlistId },
    orderBy: { order: "asc" },
    take: SHELF_LIMIT,
    select: { itemId: true },
  });

  if (playlistItems.length === 0) return [];
  return resolveShelfItems(playlistItems.map((pi) => pi.itemId));
}

/**
 * Combined "Continue Watching" shelf — merges two sources into one row:
 *
 * 1. **Resume items:** Partially played items (position > 0) without a
 *    WatchRecord — the user paused mid-way through.
 * 2. **Up Next items:** For each series with at least one watched child,
 *    the first unwatched child — the next episode.
 *
 * Results are deduplicated (an item can't appear in both) and interleaved
 * with resume items first, then up-next items. This matches the Netflix /
 * Disney+ / Apple TV single-row pattern.
 */
async function getContinueWatchingItems(userId: string): Promise<ShelfItem[]> {
  const items = await prisma.$queryRaw<Array<{ id: string }>>`
    WITH resume AS (
      -- Items the user started but hasn't completed
      SELECT i.id, f."updatedAt" AS sort_time
      FROM "Item" i
      INNER JOIN "ItemFile" f ON f."itemId" = i.id
        AND f."fileType" = 'MEDIA' AND f."isPrimary" = true
        AND f."playbackPosition" > 0
      WHERE i."userId" = ${userId}
        AND NOT EXISTS (
          SELECT 1 FROM "WatchRecord" wr
          WHERE wr."itemId" = i.id AND wr."userId" = ${userId}
        )
    ),
    up_next AS (
      -- Next unwatched episode in series with at least one watched child
      SELECT DISTINCT ON (started_parents."parentId") first_unwatched.id,
             first_unwatched.sort_time
      FROM (
        SELECT DISTINCT i."parentId"
        FROM "Item" i
        WHERE i."userId" = ${userId}
          AND i."parentId" IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM "WatchRecord" wr
            WHERE wr."itemId" = i.id AND wr."userId" = ${userId}
          )
      ) started_parents
      CROSS JOIN LATERAL (
        SELECT child.id, child."updatedAt" AS sort_time
        FROM "Item" child
        WHERE child."parentId" = started_parents."parentId"
          AND child."userId" = ${userId}
          AND NOT EXISTS (
            SELECT 1 FROM "WatchRecord" wr
            WHERE wr."itemId" = child.id AND wr."userId" = ${userId}
          )
        ORDER BY child."order" ASC
        LIMIT 1
      ) first_unwatched
    )
    SELECT id FROM (
      SELECT DISTINCT ON (id) id, sort_time
      FROM (
        SELECT id, sort_time FROM resume
        UNION ALL
        SELECT id, sort_time FROM up_next
      ) merged
      ORDER BY id, sort_time DESC
    ) combined
    ORDER BY sort_time DESC
    LIMIT ${SHELF_LIMIT}
  `;

  return resolveShelfItems(items.map((i) => i.id));
}

/**
 * Items in the user's Watchlist system playlist (real PlaylistItem rows).
 */
async function getWatchlistItems(userId: string): Promise<ShelfItem[]> {
  const watchlist = await prisma.playlist.findFirst({
    where: { userId, systemType: "WATCHLIST" },
    include: {
      playlistItems: {
        orderBy: { order: "asc" },
        take: SHELF_LIMIT,
        select: { itemId: true },
      },
    },
  });

  if (!watchlist || watchlist.playlistItems.length === 0) return [];

  return resolveShelfItems(watchlist.playlistItems.map((pi) => pi.itemId));
}

/**
 * Newest items in the library.
 */
async function getRecentlyAddedItems(userId: string): Promise<ShelfItem[]> {
  const items = await prisma.item.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: SHELF_LIMIT,
    select: { id: true },
  });

  return resolveShelfItems(items.map((i) => i.id));
}

/**
 * Completed items (have WatchRecord) for re-watching.
 * Uses a JOIN with grouped MAX instead of a correlated subquery in ORDER BY
 * for better performance with large datasets.
 */
async function getWatchAgainItems(userId: string): Promise<ShelfItem[]> {
  const items = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT i.id
    FROM "Item" i
    INNER JOIN (
      SELECT "itemId", MAX("watchedAt") AS last_watched
      FROM "WatchRecord"
      WHERE "userId" = ${userId}
      GROUP BY "itemId"
    ) wr ON wr."itemId" = i.id
    WHERE i."userId" = ${userId}
    ORDER BY wr.last_watched DESC
    LIMIT ${SHELF_LIMIT}
  `;

  return resolveShelfItems(items.map((i) => i.id));
}

/**
 * Resolves a list of item IDs into ShelfItem objects.
 * Only fetches fields needed for shelf card rendering (name, artwork, child count).
 */
export async function resolveShelfItems(
  itemIds: string[]
): Promise<ShelfItem[]> {
  if (itemIds.length === 0) return [];

  const items = await prisma.item.findMany({
    where: { id: { in: itemIds } },
    select: {
      id: true,
      name: true,
      tmdbPosterPath: true,
      files: {
        where: { fileType: "ARTWORK" },
        orderBy: { isPrimary: "desc" },
        take: 1,
        select: { id: true, fileType: true, isPrimary: true },
      },
      _count: {
        select: { children: true },
      },
    },
  });

  // Fetch primary media file playback data for progress bars
  const mediaFiles = await prisma.itemFile.findMany({
    where: {
      itemId: { in: itemIds },
      fileType: "MEDIA",
      isPrimary: true,
    },
    select: {
      itemId: true,
      playbackPosition: true,
      playbackDuration: true,
    },
  });

  const progressMap = new Map<string, number | null>();
  for (const f of mediaFiles) {
    if (f.playbackPosition && f.playbackDuration && f.playbackDuration > 0) {
      progressMap.set(
        f.itemId,
        Math.round((f.playbackPosition / f.playbackDuration) * 100)
      );
    }
  }

  // Preserve original order from the shelf query
  const itemMap = new Map(items.map((i) => [i.id, i]));
  return itemIds.reduce<ShelfItem[]>((acc, id) => {
    const item = itemMap.get(id);
    if (item) {
      acc.push({
        id: item.id,
        name: item.name,
        tmdbPosterPath: item.tmdbPosterPath,
        artworkId: resolveArtworkId(item),
        childCount: item._count.children,
        playbackProgress: progressMap.get(id) ?? null,
      });
    }
    return acc;
  }, []);
}
