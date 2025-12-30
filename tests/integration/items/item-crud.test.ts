/**
 * Integration tests for item CRUD operations.
 * Tests with real database.
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
import {
  createItem,
  getItem,
  updateItem,
  deleteItem,
} from "@/lib/item-actions";
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
// Email uses @test.example.com with unique prefix for consistency
const TEST_USER_ID = `test-items-${Date.now()}-${Math.random().toString(36).substring(7)}`;
const TEST_USER_EMAIL = `items-${Date.now()}@test.example.com`;

describe("item CRUD integration", () => {
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

  it("creates root item and retrieves it", async () => {
    const createResult = await createItem(null, "Test Folder");
    expect(createResult.success).toBe(true);
    if (!createResult.success) throw new Error("Failed to create item");
    expect(createResult.data?.name).toBe("Test Folder");

    const itemId = createResult.data!.id;

    const getResult = await getItem(itemId);
    expect(getResult.success).toBe(true);
    if (!getResult.success) throw new Error("Failed to get item");
    expect(getResult.data?.item.name).toBe("Test Folder");
    expect(getResult.data?.ancestors).toHaveLength(0);
  });

  it("creates nested items and builds ancestors", async () => {
    // Create parent
    const parentResult = await createItem(null, "Parent Folder");
    if (!parentResult.success) throw new Error("Failed to create parent");
    const parentId = parentResult.data!.id;

    // Create child
    const childResult = await createItem(parentId, "Child Folder");
    if (!childResult.success) throw new Error("Failed to create child");
    const childId = childResult.data!.id;

    // Get child with ancestors
    const getResult = await getItem(childId);
    expect(getResult.success).toBe(true);
    if (!getResult.success) throw new Error("Failed to get item");
    expect(getResult.data?.ancestors).toHaveLength(1);
    expect(getResult.data?.ancestors[0].name).toBe("Parent Folder");
  });

  it("updates item name", async () => {
    const createResult = await createItem(null, "Original Name");
    if (!createResult.success) throw new Error("Failed to create item");
    const itemId = createResult.data!.id;

    await updateItem(itemId, { name: "Updated Name" });

    const getResult = await getItem(itemId);
    if (!getResult.success) throw new Error("Failed to get item");
    expect(getResult.data?.item.name).toBe("Updated Name");
  });

  it("deletes item and cascades to children", async () => {
    // Create parent with child
    const parentResult = await createItem(null, "Parent To Delete");
    if (!parentResult.success) throw new Error("Failed to create parent");
    const parentId = parentResult.data!.id;
    const childResult = await createItem(parentId, "Child To Delete");
    if (!childResult.success) throw new Error("Failed to create child");
    const childId = childResult.data!.id;

    // Delete parent
    await deleteItem(parentId);

    // Both should be gone
    const parentGet = await getItem(parentId);
    const childGet = await getItem(childId);
    expect(parentGet.error).toBe("Item not found");
    expect(childGet.error).toBe("Item not found");
  });

  it("enforces max depth of 10 levels", { timeout: 30000 }, async () => {
    let parentId: string | null = null;

    // Create 9 levels (depth 0-8)
    for (let i = 0; i < 9; i++) {
      const result = await createItem(parentId, `Level ${i}`);
      expect(result.success).toBe(true);
      if (!result.success) throw new Error(`Failed to create level ${i}`);
      parentId = result.data!.id;
    }

    // 10th level (depth 9) should work
    const level9 = await createItem(parentId, "Level 9");
    expect(level9.success).toBe(true);
    if (!level9.success) throw new Error("Failed to create level 9");

    // 11th level (depth 10) should fail
    const level10 = await createItem(level9.data!.id, "Level 10");
    expect(level10.error).toBe("Maximum nesting depth reached");
  });
});
