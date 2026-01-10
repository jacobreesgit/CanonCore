/**
 * Utility functions for transforming items between flat and tree representations.
 * Used for converting database items to tree structure and vice versa.
 */

import type { Item, ItemWithArtwork, TreeItem } from "./types";

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
      // Include artwork if available
      artworkId: "artworkId" in item ? item.artworkId : null,
      // Include file and child counts for stats display
      fileCounts: "fileCounts" in item ? item.fileCounts : undefined,
      childCount: "childCount" in item ? item.childCount : undefined,
      // Include primary media name for "now playing" display
      primaryMediaName:
        "primaryMediaName" in item ? item.primaryMediaName : undefined,
      // Include media icon type for audio/video/mixed display
      mediaIconType: "mediaIconType" in item ? item.mediaIconType : undefined,
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
