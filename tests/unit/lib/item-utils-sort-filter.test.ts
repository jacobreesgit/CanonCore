/**
 * Unit tests for item sorting and filtering utilities.
 */

import { describe, it, expect } from "vitest";
import {
  sortItems,
  filterItems,
  toggleContentFilter,
  SORT_OPTIONS,
  FILTER_OPTIONS,
} from "@/lib/item-utils";
import type { ItemWithArtwork, ContentFilter } from "@/lib/types";

const mockItems: ItemWithArtwork[] = [
  {
    id: "1",
    name: "Zebra",
    description: null,
    parentId: null,
    order: 0,
    depth: 0,
    pinnedOrder: null,
    isPublic: false,
    inheritVisibility: false,
    userId: "user-1",
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-10"),
    driveFileId: null,
    driveModifiedAt: null,
    driveThumbnailUrl: null,
    syncStatus: "SYNCED",
    syncError: null,
    driveConnectionId: null,
    tmdbPosterPath: null,
    tmdbBackdropPath: null,
    artworkId: null,
    fileCounts: { media: 1, artwork: 0, subtitles: 0 },
    childCount: 0,
    primaryMediaName: null,
    mediaIconType: null,
    progress: null,
    tmdbId: null,
    tmdbType: null,
    tmdbShowTagline: true,
    tmdbShowMetadata: true,
    tmdbShowGenres: true,
    tmdbShowCast: true,
    tmdbShowProviders: true,
    tmdbShowVideos: true,
    tmdbShowRecommendations: true,
  },
  {
    id: "2",
    name: "Apple",
    description: null,
    parentId: null,
    order: 1,
    depth: 0,
    pinnedOrder: null,
    isPublic: false,
    inheritVisibility: false,
    userId: "user-1",
    createdAt: new Date("2026-01-05"),
    updatedAt: new Date("2026-01-05"),
    driveFileId: null,
    driveModifiedAt: null,
    driveThumbnailUrl: null,
    syncStatus: "PENDING",
    syncError: null,
    driveConnectionId: null,
    tmdbPosterPath: null,
    tmdbBackdropPath: null,
    artworkId: null,
    fileCounts: { media: 0, artwork: 0, subtitles: 0 },
    childCount: 0,
    primaryMediaName: null,
    mediaIconType: null,
    progress: null,
    tmdbId: null,
    tmdbType: null,
    tmdbShowTagline: true,
    tmdbShowMetadata: true,
    tmdbShowGenres: true,
    tmdbShowCast: true,
    tmdbShowProviders: true,
    tmdbShowVideos: true,
    tmdbShowRecommendations: true,
  },
  {
    id: "3",
    name: "Mango",
    description: null,
    parentId: null,
    order: 2,
    depth: 0,
    pinnedOrder: null,
    isPublic: false,
    inheritVisibility: false,
    userId: "user-1",
    createdAt: new Date("2026-01-03"),
    updatedAt: new Date("2026-01-15"),
    driveFileId: null,
    driveModifiedAt: null,
    driveThumbnailUrl: null,
    syncStatus: "ERROR",
    syncError: null,
    driveConnectionId: null,
    tmdbPosterPath: null,
    tmdbBackdropPath: null,
    artworkId: null,
    fileCounts: { media: 2, artwork: 1, subtitles: 0 },
    childCount: 0,
    primaryMediaName: null,
    mediaIconType: null,
    progress: null,
    tmdbId: null,
    tmdbType: null,
    tmdbShowTagline: true,
    tmdbShowMetadata: true,
    tmdbShowGenres: true,
    tmdbShowCast: true,
    tmdbShowProviders: true,
    tmdbShowVideos: true,
    tmdbShowRecommendations: true,
  },
  {
    id: "4",
    name: "Banana",
    description: null,
    parentId: null,
    order: 3,
    depth: 0,
    pinnedOrder: null,
    isPublic: false,
    inheritVisibility: false,
    userId: "user-1",
    createdAt: new Date("2026-01-02"),
    updatedAt: new Date("2026-01-02"),
    driveFileId: null,
    driveModifiedAt: null,
    driveThumbnailUrl: null,
    syncStatus: "SYNCED",
    syncError: null,
    driveConnectionId: null,
    tmdbPosterPath: null,
    tmdbBackdropPath: null,
    artworkId: null,
    fileCounts: { media: 0, artwork: 1, subtitles: 0 },
    childCount: 0,
    primaryMediaName: null,
    mediaIconType: null,
    progress: null,
    tmdbId: null,
    tmdbType: null,
    tmdbShowTagline: true,
    tmdbShowMetadata: true,
    tmdbShowGenres: true,
    tmdbShowCast: true,
    tmdbShowProviders: true,
    tmdbShowVideos: true,
    tmdbShowRecommendations: true,
  },
];

