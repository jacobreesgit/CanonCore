/**
 * Unit tests for public-auth.ts.
 * Tests authorization helpers for public profiles and items.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  getPublicProfile,
  isItemFullyPublic,
  canViewItem,
  getPublicItem,
  getPublicItemsForUser,
  getPublicChildItems,
  getPublicDescendants,
  getExploreItems,
  getPublicBreadcrumb,
} from "@/lib/public-auth";

// Mock Prisma
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findFirst: vi.fn(),
    },
    item: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    $queryRaw: vi.fn(),
  },
}));

const mockUserFindFirst = vi.mocked(prisma.user.findFirst);
const mockItemFindUnique = vi.mocked(prisma.item.findUnique);
const mockItemFindMany = vi.mocked(prisma.item.findMany);
const mockQueryRaw = vi.mocked(prisma.$queryRaw);

/** Creates a mock user for testing */
function mockUser(
  overrides: Partial<{
    id: string;
    username: string | null;
    name: string | null;
    image: Buffer | null;
    heroImage: Buffer | null;
    isPublic: boolean;
    createdAt: Date;
  }> = {}
) {
  return {
    id: "user-1",
    username: "testuser",
    name: "Test User",
    image: null,
    heroImage: null,
    isPublic: true,
    createdAt: new Date("2024-01-01"),
    ...overrides,
  };
}

/** Creates a mock item for testing */
function mockItem(
  overrides: Partial<{
    id: string;
    name: string;
    description: string | null;
    parentId: string | null;
    depth: number;
    userId: string;
    isPublic: boolean;
    inheritVisibility: boolean;
    tmdbId: number | null;
    tmdbType: string | null;
    order: number;
    updatedAt: Date;
    files: Array<{ id: string }>;
    _count: { sourceForks: number };
    user: { username: string | null };
  }> = {}
) {
  return {
    id: "item-1",
    name: "Test Item",
    description: null,
    parentId: null,
    depth: 0,
    userId: "user-1",
    isPublic: true,
    inheritVisibility: false,
    tmdbId: null,
    tmdbType: null,
    order: 0,
    updatedAt: new Date("2024-01-15"),
    files: [],
    _count: { sourceForks: 0 },
    user: { username: "testuser" },
    ...overrides,
  };
}

describe("getPublicProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when user does not exist", async () => {
    mockUserFindFirst.mockResolvedValue(null);

    const result = await getPublicProfile("nonexistent");

    expect(result).toBeNull();
    expect(mockUserFindFirst).toHaveBeenCalledWith({
      where: {
        username: { equals: "nonexistent", mode: "insensitive" },
        isPublic: true,
      },
      select: {
        id: true,
        username: true,
        name: true,
        image: true,
        heroImage: true,
        createdAt: true,
      },
    });
  });

  it("returns null when user has no username", async () => {
    mockUserFindFirst.mockResolvedValue(mockUser({ username: null }) as never);

    const result = await getPublicProfile("testuser");

    expect(result).toBeNull();
  });

  it("returns public profile for valid public user", async () => {
    const user = mockUser({
      id: "user-1",
      username: "johndoe",
      name: "John Doe",
      image: Buffer.from("avatar"),
      heroImage: Buffer.from("hero"),
      createdAt: new Date("2024-01-01"),
    });
    mockUserFindFirst.mockResolvedValue(user as never);

    const result = await getPublicProfile("johndoe");

    expect(result).toEqual({
      id: "user-1",
      username: "johndoe",
      name: "John Doe",
      hasImage: true,
      hasHeroImage: true,
      createdAt: new Date("2024-01-01"),
    });
  });

  it("sets hasImage to false when user has no image", async () => {
    const user = mockUser({ image: null, heroImage: null });
    mockUserFindFirst.mockResolvedValue(user as never);

    const result = await getPublicProfile("testuser");

    expect(result?.hasImage).toBe(false);
    expect(result?.hasHeroImage).toBe(false);
  });

  it("performs case-insensitive username lookup", async () => {
    mockUserFindFirst.mockResolvedValue(mockUser() as never);

    await getPublicProfile("TestUser");

    expect(mockUserFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          username: { equals: "TestUser", mode: "insensitive" },
        }),
      })
    );
  });
});

