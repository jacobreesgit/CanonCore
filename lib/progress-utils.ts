/**
 * Utilities for calculating playback progress across item hierarchies.
 * Progress is item-based: an item is "watched" when its primary media is >= 90% complete.
 */

/** Threshold percentage to consider a file complete (90%). */
export const COMPLETION_THRESHOLD = 0.9;

/**
 * Determines if a media file is considered complete.
 * Complete = position >= 90% of duration.
 *
 * @param position - Current playback position in seconds
 * @param duration - Total duration in seconds
 * @returns True if file is complete
 */
export function isFileComplete(
  position: number | null,
  duration: number | null
): boolean {
  if (position === null || duration === null || duration === 0) {
    return false;
  }
  return position >= duration * COMPLETION_THRESHOLD;
}

/**
 * Progress data for an item (self + all descendants).
 * Item-based counting: progress tracks items with watched primary media.
 */
export interface ItemProgress {
  /** Items with primary media that are >= 90% watched */
  watchedItems: number;
  /** Items that have a primary media file */
  itemsWithMedia: number;
  /** Progress percentage (0-100), null if no items with media */
  percentage: number | null;
  /** Total descendant items (including self) */
  totalItems: number;
}

/**
 * Calculates progress from item-level data.
 * Each item counts once based on its primary media file status.
 *
 * @param items - Array of items with primary media playback data
 * @returns Progress data with percentage and total item count
 */
export function calculateProgress(
  items: Array<{
    hasPrimaryMedia: boolean;
    primaryMediaPosition: number | null;
    primaryMediaDuration: number | null;
  }>
): ItemProgress {
  const totalItems = items.length;

  if (totalItems === 0) {
    return {
      watchedItems: 0,
      itemsWithMedia: 0,
      percentage: null,
      totalItems: 0,
    };
  }

  // Single pass to count both itemsWithMedia and watchedItems (js-combine-iterations)
  let itemsWithMedia = 0;
  let watchedItems = 0;
  for (const item of items) {
    if (item.hasPrimaryMedia) {
      itemsWithMedia++;
      if (
        isFileComplete(item.primaryMediaPosition, item.primaryMediaDuration)
      ) {
        watchedItems++;
      }
    }
  }

  return {
    watchedItems,
    itemsWithMedia,
    percentage:
      itemsWithMedia > 0
        ? Math.round((watchedItems / itemsWithMedia) * 100)
        : null,
    totalItems,
  };
}

/**
 * Formats progress as a label string.
 * Format: "5/10 watched (of 15 items)" or "(3 items)" if no media.
 *
 * @param progress - Progress data
 * @returns Formatted label or null for empty leaf items
 */
export function formatProgressLabel(progress: ItemProgress): string | null {
  // Nothing to show for leaf items without media
  if (progress.itemsWithMedia === 0 && progress.totalItems <= 1) {
    return null;
  }

  // Has items with media: "5/10 watched" or "5/10 watched (of 15 items)" if some items lack media
  if (progress.itemsWithMedia > 0) {
    const base = `${progress.watchedItems}/${progress.itemsWithMedia} watched`;
    // Only show "(of X items)" when there are items without media
    if (progress.totalItems > progress.itemsWithMedia) {
      const itemWord = progress.totalItems === 1 ? "item" : "items";
      return `${base} (of ${progress.totalItems} ${itemWord})`;
    }
    return base;
  }

  // No media, has children: "(3 items)"
  const itemWord = progress.totalItems === 1 ? "item" : "items";
  return `(${progress.totalItems} ${itemWord})`;
}

/**
 * Input type for findFirstIncompleteItem.
 * Minimal data needed for DFS traversal and completion check.
 */
export interface IncompleteItemInput {
  id: string;
  order: number;
  parentId: string | null;
  hasPrimaryMedia: boolean;
  position: number | null;
  duration: number | null;
}

/**
 * Finds the first incomplete item in DFS order.
 * An item is incomplete if it has primary media that is < 90% watched.
 * Items without media are skipped but their children are still traversed.
 *
 * @param items - Flat array of items with order, parentId, and media info
 * @param startFromParentId - Optional parent ID to start traversal from (for filtering)
 * @returns ID of first incomplete item, or null if all complete/no media
 */
export function findFirstIncompleteItem(
  items: IncompleteItemInput[],
  startFromParentId: string | null = null
): string | null {
  if (items.length === 0) return null;

  // Build parent -> children map
  const childrenMap = new Map<string | null, IncompleteItemInput[]>();
  for (const item of items) {
    const siblings = childrenMap.get(item.parentId) ?? [];
    siblings.push(item);
    childrenMap.set(item.parentId, siblings);
  }

  // Sort children by order at each level
  for (const children of childrenMap.values()) {
    children.sort((a, b) => a.order - b.order);
  }

  // DFS traversal
  function traverse(parentId: string | null): string | null {
    const children = childrenMap.get(parentId) ?? [];

    for (const item of children) {
      // Check if this item is incomplete
      if (
        item.hasPrimaryMedia &&
        !isFileComplete(item.position, item.duration)
      ) {
        return item.id;
      }

      // Recurse into children (DFS - depth first)
      const found = traverse(item.id);
      if (found) return found;
    }

    return null;
  }

  return traverse(startFromParentId);
}
