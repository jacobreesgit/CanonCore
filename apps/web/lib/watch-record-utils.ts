/**
 * Shared watch record utilities.
 * NOT a "use server" file — safe to import from any server-side module
 * without exposing helpers as client-callable server actions.
 */

import { prisma } from "@/lib/prisma";
import type { WatchSource } from "@prisma/client";

/** Deduplication window in milliseconds (5 minutes). */
const DEDUP_WINDOW_MS = 5 * 60 * 1000;

/**
 * Creates a WatchRecord if none exists within the dedup window.
 * Shared by both `createWatchRecord` (server action) and the auto-scrobble
 * logic in `updatePlaybackPosition` to keep the dedup window and query
 * consistent in a single place.
 *
 * Uses `watchedAt` (not `createdAt`) for the dedup check so the query is
 * covered by the `[itemId, userId, watchedAt]` composite index.
 *
 * @returns true if a record was created, false if deduped
 */
export async function createWatchRecordIfNotRecent(
  itemId: string,
  userId: string,
  source: WatchSource
): Promise<boolean> {
  const dedupCutoff = new Date(Date.now() - DEDUP_WINDOW_MS);
  const recent = await prisma.watchRecord.findFirst({
    where: {
      itemId,
      userId,
      watchedAt: { gte: dedupCutoff },
    },
    orderBy: { watchedAt: "desc" },
  });

  if (recent) return false;

  await prisma.watchRecord.create({
    data: { itemId, userId, source },
  });
  return true;
}
