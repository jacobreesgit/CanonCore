/**
 * Unit tests for fork-actions.ts.
 * Tests server actions for forking public items.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import * as publicAuth from "@/lib/public-auth";
import {
  forkItem,
  getForkStatus,
  getForkInfo,
  getItemForks,
} from "@/lib/fork-actions";

// Mock dependencies
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    item: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    fork: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn((callback) =>
      callback({
        item: {
          create: vi.fn(),
        },
        fork: {
          create: vi.fn(),
        },
      })
    ),
  },
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(),
}));

vi.mock("@/lib/public-auth", () => ({
  isItemFullyPublic: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("@/lib/errors", () => ({
  handlePrismaError: vi.fn().mockReturnValue(null),
}));

const mockAuth = vi.mocked(auth);
const mockCheckRateLimit = vi.mocked(checkRateLimit);
const mockIsItemFullyPublic = vi.mocked(publicAuth.isItemFullyPublic);
const mockItemFindUnique = vi.mocked(prisma.item.findUnique);
const mockItemFindFirst = vi.mocked(prisma.item.findFirst);
const mockForkFindUnique = vi.mocked(prisma.fork.findUnique);
const mockForkFindMany = vi.mocked(prisma.fork.findMany);
const mockTransaction = vi.mocked(prisma.$transaction);

/** Creates a mock session */
function mockSession(userId: string | null = "user-1") {
  if (!userId) {
    return null;
  }
  return { user: { id: userId } };
}

/** Creates a mock item */
function mockItem(
  overrides: Partial<{
    id: string;
    name: string;
    description: string | null;
    userId: string;
    parentId: string | null;
    depth: number;
    order: number;
    tmdbId: number | null;
    tmdbType: string | null;
    isPublic: boolean;
    forkedFromId: string | null;
    forkedFrom: {
      id: string;
      name: string;
      isPublic: boolean;
      user: { username: string | null; isPublic: boolean };
    } | null;
    files: Array<{ id: string }>;
    _count: { sourceForks: number };
  }> = {}
) {
  return {
    id: "item-1",
    name: "Test Item",
    description: null,
    userId: "owner-1",
    parentId: null,
    depth: 0,
    order: 0,
    tmdbId: null,
    tmdbType: null,
    isPublic: true,
    forkedFromId: null,
    forkedFrom: null,
    files: [],
    _count: { sourceForks: 0 },
    ...overrides,
  };
}

