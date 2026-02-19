/**
 * Server actions for playlist CRUD operations.
 * Handles cross-cutting playlists with many-to-many item references.
 * All actions follow the same auth + rate limit + validation pattern as item-actions.ts.
 */

"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  playlistNameSchema,
  playlistDescriptionSchema,
  playlistArtworkSchema,
} from "@/lib/validations";
import { revalidatePath } from "next/cache";
import { checkRateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { handlePrismaError } from "@/lib/errors";
import type {
  ItemResult,
  PlaylistWithCount,
  PlaylistWithItems,
  PlaylistItemEntry,
  PlaylistMembership,
} from "@/lib/types";
import { resolveArtworkId } from "@/lib/tmdb-image-utils";

/**
 * Create a new playlist for the current user.
 * Assigns the next sequential order value.
 *
 * @param name - Playlist name (1-255 chars, trimmed)
 * @returns Created playlist ID and name, or error
 */
export async function createPlaylist(
  name: string,
  options?: { description?: string; isPublic?: boolean }
): Promise<ItemResult<{ id: string; name: string }>> {
  try {
    const [session, rateLimitResult] = await Promise.all([
      auth(),
      checkRateLimit("playlist"),
    ]);
    if (!session?.user?.id) {
      return { error: "Not authenticated" };
    }
    if (rateLimitResult) {
      return { error: rateLimitResult.error };
    }

    const parsed = playlistNameSchema.safeParse(name);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid name" };
    }

    const userId = session.user.id;

    // Get next order value (same aggregate + 1 pattern as createItem)
    const maxOrder = await prisma.playlist.aggregate({
      where: { userId },
      _max: { order: true },
    });
    const nextOrder = (maxOrder._max.order ?? -1) + 1;

    const playlist = await prisma.playlist.create({
      data: {
        name: parsed.data,
        order: nextOrder,
        userId,
        description: options?.description ?? null,
        isPublic: options?.isPublic ?? false,
      },
    });

    logger.info({ userId, playlistId: playlist.id }, "Playlist created");
    return { success: true, data: { id: playlist.id, name: playlist.name } };
  } catch (error) {
    logger.error({ error }, "Failed to create playlist");
    const prismaError = handlePrismaError(error);
    return prismaError ?? { error: "Failed to create playlist" };
  }
}

/**
 * Get a playlist with its items. Owner sees all items.
 * Use getPublicPlaylist (in public-auth.ts) for viewers.
 *
 * @param playlistId - Playlist ID to fetch
 * @returns Playlist with items, or error
 */
export async function getPlaylist(
  playlistId: string
): Promise<ItemResult<PlaylistWithItems>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { error: "Not authenticated" };
    }

    const playlist = await prisma.playlist.findFirst({
      where: { id: playlistId, userId: session.user.id },
      include: {
        playlistItems: {
          orderBy: { order: "asc" },
          include: {
            item: {
              include: {
                files: {
                  where: { fileType: "ARTWORK" },
                  select: { id: true, fileType: true, isPrimary: true },
                },
              },
            },
          },
        },
      },
    });

    if (!playlist) {
      return { error: "Playlist not found" };
    }

    const items: PlaylistItemEntry[] = playlist.playlistItems.map((pi) => ({
      playlistItemId: pi.id,
      order: pi.order,
      addedAt: pi.addedAt,
      item: {
        ...pi.item,
        tmdbPosterPath: pi.item.tmdbPosterPath,
        tmdbBackdropPath: pi.item.tmdbBackdropPath,
        artworkId: resolveArtworkId(pi.item),
        fileCounts: { media: 0, artwork: pi.item.files.length, subtitles: 0 },
        childCount: 0,
        primaryMediaName: null,
        mediaIconType: null,
        progress: null,
      },
    }));

    return {
      success: true,
      data: {
        id: playlist.id,
        name: playlist.name,
        description: playlist.description,
        order: playlist.order,
        isPublic: playlist.isPublic,
        hasArtwork: !!playlist.artworkImage,
        shareToken: playlist.shareToken ?? null,
        userId: playlist.userId,
        items,
        createdAt: playlist.createdAt,
        updatedAt: playlist.updatedAt,
      },
    };
  } catch (error) {
    logger.error({ error, playlistId }, "Failed to get playlist");
    const prismaError = handlePrismaError(error);
    return prismaError ?? { error: "Failed to get playlist" };
  }
}

