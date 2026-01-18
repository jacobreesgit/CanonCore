/**
 * Unit tests for progress calculation utilities.
 * Tests item-based progress tracking where an item is "watched" when
 * its primary media file is >= 90% complete.
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
    it("is 90%", () => {
      expect(COMPLETION_THRESHOLD).toBe(0.9);
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

    it("returns false below 90% threshold", () => {
      expect(isFileComplete(89, 100)).toBe(false);
      expect(isFileComplete(50, 100)).toBe(false);
    });

    it("returns true at 90% threshold", () => {
      expect(isFileComplete(90, 100)).toBe(true);
    });

    it("returns true above 90% threshold", () => {
      expect(isFileComplete(95, 100)).toBe(true);
      expect(isFileComplete(100, 100)).toBe(true);
    });

    it("handles decimal values correctly", () => {
      // 90% of 3600 = 3240
      expect(isFileComplete(3240, 3600)).toBe(true);
      expect(isFileComplete(3239, 3600)).toBe(false);
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

    it("returns 0% when no items have watched primary media", () => {
      const items = [
        {
          hasPrimaryMedia: true,
          primaryMediaPosition: 0,
          primaryMediaDuration: 100,
        },
        {
          hasPrimaryMedia: true,
          primaryMediaPosition: 50,
          primaryMediaDuration: 100,
        },
      ];
      const result = calculateProgress(items);
      expect(result.totalItems).toBe(2);
      expect(result.itemsWithMedia).toBe(2);
      expect(result.watchedItems).toBe(0);
      expect(result.percentage).toBe(0);
    });

    it("returns 100% when all items with media are watched", () => {
      const items = [
        {
          hasPrimaryMedia: true,
          primaryMediaPosition: 95,
          primaryMediaDuration: 100,
        },
        {
          hasPrimaryMedia: true,
          primaryMediaPosition: 100,
          primaryMediaDuration: 100,
        },
      ];
      const result = calculateProgress(items);
      expect(result.totalItems).toBe(2);
      expect(result.itemsWithMedia).toBe(2);
      expect(result.watchedItems).toBe(2);
      expect(result.percentage).toBe(100);
    });

    it("calculates correct percentage for mixed watched/unwatched", () => {
      const items = [
        {
          hasPrimaryMedia: true,
          primaryMediaPosition: 95,
          primaryMediaDuration: 100,
        }, // watched
        {
          hasPrimaryMedia: true,
          primaryMediaPosition: 50,
          primaryMediaDuration: 100,
        }, // unwatched
        {
          hasPrimaryMedia: true,
          primaryMediaPosition: 90,
          primaryMediaDuration: 100,
        }, // watched
        {
          hasPrimaryMedia: true,
          primaryMediaPosition: null,
          primaryMediaDuration: 100,
        }, // unwatched
      ];
      const result = calculateProgress(items);
      expect(result.totalItems).toBe(4);
      expect(result.itemsWithMedia).toBe(4);
      expect(result.watchedItems).toBe(2);
      expect(result.percentage).toBe(50);
    });

    it("counts items without primary media in totalItems but not itemsWithMedia", () => {
      const items = [
        {
          hasPrimaryMedia: true,
          primaryMediaPosition: 95,
          primaryMediaDuration: 100,
        }, // watched
        {
          hasPrimaryMedia: false,
          primaryMediaPosition: null,
          primaryMediaDuration: null,
        }, // no media
        {
          hasPrimaryMedia: false,
          primaryMediaPosition: null,
          primaryMediaDuration: null,
        }, // no media
      ];
      const result = calculateProgress(items);
      expect(result.totalItems).toBe(3);
      expect(result.itemsWithMedia).toBe(1);
      expect(result.watchedItems).toBe(1);
      expect(result.percentage).toBe(100);
    });

    it("returns null percentage when no items have media", () => {
      const items = [
        {
          hasPrimaryMedia: false,
          primaryMediaPosition: null,
          primaryMediaDuration: null,
        },
        {
          hasPrimaryMedia: false,
          primaryMediaPosition: null,
          primaryMediaDuration: null,
        },
      ];
      const result = calculateProgress(items);
      expect(result.totalItems).toBe(2);
      expect(result.itemsWithMedia).toBe(0);
      expect(result.watchedItems).toBe(0);
      expect(result.percentage).toBeNull();
    });

    it("rounds percentage to nearest integer", () => {
      const items = [
        {
          hasPrimaryMedia: true,
          primaryMediaPosition: 95,
          primaryMediaDuration: 100,
        }, // watched
        {
          hasPrimaryMedia: true,
          primaryMediaPosition: 50,
          primaryMediaDuration: 100,
        }, // unwatched
        {
          hasPrimaryMedia: true,
          primaryMediaPosition: 50,
          primaryMediaDuration: 100,
        }, // unwatched
      ];
      const result = calculateProgress(items);
      expect(result.percentage).toBe(33); // 1/3 = 33.33... rounds to 33
    });

    it("handles items with null duration as unwatched", () => {
      const items = [
        {
          hasPrimaryMedia: true,
          primaryMediaPosition: 50,
          primaryMediaDuration: null,
        }, // unwatched
        {
          hasPrimaryMedia: true,
          primaryMediaPosition: 95,
          primaryMediaDuration: 100,
        }, // watched
      ];
      const result = calculateProgress(items);
      expect(result.totalItems).toBe(2);
      expect(result.itemsWithMedia).toBe(2);
      expect(result.watchedItems).toBe(1);
      expect(result.percentage).toBe(50);
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
        totalItems: 2, // parent + 1 child
      };
      expect(formatProgressLabel(progress)).toBe("(2 items)");
    });
  });

  describe("findFirstIncompleteItem", () => {
    it("returns null for empty array", () => {
      const result = findFirstIncompleteItem([]);
      expect(result).toBeNull();
    });

    it("returns null when all items are complete", () => {
      const items = [
        {
          id: "1",
          order: 0,
          parentId: null,
          hasPrimaryMedia: true,
          position: 95,
          duration: 100,
        },
        {
          id: "2",
          order: 1,
          parentId: null,
          hasPrimaryMedia: true,
          position: 100,
          duration: 100,
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
          position: null,
          duration: null,
        },
      ];
      expect(findFirstIncompleteItem(items)).toBeNull();
    });

    it("returns first incomplete item in order", () => {
      const items = [
        {
          id: "1",
          order: 0,
          parentId: null,
          hasPrimaryMedia: true,
          position: 95,
          duration: 100,
        }, // complete
        {
          id: "2",
          order: 1,
          parentId: null,
          hasPrimaryMedia: true,
          position: 50,
          duration: 100,
        }, // incomplete
        {
          id: "3",
          order: 2,
          parentId: null,
          hasPrimaryMedia: true,
          position: 30,
          duration: 100,
        }, // incomplete
      ];
      expect(findFirstIncompleteItem(items)).toBe("2");
    });

    it("follows DFS order - visits children before siblings", () => {
      // Tree structure:
      // 1 (order 0, complete)
      //   ├─ 1a (order 0, complete)
      //   └─ 1b (order 1, incomplete) <- should be found
      // 2 (order 1, incomplete) <- NOT this one
      const items = [
        {
          id: "1",
          order: 0,
          parentId: null,
          hasPrimaryMedia: true,
          position: 95,
          duration: 100,
        },
        {
          id: "1a",
          order: 0,
          parentId: "1",
          hasPrimaryMedia: true,
          position: 95,
          duration: 100,
        },
        {
          id: "1b",
          order: 1,
          parentId: "1",
          hasPrimaryMedia: true,
          position: 50,
          duration: 100,
        },
        {
          id: "2",
          order: 1,
          parentId: null,
          hasPrimaryMedia: true,
          position: 50,
          duration: 100,
        },
      ];
      expect(findFirstIncompleteItem(items)).toBe("1b");
    });

    it("skips items without media in DFS traversal", () => {
      // Tree: folder -> incomplete child
      const items = [
        {
          id: "folder",
          order: 0,
          parentId: null,
          hasPrimaryMedia: false,
          position: null,
          duration: null,
        },
        {
          id: "child",
          order: 0,
          parentId: "folder",
          hasPrimaryMedia: true,
          position: 50,
          duration: 100,
        },
      ];
      expect(findFirstIncompleteItem(items)).toBe("child");
    });

    it("treats null position as incomplete (not started)", () => {
      const items = [
        {
          id: "1",
          order: 0,
          parentId: null,
          hasPrimaryMedia: true,
          position: null,
          duration: 100,
        },
      ];
      expect(findFirstIncompleteItem(items)).toBe("1");
    });

    it("treats zero position as incomplete", () => {
      const items = [
        {
          id: "1",
          order: 0,
          parentId: null,
          hasPrimaryMedia: true,
          position: 0,
          duration: 100,
        },
      ];
      expect(findFirstIncompleteItem(items)).toBe("1");
    });

    it("respects order field for sibling ordering", () => {
      const items = [
        {
          id: "b",
          order: 1,
          parentId: null,
          hasPrimaryMedia: true,
          position: 50,
          duration: 100,
        },
        {
          id: "a",
          order: 0,
          parentId: null,
          hasPrimaryMedia: true,
          position: 50,
          duration: 100,
        },
      ];
      // Should return "a" because it has order 0, even though "b" appears first in array
      expect(findFirstIncompleteItem(items)).toBe("a");
    });

    it("treats exactly 90% position as complete (threshold boundary)", () => {
      const items = [
        {
          id: "1",
          order: 0,
          parentId: null,
          hasPrimaryMedia: true,
          position: 90,
          duration: 100,
        },
      ];
      // 90 >= 100 * 0.9 → 90 >= 90 → TRUE (complete)
      expect(findFirstIncompleteItem(items)).toBeNull();
    });

    it("treats just below 90% as incomplete (threshold boundary)", () => {
      const items = [
        {
          id: "1",
          order: 0,
          parentId: null,
          hasPrimaryMedia: true,
          position: 89.9,
          duration: 100,
        },
      ];
      // 89.9 >= 100 * 0.9 → 89.9 >= 90 → FALSE (incomplete)
      expect(findFirstIncompleteItem(items)).toBe("1");
    });
  });
});