describe("isItemFullyPublic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns true when item and all ancestors are public", async () => {
    mockQueryRaw.mockResolvedValue([{ is_fully_public: true }]);

    const result = await isItemFullyPublic("item-1");

    expect(result).toBe(true);
  });

  it("returns false when item has private ancestor", async () => {
    mockQueryRaw.mockResolvedValue([{ is_fully_public: false }]);

    const result = await isItemFullyPublic("item-1");

    expect(result).toBe(false);
  });

  it("returns false when query returns empty result", async () => {
    mockQueryRaw.mockResolvedValue([]);

    const result = await isItemFullyPublic("nonexistent");

    expect(result).toBe(false);
  });

  it("executes recursive CTE query with item ID", async () => {
    mockQueryRaw.mockResolvedValue([{ is_fully_public: true }]);

    await isItemFullyPublic("test-item-123");

    expect(mockQueryRaw).toHaveBeenCalled();
    // The query is a tagged template, so we verify it was called
    const call = mockQueryRaw.mock.calls[0];
    expect(call).toBeDefined();
  });

  it("returns true when item inherits from public ancestor", async () => {
    // Item has inheritVisibility=true and ancestor is public
    mockQueryRaw.mockResolvedValue([{ is_fully_public: true }]);

    const result = await isItemFullyPublic("child-item");

    expect(result).toBe(true);
  });

  it("returns false when inherit chain is broken by non-inheriting private item", async () => {
    // Item inherits, but an ancestor has inheritVisibility=false and isPublic=false
    mockQueryRaw.mockResolvedValue([{ is_fully_public: false }]);

    const result = await isItemFullyPublic("deep-child");

    expect(result).toBe(false);
  });

  it("returns true when item is explicitly public (inheritVisibility=false, isPublic=true)", async () => {
    mockQueryRaw.mockResolvedValue([{ is_fully_public: true }]);

    const result = await isItemFullyPublic("explicit-public-item");

    expect(result).toBe(true);
  });
});

describe("canViewItem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns false when item does not exist", async () => {
    mockItemFindUnique.mockResolvedValue(null);

    const result = await canViewItem("nonexistent", "viewer-1");

    expect(result).toBe(false);
  });

  it("returns true when viewer is the owner", async () => {
    mockItemFindUnique.mockResolvedValue({ userId: "owner-1" } as never);

    const result = await canViewItem("item-1", "owner-1");

    expect(result).toBe(true);
    // Should not check public status for owner
    expect(mockQueryRaw).not.toHaveBeenCalled();
  });

  it("checks public status for non-owner viewer", async () => {
    mockItemFindUnique.mockResolvedValue({ userId: "owner-1" } as never);
    mockQueryRaw.mockResolvedValue([{ is_fully_public: true }]);

    const result = await canViewItem("item-1", "viewer-2");

    expect(result).toBe(true);
    expect(mockQueryRaw).toHaveBeenCalled();
  });

  it("returns false for non-owner when item is not fully public", async () => {
    mockItemFindUnique.mockResolvedValue({ userId: "owner-1" } as never);
    mockQueryRaw.mockResolvedValue([{ is_fully_public: false }]);

    const result = await canViewItem("item-1", "viewer-2");

    expect(result).toBe(false);
  });

  it("checks public status for unauthenticated viewer (null)", async () => {
    mockItemFindUnique.mockResolvedValue({ userId: "owner-1" } as never);
    mockQueryRaw.mockResolvedValue([{ is_fully_public: true }]);

    const result = await canViewItem("item-1", null);

    expect(result).toBe(true);
    expect(mockQueryRaw).toHaveBeenCalled();
  });

  it("returns false for unauthenticated viewer when item is private", async () => {
    mockItemFindUnique.mockResolvedValue({ userId: "owner-1" } as never);
    mockQueryRaw.mockResolvedValue([{ is_fully_public: false }]);

    const result = await canViewItem("item-1", null);

    expect(result).toBe(false);
  });
});

