/**
 * Utility functions for transforming items between flat and tree representations.
 * Used for converting database items to tree structure and vice versa.
 */

import type {
  Item,
  ItemWithArtwork,
  TreeItem,
  SortOption,
  FilterOption,
} from "./types";

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

/** Input type for itemsToTree - supports both Item and ItemWithArtwork */
type ItemInput = Item | ItemWithArtwork;

/**
 * Converts a flat array of items from the database into a hierarchical tree structure.
 * Items are organized by their parentId relationships.
 * Supports items with optional artwork thumbnails.
 */
export function itemsToTree(items: ItemInput[]): TreeItem[] {
  const itemMap = new Map<string, TreeItem>();
  const roots: TreeItem[] = [];

  // First pass: create TreeItem nodes for all items
  for (const item of items) {
    itemMap.set(item.id, {
      id: item.id,
      name: item.name,
      description: item.description,
      order: item.order,
      depth: item.depth,
      parentId: item.parentId,
      children: [],
      // Include pinned order for sidebar pin state
      pinnedOrder: "pinnedOrder" in item ? item.pinnedOrder : null,
      // Include artwork if available
      artworkId: "artworkId" in item ? item.artworkId : null,
      // Include Google Drive folder ID if synced
      driveFileId: "driveFileId" in item ? item.driveFileId : null,
      // Include file and child counts for stats display
      fileCounts: "fileCounts" in item ? item.fileCounts : undefined,
      childCount: "childCount" in item ? item.childCount : undefined,
      // Include media icon type for audio/video/mixed display
      mediaIconType: "mediaIconType" in item ? item.mediaIconType : undefined,
      // Include progress data for display
      progressPercentage:
        "progress" in item ? (item.progress?.percentage ?? null) : null,
      watchedCount:
        "progress" in item
          ? (item.progress?.watchedItems ?? undefined)
          : undefined,
      totalMediaCount:
        "progress" in item
          ? (item.progress?.itemsWithMedia ?? undefined)
          : undefined,
      totalItems:
        "progress" in item
          ? (item.progress?.totalItems ?? undefined)
          : undefined,
    });
  }

  // Second pass: build the tree structure
  for (const item of items) {
    const treeItem = itemMap.get(item.id);
    if (!treeItem) continue;

    if (item.parentId) {
      const parent = itemMap.get(item.parentId);
      if (parent) {
        parent.children.push(treeItem);
      } else {
        // Parent not found, treat as root
        roots.push(treeItem);
      }
    } else {
      roots.push(treeItem);
    }
  }

  // Sort children by order at each level
  function sortChildren(nodes: TreeItem[]): TreeItem[] {
    nodes.sort((a, b) => a.order - b.order);
    for (const node of nodes) {
      if (node.children.length > 0) {
        sortChildren(node.children);
      }
    }
    return nodes;
  }

  return sortChildren(roots);
}

/**
 * Converts a flat array of public items to a hierarchical tree structure.
 * Similar to itemsToTree but for PublicItem types.
 * Adjusts depth relative to the parent item (tree depth 0 = first children level).
 *
 * @param items - Flat array of public items
 * @param parentDepth - Depth of the parent item (for relative depth calculation)
 * @returns Tree structure suitable for Tree component
 */
export function publicItemsToTree(
  items: Array<{
    id: string;
    name: string;
    description: string | null;
    parentId: string | null;
    depth: number;
    order: number;
    artworkId: string | null;
    // Optional progress fields (only included for own items)
    progressPercentage?: number | null;
    watchedCount?: number;
    totalMediaCount?: number;
    totalItems?: number;
  }>,
  parentDepth: number
): TreeItem[] {
  const itemMap = new Map<string, TreeItem>();
  const roots: TreeItem[] = [];

  // First pass: create TreeItem nodes for all items
  for (const item of items) {
    itemMap.set(item.id, {
      id: item.id,
      name: item.name,
      description: item.description,
      // Adjust depth relative to parent (children become depth 0, grandchildren depth 1, etc.)
      depth: item.depth - parentDepth - 1,
      order: item.order,
      parentId: item.parentId,
      children: [],
      artworkId: item.artworkId,
      // Include progress data if available (for own items)
      progressPercentage: item.progressPercentage ?? null,
      watchedCount: item.watchedCount,
      totalMediaCount: item.totalMediaCount,
      totalItems: item.totalItems,
    });
  }

  // Second pass: build the tree structure
  for (const item of items) {
    const treeItem = itemMap.get(item.id);
    if (!treeItem) continue;

    if (item.parentId) {
      const parent = itemMap.get(item.parentId);
      if (parent) {
        parent.children.push(treeItem);
      } else {
        // Parent not in items (it's the page's parent), treat as root
        roots.push(treeItem);
      }
    } else {
      roots.push(treeItem);
    }
  }

  // Sort children by order at each level
  function sortChildren(nodes: TreeItem[]): TreeItem[] {
    nodes.sort((a, b) => a.order - b.order);
    for (const node of nodes) {
      if (node.children.length > 0) {
        sortChildren(node.children);
      }
    }
    return nodes;
  }

  return sortChildren(roots);
}

/**
 * Builds a map of item IDs to their descendant counts.
 * Used by getAllItems, getDescendants, and related functions.
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
 * Extracts updates from tree items for database persistence.
 * Returns an array of item updates with id, parentId, depth, and order.
 */
