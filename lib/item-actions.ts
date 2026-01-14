/**
 * Server actions for item CRUD operations.
 * Handles item hierarchy with ownership verification.
 */

"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { itemNameSchema, itemDescriptionSchema } from "@/lib/validations";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  createDriveFolderOnly,
  renameItemInGoogleDrive,
  moveItemInGoogleDrive,
} from "@/lib/google-drive-actions";
import { batchDelete } from "@/lib/google-drive-client";
import { decryptCredential } from "@/lib/crypto";
import { logger } from "@/lib/logger";
import type {
  Item,
  ItemResult,
  BreadcrumbItem,
  ItemWithArtwork,
  SearchableItem,
} from "@/lib/types";
import { buildDescendantCounter, getMediaIconType } from "@/lib/item-utils";

const MAX_DEPTH = 10;

/**
 * Fetches items for a given parent with artwork thumbnails.
 * Returns root items if parentId is null.
 * Includes the first artwork file ID for each item for thumbnail display.
 *
 * @param parentId - Parent item ID or null for root
 * @returns Items array with artworkId or error
 */
export async function getItems(
  parentId: string | null
): Promise<ItemResult<ItemWithArtwork[]>> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Unauthorized" };
  }

  // Fetch all items for descendant count calculation
  const allItems = await prisma.item.findMany({
    where: { userId: session.user.id },
    select: { id: true, parentId: true },
  });

  // Use helper to build descendant counter (DRY)
  const countDescendants = buildDescendantCounter(allItems);

  // Fetch items at current level with files and connection
  const items = await prisma.item.findMany({
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
        },
      },
      driveConnection: {
        select: { id: true },
      },
    },
  });

  // Transform to ItemWithArtwork with file counts and descendant count
  const itemsWithArtwork: ItemWithArtwork[] = items.map((item) => {
    // Find primary artwork, or first artwork if no primary
    const primaryArtwork = item.files.find(
      (f) => f.fileType === "ARTWORK" && f.isPrimary
    );
    const firstArtwork = item.files.find((f) => f.fileType === "ARTWORK");
    const artworkId = primaryArtwork?.id ?? firstArtwork?.id ?? null;

    // Find primary media, or first media if no primary
    const primaryMedia = item.files.find(
      (f) => f.fileType === "MEDIA" && f.isPrimary
    );
    const firstMedia = item.files.find((f) => f.fileType === "MEDIA");
    const resolvedPrimaryMedia = primaryMedia ?? firstMedia;
    const primaryMediaName = resolvedPrimaryMedia?.filename ?? null;

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
      artworkId,
      fileCounts,
      childCount: countDescendants(item.id),
      primaryMediaName,
      mediaIconType,
    };
  });

  return { success: true, data: itemsWithArtwork };
}

/**
 * Fetches ALL items for the current user with artwork thumbnails.
 * Returns full hierarchy (all levels) for inline tree display.
 * Items are ordered by depth then order for proper tree building.
 *
 * @returns All items array with artworkId or error
 */
export async function getAllItems(): Promise<ItemResult<ItemWithArtwork[]>> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Unauthorized" };
  }

  // Fetch all items for descendant count calculation
  const allItems = await prisma.item.findMany({
    where: { userId: session.user.id },
    select: { id: true, parentId: true },
  });

  // Use helper to build descendant counter (DRY)
  const countDescendants = buildDescendantCounter(allItems);

  // Fetch ALL items with files and connection
  const items = await prisma.item.findMany({
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
        },
      },
      driveConnection: {
        select: { id: true },
      },
    },
  });

  // Transform to ItemWithArtwork with file counts and descendant count
  const itemsWithArtwork: ItemWithArtwork[] = items.map((item) => {
    const primaryArtwork = item.files.find(
      (f) => f.fileType === "ARTWORK" && f.isPrimary
    );
    const firstArtwork = item.files.find((f) => f.fileType === "ARTWORK");
    const artworkId = primaryArtwork?.id ?? firstArtwork?.id ?? null;

    // Find primary media, or first media if no primary
    const primaryMedia = item.files.find(
      (f) => f.fileType === "MEDIA" && f.isPrimary
    );
    const firstMedia = item.files.find((f) => f.fileType === "MEDIA");
    const resolvedPrimaryMedia = primaryMedia ?? firstMedia;
    const primaryMediaName = resolvedPrimaryMedia?.filename ?? null;

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
      artworkId,
      fileCounts,
      childCount: countDescendants(item.id),
      primaryMediaName,
      mediaIconType,
    };
  });

  return { success: true, data: itemsWithArtwork };
}

