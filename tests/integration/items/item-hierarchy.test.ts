/**
 * Integration tests for item hierarchy operations.
 * Tests ancestor chain building and cascade delete.
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
import { createItem, getItem, deleteItem } from "@/lib/item-actions";
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
const TEST_USER_ID = `test-hierarchy-${Date.now()}-${Math.random().toString(36).substring(7)}`;
const TEST_USER_EMAIL = `hierarchy-${Date.now()}@test.example.com`;

describe("item hierarchy integration", () => {
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

  it("builds correct ancestor chain for deeply nested items", async () => {
    let parentId: string | null = null;
    const names = ["Level 1", "Level 2", "Level 3"];

    for (const name of names) {
      const result = await createItem(parentId, name);
      if (!result.success) throw new Error(`Failed to create ${name}`);
      parentId = result.data!.id;
    }

    const result = await getItem(parentId!);
    if (!result.success) throw new Error("Failed to get item");
    expect(result.data?.ancestors).toHaveLength(2);
    expect(result.data?.ancestors.map((a) => a.name)).toEqual([
      "Level 1",
      "Level 2",
    ]);
  });

  it("cascade deletes all descendants", async () => {
    const parent = await createItem(null, "Parent For Cascade");
    if (!parent.success) throw new Error("Failed to create parent");

    const child = await createItem(parent.data!.id, "Child For Cascade");
    if (!child.success) throw new Error("Failed to create child");

    const grandchild = await createItem(
      child.data!.id,
      "Grandchild For Cascade"
    );
    if (!grandchild.success) throw new Error("Failed to create grandchild");

    // Delete parent
    await deleteItem(parent.data!.id);

    // Both descendants should be gone
    const childResult = await getItem(child.data!.id);
    const grandchildResult = await getItem(grandchild.data!.id);
    expect(childResult.error).toBe("Item not found");
    expect(grandchildResult.error).toBe("Item not found");
  });

  it("returns empty ancestors for root items", async () => {
    const result = await createItem(null, "Root Item");
    if (!result.success) throw new Error("Failed to create item");

    const getResult = await getItem(result.data!.id);
    if (!getResult.success) throw new Error("Failed to get item");
    expect(getResult.data?.ancestors).toHaveLength(0);
  });
});
