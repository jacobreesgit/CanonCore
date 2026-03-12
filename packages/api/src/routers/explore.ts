import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";
import { rateLimit } from "../middleware/rate-limit";
import {
  decodeCursor,
  encodeCursor,
  escapeILike,
  PAGE_SIZE,
  resolveArtworkId,
} from "@canoncore/utils";

export const exploreRouter = createTRPCRouter({
  /**
   * Fetches publicly-visible items for the Explore page.
   * Returns items from all public users, sorted by updatedAt DESC.
   * Includes owner info, progress data for the viewer's own items,
   * and fork status for authenticated viewers.
   */
  getItems: publicProcedure
    .use(rateLimit("explore"))
    .input(
      z
        .object({
          cursor: z.string().nullish(),
          search: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const cursor = input?.cursor;
      const search = input?.search;
      const currentUserId = ctx.userId;
      const decoded = decodeCursor(cursor);

      const items = await ctx.prisma.item.findMany({
        where: {
          isPublic: true,
          inheritVisibility: false,
          user: {
            isPublic: true,
            username: { not: null },
          },
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
          user: {
            select: { username: true, name: true, id: true },
          },
        },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        take: PAGE_SIZE + 1,
      });

      const hasMore = items.length > PAGE_SIZE;
      const pageItems = hasMore ? items.slice(0, PAGE_SIZE) : items;

      // Calculate progress for current user's own items
      const ownItemIds = currentUserId
        ? pageItems
            .filter((i) => i.userId === currentUserId)
            .map((i) => i.id)
        : [];

      interface ProgressData {
        percentage: number | null;
        watchedItems: number;
        itemsWithMedia: number;
        totalItems: number;
      }
      const progressMap = new Map<string, ProgressData>();

      if (ownItemIds.length > 0 && currentUserId) {
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
            WHERE id = ANY(${ownItemIds}) AND "userId" = ${currentUserId}
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

      // Check fork status for authenticated viewers
      const forkedSourceIds = new Set<string>();
      if (currentUserId) {
        const forks = await ctx.prisma.fork.findMany({
          where: {
            userId: currentUserId,
            sourceItemId: { in: pageItems.map((i) => i.id) },
          },
          select: { sourceItemId: true },
        });
        for (const fork of forks) {
          forkedSourceIds.add(fork.sourceItemId);
        }
      }

      const mappedItems = pageItems
        .filter((item) => item.user && item.user.username != null)
        .map((item) => {
          const isOwnItem = currentUserId && item.userId === currentUserId;
          const progress = isOwnItem ? progressMap.get(item.id) : undefined;
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
              artwork: item.files.filter((f) => f.fileType === "ARTWORK")
                .length,
              subtitles: item.files.filter((f) => f.fileType === "SUBTITLE")
                .length,
            },
            ownerUsername: item.user.username!,
            ownerName: item.user.name,
            ...(isOwnItem && {
              progressPercentage: progress?.percentage ?? null,
              watchedCount: progress?.watchedItems ?? 0,
              totalMediaCount: progress?.itemsWithMedia ?? 0,
              totalItems: progress?.totalItems ?? 0,
            }),
            isForkedByCurrentUser: forkedSourceIds.has(item.id),
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
   * Fetches publicly-visible playlists for the Explore page.
   * Returns playlists from all public users that contain at least one public item.
   * Uses cursor-based pagination (updatedAt|id).
   */
  getPlaylists: publicProcedure
    .use(rateLimit("explore"))
    .input(
      z
        .object({
          cursor: z.string().nullish(),
          search: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const cursor = input?.cursor;
      const search = input?.search;
      const decoded = decodeCursor(cursor);

      const playlists = await ctx.prisma.playlist.findMany({
        where: {
          isPublic: true,
          user: {
            isPublic: true,
            username: { not: null },
          },
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
              { updatedAt: { lt: decoded.updatedAt } },
              {
                updatedAt: decoded.updatedAt,
                id: { lt: decoded.id },
              },
            ],
          }),
        },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        take: PAGE_SIZE + 1,
        select: {
          id: true,
          name: true,
          description: true,
          artworkMime: true,
          updatedAt: true,
          user: {
            select: {
              username: true,
              name: true,
            },
          },
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

      const mappedPlaylists = pagePlaylists
        .filter((p) => p.user.username != null)
        .map((p) => ({
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
          ownerUsername: p.user.username as string,
          ownerName: p.user.name,
        }));

      const lastPlaylist = pagePlaylists[pagePlaylists.length - 1];
      const nextCursor =
        hasMore && lastPlaylist
          ? encodeCursor(lastPlaylist.updatedAt, lastPlaylist.id)
          : null;

      return { items: mappedPlaylists, nextCursor };
    }),
});