describe("forkItem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when not authenticated", async () => {
    mockAuth.mockResolvedValue(null as never);

    const result = await forkItem("item-1");

    expect(result.error).toBe("Not authenticated");
  });

  it("returns error when rate limited", async () => {
    mockAuth.mockResolvedValue(mockSession() as never);
    mockCheckRateLimit.mockResolvedValue({ error: "Rate limit exceeded" });

    const result = await forkItem("item-1");

    expect(result.error).toBe("Rate limit exceeded");
    expect(mockCheckRateLimit).toHaveBeenCalledWith("fork");
  });

  it("returns error when source item not found", async () => {
    mockAuth.mockResolvedValue(mockSession() as never);
    mockCheckRateLimit.mockResolvedValue(null);
    mockItemFindUnique.mockResolvedValue(null);

    const result = await forkItem("nonexistent");

    expect(result.error).toBe("Item not found");
  });

  it("returns error when trying to fork own item", async () => {
    mockAuth.mockResolvedValue(mockSession("user-1") as never);
    mockCheckRateLimit.mockResolvedValue(null);
    mockItemFindUnique.mockResolvedValue(
      mockItem({ userId: "user-1" }) as never
    );

    const result = await forkItem("item-1");

    expect(result.error).toBe("Cannot fork your own items");
  });

  it("returns error when item is not fully public", async () => {
    mockAuth.mockResolvedValue(mockSession("user-1") as never);
    mockCheckRateLimit.mockResolvedValue(null);
    mockItemFindUnique.mockResolvedValue(
      mockItem({ userId: "other-user" }) as never
    );
    mockIsItemFullyPublic.mockResolvedValue(false);

    const result = await forkItem("item-1");

    expect(result.error).toBe("Item is not publicly accessible");
    expect(mockIsItemFullyPublic).toHaveBeenCalledWith("item-1");
  });

  it("returns error when user already forked the item", async () => {
    mockAuth.mockResolvedValue(mockSession("user-1") as never);
    mockCheckRateLimit.mockResolvedValue(null);
    mockItemFindUnique.mockResolvedValue(
      mockItem({ userId: "other-user" }) as never
    );
    mockIsItemFullyPublic.mockResolvedValue(true);
    mockForkFindUnique.mockResolvedValue({
      targetItemId: "existing-fork",
    } as never);

    const result = await forkItem("item-1");

    expect(result.error).toBe("You have already forked this item");
  });

  it("returns error when parent folder not found", async () => {
    mockAuth.mockResolvedValue(mockSession("user-1") as never);
    mockCheckRateLimit.mockResolvedValue(null);
    mockItemFindUnique
      .mockResolvedValueOnce(mockItem({ userId: "other-user" }) as never)
      .mockResolvedValueOnce(null); // Parent not found
    mockIsItemFullyPublic.mockResolvedValue(true);
    mockForkFindUnique.mockResolvedValue(null);

    const result = await forkItem("item-1", "invalid-parent");

    expect(result.error).toBe("Parent folder not found");
  });

  it("returns error when max nesting depth reached", async () => {
    mockAuth.mockResolvedValue(mockSession("user-1") as never);
    mockCheckRateLimit.mockResolvedValue(null);
    mockItemFindUnique
      .mockResolvedValueOnce(mockItem({ userId: "other-user" }) as never)
      .mockResolvedValueOnce({ depth: 9 } as never); // Parent at depth 9
    mockIsItemFullyPublic.mockResolvedValue(true);
    mockForkFindUnique.mockResolvedValue(null);

    const result = await forkItem("item-1", "deep-parent");

    expect(result.error).toBe("Maximum nesting depth reached");
  });

  it("successfully forks item to root level", async () => {
    mockAuth.mockResolvedValue(mockSession("user-1") as never);
    mockCheckRateLimit.mockResolvedValue(null);
    mockItemFindUnique.mockResolvedValue(
      mockItem({
        id: "source-1",
        name: "Source Movie",
        description: "A great movie",
        userId: "other-user",
        tmdbId: 12345,
        tmdbType: "movie",
      }) as never
    );
    mockIsItemFullyPublic.mockResolvedValue(true);
    mockForkFindUnique.mockResolvedValue(null);
    mockItemFindFirst.mockResolvedValue({ order: 5 } as never);

    const createdItem = { id: "forked-1", name: "Source Movie" };
    mockTransaction.mockImplementation(async (callback) => {
      const tx = {
        item: { create: vi.fn().mockResolvedValue(createdItem) },
        fork: { create: vi.fn().mockResolvedValue({}) },
      };
      return callback(tx as never);
    });

    const result = await forkItem("source-1");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data?.itemId).toBe("forked-1");
      expect(result.data?.name).toBe("Source Movie");
    }
  });

  it("forks item to specific parent", async () => {
    mockAuth.mockResolvedValue(mockSession("user-1") as never);
    mockCheckRateLimit.mockResolvedValue(null);
    mockItemFindUnique
      .mockResolvedValueOnce(mockItem({ userId: "other-user" }) as never)
      .mockResolvedValueOnce({ depth: 2 } as never); // Parent at depth 2
    mockIsItemFullyPublic.mockResolvedValue(true);
    mockForkFindUnique.mockResolvedValue(null);
    mockItemFindFirst.mockResolvedValue(null); // No existing items

    const createdItem = { id: "forked-1", name: "Test Item" };
    mockTransaction.mockImplementation(async (callback) => {
      const tx = {
        item: { create: vi.fn().mockResolvedValue(createdItem) },
        fork: { create: vi.fn().mockResolvedValue({}) },
      };
      return callback(tx as never);
    });

    const result = await forkItem("source-1", "parent-1");

    expect(result.success).toBe(true);
  });
});

