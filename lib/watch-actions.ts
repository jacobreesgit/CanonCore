/**
 * Server actions for watch status tracking.
 * Handles WatchRecord CRUD: auto-scrobble, manual mark, unwatch.
 */

"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { itemIdSchema } from "@/lib/validations";
import { createWatchRecordIfNotRecent } from "@/lib/watch-record-utils";
import { logger } from "@/lib/logger";
import type { WatchSource } from "@prisma/client";

/** Result type for watch actions. */
type WatchResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

/**
 * Creates a WatchRecord for an item.
 * Deduplicates within a 5-minute window to prevent rapid duplicate scrobbles.
 *
 * @param itemId - Item to mark as watched
 * @param source - AUTO (playback threshold) or MANUAL (user action)
 */
export async function createWatchRecord(
  itemId: string,
  source: WatchSource
): Promise<WatchResult> {
  const parsed = itemIdSchema.safeParse(itemId);
  if (!parsed.success) return { success: false, error: "Invalid item ID" };

  try {
    // Parallelise auth, rate limit, and item lookup (all independent)
    const [session, rateLimitResult, item] = await Promise.all([
      auth(),
      checkRateLimit("watch"),
      prisma.item.findUnique({ where: { id: parsed.data } }),
    ]);

    if (rateLimitResult) {
      return { success: false, error: rateLimitResult.error };
    }
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }
    if (!item) {
      return { success: false, error: "Item not found" };
    }
    if (item.userId !== session.user.id) {
      return { success: false, error: "Access denied" };
    }

    await createWatchRecordIfNotRecent(parsed.data, session.user.id, source);

    revalidatePath("/");
    return { success: true };
  } catch (error) {
    logger.error({ err: error, itemId }, "Failed to create watch record");
    return { success: false, error: "Failed to create watch record" };
  }
}

/**
 * Manually marks an item as watched.
 */
export async function markAsWatched(itemId: string): Promise<WatchResult> {
  return createWatchRecord(itemId, "MANUAL");
}

/**
 * Removes the most recent WatchRecord for an item.
 * Preserves older play history.
 */
export async function markAsUnwatched(itemId: string): Promise<WatchResult> {
  const parsed = itemIdSchema.safeParse(itemId);
  if (!parsed.success) return { success: false, error: "Invalid item ID" };

  try {
    const [session, rateLimitResult, item] = await Promise.all([
      auth(),
      checkRateLimit("watch"),
      prisma.item.findUnique({ where: { id: parsed.data } }),
    ]);

    if (rateLimitResult) {
      return { success: false, error: rateLimitResult.error };
    }
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }
    if (!item) {
      return { success: false, error: "Item not found" };
    }
    if (item.userId !== session.user.id) {
      return { success: false, error: "Access denied" };
    }

    const mostRecent = await prisma.watchRecord.findFirst({
      where: { itemId, userId: session.user.id },
      orderBy: { watchedAt: "desc" },
    });

    if (!mostRecent) {
      return { success: false, error: "No watch record to remove" };
    }

    await prisma.watchRecord.delete({ where: { id: mostRecent.id } });

    revalidatePath("/");
    return { success: true };
  } catch (error) {
    logger.error({ err: error, itemId }, "Failed to remove watch record");
    return { success: false, error: "Failed to remove watch record" };
  }
}

/**
 * Gets watch status for an item (most recent record + total play count).
 *
 * NOTE: No `checkRateLimit()` here — this is a read-only query called on every
 * item detail page render. Rate limiting reads would degrade UX without meaningful
 * abuse prevention (attackers target mutations, not reads). Auth check is sufficient.
 */
export async function getWatchStatus(
  itemId: string
): Promise<WatchResult<{ isWatched: boolean; playCount: number }>> {
  try {
    const [session, item] = await Promise.all([
      auth(),
      prisma.item.findUnique({
        where: { id: itemId },
        select: { userId: true },
      }),
    ]);

    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }
    if (!item) {
      return { success: false, error: "Item not found" };
    }
    if (item.userId !== session.user.id) {
      return { success: false, error: "Access denied" };
    }

    const playCount = await prisma.watchRecord.count({
      where: { itemId, userId: session.user.id },
    });

    return {
      success: true,
      data: {
        isWatched: playCount > 0,
        playCount,
      },
    };
  } catch (error) {
    logger.error({ err: error, itemId }, "Failed to get watch status");
    return { success: false, error: "Failed to get watch status" };
  }
}

