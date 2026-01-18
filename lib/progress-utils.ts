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

  const itemsWithMedia = items.filter((item) => item.hasPrimaryMedia).length;
  const watchedItems = items.filter(
    (item) =>
      item.hasPrimaryMedia &&
      isFileComplete(item.primaryMediaPosition, item.primaryMediaDuration)
  ).length;

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
