import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "../trpc";
import { rateLimit } from "../middleware/rate-limit";
import { isItemFullyPublic } from "../helpers/visibility";

export const forkRouter = createTRPCRouter({
  /**
   * Forks a public item into the user's library.
   * Creates a shallow copy (metadata only, no files) with reference to original.
   */
  fork: protectedProcedure
    .use(rateLimit("fork"))
    .input(
      z.object({
        sourceItemId: z.string(),
        parentId: z.string().nullable().default(null),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const sourceItem = await ctx.prisma.item.findUnique({
        where: { id: input.sourceItemId },
        select: {
          id: true,
          name: true,
          description: true,
          userId: true,
          tmdbId: true,
          tmdbType: true,
          tmdbShowTagline: true,
          tmdbShowMetadata: true,
          tmdbShowGenres: true,
          tmdbShowCast: true,
          tmdbShowProviders: true,
          tmdbShowVideos: true,
          tmdbShowRecommendations: true,
        },
      });

      if (!sourceItem) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Item not found" });
      }

      if (sourceItem.userId === ctx.userId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot fork your own items",
        });
      }

      const [isPublic, existingFork] = await Promise.all([
        isItemFullyPublic(ctx.prisma, input.sourceItemId),
        ctx.prisma.fork.findUnique({
          where: {
            sourceItemId_userId: {
              sourceItemId: input.sourceItemId,
              userId: ctx.userId,
            },
          },
          select: { targetItemId: true },
        }),
      ]);

      if (!isPublic) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Item is not publicly accessible",
        });
      }

      if (existingFork) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "You have already forked this item",
        });
      }

      // Validate parent if specified
      let depth = 0;
      if (input.parentId) {
        const parent = await ctx.prisma.item.findUnique({
          where: { id: input.parentId, userId: ctx.userId },
          select: { depth: true },
        });

        if (!parent) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Parent folder not found",
          });
        }

        depth = parent.depth + 1;
        if (depth >= 10) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Maximum nesting depth reached",
          });
        }
      }

      // Get max order for placement
      const maxOrderItem = await ctx.prisma.item.findFirst({
        where: { userId: ctx.userId, parentId: input.parentId },
        orderBy: { order: "desc" },
        select: { order: true },
      });
      const order = (maxOrderItem?.order ?? -1) + 1;

      // Create forked item and Fork record in transaction
      const result = await ctx.prisma.$transaction(async (tx) => {
        const forkedItem = await tx.item.create({
          data: {
            name: sourceItem.name,
            description: sourceItem.description,
            parentId: input.parentId,
            depth,
            order,
            userId: ctx.userId,
            forkedFromId: input.sourceItemId,
            tmdbId: sourceItem.tmdbId,
            tmdbType: sourceItem.tmdbType,
            tmdbShowTagline: sourceItem.tmdbShowTagline,
            tmdbShowMetadata: sourceItem.tmdbShowMetadata,
            tmdbShowGenres: sourceItem.tmdbShowGenres,
            tmdbShowCast: sourceItem.tmdbShowCast,
            tmdbShowProviders: sourceItem.tmdbShowProviders,
            tmdbShowVideos: sourceItem.tmdbShowVideos,
            tmdbShowRecommendations: sourceItem.tmdbShowRecommendations,
            isPublic: false,
            inheritVisibility: false,
          },
        });

        await tx.fork.create({
          data: {
            sourceItemId: input.sourceItemId,
            targetItemId: forkedItem.id,
            userId: ctx.userId,
          },
        });

        return forkedItem;
      });

      return { itemId: result.id, name: result.name };
    }),

  /**
   * Gets fork status for a user and item.
   */
  getStatus: publicProcedure
    .input(z.object({ sourceItemId: z.string() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.userId) {
        return { hasForked: false, forkedItemId: null };
      }

      const fork = await ctx.prisma.fork.findUnique({
        where: {
          sourceItemId_userId: {
            sourceItemId: input.sourceItemId,
            userId: ctx.userId,
          },
        },
        select: { targetItemId: true },
      });

      return {
        hasForked: fork !== null,
        forkedItemId: fork?.targetItemId ?? null,
      };
    }),

  /**
   * Gets fork info for an item (source + fork count).
   */
  getInfo: publicProcedure
    .input(z.object({ itemId: z.string() }))
    .query(async ({ ctx, input }) => {
      const item = await ctx.prisma.item.findUnique({
        where: { id: input.itemId },
        select: {
          userId: true,
          forkedFromId: true,
          forkedFrom: {
            select: {
              id: true,
              name: true,
              isPublic: true,
              user: {
                select: {
                  username: true,
                  isPublic: true,
                },
              },
            },
          },
          _count: {
            select: { sourceForks: true },
          },
        },
      });

      if (!item) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Item not found" });
      }

      // Only owner can see fork info for private items
      if (ctx.userId !== item.userId) {
        const isPublic = await isItemFullyPublic(ctx.prisma, input.itemId);
        if (!isPublic) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Item not found",
          });
        }
      }

      let source: {
        id: string;
        name: string;
        ownerUsername: string | null;
      } | null = null;

      if (item.forkedFrom?.isPublic && item.forkedFrom.user.isPublic) {
        source = {
          id: item.forkedFrom.id,
          name: item.forkedFrom.name,
          ownerUsername: item.forkedFrom.user.username,
        };
      }

      return { source, forkCount: item._count.sourceForks };
    }),

  /**
   * Gets items forked from a source item (owner only).
   */
  listForks: protectedProcedure
    .input(
      z.object({
        itemId: z.string(),
        limit: z.number().min(1).max(100).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const item = await ctx.prisma.item.findUnique({
        where: { id: input.itemId, userId: ctx.userId },
        select: { id: true },
      });

      if (!item) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Item not found" });
      }

      return ctx.prisma.fork.findMany({
        where: { sourceItemId: input.itemId },
        select: {
          id: true,
          userId: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: input.limit,
      });
    }),
});
