import crypto from "node:crypto";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  publicProcedure,
  protectedProcedure,
} from "../trpc";
import { rateLimit } from "../middleware/rate-limit";
import {
  playlistNameSchema,
  playlistDescriptionSchema,
  playlistVisibilitySchema,
  createPlaylistItemsSchema,
} from "@canoncore/validators";
import {
  resolveArtworkId,
  encodeOrderCursor,
  decodeOrderCursor,
  escapeILike,
  PAGE_SIZE,
} from "@canoncore/utils";

/** Generate a URL-safe share token (21 chars, matching nanoid default). */
function generateShareToken(): string {
  return crypto.randomBytes(16).toString("base64url").slice(0, 21);
}

export const playlistRouter = createTRPCRouter({
  // ===========================================================================
  // QUERIES (protected, no rate limit)
  // ===========================================================================

  /**
   * List all playlists for the current user with item counts and preview artwork.
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    const playlists = await ctx.prisma.playlist.findMany({
      where: { userId: ctx.userId },
      orderBy: { order: "asc" },
      select: {
        id: true,
        name: true,
        description: true,
        order: true,
        isPublic: true,
        artworkMime: true,
        systemType: true,
        createdAt: true,
        updatedAt: true,
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

    return playlists.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      order: p.order,
      isPublic: p.isPublic,
      hasArtwork: !!p.artworkMime,
      itemCount: p._count.playlistItems,
      previewPosters: p.playlistItems.map((pi) => ({
        tmdbPosterPath: pi.item.tmdbPosterPath ?? null,
        artworkId: resolveArtworkId(pi.item),
      })),
      systemType: p.systemType,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));
  }),

  /**
   * Get a single playlist with all items. Owner only.
   */
  get: protectedProcedure
    .input(z.object({ playlistId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const playlist = await ctx.prisma.playlist.findFirst({
        where: { id: input.playlistId, userId: ctx.userId },
        select: {
          id: true,
          name: true,
          description: true,
          order: true,
          isPublic: true,
          artworkMime: true,
          shareToken: true,
          dominantColour: true,
          userId: true,
          createdAt: true,
          updatedAt: true,
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
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Playlist not found",
        });
      }

      return {
        id: playlist.id,
        name: playlist.name,
        description: playlist.description,
        order: playlist.order,
        isPublic: playlist.isPublic,
        hasArtwork: !!playlist.artworkMime,
        shareToken: playlist.shareToken ?? null,
        dominantColour: playlist.dominantColour ?? null,
        userId: playlist.userId,
        createdAt: playlist.createdAt,
        updatedAt: playlist.updatedAt,
        items: playlist.playlistItems.map((pi) => ({
          playlistItemId: pi.id,
          order: pi.order,
          addedAt: pi.addedAt,
          item: {
            ...pi.item,
            tmdbPosterPath: pi.item.tmdbPosterPath,
            tmdbBackdropPath: pi.item.tmdbBackdropPath,
            artworkId: resolveArtworkId(pi.item),
            fileCounts: {
              media: 0,
              artwork: pi.item.files.length,
              subtitles: 0,
            },
            childCount: 0,
            primaryMediaName: null,
            primaryDurationMs: null,
            primaryHeight: null,
            mediaIconType: null,
            progress: null,
          },
        })),
      };
    }),

  /**
   * Get which playlists contain a given item.
   * Used for the "Add to Playlist" dialog checkbox state.
   */
  getForItem: protectedProcedure
    .input(z.object({ itemId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const playlists = await ctx.prisma.playlist.findMany({
        where: { userId: ctx.userId },
        orderBy: { order: "asc" },
        select: {
          id: true,
          name: true,
          playlistItems: {
            where: { itemId: input.itemId },
            select: { id: true },
          },
        },
      });

      return playlists.map((p) => ({
        id: p.id,
        name: p.name,
        isMember: p.playlistItems.length > 0,
      }));
    }),

  // ===========================================================================
  // PUBLIC QUERIES (no auth required, no rate limit)
  // ===========================================================================

  /**
   * Get a public or unlisted playlist for viewing.
   * Public playlists: anyone can view.
   * Unlisted playlists: require a valid shareToken.
   * Private playlists: not accessible.
   */
  getPublic: publicProcedure
    .input(
      z.object({
        playlistId: z.string().min(1),
        shareToken: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const playlist = await ctx.prisma.playlist.findFirst({
        where: {
          id: input.playlistId,
          user: { isPublic: true, username: { not: null } },
        },
        select: {
          id: true,
          name: true,
          description: true,
          isPublic: true,
          artworkMime: true,
          shareToken: true,
          dominantColour: true,
          userId: true,
          createdAt: true,
          updatedAt: true,
          playlistItems: {
            where: { item: { isPublic: true } },
            orderBy: { order: "asc" },
            include: {
              item: {
                select: {
                  id: true,
                  name: true,
                  description: true,
                  tmdbId: true,
                  tmdbType: true,
                  tmdbPosterPath: true,
                  dominantColour: true,
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
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Playlist not found",
        });
      }

      // Access check: public OR valid share token
      const isAccessible =
        playlist.isPublic ||
        (input.shareToken && playlist.shareToken === input.shareToken);
      if (!isAccessible) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Playlist not found",
        });
      }

      // For public playlists, hide if no public items
      // For unlisted playlists, allow empty (owner shared intentionally)
      if (playlist.isPublic && playlist.playlistItems.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Playlist not found",
        });
      }

      return {
        playlist: {
          id: playlist.id,
          name: playlist.name,
          description: playlist.description,
          hasArtwork: !!playlist.artworkMime,
          dominantColour: playlist.dominantColour ?? null,
          createdAt: playlist.createdAt,
          userId: playlist.userId,
          itemCount: playlist.playlistItems.length,
          previewPosters: playlist.playlistItems.slice(0, 4).map((pi) => ({
            tmdbPosterPath: pi.item.tmdbPosterPath ?? null,
            artworkId: resolveArtworkId(pi.item),
          })),
          updatedAt: playlist.updatedAt,
        },
        items: playlist.playlistItems.map((pi) => ({
          id: pi.item.id,
          name: pi.item.name,
          description: pi.item.description,
          artworkId: resolveArtworkId(pi.item),
          tmdbPosterPath: pi.item.tmdbPosterPath,
          tmdbId: pi.item.tmdbId,
          tmdbType: pi.item.tmdbType,
          dominantColour: pi.item.dominantColour ?? null,
        })),
      };
    }),

  /**
   * Get playlists visible on a user's public profile.
   * Returns public playlists that contain at least one public item.
   * Cursor-based pagination using order|id.
   */
  getPlaylistsForProfile: publicProcedure
    .input(
      z.object({
        userId: z.string().min(1),
        cursor: z.string().nullish(),
        search: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const decoded = decodeOrderCursor(input.cursor ?? null);

      const playlists = await ctx.prisma.playlist.findMany({
        where: {
          userId: input.userId,
          isPublic: true,
          playlistItems: {
            some: {
              item: { isPublic: true },
            },
          },
          ...(input.search && {
            name: {
              contains: escapeILike(input.search),
              mode: "insensitive" as const,
            },
          }),
          ...(decoded && {
            OR: [
              { order: { gt: decoded.order } },
              {
                order: decoded.order,
                id: { gt: decoded.id },
              },
            ],
          }),
        },
        orderBy: [{ order: "asc" }, { id: "asc" }],
        take: PAGE_SIZE + 1,
        select: {
          id: true,
          name: true,
          description: true,
          order: true,
          artworkMime: true,
          updatedAt: true,
          playlistItems: {
            where: { item: { isPublic: true } },
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
          _count: {
            select: {
              playlistItems: {
                where: { item: { isPublic: true } },
              },
            },
          },
        },
      });

      const hasMore = playlists.length > PAGE_SIZE;
      const pagePlaylists = hasMore
        ? playlists.slice(0, PAGE_SIZE)
        : playlists;

      const items = pagePlaylists.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        hasArtwork: !!p.artworkMime,
        itemCount: p._count.playlistItems,
        previewPosters: p.playlistItems.map((pi) => ({
          tmdbPosterPath: pi.item.tmdbPosterPath ?? null,
          artworkId: resolveArtworkId(pi.item),
        })),
        updatedAt: p.updatedAt,
      }));

      const lastPlaylist = pagePlaylists[pagePlaylists.length - 1];
      const nextCursor =
        hasMore && lastPlaylist
          ? encodeOrderCursor(lastPlaylist.order, lastPlaylist.id)
          : null;

      return { items, nextCursor };
    }),

  // ===========================================================================
  // MUTATIONS (protected + rate limited)
  // ===========================================================================

  /**
   * Create a new playlist, optionally with initial items.
   */
  create: protectedProcedure
    .use(rateLimit("createPlaylist"))
    .input(
      z.object({
        name: playlistNameSchema,
        description: playlistDescriptionSchema.optional(),
        visibility: playlistVisibilitySchema,
        itemIds: createPlaylistItemsSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const isPublic = input.visibility === "public";
      const itemIds = input.itemIds ?? [];

      // Get next order value
      const maxOrder = await ctx.prisma.playlist.aggregate({
        where: { userId: ctx.userId },
        _max: { order: true },
      });
      const nextOrder = (maxOrder._max.order ?? -1) + 1;

      // Only generate share token for unlisted/public playlists
      const shareToken =
        input.visibility !== "private" ? generateShareToken() : null;

      if (itemIds.length > 0) {
        // Use transaction when creating playlist with items
        const playlist = await ctx.prisma.$transaction(async (tx) => {
          const pl = await tx.playlist.create({
            data: {
              name: input.name,
              order: nextOrder,
              userId: ctx.userId,
              description: input.description ?? null,
              isPublic,
              shareToken,
            },
          });

          // Verify all items belong to user
          const ownedCount = await tx.item.count({
            where: { id: { in: itemIds }, userId: ctx.userId },
          });
          if (ownedCount !== itemIds.length) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Some items do not belong to you",
            });
          }

          // Create PlaylistItem rows
          await tx.playlistItem.createMany({
            data: itemIds.map((itemId, index) => ({
              playlistId: pl.id,
              itemId,
              order: index,
            })),
          });

          return pl;
        });

        return { id: playlist.id, name: playlist.name };
      }

      // Simple creation without items
      const playlist = await ctx.prisma.playlist.create({
        data: {
          name: input.name,
          order: nextOrder,
          userId: ctx.userId,
          description: input.description ?? null,
          isPublic,
          shareToken,
        },
      });

      return { id: playlist.id, name: playlist.name };
    }),

  /**
   * Update a playlist's name and/or description.
   */
  update: protectedProcedure
    .use(rateLimit("updatePlaylist"))
    .input(
      z.object({
        id: z.string().min(1),
        name: playlistNameSchema.optional(),
        description: playlistDescriptionSchema.optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const playlist = await ctx.prisma.playlist.findFirst({
        where: { id: input.id, userId: ctx.userId },
        select: { id: true },
      });

      if (!playlist) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Playlist not found",
        });
      }

      const updateData: Record<string, unknown> = {};
      if (input.name !== undefined) {
        updateData.name = input.name;
      }
      if (input.description !== undefined) {
        updateData.description = input.description || null;
      }

      await ctx.prisma.playlist.update({
        where: { id: input.id },
        data: updateData,
      });

      return { success: true };
    }),

  /**
   * Delete a playlist. Cascades to PlaylistItem join records.
   */
  delete: protectedProcedure
    .use(rateLimit("deletePlaylist"))
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const playlist = await ctx.prisma.playlist.findFirst({
        where: { id: input.id, userId: ctx.userId },
        select: { id: true },
      });

      if (!playlist) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Playlist not found",
        });
      }

      await ctx.prisma.playlist.delete({ where: { id: input.id } });

      return { success: true };
    }),

  /**
   * Update a playlist's visibility (private/unlisted/public).
   * Generates a share token when switching to unlisted/public if none exists.
   */
  updateVisibility: protectedProcedure
    .use(rateLimit("updatePlaylist"))
    .input(
      z.object({
        id: z.string().min(1),
        visibility: z.enum(["private", "unlisted", "public"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const playlist = await ctx.prisma.playlist.findFirst({
        where: { id: input.id, userId: ctx.userId },
        select: { id: true, shareToken: true },
      });

      if (!playlist) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Playlist not found",
        });
      }

      const isPublic = input.visibility === "public";

      // Generate share token if moving to unlisted/public and none exists
      const needsToken =
        input.visibility !== "private" && !playlist.shareToken;
      const shareToken = needsToken ? generateShareToken() : undefined;

      await ctx.prisma.playlist.update({
        where: { id: input.id },
        data: {
          isPublic,
          ...(shareToken !== undefined && { shareToken }),
        },
      });

      return { success: true };
    }),

  /**
   * Regenerate the share token for a playlist.
   */
  regenerateShareToken: protectedProcedure
    .use(rateLimit("updatePlaylist"))
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const playlist = await ctx.prisma.playlist.findFirst({
        where: { id: input.id, userId: ctx.userId },
        select: { id: true },
      });

      if (!playlist) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Playlist not found",
        });
      }

      const token = generateShareToken();

      await ctx.prisma.playlist.update({
        where: { id: input.id },
        data: { shareToken: token },
      });

      return { shareToken: token };
    }),

  /**
   * Add an item to one or more playlists.
   * Idempotent: silently skips duplicates via skipDuplicates.
   */
  addItems: protectedProcedure
    .use(rateLimit("addToPlaylist"))
    .input(
      z.object({
        itemId: z.string().min(1),
        playlistIds: z.array(z.string().min(1)).min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify item ownership
      const item = await ctx.prisma.item.findFirst({
        where: { id: input.itemId, userId: ctx.userId },
        select: { id: true },
      });

      if (!item) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Item not found",
        });
      }

      // Verify all playlists belong to user
      const playlists = await ctx.prisma.playlist.findMany({
        where: { id: { in: input.playlistIds }, userId: ctx.userId },
        select: { id: true },
      });

      if (playlists.length !== input.playlistIds.length) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "One or more playlists not found",
        });
      }

      // Get max order for each playlist in parallel
      const maxOrders = await Promise.all(
        input.playlistIds.map((playlistId) =>
          ctx.prisma.playlistItem.aggregate({
            where: { playlistId },
            _max: { order: true },
          })
        )
      );

      const createData = input.playlistIds.map((playlistId, i) => ({
        playlistId,
        itemId: input.itemId,
        order: (maxOrders[i]._max.order ?? -1) + 1,
      }));

      await ctx.prisma.playlistItem.createMany({
        data: createData,
        skipDuplicates: true,
      });

      return { success: true };
    }),

  /**
   * Remove a single item from a playlist.
   */
  removeItem: protectedProcedure
    .use(rateLimit("removeFromPlaylist"))
    .input(
      z.object({
        playlistId: z.string().min(1),
        itemId: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const playlist = await ctx.prisma.playlist.findFirst({
        where: { id: input.playlistId, userId: ctx.userId },
        select: { id: true },
      });

      if (!playlist) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Playlist not found",
        });
      }

      await ctx.prisma.playlistItem.deleteMany({
        where: { playlistId: input.playlistId, itemId: input.itemId },
      });

      return { success: true };
    }),

  /**
   * Bulk remove items from a playlist.
   */
  removeItems: protectedProcedure
    .use(rateLimit("removeFromPlaylist"))
    .input(
      z.object({
        playlistId: z.string().min(1),
        itemIds: z.array(z.string().min(1)).min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const playlist = await ctx.prisma.playlist.findFirst({
        where: { id: input.playlistId, userId: ctx.userId },
        select: { id: true },
      });

      if (!playlist) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Playlist not found",
        });
      }

      await ctx.prisma.playlistItem.deleteMany({
        where: {
          playlistId: input.playlistId,
          itemId: { in: input.itemIds },
        },
      });

      return { success: true };
    }),

  /**
   * Reorder items within a playlist.
   * Takes an array of PlaylistItem IDs in desired order.
   */
  reorderItems: protectedProcedure
    .use(rateLimit("reorderPlaylist"))
    .input(
      z.object({
        playlistId: z.string().min(1),
        orderedItemIds: z.array(z.string().min(1)).min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const playlist = await ctx.prisma.playlist.findFirst({
        where: { id: input.playlistId, userId: ctx.userId },
        select: { id: true },
      });

      if (!playlist) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Playlist not found",
        });
      }

      await ctx.prisma.$transaction(
        input.orderedItemIds.map((id, index) =>
          ctx.prisma.playlistItem.updateMany({
            where: { id, playlistId: input.playlistId },
            data: { order: index },
          })
        )
      );

      return { success: true };
    }),
});