export function treeToItemUpdates(items: TreeItem[]): Array<{
  id: string;
  parentId: string | null;
  depth: number;
  order: number;
}> {
  const updates: Array<{
    id: string;
    parentId: string | null;
    depth: number;
    order: number;
  }> = [];

  function traverse(
    nodes: TreeItem[],
    parentId: string | null,
    depth: number
  ): void {
    for (let order = 0; order < nodes.length; order++) {
      const node = nodes[order];
      updates.push({
        id: String(node.id),
        parentId,
        depth,
        order,
      });

      if (node.children.length > 0) {
        traverse(node.children, String(node.id), depth + 1);
      }
    }
  }

  traverse(items, null, 0);
  return updates;
}

// =============================================================================
// Sorting and Filtering
// =============================================================================

/** Configuration for a sort option with value and display label. */
export interface SortOptionConfig {
  value: SortOption;
  label: string;
}

/** Configuration for a filter option with value and display label. */
export interface FilterOptionConfig {
  value: FilterOption;
  label: string;
}

/** Sort options with display labels. */
export const SORT_OPTIONS: SortOptionConfig[] = [
  { value: "custom", label: "Custom Order" },
  { value: "name-asc", label: "Name A-Z" },
  { value: "name-desc", label: "Name Z-A" },
  { value: "created-desc", label: "Newest First" },
  { value: "created-asc", label: "Oldest First" },
  { value: "updated-desc", label: "Recently Updated" },
];

/** Filter options with display labels. */
export const FILTER_OPTIONS: FilterOptionConfig[] = [
  { value: "all", label: "All Items" },
  { value: "has-files", label: "Has Files" },
  { value: "no-files", label: "No Files" },
  { value: "synced", label: "Synced" },
  { value: "pending", label: "Pending Sync" },
  { value: "error", label: "Sync Error" },
];

/** Sort options for explore page (no custom ordering, no created-* since PublicItem lacks createdAt). */
export const EXPLORE_SORT_OPTIONS: SortOptionConfig[] = [
  { value: "updated-desc", label: "Recently Updated" },
  { value: "name-asc", label: "Name A-Z" },
  { value: "name-desc", label: "Name Z-A" },
];

/** Filter options for explore page (no sync-related filters). */
export const EXPLORE_FILTER_OPTIONS: FilterOptionConfig[] = [
  { value: "all", label: "All Items" },
];

/**
 * Sorts items by the specified sort option.
 * Returns a new array without mutating the original.
 *
 * @param items - Array of items to sort
 * @param sortBy - Sort option to apply
 * @returns Sorted array of items
 *
 * @example
 * const sorted = sortItems(items, "name-asc");
 * // Returns items sorted alphabetically by name
 *
 * @example
 * const sorted = sortItems(items, "created-desc");
 * // Returns items sorted by creation date, newest first
 */
export function sortItems(
  items: ItemWithArtwork[],
  sortBy: SortOption
): ItemWithArtwork[] {
  if (items.length === 0) return [];

  switch (sortBy) {
    case "custom":
      return items.toSorted((a, b) => a.order - b.order);
    case "name-asc":
      return items.toSorted((a, b) => a.name.localeCompare(b.name));
    case "name-desc":
      return items.toSorted((a, b) => b.name.localeCompare(a.name));
    case "created-desc":
      return items.toSorted(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
      );
    case "created-asc":
      return items.toSorted(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
      );
    case "updated-desc":
      return items.toSorted(
        (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
      );
    default:
      return [...items];
  }
}

/**
 * Filters items by the specified filter option.
 * Returns a new array without mutating the original.
 *
 * @param items - Array of items to filter
 * @param filterBy - Filter option to apply
 * @returns Filtered array of items
 *
 * @example
 * const withFiles = filterItems(items, "has-files");
 * // Returns only items that have at least one file attached
 *
 * @example
 * const synced = filterItems(items, "synced");
 * // Returns only items with SYNCED status
 */
export function filterItems(
  items: ItemWithArtwork[],
  filterBy: FilterOption
): ItemWithArtwork[] {
  if (items.length === 0) return [];

  switch (filterBy) {
    case "all":
      return [...items];
    case "has-files":
      return items.filter(
        (item) =>
          item.fileCounts.media +
            item.fileCounts.artwork +
            item.fileCounts.subtitles >
          0
      );
    case "no-files":
      return items.filter(
        (item) =>
          item.fileCounts.media +
            item.fileCounts.artwork +
            item.fileCounts.subtitles ===
          0
      );
    case "synced":
      return items.filter((item) => item.syncStatus === "SYNCED");
    case "pending":
      return items.filter((item) => item.syncStatus === "PENDING");
    case "error":
      return items.filter((item) => item.syncStatus === "ERROR");
    default:
      return [...items];
  }
}

/**
 * Sort items for public/explore pages.
 * Uses toSorted() for immutability (Rule 7.12).
 * Generic to work with any item type having name and updatedAt fields.
 * Note: Only supports name-* and updated-* sorts since PublicItem lacks createdAt.
 *
 * @param items - Array of items with name and updatedAt fields
 * @param sortBy - Sort option to apply
 * @returns New sorted array (original unchanged)
 *
 * @example
 * const sorted = sortPublicItems(publicItems, "name-asc");
 * // Returns items sorted alphabetically by name
 */
export function sortPublicItems<
  T extends { name: string; updatedAt: Date | string },
>(items: T[], sortBy: SortOption): T[] {
  return items.toSorted((a, b) => {
    switch (sortBy) {
      case "name-asc":
        return a.name.localeCompare(b.name);
      case "name-desc":
        return b.name.localeCompare(a.name);
      case "updated-desc":
      default:
        return (
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
    }
  });
}
