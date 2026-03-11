/**
 * Unit tests for item-utils tree transformation functions.
 * Tests itemsToTree, treeToItemUpdates, buildDescendantCounter, and getMediaIconType.
 */

import { describe, it, expect } from "vitest";
import {
  itemsToTree,
  publicItemsToTree,
  treeToItemUpdates,
  buildDescendantCounter,
  getMediaIconType,
} from "@/lib/item-utils";
import type { Item, TreeItem } from "@/lib/types";

// Helper to create a minimal Item for testing
function createItem(
  overrides: Partial<Item> & { id: string; name: string }
): Item {
  return {
    order: 0,
    depth: 0,
    parentId: null,
    description: null,
    pinnedOrder: null,
    isPublic: false,
    inheritVisibility: false,
    driveFileId: null,
    driveModifiedAt: null,
    driveThumbnailUrl: null,
    syncStatus: "SYNCED",
    syncError: null,
    driveConnectionId: null,
    userId: "user-1",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    tmdbId: null,
    tmdbType: null,
    tmdbPosterPath: null,
    tmdbBackdropPath: null,
    tmdbLogoPath: null,
    dominantColour: null,
    tmdbShowTagline: true,
    tmdbShowMetadata: true,
    tmdbShowGenres: true,
    tmdbShowCast: true,
    tmdbShowProviders: true,
    tmdbShowVideos: true,
    tmdbShowRecommendations: true,
    ...overrides,
  };
}

describe("getMediaIconType", () => {
  it("returns null for empty array", () => {
    expect(getMediaIconType([])).toBeNull();
  });

  it("returns 'film' for video files only", () => {
    const files = [
      { mimeType: "video/mp4" },
      { mimeType: "video/webm" },
      { mimeType: "video/x-matroska" },
    ];
    expect(getMediaIconType(files)).toBe("film");
  });

  it("returns 'music' for audio files only", () => {
    const files = [
      { mimeType: "audio/mp3" },
      { mimeType: "audio/flac" },
      { mimeType: "audio/wav" },
    ];
    expect(getMediaIconType(files)).toBe("music");
  });

  it("returns 'mixed' for both video and audio files", () => {
    const files = [{ mimeType: "video/mp4" }, { mimeType: "audio/mp3" }];
    expect(getMediaIconType(files)).toBe("mixed");
  });

  it("treats null mimeType as video (defaults to film)", () => {
    const files = [{ mimeType: null }];
    expect(getMediaIconType(files)).toBe("film");
  });

  it("treats unknown mimeType as video", () => {
    const files = [{ mimeType: "application/octet-stream" }];
    expect(getMediaIconType(files)).toBe("film");
  });

  it("returns mixed when null mimeType combined with audio", () => {
    const files = [{ mimeType: null }, { mimeType: "audio/mp3" }];
    expect(getMediaIconType(files)).toBe("mixed");
  });

  it("handles single video file", () => {
    expect(getMediaIconType([{ mimeType: "video/mp4" }])).toBe("film");
  });

  it("handles single audio file", () => {
    expect(getMediaIconType([{ mimeType: "audio/flac" }])).toBe("music");
  });
});

