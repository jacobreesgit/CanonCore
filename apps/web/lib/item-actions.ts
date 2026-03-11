/**
 * Server actions for item CRUD operations.
 * Handles item hierarchy with ownership verification.
 */

"use server";

import { cache } from "react";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  itemNameSchema,
  itemDescriptionSchema,
  createItemOptionsSchema,
} from "@/lib/validations";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  createDriveFolderOnly,
  renameItemInGoogleDrive,
  moveItemInGoogleDrive,
} from "@/lib/google-drive-actions";
import { batchDelete } from "@/lib/google-drive-client";
import { decryptCredential } from "@/lib/crypto";
import { logger } from "@/lib/logger";
import { handlePrismaError } from "@/lib/errors";
import { resolveArtworkId } from "@/lib/tmdb-image-utils";
import type {
  Item,
  ItemResult,
  BreadcrumbItem,
  ItemWithArtwork,
  SearchableItem,
  PinnedItem,
  NextItem,
} from "@/lib/types";
import { buildDescendantCounter, getMediaIconType } from "@/lib/item-utils";
import {
  type ItemProgress,
  findFirstIncompleteItem,
} from "@/lib/progress-utils";
import { MAX_ITEM_DEPTH } from "@/lib/config/items";
import {
  getPublicItemsForUser,
  getPublicChildItems,
  isItemFullyPublic,
} from "@/lib/public-auth";

// =============================================================================
// Shared ItemWithArtwork mapper
// =============================================================================

/**
 * Minimal input shape for the shared toItemWithArtwork mapper.
 * Matches the Prisma include used by getItems, getAllItems, getDescendants,
 * getItemsForProfile (owner), and getItemChildrenForProfile (owner).
 */
interface ItemWithFiles {
  id: string;
  name: string;
  description: string | null;
  parentId: string | null;
  order: number;
  depth: number;
  pinnedOrder: number | null;
  isPublic: boolean;
  inheritVisibility: boolean;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  driveFileId: string | null;
  driveModifiedAt: Date | null;
  driveThumbnailUrl: string | null;
  syncStatus: "SYNCED" | "PENDING" | "SYNCING" | "ERROR";
  syncError: string | null;
  driveConnectionId: string | null;
  tmdbId: number | null;
  tmdbType: string | null;
  tmdbPosterPath: string | null;
  tmdbBackdropPath: string | null;
  tmdbLogoPath: string | null;
  dominantColour: string | null;
  tmdbShowTagline: boolean;
  tmdbShowMetadata: boolean;
  tmdbShowGenres: boolean;
  tmdbShowCast: boolean;
  tmdbShowProviders: boolean;
  tmdbShowVideos: boolean;
  tmdbShowRecommendations: boolean;
  files: {
    id: string;
    fileType: string;
    isPrimary: boolean;
    filename: string;
    mimeType: string | null;
    durationMs: bigint | null;
    height: number | null;
  }[];
}

/**
 * Maps a Prisma item (with files) to the ItemWithArtwork shape.
 * Resolves artwork, primary media name, file counts, media icon type,
 * and attaches pre-computed childCount and progress.
 *
 * @param item - Prisma item with included files
 * @param childCount - Pre-computed descendant count
 * @param progress - Pre-computed progress data (null if no media in subtree)
 * @returns ItemWithArtwork for client consumption
 */
function toItemWithArtwork(
  item: ItemWithFiles,
  childCount: number,
  progress: ItemProgress | null
): ItemWithArtwork {
  const artworkId = resolveArtworkId(item);

  // Find primary media, or first media if no primary
  const primaryMedia = item.files.find(
    (f) => f.fileType === "MEDIA" && f.isPrimary
  );
  const firstMedia = item.files.find((f) => f.fileType === "MEDIA");
  const resolvedPrimaryMedia = primaryMedia ?? firstMedia;
  const primaryMediaName = resolvedPrimaryMedia?.filename ?? null;
  const primaryDurationMs = resolvedPrimaryMedia?.durationMs
    ? Number(resolvedPrimaryMedia.durationMs)
    : null;
  const primaryHeight = resolvedPrimaryMedia?.height ?? null;

  // Calculate file counts by type
  const mediaFiles = item.files.filter((f) => f.fileType === "MEDIA");
  const fileCounts = {
    media: mediaFiles.length,
    artwork: item.files.filter((f) => f.fileType === "ARTWORK").length,
    subtitles: item.files.filter((f) => f.fileType === "SUBTITLE").length,
  };

  // Determine media icon type: film (all video), music (all audio), mixed (both)
  const mediaIconType = getMediaIconType(mediaFiles);

  return {
    id: item.id,
    name: item.name,
    description: item.description,
    parentId: item.parentId,
    order: item.order,
    depth: item.depth,
    pinnedOrder: item.pinnedOrder,
    isPublic: item.isPublic,
    inheritVisibility: item.inheritVisibility,
    userId: item.userId,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    // Google Drive fields
    driveFileId: item.driveFileId,
    driveModifiedAt: item.driveModifiedAt,
    driveThumbnailUrl: item.driveThumbnailUrl,
    syncStatus: item.syncStatus,
    syncError: item.syncError,
    driveConnectionId: item.driveConnectionId,
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
    artworkId,
    fileCounts,
    childCount,
    primaryMediaName,
    primaryDurationMs,
    primaryHeight,
    mediaIconType,
    progress,
  };
}

/**
 * Resolves progress from a progress map for a single item.
 * Returns null if no media files exist in the subtree (percentage is null).
 */
function resolveProgress(
  progressMap: Map<string, ItemProgress>,
  itemId: string
): ItemProgress | null {
  const itemProgress = progressMap.get(itemId);
  return itemProgress && itemProgress.percentage !== null ? itemProgress : null;
}

/**
 * Builds a map of item IDs to their progress (self + all descendants).
 * Uses recursive CTE to count items with watched primary media.
 * Item-based counting: an item is "watched" when it has a WatchRecord
 * (created automatically when playback reaches 80%, or manually by the user).
 *
 * @param userId - User ID for authorization
 * @param itemIds - Array of item IDs to calculate progress for
 * @returns Map of item ID to ItemProgress
 */
async function buildDescendantProgressMap(
  userId: string,
  itemIds: string[]
): Promise<Map<string, ItemProgress>> {
  if (itemIds.length === 0) {
    return new Map();
  }

  // Single query: count items with primary media and watched status
  const progressData = await prisma.$queryRaw<
    Array<{
      rootItemId: string;
      totalItems: bigint;
      itemsWithMedia: bigint;
      watchedItems: bigint;
      progressSum: number;
    }>
  >`
    WITH RECURSIVE descendants AS (
      -- Base: the items themselves
      SELECT id, id as "rootItemId" FROM "Item"
      WHERE id = ANY(${itemIds}) AND "userId" = ${userId}
      UNION ALL
      -- Recursive: all descendants
      SELECT i.id, d."rootItemId"
      FROM "Item" i
      INNER JOIN descendants d ON i."parentId" = d.id
      WHERE i."userId" = ${userId}
    )
    SELECT
      d."rootItemId",
      COUNT(DISTINCT d.id) as "totalItems",
      COUNT(DISTINCT CASE WHEN f.id IS NOT NULL THEN d.id END) as "itemsWithMedia",
      COUNT(DISTINCT CASE
        WHEN EXISTS(
          SELECT 1 FROM "WatchRecord" wr
          WHERE wr."itemId" = d.id AND wr."userId" = ${userId}
        )
        THEN d.id
      END) as "watchedItems",
      COALESCE(SUM(
        CASE
          WHEN f.id IS NOT NULL THEN
            CASE
              WHEN EXISTS(
                SELECT 1 FROM "WatchRecord" wr
                WHERE wr."itemId" = d.id AND wr."userId" = ${userId}
              ) THEN 1.0
              WHEN f."playbackPosition" IS NOT NULL
                AND f."playbackDuration" IS NOT NULL
                AND f."playbackDuration" > 0
              THEN LEAST(f."playbackPosition"::float / f."playbackDuration"::float, 1.0)
              ELSE 0.0
            END
          ELSE NULL
        END
      ), 0) as "progressSum"
    FROM descendants d
    LEFT JOIN "ItemFile" f ON f."itemId" = d.id
      AND f."fileType" = 'MEDIA'
      AND f."isPrimary" = true
    GROUP BY d."rootItemId"
  `;

  // Build progress map from query results
  const progressMap = new Map<string, ItemProgress>();

  for (const row of progressData) {
    const totalItems = Number(row.totalItems);
    const itemsWithMedia = Number(row.itemsWithMedia);
    const watchedItems = Number(row.watchedItems);
    const progressSum = Number(row.progressSum);

    progressMap.set(row.rootItemId, {
      watchedItems,
      itemsWithMedia,
      percentage:
        itemsWithMedia > 0
          ? Math.round((progressSum / itemsWithMedia) * 100)
          : null,
      totalItems,
    });
  }

  // Ensure all requested items have an entry (even if not in results)
  for (const itemId of itemIds) {
    if (!progressMap.has(itemId)) {
      progressMap.set(itemId, {
        watchedItems: 0,
        itemsWithMedia: 0,
        percentage: null,
        totalItems: 0,
      });
    }
  }

  return progressMap;
}

