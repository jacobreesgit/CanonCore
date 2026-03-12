import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  publicProcedure,
  protectedProcedure,
} from "../trpc";
import { rateLimit } from "../middleware/rate-limit";
import {
  toItemWithArtwork,
  buildDescendantCounter,
  resolveProgress,
  ITEM_FILES_SELECT,
} from "../helpers/item-mappers";
import { buildDescendantProgressMap } from "../helpers/progress";
import { isItemFullyPublic } from "../helpers/visibility";
import { itemNameSchema, itemDescriptionSchema } from "@canoncore/validators";
import { resolveArtworkId, PAGE_SIZE, encodeCursor, decodeCursor, escapeILike } from "@canoncore/utils";
import type { ItemWithArtwork, ItemProgress, BreadcrumbItem, SearchableItem, PinnedItem } from "@canoncore/types";

/** Maximum nesting depth for items. */
const MAX_ITEM_DEPTH = 10;

/** Maximum number of pinned items per user. */
const MAX_PINNED_ITEMS = 10;

// =============================================================================
// Shared Prisma include for items with files
// =============================================================================

const itemWithFilesInclude = {
  files: {
    select: ITEM_FILES_SELECT,
  },
  driveConnection: {
    select: { id: true },
  },
} as const;

// =============================================================================
// Item Router
// =============================================================================