/**
 * Get all playlists for the current user with item counts and preview artwork.
 * Used for the playlists section, sidebar, and cards.
 *
 * @returns Array of playlists with counts and preview data, or error
 */
export async function getUserPlaylists(): Promise<
  ItemResult<PlaylistWithCount[]>
> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { error: "Not authenticated" };
    }

    const playlists = await prisma.playlist.findMany({
      where: { userId: session.user.id },
      orderBy: { order: "asc" },
      include: {
        playlistItems: {
          orderBy: { order: "asc" },
          take: 4,
          include: {
            item: {
              select: {
                id: true,
                tmdbPosterPath: true,
                files: {
                  where: { fileType: "ARTWORK" },
                  select: { id: true, fileType: true, isPrimary: true },
                },
              },
            },
          },
        },
        _count: { select: { playlistItems: true } },
      },
    });

    const result: PlaylistWithCount[] = playlists.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      order: p.order,
      isPublic: p.isPublic,
      hasArtwork: !!p.artworkImage,
      itemCount: p._count.playlistItems,
      previewArtworkIds: p.playlistItems.map((pi) => resolveArtworkId(pi.item)),
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));

    return { success: true, data: result };
  } catch (error) {
    logger.error({ error }, "Failed to get user playlists");
    const prismaError = handlePrismaError(error);
    return prismaError ?? { error: "Failed to get playlists" };
  }
}

/**
 * Update a playlist's properties.
 *
 * @param playlistId - Playlist ID to update
 * @param data - Fields to update (name, description, isPublic, enableSharing)
 * @returns Success or error
 */
export async function updatePlaylist(
  playlistId: string,
  data: {
    name?: string;
    description?: string;
    isPublic?: boolean;
    enableSharing?: boolean;
  }
): Promise<ItemResult> {
  try {
    const [session, rateLimitResult] = await Promise.all([
      auth(),
      checkRateLimit("playlist"),
    ]);
    if (!session?.user?.id) {
      return { error: "Not authenticated" };
    }
    if (rateLimitResult) {
      return { error: rateLimitResult.error };
    }

    const playlist = await prisma.playlist.findFirst({
      where: { id: playlistId, userId: session.user.id },
    });
    if (!playlist) {
      return { error: "Playlist not found" };
    }

    const updateData: Record<string, unknown> = {};

    if (data.name !== undefined) {
      const parsed = playlistNameSchema.safeParse(data.name);
      if (!parsed.success) {
        return { error: parsed.error.issues[0]?.message ?? "Invalid name" };
      }
      updateData.name = parsed.data;
    }

    if (data.description !== undefined) {
      const parsed = playlistDescriptionSchema.safeParse(data.description);
      if (!parsed.success) {
        return {
          error: parsed.error.issues[0]?.message ?? "Invalid description",
        };
      }
      updateData.description = parsed.data || null;
    }

    if (data.isPublic !== undefined) {
      updateData.isPublic = data.isPublic;
    }

    if (data.enableSharing === true) {
      const { nanoid } = await import("nanoid");
      updateData.shareToken = nanoid(21);
    } else if (data.enableSharing === false) {
      updateData.shareToken = null;
    }

    await prisma.playlist.update({
      where: { id: playlistId },
      data: updateData,
    });

    logger.info({ playlistId, userId: session.user.id }, "Playlist updated");
    return { success: true };
  } catch (error) {
    logger.error({ error, playlistId }, "Failed to update playlist");
    const prismaError = handlePrismaError(error);
    return prismaError ?? { error: "Failed to update playlist" };
  }
}

/**
 * Delete a playlist. Cascades to PlaylistItem join records.
 * The referenced items themselves are not deleted.
 *
 * @param playlistId - Playlist ID to delete
 * @returns Success or error
 */