describe("getPublicItem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when item is not fully public", async () => {
    mockQueryRaw.mockResolvedValue([{ is_fully_public: false }]);

    const result = await getPublicItem("item-1");

    expect(result).toBeNull();
    expect(mockItemFindUnique).not.toHaveBeenCalled();
  });

  it("returns null when item does not exist after public check", async () => {
    mockQueryRaw.mockResolvedValue([{ is_fully_public: true }]);
    mockItemFindUnique.mockResolvedValue(null);

    const result = await getPublicItem("item-1");

    expect(result).toBeNull();
  });

  it("returns public item with all fields", async () => {
    mockQueryRaw.mockResolvedValue([{ is_fully_public: true }]);
    mockItemFindUnique.mockResolvedValue(
      mockItem({
        id: "item-1",
        name: "My Movie",
        description: "A great movie",
        parentId: null,
        depth: 0,
        userId: "user-1",
        tmdbId: 12345,
        tmdbType: "movie",
        files: [{ id: "artwork-1" }],
        _count: { sourceForks: 5 },
        updatedAt: new Date("2024-01-15"),
      }) as never
    );

    const result = await getPublicItem("item-1");

    expect(result).toEqual({
      id: "item-1",
      name: "My Movie",
      description: "A great movie",
      parentId: null,
      depth: 0,
      order: 0,
      userId: "user-1",
      artworkId: "artwork-1",
      tmdbId: 12345,
      tmdbType: "movie",
      forkCount: 5,
      updatedAt: new Date("2024-01-15"),
    });
  });

  it("sets artworkId to null when no artwork files", async () => {
    mockQueryRaw.mockResolvedValue([{ is_fully_public: true }]);
    mockItemFindUnique.mockResolvedValue(mockItem({ files: [] }) as never);

    const result = await getPublicItem("item-1");

    expect(result?.artworkId).toBeNull();
  });
});

describe("getPublicItemsForUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty array when user has no public items", async () => {
    mockItemFindMany.mockResolvedValue([]);

    const result = await getPublicItemsForUser("user-1");

    expect(result).toEqual([]);
  });

  it("queries only root-level explicitly public items", async () => {
    mockItemFindMany.mockResolvedValue([]);

    await getPublicItemsForUser("user-1");

    expect(mockItemFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: "user-1",
          isPublic: true,
          inheritVisibility: false, // Only explicitly public items (consistent with Explore)
        },
      })
    );
  });

  it("returns explicitly public items for user profile", async () => {
    mockItemFindMany.mockResolvedValue([
      mockItem({
        id: "movie",
        name: "Shawshank",
        isPublic: true,
        inheritVisibility: false,
      }),
    ] as never);

    await getPublicItemsForUser("user-1");

    expect(mockItemFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isPublic: true,
          inheritVisibility: false,
        }),
      })
    );
  });

  it("returns mapped public items with fork counts", async () => {
    mockItemFindMany.mockResolvedValue([
      mockItem({
        id: "item-1",
        name: "Movie 1",
        files: [{ id: "art-1" }],
        _count: { sourceForks: 3 },
      }),
      mockItem({
        id: "item-2",
        name: "Movie 2",
        files: [],
        _count: { sourceForks: 0 },
      }),
    ] as never);

    const result = await getPublicItemsForUser("user-1");

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("Movie 1");
    expect(result[0].artworkId).toBe("art-1");
    expect(result[0].forkCount).toBe(3);
    expect(result[1].artworkId).toBeNull();
    expect(result[1].forkCount).toBe(0);
  });

  it("applies pagination parameters", async () => {
    mockItemFindMany.mockResolvedValue([]);

    await getPublicItemsForUser("user-1", 20, 10);

    expect(mockItemFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 20,
        skip: 10,
      })
    );
  });

  it("uses default pagination values", async () => {
    mockItemFindMany.mockResolvedValue([]);

    await getPublicItemsForUser("user-1");

    expect(mockItemFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 50,
        skip: 0,
      })
    );
  });

  it("does not include progress when currentUserId not passed", async () => {
    mockItemFindMany.mockResolvedValue([
      mockItem({ id: "item-1", name: "Movie 1" }),
    ] as never);

    const result = await getPublicItemsForUser("user-1");

    expect(result[0]).not.toHaveProperty("progressPercentage");
    expect(result[0]).not.toHaveProperty("watchedCount");
    expect(result[0]).not.toHaveProperty("totalMediaCount");
    expect(result[0]).not.toHaveProperty("totalItems");
    // Should not query for progress data
    expect(mockQueryRaw).not.toHaveBeenCalled();
  });

  it("does not include progress when viewing another user's profile", async () => {
    mockItemFindMany.mockResolvedValue([
      mockItem({ id: "item-1", name: "Movie 1", userId: "owner-1" }),
    ] as never);

    const result = await getPublicItemsForUser("owner-1", 50, 0, "viewer-2");

    expect(result[0]).not.toHaveProperty("progressPercentage");
    expect(result[0]).not.toHaveProperty("watchedCount");
    // Should not query for progress data
    expect(mockQueryRaw).not.toHaveBeenCalled();
  });

  it("includes progress when viewing own profile", async () => {
    mockItemFindMany.mockResolvedValue([
      mockItem({ id: "item-1", name: "Movie 1", userId: "user-1" }),
    ] as never);
    // Mock progress query response
    mockQueryRaw.mockResolvedValue([
      {
        rootItemId: "item-1",
        totalItems: BigInt(5),
        itemsWithMedia: BigInt(3),
        watchedItems: BigInt(2),
      },
    ]);

    const result = await getPublicItemsForUser("user-1", 50, 0, "user-1");

    expect(result[0]).toHaveProperty("progressPercentage", 67); // 2/3 = 67%
    expect(result[0]).toHaveProperty("watchedCount", 2);
    expect(result[0]).toHaveProperty("totalMediaCount", 3);
    expect(result[0]).toHaveProperty("totalItems", 5);
    expect(mockQueryRaw).toHaveBeenCalled();
  });

  it("sets progressPercentage to null when no items have media", async () => {
    mockItemFindMany.mockResolvedValue([
      mockItem({ id: "item-1", name: "Empty Folder", userId: "user-1" }),
    ] as never);
    mockQueryRaw.mockResolvedValue([
      {
        rootItemId: "item-1",
        totalItems: BigInt(1),
        itemsWithMedia: BigInt(0),
        watchedItems: BigInt(0),
      },
    ]);

    const result = await getPublicItemsForUser("user-1", 50, 0, "user-1");

    expect(result[0]).toHaveProperty("progressPercentage", null);
    expect(result[0]).toHaveProperty("watchedCount", 0);
    expect(result[0]).toHaveProperty("totalMediaCount", 0);
    expect(result[0]).toHaveProperty("totalItems", 1);
  });
});