describe("getForkStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns hasForked false for unauthenticated user", async () => {
    mockAuth.mockResolvedValue(null as never);

    const result = await getForkStatus("item-1");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data?.hasForked).toBe(false);
      expect(result.data?.forkedItemId).toBeNull();
    }
  });

  it("returns hasForked false when no fork exists", async () => {
    mockAuth.mockResolvedValue(mockSession("user-1") as never);
    mockForkFindUnique.mockResolvedValue(null);

    const result = await getForkStatus("item-1");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data?.hasForked).toBe(false);
      expect(result.data?.forkedItemId).toBeNull();
    }
  });

  it("returns hasForked true with forked item ID when fork exists", async () => {
    mockAuth.mockResolvedValue(mockSession("user-1") as never);
    mockForkFindUnique.mockResolvedValue({
      targetItemId: "forked-123",
    } as never);

    const result = await getForkStatus("item-1");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data?.hasForked).toBe(true);
      expect(result.data?.forkedItemId).toBe("forked-123");
    }
  });

  it("queries with correct composite key", async () => {
    mockAuth.mockResolvedValue(mockSession("user-1") as never);
    mockForkFindUnique.mockResolvedValue(null);

    await getForkStatus("item-1");

    expect(mockForkFindUnique).toHaveBeenCalledWith({
      where: {
        sourceItemId_userId: {
          sourceItemId: "item-1",
          userId: "user-1",
        },
      },
      select: { targetItemId: true },
    });
  });
});

describe("getForkInfo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when item not found", async () => {
    mockAuth.mockResolvedValue(mockSession("user-1") as never);
    mockItemFindUnique.mockResolvedValue(null);

    const result = await getForkInfo("nonexistent");

    expect(result.error).toBe("Item not found");
  });

  it("returns error for non-owner accessing private item", async () => {
    mockAuth.mockResolvedValue(mockSession("user-1") as never);
    mockItemFindUnique.mockResolvedValue(
      mockItem({
        userId: "other-user",
        _count: { sourceForks: 0 },
      }) as never
    );
    mockIsItemFullyPublic.mockResolvedValue(false);

    const result = await getForkInfo("item-1");

    expect(result.error).toBe("Item not found");
  });

  it("returns fork info for owner viewing own item", async () => {
    mockAuth.mockResolvedValue(mockSession("owner-1") as never);
    mockItemFindUnique.mockResolvedValue(
      mockItem({
        userId: "owner-1",
        forkedFromId: null,
        forkedFrom: null,
        _count: { sourceForks: 5 },
      }) as never
    );

    const result = await getForkInfo("item-1");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data?.source).toBeNull();
      expect(result.data?.forkCount).toBe(5);
    }
  });

  it("returns fork info with source for forked item", async () => {
    mockAuth.mockResolvedValue(mockSession("user-1") as never);
    mockItemFindUnique.mockResolvedValue(
      mockItem({
        userId: "user-1",
        forkedFromId: "source-1",
        forkedFrom: {
          id: "source-1",
          name: "Original Movie",
          isPublic: true,
          user: { username: "creator", isPublic: true },
        },
        _count: { sourceForks: 0 },
      }) as never
    );

    const result = await getForkInfo("item-1");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data?.source).toEqual({
        id: "source-1",
        name: "Original Movie",
        ownerUsername: "creator",
      });
    }
  });

  it("hides source info when source is no longer public", async () => {
    mockAuth.mockResolvedValue(mockSession("user-1") as never);
    mockItemFindUnique.mockResolvedValue(
      mockItem({
        userId: "user-1",
        forkedFromId: "source-1",
        forkedFrom: {
          id: "source-1",
          name: "Private Movie",
          isPublic: false, // Source made private
          user: { username: "creator", isPublic: true },
        },
        _count: { sourceForks: 0 },
      }) as never
    );

    const result = await getForkInfo("item-1");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data?.source).toBeNull();
    }
  });

  it("hides source info when source owner is no longer public", async () => {
    mockAuth.mockResolvedValue(mockSession("user-1") as never);
    mockItemFindUnique.mockResolvedValue(
      mockItem({
        userId: "user-1",
        forkedFromId: "source-1",
        forkedFrom: {
          id: "source-1",
          name: "Movie",
          isPublic: true,
          user: { username: "creator", isPublic: false }, // Owner made profile private
        },
        _count: { sourceForks: 0 },
      }) as never
    );

    const result = await getForkInfo("item-1");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data?.source).toBeNull();
    }
  });

  it("allows non-owner to view fork info for public item", async () => {
    mockAuth.mockResolvedValue(mockSession("viewer-1") as never);
    mockItemFindUnique.mockResolvedValue(
      mockItem({
        userId: "owner-1",
        _count: { sourceForks: 10 },
      }) as never
    );
    mockIsItemFullyPublic.mockResolvedValue(true);

    const result = await getForkInfo("item-1");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data?.forkCount).toBe(10);
    }
  });
});

