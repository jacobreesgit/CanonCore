/**
 * Authorization helpers for public profiles and items.
 * Provides access control logic for public content visibility.
 * Uses React.cache() for per-request deduplication when called from
 * both generateMetadata and page components.
 */

"use server";

import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { COMPLETION_THRESHOLD } from "@/lib/progress-utils";
import { logger } from "@/lib/logger";
import type {
  ItemResult,
  SearchableUser,
  SearchablePublicItem,
} from "@/lib/types";

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
  /** Sort order within parent */
  order: number;
  /** Owner user ID */
  userId: string;
  /** First artwork file ID for thumbnail */
  artworkId: string | null;
  /** TMDB ID for metadata */
  tmdbId: number | null;
  /** TMDB media type */
  tmdbType: string | null;
  /** TMDB display preferences */
  tmdbShowTagline: boolean;
  tmdbShowMetadata: boolean;
  tmdbShowGenres: boolean;
  tmdbShowCast: boolean;
  tmdbShowProviders: boolean;
  tmdbShowVideos: boolean;
  tmdbShowRecommendations: boolean;
  /** Number of times this item has been forked */
  forkCount: number;
  /** When item was last updated */
  updatedAt: Date;
  /** Pinned order (null if not pinned) */
  pinnedOrder: number | null;
  /** File counts by type */
  fileCounts: { media: number; artwork: number; subtitles: number };
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
 * Fetches a user profile by username without requiring isPublic.
 * Used when the owner is viewing their own profile (determined by session).
 * Does NOT expose data to unauthorized users - caller must verify ownership.
 *
 * @param username - Username to look up (case-insensitive)
 * @returns Profile data or null if not found
 */
export const getProfileByIdOrUsername = cache(
  async (username: string): Promise<PublicProfile | null> => {
    const user = await prisma.user.findFirst({
      where: {
        username: {
          equals: username,
          mode: "insensitive",
        },
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
        order: true,
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
    });

    if (!item) {
      return null;
    }

    const artworkFile = item.files.find((f) => f.fileType === "ARTWORK");
    return {
      id: item.id,
      name: item.name,
      description: item.description,
      parentId: item.parentId,
      depth: item.depth,
      order: item.order,
      userId: item.userId,
      artworkId: artworkFile?.id ?? null,
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
        artwork: item.files.filter((f) => f.fileType === "ARTWORK").length,
        subtitles: item.files.filter((f) => f.fileType === "SUBTITLE").length,
      },
    };
  }
);

/**
 * Fetches all public items for a user's public profile.
 * Only returns explicitly public items with fork counts.
 * For own profile (currentUserId === userId), includes progress data.
 *
 * @param userId - User ID whose public items to fetch
 * @param limit - Maximum items to return (default 50)
 * @param offset - Pagination offset (default 0)
 * @param currentUserId - Current viewer's user ID (for progress calculation)
 * @returns Array of public items with optional progress data
 */
export async function getPublicItemsForUser(
  userId: string,
  limit = 50,
  offset = 0,
  currentUserId?: string | null
): Promise<
  (PublicItem & {
    progressPercentage?: number | null;
    watchedCount?: number;
    totalMediaCount?: number;
    totalItems?: number;
  })[]