describe("SORT_OPTIONS", () => {
  it("contains all expected sort options", () => {
    expect(SORT_OPTIONS).toHaveLength(6);
    expect(SORT_OPTIONS.map((o) => o.value)).toEqual([
      "custom",
      "name-asc",
      "name-desc",
      "created-desc",
      "created-asc",
      "updated-desc",
    ]);
  });

  it("has labels for display", () => {
    expect(SORT_OPTIONS[0]).toEqual({ value: "custom", label: "Custom Order" });
    expect(SORT_OPTIONS[1]).toEqual({ value: "name-asc", label: "Name A-Z" });
  });
});

describe("FILTER_OPTIONS", () => {
  it("contains all expected filter options", () => {
    expect(FILTER_OPTIONS).toHaveLength(6);
    expect(FILTER_OPTIONS.map((o) => o.value)).toEqual([
      "all",
      "has-files",
      "no-files",
      "synced",
      "pending",
      "error",
    ]);
  });

  it("has labels for display", () => {
    expect(FILTER_OPTIONS[0]).toEqual({ value: "all", label: "All Items" });
    expect(FILTER_OPTIONS[1]).toEqual({
      value: "has-files",
      label: "Has Files",
    });
  });
});

describe("sortItems", () => {
  it("returns items in original order for 'custom' sort", () => {
    const result = sortItems(mockItems, "custom");
    expect(result.map((i) => i.id)).toEqual(["1", "2", "3", "4"]);
  });

  it("sorts by name A-Z", () => {
    const result = sortItems(mockItems, "name-asc");
    expect(result.map((i) => i.name)).toEqual([
      "Apple",
      "Banana",
      "Mango",
      "Zebra",
    ]);
  });

  it("sorts by name Z-A", () => {
    const result = sortItems(mockItems, "name-desc");
    expect(result.map((i) => i.name)).toEqual([
      "Zebra",
      "Mango",
      "Banana",
      "Apple",
    ]);
  });

  it("sorts by newest first", () => {
    const result = sortItems(mockItems, "created-desc");
    expect(result.map((i) => i.id)).toEqual(["2", "3", "4", "1"]);
  });

  it("sorts by oldest first", () => {
    const result = sortItems(mockItems, "created-asc");
    expect(result.map((i) => i.id)).toEqual(["1", "4", "3", "2"]);
  });

  it("sorts by recently updated", () => {
    const result = sortItems(mockItems, "updated-desc");
    expect(result.map((i) => i.id)).toEqual(["3", "1", "2", "4"]);
  });

  it("handles empty array", () => {
    const result = sortItems([], "name-asc");
    expect(result).toEqual([]);
  });

  it("does not mutate original array", () => {
    const original = [...mockItems];
    sortItems(mockItems, "name-asc");
    expect(mockItems).toEqual(original);
  });

  it("provides stable sort for items with same values", () => {
    const sameNameItems: ItemWithArtwork[] = [
      { ...mockItems[0], id: "a", name: "Alpha", order: 0 },
      { ...mockItems[0], id: "b", name: "Alpha", order: 1 },
      { ...mockItems[0], id: "c", name: "Alpha", order: 2 },
    ];
    const result = sortItems(sameNameItems, "name-asc");
    // Should maintain relative order for equal elements
    expect(result.map((i) => i.id)).toEqual(["a", "b", "c"]);
  });
});

describe("filterItems", () => {
  it("returns all items for 'all' filter", () => {
    const result = filterItems(mockItems, "all");
    expect(result.length).toBe(4);
  });

  it("filters to items with files", () => {
    const result = filterItems(mockItems, "has-files");
    expect(result.map((i) => i.id)).toEqual(["1", "3", "4"]);
  });

  it("filters to items without files", () => {
    const result = filterItems(mockItems, "no-files");
    expect(result.map((i) => i.id)).toEqual(["2"]);
  });

  it("filters to synced items", () => {
    const result = filterItems(mockItems, "synced");
    expect(result.map((i) => i.id)).toEqual(["1", "4"]);
  });

  it("filters to pending items", () => {
    const result = filterItems(mockItems, "pending");
    expect(result.map((i) => i.id)).toEqual(["2"]);
  });

  it("filters to error items", () => {
    const result = filterItems(mockItems, "error");
    expect(result.map((i) => i.id)).toEqual(["3"]);
  });

  it("handles items with null syncStatus for sync filters", () => {
    const itemsWithNull: ItemWithArtwork[] = [
      ...mockItems,
      {
        ...mockItems[0],
        id: "5",
        syncStatus: null as never, // null means not synced
      },
    ];
    const result = filterItems(itemsWithNull, "synced");
    // Item with null syncStatus should not match synced filter
    expect(result.map((i) => i.id)).not.toContain("5");
  });

  it("handles empty array", () => {
    const result = filterItems([], "has-files");
    expect(result).toEqual([]);
  });

  it("does not mutate original array", () => {
    const original = [...mockItems];
    filterItems(mockItems, "has-files");
    expect(mockItems).toEqual(original);
  });
});