describe("getItemForks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when not authenticated", async () => {
    mockAuth.mockResolvedValue(null as never);

    const result = await getItemForks("item-1");

    expect(result.error).toBe("Not authenticated");
  });

  it("returns error when item not found or not owned", async () => {
    mockAuth.mockResolvedValue(mockSession("user-1") as never);
    mockItemFindUnique.mockResolvedValue(null);

    const result = await getItemForks("item-1");

    expect(result.error).toBe("Item not found");
  });

  it("returns forks for owned item", async () => {
    mockAuth.mockResolvedValue(mockSession("owner-1") as never);
    mockItemFindUnique.mockResolvedValue({ id: "item-1" } as never);
    mockForkFindMany.mockResolvedValue([
      { id: "fork-1", userId: "user-a", createdAt: new Date("2024-01-10") },
      { id: "fork-2", userId: "user-b", createdAt: new Date("2024-01-15") },
    ] as never);

    const result = await getItemForks("item-1");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(2);
      expect(result.data?.[0].id).toBe("fork-1");
      expect(result.data?.[1].id).toBe("fork-2");
    }
  });

  it("applies limit parameter", async () => {
    mockAuth.mockResolvedValue(mockSession("owner-1") as never);
    mockItemFindUnique.mockResolvedValue({ id: "item-1" } as never);
    mockForkFindMany.mockResolvedValue([]);

    await getItemForks("item-1", 10);

    expect(mockForkFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 10,
      })
    );
  });

  it("uses default limit of 20", async () => {
    mockAuth.mockResolvedValue(mockSession("owner-1") as never);
    mockItemFindUnique.mockResolvedValue({ id: "item-1" } as never);
    mockForkFindMany.mockResolvedValue([]);

    await getItemForks("item-1");

    expect(mockForkFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 20,
      })
    );
  });

  it("orders forks by createdAt descending", async () => {
    mockAuth.mockResolvedValue(mockSession("owner-1") as never);
    mockItemFindUnique.mockResolvedValue({ id: "item-1" } as never);
    mockForkFindMany.mockResolvedValue([]);

    await getItemForks("item-1");

    expect(mockForkFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: "desc" },
      })
    );
  });

  it("verifies ownership before fetching forks", async () => {
    mockAuth.mockResolvedValue(mockSession("user-1") as never);
    mockItemFindUnique.mockResolvedValue({ id: "item-1" } as never);
    mockForkFindMany.mockResolvedValue([]);

    await getItemForks("item-1");

    expect(mockItemFindUnique).toHaveBeenCalledWith({
      where: { id: "item-1", userId: "user-1" },
      select: { id: true },
    });
  });
});