export const itemRouter = createTRPCRouter({
  // ===========================================================================
  // QUERIES (protectedProcedure, no rate limit)
  // ===========================================================================

  /**
   * Fetches items for a given parent with artwork thumbnails.
   * Returns root items if parentId is null.
   */
  list: protectedProcedure
    .input(
      z.object({
        parentId: z.string().nullable().default(null),
      })
    )
    .query(async ({ ctx, input }) => {
      // Parallelize: descendant counting + current level items
      const [allItems, items] = await Promise.all([
        ctx.prisma.item.findMany({
          where: { userId: ctx.userId },
          select: { id: true, parentId: true },
        }),
        ctx.prisma.item.findMany({
          where: {
            userId: ctx.userId,
            parentId: input.parentId,
          },
          orderBy: { order: "asc" },
          include: itemWithFilesInclude,
        }),
      ]);

      const countDescendants = buildDescendantCounter(allItems);

      // Build progress map for all items at this level
      const progressMap = await buildDescendantProgressMap(
        ctx.prisma,
        ctx.userId,
        items.map((i) => i.id)
      );

      return items.map((item) =>
        toItemWithArtwork(
          item,
          countDescendants(item.id),
          resolveProgress(progressMap, item.id)
        )
      );
    }),

  /**
   * Fetches ALL items for the current user with artwork thumbnails.
   * Returns full hierarchy for inline tree display.
   */
  listAll: protectedProcedure.query(async ({ ctx }) => {
    const [allItems, items] = await Promise.all([
      ctx.prisma.item.findMany({
        where: { userId: ctx.userId },
        select: { id: true, parentId: true },
      }),
      ctx.prisma.item.findMany({
        where: { userId: ctx.userId },
        orderBy: [{ depth: "asc" }, { order: "asc" }],
        include: itemWithFilesInclude,
      }),
    ]);

    const countDescendants = buildDescendantCounter(allItems);

    const progressMap = await buildDescendantProgressMap(
      ctx.prisma,
      ctx.userId,
      items.map((i) => i.id)
    );

    return items.map((item) =>
      toItemWithArtwork(
        item,
        countDescendants(item.id),
        resolveProgress(progressMap, item.id)
      )
    );
  }),

  /**
   * Fetches all descendants of an item (children, grandchildren, etc.).
   * Used for displaying full subtree on item detail pages.
   */
  getDescendants: protectedProcedure
    .input(z.object({ parentId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Verify parent ownership
      const parent = await ctx.prisma.item.findFirst({
        where: { id: input.parentId, userId: ctx.userId },
      });
      if (!parent) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Item not found",
        });
      }

      // Recursive CTE to get all descendants
      const descendants = await ctx.prisma.$queryRaw<{ id: string }[]>`
        WITH RECURSIVE descendants AS (
          SELECT id, "parentId"
          FROM "Item"
          WHERE "parentId" = ${input.parentId} AND "userId" = ${ctx.userId}
          UNION ALL
          SELECT i.id, i."parentId"
          FROM "Item" i
          INNER JOIN descendants d ON i."parentId" = d.id
          WHERE i."userId" = ${ctx.userId}
        )
        SELECT id FROM descendants
      `;

      const descendantIds = descendants.map((d) => d.id);
      if (descendantIds.length === 0) {
        return [];
      }

      const items = await ctx.prisma.item.findMany({
        where: { id: { in: descendantIds } },
        orderBy: [{ depth: "asc" }, { order: "asc" }],
        include: itemWithFilesInclude,
      });

      const countDescendants = buildDescendantCounter(
        items.map((item) => ({ id: item.id, parentId: item.parentId }))
      );

      const progressMap = await buildDescendantProgressMap(
        ctx.prisma,
        ctx.userId,
        items.map((i) => i.id)
      );

      return items.map((item) =>
        toItemWithArtwork(
          item,
          countDescendants(item.id),
          resolveProgress(progressMap, item.id)
        )
      );
    }),

  /**
   * Fetches a single item with its ancestors for breadcrumbs.
   */
  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const item = await ctx.prisma.item.findUnique({
        where: { id: input.id },
      });

      if (!item) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Item not found",
        });
      }

      if (item.userId !== ctx.userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Access denied",
        });
      }

      // Build ancestors chain using recursive CTE
      const ancestors: BreadcrumbItem[] = item.parentId
        ? await ctx.prisma.$queryRaw<BreadcrumbItem[]>`
            WITH RECURSIVE ancestors AS (
              SELECT id, name, "parentId", 1 as depth
              FROM "Item"
              WHERE id = ${item.parentId}

              UNION ALL

              SELECT i.id, i.name, i."parentId", a.depth + 1
              FROM "Item" i
              INNER JOIN ancestors a ON i.id = a."parentId"
              WHERE i."userId" = ${ctx.userId}
            )
            SELECT id, name FROM ancestors
            ORDER BY depth DESC
          `
        : [];

      return { item, ancestors };
    }),

  /**
   * Fetches all items for spotlight search.
   * Returns item data with primary artwork and breadcrumb paths.
   * Limited to 500 items for performance.
   */
  search: protectedProcedure.query(async ({ ctx }) => {
    const [items, user] = await Promise.all([
      ctx.prisma.item.findMany({
        where: { userId: ctx.userId },
        select: {
          id: true,
          name: true,
          parentId: true,
          depth: true,
          description: true,
          tmdbPosterPath: true,
          files: {
            where: { fileType: "ARTWORK" },
            select: { id: true, isPrimary: true },
            orderBy: { isPrimary: "desc" },
          },
        },
        orderBy: { name: "asc" },
        take: 500,
      }),
      ctx.prisma.user.findUnique({
        where: { id: ctx.userId },
        select: { username: true },
      }),
    ]);

    const ownerUsername = user?.username ?? null;

    // Build a map for breadcrumb construction
    const itemMap = new Map<
      string,
      { name: string; parentId: string | null }
    >();
    for (const item of items) {
      itemMap.set(item.id, { name: item.name, parentId: item.parentId });
    }

    const buildBreadcrumb = (parentId: string | null): string | null => {
      if (!parentId) return null;

      const parts: string[] = [];
      let currentId: string | null = parentId;

      for (let i = 0; i < 10 && currentId; i++) {
        const parent = itemMap.get(currentId);
        if (!parent) break;
        parts.unshift(parent.name);
        currentId = parent.parentId;
      }

      return parts.length > 0 ? parts.join(" / ") : null;
    };

    const searchableItems: SearchableItem[] = items.map((item) => ({
      id: item.id,
      name: item.name,
      parentId: item.parentId,
      depth: item.depth,
      description: item.description,
      tmdbPosterPath: item.tmdbPosterPath ?? null,
      artworkId: item.files[0]?.id ?? null,
      breadcrumb: buildBreadcrumb(item.parentId),
      ownerUsername,
    }));

    return searchableItems;
  }),

  /**
   * Fetches all pinned items for the current user.
   * Returns items sorted by pinnedOrder for sidebar display.
   */
  getPinned: protectedProcedure.query(async ({ ctx }) => {
    const items = await ctx.prisma.item.findMany({
      where: {
        userId: ctx.userId,
        pinnedOrder: { not: null },
      },
      orderBy: { pinnedOrder: "asc" },
      select: {
        id: true,
        name: true,
        pinnedOrder: true,
        isPublic: true,
      },
    });

    const pinnedItems: PinnedItem[] = items.map((item) => ({
      id: item.id,
      name: item.name,
      pinnedOrder: item.pinnedOrder!,
      isPublic: item.isPublic,
    }));

    return pinnedItems;
  }),

  /**
   * Fetches progress for a single item (self + all descendants).
   * Returns null if no media files exist in the subtree.
   */
  getProgress: protectedProcedure
    .input(z.object({ itemId: z.string() }))
    .query(async ({ ctx, input }) => {
      const progressMap = await buildDescendantProgressMap(
        ctx.prisma,
        ctx.userId,
        [input.itemId]
      );
      const progress = progressMap.get(input.itemId);

      if (!progress || progress.percentage === null) {
        return null;
      }

      return progress;
    }),

  /**
   * Fetches progress across all items in the user's library.
   * Returns aggregate completion stats for the entire collection.
   */
  getLibraryProgress: protectedProcedure.query(async ({ ctx }) => {
    const result = await ctx.prisma.$queryRaw<
      Array<{
        totalItems: bigint;
        itemsWithMedia: bigint;
        watchedItems: bigint;
      }>
    >`
      SELECT
        COUNT(DISTINCT i.id) as "totalItems",
        COUNT(DISTINCT CASE WHEN f.id IS NOT NULL THEN i.id END) as "itemsWithMedia",
        COUNT(DISTINCT CASE
          WHEN EXISTS(
            SELECT 1 FROM "WatchRecord" wr
            WHERE wr."itemId" = i.id AND wr."userId" = ${ctx.userId}
          )
          THEN i.id
        END) as "watchedItems"
      FROM "Item" i
      LEFT JOIN "ItemFile" f ON f."itemId" = i.id
        AND f."fileType" = 'MEDIA'
        AND f."isPrimary" = true
      WHERE i."userId" = ${ctx.userId}
    `;

    if (result.length === 0) {
      return null;
    }

    const row = result[0];
    const totalItems = Number(row.totalItems);
    const itemsWithMedia = Number(row.itemsWithMedia);
    const watchedItems = Number(row.watchedItems);

    if (totalItems === 0) {
      return null;
    }

    const progress: ItemProgress = {
      watchedItems,
      itemsWithMedia,
      percentage:
        itemsWithMedia > 0
          ? Math.round((watchedItems / itemsWithMedia) * 100)
          : null,
      totalItems,
    };

    return progress;
  }),

  /**
   * Gets the first incomplete item in DFS order.
   * An item is incomplete if it has primary media and no WatchRecord.
   */
  getFirstIncomplete: protectedProcedure
    .input(
      z.object({
        parentId: z.string().nullable().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const parentId = input.parentId ?? null;

      const itemsWithProgress = parentId
        ? await ctx.prisma.$queryRaw<
            {
              id: string;
              name: string;
              order: number;
              parentId: string | null;
              hasPrimaryMedia: boolean;
              isWatched: boolean;
            }[]
          >`
            WITH RECURSIVE descendants AS (
              SELECT id FROM "Item" WHERE "parentId" = ${parentId} AND "userId" = ${ctx.userId}
              UNION ALL
              SELECT i.id FROM "Item" i
              INNER JOIN descendants d ON i."parentId" = d.id
              WHERE i."userId" = ${ctx.userId}
            )
            SELECT
              i.id,
              i.name,
              i."order",
              i."parentId",
              EXISTS(SELECT 1 FROM "ItemFile" f WHERE f."itemId" = i.id AND f."fileType" = 'MEDIA' AND f."isPrimary" = true) as "hasPrimaryMedia",
              EXISTS(SELECT 1 FROM "WatchRecord" wr WHERE wr."itemId" = i.id AND wr."userId" = ${ctx.userId}) as "isWatched"
            FROM "Item" i
            WHERE i.id IN (SELECT id FROM descendants)
            ORDER BY i."order"
          `
        : await ctx.prisma.$queryRaw<
            {
              id: string;
              name: string;
              order: number;
              parentId: string | null;
              hasPrimaryMedia: boolean;
              isWatched: boolean;
            }[]
          >`
            SELECT
              i.id,
              i.name,
              i."order",
              i."parentId",
              EXISTS(SELECT 1 FROM "ItemFile" f WHERE f."itemId" = i.id AND f."fileType" = 'MEDIA' AND f."isPrimary" = true) as "hasPrimaryMedia",
              EXISTS(SELECT 1 FROM "WatchRecord" wr WHERE wr."itemId" = i.id AND wr."userId" = ${ctx.userId}) as "isWatched"
            FROM "Item" i
            WHERE i."userId" = ${ctx.userId}
            ORDER BY i."order"
          `;

      // Use DFS traversal to find first incomplete item
      const incompleteId = findFirstIncompleteItem(
        itemsWithProgress.map((item) => ({
          id: item.id,
          order: item.order,
          parentId: item.parentId,
          hasPrimaryMedia: item.hasPrimaryMedia,
          isWatched: item.isWatched,
        })),
        parentId
      );

      if (!incompleteId) {
        return null;
      }

      const incompleteItem = itemsWithProgress.find(
        (i) => i.id === incompleteId
      );
      if (!incompleteItem) {
        return null;
      }

      return { id: incompleteItem.id, name: incompleteItem.name };
    }),

  /**
   * Gets breadcrumbs for an item.
   */
  getBreadcrumbs: protectedProcedure
    .input(z.object({ itemId: z.string() }))
    .query(async ({ ctx, input }) => {
      const item = await ctx.prisma.item.findUnique({
        where: { id: input.itemId },
        select: { userId: true, parentId: true },
      });

      if (!item) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Item not found",
        });
      }

      if (item.userId !== ctx.userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Access denied",
        });
      }

      if (!item.parentId) {
        return [];
      }

      const ancestors = await ctx.prisma.$queryRaw<BreadcrumbItem[]>`
        WITH RECURSIVE ancestors AS (
          SELECT id, name, "parentId", 1 as depth
          FROM "Item"
          WHERE id = ${item.parentId}

          UNION ALL

          SELECT i.id, i.name, i."parentId", a.depth + 1
          FROM "Item" i
          INNER JOIN ancestors a ON i.id = a."parentId"
          WHERE i."userId" = ${ctx.userId}
        )
        SELECT id, name FROM ancestors
        ORDER BY depth DESC
      `;

      return ancestors;
    }),

  /**
   * Gets the visibility state of an item.
   */
  getVisibility: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const item = await ctx.prisma.item.findUnique({
        where: { id: input.id },
        select: { userId: true, isPublic: true },
      });

      if (!item) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Item not found",
        });
      }

      if (item.userId !== ctx.userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Access denied",
        });
      }

      return { isPublic: item.isPublic };
    }),

  /**
   * Counts children that inherit visibility from a given item.
   */
  countInheritingChildren: protectedProcedure
    .input(z.object({ itemId: z.string() }))
    .query(async ({ ctx, input }) => {
      const item = await ctx.prisma.item.findUnique({
        where: { id: input.itemId },
        select: { userId: true },
      });

      if (!item || item.userId !== ctx.userId) {
        return 0;
      }

      return ctx.prisma.item.count({
        where: {
          parentId: input.itemId,
          inheritVisibility: true,
        },
      });
    }),

  // ===========================================================================
  // MUTATIONS (protectedProcedure + rateLimit)
  // ===========================================================================

  /**
   * Creates a new item.
   * Enforces max depth of 10 levels.
   */
  create: protectedProcedure
    .use(rateLimit("createItem"))
    .input(
      z.object({
        name: z.string(),
        parentId: z.string().nullable().default(null),
        description: z.string().optional(),
        options: z
          .object({
            isPublic: z.boolean().optional().default(false),
            inheritVisibility: z.boolean().optional().default(false),
          })
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Validate name
      const nameResult = itemNameSchema.safeParse(input.name);
      if (!nameResult.success) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: nameResult.error.issues[0].message,
        });
      }

      // Validate description if provided
      let validatedDescription: string | null = null;
      if (input.description !== undefined && input.description !== "") {
        const descResult = itemDescriptionSchema.safeParse(input.description);
        if (!descResult.success) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: descResult.error.issues[0].message,
          });
        }
        validatedDescription = descResult.data || null;
      }

      const visibilityOptions = {
        isPublic: input.options?.isPublic ?? false,
        inheritVisibility: input.options?.inheritVisibility ?? false,
      };

      // Reject inheritVisibility on root items
      if (visibilityOptions.inheritVisibility && !input.parentId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Root items cannot inherit visibility",
        });
      }

      let depth = 0;

      // Check parent exists and user owns it
      if (input.parentId) {
        const parent = await ctx.prisma.item.findUnique({
          where: { id: input.parentId },
          select: { depth: true, userId: true },
        });

        if (!parent || parent.userId !== ctx.userId) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Parent not found",
          });
        }

        if (parent.depth >= MAX_ITEM_DEPTH - 1) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Maximum nesting depth reached",
          });
        }

        depth = parent.depth + 1;
      }

      // Get max order for siblings
      const maxOrderResult = await ctx.prisma.item.aggregate({
        where: {
          userId: ctx.userId,
          parentId: input.parentId,
        },
        _max: { order: true },
      });

      const order = (maxOrderResult._max.order ?? -1) + 1;

      const item = await ctx.prisma.item.create({
        data: {
          name: nameResult.data,
          description: validatedDescription,
          parentId: input.parentId,
          order,
          depth,
          userId: ctx.userId,
          isPublic: visibilityOptions.isPublic,
          inheritVisibility: visibilityOptions.inheritVisibility,
        },
      });

      return item;
    }),

  /**
   * Creates a new item with TMDB metadata applied atomically.
   * Only creates the item and sets TMDB fields — does NOT download
   * poster/backdrop images (that's handled by the web app wrapper).
   */
  createWithMetadata: protectedProcedure
    .use(rateLimit("createItem"))
    .input(
      z.object({
        name: z.string(),
        parentId: z.string().nullable().default(null),
        description: z.string().optional(),
        tmdbId: z.number(),
        tmdbType: z.enum(["movie", "tv"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Validate name
      const nameResult = itemNameSchema.safeParse(input.name);
      if (!nameResult.success) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: nameResult.error.issues[0].message,
        });
      }

      // Validate description if provided
      let validatedDescription: string | null = null;
      if (input.description !== undefined && input.description !== "") {
        const descResult = itemDescriptionSchema.safeParse(input.description);
        if (!descResult.success) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: descResult.error.issues[0].message,
          });
        }
        validatedDescription = descResult.data || null;
      }

      let depth = 0;

      if (input.parentId) {
        const parent = await ctx.prisma.item.findUnique({
          where: { id: input.parentId },
          select: { depth: true, userId: true },
        });

        if (!parent || parent.userId !== ctx.userId) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Parent not found",
          });
        }

        if (parent.depth >= MAX_ITEM_DEPTH - 1) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Maximum nesting depth reached",
          });
        }

        depth = parent.depth + 1;
      }

      const maxOrderResult = await ctx.prisma.item.aggregate({
        where: {
          userId: ctx.userId,
          parentId: input.parentId,
        },
        _max: { order: true },
      });

      const order = (maxOrderResult._max.order ?? -1) + 1;

      const item = await ctx.prisma.item.create({
        data: {
          name: nameResult.data,
          description: validatedDescription,
          parentId: input.parentId,
          order,
          depth,
          userId: ctx.userId,
          tmdbId: input.tmdbId,
          tmdbType: input.tmdbType,
        },
      });

      return item;
    }),

  /**
   * Updates an item's name and/or description.
   */
  update: protectedProcedure
    .use(rateLimit("updateItem"))
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existingItem = await ctx.prisma.item.findUnique({
        where: { id: input.id },
        select: { userId: true, name: true },
      });

      if (!existingItem) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Item not found",
        });
      }

      if (existingItem.userId !== ctx.userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Access denied",
        });
      }

      const updateData: { name?: string; description?: string | null } = {};

      // Validate name if provided
      if (input.name !== undefined) {
        const nameResult = itemNameSchema.safeParse(input.name);
        if (!nameResult.success) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: nameResult.error.issues[0].message,
          });
        }
        updateData.name = nameResult.data;
      }

      // Validate description if provided
      if (input.description !== undefined) {
        if (input.description === "") {
          updateData.description = null;
        } else {
          const descResult = itemDescriptionSchema.safeParse(input.description);
          if (!descResult.success) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: descResult.error.issues[0].message,
            });
          }
          updateData.description = descResult.data || null;
        }
      }

      await ctx.prisma.item.update({
        where: { id: input.id },
        data: updateData,
      });

      return { success: true };
    }),

  /**
   * Deletes an item and all descendants.
   * Database cascading handles children. Drive cleanup is NOT done here.
   */
  delete: protectedProcedure
    .use(rateLimit("deleteItem"))
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const item = await ctx.prisma.item.findUnique({
        where: { id: input.id },
        select: { userId: true },
      });

      if (!item) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Item not found",
        });
      }

      if (item.userId !== ctx.userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Access denied",
        });
      }

      await ctx.prisma.item.delete({
        where: { id: input.id },
      });

      return { success: true };
    }),

  /**
   * Deletes multiple items in bulk.
   * Only deletes items owned by the authenticated user.
   * Database cascading handles children. Drive cleanup is NOT done here.
   */
  deleteMany: protectedProcedure
    .use(rateLimit("deleteItem"))
    .input(
      z.object({
        ids: z.array(z.string()).min(1, "No items to delete"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Find items that belong to this user
      const items = await ctx.prisma.item.findMany({
        where: {
          id: { in: input.ids },
          userId: ctx.userId,
        },
        select: { id: true },
      });

      const ownedIds = items.map((item) => item.id);
      const skipped = input.ids.length - ownedIds.length;

      if (ownedIds.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No items found to delete",
        });
      }

      const { count } = await ctx.prisma.item.deleteMany({
        where: { id: { in: ownedIds } },
      });

      return { deleted: count, skipped };
    }),

  /**
   * Moves an item to a new parent folder (or root).
   * Prevents circular moves. Drive sync is NOT done here.
   */
  move: protectedProcedure
    .use(rateLimit("moveItem"))
    .input(
      z.object({
        id: z.string(),
        newParentId: z.string().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.userId;

      const item = await ctx.prisma.item.findFirst({
        where: { id: input.id, userId },
        select: { id: true, parentId: true, depth: true },
      });
      if (!item) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Item not found",
        });
      }

      // No-op if same parent
      if (item.parentId === input.newParentId) {
        return { success: true };
      }

      // Prevent moving into self
      if (input.newParentId === input.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot move item into itself",
        });
      }

      // Verify new parent ownership and prevent circular reference
      let newDepth = 0;
      if (input.newParentId) {
        const parent = await ctx.prisma.item.findFirst({
          where: { id: input.newParentId, userId },
          select: { id: true, depth: true },
        });
        if (!parent) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Destination not found",
          });
        }
        newDepth = parent.depth + 1;

        // Check that the new parent is not a descendant of the item
        const visited = new Set<string>([input.id]);
        let currentId: string | null = input.newParentId;
        while (currentId) {
          if (visited.has(currentId)) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Cannot create circular hierarchy",
            });
          }
          visited.add(currentId);
          const ancestor: { parentId: string | null } | null =
            await ctx.prisma.item.findFirst({
              where: { id: currentId, userId },
              select: { parentId: true },
            });
          currentId = ancestor?.parentId ?? null;
        }
      }

      if (newDepth >= MAX_ITEM_DEPTH) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Maximum nesting depth reached",
        });
      }

      // Get descendants via recursive CTE
      const descendants = await ctx.prisma.$queryRaw<
        Array<{ id: string; depth: number }>
      >`
        WITH RECURSIVE subtree AS (
          SELECT id, "parentId", depth FROM "Item"
            WHERE "parentId" = ${input.id} AND "userId" = ${userId}
          UNION ALL
          SELECT i.id, i."parentId", i.depth FROM "Item" i
            JOIN subtree s ON i."parentId" = s.id
        )
        SELECT id, depth FROM subtree
      `;

      // Validate that the deepest descendant won't exceed MAX_ITEM_DEPTH after move
      const depthDelta = newDepth - item.depth;
      if (descendants.length > 0) {
        const maxDescendantDepth = Math.max(
          ...descendants.map((d) => d.depth)
        );
        if (maxDescendantDepth + depthDelta >= MAX_ITEM_DEPTH) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Moving here would push descendants beyond maximum depth",
          });
        }
      }

      // Get max order in destination to append at end
      const maxOrderResult = await ctx.prisma.item.aggregate({
        where: { userId, parentId: input.newParentId },
        _max: { order: true },
      });
      const newOrder = (maxOrderResult._max.order ?? 0) + 1;

      // Update item and descendants in transaction
      await ctx.prisma.$transaction(async (tx) => {
        await tx.item.update({
          where: { id: input.id },
          data: {
            parentId: input.newParentId,
            order: newOrder,
            depth: newDepth,
          },
        });

        if (depthDelta !== 0) {
          const descendantIds = descendants.map((d) => d.id);
          if (descendantIds.length > 0) {
            await tx.item.updateMany({
              where: { id: { in: descendantIds } },
              data: { depth: { increment: depthDelta } },
            });
          }
        }
      });

      return { success: true };
    }),

  /**
   * Batch reorders items. Used after drag operations.
   * Verifies ownership of ALL items before update.
   */
  reorder: protectedProcedure
    .use(rateLimit("reorderItem"))
    .input(
      z.object({
        updates: z.array(
          z.object({
            id: z.string(),
            order: z.number(),
            parentId: z.string().nullable().optional(),
            depth: z.number().optional(),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.updates.length === 0) {
        return { success: true };
      }

      const itemIds = input.updates.map((u) => u.id);
      const items = await ctx.prisma.item.findMany({
        where: { id: { in: itemIds } },
        select: { id: true, userId: true, depth: true, parentId: true },
      });

      if (items.length !== itemIds.length) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Some items not found",
        });
      }

      const unauthorized = items.some((item) => item.userId !== ctx.userId);
      if (unauthorized) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Access denied",
        });
      }

      // Check depth constraints for any parentId changes
      for (const update of input.updates) {
        if (update.depth !== undefined && update.depth >= MAX_ITEM_DEPTH) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Maximum nesting depth reached",
          });
        }
      }

      // Perform batch update in transaction
      await ctx.prisma.$transaction(
        input.updates.map((update) =>
          ctx.prisma.item.update({
            where: { id: update.id },
            data: {
              order: update.order,
              ...(update.parentId !== undefined && {
                parentId: update.parentId,
              }),
              ...(update.depth !== undefined && { depth: update.depth }),
            },
          })
        )
      );

      return { success: true };
    }),

  /**
   * Pins an item to the sidebar.
   * Limited to 10 pinned items per user.
   */
  pin: protectedProcedure
    .use(rateLimit("pinItem"))
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.$transaction(async (tx) => {
        const item = await tx.item.findUnique({
          where: { id: input.id },
          select: { userId: true, pinnedOrder: true },
        });

        if (!item) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Item not found",
          });
        }

        if (item.userId !== ctx.userId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Access denied",
          });
        }

        // Already pinned - no-op
        if (item.pinnedOrder !== null) {
          return;
        }

        const pinnedCount = await tx.item.count({
          where: {
            userId: ctx.userId,
            pinnedOrder: { not: null },
          },
        });

        if (pinnedCount >= MAX_PINNED_ITEMS) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Maximum of 10 pinned items reached",
          });
        }

        const maxOrder = await tx.item.aggregate({
          where: {
            userId: ctx.userId,
            pinnedOrder: { not: null },
          },
          _max: { pinnedOrder: true },
        });

        const nextOrder = (maxOrder._max.pinnedOrder ?? -1) + 1;

        await tx.item.update({
          where: { id: input.id },
          data: { pinnedOrder: nextOrder },
        });
      });

      return { success: true };
    }),

  /**
   * Unpins an item from the sidebar.
   */
  unpin: protectedProcedure
    .use(rateLimit("pinItem"))
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const item = await ctx.prisma.item.findUnique({
        where: { id: input.id },
        select: { userId: true, pinnedOrder: true },
      });

      if (!item) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Item not found",
        });
      }

      if (item.userId !== ctx.userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Access denied",
        });
      }

      // Already unpinned
      if (item.pinnedOrder === null) {
        return { success: true };
      }

      await ctx.prisma.item.update({
        where: { id: input.id },
        data: { pinnedOrder: null },
      });

      return { success: true };
    }),

  /**
   * Sets the public visibility of an item.
   * Making public: only that item. Making private: cascades to all descendants.
   */
  setVisibility: protectedProcedure
    .use(rateLimit("setItemVisibility"))
    .input(
      z.object({
        id: z.string(),
        isPublic: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const item = await ctx.prisma.item.findUnique({
        where: { id: input.id },
        select: { userId: true, isPublic: true },
      });

      if (!item) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Item not found",
        });
      }

      if (item.userId !== ctx.userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Access denied",
        });
      }

      // No change needed
      if (item.isPublic === input.isPublic) {
        return { affectedCount: 0 };
      }

      if (input.isPublic) {
        // Making public: only update this item
        await ctx.prisma.item.update({
          where: { id: input.id },
          data: { isPublic: true },
        });

        return { affectedCount: 1 };
      } else {
        // Making private: cascade to all descendants
        const descendantIds = await ctx.prisma.$queryRaw<
          Array<{ id: string }>
        >`
          WITH RECURSIVE descendants AS (
            SELECT id FROM "Item" WHERE id = ${input.id} AND "userId" = ${ctx.userId}
            UNION ALL
            SELECT i.id FROM "Item" i
            INNER JOIN descendants d ON i."parentId" = d.id
            WHERE i."userId" = ${ctx.userId}
          )
          SELECT id FROM descendants
        `;

        const ids = descendantIds.map((d) => d.id);

        await ctx.prisma.item.updateMany({
          where: { id: { in: ids } },
          data: { isPublic: false },
        });

        // Return count minus 1 because we don't count the item itself, only children
        return { affectedCount: ids.length - 1 };
      }
    }),

  /**
   * Sets whether an item inherits visibility from its parent.
   * Root items cannot inherit.
   */
  setInheritVisibility: protectedProcedure
    .use(rateLimit("setItemVisibility"))
    .input(
      z.object({
        id: z.string(),
        inheritVisibility: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const item = await ctx.prisma.item.findUnique({
        where: { id: input.id },
        select: { userId: true, parentId: true, inheritVisibility: true },
      });

      if (!item) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Item not found",
        });
      }

      if (item.userId !== ctx.userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Access denied",
        });
      }

      if (input.inheritVisibility && item.parentId === null) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Root items cannot inherit visibility",
        });
      }

      // No change needed
      if (item.inheritVisibility === input.inheritVisibility) {
        return { success: true };
      }

      await ctx.prisma.item.update({
        where: { id: input.id },
        data: { inheritVisibility: input.inheritVisibility },
      });

      return { success: true };
    }),

  // ===========================================================================
  // PUBLIC QUERIES (publicProcedure, no rate limit)
  // ===========================================================================

  /**
   * Fetches items for a user's profile with owner/viewer mode detection.
   * When viewer is the owner, returns all items with full data.
   * When viewer is different user or guest, returns only public items.
   */
  getForProfile: publicProcedure
    .input(
      z.object({
        profileUserId: z.string(),
        parentId: z.string().nullable().optional(),
        cursor: z.string().nullable().optional(),
        search: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const viewerUserId = ctx.userId;
      const isOwner = viewerUserId === input.profileUserId;

      // Fetch profile
      const profile = await ctx.prisma.user.findUnique({
        where: { id: input.profileUserId },
        select: {
          id: true,
          username: true,
          name: true,
          image: true,
          heroImage: true,
          dominantColour: true,
          bio: true,
        },
      });

      if (!profile || !profile.username) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Profile not found",
        });
      }

      const profileData = {
        id: profile.id,
        username: profile.username,
        name: profile.name,
        hasImage: !!profile.image,
        hasHeroImage: !!profile.heroImage,
        dominantColour: profile.dominantColour ?? null,
        bio: profile.bio ?? null,
      };

      if (isOwner) {
        // Owner: fetch all items
        const [allItems, items] = await Promise.all([
          ctx.prisma.item.findMany({
            where: { userId: input.profileUserId },
            select: { id: true, parentId: true },
          }),
          ctx.prisma.item.findMany({
            where: { userId: input.profileUserId },
            orderBy: [{ depth: "asc" }, { order: "asc" }],
            include: itemWithFilesInclude,
          }),
        ]);

        const countDescendants = buildDescendantCounter(allItems);

        const progressMap = await buildDescendantProgressMap(
          ctx.prisma,
          input.profileUserId,
          items.map((i) => i.id)
        );

        const itemsWithArtwork: ItemWithArtwork[] = items.map((item) =>
          toItemWithArtwork(
            item,
            countDescendants(item.id),
            resolveProgress(progressMap, item.id)
          )
        );

        return {
          items: itemsWithArtwork,
          isOwner: true,
          profile: profileData,
        };
      } else {
        // Viewer: fetch only public root items with cursor-based pagination
        const decoded = decodeCursor(input.cursor ?? null);

        const publicItems = await ctx.prisma.item.findMany({
          where: {
            userId: input.profileUserId,
            parentId: null,
            isPublic: true,
            inheritVisibility: false,
            ...(input.search && {
              name: {
                contains: escapeILike(input.search),
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

        const hasMore = publicItems.length > PAGE_SIZE;
        const pageItems = hasMore
          ? publicItems.slice(0, PAGE_SIZE)
          : publicItems;

        // Transform to ItemWithArtwork shape for viewer
        const items: ItemWithArtwork[] = pageItems.map((item) => ({
          id: item.id,
          name: item.name,
          description: item.description,
          parentId: item.parentId,
          order: item.order,
          depth: item.depth,
          userId: item.userId,
          createdAt: new Date(),
          updatedAt: item.updatedAt,
          artworkId: resolveArtworkId(item),
          pinnedOrder: item.pinnedOrder,
          isPublic: true,
          inheritVisibility: false,
          driveFileId: null,
          driveModifiedAt: null,
          driveThumbnailUrl: null,
          syncStatus: "SYNCED" as const,
          syncError: null,
          driveConnectionId: null,
          tmdbId: item.tmdbId ?? null,
          tmdbType: item.tmdbType ?? null,
          tmdbShowTagline: item.tmdbShowTagline,
          tmdbShowMetadata: item.tmdbShowMetadata,
          tmdbShowGenres: item.tmdbShowGenres,
          tmdbShowCast: item.tmdbShowCast,
          tmdbShowProviders: item.tmdbShowProviders,
          tmdbShowVideos: item.tmdbShowVideos,
          tmdbShowRecommendations: item.tmdbShowRecommendations,
          tmdbPosterPath: item.tmdbPosterPath ?? null,
          tmdbBackdropPath: item.tmdbBackdropPath ?? null,
          tmdbLogoPath: item.tmdbLogoPath ?? null,
          dominantColour: item.dominantColour ?? null,
          fileCounts: {
            media: item.files.filter((f) => f.fileType === "MEDIA").length,
            artwork: item.files.filter((f) => f.fileType === "ARTWORK").length,
            subtitles: item.files.filter((f) => f.fileType === "SUBTITLE")
              .length,
          },
          childCount: 0,
          primaryMediaName: null,
          primaryDurationMs: null,
          primaryHeight: null,
          mediaIconType: null,
          progress: null,
        }));

        const lastItem = pageItems[pageItems.length - 1];
        const nextCursor =
          hasMore && lastItem
            ? encodeCursor(lastItem.updatedAt, lastItem.id)
            : null;

        return {
          items,
          nextCursor,
          isOwner: false,
          profile: profileData,
        };
      }
    }),

  /**
   * Fetches children of an item for profile view.
   * When viewer is owner, returns all children with full data.
   * When viewer is different user or guest, returns only public children.
   */
  getChildrenForProfile: publicProcedure
    .input(
      z.object({
        parentId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const parent = await ctx.prisma.item.findUnique({
        where: { id: input.parentId },
        select: {
          id: true,
          name: true,
          parentId: true,
          userId: true,
        },
      });

      if (!parent) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Item not found",
        });
      }

      const isOwner = ctx.userId === parent.userId;

      const parentData = {
        id: parent.id,
        name: parent.name,
        parentId: parent.parentId,
      };

      if (isOwner) {
        const [allItems, children] = await Promise.all([
          ctx.prisma.item.findMany({
            where: { userId: parent.userId },
            select: { id: true, parentId: true },
          }),
          ctx.prisma.item.findMany({
            where: { userId: parent.userId, parentId: input.parentId },
            orderBy: { order: "asc" },
            include: itemWithFilesInclude,
          }),
        ]);

        const countDescendants = buildDescendantCounter(allItems);

        const progressMap = await buildDescendantProgressMap(
          ctx.prisma,
          parent.userId,
          children.map((i) => i.id)
        );

        const items: ItemWithArtwork[] = children.map((item) =>
          toItemWithArtwork(
            item,
            countDescendants(item.id),
            resolveProgress(progressMap, item.id)
          )
        );

        return {
          items,
          isOwner: true,
          parent: parentData,
        };
      } else {
        // Non-owner: verify parent is public and fetch public children
        const parentIsPublic = await isItemFullyPublic(
          ctx.prisma,
          input.parentId
        );
        if (!parentIsPublic) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Item not found",
          });
        }

        // Fetch public children directly
        const publicChildren = await ctx.prisma.item.findMany({
          where: {
            parentId: input.parentId,
            isPublic: true,
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
            dominantColour: true,
            tmdbShowTagline: true,
            tmdbShowMetadata: true,
            tmdbShowGenres: true,
            tmdbShowCast: true,
            tmdbShowProviders: true,
            tmdbShowVideos: true,
            tmdbShowRecommendations: true,
            updatedAt: true,
            files: {
              select: { id: true, fileType: true, isPrimary: true },
              orderBy: { isPrimary: "desc" },
            },
          },
          orderBy: { order: "asc" },
          take: 200,
        });

        const items: ItemWithArtwork[] = publicChildren.map((item) => ({
          id: item.id,
          name: item.name,
          description: item.description,
          parentId: item.parentId,
          order: item.order,
          depth: item.depth,
          userId: item.userId,
          createdAt: new Date(),
          updatedAt: item.updatedAt,
          artworkId: resolveArtworkId(item),
          pinnedOrder: null,
          isPublic: true,
          inheritVisibility: false,
          driveFileId: null,
          driveModifiedAt: null,
          driveThumbnailUrl: null,
          syncStatus: "SYNCED" as const,
          syncError: null,
          driveConnectionId: null,
          tmdbId: item.tmdbId ?? null,
          tmdbType: item.tmdbType ?? null,
          tmdbShowTagline: item.tmdbShowTagline,
          tmdbShowMetadata: item.tmdbShowMetadata,
          tmdbShowGenres: item.tmdbShowGenres,
          tmdbShowCast: item.tmdbShowCast,
          tmdbShowProviders: item.tmdbShowProviders,
          tmdbShowVideos: item.tmdbShowVideos,
          tmdbShowRecommendations: item.tmdbShowRecommendations,
          tmdbPosterPath: item.tmdbPosterPath ?? null,
          tmdbBackdropPath: item.tmdbBackdropPath ?? null,
          tmdbLogoPath: null,
          dominantColour: item.dominantColour ?? null,
          fileCounts: {
            media: item.files.filter((f) => f.fileType === "MEDIA").length,
            artwork: item.files.filter((f) => f.fileType === "ARTWORK").length,
            subtitles: item.files.filter((f) => f.fileType === "SUBTITLE")
              .length,
          },
          childCount: 0,
          primaryMediaName: null,
          primaryDurationMs: null,
          primaryHeight: null,
          mediaIconType: null,
          progress: null,
        }));

        return {
          items,
          isOwner: false,
          parent: parentData,
        };
      }
    }),
});

