/**
 * Shared type definitions for items and dnd-kit tree operations.
 */

import type { MutableRefObject } from "react";
import type { UniqueIdentifier } from "@dnd-kit/core";
import type { FileType } from "@prisma/client";

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
  // SFTP-specific fields
  sftpPath: string | null;
  sftpModifiedAt: Date | null;
  connectionId: string | null;
}

/**
 * Item with connection details for detail pages.
 * Used when displaying item details with connection info.
 */
export interface ItemWithConnection extends Item {
  /** Connection details if this item is SFTP-linked */
  connection: { id: string; name: string } | null;
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
  // SFTP-specific fields for display
  sftpPath?: string | null;
  connectionId?: string | null;
  connectionName?: string | null;
  // Artwork thumbnail
  artworkId?: string | null;
  // File and child counts for stats display
  fileCounts?: FileCounts;
  childCount?: number;
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
  sftpPath: string;
  fileType: FileType;
  mimeType: string | null;
  size: bigint | null;
  sftpModifiedAt: Date | null;
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
  sftpPath: string;
  fileType: FileType;
  mimeType: string | null;
  size: number | null;
  sftpModifiedAt: Date | null;
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
  /** Connection name for badge display (optional) */
  connectionName?: string | null;
  /** Counts of attached files by type (media, artwork, subtitles) */
  fileCounts: FileCounts;
  /** Number of child items (subfolders) */
  childCount: number;
}
