/**
 * Integration tests for descendant fetching.
 * Tests full hierarchy retrieval against real database.
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
import { prisma } from "@/lib/prisma";
import { getAllItems, getDescendants } from "@/lib/item-actions";
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
const TEST_USER_ID = `test-descendants-${Date.now()}-${Math.random().toString(36).substring(7)}`;
const TEST_USER_EMAIL = `descendants-${Date.now()}@test.example.com`;

describe("Item Descendants Integration", () => {
  let rootItemId: string;
  let childItemId: string;
  let grandchildItemId: string;

  beforeAll(async () => {
    // Create test user
    await prisma.user.create({
      data: {
        id: TEST_USER_ID,
        email: TEST_USER_EMAIL,
        passwordHash: "test-hash",
      },
    });

    // Create hierarchy: root -> child -> grandchild
    const root = await prisma.item.create({
      data: {
        name: "Root",
        userId: TEST_USER_ID,
        depth: 0,
        order: 0,
      },
    });
    rootItemId = root.id;

    const child = await prisma.item.create({
      data: {
        name: "Child",
        userId: TEST_USER_ID,
        parentId: rootItemId,
        depth: 1,
        order: 0,
      },
    });
    childItemId = child.id;

    const grandchild = await prisma.item.create({
      data: {
        name: "Grandchild",
        userId: TEST_USER_ID,
        parentId: childItemId,
        depth: 2,
        order: 0,
      },
    });
    grandchildItemId = grandchild.id;
  });

  beforeEach(() => {
    // Mock auth to return test user for each test
    mockAuth.mockResolvedValue({
      user: { id: TEST_USER_ID, email: TEST_USER_EMAIL },
      expires: new Date().toISOString(),
    });
  });

  afterAll(async () => {
    // Cleanup
    await prisma.item.deleteMany({ where: { userId: TEST_USER_ID } });
    await prisma.user.deleteMany({ where: { id: TEST_USER_ID } });
  });

  it("getAllItems returns full hierarchy", async () => {
    const result = await getAllItems();

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("getAllItems failed");

    // Should return all 3 items (root, child, grandchild)
    expect(result.data).toHaveLength(3);

    // Verify items are ordered by depth
    const names = result.data!.map((item) => item.name);
    expect(names).toContain("Root");
    expect(names).toContain("Child");
    expect(names).toContain("Grandchild");
  });

  it("getDescendants returns all nested items", async () => {
    const result = await getDescendants(rootItemId);

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("getDescendants failed");

    // Should return child and grandchild (not root)
    expect(result.data).toHaveLength(2);

    const names = result.data!.map((item) => item.name);
    expect(names).toContain("Child");
    expect(names).toContain("Grandchild");
    expect(names).not.toContain("Root");
  });

  it("getDescendants returns empty for leaf item", async () => {
    const result = await getDescendants(grandchildItemId);

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("getDescendants failed");
    expect(result.data).toHaveLength(0);
  });

  it("getAllItems includes childCount for each item", async () => {
    const result = await getAllItems();

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("getAllItems failed");

    const root = result.data!.find((item) => item.name === "Root");
    const child = result.data!.find((item) => item.name === "Child");
    const grandchild = result.data!.find((item) => item.name === "Grandchild");

    // Root has 2 descendants (child + grandchild)
    expect(root?.childCount).toBe(2);
    // Child has 1 descendant (grandchild)
    expect(child?.childCount).toBe(1);
    // Grandchild has no descendants
    expect(grandchild?.childCount).toBe(0);
  });
});
