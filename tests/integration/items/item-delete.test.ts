/**
 * Integration tests for item deletion.
 * Tests authorization, cascade deletion, and error handling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Session } from "next-auth";
import { deleteItem } from "@/lib/item-actions";
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

describe("deleteItem integration", () => {
  let testUserId: string;

  // Use beforeEach/afterEach for proper test isolation
  beforeEach(async () => {
    // Create fresh test user for each test
    const user = await prisma.user.create({
      data: {
        email: `delete-test-${Date.now()}-${Math.random().toString(36).slice(2)}@test.example.com`,
        passwordHash: "hashedpassword123",
      },
    });
    testUserId = user.id;
  });

  afterEach(async () => {
    // Cleanup - delete items first (cascade), then user
    await prisma.item.deleteMany({ where: { userId: testUserId } });
    await prisma.user.delete({ where: { id: testUserId } }).catch(() => {
      // User may already be deleted
    });
  });

  it("deletes item when authorized", async () => {
    const item = await prisma.item.create({
      data: {
        name: "Item to Delete",
        userId: testUserId,
        order: 0,
        depth: 0,
      },
    });

    mockAuth.mockResolvedValue({
      user: { id: testUserId, email: "test@test.example.com" },
      expires: new Date().toISOString(),
    });

    const result = await deleteItem(item.id);

    expect(result.success).toBe(true);

    const deletedItem = await prisma.item.findUnique({
      where: { id: item.id },
    });
    expect(deletedItem).toBeNull();
  });

  it("returns error when item not found", async () => {
    mockAuth.mockResolvedValue({
      user: { id: testUserId, email: "test@test.example.com" },
      expires: new Date().toISOString(),
    });

    const result = await deleteItem("non-existent-id");

    expect(result.success).toBeFalsy();
    expect(result.error).toBe("Item not found");
  });

  it("returns error when not authenticated", async () => {
    const item = await prisma.item.create({
      data: {
        name: "Protected Item",
        userId: testUserId,
        order: 0,
        depth: 0,
      },
    });

    mockAuth.mockResolvedValue(null);

    const result = await deleteItem(item.id);

    expect(result.success).toBeFalsy();
    expect(result.error).toBe("Unauthorized");
  });

  it("returns error when user doesn't own item", async () => {
    // Create item owned by test user
    const item = await prisma.item.create({
      data: {
        name: "Other User Item",
        userId: testUserId,
        order: 0,
        depth: 0,
      },
    });

    // Authenticate as different user
    mockAuth.mockResolvedValue({
      user: { id: "different-user-id", email: "other@test.example.com" },
      expires: new Date().toISOString(),
    });

    const result = await deleteItem(item.id);

    expect(result.success).toBeFalsy();
    // Returns "Unauthorized" for ownership mismatch (not "Item not found")
    expect(result.error).toBe("Unauthorized");
  });

  it("cascades delete to child items", async () => {
    mockAuth.mockResolvedValue({
      user: { id: testUserId, email: "test@test.example.com" },
      expires: new Date().toISOString(),
    });

    const parent = await prisma.item.create({
      data: {
        name: "Parent Item",
        userId: testUserId,
        order: 0,
        depth: 0,
      },
    });

    const child = await prisma.item.create({
      data: {
        name: "Child Item",
        userId: testUserId,
        parentId: parent.id,
        order: 0,
        depth: 1,
      },
    });

    const grandchild = await prisma.item.create({
      data: {
        name: "Grandchild Item",
        userId: testUserId,
        parentId: child.id,
        order: 0,
        depth: 2,
      },
    });

    const result = await deleteItem(parent.id);

    expect(result.success).toBe(true);

    // Verify cascade deletion
    const deletedChild = await prisma.item.findUnique({
      where: { id: child.id },
    });
    const deletedGrandchild = await prisma.item.findUnique({
      where: { id: grandchild.id },
    });
    expect(deletedChild).toBeNull();
    expect(deletedGrandchild).toBeNull();
  });
});