describe("getPublicChildItems", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty array when parent has no public children", async () => {
    // Parent is public
    mockQueryRaw.mockResolvedValue([{ is_fully_public: true }]);
    mockItemFindMany.mockResolvedValue([]);

    const result = await getPublicChildItems("parent-1");

    expect(result).toEqual([]);
  });

  it("queries children of specific parent with correct visibility filter", async () => {
    // Parent is public
    mockQueryRaw.mockResolvedValue([{ is_fully_public: true }]);
    mockItemFindMany.mockResolvedValue([]);

    await getPublicChildItems("parent-1");

    expect(mockItemFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          parentId: "parent-1",
          OR: [
            { inheritVisibility: false, isPublic: true },
            { inheritVisibility: true },
          ],
        },
      })
    );
  });

  it("orders children by order field", async () => {
    // Parent is public
    mockQueryRaw.mockResolvedValue([{ is_fully_public: true }]);
    mockItemFindMany.mockResolvedValue([]);

    await getPublicChildItems("parent-1");

    expect(mockItemFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { order: "asc" },
      })
    );
  });

  it("returns mapped child items", async () => {
    // Parent is public
    mockQueryRaw.mockResolvedValue([{ is_fully_public: true }]);
    mockItemFindMany.mockResolvedValue([
      mockItem({
        id: "child-1",
        name: "Episode 1",
        parentId: "parent-1",
        depth: 1,
      }),
      mockItem({
        id: "child-2",
        name: "Episode 2",
        parentId: "parent-1",
        depth: 1,
      }),
    ] as never);

    const result = await getPublicChildItems("parent-1");

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("Episode 1");
    expect(result[0].parentId).toBe("parent-1");
    expect(result[1].name).toBe("Episode 2");
  });

  it("applies pagination parameters", async () => {
    // Parent is public
    mockQueryRaw.mockResolvedValue([{ is_fully_public: true }]);
    mockItemFindMany.mockResolvedValue([]);

    await getPublicChildItems("parent-1", 25, 5);

    expect(mockItemFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 25,
        skip: 5,
      })
    );
  });

  it("returns children that inherit visibility from public parent", async () => {
    // Parent is public
    mockQueryRaw.mockResolvedValue([{ is_fully_public: true }]);
    mockItemFindMany.mockResolvedValue([
      mockItem({
        id: "child-1",
        name: "Inheriting Child",
        parentId: "parent-1",
        isPublic: false,
        inheritVisibility: true,
      }),
    ] as never);

    const result = await getPublicChildItems("parent-1");

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Inheriting Child");
  });

  it("returns empty array when parent is not public (CR-2 security check)", async () => {
    // Parent is NOT public
    mockQueryRaw.mockResolvedValue([{ is_fully_public: false }]);

    const result = await getPublicChildItems("parent-1");

    expect(result).toEqual([]);
    // Should not query children when parent is not public
    expect(mockItemFindMany).not.toHaveBeenCalled();
  });

  it("includes both explicit public and inheriting children", async () => {
    // Parent is public
    mockQueryRaw.mockResolvedValue([{ is_fully_public: true }]);
    mockItemFindMany.mockResolvedValue([
      mockItem({
        id: "explicit-child",
        name: "Explicit Public Child",
        isPublic: true,
        inheritVisibility: false,
      }),
      mockItem({
        id: "inherit-child",
        name: "Inheriting Child",
        isPublic: false,
        inheritVisibility: true,
      }),
    ] as never);

    const result = await getPublicChildItems("parent-1");

    expect(result).toHaveLength(2);
  });
});