/**
 * Marks the item and all its descendants as watched.
 * Creates MANUAL WatchRecords for items that don't already have one.
 * Only includes items that have primary media (containers without media are skipped).
 */
export async function markAllWatched(
  parentItemId: string
): Promise<WatchResult> {
  const parsed = itemIdSchema.safeParse(parentItemId);
  if (!parsed.success) return { success: false, error: "Invalid item ID" };

  try {
    const [session, rateLimitResult, item] = await Promise.all([
      auth(),
      checkRateLimit("watch"),
      prisma.item.findUnique({ where: { id: parsed.data } }),
    ]);

    if (rateLimitResult) {
      return { success: false, error: rateLimitResult.error };
    }
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }
    if (!item) {
      return { success: false, error: "Item not found" };
    }
    if (item.userId !== session.user.id) {
      return { success: false, error: "Access denied" };
    }

    // Get all unwatched descendant item IDs that have primary media.
    // Excludes containers (TV shows, seasons) that don't have their own media.
    const descendants = await prisma.$queryRaw<Array<{ id: string }>>`
      WITH RECURSIVE descendants AS (
        SELECT id FROM "Item" WHERE id = ${parentItemId} AND "userId" = ${session.user.id}
        UNION ALL
        SELECT i.id FROM "Item" i
        INNER JOIN descendants d ON i."parentId" = d.id
        WHERE i."userId" = ${session.user.id}
      )
      SELECT d.id FROM descendants d
      WHERE EXISTS (
        SELECT 1 FROM "ItemFile" f
        WHERE f."itemId" = d.id AND f."fileType" = 'MEDIA' AND f."isPrimary" = true
      )
      AND NOT EXISTS (
        SELECT 1 FROM "WatchRecord" wr
        WHERE wr."itemId" = d.id AND wr."userId" = ${session.user.id}
      )
    `;

    if (descendants.length > 0) {
      await prisma.watchRecord.createMany({
        data: descendants.map((d) => ({
          itemId: d.id,
          userId: session.user.id,
          source: "MANUAL" as const,
        })),
      });
    }

    revalidatePath("/");
    return { success: true };
  } catch (error) {
    logger.error(
      { err: error, itemId: parentItemId },
      "Failed to mark all as watched"
    );
    return { success: false, error: "Failed to mark all as watched" };
  }
}

/**
 * Batch removes all WatchRecords for descendant items.
 * Deletes every WatchRecord for items in the subtree that have primary media.
 */
export async function markAllUnwatched(
  parentItemId: string
): Promise<WatchResult> {
  const parsed = itemIdSchema.safeParse(parentItemId);
  if (!parsed.success) return { success: false, error: "Invalid item ID" };

  try {
    const [session, rateLimitResult, item] = await Promise.all([
      auth(),
      checkRateLimit("watch"),
      prisma.item.findUnique({ where: { id: parsed.data } }),
    ]);

    if (rateLimitResult) {
      return { success: false, error: rateLimitResult.error };
    }
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }
    if (!item) {
      return { success: false, error: "Item not found" };
    }
    if (item.userId !== session.user.id) {
      return { success: false, error: "Access denied" };
    }

    // Get all descendant item IDs (including parent itself)
    const descendantIds = await prisma.$queryRaw<Array<{ id: string }>>`
      WITH RECURSIVE descendants AS (
        SELECT id FROM "Item" WHERE id = ${parentItemId} AND "userId" = ${session.user.id}
        UNION ALL
        SELECT i.id FROM "Item" i
        INNER JOIN descendants d ON i."parentId" = d.id
        WHERE i."userId" = ${session.user.id}
      )
      SELECT d.id FROM descendants d
    `;

    if (descendantIds.length > 0) {
      await prisma.watchRecord.deleteMany({
        where: {
          itemId: { in: descendantIds.map((d) => d.id) },
          userId: session.user.id,
        },
      });
    }

    revalidatePath("/");
    return { success: true };
  } catch (error) {
    logger.error(
      { err: error, itemId: parentItemId },
      "Failed to mark all as unwatched"
    );
    return { success: false, error: "Failed to mark all as unwatched" };
  }
}