export async function deletePlaylist(playlistId: string): Promise<ItemResult> {
  try {
    const [session, rateLimitResult] = await Promise.all([
      auth(),
      checkRateLimit("playlist"),
    ]);
    if (!session?.user?.id) {
      return { error: "Not authenticated" };
    }
    if (rateLimitResult) {
      return { error: rateLimitResult.error };
    }

    const playlist = await prisma.playlist.findFirst({
      where: { id: playlistId, userId: session.user.id },
    });
    if (!playlist) {
      return { error: "Playlist not found" };
    }

    await prisma.playlist.delete({ where: { id: playlistId } });

    logger.info({ playlistId, userId: session.user.id }, "Playlist deleted");
    return { success: true };
  } catch (error) {
    logger.error({ error, playlistId }, "Failed to delete playlist");
    const prismaError = handlePrismaError(error);
    return prismaError ?? { error: "Failed to delete playlist" };
  }
}

/**
 * Upload or replace playlist artwork.
 * Accepts FormData with an "artwork" file field.
 * Validates type (JPEG/PNG/WebP) and size (2MB max).
 * Strips EXIF metadata using sharp.
 *
 * @param playlistId - Playlist to update
 * @param formData - FormData with "artwork" file
 * @returns Success or error
 */
export async function updatePlaylistArtwork(
  playlistId: string,
  formData: FormData
): Promise<ItemResult> {
  try {
    const [session, rateLimitResult] = await Promise.all([
      auth(),
      checkRateLimit("playlist"),
    ]);
    if (!session?.user?.id) return { error: "Not authenticated" };
    if (rateLimitResult) return { error: rateLimitResult.error };

    const file = formData.get("artwork") as File | null;
    if (!file) return { error: "No file provided" };

    const validation = playlistArtworkSchema.safeParse({
      size: file.size,
      type: file.type,
    });
    if (!validation.success) {
      return { error: validation.error.issues[0].message };
    }

    const buffer = new Uint8Array(await file.arrayBuffer());

    // Strip EXIF metadata (same pattern as user-actions.ts)
    const sharp = (await import("sharp")).default;
    const processed = await sharp(buffer).rotate().toBuffer();

    await prisma.playlist.update({
      where: { id: playlistId, userId: session.user.id },
      data: {
        artworkImage: new Uint8Array(processed),
        artworkMime: file.type,
      },
    });

    revalidatePath("/");
    logger.info(
      { playlistId, userId: session.user.id },
      "Playlist artwork updated"
    );
    return { success: true };
  } catch (error) {
    logger.error({ error, playlistId }, "Failed to upload artwork");
    const prismaError = handlePrismaError(error);
    return prismaError ?? { error: "Failed to upload artwork" };
  }
}

/**
 * Remove playlist artwork.
 *
 * @param playlistId - Playlist to update
 * @returns Success or error
 */
export async function removePlaylistArtwork(
  playlistId: string
): Promise<ItemResult> {
  try {
    const [session, rateLimitResult] = await Promise.all([
      auth(),
      checkRateLimit("playlist"),
    ]);
    if (!session?.user?.id) return { error: "Not authenticated" };
    if (rateLimitResult) return { error: rateLimitResult.error };

    await prisma.playlist.update({
      where: { id: playlistId, userId: session.user.id },
      data: { artworkImage: null, artworkMime: null },
    });

    revalidatePath("/");
    logger.info(
      { playlistId, userId: session.user.id },
      "Playlist artwork removed"
    );
    return { success: true };
  } catch (error) {
    logger.error({ error, playlistId }, "Failed to remove artwork");
    const prismaError = handlePrismaError(error);
    return prismaError ?? { error: "Failed to remove artwork" };
  }
}

/**
 * Regenerate the share token for a playlist.
 * Replaces any existing token with a new one.
 *
 * @param playlistId - Playlist to update
 * @returns New share token, or error
 */