// =============================================================================
// Internal helper: findFirstIncompleteItem (DFS traversal)
// =============================================================================

interface IncompleteItemInput {
  id: string;
  order: number;
  parentId: string | null;
  hasPrimaryMedia: boolean;
  isWatched: boolean;
}

/**
 * Finds the first incomplete item in DFS order.
 * An item is incomplete if it has primary media and is not watched.
 */
function findFirstIncompleteItem(
  items: IncompleteItemInput[],
  startFromParentId: string | null = null
): string | null {
  if (items.length === 0) return null;

  // Build parent -> children map
  const childrenMap = new Map<string | null, IncompleteItemInput[]>();
  for (const item of items) {
    const siblings = childrenMap.get(item.parentId) ?? [];
    siblings.push(item);
    childrenMap.set(item.parentId, siblings);
  }

  // Sort children by order at each level
  for (const children of childrenMap.values()) {
    children.sort((a, b) => a.order - b.order);
  }

  // DFS traversal
  function traverse(parentId: string | null): string | null {
    const children = childrenMap.get(parentId) ?? [];

    for (const item of children) {
      if (item.hasPrimaryMedia && !item.isWatched) {
        return item.id;
      }

      const found = traverse(item.id);
      if (found) return found;
    }

    return null;
  }

  return traverse(startFromParentId);
}
