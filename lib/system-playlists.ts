/**
 * System playlist management.
 * Creates and queries the 4 system playlists per user.
 */

import { prisma } from "@/lib/prisma";
import type { SystemPlaylistType } from "@prisma/client";

/** System playlist definitions with display names. */
export const SYSTEM_PLAYLIST_DEFS: Array<{
  type: SystemPlaylistType;
  name: string;
  description: string;
  defaultShelfOrder: number | null;
}> = [
  {
    type: "CONTINUE_WATCHING",
    name: "Continue Watching",
    description: "Resume in-progress items or start the next episode",
    defaultShelfOrder: 1,
  },
  {
    type: "WATCHLIST",
    name: "Watchlist",
    description: "Items you plan to watch",
    defaultShelfOrder: 2,
  },
  {
    type: "RECENTLY_ADDED",
    name: "Recently Added",
    description: "Newest items in your library",
    defaultShelfOrder: null,
  },
  {
    type: "WATCH_AGAIN",
    name: "Watch Again",
    description: "Completed items for rewatching",
    defaultShelfOrder: null,
  },
];

/**
 * Ensures all 4 system playlists exist for a user.
 * Safe to call multiple times (idempotent) — protected by the
 * @@unique([userId, systemType]) constraint and skipDuplicates below.
 */
export async function ensureSystemPlaylists(userId: string): Promise<void> {
  const existing = await prisma.playlist.findMany({
    where: { userId, systemType: { not: null } },
    select: { systemType: true },
  });

  const existingTypes = new Set(existing.map((p) => p.systemType));

  const missing = SYSTEM_PLAYLIST_DEFS.filter(
    (def) => !existingTypes.has(def.type)
  );

  if (missing.length > 0) {
    await prisma.playlist.createMany({
      data: missing.map((def, index) => ({
        userId,
        name: def.name,
        description: def.description,
        systemType: def.type,
        order: -(index + 1), // Negative order so they sort before user playlists
        shelfOrder: def.defaultShelfOrder, // null = available but not shown as shelf
        isPublic: false,
      })),
      // Prevents errors from the TOCTOU race condition — if a concurrent call
      // already created the playlist, the unique constraint catches it and
      // skipDuplicates silently skips rather than throwing.
      skipDuplicates: true,
    });
  }
}
