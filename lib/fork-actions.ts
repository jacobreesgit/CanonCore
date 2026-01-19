/**
 * Server actions for forking public items.
 * Handles creating copies of public items in user's library.
 */

"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { handlePrismaError } from "@/lib/errors";
import { isItemFullyPublic } from "@/lib/public-auth";
import type { ItemResult } from "@/lib/types";

/**
 * Result of a fork operation with the new item ID.
 */
export interface ForkResult {
  /** ID of the newly created forked item */
  itemId: string;
  /** Name of the forked item */
  name: string;
}

/**
 * Info about a fork relationship for display.
 */
export interface ForkInfo {
  /** Original source item info */
  source: {
    id: string;
    name: string;
    ownerUsername: string | null;
  } | null;
  /** Number of times this item has been forked */
  forkCount: number;
}

/**
 * Fork status for a user and item.
 */
export interface ForkStatus {
  /** Whether the user has forked this item */
  hasForked: boolean;
  /** ID of the user's forked copy if exists */
  forkedItemId: string | null;
}

/**
 * Forks a public item into the user's library.
 * Creates a shallow copy (metadata only, no files) with reference to original.
 *
 * Rules:
 * - Item must be fully public (all ancestors public)
 * - User cannot fork their own items
 * - User can only fork an item once (enforced by unique constraint)
 *
 * @param sourceItemId - ID of the public item to fork
 * @param parentId - Optional parent item ID in user's library (null for root)
 * @returns Fork result with new item ID or error
 */
export async function forkItem(
  sourceItemId: string,
  parentId: string | null = null
): Promise<ItemResult<ForkResult>> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Not authenticated" };
  }

  const userId = session.user.id;

  // Rate limit fork operations
  const rateLimitResult = await checkRateLimit("fork");
  if (rateLimitResult) {
    return { error: rateLimitResult.error };
  }

  try {
    // Fetch source item with owner info
    const sourceItem = await prisma.item.findUnique({
      where: { id: sourceItemId },
      select: {
        id: true,
        name: true,
        description: true,
        userId: true,
        tmdbId: true,
        tmdbType: true,
        files: {
          where: { fileType: "ARTWORK" },
          select: { id: true },
          take: 1,
          orderBy: { isPrimary: "desc" },
        },
      },
    });

    if (!sourceItem) {
      return { error: "Item not found" };
    }

    // Cannot fork own items
    if (sourceItem.userId === userId) {
      return { error: "Cannot fork your own items" };
    }

    // Verify item is fully public
    const isPublic = await isItemFullyPublic(sourceItemId);
    if (!isPublic) {
      return { error: "Item is not publicly accessible" };
    }

    // Check if user already forked this item
    const existingFork = await prisma.fork.findUnique({
      where: {
        sourceItemId_userId: {
          sourceItemId,
          userId,
        },
      },
      select: { targetItemId: true },
    });

    if (existingFork) {
      return { error: "You have already forked this item" };
    }

    // Validate parent if specified
    let depth = 0;
    if (parentId) {
      const parent = await prisma.item.findUnique({
        where: { id: parentId, userId },
        select: { depth: true },
      });

      if (!parent) {
        return { error: "Parent folder not found" };
      }

      depth = parent.depth + 1;
      if (depth >= 10) {
        return { error: "Maximum nesting depth reached" };
      }
    }

    // Get max order for placement
    const maxOrderItem = await prisma.item.findFirst({
      where: { userId, parentId },
      orderBy: { order: "desc" },
      select: { order: true },
    });
    const order = (maxOrderItem?.order ?? -1) + 1;

    // Create forked item and Fork record in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the forked item
      const forkedItem = await tx.item.create({
        data: {
          name: sourceItem.name,
          description: sourceItem.description,
          parentId,
          depth,
          order,
          userId,
          forkedFromId: sourceItemId,
          tmdbId: sourceItem.tmdbId,
          tmdbType: sourceItem.tmdbType,
          isPublic: false, // Forked items start private
        },
      });

      // Create Fork record for tracking
      await tx.fork.create({
        data: {
          sourceItemId,
          targetItemId: forkedItem.id,
          userId,
        },
      });

      return forkedItem;
    });

    logger.info(
      { userId, sourceItemId, forkedItemId: result.id },
      "Item forked successfully"
    );

    return {
      success: true,
      data: {
        itemId: result.id,
        name: result.name,
      },
    };
  } catch (error) {
    logger.error({ error, userId, sourceItemId }, "Failed to fork item");
    const prismaError = handlePrismaError(error);
    return prismaError ?? { error: "Failed to fork item" };
  }
}