export async function regenerateShareToken(
  playlistId: string
): Promise<ItemResult<{ shareToken: string }>> {
  try {
    const [session, rateLimitResult] = await Promise.all([
      auth(),
      checkRateLimit("playlist"),
    ]);
    if (!session?.user?.id) return { error: "Not authenticated" };
    if (rateLimitResult) return { error: rateLimitResult.error };

    const { nanoid } = await import("nanoid");
    const token = nanoid(21);

    await prisma.playlist.update({
      where: { id: playlistId, userId: session.user.id },
      data: { shareToken: token },
    });

    revalidatePath("/");
    logger.info(
      { playlistId, userId: session.user.id },
      "Share token regenerated"
    );
    return { success: true, data: { shareToken: token } };
  } catch (error) {
    logger.error({ error, playlistId }, "Failed to regenerate token");
    const prismaError = handlePrismaError(error);
    return prismaError ?? { error: "Failed to regenerate token" };
  }
}

/**
 * Reorder playlists for the current user.
 * Uses $transaction with batch updateMany (same pattern as reorderItems).
 *
 * @param updates - Array of { id, order } pairs
 * @returns Success or error
 */
export async function reorderPlaylists(
  updates: { id: string; order: number }[]
): Promise<ItemResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { error: "Not authenticated" };
    }

    if (updates.length === 0) {
      return { success: true };
    }

    await prisma.$transaction(
      updates.map((u) =>
        prisma.playlist.updateMany({
          where: { id: u.id, userId: session.user!.id },
          data: { order: u.order },
        })
      )
    );

    return { success: true };
  } catch (error) {
    logger.error({ error }, "Failed to reorder playlists");
    const prismaError = handlePrismaError(error);
    return prismaError ?? { error: "Failed to reorder playlists" };
  }
}

/**
 * Add an item to one or more playlists. Idempotent — silently skips duplicates.
 * Uses Promise.all for parallel max-order queries + createMany (no waterfall).
 *
 * @param itemId - Item to add
 * @param playlistIds - Target playlists
 * @returns Success or error
 */
export async function addItemToPlaylists(
  itemId: string,
  playlistIds: string[]
): Promise<ItemResult> {
  try {
    const [session, rateLimitResult] = await Promise.all([
      auth(),
      checkRateLimit("playlist"),
    ]);
    if (!session?.user?.id) {
      return { error: "Not authenticated" };
    }
    if (rateLimitResult) {
      return { error: rateLimitResult.error };
    }

    if (playlistIds.length === 0) {
      return { success: true };
    }

    const userId = session.user.id;

    // Verify item ownership
    const item = await prisma.item.findFirst({
      where: { id: itemId, userId },
      select: { id: true },
    });
    if (!item) {
      return { error: "Item not found" };
    }

    // Verify all playlists belong to user
    const playlists = await prisma.playlist.findMany({
      where: { id: { in: playlistIds }, userId },
      select: { id: true },
    });
    if (playlists.length !== playlistIds.length) {
      return { error: "One or more playlists not found" };
    }

    // Get max order for each playlist in parallel (avoid N+1 waterfall)
    const maxOrders = await Promise.all(
      playlistIds.map((playlistId) =>
        prisma.playlistItem.aggregate({
          where: { playlistId },
          _max: { order: true },
        })
      )
    );

    // Build create data with correct order per playlist
    const createData = playlistIds.map((playlistId, i) => ({
      playlistId,
      itemId,
      order: (maxOrders[i]._max.order ?? -1) + 1,
    }));

    // Batch create, skip duplicates (idempotent)
    await prisma.playlistItem.createMany({
      data: createData,
      skipDuplicates: true,
    });

    logger.info({ userId, itemId, playlistIds }, "Item added to playlists");
    return { success: true };
  } catch (error) {
    logger.error({ error, itemId }, "Failed to add item to playlists");
    const prismaError = handlePrismaError(error);
    return prismaError ?? { error: "Failed to add item to playlists" };
  }
}

/**
 * Remove a single item from a playlist.
 *
 * @param playlistId - Playlist to remove from
 * @param itemId - Item to remove
 * @returns Success or error
 */
