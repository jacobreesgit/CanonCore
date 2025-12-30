/**
 * Shared type definitions for items and dnd-kit tree operations.
 */

import type { MutableRefObject } from "react";
import type { UniqueIdentifier } from "@dnd-kit/core";

/**
 * Database Item type (from Prisma).
 * Represents a folder in the filesystem hierarchy.
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
