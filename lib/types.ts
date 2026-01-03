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
 * Tree item for hierarchical display.
 * Used by SortableTree component.
 */
export interface TreeItem {
  id: UniqueIdentifier;
  name: string;
  order: number;
  depth: number;
  parentId: UniqueIdentifier | null;
  children: TreeItem[];
  collapsed?: boolean;
  // SFTP-specific fields for display
  sftpPath?: string | null;
  connectionId?: string | null;
  // Artwork thumbnail
  artworkId?: string | null;
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
 * ItemFile as returned from the database.
 * Represents a file (media, artwork, subtitle) attached to an Item.
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
  playbackPosition: number | null;
  playbackDuration: number | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Item with attached files for detail view.
 */
export interface ItemWithFiles extends Item {
  files: ItemFile[];
}

/**
 * Item with optional artwork thumbnail for list views.
 * Used by grid and tree views to display item thumbnails.
 */
export interface ItemWithArtwork extends Item {
  /** First artwork file ID for thumbnail display */
  artworkId: string | null;
}