export async function removeItemFromPlaylist(
  playlistId: string,
  itemId: string
): Promise<ItemResult> {
  try {
    const [session, rateLimitResult] = await Promise.all([
      auth(),
      checkRateLimit("playlist"),
    ]);
    if (!session?.user?.id) {
      return { error: "Not authenticated" };
    }
    if (rateLimitResult) {
      return { error: rateLimitResult.error };
    }

    const playlist = await prisma.playlist.findFirst({
      where: { id: playlistId, userId: session.user.id },
      select: { id: true },
    });
    if (!playlist) {
      return { error: "Playlist not found" };
    }

    await prisma.playlistItem.deleteMany({
      where: { playlistId, itemId },
    });

    return { success: true };
  } catch (error) {
    logger.error({ error, playlistId, itemId }, "Failed to remove item");
    const prismaError = handlePrismaError(error);
    return prismaError ?? { error: "Failed to remove item from playlist" };
  }
}

/**
 * Bulk remove items from a playlist.
 *
 * @param playlistId - Playlist to remove from
 * @param itemIds - Items to remove
 * @returns Success or error
 */
export async function removeItemsFromPlaylist(
  playlistId: string,
  itemIds: string[]
): Promise<ItemResult> {
  try {
    const [session, rateLimitResult] = await Promise.all([
      auth(),
      checkRateLimit("playlist"),
    ]);
    if (!session?.user?.id) {
      return { error: "Not authenticated" };
    }
    if (rateLimitResult) {
      return { error: rateLimitResult.error };
    }

    if (itemIds.length === 0) {
      return { success: true };
    }

    const playlist = await prisma.playlist.findFirst({
      where: { id: playlistId, userId: session.user.id },
      select: { id: true },
    });
    if (!playlist) {
      return { error: "Playlist not found" };
    }

    await prisma.playlistItem.deleteMany({
      where: { playlistId, itemId: { in: itemIds } },
    });

    return { success: true };
  } catch (error) {
    logger.error({ error, playlistId }, "Failed to bulk remove items");
    const prismaError = handlePrismaError(error);
    return prismaError ?? { error: "Failed to remove items from playlist" };
  }
}

/**
 * Reorder items within a playlist.
 * Uses $transaction with batch updateMany (same pattern as reorderItems).
 *
 * @param playlistId - Playlist containing the items
 * @param updates - Array of { id, order } pairs (PlaylistItem IDs)
 * @returns Success or error
 */
export async function reorderPlaylistItems(
  playlistId: string,
  updates: { id: string; order: number }[]
): Promise<ItemResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { error: "Not authenticated" };
    }

    const playlist = await prisma.playlist.findFirst({
      where: { id: playlistId, userId: session.user.id },
      select: { id: true },
    });
    if (!playlist) {
      return { error: "Playlist not found" };
    }

    if (updates.length === 0) {
      return { success: true };
    }

    await prisma.$transaction(
      updates.map((u) =>
        prisma.playlistItem.updateMany({
          where: { id: u.id, playlistId },
          data: { order: u.order },
        })
      )
    );

    return { success: true };
  } catch (error) {
    logger.error({ error, playlistId }, "Failed to reorder playlist items");
    const prismaError = handlePrismaError(error);
    return prismaError ?? { error: "Failed to reorder playlist items" };
  }
}

/**
 * Get which playlists contain a given item.
 * Used for the "Add to Playlist" dialog checkbox state.
 *
 * @param itemId - Item to check membership for
 * @returns Array of playlist memberships, or error
 */
export async function getPlaylistsForItem(
  itemId: string
): Promise<ItemResult<PlaylistMembership[]>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { error: "Not authenticated" };
    }

    const playlists = await prisma.playlist.findMany({
      where: { userId: session.user.id },
      orderBy: { order: "asc" },
      select: {
        id: true,
        name: true,
        playlistItems: {
          where: { itemId },
          select: { id: true },
        },
      },
    });

    const result: PlaylistMembership[] = playlists.map((p) => ({
      id: p.id,
      name: p.name,
      isMember: p.playlistItems.length > 0,
    }));

    return { success: true, data: result };
  } catch (error) {
    logger.error({ error, itemId }, "Failed to get playlists for item");
    const prismaError = handlePrismaError(error);
    return prismaError ?? { error: "Failed to get playlists" };
  }
}
