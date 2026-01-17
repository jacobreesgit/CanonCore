/**
 * Unit tests for item pinning server actions.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";

// Mock dependencies
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue(null),
}));

import { auth } from "@/lib/auth";
import { pinItem, unpinItem, getPinnedItems } from "@/lib/item-actions";

const mockAuth = auth as ReturnType<typeof vi.fn>;

// Helper to create mock transaction
const createMockTransaction = () => {
  const mockTx = {
    item: {
      findUnique: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
      update: vi.fn(),
    },
  };
  vi.mocked(prisma.$transaction).mockImplementation(async (fn: unknown) =>
    (fn as (tx: typeof mockTx) => Promise<unknown>)(mockTx)
  );
  return mockTx;
};

describe("pinItem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const result = await pinItem("item-1");

    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("returns error when item not found", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    const mockTx = createMockTransaction();
    mockTx.item.findUnique.mockResolvedValue(null);

    const result = await pinItem("nonexistent");

    expect(result).toEqual({ error: "Item not found" });
    // Verify correct query parameters
    expect(mockTx.item.findUnique).toHaveBeenCalledWith({
      where: { id: "nonexistent" },
      select: { userId: true, pinnedOrder: true },
    });
  });

  it("returns error when item belongs to different user", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    const mockTx = createMockTransaction();
    mockTx.item.findUnique.mockResolvedValue({
      id: "item-1",
      userId: "user-2", // Different user
      pinnedOrder: null,
    });

    const result = await pinItem("item-1");

    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("returns error when max pinned items reached", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    const mockTx = createMockTransaction();
    mockTx.item.findUnique.mockResolvedValue({
      id: "item-1",
      userId: "user-1",
      pinnedOrder: null,
    });
    mockTx.item.count.mockResolvedValue(10);

    const result = await pinItem("item-1");

    expect(result).toEqual({ error: "Maximum of 10 pinned items reached" });
    // Verify count query filters by userId and pinnedOrder
    expect(mockTx.item.count).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        pinnedOrder: { not: null },
      },
    });
  });

  it("pins item with next order value", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    const mockTx = createMockTransaction();
    mockTx.item.findUnique.mockResolvedValue({
      id: "item-1",
      userId: "user-1",
      pinnedOrder: null,
    });
    mockTx.item.count.mockResolvedValue(2);
    mockTx.item.aggregate.mockResolvedValue({
      _max: { pinnedOrder: 1 },
    });
    mockTx.item.update.mockResolvedValue({});

    const result = await pinItem("item-1");

    expect(result).toEqual({ success: true });
    expect(mockTx.item.update).toHaveBeenCalledWith({
      where: { id: "item-1" },
      data: { pinnedOrder: 2 },
    });
  });

  it("pins first item with order 0", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    const mockTx = createMockTransaction();
    mockTx.item.findUnique.mockResolvedValue({
      id: "item-1",
      userId: "user-1",
      pinnedOrder: null,
    });
    mockTx.item.count.mockResolvedValue(0);
    mockTx.item.aggregate.mockResolvedValue({
      _max: { pinnedOrder: null },
    });
    mockTx.item.update.mockResolvedValue({});

    const result = await pinItem("item-1");

    expect(result).toEqual({ success: true });
    expect(mockTx.item.update).toHaveBeenCalledWith({
      where: { id: "item-1" },
      data: { pinnedOrder: 0 },
    });
  });

  it("returns success without update if already pinned", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    const mockTx = createMockTransaction();
    mockTx.item.findUnique.mockResolvedValue({
      id: "item-1",
      userId: "user-1",
      pinnedOrder: 5, // Already pinned
    });

    const result = await pinItem("item-1");

    expect(result).toEqual({ success: true });
    expect(mockTx.item.count).not.toHaveBeenCalled();
    expect(mockTx.item.update).not.toHaveBeenCalled();
  });
});

describe("unpinItem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const result = await unpinItem("item-1");

    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("returns error when item not found", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    vi.mocked(prisma.item.findUnique).mockResolvedValue(null);

    const result = await unpinItem("nonexistent");

    expect(result).toEqual({ error: "Item not found" });
  });

  it("returns error when item belongs to different user", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    vi.mocked(prisma.item.findUnique).mockResolvedValue({
      id: "item-1",
      userId: "user-2",
      pinnedOrder: 0,
    } as never);

    const result = await unpinItem("item-1");

    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("unpins item by setting pinnedOrder to null", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    vi.mocked(prisma.item.findUnique).mockResolvedValue({
      id: "item-1",
      userId: "user-1",
      pinnedOrder: 0,
    } as never);
    vi.mocked(prisma.item.update).mockResolvedValue({} as never);

    const result = await unpinItem("item-1");

    expect(result).toEqual({ success: true });
    expect(prisma.item.update).toHaveBeenCalledWith({
      where: { id: "item-1" },
      data: { pinnedOrder: null },
    });
  });

  it("returns success without update if already unpinned", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    vi.mocked(prisma.item.findUnique).mockResolvedValue({
      id: "item-1",
      userId: "user-1",
      pinnedOrder: null, // Already unpinned
    } as never);

    const result = await unpinItem("item-1");

    expect(result).toEqual({ success: true });
    expect(prisma.item.update).not.toHaveBeenCalled();
  });
});

describe("getPinnedItems", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const result = await getPinnedItems();

    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("returns empty array when no pinned items", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    vi.mocked(prisma.item.findMany).mockResolvedValue([]);

    const result = await getPinnedItems();

    expect(result).toEqual({
      success: true,
      data: [],
    });
  });

  it("returns pinned items sorted by pinnedOrder", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    vi.mocked(prisma.item.findMany).mockResolvedValue([
      { id: "item-1", name: "Movies", pinnedOrder: 0 },
      { id: "item-2", name: "TV Shows", pinnedOrder: 1 },
    ] as never);

    const result = await getPinnedItems();

    expect(result).toEqual({
      success: true,
      data: [
        { id: "item-1", name: "Movies", pinnedOrder: 0 },
        { id: "item-2", name: "TV Shows", pinnedOrder: 1 },
      ],
    });

    // Verify query parameters
    expect(prisma.item.findMany).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        pinnedOrder: { not: null },
      },
      orderBy: { pinnedOrder: "asc" },
      select: {
        id: true,
        name: true,
        pinnedOrder: true,
      },
    });
  });
});
