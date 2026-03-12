/**
 * Progress calculation helpers for item hierarchies.
 * Extracted from apps/web/lib/item-actions.ts for tRPC router use.
 */

import type { PrismaClient } from "@prisma/client";
import type { ItemProgress } from "@canoncore/types";

/**
 * Builds a map of item IDs to their progress (self + all descendants).
 * Uses recursive CTE to count items with watched primary media.
 * Item-based counting: an item is "watched" when it has a WatchRecord
 * (created automatically when playback reaches 80%, or manually by the user).
 *
 * @param prisma - Prisma client instance
 * @param userId - User ID for authorization
 * @param itemIds - Array of item IDs to calculate progress for
 * @returns Map of item ID to ItemProgress
 */
export async function buildDescendantProgressMap(
  prisma: PrismaClient,
  userId: string,
  itemIds: string[]
): Promise<Map<string, ItemProgress>> {
  if (itemIds.length === 0) {
    return new Map();
  }

  // Single query: count items with primary media and watched status
  const progressData = await prisma.$queryRaw<
    Array<{
      rootItemId: string;
      totalItems: bigint;
      itemsWithMedia: bigint;
      watchedItems: bigint;
      progressSum: number;
    }>
  >`
    WITH RECURSIVE descendants AS (
      -- Base: the items themselves
      SELECT id, id as "rootItemId" FROM "Item"
      WHERE id = ANY(${itemIds}) AND "userId" = ${userId}
      UNION ALL
      -- Recursive: all descendants
      SELECT i.id, d."rootItemId"
      FROM "Item" i
      INNER JOIN descendants d ON i."parentId" = d.id
      WHERE i."userId" = ${userId}
    )
    SELECT
      d."rootItemId",
      COUNT(DISTINCT d.id) as "totalItems",
      COUNT(DISTINCT CASE WHEN f.id IS NOT NULL THEN d.id END) as "itemsWithMedia",
      COUNT(DISTINCT CASE
        WHEN EXISTS(
          SELECT 1 FROM "WatchRecord" wr
          WHERE wr."itemId" = d.id AND wr."userId" = ${userId}
        )
        THEN d.id
      END) as "watchedItems",
      COALESCE(SUM(
        CASE
          WHEN f.id IS NOT NULL THEN
            CASE
              WHEN EXISTS(
                SELECT 1 FROM "WatchRecord" wr
                WHERE wr."itemId" = d.id AND wr."userId" = ${userId}
              ) THEN 1.0
              WHEN f."playbackPosition" IS NOT NULL
                AND f."playbackDuration" IS NOT NULL
                AND f."playbackDuration" > 0
              THEN LEAST(f."playbackPosition"::float / f."playbackDuration"::float, 1.0)
              ELSE 0.0
            END
          ELSE NULL
        END
      ), 0) as "progressSum"
    FROM descendants d
    LEFT JOIN "ItemFile" f ON f."itemId" = d.id
      AND f."fileType" = 'MEDIA'
      AND f."isPrimary" = true
    GROUP BY d."rootItemId"
  `;

  // Build progress map from query results
  const progressMap = new Map<string, ItemProgress>();

  for (const row of progressData) {
    const totalItems = Number(row.totalItems);
    const itemsWithMedia = Number(row.itemsWithMedia);
    const watchedItems = Number(row.watchedItems);
    const progressSum = Number(row.progressSum);

    progressMap.set(row.rootItemId, {
      watchedItems,
      itemsWithMedia,
      percentage:
        itemsWithMedia > 0
          ? Math.round((progressSum / itemsWithMedia) * 100)
          : null,
      totalItems,
    });
  }

  // Ensure all requested items have an entry (even if not in results)
  for (const itemId of itemIds) {
    if (!progressMap.has(itemId)) {
      progressMap.set(itemId, {
        watchedItems: 0,
        itemsWithMedia: 0,
        percentage: null,
        totalItems: 0,
      });
    }
  }

  return progressMap;
}