/**
 * Fetches all descendants of an item (children, grandchildren, etc.).
 * Used for displaying full subtree on item detail pages.
 *
 * @param parentId - Parent item ID
 * @returns All descendant items with artworkId or error
 */
export async function getDescendants(
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

  const itemsWithArtwork: ItemWithArtwork[] = items.map((item) => {
    const primaryArtwork = item.files.find(
      (f) => f.fileType === "ARTWORK" && f.isPrimary
    );
    const firstArtwork = item.files.find((f) => f.fileType === "ARTWORK");
    const artworkId = primaryArtwork?.id ?? firstArtwork?.id ?? null;

    // Find primary media, or first media if no primary
    const primaryMedia = item.files.find(
      (f) => f.fileType === "MEDIA" && f.isPrimary
    );
    const firstMedia = item.files.find((f) => f.fileType === "MEDIA");
    const resolvedPrimaryMedia = primaryMedia ?? firstMedia;
    const primaryMediaName = resolvedPrimaryMedia?.filename ?? null;

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
      artworkId,
      fileCounts,
      childCount: countDescendants(item.id),
      primaryMediaName,
      mediaIconType,
    };
  });

  return { success: true, data: itemsWithArtwork };
}

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

          -- Recursive case: get each parent's parent
          SELECT i.id, i.name, i."parentId", a.depth + 1
          FROM "Item" i
          INNER JOIN ancestors a ON i.id = a."parentId"
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
  description?: string
): Promise<ItemResult<Item>> {
  // Rate limit check
  const rateLimitResult = await checkRateLimit("itemCreate");
  if (rateLimitResult) {
    return { error: rateLimitResult.error };
  }

  const session = await auth();
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

    if (parent.depth >= MAX_DEPTH - 1) {
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

  const item = await prisma.item.create({
    data: {
      name: nameValidation.data,
      description: validatedDescription,
      parentId,
      order,
      depth,
      userId: session.user.id,
    },
  });

  // Sync to Google Drive if user has connection
  const connection = await prisma.googleDriveConnection.findUnique({
    where: { userId: session.user.id },
  });

  if (connection) {
    // Create folder in Drive (async, don't block UI response)
    // Note: revalidatePath runs before Drive sync completes - UI may show stale syncStatus briefly
    // Uses createDriveFolderOnly which only creates Drive folder, NOT a duplicate Item
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
            .catch(() => {});
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
          .catch(() => {}); // Ignore secondary failure
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
  // Rate limit check
  const rateLimitResult = await checkRateLimit("itemUpdate");
  if (rateLimitResult) {
    return { error: rateLimitResult.error };
  }

  const session = await auth();
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
    renameItemInGoogleDrive(id, updateData.name).catch((err) => {
      logger.error({ err, itemId: id }, "Failed to rename in Drive");
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
  // Rate limit check
  const rateLimitResult = await checkRateLimit("itemDelete");
  if (rateLimitResult) {
    return { error: rateLimitResult.error };
  }

  const session = await auth();
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
    if (update.depth !== undefined && update.depth >= MAX_DEPTH) {
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
  for (const update of updates) {
    const current = currentParentMap.get(update.id);
    if (
      current?.driveFileId &&
      update.parentId !== undefined &&
      current.parentId !== update.parentId
    ) {
      // Parent changed - move in Drive (pass old parentId since DB already updated)
      moveItemInGoogleDrive(update.id, update.parentId, current.parentId).catch(
        (err) => {
          logger.error({ err, itemId: update.id }, "Failed to move in Drive");
        }
      );
    }
  }

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
  // Rate limit check
  const rateLimitResult = await checkRateLimit("itemSearch");
  if (rateLimitResult) {
    return { error: rateLimitResult.error };
  }

  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Not authenticated" };
  }

  try {
    const items = await prisma.item.findMany({
      where: { userId: session.user.id },
      select: {
        id: true,
        name: true,
        parentId: true,
        depth: true,
        description: true,
        files: {
          where: { fileType: "ARTWORK" },
          select: { id: true, isPrimary: true },
          orderBy: { isPrimary: "desc" }, // Primary first, then others
        },
      },
      orderBy: { name: "asc" },
      take: 500,
    });

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
      artworkId: item.files[0]?.id ?? null,
      breadcrumb: buildBreadcrumb(item.parentId),
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
  // Rate limit check
  const rateLimitResult = await checkRateLimit("itemDelete");
  if (rateLimitResult) {
    return { error: rateLimitResult.error };
  }

  const session = await auth();
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
    metadata.options
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