describe("itemsToTree", () => {
  it("returns empty array for empty input", () => {
    expect(itemsToTree([])).toEqual([]);
  });

  it("converts single root item", () => {
    const items = [createItem({ id: "1", name: "Root", order: 0, depth: 0 })];

    const tree = itemsToTree(items);

    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe("1");
    expect(tree[0].name).toBe("Root");
    expect(tree[0].children).toEqual([]);
  });

  it("converts multiple root items sorted by order", () => {
    const items = [
      createItem({ id: "2", name: "Second", order: 1, depth: 0 }),
      createItem({ id: "1", name: "First", order: 0, depth: 0 }),
      createItem({ id: "3", name: "Third", order: 2, depth: 0 }),
    ];

    const tree = itemsToTree(items);

    expect(tree).toHaveLength(3);
    expect(tree[0].name).toBe("First");
    expect(tree[1].name).toBe("Second");
    expect(tree[2].name).toBe("Third");
  });

  it("builds parent-child relationships", () => {
    const items = [
      createItem({ id: "parent", name: "Parent", order: 0, depth: 0 }),
      createItem({
        id: "child",
        name: "Child",
        order: 0,
        depth: 1,
        parentId: "parent",
      }),
    ];

    const tree = itemsToTree(items);

    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe("parent");
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children[0].id).toBe("child");
  });

  it("builds nested hierarchy (3 levels)", () => {
    const items = [
      createItem({ id: "root", name: "Root", order: 0, depth: 0 }),
      createItem({
        id: "child",
        name: "Child",
        order: 0,
        depth: 1,
        parentId: "root",
      }),
      createItem({
        id: "grandchild",
        name: "Grandchild",
        order: 0,
        depth: 2,
        parentId: "child",
      }),
    ];

    const tree = itemsToTree(items);

    expect(tree[0].children[0].children[0].id).toBe("grandchild");
  });

  it("sorts children by order at each level", () => {
    const items = [
      createItem({ id: "root", name: "Root", order: 0, depth: 0 }),
      createItem({
        id: "child-b",
        name: "Child B",
        order: 1,
        depth: 1,
        parentId: "root",
      }),
      createItem({
        id: "child-a",
        name: "Child A",
        order: 0,
        depth: 1,
        parentId: "root",
      }),
    ];

    const tree = itemsToTree(items);

    expect(tree[0].children[0].name).toBe("Child A");
    expect(tree[0].children[1].name).toBe("Child B");
  });

  it("handles orphaned items (missing parent) as roots", () => {
    const items = [
      createItem({
        id: "orphan",
        name: "Orphan",
        order: 0,
        depth: 1,
        parentId: "nonexistent",
      }),
    ];

    const tree = itemsToTree(items);

    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe("orphan");
  });

  it("preserves description field", () => {
    const items = [
      createItem({
        id: "1",
        name: "Item",
        order: 0,
        depth: 0,
        description: "Test description",
      }),
    ];

    const tree = itemsToTree(items);

    expect(tree[0].description).toBe("Test description");
  });

  it("preserves pinnedOrder field", () => {
    const items = [
      createItem({
        id: "1",
        name: "Pinned",
        order: 0,
        depth: 0,
        pinnedOrder: 5,
      }),
    ];

    const tree = itemsToTree(items);

    expect(tree[0].pinnedOrder).toBe(5);
  });

  it("preserves driveFileId field", () => {
    const items = [
      createItem({
        id: "1",
        name: "Synced",
        order: 0,
        depth: 0,
        driveFileId: "drive-123",
      }),
    ];

    const tree = itemsToTree(items);

    expect(tree[0].driveFileId).toBe("drive-123");
  });
});

