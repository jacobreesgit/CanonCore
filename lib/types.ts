/**
 * Shared type definitions for items and dnd-kit tree operations.
 */

import type { MutableRefObject } from "react";
import type { UniqueIdentifier } from "@dnd-kit/core";
import type { FileType, SyncStatus } from "@prisma/client";
// Re-export SyncStatus enum for client-side use
export { SyncStatus } from "@prisma/client";

/**
 * Database Item type (from Prisma).
 * Represents a container in the item hierarchy.
 * Items can have children (sub-items) and attached files (ItemFile).
 */
export interface Item {
  id: string;
  name: string;
  description: string | null;
  parentId: string | null;
  order: number;
  depth: number;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  // Google Drive fields
  driveFileId: string | null;
  driveModifiedAt: Date | null;
  driveThumbnailUrl: string | null;
  syncStatus: SyncStatus;
  syncError: string | null;
  driveConnectionId: string | null;
}

/**
 * Tree item for hierarchical display.
 * Used by SortableTree component.
 */
export interface TreeItem {
  id: UniqueIdentifier;
  name: string;
  description?: string | null;
  order: number;
  depth: number;
  parentId: UniqueIdentifier | null;
  children: TreeItem[];
  collapsed?: boolean;
  // Artwork thumbnail
  artworkId?: string | null;
  // Google Drive folder ID (if synced)
  driveFileId?: string | null;
  // File and child counts for stats display
  fileCounts?: FileCounts;
  childCount?: number;
  // Primary media filename for "now playing" display
  primaryMediaName?: string | null;
  // Media icon type: 'film' (all video), 'music' (all audio), 'mixed' (both)
  mediaIconType?: "film" | "music" | "mixed" | null;
}

export type TreeItems = TreeItem[];

/**
 * Flattened tree item for drag operations.
 * Created by flattenTree(), consumed by getProjection().
 */
export interface FlattenedItem extends TreeItem {
  parentId: UniqueIdentifier | null;
  depth: number;
  index: number;
}

/**
 * Sensor context for keyboard navigation.
 */
export type SensorContext = MutableRefObject<{
  items: FlattenedItem[];
  offset: number;
}>;

/**
 * Result type for item actions.
 * Either success with data or error message.
 */
export type ItemResult<T = void> =
  | { success: true; data?: T; error?: never }
  | { success?: never; error: string };

/**
 * Breadcrumb item for navigation.
 */
export interface BreadcrumbItem {
  id: string;
  name: string;
}

/**
 * ItemFile as returned from the database (Prisma).
 * Represents a file (media, artwork, subtitle) attached to an Item.
 * Note: size is bigint from Prisma, use serializeItemFile before sending to client.
 */