describe("getExploreItems", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty array when no public items exist", async () => {
    mockItemFindMany.mockResolvedValue([]);

    const result = await getExploreItems();

    expect(result).toEqual([]);
  });

  it("queries explicitly public items from public users with usernames", async () => {
    mockItemFindMany.mockResolvedValue([]);

    await getExploreItems();

    expect(mockItemFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          isPublic: true,
          inheritVisibility: false, // Only explicitly public items
          user: {
            isPublic: true,
            username: { not: null },
          },
        },
      })
    );
  });

  it("excludes items that only inherit visibility", async () => {
    mockItemFindMany.mockResolvedValue([
      mockItem({
        id: "explicit",
        name: "Explicit Public",
        isPublic: true,
        inheritVisibility: false,
        user: { username: "testuser" },
      }),
      // Note: Query should filter out inheritVisibility=true items
    ] as never);

    const result = await getExploreItems();

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Explicit Public");
  });

  it("orders by updatedAt descending", async () => {
    mockItemFindMany.mockResolvedValue([]);

    await getExploreItems();

    expect(mockItemFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { updatedAt: "desc" },
      })
    );
  });

  it("returns items with owner username", async () => {
    mockItemFindMany.mockResolvedValue([
      mockItem({
        id: "item-1",
        name: "Public Movie",
        user: { username: "johndoe" },
      }),
    ] as never);

    const result = await getExploreItems();

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Public Movie");
    expect(result[0].ownerUsername).toBe("johndoe");
  });

  it("filters out items with null username", async () => {
    mockItemFindMany.mockResolvedValue([
      mockItem({
        id: "item-1",
        name: "Valid Item",
        user: { username: "valid" },
      }),
      mockItem({
        id: "item-2",
        name: "Invalid Item",
        user: { username: null },
      }),
    ] as never);

    const result = await getExploreItems();

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Valid Item");
  });

  it("applies pagination parameters", async () => {
    mockItemFindMany.mockResolvedValue([]);

    await getExploreItems(30, 15);

    expect(mockItemFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 30,
        skip: 15,
      })
    );
  });
});

