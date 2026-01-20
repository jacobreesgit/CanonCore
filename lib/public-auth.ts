/**
 * Authorization helpers for public profiles and items.
 * Provides access control logic for public content visibility.
 * Uses React.cache() for per-request deduplication when called from
 * both generateMetadata and page components.
 */

import { cache } from "react";
import { prisma } from "@/lib/prisma";

/**
 * Public profile data returned to unauthenticated users.
 * Only includes fields safe for public display.
 */
export interface PublicProfile {
  /** User ID */
  id: string;
  /** Public username for URL routing */
  username: string;
  /** Display name (nullable) */
  name: string | null;
  /** Whether user has a profile image */
  hasImage: boolean;
  /** Whether user has a hero image */
  hasHeroImage: boolean;
  /** Profile creation date */
  createdAt: Date;
}

/**
 * Public item data with limited fields for safety.
 */
export interface PublicItem {
  /** Item ID */
  id: string;
  /** Item name */
  name: string;
  /** Item description */
  description: string | null;
  /** Parent item ID */
  parentId: string | null;
  /** Depth in hierarchy */
  depth: number;
  /** Owner user ID */
  userId: string;
  /** First artwork file ID for thumbnail */
  artworkId: string | null;
  /** TMDB ID for metadata */
  tmdbId: number | null;
  /** TMDB media type */
  tmdbType: string | null;
  /** Number of times this item has been forked */
  forkCount: number;
  /** When item was last updated */
  updatedAt: Date;
}

/**
 * Fetches a public user profile by username.
 * Returns null if user doesn't exist, profile isn't public, or no username set.
 * Cached per-request to deduplicate calls from generateMetadata and page.
 *
 * @param username - Username to look up (case-insensitive)
 * @returns Public profile data or null if not found/not public
 */