describe("treeToItemUpdates", () => {
  it("returns empty array for empty input", () => {
    expect(treeToItemUpdates([])).toEqual([]);
  });

  it("extracts single root item update", () => {
    const tree: TreeItem[] = [
      {
        id: "1",
        name: "Root",
        description: null,
        order: 0,
        depth: 0,
        parentId: null,
        children: [],
        pinnedOrder: null,
        artworkId: null,
        driveFileId: null,
      },
    ];

    const updates = treeToItemUpdates(tree);

    expect(updates).toEqual([{ id: "1", parentId: null, depth: 0, order: 0 }]);
  });

  it("assigns sequential order to siblings", () => {
    const tree: TreeItem[] = [
      {
        id: "a",
        name: "A",
        description: null,
        order: 0,
        depth: 0,
        parentId: null,
        children: [],
        pinnedOrder: null,
        artworkId: null,
        driveFileId: null,
      },
      {
        id: "b",
        name: "B",
        description: null,
        order: 0,
        depth: 0,
        parentId: null,
        children: [],
        pinnedOrder: null,
        artworkId: null,
        driveFileId: null,
      },
      {
        id: "c",
        name: "C",
        description: null,
        order: 0,
        depth: 0,
        parentId: null,
        children: [],
        pinnedOrder: null,
        artworkId: null,
        driveFileId: null,
      },
    ];

    const updates = treeToItemUpdates(tree);

    expect(updates[0]).toEqual({ id: "a", parentId: null, depth: 0, order: 0 });
    expect(updates[1]).toEqual({ id: "b", parentId: null, depth: 0, order: 1 });
    expect(updates[2]).toEqual({ id: "c", parentId: null, depth: 0, order: 2 });
  });

  it("assigns parentId to children", () => {
    const tree: TreeItem[] = [
      {
        id: "parent",
        name: "Parent",
        description: null,
        order: 0,
        depth: 0,
        parentId: null,
        pinnedOrder: null,
        artworkId: null,
        driveFileId: null,
        children: [
          {
            id: "child",
            name: "Child",
            description: null,
            order: 0,
            depth: 1,
            parentId: "parent",
            children: [],
            pinnedOrder: null,
            artworkId: null,
            driveFileId: null,
          },
        ],
      },
    ];

    const updates = treeToItemUpdates(tree);

    expect(updates).toContainEqual({
      id: "child",
      parentId: "parent",
      depth: 1,
      order: 0,
    });
  });

  it("increments depth for nested children", () => {
    const tree: TreeItem[] = [
      {
        id: "level0",
        name: "Level 0",
        description: null,
        order: 0,
        depth: 0,
        parentId: null,
        pinnedOrder: null,
        artworkId: null,
        driveFileId: null,
        children: [
          {
            id: "level1",
            name: "Level 1",
            description: null,
            order: 0,
            depth: 1,
            parentId: "level0",
            pinnedOrder: null,
            artworkId: null,
            driveFileId: null,
            children: [
              {
                id: "level2",
                name: "Level 2",
                description: null,
                order: 0,
                depth: 2,
                parentId: "level1",
                children: [],
                pinnedOrder: null,
                artworkId: null,
                driveFileId: null,
              },
            ],
          },
        ],
      },
    ];

    const updates = treeToItemUpdates(tree);

    expect(updates).toContainEqual({
      id: "level0",
      parentId: null,
      depth: 0,
      order: 0,
    });
    expect(updates).toContainEqual({
      id: "level1",
      parentId: "level0",
      depth: 1,
      order: 0,
    });
    expect(updates).toContainEqual({
      id: "level2",
      parentId: "level1",
      depth: 2,
      order: 0,
    });
  });

  it("handles complex tree with multiple branches", () => {
    const tree: TreeItem[] = [
      {
        id: "root1",
        name: "Root 1",
        description: null,
        order: 0,
        depth: 0,
        parentId: null,
        pinnedOrder: null,
        artworkId: null,
        driveFileId: null,
        children: [
          {
            id: "child1a",
            name: "Child 1A",
            description: null,
            order: 0,
            depth: 1,
            parentId: "root1",
            children: [],
            pinnedOrder: null,
            artworkId: null,
            driveFileId: null,
          },
          {
            id: "child1b",
            name: "Child 1B",
            description: null,
            order: 1,
            depth: 1,
            parentId: "root1",
            children: [],
            pinnedOrder: null,
            artworkId: null,
            driveFileId: null,
          },
        ],
      },
      {
        id: "root2",
        name: "Root 2",
        description: null,
        order: 1,
        depth: 0,
        parentId: null,
        children: [],
        pinnedOrder: null,
        artworkId: null,
        driveFileId: null,
      },
    ];

    const updates = treeToItemUpdates(tree);

    expect(updates).toHaveLength(4);
    expect(updates).toContainEqual({
      id: "root1",
      parentId: null,
      depth: 0,
      order: 0,
    });
    expect(updates).toContainEqual({
      id: "child1a",
      parentId: "root1",
      depth: 1,
      order: 0,
    });
    expect(updates).toContainEqual({
      id: "child1b",
      parentId: "root1",
      depth: 1,
      order: 1,
    });
    expect(updates).toContainEqual({
      id: "root2",
      parentId: null,
      depth: 0,
      order: 1,
    });
  });
});

