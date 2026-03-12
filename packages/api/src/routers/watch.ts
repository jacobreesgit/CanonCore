import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { rateLimit } from "../middleware/rate-limit";

/** Deduplication window in milliseconds (5 minutes). */
const DEDUP_WINDOW_MS = 5 * 60 * 1000;

export const watchRouter = createTRPCRouter({
  /**
   * Creates a WatchRecord for an item.
   * Deduplicates within a 5-minute window to prevent rapid duplicate scrobbles.
   */
  create: protectedProcedure
    .use(rateLimit("watch"))
    .input(
      z.object({
        itemId: z.string(),
        source: z.enum(["AUTO", "MANUAL"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const item = await ctx.prisma.item.findUnique({
        where: { id: input.itemId },
        select: { userId: true },
      });

      if (!item) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Item not found" });
      }
      if (item.userId !== ctx.userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }

      // Deduplicate within 5-minute window
      const dedupCutoff = new Date(Date.now() - DEDUP_WINDOW_MS);
      const recent = await ctx.prisma.watchRecord.findFirst({
        where: {
          itemId: input.itemId,
          userId: ctx.userId,
          watchedAt: { gte: dedupCutoff },
        },
        orderBy: { watchedAt: "desc" },
      });

      if (!recent) {
        await ctx.prisma.watchRecord.create({
          data: {
            itemId: input.itemId,
            userId: ctx.userId,
            source: input.source,
          },
        });
      }

      return { success: true };
    }),

  /**
   * Manually marks an item as watched.
   */
  markWatched: protectedProcedure
    .use(rateLimit("watch"))
    .input(z.object({ itemId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const item = await ctx.prisma.item.findUnique({
        where: { id: input.itemId },
        select: { userId: true },
      });

      if (!item) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Item not found" });
      }
      if (item.userId !== ctx.userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }

      // Deduplicate within 5-minute window
      const dedupCutoff = new Date(Date.now() - DEDUP_WINDOW_MS);
      const recent = await ctx.prisma.watchRecord.findFirst({
        where: {
          itemId: input.itemId,
          userId: ctx.userId,
          watchedAt: { gte: dedupCutoff },
        },
        orderBy: { watchedAt: "desc" },
      });

      if (!recent) {
        await ctx.prisma.watchRecord.create({
          data: {
            itemId: input.itemId,
            userId: ctx.userId,
            source: "MANUAL",
          },
        });
      }

      return { success: true };
    }),

  /**
   * Removes the most recent WatchRecord for an item.
   */
  markUnwatched: protectedProcedure
    .use(rateLimit("watch"))
    .input(z.object({ itemId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const item = await ctx.prisma.item.findUnique({
        where: { id: input.itemId },
        select: { userId: true },
      });

      if (!item) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Item not found" });
      }
      if (item.userId !== ctx.userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }

      const mostRecent = await ctx.prisma.watchRecord.findFirst({
        where: { itemId: input.itemId, userId: ctx.userId },
        orderBy: { watchedAt: "desc" },
      });

      if (!mostRecent) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No watch record to remove",
        });
      }

      await ctx.prisma.watchRecord.delete({ where: { id: mostRecent.id } });

      return { success: true };
    }),

  /**
   * Gets watch status for an item (play count + watched flag).
   * No rate limiting — read-only query, auth check sufficient.
   */
  getStatus: protectedProcedure
    .input(z.object({ itemId: z.string() }))
    .query(async ({ ctx, input }) => {
      const item = await ctx.prisma.item.findUnique({
        where: { id: input.itemId },
        select: { userId: true },
      });

      if (!item) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Item not found" });
      }
      if (item.userId !== ctx.userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }

      const playCount = await ctx.prisma.watchRecord.count({
        where: { itemId: input.itemId, userId: ctx.userId },
      });

      return { isWatched: playCount > 0, playCount };
    }),

  /**
   * Marks item and all descendants as watched.
   * Only includes items with primary media (containers are skipped).
   */
  markAllWatched: protectedProcedure
    .use(rateLimit("watch"))
    .input(z.object({ parentItemId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const item = await ctx.prisma.item.findUnique({
        where: { id: input.parentItemId },
        select: { userId: true },
      });

      if (!item) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Item not found" });
      }
      if (item.userId !== ctx.userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }

      const descendants = await ctx.prisma.$queryRaw<Array<{ id: string }>>`
        WITH RECURSIVE descendants AS (
          SELECT id FROM "Item" WHERE id = ${input.parentItemId} AND "userId" = ${ctx.userId}
          UNION ALL
          SELECT i.id FROM "Item" i
          INNER JOIN descendants d ON i."parentId" = d.id
          WHERE i."userId" = ${ctx.userId}
        )
        SELECT d.id FROM descendants d
        WHERE EXISTS (
          SELECT 1 FROM "ItemFile" f
          WHERE f."itemId" = d.id AND f."fileType" = 'MEDIA' AND f."isPrimary" = true
        )
        AND NOT EXISTS (
          SELECT 1 FROM "WatchRecord" wr
          WHERE wr."itemId" = d.id AND wr."userId" = ${ctx.userId}
        )
      `;

      if (descendants.length > 0) {
        await ctx.prisma.watchRecord.createMany({
          data: descendants.map((d) => ({
            itemId: d.id,
            userId: ctx.userId,
            source: "MANUAL" as const,
          })),
        });
      }

      return { success: true };
    }),

  /**
   * Batch removes all WatchRecords for descendant items.
   */
  markAllUnwatched: protectedProcedure
    .use(rateLimit("watch"))
    .input(z.object({ parentItemId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const item = await ctx.prisma.item.findUnique({
        where: { id: input.parentItemId },
        select: { userId: true },
      });

      if (!item) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Item not found" });
      }
      if (item.userId !== ctx.userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }

      const descendantIds = await ctx.prisma.$queryRaw<Array<{ id: string }>>`
        WITH RECURSIVE descendants AS (
          SELECT id FROM "Item" WHERE id = ${input.parentItemId} AND "userId" = ${ctx.userId}
          UNION ALL
          SELECT i.id FROM "Item" i
          INNER JOIN descendants d ON i."parentId" = d.id
          WHERE i."userId" = ${ctx.userId}
        )
        SELECT d.id FROM descendants d
      `;

      if (descendantIds.length > 0) {
        await ctx.prisma.watchRecord.deleteMany({
          where: {
            itemId: { in: descendantIds.map((d) => d.id) },
            userId: ctx.userId,
          },
        });
      }

      return { success: true };
    }),
});