> {
  const items = await prisma.item.findMany({
    where: {
      userId,
      parentId: null, // Only root-level items for profile display
      isPublic: true,
      inheritVisibility: false, // Only explicitly public items (consistent with Explore)
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
    orderBy: { updatedAt: "desc" },
    take: limit,
    skip: offset,
  });

  // Only calculate progress when viewing own profile
  const isOwnProfile = currentUserId && currentUserId === userId;
  interface ProgressData {
    percentage: number | null;
    watchedItems: number;
    itemsWithMedia: number;
    totalItems: number;
  }
  const progressMap = new Map<string, ProgressData>();

  if (isOwnProfile && items.length > 0) {
    const itemIds = items.map((i) => i.id);
    const progressData = await prisma.$queryRaw<
      Array<{
        rootItemId: string;
        totalItems: bigint;
        itemsWithMedia: bigint;
        watchedItems: bigint;
      }>
    >`
      WITH RECURSIVE descendants AS (
        -- Base: the items themselves
        SELECT id, id as "rootItemId" FROM "Item"
        WHERE id = ANY(${itemIds}) AND "userId" = ${currentUserId}
        UNION ALL
        -- Recursive: all descendants
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
          WHEN f."playbackPosition" IS NOT NULL
            AND f."playbackDuration" IS NOT NULL
            AND f."playbackDuration" > 0
            AND f."playbackPosition" >= f."playbackDuration" * ${COMPLETION_THRESHOLD}
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

  return items.map((item) => {
    const progress = isOwnProfile ? progressMap.get(item.id) : undefined;
    const artworkFile = item.files.find((f) => f.fileType === "ARTWORK");
    return {
      id: item.id,
      name: item.name,
      description: item.description,
      parentId: item.parentId,
      depth: item.depth,
      order: item.order,
      userId: item.userId,
      artworkId: artworkFile?.id ?? null,
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
        artwork: item.files.filter((f) => f.fileType === "ARTWORK").length,
        subtitles: item.files.filter((f) => f.fileType === "SUBTITLE").length,
      },
      // Only include progress for own profile
      ...(isOwnProfile && {
        progressPercentage: progress?.percentage ?? null,
        watchedCount: progress?.watchedItems ?? 0,
        totalMediaCount: progress?.itemsWithMedia ?? 0,
        totalItems: progress?.totalItems ?? 0,
      }),
    };
  });
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
      order: true,
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
    orderBy: { order: "asc" },
    take: limit,
    skip: offset,
  });

  return items.map((item) => {
    const artworkFile = item.files.find((f) => f.fileType === "ARTWORK");
    return {
      id: item.id,
      name: item.name,
      description: item.description,
      parentId: item.parentId,
      depth: item.depth,
      order: item.order,
      userId: item.userId,
      artworkId: artworkFile?.id ?? null,
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
        artwork: item.files.filter((f) => f.fileType === "ARTWORK").length,
        subtitles: item.files.filter((f) => f.fileType === "SUBTITLE").length,
      },
    };
  });
}

/**
 * Maximum number of descendants to return (prevents large payloads).
 * Public trees beyond this size should use pagination.
 */
const MAX_PUBLIC_DESCENDANTS = 500;

/**
 * Fetches all public descendants of a parent item.
 * Returns children, grandchildren, etc. that are effectively public.
 * Used for tree view on public item pages.
 *
 * Uses React.cache() for per-request deduplication (matches existing pattern).
 * Limits results to MAX_PUBLIC_DESCENDANTS for performance.
 *
 * @param parentId - Parent item ID
 * @returns Array of all public descendants ordered by depth then order
 */
export const getPublicDescendants = cache(
  async (parentId: string): Promise<PublicItem[]> => {
    // Fetch parent data and check visibility in parallel (avoid waterfall)
    const [parentIsPublic, parent] = await Promise.all([
      isItemFullyPublic(parentId),
      prisma.item.findUnique({
        where: { id: parentId },
        select: { userId: true, depth: true },
      }),
    ]);

    // Early return if not public or not found
    if (!parentIsPublic || !parent) {
      return [];
    }

    // Use recursive CTE to get all descendants that are effectively public
    // Items are public if: explicit (inheritVisibility=false, isPublic=true)
    // OR inheriting (inheritVisibility=true) from a public ancestor chain
    // Includes depth limit (max 10 levels) for defense-in-depth
    const descendants = await prisma.$queryRaw<{ id: string }[]>`
      WITH RECURSIVE descendants AS (
        -- Direct children that are effectively public
        SELECT id, "parentId", depth
        FROM "Item"
        WHERE "parentId" = ${parentId}
          AND "userId" = ${parent.userId}
          AND depth <= ${parent.depth + 10}
          AND (
            -- Explicitly public
            ("inheritVisibility" = false AND "isPublic" = true)
            OR
            -- Inheriting visibility (parent is verified public above)
            "inheritVisibility" = true
          )

        UNION ALL

        -- Recurse to children of public items
        SELECT i.id, i."parentId", i.depth
        FROM "Item" i
        INNER JOIN descendants d ON i."parentId" = d.id
        WHERE i."userId" = ${parent.userId}
          AND i.depth <= ${parent.depth + 10}
          AND (
            ("inheritVisibility" = false AND "isPublic" = true)
            OR
            "inheritVisibility" = true
          )
      )
      SELECT id FROM descendants
      LIMIT ${MAX_PUBLIC_DESCENDANTS}
    `;

    const descendantIds = descendants.map((d) => d.id);

    if (descendantIds.length === 0) {
      return [];
    }

    // Fetch full item data
    const items = await prisma.item.findMany({
      where: { id: { in: descendantIds } },
      orderBy: [{ depth: "asc" }, { order: "asc" }],
      select: {
        id: true,
        name: true,
        description: true,
        parentId: true,
        depth: true,
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
        updatedAt: true,
        order: true,
        pinnedOrder: true,
        files: {
          select: { id: true, fileType: true, isPrimary: true },
          orderBy: { isPrimary: "desc" },
        },
        _count: {
          select: { sourceForks: true },
        },
      },
    });

    return items.map((item) => {
      const artworkFile = item.files.find((f) => f.fileType === "ARTWORK");
      return {
        id: item.id,
        name: item.name,
        description: item.description,
        parentId: item.parentId,
        depth: item.depth,
        order: item.order,
        userId: item.userId,
        artworkId: artworkFile?.id ?? null,
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
          artwork: item.files.filter((f) => f.fileType === "ARTWORK").length,
          subtitles: item.files.filter((f) => f.fileType === "SUBTITLE").length,
        },
      };
    });
  }
);

/**
 * Fetches recently updated public items for the explore page.
 * Returns items from all users, sorted by update time.
 * For the current user's items, includes progress data.
 *
 * @param limit - Maximum items to return (default 50)
 * @param offset - Pagination offset (default 0)
 * @param currentUserId - Current user ID to calculate progress for own items
 * @returns Array of public items with owner info and progress for own items
 */
export async function getExploreItems(
  limit = 50,
  offset = 0,
  currentUserId?: string | null
): Promise<
  (PublicItem & {
    ownerUsername: string;
    ownerName: string | null;
    progressPercentage?: number | null;
    watchedCount?: number;
    totalMediaCount?: number;
    totalItems?: number;
    isForkedByCurrentUser?: boolean;
  })[]
> {
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
      order: true,
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
    orderBy: { updatedAt: "desc" },
    take: limit,
    skip: offset,
  });

  // Get IDs of current user's items to calculate progress
  const ownItemIds = currentUserId
    ? items.filter((i) => i.userId === currentUserId).map((i) => i.id)
    : [];

  // Calculate progress for own items using recursive CTE (same pattern as item-actions.ts)
  interface ProgressData {
    percentage: number | null;
    watchedItems: number;
    itemsWithMedia: number;
    totalItems: number;
  }
  const progressMap = new Map<string, ProgressData>();
  if (ownItemIds.length > 0 && currentUserId) {
    const progressData = await prisma.$queryRaw<
      Array<{
        rootItemId: string;
        totalItems: bigint;
        itemsWithMedia: bigint;
        watchedItems: bigint;
      }>
    >`
      WITH RECURSIVE descendants AS (
        -- Base: the items themselves
        SELECT id, id as "rootItemId" FROM "Item"
        WHERE id = ANY(${ownItemIds}) AND "userId" = ${currentUserId}
        UNION ALL
        -- Recursive: all descendants
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
          WHEN f."playbackPosition" IS NOT NULL
            AND f."playbackDuration" IS NOT NULL
            AND f."playbackDuration" > 0
            AND f."playbackPosition" >= f."playbackDuration" * ${COMPLETION_THRESHOLD}
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

  // Look up which items the current user has forked
  const forkedSourceIds = new Set<string>();
  if (currentUserId) {
    const forks = await prisma.fork.findMany({
      where: {
        userId: currentUserId,
        sourceItemId: { in: items.map((i) => i.id) },
      },
      select: { sourceItemId: true },
    });
    for (const fork of forks) {
      forkedSourceIds.add(fork.sourceItemId);
    }
  }

  return items
    .filter((item) => item.user && item.user.username != null)
    .map((item) => {
      const isOwnItem = currentUserId && item.userId === currentUserId;
      const progress = isOwnItem ? progressMap.get(item.id) : undefined;
      const artworkFile = item.files.find((f) => f.fileType === "ARTWORK");
      return {
        id: item.id,
        name: item.name,
        description: item.description,
        parentId: item.parentId,
        depth: item.depth,
        order: item.order,
        userId: item.userId,
        artworkId: artworkFile?.id ?? null,
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
          artwork: item.files.filter((f) => f.fileType === "ARTWORK").length,
          subtitles: item.files.filter((f) => f.fileType === "SUBTITLE").length,
        },
        ownerUsername: item.user.username!,
        ownerName: item.user.name,
        // Only include progress for own items
        ...(isOwnItem && {
          progressPercentage: progress?.percentage ?? null,
          watchedCount: progress?.watchedItems ?? 0,
          totalMediaCount: progress?.itemsWithMedia ?? 0,
          totalItems: progress?.totalItems ?? 0,
        }),
        isForkedByCurrentUser: forkedSourceIds.has(item.id),
      };
    });
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

/**
 * Fetches library progress for a public profile.
 * Only counts items where isPublic is true.
 * Used by viewers to see overall watched progress on a profile page.
 * Cached per-request to deduplicate calls from generateMetadata and page.
 *
 * @param userId - User ID whose public library progress to calculate
 * @returns Progress data or null if no items with media
 */
export const getPublicLibraryProgress = cache(
  async (
    userId: string
  ): Promise<{
    percentage: number;
    watchedItems: number;
    itemsWithMedia: number;
    totalItems: number;
  } | null> => {
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
          WHEN f."playbackPosition" IS NOT NULL
            AND f."playbackDuration" IS NOT NULL
            AND f."playbackDuration" > 0
            AND f."playbackPosition" >= f."playbackDuration" * ${COMPLETION_THRESHOLD}
          THEN i.id
        END) as "watchedItems"
      FROM "Item" i
      LEFT JOIN "ItemFile" f ON f."itemId" = i.id
        AND f."fileType" = 'MEDIA'
        AND f."isPrimary" = true
      WHERE i."userId" = ${userId}
        AND i."isPublic" = true
    `;

    if (result.length === 0) {
      return null;
    }

    const row = result[0];
    const totalItems = Number(row.totalItems);
    const itemsWithMedia = Number(row.itemsWithMedia);
    const watchedItems = Number(row.watchedItems);

    // Return null if no items with media
    if (itemsWithMedia === 0) {
      return null;
    }

    return {
      watchedItems,
      itemsWithMedia,
      percentage: Math.round((watchedItems / itemsWithMedia) * 100),
      totalItems,
    };
  }
);

/**
 * Searches for public users for spotlight search.
 * Returns users with public profiles and usernames set.
 * Excludes the current user from results.
 * Wrapped with React.cache() for per-request deduplication.
 *
 * @returns Array of searchable public users
 */
export const searchPublicUsers = cache(
  async (): Promise<ItemResult<SearchableUser[]>> => {
    const [session, rateLimitResult] = await Promise.all([
      auth(),
      checkRateLimit("userSearch"),
    ]);

    if (rateLimitResult) {
      return rateLimitResult;
    }

    try {
      const users = await prisma.user.findMany({
        where: {
          isPublic: true,
          username: { not: null },
          // Exclude current user's profile (only if logged in)
          ...(session?.user?.id && { id: { not: session.user.id } }),
        },
        select: {
          id: true,
          username: true,
          name: true,
          // NOTE: createdAt intentionally NOT selected - not needed for UI
        },
        orderBy: { createdAt: "desc" },
        take: 50, // Users: 50 limit (profiles change less frequently)
      });

      const searchableUsers: SearchableUser[] = users
        .filter(
          (u): u is typeof u & { username: string } => u.username !== null
        )
        .map((user) => ({
          id: user.id,
          username: user.username,
          name: user.name,
        }));

      return { success: true, data: searchableUsers };
    } catch {
      return { error: "Failed to search users" };
    }
  }
);

/**
 * Searches for explicitly public items for spotlight search.
 * Only returns items where isPublic=true AND inheritVisibility=false.
 * Items with inheritVisibility=true are NOT included (discoverable only via navigation).
 * Excludes the current user's items.
 * Wrapped with React.cache() for per-request deduplication.
 *
 * @returns Array of searchable public items with owner info
 */
export const searchPublicItems = cache(
  async (): Promise<ItemResult<SearchablePublicItem[]>> => {
    const [session, rateLimitResult] = await Promise.all([
      auth(),
      checkRateLimit("publicItemSearch"),
    ]);

    if (rateLimitResult) {
      return rateLimitResult;
    }

    try {
      const items = await prisma.item.findMany({
        where: {
          // CRITICAL: Only explicitly public items
          // Items with inheritVisibility=true are NOT searchable
          isPublic: true,
          inheritVisibility: false,
          // Exclude current user's items (only if logged in)
          ...(session?.user?.id && { userId: { not: session.user.id } }),
          // Owner must be public with username
          user: {
            isPublic: true,
            username: { not: null },
          },
        },
        select: {
          id: true,
          name: true,
          description: true,
          // NOTE: updatedAt intentionally NOT selected - not needed for UI
          files: {
            where: { fileType: "ARTWORK" },
            select: { id: true },
            take: 1,
            orderBy: { isPrimary: "desc" },
          },
          user: {
            select: {
              username: true,
              name: true,
            },
          },
        },
        orderBy: { updatedAt: "desc" },
        take: 100, // Items: 100 limit (more variety in public collections)
      });

      const searchableItems: SearchablePublicItem[] = items
        .filter((item) => item.user && item.user.username != null)
        .map((item) => ({
          id: item.id,
          name: item.name,
          description: item.description,
          artworkId: item.files[0]?.id ?? null,
          ownerUsername: item.user.username!,
          ownerName: item.user.name,
        }));

      return { success: true, data: searchableItems };
    } catch {
      return { error: "Failed to search public items" };
    }
  }
);

/**
 * Featured item with artwork for carousel display.
 */
export interface FeaturedItem {
  /** Item ID */
  id: string;
  /** Item name */
  name: string;
  /** Item description */
  description: string | null;
  /** Artwork file ID for background image */
  artworkId: string;
  /** Owner username for attribution */
  ownerUsername: string;
  /** Owner display name */
  ownerName: string | null;
  /** Owner user ID */
  ownerUserId: string;
  /** Whether owner has uploaded profile image */
  ownerHasImage: boolean;
  /** Link to item page */
  link: string;
  /** TMDB ID for metadata enrichment */
  tmdbId: number | null;
  /** TMDB media type (movie/tv) */
  tmdbType: string | null;
}

/**
 * Fetches featured public items for the Explore carousel.
 * Returns items with artwork, ordered by most recently updated.
 * Uses React.cache() for request deduplication within a single request.
 * Gracefully returns empty array on errors to prevent page crashes.
 *
 * @param limit - Maximum number of items to return (default: 5)
 * @returns Array of featured items with artwork and owner info
 */
export const getFeaturedItems = cache(
  async (limit = 5): Promise<FeaturedItem[]> => {
    try {
      const items = await prisma.item.findMany({
        where: {
          isPublic: true,
          inheritVisibility: false,
          // Must have artwork for carousel display
          files: {
            some: { fileType: "ARTWORK" },
          },
          user: {
            isPublic: true,
            username: { not: null },
          },
        },
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
            orderBy: [{ isHero: "desc" }, { isPrimary: "desc" }],
          },
          user: {
            select: {
              username: true,
              name: true,
              image: true,
            },
          },
        },
        orderBy: { updatedAt: "desc" },
        take: limit,
      });

      // Filter out items without valid artwork ID (prevents /api/artwork/ invalid calls)
      // Also filter out items where username is null (stricter than query allows)
      return items
        .filter((item) => item.files[0]?.id && item.user.username)
        .map((item) => ({
          id: item.id,
          name: item.name,
          description: item.description,
          artworkId: item.files[0].id, // Safe due to filter above
          ownerUsername: item.user.username as string, // Safe due to filter
          ownerName: item.user.name,
          ownerUserId: item.userId,
          ownerHasImage: item.user.image !== null,
          link: `/u/${item.user.username}/${item.id}`,
          tmdbId: item.tmdbId,
          tmdbType: item.tmdbType,
        }));
    } catch (error) {
      // Graceful degradation - return empty array instead of crashing page
      logger.error({ error, limit }, "Failed to fetch featured items");
      return [];
    }
  }
);
