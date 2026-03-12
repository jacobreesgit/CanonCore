import type { PrismaClient, SystemPlaylistType } from "@prisma/client";
import { resolveArtworkId } from "@canoncore/utils";

/** Shelf item shape returned to callers. */
export interface ShelfItemResult {
  id: string;
  name: string;
  tmdbPosterPath: string | null;
  artworkId: string | null;
  childCount: number;
  playbackProgress: number | null;
}

/** Max items per shelf. */
const SHELF_LIMIT = 10;

/**
 * Dispatches to the correct query function for a system playlist type.
 */
export async function getSystemShelfItems(
  prisma: PrismaClient,
  userId: string,
  systemType: SystemPlaylistType
): Promise<ShelfItemResult[]> {
  switch (systemType) {
    case "CONTINUE_WATCHING":
      return getContinueWatchingItems(prisma, userId);
    case "WATCHLIST":
      return getWatchlistItems(prisma, userId);
    case "RECENTLY_ADDED":
      return getRecentlyAddedItems(prisma, userId);
    case "WATCH_AGAIN":
      return getWatchAgainItems(prisma, userId);
    default: {
      const _exhaustive: never = systemType;
      return [];
    }
  }
}

/**
 * Items from a user-created playlist (real PlaylistItem rows).
 */
export async function getUserPlaylistShelfItems(
  prisma: PrismaClient,
  playlistId: string
): Promise<ShelfItemResult[]> {
  const playlistItems = await prisma.playlistItem.findMany({
    where: { playlistId },
    orderBy: { order: "asc" },
    take: SHELF_LIMIT,
    select: { itemId: true },
  });

  if (playlistItems.length === 0) return [];
  return resolveShelfItems(prisma, playlistItems.map((pi) => pi.itemId));
}

/**
 * Combined "Continue Watching" shelf — merges resume items and up-next items.
 */
async function getContinueWatchingItems(
  prisma: PrismaClient,
  userId: string
): Promise<ShelfItemResult[]> {
  const items = await prisma.$queryRaw<Array<{ id: string }>>`
    WITH resume AS (
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

  return resolveShelfItems(prisma, items.map((i) => i.id));
}

/**
 * Items in the user's Watchlist system playlist (real PlaylistItem rows).
 */
async function getWatchlistItems(
  prisma: PrismaClient,
  userId: string
): Promise<ShelfItemResult[]> {
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

  return resolveShelfItems(
    prisma,
    watchlist.playlistItems.map((pi) => pi.itemId)
  );
}

/**
 * Newest items in the library.
 */
async function getRecentlyAddedItems(
  prisma: PrismaClient,
  userId: string
): Promise<ShelfItemResult[]> {
  const items = await prisma.item.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: SHELF_LIMIT,
    select: { id: true },
  });

  return resolveShelfItems(prisma, items.map((i) => i.id));
}

/**
 * Completed items (have WatchRecord) for re-watching.
 */
async function getWatchAgainItems(
  prisma: PrismaClient,
  userId: string
): Promise<ShelfItemResult[]> {
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

  return resolveShelfItems(prisma, items.map((i) => i.id));
}

/**
 * Resolves a list of item IDs into shelf item objects.
 * Only fetches fields needed for shelf card rendering.
 */
async function resolveShelfItems(
  prisma: PrismaClient,
  itemIds: string[]
): Promise<ShelfItemResult[]> {
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
  return itemIds.reduce<ShelfItemResult[]>((acc, id) => {
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
