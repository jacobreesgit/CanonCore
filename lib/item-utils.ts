/**
 * Utility functions for transforming items between flat and tree representations.
 * Used for converting database items to tree structure and vice versa.
 */

import type { Item, ItemWithArtwork, TreeItem } from "./types";

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
      // Include SFTP fields for display
      sftpPath: item.sftpPath,
      connectionId: item.connectionId,
      connectionName: "connectionName" in item ? item.connectionName : null,
      // Include artwork if available
      artworkId: "artworkId" in item ? item.artworkId : null,
      // Include file and child counts for stats display
      fileCounts: "fileCounts" in item ? item.fileCounts : undefined,
      childCount: "childCount" in item ? item.childCount : undefined,
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