describe("buildDescendantCounter", () => {
  it("returns 0 for leaf items", () => {
    const items = [{ id: "leaf", parentId: null }];
    const counter = buildDescendantCounter(items);

    expect(counter("leaf")).toBe(0);
  });

  it("counts direct children", () => {
    const items = [
      { id: "parent", parentId: null },
      { id: "child1", parentId: "parent" },
      { id: "child2", parentId: "parent" },
    ];
    const counter = buildDescendantCounter(items);

    expect(counter("parent")).toBe(2);
  });

  it("counts nested descendants recursively", () => {
    const items = [
      { id: "root", parentId: null },
      { id: "child", parentId: "root" },
      { id: "grandchild", parentId: "child" },
    ];
    const counter = buildDescendantCounter(items);

    expect(counter("root")).toBe(2); // child + grandchild
    expect(counter("child")).toBe(1); // grandchild
    expect(counter("grandchild")).toBe(0);
  });

  it("counts descendants across multiple branches", () => {
    const items = [
      { id: "root", parentId: null },
      { id: "branch1", parentId: "root" },
      { id: "branch2", parentId: "root" },
      { id: "leaf1", parentId: "branch1" },
      { id: "leaf2", parentId: "branch1" },
      { id: "leaf3", parentId: "branch2" },
    ];
    const counter = buildDescendantCounter(items);

    expect(counter("root")).toBe(5);
    expect(counter("branch1")).toBe(2);
    expect(counter("branch2")).toBe(1);
  });

  it("returns 0 for unknown item IDs", () => {
    const items = [{ id: "known", parentId: null }];
    const counter = buildDescendantCounter(items);

    expect(counter("unknown")).toBe(0);
  });

  it("memoizes results for repeated calls", () => {
    const items = [
      { id: "root", parentId: null },
      { id: "child", parentId: "root" },
    ];
    const counter = buildDescendantCounter(items);

    // Call multiple times
    const result1 = counter("root");
    const result2 = counter("root");
    const result3 = counter("root");

    expect(result1).toBe(1);
    expect(result2).toBe(1);
    expect(result3).toBe(1);
  });

  it("handles deep nesting (5 levels)", () => {
    const items = [
      { id: "l0", parentId: null },
      { id: "l1", parentId: "l0" },
      { id: "l2", parentId: "l1" },
      { id: "l3", parentId: "l2" },
      { id: "l4", parentId: "l3" },
    ];
    const counter = buildDescendantCounter(items);

    expect(counter("l0")).toBe(4);
    expect(counter("l1")).toBe(3);
    expect(counter("l2")).toBe(2);
    expect(counter("l3")).toBe(1);
    expect(counter("l4")).toBe(0);
  });

  it("handles multiple root items", () => {
    const items = [
      { id: "root1", parentId: null },
      { id: "root2", parentId: null },
      { id: "child1", parentId: "root1" },
    ];
    const counter = buildDescendantCounter(items);

    expect(counter("root1")).toBe(1);
    expect(counter("root2")).toBe(0);
  });
});

// Helper to create a PublicItem-like object for testing
function createPublicItem(overrides: {
  id: string;
  name: string;
  parentId?: string | null;
  depth?: number;
  order?: number;
  description?: string | null;
  artworkId?: string | null;
}) {
  return {
    id: overrides.id,
    name: overrides.name,
    parentId: overrides.parentId ?? null,
    depth: overrides.depth ?? 0,
    order: overrides.order ?? 0,
    description: overrides.description ?? null,
    artworkId: overrides.artworkId ?? null,
  };
}

