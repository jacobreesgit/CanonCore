import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, publicProcedure } from "../trpc";
import { rateLimit } from "../middleware/rate-limit";
import { isItemFullyPublic } from "../helpers/visibility";
import {
  decodeCursor,
  decodeOrderCursor,
  encodeCursor,
  encodeOrderCursor,
  escapeILike,
  PAGE_SIZE,
  resolveArtworkId,
} from "@canoncore/utils";

export const publicRouter = createTRPCRouter({
  /**
   * Gets a public user profile by username.
   * Returns null-safe fields only. Throws NOT_FOUND if profile is not public.
   */
  getProfile: publicProcedure
    .input(z.object({ username: z.string() }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.findFirst({
        where: {
          username: {
            equals: input.username,
            mode: "insensitive",
          },
          isPublic: true,
        },
        select: {
          id: true,
          username: true,
          name: true,
          image: true,
          heroImage: true,
          dominantColour: true,
          bio: true,
          createdAt: true,
        },
      });

      if (!user || !user.username) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Profile not found",
        });
      }

      return {
        id: user.id,
        username: user.username,
        name: user.name,
        hasImage: user.image !== null,
        hasHeroImage: user.heroImage !== null,
        dominantColour: user.dominantColour ?? null,
        bio: user.bio ?? null,
        createdAt: user.createdAt,
      };
    }),

  /**
   * Gets paginated public root-level items for a user's profile.
   * Uses cursor-based pagination (updatedAt|id).
   * Includes progress data when the viewer is the owner, and fork status for other viewers.
   */
  getProfileItems: publicProcedure
    .input(
      z.object({
        userId: z.string(),
        cursor: z.string().nullish(),
        search: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { userId, cursor, search } = input;
      const currentUserId = ctx.userId;
      const decoded = decodeCursor(cursor);

      const items = await ctx.prisma.item.findMany({
        where: {
          userId,
          parentId: null,
          isPublic: true,
          inheritVisibility: false,
          ...(search && {
            name: {
              contains: escapeILike(search),
              mode: "insensitive" as const,
            },
          }),
          ...(decoded && {
            OR: [
              { updatedAt: { lt: decoded.updatedAt } },
              {
                updatedAt: decoded.updatedAt,
                id: { lt: decoded.id },
              },
            ],
          }),
        },
        select: {
          id: true,
          name: true,
          description: true,
          parentId: true,
          depth: true,
          order: true,
          userId: true,
          tmdbId: true,
          tmdbType: true,
          tmdbPosterPath: true,
          tmdbBackdropPath: true,
          tmdbLogoPath: true,
          dominantColour: true,
          tmdbShowTagline: true,
          tmdbShowMetadata: true,
          tmdbShowGenres: true,
          tmdbShowCast: true,
          tmdbShowProviders: true,
          tmdbShowVideos: true,
          tmdbShowRecommendations: true,
          updatedAt: true,
          pinnedOrder: true,
          files: {
            select: { id: true, fileType: true, isPrimary: true },
            orderBy: { isPrimary: "desc" },
          },
          _count: {
            select: { sourceForks: true },
          },
        },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        take: PAGE_SIZE + 1,
      });

      const hasMore = items.length > PAGE_SIZE;
      const pageItems = hasMore ? items.slice(0, PAGE_SIZE) : items;

      // Progress for own profile
      const isOwnProfile = currentUserId && currentUserId === userId;
      interface ProgressData {
        percentage: number | null;
        watchedItems: number;
        itemsWithMedia: number;
        totalItems: number;
      }
      const progressMap = new Map<string, ProgressData>();

      if (isOwnProfile && pageItems.length > 0) {
        const itemIds = pageItems.map((i) => i.id);
        const progressData = await ctx.prisma.$queryRaw<
          Array<{
            rootItemId: string;
            totalItems: bigint;
            itemsWithMedia: bigint;
            watchedItems: bigint;
          }>
        >`
          WITH RECURSIVE descendants AS (
            SELECT id, id as "rootItemId" FROM "Item"
            WHERE id = ANY(${itemIds}) AND "userId" = ${currentUserId}
            UNION ALL
            SELECT i.id, d."rootItemId"
            FROM "Item" i
            INNER JOIN descendants d ON i."parentId" = d.id
            WHERE i."userId" = ${currentUserId}
          )
          SELECT
            d."rootItemId",
            COUNT(DISTINCT d.id) as "totalItems",
            COUNT(DISTINCT CASE WHEN f.id IS NOT NULL THEN d.id END) as "itemsWithMedia",
            COUNT(DISTINCT CASE
              WHEN EXISTS(
                SELECT 1 FROM "WatchRecord" wr
                WHERE wr."itemId" = d.id AND wr."userId" = ${currentUserId}
              )
              THEN d.id
            END) as "watchedItems"
          FROM descendants d
          LEFT JOIN "ItemFile" f ON f."itemId" = d.id
            AND f."fileType" = 'MEDIA'
            AND f."isPrimary" = true
          GROUP BY d."rootItemId"
        `;

        for (const row of progressData) {
          const totalItems = Number(row.totalItems);
          const itemsWithMedia = Number(row.itemsWithMedia);
          const watchedItems = Number(row.watchedItems);
          const percentage =
            itemsWithMedia > 0
              ? Math.round((watchedItems / itemsWithMedia) * 100)
              : null;
          progressMap.set(row.rootItemId, {
            percentage,
            watchedItems,
            itemsWithMedia,
            totalItems,
          });
        }
      }

      // Fork status for non-owner viewers
      const shouldCheckForks = currentUserId && !isOwnProfile;
      const forkedItemIds = new Set<string>();
      if (shouldCheckForks && pageItems.length > 0) {
        const itemIds = pageItems.map((i) => i.id);
        const forkResults = await ctx.prisma.fork.findMany({
          where: {
            userId: currentUserId,
            sourceItemId: { in: itemIds },
          },
          select: { sourceItemId: true },
        });
        for (const f of forkResults) {
          forkedItemIds.add(f.sourceItemId);
        }
      }

      const mappedItems = pageItems.map((item) => {
        const progress = isOwnProfile ? progressMap.get(item.id) : undefined;
        return {
          id: item.id,
          name: item.name,
          description: item.description,
          parentId: item.parentId,
          depth: item.depth,
          order: item.order,
          userId: item.userId,
          tmdbPosterPath: item.tmdbPosterPath ?? null,
          tmdbBackdropPath: item.tmdbBackdropPath ?? null,
          tmdbLogoPath: item.tmdbLogoPath ?? null,
          dominantColour: item.dominantColour ?? null,
          artworkId: resolveArtworkId(item),
          tmdbId: item.tmdbId,
          tmdbType: item.tmdbType,
          tmdbShowTagline: item.tmdbShowTagline,
          tmdbShowMetadata: item.tmdbShowMetadata,
          tmdbShowGenres: item.tmdbShowGenres,
          tmdbShowCast: item.tmdbShowCast,
          tmdbShowProviders: item.tmdbShowProviders,
          tmdbShowVideos: item.tmdbShowVideos,
          tmdbShowRecommendations: item.tmdbShowRecommendations,
          forkCount: item._count.sourceForks,
          updatedAt: item.updatedAt,
          pinnedOrder: item.pinnedOrder,
          fileCounts: {
            media: item.files.filter((f) => f.fileType === "MEDIA").length,
            artwork: item.files.filter((f) => f.fileType === "ARTWORK").length,
            subtitles: item.files.filter((f) => f.fileType === "SUBTITLE")
              .length,
          },
          ...(isOwnProfile && {
            progressPercentage: progress?.percentage ?? null,
            watchedCount: progress?.watchedItems ?? 0,
            totalMediaCount: progress?.itemsWithMedia ?? 0,
            totalItems: progress?.totalItems ?? 0,
          }),
          isForkedByCurrentUser: forkedItemIds.has(item.id),
        };
      });

      const lastItem = pageItems[pageItems.length - 1];
      const nextCursor =
        hasMore && lastItem
          ? encodeCursor(lastItem.updatedAt, lastItem.id)
          : null;

      return { items: mappedItems, nextCursor };
    }),

  /**
   * Gets effectively public child items of a parent item.
   * Verifies parent is fully public before returning children.
   * Returns children ordered by their manual sort order.
   */
  getProfileItemChildren: publicProcedure
    .input(
      z.object({
        parentId: z.string(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const { parentId, limit, offset } = input;

      // CR-2: Verify parent is actually public before returning inheriting children
      const parentIsPublic = await isItemFullyPublic(ctx.prisma, parentId);
      if (!parentIsPublic) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Item not found",
        });
      }

      const items = await ctx.prisma.item.findMany({
        where: {
          parentId,
          OR: [
            { inheritVisibility: false, isPublic: true },
            { inheritVisibility: true },
          ],
        },
        select: {
          id: true,
          name: true,
          description: true,
          parentId: true,
          depth: true,
          order: true,
          userId: true,
          tmdbId: true,
          tmdbType: true,
          tmdbPosterPath: true,
          tmdbBackdropPath: true,
          tmdbLogoPath: true,
          dominantColour: true,
          tmdbShowTagline: true,
          tmdbShowMetadata: true,
          tmdbShowGenres: true,
          tmdbShowCast: true,
          tmdbShowProviders: true,
          tmdbShowVideos: true,
          tmdbShowRecommendations: true,
          updatedAt: true,
          pinnedOrder: true,
          files: {
            select: { id: true, fileType: true, isPrimary: true },
            orderBy: { isPrimary: "desc" },
          },
          _count: {
            select: { sourceForks: true },
          },
        },
        orderBy: { order: "asc" },
        take: limit,
        skip: offset,
      });

      return items.map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        parentId: item.parentId,
        depth: item.depth,
        order: item.order,
        userId: item.userId,
        tmdbPosterPath: item.tmdbPosterPath ?? null,
        tmdbBackdropPath: item.tmdbBackdropPath ?? null,
        tmdbLogoPath: item.tmdbLogoPath ?? null,
        dominantColour: item.dominantColour ?? null,
        artworkId: resolveArtworkId(item),
        tmdbId: item.tmdbId,
        tmdbType: item.tmdbType,
        tmdbShowTagline: item.tmdbShowTagline,
        tmdbShowMetadata: item.tmdbShowMetadata,
        tmdbShowGenres: item.tmdbShowGenres,
        tmdbShowCast: item.tmdbShowCast,
        tmdbShowProviders: item.tmdbShowProviders,
        tmdbShowVideos: item.tmdbShowVideos,
        tmdbShowRecommendations: item.tmdbShowRecommendations,
        forkCount: item._count.sourceForks,
        updatedAt: item.updatedAt,
        pinnedOrder: item.pinnedOrder,
        fileCounts: {
          media: item.files.filter((f) => f.fileType === "MEDIA").length,
          artwork: item.files.filter((f) => f.fileType === "ARTWORK").length,
          subtitles: item.files.filter((f) => f.fileType === "SUBTITLE")
            .length,
        },
      }));
    }),

  /**
   * Gets full detail for a public item.
   * Verifies the item is fully public (including ancestor chain).
   */
  getItemDetail: publicProcedure
    .input(z.object({ itemId: z.string() }))
    .query(async ({ ctx, input }) => {
      const isPublic = await isItemFullyPublic(ctx.prisma, input.itemId);
      if (!isPublic) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Item not found",
        });
      }

      const item = await ctx.prisma.item.findUnique({
        where: { id: input.itemId },
        select: {
          id: true,
          name: true,
          description: true,
          parentId: true,
          depth: true,
          order: true,
          userId: true,
          tmdbId: true,
          tmdbType: true,
          tmdbPosterPath: true,
          tmdbBackdropPath: true,
          tmdbLogoPath: true,
          dominantColour: true,
          tmdbShowTagline: true,
          tmdbShowMetadata: true,
          tmdbShowGenres: true,
          tmdbShowCast: true,
          tmdbShowProviders: true,
          tmdbShowVideos: true,
          tmdbShowRecommendations: true,
          updatedAt: true,
          pinnedOrder: true,
          files: {
            select: { id: true, fileType: true, isPrimary: true },
            orderBy: { isPrimary: "desc" },
          },
          _count: {
            select: { sourceForks: true },
          },
        },
      });

      if (!item) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Item not found",
        });
      }

      return {
        id: item.id,
        name: item.name,
        description: item.description,
        parentId: item.parentId,
        depth: item.depth,
        order: item.order,
        userId: item.userId,
        tmdbPosterPath: item.tmdbPosterPath ?? null,
        tmdbBackdropPath: item.tmdbBackdropPath ?? null,
        tmdbLogoPath: item.tmdbLogoPath ?? null,
        dominantColour: item.dominantColour ?? null,
        artworkId: resolveArtworkId(item),
        tmdbId: item.tmdbId,
        tmdbType: item.tmdbType,
        tmdbShowTagline: item.tmdbShowTagline,
        tmdbShowMetadata: item.tmdbShowMetadata,
        tmdbShowGenres: item.tmdbShowGenres,
        tmdbShowCast: item.tmdbShowCast,
        tmdbShowProviders: item.tmdbShowProviders,
        tmdbShowVideos: item.tmdbShowVideos,
        tmdbShowRecommendations: item.tmdbShowRecommendations,
        forkCount: item._count.sourceForks,
        updatedAt: item.updatedAt,
        pinnedOrder: item.pinnedOrder,
        fileCounts: {
          media: item.files.filter((f) => f.fileType === "MEDIA").length,
          artwork: item.files.filter((f) => f.fileType === "ARTWORK").length,
          subtitles: item.files.filter((f) => f.fileType === "SUBTITLE")
            .length,
        },
      };
    }),

  /**
   * Gets paginated public playlists for a user's profile.
   * Uses cursor-based pagination (order|id) to preserve the owner's custom ordering.
   * Only returns public playlists that contain at least one public item.
   */
  getProfilePlaylists: publicProcedure
    .input(
      z.object({
        userId: z.string(),
        cursor: z.string().nullish(),
        search: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { userId, cursor, search } = input;
      const decoded = decodeOrderCursor(cursor);

      const playlists = await ctx.prisma.playlist.findMany({
        where: {
          userId,
          isPublic: true,
          playlistItems: {
            some: {
              item: { isPublic: true },
            },
          },
          ...(search && {
            name: {
              contains: escapeILike(search),
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

      const mappedPlaylists = pagePlaylists.map((p) => ({
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

      return { items: mappedPlaylists, nextCursor };
    }),

  /**
   * Gets a public or unlisted playlist with its public items.
   * Supports share token access for unlisted playlists.
   * Returns null if playlist is not accessible or owner profile is not public.
   */
  getPlaylistDetail: publicProcedure
    .input(
      z.object({
        playlistId: z.string(),
        token: z.string().nullish(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { playlistId, token } = input;

      const playlist = await ctx.prisma.playlist.findFirst({
        where: {
          id: playlistId,
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
        playlist.isPublic || (token && playlist.shareToken === token);
      if (!isAccessible) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Playlist not found",
        });
      }

      // For public playlists, hide if no public items
      // For unlisted playlists with share token, allow empty
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
});
