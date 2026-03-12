import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { rateLimit } from "../middleware/rate-limit";
import { ensureSystemPlaylists } from "../helpers/system-playlists";
import {
  getSystemShelfItems,
  getUserPlaylistShelfItems,
} from "../helpers/shelf-queries";

export const shelfRouter = createTRPCRouter({
  /**
   * Returns all user playlists with their shelf status for the settings UI.
   * No rate limiting — read-only settings query, auth check sufficient.
   */
  getConfig: protectedProcedure.query(async ({ ctx }) => {
    const playlists = await ctx.prisma.playlist.findMany({
      where: { userId: ctx.userId },
      select: { id: true, name: true, systemType: true, shelfOrder: true },
      orderBy: [{ shelfOrder: "asc" }, { name: "asc" }],
    });

    return playlists.map((p) => ({
      playlistId: p.id,
      name: p.name,
      systemType: p.systemType,
      shelfOrder: p.shelfOrder,
    }));
  }),

  /**
   * Adds a playlist as a shelf. Assigns the next available shelfOrder.
   */
  add: protectedProcedure
    .use(rateLimit("shelf"))
    .input(z.object({ playlistId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const playlist = await ctx.prisma.playlist.findFirst({
        where: { id: input.playlistId, userId: ctx.userId },
      });
      if (!playlist) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Playlist not found",
        });
      }

      const existing = await ctx.prisma.playlist.findMany({
        where: { userId: ctx.userId, shelfOrder: { not: null } },
        select: { shelfOrder: true },
        orderBy: { shelfOrder: "desc" },
        take: 1,
      });

      const nextOrder = (existing[0]?.shelfOrder ?? 0) + 1;

      await ctx.prisma.playlist.update({
        where: { id: input.playlistId },
        data: { shelfOrder: nextOrder },
      });

      return { success: true };
    }),

  /**
   * Removes a playlist from shelves by setting shelfOrder to null.
   */
  remove: protectedProcedure
    .use(rateLimit("shelf"))
    .input(z.object({ playlistId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const playlist = await ctx.prisma.playlist.findFirst({
        where: { id: input.playlistId, userId: ctx.userId },
      });
      if (!playlist) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Playlist not found",
        });
      }

      await ctx.prisma.playlist.update({
        where: { id: input.playlistId },
        data: { shelfOrder: null },
      });

      return { success: true };
    }),

  /**
   * Reorders shelves. Accepts an ordered array of playlist IDs.
   * Sets shelfOrder = index + 1 for each.
   */
  reorder: protectedProcedure
    .use(rateLimit("shelf"))
    .input(
      z.object({
        orderedPlaylistIds: z.array(z.string()).min(1).max(20),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userPlaylists = await ctx.prisma.playlist.findMany({
        where: {
          userId: ctx.userId,
          id: { in: input.orderedPlaylistIds },
        },
        select: { id: true },
      });

      const validIds = new Set(userPlaylists.map((p) => p.id));
      if (input.orderedPlaylistIds.some((id) => !validIds.has(id))) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "One or more playlists not found",
        });
      }

      await ctx.prisma.$transaction(
        input.orderedPlaylistIds.map((id, index) =>
          ctx.prisma.playlist.update({
            where: { id, userId: ctx.userId },
            data: { shelfOrder: index + 1 },
          })
        )
      );

      return { success: true };
    }),

  /**
   * Fetches all home shelves for the authenticated user.
   * Ensures system playlists exist, resolves items for each shelf,
   * and filters out empty shelves.
   */
  getHomeShelves: protectedProcedure.query(async ({ ctx }) => {
    await ensureSystemPlaylists(ctx.prisma, ctx.userId);

    const shelfPlaylists = await ctx.prisma.playlist.findMany({
      where: { userId: ctx.userId, shelfOrder: { not: null } },
      select: { id: true, name: true, systemType: true, shelfOrder: true },
      orderBy: { shelfOrder: "asc" },
    });

    const shelfResults = await Promise.all(
      shelfPlaylists.map(async (playlist) => {
        const items = playlist.systemType
          ? await getSystemShelfItems(
              ctx.prisma,
              ctx.userId,
              playlist.systemType
            )
          : await getUserPlaylistShelfItems(ctx.prisma, playlist.id);

        return {
          playlistId: playlist.id,
          type: playlist.systemType,
          name: playlist.name,
          items,
        };
      })
    );

    return shelfResults.filter((s) => s.items.length > 0);
  }),
});