describe("publicItemsToTree", () => {
  it("returns empty array for empty input", () => {
    expect(publicItemsToTree([], 0)).toEqual([]);
  });

  it("converts single child item with depth adjustment", () => {
    const items = [createPublicItem({ id: "1", name: "Child", depth: 1 })];

    // Parent is at depth 0, so child at depth 1 becomes tree depth 0
    const tree = publicItemsToTree(items, 0);

    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe("1");
    expect(tree[0].name).toBe("Child");
    expect(tree[0].depth).toBe(0);
  });

  it("adjusts depth relative to parent", () => {
    // Parent is at depth 2, children are at depth 3, grandchildren at depth 4
    const items = [
      createPublicItem({
        id: "child",
        name: "Child",
        depth: 3,
        parentId: "parent",
      }),
      createPublicItem({
        id: "grandchild",
        name: "Grandchild",
        depth: 4,
        parentId: "child",
      }),
    ];

    const tree = publicItemsToTree(items, 2);

    // Child: depth 3 - 2 - 1 = 0
    expect(tree[0].depth).toBe(0);
    // Grandchild: depth 4 - 2 - 1 = 1
    expect(tree[0].children[0].depth).toBe(1);
  });

  it("builds parent-child relationships", () => {
    const items = [
      createPublicItem({ id: "child", name: "Child", depth: 1, order: 0 }),
      createPublicItem({
        id: "grandchild",
        name: "Grandchild",
        depth: 2,
        parentId: "child",
        order: 0,
      }),
    ];

    const tree = publicItemsToTree(items, 0);

    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe("child");
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children[0].id).toBe("grandchild");
  });

  it("sorts children by order at each level", () => {
    const items = [
      createPublicItem({
        id: "child-b",
        name: "Child B",
        depth: 1,
        order: 1,
        parentId: "parent",
      }),
      createPublicItem({
        id: "child-a",
        name: "Child A",
        depth: 1,
        order: 0,
        parentId: "parent",
      }),
      createPublicItem({
        id: "child-c",
        name: "Child C",
        depth: 1,
        order: 2,
        parentId: "parent",
      }),
    ];

    const tree = publicItemsToTree(items, 0);

    expect(tree[0].name).toBe("Child A");
    expect(tree[1].name).toBe("Child B");
    expect(tree[2].name).toBe("Child C");
  });

  it("treats items with missing parent as roots", () => {
    const items = [
      createPublicItem({
        id: "orphan",
        name: "Orphan",
        depth: 2,
        parentId: "nonexistent",
      }),
    ];

    const tree = publicItemsToTree(items, 1);

    // Should be treated as root since parent is not in items
    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe("orphan");
  });

  it("preserves description field", () => {
    const items = [
      createPublicItem({
        id: "1",
        name: "Item",
        depth: 1,
        description: "Test description",
      }),
    ];

    const tree = publicItemsToTree(items, 0);

    expect(tree[0].description).toBe("Test description");
  });

  it("preserves artworkId field", () => {
    const items = [
      createPublicItem({
        id: "1",
        name: "Item",
        depth: 1,
        artworkId: "artwork-123",
      }),
    ];

    const tree = publicItemsToTree(items, 0);

    expect(tree[0].artworkId).toBe("artwork-123");
  });

  it("builds nested hierarchy (3 levels)", () => {
    // Parent at depth 0, items at depths 1, 2, 3
    const items = [
      createPublicItem({ id: "l1", name: "Level 1", depth: 1 }),
      createPublicItem({
        id: "l2",
        name: "Level 2",
        depth: 2,
        parentId: "l1",
      }),
      createPublicItem({
        id: "l3",
        name: "Level 3",
        depth: 3,
        parentId: "l2",
      }),
    ];

    const tree = publicItemsToTree(items, 0);

    expect(tree[0].id).toBe("l1");
    expect(tree[0].depth).toBe(0);
    expect(tree[0].children[0].id).toBe("l2");
    expect(tree[0].children[0].depth).toBe(1);
    expect(tree[0].children[0].children[0].id).toBe("l3");
    expect(tree[0].children[0].children[0].depth).toBe(2);
  });

  it("handles items with null parentId as roots", () => {
    const items = [
      createPublicItem({ id: "root1", name: "Root 1", depth: 1, order: 0 }),
      createPublicItem({ id: "root2", name: "Root 2", depth: 1, order: 1 }),
    ];

    const tree = publicItemsToTree(items, 0);

    expect(tree).toHaveLength(2);
    expect(tree[0].id).toBe("root1");
    expect(tree[1].id).toBe("root2");
  });
});
