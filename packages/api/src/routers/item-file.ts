import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { rateLimit } from "../middleware/rate-limit";
import { serializeItemFile } from "@canoncore/types";
import { itemNameSchema, itemDescriptionSchema } from "@canoncore/validators";

/** Completion threshold — 80% of duration (Trakt standard). */
const COMPLETION_THRESHOLD = 0.8;

/** Deduplication window in milliseconds (5 minutes). */
const DEDUP_WINDOW_MS = 5 * 60 * 1000;

export const itemFileRouter = createTRPCRouter({
  // ===========================================================================
  // QUERIES
  // ===========================================================================

  /**
   * Lists ItemFiles attached to an item, grouped by type.
   * Returns files ordered by isHero desc, isPrimary desc, filename asc.
   */
  list: protectedProcedure
    .input(z.object({ itemId: z.string() }))
    .query(async ({ ctx, input }) => {
      const files = await ctx.prisma.itemFile.findMany({
        where: {
          itemId: input.itemId,
          item: { userId: ctx.userId },
        },
        orderBy: [
          { isHero: "desc" },
          { isPrimary: "desc" },
          { filename: "asc" },
        ],
      });

      return {
        media: files
          .filter((f) => f.fileType === "MEDIA")
          .map(serializeItemFile),
        artwork: files
          .filter((f) => f.fileType === "ARTWORK")
          .map(serializeItemFile),
        subtitles: files
          .filter((f) => f.fileType === "SUBTITLE")
          .map(serializeItemFile),
      };
    }),

  /**
   * Gets a single ItemFile by ID.
   */
  get: protectedProcedure
    .input(z.object({ fileId: z.string() }))
    .query(async ({ ctx, input }) => {
      const file = await ctx.prisma.itemFile.findUnique({
        where: { id: input.fileId },
        include: { item: { select: { userId: true } } },
      });

      if (!file) {
        throw new TRPCError({ code: "NOT_FOUND", message: "File not found" });
      }
      if (file.item.userId !== ctx.userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }

      const { item: _item, ...fileWithoutItem } = file;
      return serializeItemFile(fileWithoutItem);
    }),

  // ===========================================================================
  // MUTATIONS
  // ===========================================================================

  /**
   * Updates playback position for a media file.
   * Auto-scrobbles (creates WatchRecord) when crossing the 80% completion threshold.
   * Deduplicates scrobbles within a 5-minute window.
   */
  updatePlaybackPosition: protectedProcedure
    .use(rateLimit("updatePlaybackPosition"))
    .input(
      z.object({
        fileId: z.string(),
        position: z.number(),
        duration: z.number().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const file = await ctx.prisma.itemFile.findUnique({
        where: { id: input.fileId },
        include: { item: { select: { userId: true, id: true } } },
      });

      if (!file) {
        throw new TRPCError({ code: "NOT_FOUND", message: "File not found" });
      }
      if (file.item.userId !== ctx.userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }

      await ctx.prisma.itemFile.update({
        where: { id: input.fileId },
        data: {
          playbackPosition: input.position,
          ...(input.duration !== undefined &&
            input.duration !== null && { playbackDuration: input.duration }),
        },
      });

      // Auto-scrobble: create WatchRecord when crossing completion threshold.
      // The threshold check is in JS (cheap) so we only hit the DB for dedup
      // when the position is actually past 80%.
      const effectiveDuration = input.duration ?? file.playbackDuration;
      if (
        effectiveDuration !== null &&
        effectiveDuration !== undefined &&
        effectiveDuration !== 0 &&
        input.position >= effectiveDuration * COMPLETION_THRESHOLD
      ) {
        const dedupCutoff = new Date(Date.now() - DEDUP_WINDOW_MS);
        const recent = await ctx.prisma.watchRecord.findFirst({
          where: {
            itemId: file.item.id,
            userId: ctx.userId,
            watchedAt: { gte: dedupCutoff },
          },
          orderBy: { watchedAt: "desc" },
        });

        if (!recent) {
          await ctx.prisma.watchRecord.create({
            data: {
              itemId: file.item.id,
              userId: ctx.userId,
              source: "AUTO",
            },
          });
        }
      }

      return { success: true };
    }),

  /**
   * Sets a file as primary for its type within an item.
   * Unsets any other primary files of the same type (atomic transaction).
   */
  setPrimary: protectedProcedure
    .use(rateLimit("itemUpdate"))
    .input(z.object({ fileId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const file = await ctx.prisma.itemFile.findUnique({
        where: { id: input.fileId },
        include: { item: { select: { userId: true } } },
      });

      if (!file) {
        throw new TRPCError({ code: "NOT_FOUND", message: "File not found" });
      }
      if (file.item.userId !== ctx.userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }

      await ctx.prisma.$transaction([
        // Unset existing primary files of the same type
        ctx.prisma.itemFile.updateMany({
          where: {
            itemId: file.itemId,
            fileType: file.fileType,
            isPrimary: true,
          },
          data: { isPrimary: false },
        }),
        // Set this file as primary
        ctx.prisma.itemFile.update({
          where: { id: input.fileId },
          data: { isPrimary: true },
        }),
      ]);

      return { success: true };
    }),

  /**
   * Atomically updates item settings: name, description, and primary file selections.
   * Validates file ownership and types before applying changes.
   *
   * Stripped from web version: Google Drive rename, dominant colour extraction, revalidatePath.
   */
  updateSettings: protectedProcedure
    .use(rateLimit("itemUpdate"))
    .input(
      z.object({
        itemId: z.string(),
        name: z.string().optional(),
        description: z.string().optional(),
        primaryMediaId: z.string().optional(),
        primaryArtworkId: z.string().optional(),
        heroArtworkId: z.string().optional(),
        logoArtworkId: z.string().optional(),
        primarySubtitleId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify user owns the item
      const item = await ctx.prisma.item.findUnique({
        where: { id: input.itemId },
        select: { userId: true, name: true },
      });

      if (!item) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Item not found" });
      }
      if (item.userId !== ctx.userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }

      // Collect all file IDs that need validation
      const fileIds = [
        input.primaryMediaId,
        input.primaryArtworkId,
        input.heroArtworkId,
        input.logoArtworkId,
        input.primarySubtitleId,
      ].filter((id): id is string => id !== undefined);

      // Validate all files if any are specified
      if (fileIds.length > 0) {
        const files = await ctx.prisma.itemFile.findMany({
          where: { id: { in: fileIds } },
          select: { id: true, itemId: true, fileType: true },
        });

        if (files.length !== fileIds.length) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "One or more files not found",
          });
        }

        if (files.some((f) => f.itemId !== input.itemId)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "File does not belong to this item",
          });
        }

        // Validate file types match their intended use
        const fileMap = new Map(files.map((f) => [f.id, f.fileType]));

        if (
          input.primaryMediaId &&
          fileMap.get(input.primaryMediaId) !== "MEDIA"
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Primary media must be a MEDIA file",
          });
        }

        if (
          input.primaryArtworkId &&
          fileMap.get(input.primaryArtworkId) !== "ARTWORK"
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Primary artwork must be an ARTWORK file",
          });
        }

        if (
          input.heroArtworkId &&
          fileMap.get(input.heroArtworkId) !== "ARTWORK"
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Hero image must be an ARTWORK file",
          });
        }

        if (
          input.logoArtworkId &&
          fileMap.get(input.logoArtworkId) !== "ARTWORK"
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Logo must be an ARTWORK file",
          });
        }

        if (
          input.primarySubtitleId &&
          fileMap.get(input.primarySubtitleId) !== "SUBTITLE"
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Primary subtitle must be a SUBTITLE file",
          });
        }
      }

      // Build item update data
      const itemUpdateData: {
        name?: string;
        description?: string | null;
      } = {};

      if (input.name !== undefined && input.name !== item.name) {
        const validation = itemNameSchema.safeParse(input.name);
        if (!validation.success) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: validation.error.issues[0].message,
          });
        }
        itemUpdateData.name = validation.data;
      }

      if (input.description !== undefined) {
        if (input.description === "") {
          itemUpdateData.description = null;
        } else {
          const validation = itemDescriptionSchema.safeParse(input.description);
          if (!validation.success) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: validation.error.issues[0].message,
            });
          }
          itemUpdateData.description = validation.data || null;
        }
      }

      // Execute all updates in a single transaction
      await ctx.prisma.$transaction(async (tx) => {
        // Update item name/description if provided
        if (Object.keys(itemUpdateData).length > 0) {
          await tx.item.update({
            where: { id: input.itemId },
            data: itemUpdateData,
          });
        }

        // Update primary media
        if (input.primaryMediaId !== undefined) {
          await tx.itemFile.updateMany({
            where: { itemId: input.itemId, fileType: "MEDIA", isPrimary: true },
            data: { isPrimary: false },
          });
          await tx.itemFile.update({
            where: { id: input.primaryMediaId },
            data: { isPrimary: true },
          });
        }

        // Update primary artwork
        if (input.primaryArtworkId !== undefined) {
          await tx.itemFile.updateMany({
            where: {
              itemId: input.itemId,
              fileType: "ARTWORK",
              isPrimary: true,
            },
            data: { isPrimary: false },
          });
          await tx.itemFile.update({
            where: { id: input.primaryArtworkId },
            data: { isPrimary: true },
          });
        }

        // Update hero artwork
        if (input.heroArtworkId !== undefined) {
          await tx.itemFile.updateMany({
            where: {
              itemId: input.itemId,
              fileType: "ARTWORK",
              isHero: true,
            },
            data: { isHero: false },
          });
          await tx.itemFile.update({
            where: { id: input.heroArtworkId },
            data: { isHero: true },
          });
        }

        // Update logo artwork
        if (input.logoArtworkId !== undefined) {
          await tx.itemFile.updateMany({
            where: {
              itemId: input.itemId,
              fileType: "ARTWORK",
              isLogo: true,
            },
            data: { isLogo: false },
          });
          await tx.itemFile.update({
            where: { id: input.logoArtworkId },
            data: { isLogo: true },
          });
        }

        // Update primary subtitle
        if (input.primarySubtitleId !== undefined) {
          await tx.itemFile.updateMany({
            where: {
              itemId: input.itemId,
              fileType: "SUBTITLE",
              isPrimary: true,
            },
            data: { isPrimary: false },
          });
          await tx.itemFile.update({
            where: { id: input.primarySubtitleId },
            data: { isPrimary: true },
          });
        }
      });

      return { success: true };
    }),

  /**
   * Deletes an ItemFile from the database.
   * Google Drive deletion is skipped (web-only concern).
   */
  delete: protectedProcedure
    .use(rateLimit("itemDelete"))
    .input(z.object({ fileId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const file = await ctx.prisma.itemFile.findUnique({
        where: { id: input.fileId },
        include: { item: { select: { userId: true } } },
      });

      if (!file) {
        throw new TRPCError({ code: "NOT_FOUND", message: "File not found" });
      }
      if (file.item.userId !== ctx.userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }

      await ctx.prisma.itemFile.delete({
        where: { id: input.fileId },
      });

      return { success: true };
    }),
});