export interface ItemFile {
  id: string;
  itemId: string;
  filename: string;
  fileType: FileType;
  mimeType: string | null;
  size: bigint | null;
  // Google Drive file ID
  driveFileId: string | null;
  // Sync status
  syncStatus: SyncStatus;
  syncError: string | null;
  // User overrides
  isPrimary: boolean;
  isHero: boolean;
  playbackPosition: number | null;
  playbackDuration: number | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * ItemFile safe for JSON serialization (client components).
 * BigInt size is converted to number (safe up to ~9 petabytes).
 */
export interface SerializedItemFile {
  id: string;
  itemId: string;
  filename: string;
  fileType: FileType;
  mimeType: string | null;
  size: number | null;
  // Google Drive file ID
  driveFileId: string | null;
  // Sync status
  syncStatus: SyncStatus;
  syncError: string | null;
  // User overrides
  isPrimary: boolean;
  isHero: boolean;
  playbackPosition: number | null;
  playbackDuration: number | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Converts an ItemFile to a serializable format for client components.
 * Converts BigInt size to number.
 *
 * @param file - ItemFile from Prisma
 * @returns SerializedItemFile safe for JSON
 */
export function serializeItemFile(file: ItemFile): SerializedItemFile {
  return {
    ...file,
    size: file.size !== null ? Number(file.size) : null,
  };
}

/**
 * File counts by type for display in grid/tree views.
 * Shows how many files of each type are attached to an item.
 */
export interface FileCounts {
  /** Number of media files (video, audio) */
  media: number;
  /** Number of artwork files (images) */
  artwork: number;
  /** Number of subtitle files */
  subtitles: number;
}

/**
 * Item with optional artwork thumbnail for list views.
 * Used by grid and tree views to display item thumbnails.
 */
export interface ItemWithArtwork extends Item {
  /** First artwork file ID for thumbnail display */
  artworkId: string | null;
  /** Counts of attached files by type (media, artwork, subtitles) */
  fileCounts: FileCounts;
  /** Number of child items (subfolders) */
  childCount: number;
  /** Primary media filename for "now playing" display */
  primaryMediaName: string | null;
  /** Media icon type: 'film' (all video), 'music' (all audio), 'mixed' (both) */
  mediaIconType: "film" | "music" | "mixed" | null;
}

/**
 * Item type alias with sync fields emphasized.
 * Use when working specifically with sync-related functionality.
 * Same as Item - provided for semantic clarity in sync contexts.
 */
export type ItemWithSync = Item;

/**
 * Google Drive connection status for UI display.
 * Returned by getGoogleDriveConnection() server action.
 */
export interface GoogleDriveConnection {
  email: string;
  rootFolderId: string | null;
  isActive: boolean;
  needsReauth: boolean;
  lastSyncAt: Date | null;
  lastError: string | null;
}

/**
 * Item data for spotlight search display.
 * Includes breadcrumb path for nested items and artwork for thumbnails.
 */
export interface SearchableItem {
  id: string;
  name: string;
  parentId: string | null;
  depth: number;
  description: string | null;
  /** First artwork file ID for thumbnail display */
  artworkId: string | null;
  /** Breadcrumb path like "Movies / Star Wars" for nested items */
  breadcrumb: string | null;
}

/**
 * File queued for upload when creating an item.
 * Holds File object and metadata until item is created.
 * isPrimary and isHero are set during upload transformation, not when queuing.
 */
export interface QueuedFile {
  /** Unique ID for tracking in the queue */
  id: string;
  /** The actual File object */
  file: File;
  /** File type category (MEDIA, ARTWORK, SUBTITLE) */
  fileType: FileType;
  /** File size in bytes */
  size: number;
  /** Upload status */
  status: "pending" | "uploading" | "success" | "error";
  /** Error message if upload failed */
  error?: string;
  /** Whether this is the primary file for its category (set during upload) */
  isPrimary?: boolean;
  /** Whether this is the hero image (set during upload) */
  isHero?: boolean;
}

/**
 * Categorized queued files by type for AddItemDialog.
 * Allows users to queue files by category before item creation.
 */
export interface QueuedFilesByCategory {
  /** Primary media files (first becomes primary playback) */
  media: QueuedFile[];
  /** Primary artwork files (first becomes thumbnail) */
  artwork: QueuedFile[];
  /** Hero image files (first becomes hero banner) */
  hero: QueuedFile[];
  /** Default subtitle files (first loads by default) */
  subtitle: QueuedFile[];
}

/**
 * Source of artwork selection in wizard steps.
 * - "tmdb": Selected from TMDB images gallery
 * - "existing": Selected from existing uploaded files
 * - "queued": Selected from newly queued files (upload mode)
 */
export type ArtworkSelectionSource = "tmdb" | "existing" | "queued";

/**
 * TMDB metadata selection for applying to a new or existing item.
 * Captures which fields to update and the source data.
 */
export interface TMDBMetadataSelection {
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
  /** Preview data from TMDB */
  preview: {
    name: string;
    description: string;
    posterPath: string | null;
    backdropPath: string | null;
  };
}

// =============================================================================
// User Preferences Types
// =============================================================================

/** View mode for items display. */
export type ViewMode = "grid" | "tree";

/** Sort option for items list. */
export type SortOption =
  | "custom"
  | "name-asc"
  | "name-desc"
  | "created-desc"
  | "created-asc"
  | "updated-desc";

/** Filter option for items list. */
export type FilterOption =
  | "all"
  | "has-files"
  | "no-files"
  | "synced"
  | "pending"
  | "error";

/** Valid view modes for validation. */
export const VALID_VIEW_MODES: ViewMode[] = ["grid", "tree"];

/** Valid sort options for validation. */
export const VALID_SORT_OPTIONS: SortOption[] = [
  "custom",
  "name-asc",
  "name-desc",
  "created-desc",
  "created-asc",
  "updated-desc",
];

/** Valid filter options for validation. */
export const VALID_FILTER_OPTIONS: FilterOption[] = [
  "all",
  "has-files",
  "no-files",
  "synced",
  "pending",
  "error",
];

/**
 * Type guard for validating sort options.
 *
 * @param value - String value to validate
 * @returns True if value is a valid SortOption
 */
export function isValidSortOption(value: string): value is SortOption {
  return VALID_SORT_OPTIONS.includes(value as SortOption);
}

/**
 * Type guard for validating filter options.
 *
 * @param value - String value to validate
 * @returns True if value is a valid FilterOption
 */
export function isValidFilterOption(value: string): value is FilterOption {
  return VALID_FILTER_OPTIONS.includes(value as FilterOption);
}

/**
 * Type guard for validating view modes.
 *
 * @param value - String value to validate
 * @returns True if value is a valid ViewMode
 */
export function isValidViewMode(value: string): value is ViewMode {
  return VALID_VIEW_MODES.includes(value as ViewMode);
}
