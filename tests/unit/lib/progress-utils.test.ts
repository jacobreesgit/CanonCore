/**
 * Unit tests for progress calculation utilities.
 * Tests item-based progress tracking where an item is "watched" when
 * it has a WatchRecord (created at >= 80% playback or manually).
 */

import { describe, it, expect } from "vitest";
import {
  isFileComplete,
  calculateProgress,
  formatProgressLabel,
  findFirstIncompleteItem,
  COMPLETION_THRESHOLD,
  type ItemProgress,
} from "@/lib/progress-utils";

describe("progress-utils", () => {
  describe("COMPLETION_THRESHOLD", () => {
    it("is 0.8 (80% Trakt standard)", () => {
      expect(COMPLETION_THRESHOLD).toBe(0.8);
    });
  });

  describe("isFileComplete", () => {
    it("returns false for null position", () => {
      expect(isFileComplete(null, 100)).toBe(false);
    });

    it("returns false for null duration", () => {
      expect(isFileComplete(50, null)).toBe(false);
    });

    it("returns false for zero duration", () => {
      expect(isFileComplete(50, 0)).toBe(false);
    });

    it("returns true at exactly 80%", () => {
      expect(isFileComplete(80, 100)).toBe(true);
    });

    it("returns false at 79%", () => {
      expect(isFileComplete(79, 100)).toBe(false);
    });

    it("returns true above 80%", () => {
      expect(isFileComplete(90, 100)).toBe(true);
      expect(isFileComplete(100, 100)).toBe(true);
    });

    it("handles decimal values correctly", () => {
      // 80% of 3600 = 2880
      expect(isFileComplete(2880, 3600)).toBe(true);
      expect(isFileComplete(2879, 3600)).toBe(false);
    });
  });

  describe("calculateProgress", () => {
    it("returns null percentage for empty array", () => {
      const result = calculateProgress([]);
      expect(result.watchedItems).toBe(0);
      expect(result.itemsWithMedia).toBe(0);
      expect(result.percentage).toBeNull();
      expect(result.totalItems).toBe(0);
    });

    it("returns 0% when no items are watched", () => {
      const items = [
        { hasPrimaryMedia: true, isWatched: false },
        { hasPrimaryMedia: true, isWatched: false },
      ];
      const result = calculateProgress(items);
      expect(result.totalItems).toBe(2);
      expect(result.itemsWithMedia).toBe(2);
      expect(result.watchedItems).toBe(0);
      expect(result.percentage).toBe(0);
    });

    it("returns 100% when all items with media are watched", () => {
      const items = [
        { hasPrimaryMedia: true, isWatched: true },
        { hasPrimaryMedia: true, isWatched: true },
      ];
      const result = calculateProgress(items);
      expect(result.totalItems).toBe(2);
      expect(result.itemsWithMedia).toBe(2);
      expect(result.watchedItems).toBe(2);
      expect(result.percentage).toBe(100);
    });

    it("calculates correct percentage for mixed watched/unwatched", () => {
      const items = [
        { hasPrimaryMedia: true, isWatched: true },
        { hasPrimaryMedia: true, isWatched: false },
        { hasPrimaryMedia: true, isWatched: true },
        { hasPrimaryMedia: true, isWatched: false },
      ];
      const result = calculateProgress(items);
      expect(result.totalItems).toBe(4);
      expect(result.itemsWithMedia).toBe(4);
      expect(result.watchedItems).toBe(2);
      expect(result.percentage).toBe(50);
    });

    it("counts items without primary media in totalItems but not itemsWithMedia", () => {
      const items = [
        { hasPrimaryMedia: true, isWatched: true },
        { hasPrimaryMedia: false, isWatched: false },
        { hasPrimaryMedia: false, isWatched: false },
      ];
      const result = calculateProgress(items);
      expect(result.totalItems).toBe(3);
      expect(result.itemsWithMedia).toBe(1);
      expect(result.watchedItems).toBe(1);
      expect(result.percentage).toBe(100);
    });

    it("returns null percentage when no items have media", () => {
      const items = [
        { hasPrimaryMedia: false, isWatched: false },
        { hasPrimaryMedia: false, isWatched: false },
      ];
      const result = calculateProgress(items);
      expect(result.totalItems).toBe(2);
      expect(result.itemsWithMedia).toBe(0);
      expect(result.watchedItems).toBe(0);
      expect(result.percentage).toBeNull();
    });

    it("rounds percentage to nearest integer", () => {
      const items = [
        { hasPrimaryMedia: true, isWatched: true },
        { hasPrimaryMedia: true, isWatched: false },
        { hasPrimaryMedia: true, isWatched: false },
      ];
      const result = calculateProgress(items);
      expect(result.percentage).toBe(33); // 1/3 = 33.33... rounds to 33
    });

    it("uses fractional playback for partially played items", () => {
      const items = [
        { hasPrimaryMedia: true, isWatched: false, playbackFraction: 0.8 },
      ];
      const result = calculateProgress(items);
      expect(result.watchedItems).toBe(0);
      expect(result.itemsWithMedia).toBe(1);
      expect(result.percentage).toBe(80); // 0.8 / 1 = 80%
    });

    it("combines watched items and fractional playback", () => {
      const items = [
        { hasPrimaryMedia: true, isWatched: true }, // 1.0
        { hasPrimaryMedia: true, isWatched: false, playbackFraction: 0.5 }, // 0.5
      ];
      const result = calculateProgress(items);
      expect(result.watchedItems).toBe(1);
      expect(result.itemsWithMedia).toBe(2);
      expect(result.percentage).toBe(75); // (1.0 + 0.5) / 2 = 75%
    });

    it("handles mix of watched, partially played, and unwatched", () => {
      const items = [
        { hasPrimaryMedia: true, isWatched: true }, // 1.0
        { hasPrimaryMedia: true, isWatched: false, playbackFraction: 0.6 }, // 0.6
        { hasPrimaryMedia: true, isWatched: false }, // 0.0
        { hasPrimaryMedia: false, isWatched: false }, // no media, excluded
      ];
      const result = calculateProgress(items);
      expect(result.totalItems).toBe(4);
      expect(result.watchedItems).toBe(1);
      expect(result.itemsWithMedia).toBe(3);
      expect(result.percentage).toBe(53); // (1.0 + 0.6 + 0.0) / 3 = 53.33... rounds to 53
    });

    it("caps playbackFraction at 1.0", () => {
      const items = [
        { hasPrimaryMedia: true, isWatched: false, playbackFraction: 1.5 },
      ];
      const result = calculateProgress(items);
      expect(result.percentage).toBe(100); // capped at 1.0
    });

    it("watched items count as 1.0 even with playbackFraction", () => {
      const items = [
        { hasPrimaryMedia: true, isWatched: true, playbackFraction: 0.3 },
      ];
      const result = calculateProgress(items);
      expect(result.watchedItems).toBe(1);
      expect(result.percentage).toBe(100); // watched = 1.0, fraction ignored
    });
  });

  describe("formatProgressLabel", () => {
    it("returns null for leaf item without media", () => {
      const progress: ItemProgress = {
        watchedItems: 0,
        itemsWithMedia: 0,
        percentage: null,
        totalItems: 1,
      };
      expect(formatProgressLabel(progress)).toBeNull();
    });

    it("returns null for empty item (totalItems = 0)", () => {
      const progress: ItemProgress = {
        watchedItems: 0,
        itemsWithMedia: 0,
        percentage: null,
        totalItems: 0,
      };
      expect(formatProgressLabel(progress)).toBeNull();
    });

    it("formats as watched/total (of N items) when some items lack media", () => {
      const progress: ItemProgress = {
        watchedItems: 5,
        itemsWithMedia: 10,
        percentage: 50,
        totalItems: 15,
      };
      expect(formatProgressLabel(progress)).toBe("5/10 watched (of 15 items)");
    });

    it("omits (of N items) when all items have media", () => {
      const progress: ItemProgress = {
        watchedItems: 0,
        itemsWithMedia: 10,
        percentage: 0,
        totalItems: 10,
      };
      expect(formatProgressLabel(progress)).toBe("0/10 watched");
    });

    it("formats complete progress without redundant item count", () => {
      const progress: ItemProgress = {
        watchedItems: 5,
        itemsWithMedia: 5,
        percentage: 100,
        totalItems: 5,
      };
      expect(formatProgressLabel(progress)).toBe("5/5 watched");
    });

    it("omits redundant (of 1 item) for single item with media", () => {
      const progress: ItemProgress = {
        watchedItems: 1,
        itemsWithMedia: 1,
        percentage: 100,
        totalItems: 1,
      };
      expect(formatProgressLabel(progress)).toBe("1/1 watched");
    });

    it("shows only item count when no media but has children", () => {
      const progress: ItemProgress = {
        watchedItems: 0,
        itemsWithMedia: 0,
        percentage: null,
        totalItems: 3,
      };
      expect(formatProgressLabel(progress)).toBe("(3 items)");
    });

    it("uses singular 'item' for folders with single child and no media", () => {
      const progress: ItemProgress = {
        watchedItems: 0,
        itemsWithMedia: 0,
        percentage: null,
        totalItems: 2,
      };
      expect(formatProgressLabel(progress)).toBe("(2 items)");
    });
  });

  describe("findFirstIncompleteItem", () => {
    it("returns null for empty array", () => {
      const result = findFirstIncompleteItem([]);
      expect(result).toBeNull();
    });

    it("returns null when all items are watched", () => {
      const items = [
        {
          id: "1",
          order: 0,
          parentId: null,
          hasPrimaryMedia: true,
          isWatched: true,
        },
        {
          id: "2",
          order: 1,
          parentId: null,
          hasPrimaryMedia: true,
          isWatched: true,
        },
      ];
      expect(findFirstIncompleteItem(items)).toBeNull();
    });

    it("returns null when no items have media", () => {
      const items = [
        {
          id: "1",
          order: 0,
          parentId: null,
          hasPrimaryMedia: false,
          isWatched: false,
        },
      ];
      expect(findFirstIncompleteItem(items)).toBeNull();
    });

    it("returns first unwatched item in order", () => {
      const items = [
        {
          id: "1",
          order: 0,
          parentId: null,
          hasPrimaryMedia: true,
          isWatched: true,
        },
        {
          id: "2",
          order: 1,
          parentId: null,
          hasPrimaryMedia: true,
          isWatched: false,
        },
        {
          id: "3",
          order: 2,
          parentId: null,
          hasPrimaryMedia: true,
          isWatched: false,
        },
      ];
      expect(findFirstIncompleteItem(items)).toBe("2");
    });

    it("follows DFS order - visits children before siblings", () => {
      const items = [
        {
          id: "1",
          order: 0,
          parentId: null,
          hasPrimaryMedia: true,
          isWatched: true,
        },
        {
          id: "1a",
          order: 0,
          parentId: "1",
          hasPrimaryMedia: true,
          isWatched: true,
        },
        {
          id: "1b",
          order: 1,
          parentId: "1",
          hasPrimaryMedia: true,
          isWatched: false,
        },
        {
          id: "2",
          order: 1,
          parentId: null,
          hasPrimaryMedia: true,
          isWatched: false,
        },
      ];
      expect(findFirstIncompleteItem(items)).toBe("1b");
    });

    it("skips items without media in DFS traversal", () => {
      const items = [
        {
          id: "folder",
          order: 0,
          parentId: null,
          hasPrimaryMedia: false,
          isWatched: false,
        },
        {
          id: "child",
          order: 0,
          parentId: "folder",
          hasPrimaryMedia: true,
          isWatched: false,
        },
      ];
      expect(findFirstIncompleteItem(items)).toBe("child");
    });

    it("respects order field for sibling ordering", () => {
      const items = [
        {
          id: "b",
          order: 1,
          parentId: null,
          hasPrimaryMedia: true,
          isWatched: false,
        },
        {
          id: "a",
          order: 0,
          parentId: null,
          hasPrimaryMedia: true,
          isWatched: false,
        },
      ];
      expect(findFirstIncompleteItem(items)).toBe("a");
    });
  });
});