describe("getPublicDescendants", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty array when parent is not public", async () => {
    mockQueryRaw.mockResolvedValue([{ is_fully_public: false }]);

    const result = await getPublicDescendants("parent-1");

    expect(result).toEqual([]);
    expect(mockItemFindMany).not.toHaveBeenCalled();
  });

  it("returns empty array when parent has no descendants", async () => {
    // Parent is public
    mockQueryRaw
      .mockResolvedValueOnce([{ is_fully_public: true }]) // isItemFullyPublic
      .mockResolvedValueOnce([]); // descendants CTE
    mockItemFindUnique.mockResolvedValue({
      userId: "user-1",
      depth: 0,
    } as never);
    mockItemFindMany.mockResolvedValue([]);

    const result = await getPublicDescendants("parent-1");

    expect(result).toEqual([]);
  });

  it("returns all public descendants with correct structure", async () => {
    // Parent is public
    mockQueryRaw
      .mockResolvedValueOnce([{ is_fully_public: true }]) // isItemFullyPublic
      .mockResolvedValueOnce([{ id: "child-1" }, { id: "grandchild-1" }]); // descendants CTE

    mockItemFindUnique.mockResolvedValue({
      userId: "user-1",
      depth: 0,
    } as never);
    mockItemFindMany.mockResolvedValue([
      mockItem({
        id: "child-1",
        name: "Season 1",
        parentId: "parent-1",
        depth: 1,
        order: 0,
      }),
      mockItem({
        id: "grandchild-1",
        name: "Episode 1",
        parentId: "child-1",
        depth: 2,
        order: 0,
      }),
    ] as never);

    const result = await getPublicDescendants("parent-1");

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("Season 1");
    expect(result[0].parentId).toBe("parent-1");
    expect(result[1].name).toBe("Episode 1");
    expect(result[1].parentId).toBe("child-1");
  });

  it("orders descendants by depth then order", async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ is_fully_public: true }])
      .mockResolvedValueOnce([{ id: "a" }, { id: "b" }, { id: "c" }]);

    mockItemFindUnique.mockResolvedValue({
      userId: "user-1",
      depth: 0,
    } as never);
    mockItemFindMany.mockResolvedValue([
      mockItem({ id: "a", name: "First", depth: 1, order: 0 }),
      mockItem({ id: "b", name: "Second", depth: 1, order: 1 }),
      mockItem({ id: "c", name: "Nested", depth: 2, order: 0 }),
    ] as never);

    await getPublicDescendants("parent-1");

    expect(mockItemFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ depth: "asc" }, { order: "asc" }],
      })
    );
  });

  it("returns empty array when parent not found", async () => {
    mockQueryRaw.mockResolvedValueOnce([{ is_fully_public: true }]);
    mockItemFindUnique.mockResolvedValue(null);

    const result = await getPublicDescendants("nonexistent");

    expect(result).toEqual([]);
  });
});

describe("getPublicBreadcrumb", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when item is not fully public", async () => {
    mockQueryRaw.mockResolvedValueOnce([{ is_fully_public: false }]);

    const result = await getPublicBreadcrumb("item-1");

    expect(result).toBeNull();
  });

  it("returns breadcrumb path for fully public item", async () => {
    // First call: isItemFullyPublic check
    mockQueryRaw.mockResolvedValueOnce([{ is_fully_public: true }]);
    // Second call: ancestor chain query
    mockQueryRaw.mockResolvedValueOnce([
      { id: "root-1", name: "Movies", depth: 0 },
      { id: "child-1", name: "Star Wars", depth: 1 },
      { id: "item-1", name: "Episode IV", depth: 2 },
    ]);

    const result = await getPublicBreadcrumb("item-1");

    expect(result).toEqual([
      { id: "root-1", name: "Movies" },
      { id: "child-1", name: "Star Wars" },
      { id: "item-1", name: "Episode IV" },
    ]);
  });

  it("returns single item breadcrumb for root item", async () => {
    mockQueryRaw.mockResolvedValueOnce([{ is_fully_public: true }]);
    mockQueryRaw.mockResolvedValueOnce([
      { id: "root-1", name: "My Collection", depth: 0 },
    ]);

    const result = await getPublicBreadcrumb("root-1");

    expect(result).toEqual([{ id: "root-1", name: "My Collection" }]);
  });

  it("makes two query calls (public check and breadcrumb)", async () => {
    mockQueryRaw.mockResolvedValueOnce([{ is_fully_public: true }]);
    mockQueryRaw.mockResolvedValueOnce([
      { id: "item-1", name: "Test", depth: 0 },
    ]);

    await getPublicBreadcrumb("item-1");

    expect(mockQueryRaw).toHaveBeenCalledTimes(2);
  });
});