export const getPublicProfile = cache(
  async (username: string): Promise<PublicProfile | null> => {
    const user = await prisma.user.findFirst({
      where: {
        username: {
          equals: username,
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
        createdAt: true,
      },
    });

    if (!user || !user.username) {
      return null;
    }

    return {
      id: user.id,
      username: user.username,
      name: user.name,
      hasImage: user.image !== null,
      hasHeroImage: user.heroImage !== null,
      createdAt: user.createdAt,
    };
  }
);

/**
 * Checks if an item is effectively public (directly or via inheritance).
 * An item is effectively public if:
 * 1. It has isPublic=true and inheritVisibility=false (explicit), OR
 * 2. It has inheritVisibility=true AND an ancestor in its chain is effectively public
 *
 * Uses recursive CTE to walk up the tree and determine effective visibility.
 * CTE terminates when it finds an item with inheritVisibility=false (the "resolver").
 *
 * @param itemId - Item ID to check
 * @returns True if item is effectively public
 */
export const isItemFullyPublic = cache(
  async (itemId: string): Promise<boolean> => {
    // Use recursive CTE to check effective visibility through inheritance chain
    const result = await prisma.$queryRaw<Array<{ is_fully_public: boolean }>>`
    WITH RECURSIVE visibility_chain AS (
      -- Start with the target item
      SELECT
        id,
        "parentId",
        "isPublic",
        "inheritVisibility",
        CASE
          WHEN "inheritVisibility" = false THEN "isPublic"
          ELSE NULL  -- Need to check parent
        END as resolved_visibility
      FROM "Item"
      WHERE id = ${itemId}

      UNION ALL

      -- Walk up the tree for items that inherit
      SELECT
        i.id,
        i."parentId",
        i."isPublic",
        i."inheritVisibility",
        CASE
          WHEN i."inheritVisibility" = false THEN i."isPublic"
          ELSE NULL  -- Keep walking up
        END as resolved_visibility
      FROM "Item" i
      INNER JOIN visibility_chain vc ON i.id = vc."parentId"
      WHERE vc.resolved_visibility IS NULL  -- Only continue if still inheriting
    )
    SELECT COALESCE(
      -- Find the first resolved visibility in the chain
      (SELECT resolved_visibility FROM visibility_chain WHERE resolved_visibility IS NOT NULL LIMIT 1),
      -- If no explicit visibility found (all inherit up to root), default to false
      false
    ) as is_fully_public
  `;

    return result[0]?.is_fully_public ?? false;
  }
);

/**
 * Checks if an item can be viewed by a given user.
 * Rules:
 * - Owner can always view their own items
 * - Non-owners can view if item and all ancestors are public
 *
 * @param itemId - Item ID to check
 * @param viewerId - User ID of viewer (null for unauthenticated)
 * @returns True if viewer can access the item
 */
export async function canViewItem(
  itemId: string,
  viewerId: string | null
): Promise<boolean> {
  // First check if the item exists and get owner
  const item = await prisma.item.findUnique({
    where: { id: itemId },
    select: { userId: true },
  });

  if (!item) {
    return false;
  }

  // Owner can always view their own items
  if (viewerId && item.userId === viewerId) {
    return true;
  }

  // For non-owners, check full public visibility
  return isItemFullyPublic(itemId);
}

/**
 * Fetches a public item with visibility verification.
 * Returns null if item doesn't exist or isn't fully public.
 * Cached per-request to deduplicate calls from generateMetadata and page.
 *
 * @param itemId - Item ID to fetch
 * @returns Public item data or null
 */
export const getPublicItem = cache(
  async (itemId: string): Promise<PublicItem | null> => {
    // First verify the item is fully public
    const isPublic = await isItemFullyPublic(itemId);
    if (!isPublic) {
      return null;
    }

    // Fetch item with fork count and artwork
    const item = await prisma.item.findUnique({
      where: { id: itemId },
      select: {
        id: true,
        name: true,
        description: true,
        parentId: true,
        depth: true,
        userId: true,
        tmdbId: true,
        tmdbType: true,
        updatedAt: true,
        files: {
          where: { fileType: "ARTWORK" },
          select: { id: true },
          take: 1,
          orderBy: { isPrimary: "desc" },
        },
        _count: {
          select: { sourceForks: true },
        },
      },
    });

    if (!item) {
      return null;
    }

    return {
      id: item.id,
      name: item.name,
      description: item.description,
      parentId: item.parentId,
      depth: item.depth,
      userId: item.userId,
      artworkId: item.files[0]?.id ?? null,
      tmdbId: item.tmdbId,
      tmdbType: item.tmdbType,
      forkCount: item._count.sourceForks,
      updatedAt: item.updatedAt,
    };
  }
);

/**
 * Fetches all public items for a user's public profile.
 * Only returns root-level public items (depth 0) with fork counts.
 *
 * @param userId - User ID whose public items to fetch
 * @param limit - Maximum items to return (default 50)
 * @param offset - Pagination offset (default 0)
 * @returns Array of public items
 */
export async function getPublicItemsForUser(
  userId: string,
  limit = 50,
  offset = 0
): Promise<PublicItem[]> {
  const items = await prisma.item.findMany({
    where: {
      userId,
      isPublic: true,
      inheritVisibility: false, // Only explicitly public items on profile root
      depth: 0, // Only root items on profile
    },
    select: {
      id: true,
      name: true,
      description: true,
      parentId: true,
      depth: true,
      userId: true,
      tmdbId: true,
      tmdbType: true,
      updatedAt: true,
      files: {
        where: { fileType: "ARTWORK" },
        select: { id: true },
        take: 1,
        orderBy: { isPrimary: "desc" },
      },
      _count: {
        select: { sourceForks: true },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
    skip: offset,
  });

  return items.map((item) => ({
    id: item.id,
    name: item.name,
    description: item.description,
    parentId: item.parentId,
    depth: item.depth,
    userId: item.userId,
    artworkId: item.files[0]?.id ?? null,
    tmdbId: item.tmdbId,
    tmdbType: item.tmdbType,
    forkCount: item._count.sourceForks,
    updatedAt: item.updatedAt,
  }));
}

/**
 * Fetches effectively public child items of a parent item.
 * Returns children that are:
 * - Explicitly public (inheritVisibility=false, isPublic=true), OR
 * - Inheriting visibility (inheritVisibility=true) - parent visibility already verified
 *
 * @precondition Caller MUST verify parent is public before calling (CR-2 security requirement)
 *
 * @param parentId - Parent item ID
 * @param limit - Maximum items to return
 * @param offset - Pagination offset
 * @returns Array of effectively public child items
 */
export async function getPublicChildItems(
  parentId: string,
  limit = 50,
  offset = 0
): Promise<PublicItem[]> {
  // CR-2: Verify parent is actually public before returning inheriting children
  const parentIsPublic = await isItemFullyPublic(parentId);
  if (!parentIsPublic) {
    return [];
  }

  const items = await prisma.item.findMany({
    where: {
      parentId,
      OR: [
        // Explicitly public
        { inheritVisibility: false, isPublic: true },
        // Inheriting (parent verified public above)
        { inheritVisibility: true },
      ],
    },
    select: {
      id: true,
      name: true,
      description: true,
      parentId: true,
      depth: true,
      userId: true,
      tmdbId: true,
      tmdbType: true,
      updatedAt: true,
      files: {
        where: { fileType: "ARTWORK" },
        select: { id: true },
        take: 1,
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
    userId: item.userId,
    artworkId: item.files[0]?.id ?? null,
    tmdbId: item.tmdbId,
    tmdbType: item.tmdbType,
    forkCount: item._count.sourceForks,
    updatedAt: item.updatedAt,
  }));
}

/**
 * Fetches recently updated public items for the explore page.
 * Returns items from all users, sorted by update time.
 *
 * @param limit - Maximum items to return (default 50)
 * @param offset - Pagination offset (default 0)
 * @returns Array of public items with owner info
 */
export async function getExploreItems(
  limit = 50,
  offset = 0
): Promise<(PublicItem & { ownerUsername: string })[]> {
  const items = await prisma.item.findMany({
    where: {
      isPublic: true,
      inheritVisibility: false, // Only explicitly public items (not inherited)
      user: {
        isPublic: true,
        username: { not: null },
      },
    },
    select: {
      id: true,
      name: true,
      description: true,
      parentId: true,
      depth: true,
      userId: true,
      tmdbId: true,
      tmdbType: true,
      updatedAt: true,
      files: {
        where: { fileType: "ARTWORK" },
        select: { id: true },
        take: 1,
        orderBy: { isPrimary: "desc" },
      },
      _count: {
        select: { sourceForks: true },
      },
      user: {
        select: { username: true },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
    skip: offset,
  });

  return items
    .filter((item) => item.user?.username !== null)
    .map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      parentId: item.parentId,
      depth: item.depth,
      userId: item.userId,
      artworkId: item.files[0]?.id ?? null,
      tmdbId: item.tmdbId,
      tmdbType: item.tmdbType,
      forkCount: item._count.sourceForks,
      updatedAt: item.updatedAt,
      ownerUsername: item.user.username!,
    }));
}

/**
 * Gets the breadcrumb path for a public item.
 * Returns array of {id, name} from root to current item.
 * Only includes items that are public.
 *
 * @param itemId - Item ID to get breadcrumb for
 * @returns Breadcrumb path or null if not fully public
 */
export async function getPublicBreadcrumb(
  itemId: string
): Promise<Array<{ id: string; name: string }> | null> {
  // First verify fully public
  const isPublic = await isItemFullyPublic(itemId);
  if (!isPublic) {
    return null;
  }

  // Use recursive CTE to get ancestor chain
  const ancestors = await prisma.$queryRaw<
    Array<{ id: string; name: string; depth: number }>
  >`
    WITH RECURSIVE ancestors AS (
      SELECT id, name, "parentId", depth
      FROM "Item"
      WHERE id = ${itemId}

      UNION ALL

      SELECT i.id, i.name, i."parentId", i.depth
      FROM "Item" i
      INNER JOIN ancestors a ON i.id = a."parentId"
    )
    SELECT id, name, depth
    FROM ancestors
    ORDER BY depth ASC
  `;

  return ancestors.map(({ id, name }) => ({ id, name }));
}