/**
 * Fetches progress for a single item (self + all descendants).
 * Returns null if no media files exist in the subtree.
 *
 * @param itemId - Item ID to get progress for
 * @returns Progress data or null if no media files
 */
export async function getItemProgress(
  itemId: string
): Promise<ItemProgress | null> {
  const session = await auth();
  if (!session?.user?.id) {
    return null;
  }

  const progressMap = await buildDescendantProgressMap(session.user.id, [
    itemId,
  ]);
  const progress = progressMap.get(itemId);

  // Return null if no media files (percentage is null)
  if (!progress || progress.percentage === null) {
    return null;
  }

  return progress;
}

/**
 * Fetches progress across all items in the user's library.
 * Returns aggregate completion stats for the entire collection.
 * Item-based counting: an item is "watched" when it has a WatchRecord.
 *
 * @returns Library-wide progress data or null if no items
 */
export async function getLibraryProgress(): Promise<ItemProgress | null> {
  const session = await auth();
  if (!session?.user?.id) {
    return null;
  }

  // Count items with primary media and watched status (single query)
  const result = await prisma.$queryRaw<
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
          WHERE wr."itemId" = i.id AND wr."userId" = ${session.user.id}
        )
        THEN i.id
      END) as "watchedItems"
    FROM "Item" i
    LEFT JOIN "ItemFile" f ON f."itemId" = i.id
      AND f."fileType" = 'MEDIA'
      AND f."isPrimary" = true
    WHERE i."userId" = ${session.user.id}
  `;

  if (result.length === 0) {
    return null;
  }

  const row = result[0];
  const totalItems = Number(row.totalItems);
  const itemsWithMedia = Number(row.itemsWithMedia);
  const watchedItems = Number(row.watchedItems);

  // Return null if no items
  if (totalItems === 0) {
    return null;
  }

  return {
    watchedItems,
    itemsWithMedia,
    percentage:
      itemsWithMedia > 0
        ? Math.round((watchedItems / itemsWithMedia) * 100)
        : null,
    totalItems,
  };
}

/**
 * Gets the first incomplete item in DFS order.
 * Used for "Go to" button on My Items and item detail pages.
 * An item is incomplete if it has primary media and no WatchRecord.
 *
 * @param parentId - Optional parent ID to search within (null = entire library)
 * @returns First incomplete item data or null if all complete
 */
export async function getFirstIncompleteItem(
  parentId?: string | null
): Promise<ItemResult<NextItem | null>> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Unauthorized" };
  }

  try {
    // Query items with their primary media and watch status
    // Uses recursive CTE if parentId specified, otherwise fetches all
    const itemsWithProgress = parentId
      ? await prisma.$queryRaw<
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
            SELECT id FROM "Item" WHERE "parentId" = ${parentId} AND "userId" = ${session.user.id}
            UNION ALL
            SELECT i.id FROM "Item" i
            INNER JOIN descendants d ON i."parentId" = d.id
            WHERE i."userId" = ${session.user.id}
          )
          SELECT
            i.id,
            i.name,
            i."order",
            i."parentId",
            EXISTS(SELECT 1 FROM "ItemFile" f WHERE f."itemId" = i.id AND f."fileType" = 'MEDIA' AND f."isPrimary" = true) as "hasPrimaryMedia",
            EXISTS(SELECT 1 FROM "WatchRecord" wr WHERE wr."itemId" = i.id AND wr."userId" = ${session.user.id}) as "isWatched"
          FROM "Item" i
          WHERE i.id IN (SELECT id FROM descendants)
          ORDER BY i."order"
        `
      : await prisma.$queryRaw<
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
            EXISTS(SELECT 1 FROM "WatchRecord" wr WHERE wr."itemId" = i.id AND wr."userId" = ${session.user.id}) as "isWatched"
          FROM "Item" i
          WHERE i."userId" = ${session.user.id}
          ORDER BY i."order"
        `;

    // Find first incomplete using utility function
    // When filtering by parentId, start traversal from that parent
    const incompleteId = findFirstIncompleteItem(
      itemsWithProgress.map((item) => ({
        id: item.id,
        order: item.order,
        parentId: item.parentId,
        hasPrimaryMedia: item.hasPrimaryMedia,
        isWatched: item.isWatched,
      })),
      parentId ?? null
    );

    if (!incompleteId) {
      return { success: true, data: null };
    }

    // Get full data for the incomplete item
    const incompleteItem = itemsWithProgress.find((i) => i.id === incompleteId);
    if (!incompleteItem) {
      return { success: true, data: null };
    }

    return {
      success: true,
      data: {
        id: incompleteItem.id,
        name: incompleteItem.name,
      },
    };
  } catch (error) {
    logger.error({ error }, "Failed to get first incomplete item");
    return { error: "Failed to get next item" };
  }
}

/**
 * Fetches items for a given parent with artwork thumbnails.
 * Returns root items if parentId is null.
 * Includes the first artwork file ID for each item for thumbnail display.
 * Uses React.cache() for per-request deduplication when called from multiple Server Components.
 *
 * @param parentId - Parent item ID or null for root
 * @returns Items array with artworkId or error
 */
export const getItems = cache(async function getItems(
  parentId: string | null
): Promise<ItemResult<ItemWithArtwork[]>> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Unauthorized" };
  }

  // Parallelize independent queries: descendant counting + current level items
  const [allItems, items] = await Promise.all([
    prisma.item.findMany({
      where: { userId: session.user.id },
      select: { id: true, parentId: true },
    }),
    prisma.item.findMany({
      where: {
        userId: session.user.id,
        parentId: parentId,
      },
      orderBy: { order: "asc" },
      include: {
        files: {
          select: {
            id: true,
            fileType: true,
            isPrimary: true,
            filename: true,
            mimeType: true,
            durationMs: true,
            height: true,
          },
        },
        driveConnection: {
          select: { id: true },
        },
      },
    }),
  ]);

  // Use helper to build descendant counter (DRY)
  const countDescendants = buildDescendantCounter(allItems);

  // Build progress map for all items (single query for efficiency)
  const progressMap = await buildDescendantProgressMap(
    session.user.id,
    items.map((i) => i.id)
  );

  // Transform to ItemWithArtwork with file counts and descendant count
  const itemsWithArtwork: ItemWithArtwork[] = items.map((item) =>
    toItemWithArtwork(
      item,
      countDescendants(item.id),
      resolveProgress(progressMap, item.id)
    )
  );

  return { success: true, data: itemsWithArtwork };
});

/**
 * Fetches ALL items for the current user with artwork thumbnails.
 * Returns full hierarchy (all levels) for inline tree display.
 * Items are ordered by depth then order for proper tree building.
 * Uses React.cache() for per-request deduplication when called from multiple Server Components.
 *
 * @returns All items array with artworkId or error
 */
export const getAllItems = cache(async function getAllItems(): Promise<
  ItemResult<ItemWithArtwork[]>
> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Unauthorized" };
  }

  // Parallelize independent queries: descendant counting + all items with files
  const [allItems, items] = await Promise.all([
    prisma.item.findMany({
      where: { userId: session.user.id },
      select: { id: true, parentId: true },
    }),
    prisma.item.findMany({
      where: {
        userId: session.user.id,
      },
      orderBy: [{ depth: "asc" }, { order: "asc" }],
      include: {
        files: {
          select: {
            id: true,
            fileType: true,
            isPrimary: true,
            filename: true,
            mimeType: true,
            durationMs: true,
            height: true,
          },
        },
        driveConnection: {
          select: { id: true },
        },
      },
    }),
  ]);

  // Use helper to build descendant counter (DRY)
  const countDescendants = buildDescendantCounter(allItems);

  // Build progress map for all items (single query for efficiency)
  const progressMap = await buildDescendantProgressMap(
    session.user.id,
    items.map((i) => i.id)
  );

  // Transform to ItemWithArtwork with file counts and descendant count
  const itemsWithArtwork: ItemWithArtwork[] = items.map((item) =>
    toItemWithArtwork(
      item,
      countDescendants(item.id),
      resolveProgress(progressMap, item.id)
    )
  );

  return { success: true, data: itemsWithArtwork };
});

/**
 * Fetches all descendants of an item (children, grandchildren, etc.).
 * Used for displaying full subtree on item detail pages.
 * Uses React.cache() for per-request deduplication when called from multiple Server Components.
 *
 * @param parentId - Parent item ID
 * @returns All descendant items with artworkId or error
 */
export const getDescendants = cache(async function getDescendants(
  parentId: string
): Promise<ItemResult<ItemWithArtwork[]>> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Unauthorized" };
  }

  // Verify parent ownership
  const parent = await prisma.item.findFirst({
    where: { id: parentId, userId: session.user.id },
  });
  if (!parent) {
    return { error: "Item not found" };
  }

  // Use recursive CTE to get all descendants
  const descendants = await prisma.$queryRaw<{ id: string }[]>`
    WITH RECURSIVE descendants AS (
      SELECT id, "parentId"
      FROM "Item"
      WHERE "parentId" = ${parentId} AND "userId" = ${session.user.id}
      UNION ALL
      SELECT i.id, i."parentId"
      FROM "Item" i
      INNER JOIN descendants d ON i."parentId" = d.id
      WHERE i."userId" = ${session.user.id}
    )
    SELECT id FROM descendants
  `;

  const descendantIds = descendants.map((d) => d.id);

  if (descendantIds.length === 0) {
    return { success: true, data: [] };
  }

  // Fetch full item data (single query instead of two)
  const items = await prisma.item.findMany({
    where: { id: { in: descendantIds } },
    orderBy: [{ depth: "asc" }, { order: "asc" }],
    include: {
      files: {
        select: {
          id: true,
          fileType: true,
          isPrimary: true,
          filename: true,
          mimeType: true,
          durationMs: true,
          height: true,
        },
      },
      driveConnection: {
        select: { id: true },
      },
    },
  });

  // Build descendant count map from fetched items (DRY)
  const countDescendants = buildDescendantCounter(
    items.map((item) => ({ id: item.id, parentId: item.parentId }))
  );

  // Build progress map for all items (single query for efficiency)
  const progressMap = await buildDescendantProgressMap(
    session.user.id,
    items.map((i) => i.id)
  );

  const itemsWithArtwork: ItemWithArtwork[] = items.map((item) =>
    toItemWithArtwork(
      item,
      countDescendants(item.id),
      resolveProgress(progressMap, item.id)
    )
  );

  return { success: true, data: itemsWithArtwork };
});

/**
 * Fetches a single item with its ancestors for breadcrumbs.
 *
 * @param id - Item ID
 * @returns Item with ancestors or error
 */
export async function getItem(
  id: string
): Promise<ItemResult<{ item: Item; ancestors: BreadcrumbItem[] }>> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Unauthorized" };
  }

  const item = await prisma.item.findUnique({
    where: { id },
  });

  if (!item) {
    return { error: "Item not found" };
  }

  if (item.userId !== session.user.id) {
    return { error: "Unauthorized" };
  }

  // Build ancestors chain using recursive CTE (single query instead of N+1)
  const ancestors = item.parentId
    ? await prisma.$queryRaw<BreadcrumbItem[]>`
        WITH RECURSIVE ancestors AS (
          -- Base case: start with the direct parent
          SELECT id, name, "parentId", 1 as depth
          FROM "Item"
          WHERE id = ${item.parentId}

          UNION ALL

          -- Recursive case: get each parent's parent (scoped to current user as defense-in-depth)
          SELECT i.id, i.name, i."parentId", a.depth + 1
          FROM "Item" i
          INNER JOIN ancestors a ON i.id = a."parentId"
          WHERE i."userId" = ${session.user.id}
        )
        SELECT id, name FROM ancestors
        ORDER BY depth DESC
      `
    : [];

  return {
    success: true,
    data: { item, ancestors },
  };
}

/**
 * Creates a new item.
 * Enforces max depth of 10 levels.
 *
 * @param parentId - Parent item ID or null for root
 * @param name - Item name
 * @param description - Optional short description (max 200 chars)
 * @returns Created item or error
 */
export async function createItem(
  parentId: string | null,
  name: string,
  description?: string,
  options?: { isPublic?: boolean; inheritVisibility?: boolean }
): Promise<ItemResult<Item>> {
  // Run rate limit and auth in parallel (async-parallel pattern)
  const [rateLimitResult, session] = await Promise.all([
    checkRateLimit("itemCreate"),
    auth(),
  ]);

  if (rateLimitResult) {
    return { error: rateLimitResult.error };
  }

  if (!session?.user?.id) {
    return { error: "Unauthorized" };
  }

  // Validate name
  const nameValidation = itemNameSchema.safeParse(name);
  if (!nameValidation.success) {
    return { error: nameValidation.error.issues[0].message };
  }

  // Validate description if provided
  let validatedDescription: string | null = null;
  if (description !== undefined && description !== "") {
    const descValidation = itemDescriptionSchema.safeParse(description);
    if (!descValidation.success) {
      return { error: descValidation.error.issues[0].message };
    }
    validatedDescription = descValidation.data || null;
  }

  // Validate visibility options
  const visibilityDefaults = { isPublic: false, inheritVisibility: false };
  let visibilityOptions = visibilityDefaults;
  if (options) {
    const visResult = createItemOptionsSchema.safeParse(options);
    if (!visResult.success) {
      return {
        error:
          visResult.error.issues[0]?.message ?? "Invalid visibility options",
      };
    }
    visibilityOptions = visResult.data;
  }

  // Reject inheritVisibility on root items
  if (visibilityOptions.inheritVisibility && !parentId) {
    return { error: "Root items cannot inherit visibility" };
  }

  let depth = 0;

  // Check parent exists and user owns it
  if (parentId) {
    const parent = await prisma.item.findUnique({
      where: { id: parentId },
      select: { depth: true, userId: true },
    });

    if (!parent || parent.userId !== session.user.id) {
      return { error: "Parent not found" };
    }

    if (parent.depth >= MAX_ITEM_DEPTH - 1) {
      return { error: "Maximum nesting depth reached" };
    }

    depth = parent.depth + 1;
  }

  // Get max order for siblings
  const maxOrderResult = await prisma.item.aggregate({
    where: {
      userId: session.user.id,
      parentId: parentId,
    },
    _max: { order: true },
  });

  const order = (maxOrderResult._max.order ?? -1) + 1;

  let item;
  try {
    item = await prisma.item.create({
      data: {
        name: nameValidation.data,
        description: validatedDescription,
        parentId,
        order,
        depth,
        userId: session.user.id,
        isPublic: visibilityOptions.isPublic,
        inheritVisibility: visibilityOptions.inheritVisibility,
      },
    });
  } catch (error) {
    const errorResult = handlePrismaError(error);
    if (errorResult) return errorResult;
    throw error;
  }

  // Sync to Google Drive if user has connection
  const connection = await prisma.googleDriveConnection.findUnique({
    where: { userId: session.user.id },
  });

  if (connection) {
    // Create folder in Drive (async, don't block UI response)
    // Note: revalidatePath runs before Drive sync completes - UI may show stale syncStatus briefly
    // Uses createDriveFolderOnly which only creates Drive folder, NOT a duplicate Item
    after(() => {
      createDriveFolderOnly(parentId, nameValidation.data)
        .then(async (result) => {
          if (result.success && result.data) {
            // Update item with Drive file ID
            await prisma.item.update({
              where: { id: item.id },
              data: {
                driveFileId: result.data.driveFileId,
                driveConnectionId: connection.id,
                syncStatus: "SYNCED",
              },
            });
          } else if (!result.success) {
            // Mark as pending if Drive folder creation failed
            await prisma.item
              .update({
                where: { id: item.id },
                data: { syncStatus: "PENDING" },
              })
              .catch((err) => {
                logger.warn({ err }, "Secondary operation failed");
              });
          }
        })
        .catch(async (err) => {
          logger.error(
            { err, itemId: item.id },
            "Failed to create folder in Drive"
          );
          // Mark as pending sync
          await prisma.item
            .update({
              where: { id: item.id },
              data: { syncStatus: "PENDING" },
            })
            .catch((err) => {
              logger.warn({ err }, "Secondary operation failed");
            });
        });
    });
  }

  return { success: true, data: item as Item };
}

/**
 * Updates an item's properties.
 * Verifies ownership before update.
 *
 * @param id - Item ID
 * @param data - Partial item data to update (name and/or description)
 * @returns Success or error
 */
export async function updateItem(
  id: string,
  data: { name?: string; description?: string }
): Promise<ItemResult> {
  // Run rate limit and auth in parallel (async-parallel pattern)
  const [rateLimitResult, session] = await Promise.all([
    checkRateLimit("itemUpdate"),
    auth(),
  ]);

  if (rateLimitResult) {
    return { error: rateLimitResult.error };
  }

  if (!session?.user?.id) {
    return { error: "Unauthorized" };
  }

  const existingItem = await prisma.item.findUnique({
    where: { id },
    select: { userId: true, name: true, driveFileId: true },
  });

  if (!existingItem) {
    return { error: "Item not found" };
  }

  if (existingItem.userId !== session.user.id) {
    return { error: "Unauthorized" };
  }

  // Build update data
  const updateData: { name?: string; description?: string | null } = {};

  // Validate name if provided
  if (data.name !== undefined) {
    const validation = itemNameSchema.safeParse(data.name);
    if (!validation.success) {
      return { error: validation.error.issues[0].message };
    }
    updateData.name = validation.data;
  }

  // Validate description if provided
  if (data.description !== undefined) {
    if (data.description === "") {
      // Empty string clears the description
      updateData.description = null;
    } else {
      const validation = itemDescriptionSchema.safeParse(data.description);
      if (!validation.success) {
        return { error: validation.error.issues[0].message };
      }
      updateData.description = validation.data || null;
    }
  }

  await prisma.item.update({
    where: { id },
    data: updateData,
  });

  // If name changed and item is in Drive, rename there too
  if (
    updateData.name &&
    updateData.name !== existingItem.name &&
    existingItem.driveFileId
  ) {
    const newName = updateData.name;
    after(() => {
      renameItemInGoogleDrive(id, newName).catch((err) => {
        logger.error({ err, itemId: id }, "Failed to rename in Drive");
      });
    });
  }

  return { success: true };
}

/**
 * Deletes an item and all descendants.
 * Verifies ownership before delete.
 * Uses batch delete for Google Drive when item has descendants.
 *
 * @param id - Item ID
 * @returns Success or error
 */
export async function deleteItem(id: string): Promise<ItemResult> {
  // Run rate limit and auth in parallel (async-parallel pattern)
  const [rateLimitResult, session] = await Promise.all([
    checkRateLimit("itemDelete"),
    auth(),
  ]);

  if (rateLimitResult) {
    return { error: rateLimitResult.error };
  }

  if (!session?.user?.id) {
    return { error: "Unauthorized" };
  }

  const item = await prisma.item.findUnique({
    where: { id },
    select: { userId: true, driveFileId: true, driveConnectionId: true },
  });

  if (!item) {
    return { error: "Item not found" };
  }

  if (item.userId !== session.user.id) {
    return { error: "Unauthorized" };
  }

  // Batch delete from Drive if connected (moves to trash, recoverable)
  if (item.driveFileId && item.driveConnectionId) {
    try {
      // Get connection for access token
      const connection = await prisma.googleDriveConnection.findUnique({
        where: { userId: session.user.id },
      });

      if (connection) {
        // Get all descendant driveFileIds using recursive CTE
        const descendants = await prisma.$queryRaw<
          { driveFileId: string | null }[]
        >`
          WITH RECURSIVE descendants AS (
            SELECT id, "driveFileId"
            FROM "Item"
            WHERE "parentId" = ${id} AND "userId" = ${session.user.id}
            UNION ALL
            SELECT i.id, i."driveFileId"
            FROM "Item" i
            INNER JOIN descendants d ON i."parentId" = d.id
            WHERE i."userId" = ${session.user.id}
          )
          SELECT "driveFileId" FROM descendants
        `;

        // Collect all driveFileIds (parent + descendants), filtering nulls
        const driveFileIds = [
          item.driveFileId,
          ...descendants
            .map((d) => d.driveFileId)
            .filter((id): id is string => id !== null),
        ];

        // Decrypt access token and batch delete
        if (!connection.encryptedAccessToken) {
          throw new Error("No access token available");
        }
        const accessToken = decryptCredential(connection.encryptedAccessToken);
        const result = await batchDelete(accessToken, driveFileIds);

        // Log any failures but continue with local delete
        if (result.failed.length > 0) {
          logger.warn(
            { itemId: id, failed: result.failed },
            "Some Drive files failed to delete"
          );
        }
      }
    } catch (error) {
      // Log but continue with local delete
      logger.error({ error, itemId: id }, "Failed to batch delete from Drive");
    }
  }

  // Always delete from local DB (Drive delete is soft-delete to trash)
  await prisma.item.delete({
    where: { id },
  });

  return { success: true };
}

/**
 * Moves an item to a new parent folder (or root).
 * Prevents circular moves (item cannot become a descendant of itself).
 * Appends to end of destination with correct ordering.
 * Syncs the move to Google Drive.
 *
 * @param itemId - ID of the item to move
 * @param newParentId - Destination parent ID (null for root)
 * @returns Success or error
 */
export async function moveItem(
  itemId: string,
  newParentId: string | null
): Promise<ItemResult> {
  const [rateLimitResult, session] = await Promise.all([
    checkRateLimit("itemUpdate"),
    auth(),
  ]);

  if (rateLimitResult) return { error: rateLimitResult.error };
  if (!session?.user?.id) return { error: "Not authenticated" };

  const userId = session.user.id;

  // Fetch the item being moved
  const item = await prisma.item.findFirst({
    where: { id: itemId, userId },
    select: { id: true, parentId: true, driveFileId: true, depth: true },
  });
  if (!item) return { error: "Item not found" };
  if (item.parentId === newParentId) return { success: true };

  // Prevent moving into self
  if (newParentId === itemId) return { error: "Cannot move item into itself" };

  // Verify new parent ownership and prevent circular reference
  let newDepth = 0;
  if (newParentId) {
    const parent = await prisma.item.findFirst({
      where: { id: newParentId, userId },
      select: { id: true, depth: true },
    });
    if (!parent) return { error: "Destination not found" };
    newDepth = parent.depth + 1;

    // Check that the new parent is not a descendant of the item
    // Walk up the tree from newParent to check for cycles
    const visited = new Set<string>([itemId]);
    let currentId: string | null = newParentId;
    while (currentId) {
      if (visited.has(currentId))
        return { error: "Cannot create circular hierarchy" };
      visited.add(currentId);
      const ancestor: { parentId: string | null } | null =
        await prisma.item.findFirst({
          where: { id: currentId, userId },
          select: { parentId: true },
        });
      currentId = ancestor?.parentId ?? null;
    }
  }

  if (newDepth >= MAX_ITEM_DEPTH) {
    return { error: "Maximum nesting depth reached" };
  }

  // Get descendants via recursive CTE (only the subtree, not all user items)
  const descendants = await prisma.$queryRaw<
    Array<{ id: string; depth: number }>
  >`
    WITH RECURSIVE subtree AS (
      SELECT id, "parentId", depth FROM "Item"
        WHERE "parentId" = ${itemId} AND "userId" = ${userId}
      UNION ALL
      SELECT i.id, i."parentId", i.depth FROM "Item" i
        JOIN subtree s ON i."parentId" = s.id
    )
    SELECT id, depth FROM subtree
  `;

  // Validate that the deepest descendant won't exceed MAX_ITEM_DEPTH after move
  const depthDelta = newDepth - item.depth;
  if (descendants.length > 0) {
    const maxDescendantDepth = Math.max(...descendants.map((d) => d.depth));
    if (maxDescendantDepth + depthDelta >= MAX_ITEM_DEPTH) {
      return {
        error: "Moving here would push descendants beyond maximum depth",
      };
    }
  }

  // Get max order in destination to append at end
  const maxOrderResult = await prisma.item.aggregate({
    where: { userId, parentId: newParentId },
    _max: { order: true },
  });
  const newOrder = (maxOrderResult._max.order ?? 0) + 1;

  // Update item and descendants in transaction
  await prisma.$transaction(async (tx) => {
    // Move the item
    await tx.item.update({
      where: { id: itemId },
      data: { parentId: newParentId, order: newOrder, depth: newDepth },
    });

    // Update descendant depths if depth changed
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

  // Sync move to Drive (async, don't block response)
  if (item.driveFileId) {
    after(() => {
      moveItemInGoogleDrive(itemId, newParentId, item.parentId).catch((err) => {
        logger.error({ err, itemId }, "Failed to move item in Drive");
      });
    });
  }

  revalidatePath("/u", "layout");
  return { success: true };
}

/**
 * Batch reorders items. Used after drag operations.
 * Verifies ownership of ALL items before update.
 * Syncs parent changes to Google Drive.
 *
 * @param updates - Array of item updates with new order/parentId
 * @returns Success or error
 */
export async function reorderItems(
  updates: {
    id: string;
    order: number;
    parentId?: string | null;
    depth?: number;
  }[]
): Promise<ItemResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Unauthorized" };
  }

  if (updates.length === 0) {
    return { success: true };
  }

  // Verify ownership and get current parent IDs to detect moves
  const itemIds = updates.map((u) => u.id);
  const items = await prisma.item.findMany({
    where: { id: { in: itemIds } },
    select: {
      id: true,
      userId: true,
      depth: true,
      parentId: true,
      driveFileId: true,
    },
  });

  // Check all items exist
  if (items.length !== itemIds.length) {
    return { error: "Some items not found" };
  }

  // Check all items belong to user
  const userId = session.user.id;
  const unauthorized = items.some((item) => item.userId !== userId);
  if (unauthorized) {
    return { error: "Unauthorized" };
  }

  // Check depth constraints for any parentId changes
  for (const update of updates) {
    if (update.depth !== undefined && update.depth >= MAX_ITEM_DEPTH) {
      return { error: "Maximum nesting depth reached" };
    }
  }

  // Build map of current parent IDs for detecting moves
  const currentParentMap = new Map(
    items.map((i) => [
      i.id,
      { parentId: i.parentId, driveFileId: i.driveFileId },
    ])
  );

  // Perform batch update in transaction
  await prisma.$transaction(
    updates.map((update) =>
      prisma.item.update({
        where: { id: update.id },
        data: {
          order: update.order,
          ...(update.parentId !== undefined && { parentId: update.parentId }),
          ...(update.depth !== undefined && { depth: update.depth }),
        },
      })
    )
  );

  // Sync moves to Drive (async, don't block response)
  after(() => {
    for (const update of updates) {
      const current = currentParentMap.get(update.id);
      if (
        current?.driveFileId &&
        update.parentId !== undefined &&
        current.parentId !== update.parentId
      ) {
        // Parent changed - move in Drive (pass old parentId since DB already updated)
        moveItemInGoogleDrive(
          update.id,
          update.parentId,
          current.parentId
        ).catch((err) => {
          logger.error({ err, itemId: update.id }, "Failed to move in Drive");
        });
      }
    }
  });

  return { success: true };
}

/**
 * Fetches all items for spotlight search.
 * Returns item data with primary artwork and breadcrumb paths for client-side fuzzy filtering.
 * Limited to 500 items for performance.
 *
 * Includes:
 * - Primary artwork ID for thumbnail display
 * - Breadcrumb path for nested items (e.g., "Movies / Star Wars")
 *
 * @returns SearchableItem array or error
 */
export async function getSearchableItems(): Promise<
  ItemResult<SearchableItem[]>
> {
  // Run rate limit and auth in parallel (async-parallel pattern)
  const [rateLimitResult, session] = await Promise.all([
    checkRateLimit("itemSearch"),
    auth(),
  ]);

  if (rateLimitResult) {
    return { error: rateLimitResult.error };
  }

  if (!session?.user?.id) {
    return { error: "Not authenticated" };
  }

  try {
    // Fetch items and user's username in parallel
    const [items, user] = await Promise.all([
      prisma.item.findMany({
        where: { userId: session.user.id },
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
            orderBy: { isPrimary: "desc" }, // Primary first, then others
          },
        },
        orderBy: { name: "asc" },
        take: 500,
      }),
      prisma.user.findUnique({
        where: { id: session.user.id },
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

    /**
     * Builds breadcrumb path by walking up the parent chain.
     * Returns path like "Movies / Star Wars" for nested items.
     */
    const buildBreadcrumb = (parentId: string | null): string | null => {
      if (!parentId) return null;

      const parts: string[] = [];
      let currentId: string | null = parentId;

      // Walk up parent chain (max 10 levels to prevent infinite loops)
      for (let i = 0; i < 10 && currentId; i++) {
        const parent = itemMap.get(currentId);
        if (!parent) break;
        parts.unshift(parent.name);
        currentId = parent.parentId;
      }

      return parts.length > 0 ? parts.join(" / ") : null;
    };

    // Map items to searchable format
    // Use first artwork file (primary is sorted first)
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

    return { success: true, data: searchableItems };
  } catch (error) {
    logger.error({ error }, "Failed to fetch searchable items");
    return { error: "Failed to fetch items" };
  }
}

/**
 * Deletes multiple items in bulk.
 * Only deletes items owned by the authenticated user.
 * Children are automatically deleted via Prisma cascade.
 *
 * @param itemIds - Array of item IDs to delete
 * @returns Result with deletion count
 *
 * @example
 * const result = await deleteItems(["item-1", "item-2", "item-3"]);
 * if (result.success) {
 *   console.log(`Deleted ${result.data.deleted} items`);
 * }
 */
export async function deleteItems(
  itemIds: string[]
): Promise<ItemResult<{ deleted: number; skipped: number }>> {
  // Run rate limit and auth in parallel (async-parallel pattern)
  const [rateLimitResult, session] = await Promise.all([
    checkRateLimit("itemDelete"),
    auth(),
  ]);

  if (rateLimitResult) {
    return { error: rateLimitResult.error };
  }

  if (!session?.user?.id) {
    return { error: "Not authenticated" };
  }

  if (itemIds.length === 0) {
    return { error: "No items to delete" };
  }

  try {
    // Find items that belong to this user
    const items = await prisma.item.findMany({
      where: {
        id: { in: itemIds },
        userId: session.user.id,
      },
      select: {
        id: true,
        driveFileId: true,
        driveConnectionId: true,
      },
    });

    const ownedIds = items.map((item) => item.id);
    const skipped = itemIds.length - ownedIds.length;

    if (ownedIds.length === 0) {
      return { error: "No items found to delete" };
    }

    // Check if any items have Drive connections
    const itemsWithDrive = items.filter(
      (item) => item.driveFileId && item.driveConnectionId
    );

    // Batch delete from Drive if any items are connected (moves to trash, recoverable)
    if (itemsWithDrive.length > 0) {
      try {
        // Get connection for access token
        const connection = await prisma.googleDriveConnection.findUnique({
          where: { userId: session.user.id },
        });

        if (connection?.encryptedAccessToken) {
          // Collect parent driveFileIds
          const parentDriveFileIds = itemsWithDrive
            .map((item) => item.driveFileId)
            .filter((id): id is string => id !== null);

          // Get all root item IDs for descendant query
          const rootItemIds = itemsWithDrive.map((item) => item.id);

          // Single CTE query to get all descendants of all selected items
          const descendants = await prisma.$queryRaw<
            { driveFileId: string | null }[]
          >`
            WITH RECURSIVE descendants AS (
              SELECT id, "driveFileId"
              FROM "Item"
              WHERE "parentId" = ANY(${rootItemIds}) AND "userId" = ${session.user.id}
              UNION ALL
              SELECT i.id, i."driveFileId"
              FROM "Item" i
              INNER JOIN descendants d ON i."parentId" = d.id
              WHERE i."userId" = ${session.user.id}
            )
            SELECT "driveFileId" FROM descendants
          `;

          // Combine parent + descendant driveFileIds
          const descendantDriveFileIds = descendants
            .map((d) => d.driveFileId)
            .filter((id): id is string => id !== null);

          // Dedupe and batch delete from Drive
          const allDriveFileIds = [
            ...parentDriveFileIds,
            ...descendantDriveFileIds,
          ];
          const uniqueDriveFileIds = [...new Set(allDriveFileIds)];
          if (uniqueDriveFileIds.length > 0) {
            const accessToken = decryptCredential(
              connection.encryptedAccessToken
            );
            const result = await batchDelete(accessToken, uniqueDriveFileIds);

            // Log any failures but continue with local delete
            if (result.failed.length > 0) {
              logger.warn(
                { itemIds: ownedIds, failed: result.failed },
                "[BulkDelete] Some Drive files failed to delete"
              );
            }
          }
        }
      } catch (error) {
        // Log but continue with local delete - Drive delete is recoverable
        logger.error(
          { error, itemIds: ownedIds },
          "[BulkDelete] Failed to batch delete from Drive"
        );
      }
    }

    // Delete from database (cascade handles children and files)
    const { count } = await prisma.item.deleteMany({
      where: { id: { in: ownedIds } },
    });

    return {
      success: true,
      data: { deleted: count, skipped },
    };
  } catch (error) {
    logger.error({ err: error }, "[BulkDelete] Delete failed");
    return { error: "Failed to delete items" };
  }
}

/**
 * Options for applying TMDB metadata to a new item.
 */
export interface CreateItemMetadataOptions {
  /** TMDB ID of the movie or TV show */
  tmdbId: number;
  /** Whether this is a movie or TV show */
  mediaType: "movie" | "tv";
  /** Fields to update */
  options: {
    updateName: boolean;
    updateDescription: boolean;
    updatePoster: boolean;
    updateBackdrop: boolean;
  };
  /** Per-item TMDB display preferences */
  displayOptions?: import("@/lib/types").TmdbDisplayOptions;
}

/**
 * Creates a new item with optional TMDB metadata applied atomically.
 * First creates the item, then applies TMDB metadata if provided.
 * Handles poster and backdrop downloads with Google Drive upload.
 *
 * @param parentId - Parent item ID or null for root
 * @param name - Initial item name (may be overwritten by TMDB)
 * @param description - Optional initial description (may be overwritten by TMDB)
 * @param metadata - Optional TMDB metadata to apply
 * @returns Created item with metadata applied, or error
 */
export async function createItemWithMetadata(
  parentId: string | null,
  name: string,
  description?: string,
  metadata?: CreateItemMetadataOptions
): Promise<ItemResult<Item>> {
  // First create the item using existing createItem
  const createResult = await createItem(parentId, name, description);

  if (!createResult.success || !createResult.data) {
    return createResult;
  }

  const item = createResult.data;

  // If no metadata, return the created item immediately
  if (!metadata) {
    return { success: true, data: item };
  }

  // Import TMDB functions dynamically to avoid circular dependencies
  const { applyMetadataAction } = await import("@/lib/tmdb-actions");

  // Apply TMDB metadata with the specified options
  const metadataResult = await applyMetadataAction(
    item.id,
    metadata.tmdbId,
    metadata.mediaType,
    metadata.options,
    metadata.displayOptions
  );

  if (!metadataResult.success) {
    // Log the error but return the item since it was created successfully
    logger.warn(
      { itemId: item.id, error: metadataResult.error },
      "Item created but metadata apply failed"
    );
  }

  // Re-fetch the item to get updated metadata
  const updatedItem = await prisma.item.findUnique({
    where: { id: item.id },
  });

  return { success: true, data: (updatedItem ?? item) as Item };
}

// =============================================================================
// Pinned Items Actions
// =============================================================================

const MAX_PINNED_ITEMS = 10;

/**
 * Pins an item to the sidebar.
 * Limited to 10 pinned items per user.
 * Uses a transaction to prevent race conditions when checking the limit.
 *
 * @param id - Item ID to pin
 * @returns Success or error
 */
export async function pinItem(id: string): Promise<ItemResult> {
  // Run rate limit and auth in parallel (async-parallel pattern)
  const [rateLimitResult, session] = await Promise.all([
    checkRateLimit("itemPin"),
    auth(),
  ]);

  if (rateLimitResult) {
    return { error: rateLimitResult.error };
  }

  if (!session?.user?.id) {
    return { error: "Unauthorized" };
  }

  const userId = session.user.id;

  // Use transaction to prevent TOCTOU race condition
  // Without this, concurrent requests could exceed the 10-item limit
  try {
    await prisma.$transaction(async (tx) => {
      const item = await tx.item.findUnique({
        where: { id },
        select: { userId: true, pinnedOrder: true },
      });

      if (!item) {
        throw new Error("Item not found");
      }

      if (item.userId !== userId) {
        throw new Error("Unauthorized");
      }

      // Already pinned - no-op
      if (item.pinnedOrder !== null) {
        return;
      }

      // Check max limit (within transaction for atomicity)
      const pinnedCount = await tx.item.count({
        where: {
          userId,
          pinnedOrder: { not: null },
        },
      });

      if (pinnedCount >= MAX_PINNED_ITEMS) {
        throw new Error("Maximum of 10 pinned items reached");
      }

      // Get next order value
      const maxOrder = await tx.item.aggregate({
        where: {
          userId,
          pinnedOrder: { not: null },
        },
        _max: { pinnedOrder: true },
      });

      const nextOrder = (maxOrder._max.pinnedOrder ?? -1) + 1;

      await tx.item.update({
        where: { id },
        data: { pinnedOrder: nextOrder },
      });
    });

    return { success: true };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to pin item";
    return { error: message };
  }
}

/**
 * Unpins an item from the sidebar.
 *
 * @param id - Item ID to unpin
 * @returns Success or error
 */
export async function unpinItem(id: string): Promise<ItemResult> {
  // Run rate limit and auth in parallel (async-parallel pattern)
  const [rateLimitResult, session] = await Promise.all([
    checkRateLimit("itemPin"),
    auth(),
  ]);

  if (rateLimitResult) {
    return { error: rateLimitResult.error };
  }

  if (!session?.user?.id) {
    return { error: "Unauthorized" };
  }

  const item = await prisma.item.findUnique({
    where: { id },
    select: { userId: true, pinnedOrder: true },
  });

  if (!item) {
    return { error: "Item not found" };
  }

  if (item.userId !== session.user.id) {
    return { error: "Unauthorized" };
  }

  // Already unpinned
  if (item.pinnedOrder === null) {
    return { success: true };
  }

  await prisma.item.update({
    where: { id },
    data: { pinnedOrder: null },
  });

  return { success: true };
}

/**
 * Fetches all pinned items for the current user.
 * Returns items sorted by pinnedOrder for sidebar display.
 *
 * @returns PinnedItem array or error
 */
export async function getPinnedItems(): Promise<ItemResult<PinnedItem[]>> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Unauthorized" };
  }

  const items = await prisma.item.findMany({
    where: {
      userId: session.user.id,
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

  return { success: true, data: pinnedItems };
}

// =============================================================================
// Public Visibility Actions
// =============================================================================

/**
 * Sets the public visibility of an item.
 * Making an item public allows it to appear on the owner's public profile.
 *
 * Privacy cascade rules:
 * - Setting an item to public: only that item becomes public (children stay private)
 * - Setting an item to private: item and ALL descendants become private
 *
 * @param id - Item ID to update
 * @param isPublic - New visibility state
 * @returns Success or error
 */
export async function setItemVisibility(
  id: string,
  isPublic: boolean
): Promise<ItemResult<{ affectedCount: number }>> {
  // Run rate limit and auth in parallel (async-parallel pattern)
  const [rateLimitResult, session] = await Promise.all([
    checkRateLimit("itemUpdate"),
    auth(),
  ]);

  if (rateLimitResult) {
    return { error: rateLimitResult.error };
  }

  if (!session?.user?.id) {
    return { error: "Unauthorized" };
  }

  const item = await prisma.item.findUnique({
    where: { id },
    select: { userId: true, isPublic: true },
  });

  if (!item) {
    return { error: "Item not found" };
  }

  if (item.userId !== session.user.id) {
    return { error: "Unauthorized" };
  }

  // No change needed
  if (item.isPublic === isPublic) {
    return { success: true, data: { affectedCount: 0 } };
  }

  try {
    if (isPublic) {
      // Making public: only update this item
      await prisma.item.update({
        where: { id },
        data: { isPublic: true },
      });

      logger.info({ userId: session.user.id, itemId: id }, "Item made public");
      return { success: true, data: { affectedCount: 1 } };
    } else {
      // Making private: cascade to all descendants
      // Use recursive CTE to find all descendant IDs
      const descendantIds = await prisma.$queryRaw<Array<{ id: string }>>`
        WITH RECURSIVE descendants AS (
          SELECT id FROM "Item" WHERE id = ${id} AND "userId" = ${session.user.id}
          UNION ALL
          SELECT i.id FROM "Item" i
          INNER JOIN descendants d ON i."parentId" = d.id
          WHERE i."userId" = ${session.user.id}
        )
        SELECT id FROM descendants
      `;

      const ids = descendantIds.map((d) => d.id);

      await prisma.item.updateMany({
        where: { id: { in: ids } },
        data: { isPublic: false },
      });

      logger.info(
        { userId: session.user.id, itemId: id, cascadeCount: ids.length },
        "Item and descendants made private"
      );

      // Return count minus 1 because we don't count the item itself, only children
      return { success: true, data: { affectedCount: ids.length - 1 } };
    }
  } catch (error) {
    logger.error({ error, itemId: id }, "Failed to update item visibility");
    const prismaError = handlePrismaError(error);
    return prismaError ?? { error: "Failed to update item visibility" };
  }
}

/**
 * Gets the public visibility state of an item.
 *
 * @param id - Item ID to check
 * @returns Visibility state or error
 */
export async function getItemVisibility(
  id: string
): Promise<ItemResult<{ isPublic: boolean }>> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Unauthorized" };
  }

  const item = await prisma.item.findUnique({
    where: { id },
    select: { userId: true, isPublic: true },
  });

  if (!item) {
    return { error: "Item not found" };
  }

  if (item.userId !== session.user.id) {
    return { error: "Unauthorized" };
  }

  return { success: true, data: { isPublic: item.isPublic } };
}

/**
 * Sets whether an item inherits visibility from its parent.
 * Root items (parentId=null) cannot inherit.
 *
 * @param id - Item ID
 * @param inheritVisibility - Whether to inherit visibility
 * @returns Success or error
 */
export async function setInheritVisibility(
  id: string,
  inheritVisibility: boolean
): Promise<ItemResult<void>> {
  const [rateLimitResult, session] = await Promise.all([
    checkRateLimit("itemUpdate"),
    auth(),
  ]);

  if (rateLimitResult) {
    return { error: rateLimitResult.error };
  }

  if (!session?.user?.id) {
    return { error: "Unauthorized" };
  }

  const item = await prisma.item.findUnique({
    where: { id },
    select: { userId: true, parentId: true, inheritVisibility: true },
  });

  if (!item) {
    return { error: "Item not found" };
  }

  if (item.userId !== session.user.id) {
    return { error: "Unauthorized" };
  }

  // Root items cannot inherit
  if (inheritVisibility && item.parentId === null) {
    return { error: "Root items cannot inherit visibility" };
  }

  // No change needed
  if (item.inheritVisibility === inheritVisibility) {
    return { success: true };
  }

  try {
    await prisma.item.update({
      where: { id },
      data: { inheritVisibility },
    });

    logger.info(
      { userId: session.user.id, itemId: id, inheritVisibility },
      "Item inherit visibility updated"
    );

    return { success: true };
  } catch (error) {
    logger.error({ error, itemId: id }, "Failed to update inherit visibility");
    const prismaError = handlePrismaError(error);
    return prismaError ?? { error: "Failed to update visibility" };
  }
}

/**
 * Counts children that will be affected by making an item private.
 * Only counts children that inherit visibility (inheritVisibility=true).
 *
 * @param itemId - Parent item ID
 * @returns Count of inheriting children
 */
export async function countInheritingChildren(itemId: string): Promise<number> {
  // Parallelize auth and item lookup (both independent)
  const [session, item] = await Promise.all([
    auth(),
    prisma.item.findUnique({
      where: { id: itemId },
      select: { userId: true },
    }),
  ]);

  if (!session?.user?.id) {
    return 0;
  }

  if (!item || item.userId !== session.user.id) {
    return 0;
  }

  const count = await prisma.item.count({
    where: {
      parentId: itemId,
      inheritVisibility: true,
    },
  });

  return count;
}

// =============================================================================
// Unified Profile Data Fetching
// =============================================================================

/**
 * Profile data returned by getItemsForProfile.
 */
export interface ProfileItemsResult {
  /** Items with artwork data */
  items: ItemWithArtwork[];
  /** Whether the viewer is the profile owner */
  isOwner: boolean;
  /** Profile information */
  profile: {
    id: string;
    username: string;
    name: string | null;
    hasImage: boolean;
    hasHeroImage: boolean;
    dominantColour: string | null;
    bio: string | null;
  };
}

/**
 * Fetches items for a user's profile with owner/viewer mode detection.
 * When viewer is the owner, returns all items with full data.
 * When viewer is different user or guest, returns only public items.
 *
 * Uses React.cache() for per-request deduplication to avoid redundant DB calls
 * when called from both generateMetadata and page components.
 *
 * @param profileUserId - User ID whose profile to fetch
 * @param viewerUserId - User ID of viewer (null for guests)
 * @returns Profile data with items and owner status
 * @throws Error if profile not found or has no username
 *
 * @example
 * // Owner viewing own profile
 * const result = await getItemsForProfile(userId, userId);
 * // result.isOwner === true, result.items includes all items
 *
 * @example
 * // Guest viewing public profile
 * const result = await getItemsForProfile(profileId, null);
 * // result.isOwner === false, result.items includes only public items
 */
export const getItemsForProfile = cache(
  async (
    profileUserId: string,
    viewerUserId: string | null
  ): Promise<ProfileItemsResult> => {
    const isOwner = viewerUserId === profileUserId;

    // Fetch profile
    const profile = await prisma.user.findUnique({
      where: { id: profileUserId },
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
      throw new Error("Profile not found");
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
      // Owner: fetch all items using existing getAllItems logic
      // Parallelize descendant counting + full item fetch
      const [allItems, items] = await Promise.all([
        prisma.item.findMany({
          where: { userId: profileUserId },
          select: { id: true, parentId: true },
        }),
        prisma.item.findMany({
          where: { userId: profileUserId },
          orderBy: [{ depth: "asc" }, { order: "asc" }],
          include: {
            files: {
              select: {
                id: true,
                fileType: true,
                isPrimary: true,
                filename: true,
                mimeType: true,
                durationMs: true,
                height: true,
              },
            },
            driveConnection: {
              select: { id: true },
            },
          },
        }),
      ]);

      const countDescendants = buildDescendantCounter(allItems);

      // Build progress map for all items
      const progressMap = await buildDescendantProgressMap(
        profileUserId,
        items.map((i) => i.id)
      );

      // Transform to ItemWithArtwork
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
      // Viewer: fetch only public items
      const publicResult = await getPublicItemsForUser({
        userId: profileUserId,
        currentUserId: viewerUserId,
      });

      // Transform PublicItem to ItemWithArtwork shape
      const items: ItemWithArtwork[] = publicResult.items.map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        parentId: item.parentId,
        order: item.order,
        depth: item.depth,
        userId: item.userId,
        createdAt: new Date(), // Not returned by public API
        updatedAt: item.updatedAt,
        artworkId: item.artworkId,
        // Read-only defaults for viewer
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
        tmdbShowTagline: true,
        tmdbShowMetadata: true,
        tmdbShowGenres: true,
        tmdbShowCast: true,
        tmdbShowProviders: true,
        tmdbShowVideos: true,
        tmdbShowRecommendations: true,
        tmdbPosterPath: item.tmdbPosterPath ?? null,
        tmdbBackdropPath: item.tmdbBackdropPath ?? null,
        tmdbLogoPath: null,
        dominantColour: item.dominantColour ?? null,
        fileCounts: item.fileCounts,
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
        profile: profileData,
      };
    }
  }
);

/**
 * Result type for getItemChildrenForProfile.
 */
export interface ProfileChildrenResult {
  /** Child items with artwork data */
  items: ItemWithArtwork[];
  /** Whether the viewer is the item owner */
  isOwner: boolean;
  /** Parent item for breadcrumb navigation */
  parent: {
    id: string;
    name: string;
    parentId: string | null;
  };
}

/**
 * Fetches children of an item for profile view.
 * When viewer is owner, returns all children with full data.
 * When viewer is different user or guest, returns only public children.
 *
 * Uses React.cache() for per-request deduplication.
 *
 * @param parentId - Parent item ID to fetch children for
 * @param viewerUserId - User ID of viewer (null for guests)
 * @returns Item result with children and owner status
 *
 * @example
 * // Owner viewing their item's children
 * const result = await getItemChildrenForProfile(itemId, userId);
 * // result.data.isOwner === true
 *
 * @example
 * // Guest viewing public item children
 * const result = await getItemChildrenForProfile(itemId, null);
 * // result.data.isOwner === false
 */
export const getItemChildrenForProfile = cache(
  async (
    parentId: string,
    viewerUserId: string | null
  ): Promise<ItemResult<ProfileChildrenResult>> => {
    // Fetch parent item to determine ownership and verify existence
    const parent = await prisma.item.findUnique({
      where: { id: parentId },
      select: {
        id: true,
        name: true,
        parentId: true,
        userId: true,
      },
    });

    if (!parent) {
      return { error: "Item not found" };
    }

    const isOwner = viewerUserId === parent.userId;

    const parentData = {
      id: parent.id,
      name: parent.name,
      parentId: parent.parentId,
    };

    if (isOwner) {
      // Owner: parallelize descendant counting + children fetch
      const [allItems, children] = await Promise.all([
        prisma.item.findMany({
          where: { userId: parent.userId },
          select: { id: true, parentId: true },
        }),
        prisma.item.findMany({
          where: { userId: parent.userId, parentId },
          orderBy: { order: "asc" },
          include: {
            files: {
              select: {
                id: true,
                fileType: true,
                isPrimary: true,
                filename: true,
                mimeType: true,
                durationMs: true,
                height: true,
              },
            },
            driveConnection: {
              select: { id: true },
            },
          },
        }),
      ]);

      const countDescendants = buildDescendantCounter(allItems);

      // Build progress map
      const progressMap = await buildDescendantProgressMap(
        parent.userId,
        children.map((i) => i.id)
      );

      // Transform to ItemWithArtwork
      const items: ItemWithArtwork[] = children.map((item) =>
        toItemWithArtwork(
          item,
          countDescendants(item.id),
          resolveProgress(progressMap, item.id)
        )
      );

      return {
        success: true,
        data: {
          items,
          isOwner: true,
          parent: parentData,
        },
      };
    } else {
      // Non-owner: verify parent is public and fetch public children
      const parentIsPublic = await isItemFullyPublic(parentId);
      if (!parentIsPublic) {
        return { error: "Item not found" };
      }

      const publicChildren = await getPublicChildItems(parentId, 200, 0);

      // Transform to ItemWithArtwork shape
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
        artworkId: item.artworkId,
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
        tmdbShowTagline: true,
        tmdbShowMetadata: true,
        tmdbShowGenres: true,
        tmdbShowCast: true,
        tmdbShowProviders: true,
        tmdbShowVideos: true,
        tmdbShowRecommendations: true,
        tmdbPosterPath: item.tmdbPosterPath ?? null,
        tmdbBackdropPath: item.tmdbBackdropPath ?? null,
        tmdbLogoPath: null,
        dominantColour: item.dominantColour ?? null,
        fileCounts: item.fileCounts,
        childCount: 0,
        primaryMediaName: null,
        primaryDurationMs: null,
        primaryHeight: null,
        mediaIconType: null,
        progress: null,
      }));

      return {
        success: true,
        data: {
          items,
          isOwner: false,
          parent: parentData,
        },
      };
    }
  }
);
