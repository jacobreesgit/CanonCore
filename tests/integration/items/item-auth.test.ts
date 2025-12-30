/**
 * Integration tests for item authorization.
 * Tests cross-user access denial.
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
  reorderItems,
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

// Use unique IDs per test run to avoid conflicts
const USER_1_ID = `test-auth1-${Date.now()}-${Math.random().toString(36).substring(7)}`;
const USER_1_EMAIL = `auth1-${Date.now()}@test.example.com`;
const USER_2_ID = `test-auth2-${Date.now()}-${Math.random().toString(36).substring(7)}`;
const USER_2_EMAIL = `auth2-${Date.now()}@test.example.com`;

describe("item auth integration", () => {
  let user1ItemId: string;

  beforeAll(async () => {
    // Create both test users
    await prisma.user.createMany({
      data: [
        {
          id: USER_1_ID,
          email: USER_1_EMAIL,
          passwordHash: "hashed",
        },
        {
          id: USER_2_ID,
          email: USER_2_EMAIL,
          passwordHash: "hashed",
        },
      ],
    });

    // Create item as user 1
    mockAuth.mockResolvedValue({
      user: { id: USER_1_ID, email: USER_1_EMAIL },
      expires: new Date().toISOString(),
    });
    const result = await createItem(null, "User 1 Secret Item");
    if (!result.success) throw new Error("Failed to create item");
    user1ItemId = result.data!.id;
  });

  beforeEach(() => {
    // Reset mock before each test
    vi.clearAllMocks();
  });

  afterAll(async () => {
    // Clean up: delete all items for test users, then delete users
    await prisma.item.deleteMany({
      where: { userId: { in: [USER_1_ID, USER_2_ID] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [USER_1_ID, USER_2_ID] } },
    });
  });

  it("denies getItem access to other user items", async () => {
    // Switch to user 2
    mockAuth.mockResolvedValue({
      user: { id: USER_2_ID, email: USER_2_EMAIL },
      expires: new Date().toISOString(),
    });

    const result = await getItem(user1ItemId);
    expect(result.error).toBe("Unauthorized");
  });

  it("denies updateItem access to other user items", async () => {
    // Switch to user 2
    mockAuth.mockResolvedValue({
      user: { id: USER_2_ID, email: USER_2_EMAIL },
      expires: new Date().toISOString(),
    });

    const result = await updateItem(user1ItemId, { name: "Hacked Name" });
    expect(result.error).toBe("Unauthorized");
  });

  it("denies deleteItem access to other user items", async () => {
    // Switch to user 2
    mockAuth.mockResolvedValue({
      user: { id: USER_2_ID, email: USER_2_EMAIL },
      expires: new Date().toISOString(),
    });

    const result = await deleteItem(user1ItemId);
    expect(result.error).toBe("Unauthorized");
  });

  it("denies reorderItems access to other user items", async () => {
    // Switch to user 2
    mockAuth.mockResolvedValue({
      user: { id: USER_2_ID, email: USER_2_EMAIL },
      expires: new Date().toISOString(),
    });

    const result = await reorderItems([{ id: user1ItemId, order: 99 }]);
    expect(result.error).toBe("Unauthorized");
  });

  it("allows owner to access their own items", async () => {
    // User 1 should be able to access their item
    mockAuth.mockResolvedValue({
      user: { id: USER_1_ID, email: USER_1_EMAIL },
      expires: new Date().toISOString(),
    });

    const result = await getItem(user1ItemId);
    expect(result.success).toBe(true);
    if (!result.success) throw new Error("Failed to get item");
    expect(result.data?.item.name).toBe("User 1 Secret Item");
  });
});