describe("filterItems (multi-select)", () => {
  // Mock data reference:
  // id:1 "Zebra"  - SYNCED,  files: media=1, artwork=0
  // id:2 "Apple"  - PENDING, files: media=0, artwork=0 (no files)
  // id:3 "Mango"  - ERROR,   files: media=2, artwork=1
  // id:4 "Banana" - SYNCED,  files: media=0, artwork=1

  it("returns all items for empty filters array", () => {
    const result = filterItems(mockItems, []);
    expect(result).toHaveLength(4);
  });

  it("returns empty array for empty input", () => {
    const result = filterItems([], ["has-files"]);
    expect(result).toEqual([]);
  });

  it("filters by single file filter (has-files)", () => {
    const result = filterItems(mockItems, ["has-files"]);
    expect(result.map((i) => i.id)).toEqual(["1", "3", "4"]);
  });

  it("filters by single file filter (no-files)", () => {
    const result = filterItems(mockItems, ["no-files"]);
    expect(result.map((i) => i.id)).toEqual(["2"]);
  });

  it("filters by single sync filter (synced)", () => {
    const result = filterItems(mockItems, ["synced"]);
    expect(result.map((i) => i.id)).toEqual(["1", "4"]);
  });

  it("filters by single sync filter (pending)", () => {
    const result = filterItems(mockItems, ["pending"]);
    expect(result.map((i) => i.id)).toEqual(["2"]);
  });

  it("filters by single sync filter (error)", () => {
    const result = filterItems(mockItems, ["error"]);
    expect(result.map((i) => i.id)).toEqual(["3"]);
  });

  it("applies OR within sync group (synced + pending)", () => {
    const result = filterItems(mockItems, ["synced", "pending"]);
    // Items 1,4 are synced, item 2 is pending
    expect(result.map((i) => i.id)).toEqual(["1", "2", "4"]);
  });

  it("applies OR within sync group (all three statuses)", () => {
    const result = filterItems(mockItems, ["synced", "pending", "error"]);
    expect(result).toHaveLength(4);
  });

  it("applies AND across groups (has-files + synced)", () => {
    const result = filterItems(mockItems, ["has-files", "synced"]);
    // Must have files AND be synced: items 1 and 4
    expect(result.map((i) => i.id)).toEqual(["1", "4"]);
  });

  it("applies AND across groups (has-files + error)", () => {
    const result = filterItems(mockItems, ["has-files", "error"]);
    // Must have files AND be error: only item 3
    expect(result.map((i) => i.id)).toEqual(["3"]);
  });

  it("applies AND across groups (no-files + pending)", () => {
    const result = filterItems(mockItems, ["no-files", "pending"]);
    // Must have no files AND be pending: only item 2
    expect(result.map((i) => i.id)).toEqual(["2"]);
  });

  it("returns empty when AND across groups has no intersection", () => {
    const result = filterItems(mockItems, ["no-files", "synced"]);
    // No files: item 2, Synced: items 1,4 — no overlap
    expect(result).toHaveLength(0);
  });

  it("applies AND across groups with OR within sync group", () => {
    const result = filterItems(mockItems, ["has-files", "synced", "error"]);
    // Must have files AND (synced OR error): items 1,4 (synced+files) + item 3 (error+files)
    expect(result.map((i) => i.id)).toEqual(["1", "3", "4"]);
  });

  it("does not mutate original array", () => {
    const original = [...mockItems];
    filterItems(mockItems, ["has-files", "synced"]);
    expect(mockItems).toEqual(original);
  });
});

describe("toggleContentFilter", () => {
  it("adds a filter to empty array", () => {
    expect(toggleContentFilter([], "has-files")).toEqual(["has-files"]);
  });

  it("removes an active filter", () => {
    expect(toggleContentFilter(["has-files"], "has-files")).toEqual([]);
  });

  it("adds a second filter", () => {
    expect(toggleContentFilter(["has-files"], "synced")).toEqual([
      "has-files",
      "synced",
    ]);
  });

  it("removes one filter while keeping others", () => {
    expect(toggleContentFilter(["has-files", "synced"], "synced")).toEqual([
      "has-files",
    ]);
  });

  it("mutual exclusion: adding has-files removes no-files", () => {
    expect(toggleContentFilter(["no-files", "synced"], "has-files")).toEqual([
      "synced",
      "has-files",
    ]);
  });

  it("mutual exclusion: adding no-files removes has-files", () => {
    expect(toggleContentFilter(["has-files", "synced"], "no-files")).toEqual([
      "synced",
      "no-files",
    ]);
  });

  it("does not mutate input array", () => {
    const input: ContentFilter[] = ["has-files"];
    toggleContentFilter(input, "synced");
    expect(input).toEqual(["has-files"]);
  });
});