/**
 * Gets fork status for a user and item.
 * Returns whether user has forked the item and the forked copy ID.
 *
 * @param itemId - Item ID to check
 * @returns Fork status or error
 */
export async function getForkStatus(
  itemId: string
): Promise<ItemResult<ForkStatus>> {
  const session = await auth();
  if (!session?.user?.id) {
    // Unauthenticated users haven't forked anything
    return {
      success: true,
      data: { hasForked: false, forkedItemId: null },
    };
  }

  const userId = session.user.id;

  try {
    const fork = await prisma.fork.findUnique({
      where: {
        sourceItemId_userId: {
          sourceItemId: itemId,
          userId,
        },
      },
      select: { targetItemId: true },
    });

    return {
      success: true,
      data: {
        hasForked: fork !== null,
        forkedItemId: fork?.targetItemId ?? null,
      },
    };
  } catch (error) {
    logger.error({ error, userId, itemId }, "Failed to get fork status");
    const prismaError = handlePrismaError(error);
    return prismaError ?? { error: "Failed to get fork status" };
  }
}

/**
 * Gets fork info for an item.
 * Returns info about the source (if forked) and fork count.
 *
 * @param itemId - Item ID to get fork info for
 * @returns Fork info or error
 */
export async function getForkInfo(
  itemId: string
): Promise<ItemResult<ForkInfo>> {
  const session = await auth();

  try {
    const item = await prisma.item.findUnique({
      where: { id: itemId },
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
      return { error: "Item not found" };
    }

    // Only owner can see fork info for private items
    if (session?.user?.id !== item.userId) {
      // For non-owners, check if item is public
      const isPublic = await isItemFullyPublic(itemId);
      if (!isPublic) {
        return { error: "Item not found" };
      }
    }

    // Build source info if forked from somewhere
    let source: ForkInfo["source"] = null;
    if (item.forkedFrom) {
      // Only show source if it's still public
      if (item.forkedFrom.isPublic && item.forkedFrom.user.isPublic) {
        source = {
          id: item.forkedFrom.id,
          name: item.forkedFrom.name,
          ownerUsername: item.forkedFrom.user.username,
        };
      }
    }

    return {
      success: true,
      data: {
        source,
        forkCount: item._count.sourceForks,
      },
    };
  } catch (error) {
    logger.error({ error, itemId }, "Failed to get fork info");
    const prismaError = handlePrismaError(error);
    return prismaError ?? { error: "Failed to get fork info" };
  }
}

/**
 * Gets items that have been forked from a source item.
 * Only available to the source item owner.
 *
 * @param itemId - Source item ID
 * @param limit - Max results (default 20)
 * @returns List of forks or error
 */
export async function getItemForks(
  itemId: string,
  limit = 20
): Promise<ItemResult<Array<{ id: string; userId: string; createdAt: Date }>>> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Not authenticated" };
  }

  try {
    // Verify ownership
    const item = await prisma.item.findUnique({
      where: { id: itemId, userId: session.user.id },
      select: { id: true },
    });

    if (!item) {
      return { error: "Item not found" };
    }

    const forks = await prisma.fork.findMany({
      where: { sourceItemId: itemId },
      select: {
        id: true,
        userId: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return { success: true, data: forks };
  } catch (error) {
    logger.error({ error, itemId }, "Failed to get item forks");
    const prismaError = handlePrismaError(error);
    return prismaError ?? { error: "Failed to get item forks" };
  }
}
