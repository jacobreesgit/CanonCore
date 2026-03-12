/**
 * Shared mapper functions for transforming Prisma items to ItemWithArtwork.
 * Extracted from apps/web/lib/item-actions.ts for tRPC router use.
 */

import type { ItemProgress, ItemWithArtwork, FileCounts } from "@canoncore/types";
import { resolveArtworkId } from "@canoncore/utils";

/**
 * Minimal input shape for the shared toItemWithArtwork mapper.
 * Matches the Prisma include used by item queries.
 */
export interface ItemWithFiles {
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
 * Determines the media icon type based on all media files' MIME types.
 * - "film" if all media files are video/*
 * - "music" if all media files are audio/*
 * - "mixed" if both video and audio files exist
 * - null if no media files
 */
export function getMediaIconType(
  mediaFiles: { mimeType: string | null }[]
): "film" | "music" | "mixed" | null {
  if (mediaFiles.length === 0) return null;

  let hasAudio = false;
  let hasVideo = false;

  for (const file of mediaFiles) {
    if (file.mimeType?.startsWith("audio/")) {
      hasAudio = true;
    } else if (file.mimeType?.startsWith("video/")) {
      hasVideo = true;
    } else {
      // Unknown media type - treat as video (default)
      hasVideo = true;
    }

    // Early exit if we already know it's mixed
    if (hasAudio && hasVideo) return "mixed";
  }

  // After loop: at most one of hasAudio/hasVideo is true (mixed already returned)
  if (hasAudio) return "music";
  return "film";
}

/**
 * Builds a map of item IDs to their descendant counts.
 * Used by list, listAll, getDescendants, and related queries.
 *
 * @param items - Array of items with id and parentId
 * @returns Function to get descendant count for any item ID
 */
export function buildDescendantCounter(
  items: { id: string; parentId: string | null }[]
): (itemId: string) => number {
  // Build parent -> children map
  const childrenMap = new Map<string | null, string[]>();
  for (const item of items) {
    const siblings = childrenMap.get(item.parentId) ?? [];
    siblings.push(item.id);
    childrenMap.set(item.parentId, siblings);
  }

  // Cache for memoization
  const cache = new Map<string, number>();

  // Recursive counter with memoization
  return function countDescendants(itemId: string): number {
    if (cache.has(itemId)) {
      return cache.get(itemId)!;
    }
    const children = childrenMap.get(itemId) ?? [];
    let count = children.length;
    for (const childId of children) {
      count += countDescendants(childId);
    }
    cache.set(itemId, count);
    return count;
  };
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
export function toItemWithArtwork(
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
  const fileCounts: FileCounts = {
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
export function resolveProgress(
  progressMap: Map<string, ItemProgress>,
  itemId: string
): ItemProgress | null {
  const itemProgress = progressMap.get(itemId);
  return itemProgress && itemProgress.percentage !== null
    ? itemProgress
    : null;
}

/** Prisma select clause for item files, reusable across queries. */
export const ITEM_FILES_SELECT = {
  id: true,
  fileType: true,
  isPrimary: true,
  filename: true,
  mimeType: true,
  durationMs: true,
  height: true,
} as const;
