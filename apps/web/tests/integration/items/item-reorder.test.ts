/**
 * Integration tests for item reordering.
 * Tests order persistence and transaction behavior.
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
import { createItem, getItems, reorderItems } from "@/lib/item-actions";
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

// Use unique ID per test run to avoid conflicts
const TEST_USER_ID = `test-reorder-${Date.now()}-${Math.random().toString(36).substring(7)}`;
const TEST_USER_EMAIL = `reorder-${Date.now()}@test.example.com`;

describe("item reorder integration", () => {
  beforeAll(async () => {
    // Create test user
    await prisma.user.create({
      data: {
        id: TEST_USER_ID,
        email: TEST_USER_EMAIL,
        passwordHash: "hashed",
      },
    });
  });

  beforeEach(() => {
    // Mock auth to return test user for each test
    mockAuth.mockResolvedValue({
      user: { id: TEST_USER_ID, email: TEST_USER_EMAIL },
      expires: new Date().toISOString(),
    });
  });

  afterAll(async () => {
    // Clean up: delete all items for test user, then delete user
    await prisma.item.deleteMany({ where: { userId: TEST_USER_ID } });
    await prisma.user.deleteMany({ where: { id: TEST_USER_ID } });
  });

  it("persists new order after reorder", async () => {
    const a = await createItem(null, "Reorder A");
    if (!a.success) throw new Error("Failed to create A");

    const b = await createItem(null, "Reorder B");
    if (!b.success) throw new Error("Failed to create B");

    const c = await createItem(null, "Reorder C");
    if (!c.success) throw new Error("Failed to create C");

    // Reverse order: C, B, A
    const reorderResult = await reorderItems([
      { id: c.data!.id, order: 0 },
      { id: b.data!.id, order: 1 },
      { id: a.data!.id, order: 2 },
    ]);
    expect(reorderResult.success).toBe(true);

    const result = await getItems(null);
    if (!result.success) throw new Error("Failed to get items");

    // Filter to just our reorder test items
    const reorderItems2 = result.data!.filter((i) =>
      i.name.startsWith("Reorder ")
    );
    const names = reorderItems2.map((i) => i.name);
    expect(names).toEqual(["Reorder C", "Reorder B", "Reorder A"]);
  });

  it("handles empty reorder array gracefully", async () => {
    const result = await reorderItems([]);
    expect(result.success).toBe(true);
  });

  it("maintains order of items within same parent", async () => {
    const parent = await createItem(null, "Reorder Parent");
    if (!parent.success) throw new Error("Failed to create parent");

    const child1 = await createItem(parent.data!.id, "Child 1");
    if (!child1.success) throw new Error("Failed to create child 1");

    const child2 = await createItem(parent.data!.id, "Child 2");
    if (!child2.success) throw new Error("Failed to create child 2");

    // Swap children
    const reorderResult = await reorderItems([
      { id: child2.data!.id, order: 0 },
      { id: child1.data!.id, order: 1 },
    ]);
    expect(reorderResult.success).toBe(true);

    const result = await getItems(parent.data!.id);
    if (!result.success) throw new Error("Failed to get items");

    const names = result.data!.map((i) => i.name);
    expect(names).toEqual(["Child 2", "Child 1"]);
  });
});
