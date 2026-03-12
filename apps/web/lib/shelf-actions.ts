/**
 * Server actions for personalised home shelves.
 * Shelves are configurable — any playlist with a non-null shelfOrder is shown.
 * System playlists are virtual (computed at query time); user playlists use real rows.
 */

"use server";

import { cache } from "react";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { shelfOrderSchema, playlistIdSchema } from "@/lib/validations";
import { ensureSystemPlaylists } from "@/lib/system-playlists";
import {
  getSystemShelfItems,
  getUserPlaylistShelfItems,
} from "@/lib/shelf-query-utils";
import type { HomeShelf, ShelfConfig } from "@/lib/types";

// ---------------------------------------------------------------------------
// Shelf configuration actions (used by My Items settings)
// ---------------------------------------------------------------------------

/**
 * Returns all user playlists with their shelf status for the settings UI.
 * Active shelves (shelfOrder != null) are sorted first by shelfOrder,
 * then inactive playlists sorted alphabetically.
 *
 * NOTE: No `checkRateLimit()` here — this is a read-only settings query called
 * when the shelf config panel opens. Rate limiting reads would degrade UX without
 * meaningful abuse prevention. Auth check is sufficient.
 */
export async function getShelfConfig(): Promise<
  { success: true; data: ShelfConfig[] } | { success: false; error: string }
> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  const playlists = await prisma.playlist.findMany({
    where: { userId: session.user.id },
    select: { id: true, name: true, systemType: true, shelfOrder: true },
    orderBy: [{ shelfOrder: "asc" }, { name: "asc" }],
  });

  return {
    success: true,
    data: playlists.map((p) => ({
      playlistId: p.id,
      name: p.name,
      systemType: p.systemType,
      shelfOrder: p.shelfOrder,
    })),
  };
}

/**
 * Adds a playlist as a shelf. Assigns the next available shelfOrder.
 */
export async function addPlaylistAsShelf(
  playlistId: string
): Promise<{ success: true } | { success: false; error: string }> {
  const parsed = playlistIdSchema.safeParse(playlistId);
  if (!parsed.success) return { success: false, error: "Invalid playlist ID" };

  const [session, _rateLimit] = await Promise.all([
    auth(),
    checkRateLimit("shelf"),
  ]);
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  const playlist = await prisma.playlist.findFirst({
    where: { id: playlistId, userId: session.user.id },
  });
  if (!playlist) return { success: false, error: "Playlist not found" };

  // Find the highest current shelfOrder to append after it
  const existing = await prisma.playlist.findMany({
    where: { userId: session.user.id, shelfOrder: { not: null } },
    select: { shelfOrder: true },
    orderBy: { shelfOrder: "desc" },
    take: 1,
  });

  const nextOrder = (existing[0]?.shelfOrder ?? 0) + 1;

  await prisma.playlist.update({
    where: { id: playlistId },
    data: { shelfOrder: nextOrder },
  });

  revalidatePath("/");
  return { success: true };
}

/**
 * Removes a playlist from shelves by setting shelfOrder to null.
 */
export async function removeShelf(
  playlistId: string
): Promise<{ success: true } | { success: false; error: string }> {
  const parsed = playlistIdSchema.safeParse(playlistId);
  if (!parsed.success) return { success: false, error: "Invalid playlist ID" };

  const [session, _rateLimit] = await Promise.all([
    auth(),
    checkRateLimit("shelf"),
  ]);
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  const playlist = await prisma.playlist.findFirst({
    where: { id: playlistId, userId: session.user.id },
  });
  if (!playlist) return { success: false, error: "Playlist not found" };

  await prisma.playlist.update({
    where: { id: playlistId },
    data: { shelfOrder: null },
  });

  revalidatePath("/");
  return { success: true };
}

/**
 * Reorders shelves. Accepts an ordered array of playlist IDs.
 * Sets shelfOrder = index + 1 for each. Validates that all IDs belong to
 * the user's active shelves and enforces a max of 20 shelves.
 */
export async function reorderShelves(
  orderedPlaylistIds: string[]
): Promise<{ success: true } | { success: false; error: string }> {
  const parsed = shelfOrderSchema.safeParse(orderedPlaylistIds);
  if (!parsed.success) {
    return { success: false, error: "Invalid shelf order" };
  }

  const [session, _rateLimit] = await Promise.all([
    auth(),
    checkRateLimit("shelf"),
  ]);
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  // Verify all IDs belong to this user's playlists
  const userPlaylists = await prisma.playlist.findMany({
    where: { userId: session.user.id, id: { in: parsed.data } },
    select: { id: true },
  });

  const validIds = new Set(userPlaylists.map((p) => p.id));
  if (parsed.data.some((id) => !validIds.has(id))) {
    return { success: false, error: "One or more playlists not found" };
  }

  await prisma.$transaction(
    parsed.data.map((id, index) =>
      prisma.playlist.update({
        where: { id, userId: session.user.id },
        data: { shelfOrder: index + 1 },
      })
    )
  );

  revalidatePath("/");
  return { success: true };
}

// ---------------------------------------------------------------------------
// Home shelf data fetching
// ---------------------------------------------------------------------------

/**
 * Fetches all home shelves for the authenticated user.
 * Queries playlists with non-null shelfOrder, resolves items for each,
 * and filters out empty shelves.
 */
export const getHomeShelves = cache(async (): Promise<HomeShelf[]> => {
  const session = await auth();
  if (!session?.user?.id) return [];

  const userId = session.user.id;

  // Ensure system playlists exist (idempotent — uses skipDuplicates)
  await ensureSystemPlaylists(userId);

  // Get all playlists configured as shelves, ordered by shelfOrder
  const shelfPlaylists = await prisma.playlist.findMany({
    where: { userId, shelfOrder: { not: null } },
    select: { id: true, name: true, systemType: true, shelfOrder: true },
    orderBy: { shelfOrder: "asc" },
  });

  // Resolve items for each shelf in parallel
  const shelfResults = await Promise.all(
    shelfPlaylists.map(async (playlist) => {
      const items = playlist.systemType
        ? await getSystemShelfItems(userId, playlist.systemType)
        : await getUserPlaylistShelfItems(playlist.id);

      return {
        playlistId: playlist.id,
        type: playlist.systemType,
        name: playlist.name,
        items,
      } satisfies HomeShelf;
    })
  );

  return shelfResults.filter((s) => s.items.length > 0);
});
