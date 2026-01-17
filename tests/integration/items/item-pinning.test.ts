/**
 * Integration tests for item pinning with real database.
 */

import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  afterAll,
  beforeEach,
} from "vitest";
import type { Session } from "next-auth";
import { pinItem, unpinItem, getPinnedItems } from "@/lib/item-actions";
import { prisma } from "@/lib/prisma";
import "../setup";

// Mock auth to return our test user
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

import { auth } from "@/lib/auth";

// Cast to bypass complex next-auth types
const mockAuth = auth as unknown as ReturnType<
  typeof vi.fn<() => Promise<Session | null>>
>;

// Use unique IDs per test run to avoid conflicts
const USER_ID = `test-pin-${Date.now()}-${Math.random().toString(36).substring(7)}`;
const USER_EMAIL = `pin-${Date.now()}@test.example.com`;
const USER_2_ID = `test-pin2-${Date.now()}-${Math.random().toString(36).substring(7)}`;
const USER_2_EMAIL = `pin2-${Date.now()}@test.example.com`;

describe("item pinning integration", () => {
  beforeAll(async () => {
    // Create test users
    await prisma.user.createMany({
      data: [
        {
          id: USER_ID,
          email: USER_EMAIL,
          passwordHash: "hashed",
        },
        {
          id: USER_2_ID,
          email: USER_2_EMAIL,
          passwordHash: "hashed",
        },
      ],
    });
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    // Clear items between tests
    await prisma.item.deleteMany({
      where: { userId: { in: [USER_ID, USER_2_ID] } },
    });
    // Set up default mock auth
    mockAuth.mockResolvedValue({
      user: { id: USER_ID, email: USER_EMAIL },
      expires: new Date().toISOString(),
    });
  });

  afterAll(async () => {
    // Clean up: delete all items for test users, then delete users
    await prisma.item.deleteMany({
      where: { userId: { in: [USER_ID, USER_2_ID] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [USER_ID, USER_2_ID] } },
    });
  });

  it("pins item and retrieves in getPinnedItems", async () => {
    // Create item
    const item = await prisma.item.create({
      data: { name: "Movies", userId: USER_ID, order: 0, depth: 0 },
    });

    // Pin it
    const pinResult = await pinItem(item.id);
    expect(pinResult).toEqual({ success: true });

    // Verify it's in getPinnedItems
    const pinnedResult = await getPinnedItems();
    if (!pinnedResult.success) throw new Error("Failed to get pinned items");
    const pinned = pinnedResult.data!;
    expect(pinned).toHaveLength(1);
    expect(pinned[0].name).toBe("Movies");
    expect(pinned[0].pinnedOrder).toBe(0);
  });

  it("pins multiple items with incrementing order", async () => {
    // Create items
    const item1 = await prisma.item.create({
      data: { name: "Movies", userId: USER_ID, order: 0, depth: 0 },
    });
    const item2 = await prisma.item.create({
      data: { name: "TV Shows", userId: USER_ID, order: 1, depth: 0 },
    });
    const item3 = await prisma.item.create({
      data: { name: "Music", userId: USER_ID, order: 2, depth: 0 },
    });

    // Pin them in order
    await pinItem(item1.id);
    await pinItem(item2.id);
    await pinItem(item3.id);

    // Verify order
    const pinnedResult = await getPinnedItems();
    if (!pinnedResult.success) throw new Error("Failed to get pinned items");
    const pinned = pinnedResult.data!;
    expect(pinned).toHaveLength(3);
    expect(pinned[0].name).toBe("Movies");
    expect(pinned[0].pinnedOrder).toBe(0);
    expect(pinned[1].name).toBe("TV Shows");
    expect(pinned[1].pinnedOrder).toBe(1);
    expect(pinned[2].name).toBe("Music");
    expect(pinned[2].pinnedOrder).toBe(2);
  });

  it("respects max 10 pinned items limit", async () => {
    // Create 11 items
    const items = await Promise.all(
      Array.from({ length: 11 }, (_, i) =>
        prisma.item.create({
          data: { name: `Item ${i}`, userId: USER_ID, order: i, depth: 0 },
        })
      )
    );

    // Pin first 10 items
    for (let i = 0; i < 10; i++) {
      const result = await pinItem(items[i].id);
      expect(result).toEqual({ success: true });
    }

    // 11th should fail
    const result = await pinItem(items[10].id);
    expect(result).toEqual({ error: "Maximum of 10 pinned items reached" });

    // Verify only 10 are pinned
    const pinnedResult = await getPinnedItems();
    if (!pinnedResult.success) throw new Error("Failed to get pinned items");
    expect(pinnedResult.data).toHaveLength(10);
  });

  it("unpins item by setting pinnedOrder to null", async () => {
    const item = await prisma.item.create({
      data: {
        name: "TV Shows",
        userId: USER_ID,
        order: 0,
        depth: 0,
        pinnedOrder: 0,
      },
    });

    const result = await unpinItem(item.id);
    expect(result).toEqual({ success: true });

    const updated = await prisma.item.findUnique({ where: { id: item.id } });
    expect(updated?.pinnedOrder).toBeNull();
  });

  it("maintains pinnedOrder when item is deleted", async () => {
    // Create 3 pinned items
    const items = await Promise.all([
      prisma.item.create({
        data: {
          name: "A",
          userId: USER_ID,
          order: 0,
          depth: 0,
          pinnedOrder: 0,
        },
      }),
      prisma.item.create({
        data: {
          name: "B",
          userId: USER_ID,
          order: 1,
          depth: 0,
          pinnedOrder: 1,
        },
      }),
      prisma.item.create({
        data: {
          name: "C",
          userId: USER_ID,
          order: 2,
          depth: 0,
          pinnedOrder: 2,
        },
      }),
    ]);

    // Delete middle item
    await prisma.item.delete({ where: { id: items[1].id } });

    // Remaining items still have their orders (no re-ordering)
    const remaining = await prisma.item.findMany({
      where: { userId: USER_ID, pinnedOrder: { not: null } },
      orderBy: { pinnedOrder: "asc" },
    });

    expect(remaining).toHaveLength(2);
    expect(remaining[0].pinnedOrder).toBe(0);
    expect(remaining[1].pinnedOrder).toBe(2);
  });

  it("denies pin access to other user items", async () => {
    // Create item as user 1
    const item = await prisma.item.create({
      data: { name: "User 1 Item", userId: USER_ID, order: 0, depth: 0 },
    });

    // Switch to user 2
    mockAuth.mockResolvedValue({
      user: { id: USER_2_ID, email: USER_2_EMAIL },
      expires: new Date().toISOString(),
    });

    const result = await pinItem(item.id);
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("denies unpin access to other user items", async () => {
    // Create pinned item as user 1
    const item = await prisma.item.create({
      data: {
        name: "User 1 Item",
        userId: USER_ID,
        order: 0,
        depth: 0,
        pinnedOrder: 0,
      },
    });

    // Switch to user 2
    mockAuth.mockResolvedValue({
      user: { id: USER_2_ID, email: USER_2_EMAIL },
      expires: new Date().toISOString(),
    });

    const result = await unpinItem(item.id);
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("returns only current user pinned items", async () => {
    // Create pinned items for both users
    await prisma.item.create({
      data: {
        name: "User 1 Movies",
        userId: USER_ID,
        order: 0,
        depth: 0,
        pinnedOrder: 0,
      },
    });
    await prisma.item.create({
      data: {
        name: "User 2 Movies",
        userId: USER_2_ID,
        order: 0,
        depth: 0,
        pinnedOrder: 0,
      },
    });

    // Get pinned items as user 1
    const pinnedResult = await getPinnedItems();
    if (!pinnedResult.success) throw new Error("Failed to get pinned items");
    const pinned = pinnedResult.data!;
    expect(pinned).toHaveLength(1);
    expect(pinned[0].name).toBe("User 1 Movies");
  });

  it("pinning already pinned item is a no-op", async () => {
    const item = await prisma.item.create({
      data: {
        name: "Already Pinned",
        userId: USER_ID,
        order: 0,
        depth: 0,
        pinnedOrder: 5,
      },
    });

    const result = await pinItem(item.id);
    expect(result).toEqual({ success: true });

    // Verify pinnedOrder unchanged
    const updated = await prisma.item.findUnique({ where: { id: item.id } });
    expect(updated?.pinnedOrder).toBe(5);
  });

  it("unpinning already unpinned item is a no-op", async () => {
    const item = await prisma.item.create({
      data: {
        name: "Not Pinned",
        userId: USER_ID,
        order: 0,
        depth: 0,
        pinnedOrder: null,
      },
    });

    const result = await unpinItem(item.id);
    expect(result).toEqual({ success: true });
  });
});
