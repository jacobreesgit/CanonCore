/**
 * Utility functions for transforming items between flat and tree representations.
 * Used for converting database items to tree structure and vice versa.
 */

import type { Item, TreeItem } from "./types";

/**
 * Converts a flat array of items from the database into a hierarchical tree structure.
 * Items are organized by their parentId relationships.
 */
export function itemsToTree(items: Item[]): TreeItem[] {
  const itemMap = new Map<string, TreeItem>();
  const roots: TreeItem[] = [];

  // First pass: create TreeItem nodes for all items
  for (const item of items) {
    itemMap.set(item.id, {
      id: item.id,
      name: item.name,
      order: item.order,
      depth: item.depth,
      parentId: item.parentId,
      children: [],
      // Include SFTP fields for display
      type: item.type,
      sftpPath: item.sftpPath,
      syncStatus: item.syncStatus,
      connectionId: item.connectionId,
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
