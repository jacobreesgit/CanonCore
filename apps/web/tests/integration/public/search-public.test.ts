/**
 * Integration tests for public search server actions.
 * Tests visibility logic with real database.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { searchPublicUsers, searchPublicItems } from "@/lib/public-auth";
import "../setup";

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue("127.0.0.1"),
  }),
}));

vi.stubEnv("BYPASS_RATE_LIMIT", "true");

let currentTestUserId: string | null = null;

vi.mock("@/lib/auth", () => ({
  auth: vi
    .fn()
    .mockImplementation(() =>
      Promise.resolve(
        currentTestUserId ? { user: { id: currentTestUserId } } : null
      )
    ),
}));

async function createTestUser(
  suffix: string,
  options: { isPublic?: boolean; username?: string | null } = {}
) {
  const email = `search-${Date.now()}-${suffix}@test.example.com`;
  const passwordHash = await hash("Password1", 10);

  return prisma.user.create({
    data: {
      email,
      name: `Test User ${suffix}`,
      passwordHash,
      isPublic: options.isPublic ?? false,
      username: options.username ?? null,
    },
  });
}

async function createTestItem(
  userId: string,
  name: string,
  options: { isPublic?: boolean; inheritVisibility?: boolean } = {}
) {
  return prisma.item.create({
    data: {
      userId,
      name,
      isPublic: options.isPublic ?? false,
      inheritVisibility: options.inheritVisibility ?? false,
      order: 0,
      depth: 0,
    },
  });
}

async function cleanupUser(userId: string) {
  await prisma.item.deleteMany({ where: { userId } });
  await prisma.user.delete({ where: { id: userId } }).catch(() => {});
}

describe("searchPublicUsers Integration", () => {
  const createdUserIds: string[] = [];

  afterEach(async () => {
    for (const id of createdUserIds) {
      await cleanupUser(id);
    }
    createdUserIds.length = 0;
    currentTestUserId = null;
  });

  it("returns public users with usernames", async () => {
    const searcher = await createTestUser("searcher");
    createdUserIds.push(searcher.id);
    currentTestUserId = searcher.id;

    const publicUser = await createTestUser("public", {
      isPublic: true,
      username: `public_${Date.now()}`,
    });
    createdUserIds.push(publicUser.id);

    const result = await searchPublicUsers();

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("Expected success");
    const found = result.data!.find(
      (u: { id: string }) => u.id === publicUser.id
    );
    expect(found).toBeDefined();
    expect(found?.username).toBe(publicUser.username);
  });

  it("excludes current user from results", async () => {
    const searcher = await createTestUser("self-searcher", {
      isPublic: true,
      username: `self_${Date.now()}`,
    });
    createdUserIds.push(searcher.id);
    currentTestUserId = searcher.id;

    const result = await searchPublicUsers();

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("Expected success");
    expect(
      result.data!.find((u: { id: string }) => u.id === searcher.id)
    ).toBeUndefined();
  });
});

describe("searchPublicItems Integration", () => {
  const createdUserIds: string[] = [];

  afterEach(async () => {
    for (const id of createdUserIds) {
      await cleanupUser(id);
    }
    createdUserIds.length = 0;
    currentTestUserId = null;
  });

  it("returns explicitly public items", async () => {
    const searcher = await createTestUser("searcher");
    createdUserIds.push(searcher.id);
    currentTestUserId = searcher.id;

    const publicUser = await createTestUser("public-owner", {
      isPublic: true,
      username: `owner_${Date.now()}`,
    });
    createdUserIds.push(publicUser.id);

    const publicItem = await createTestItem(
      publicUser.id,
      "Explicit Public Item",
      {
        isPublic: true,
        inheritVisibility: false,
      }
    );

    const result = await searchPublicItems();

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("Expected success");
    const found = result.data!.find(
      (i: { id: string }) => i.id === publicItem.id
    );
    expect(found).toBeDefined();
    expect(found?.name).toBe("Explicit Public Item");
    expect(found?.ownerUsername).toBe(publicUser.username);
  });

  it("excludes items with inheritVisibility=true", async () => {
    const searcher = await createTestUser("searcher2");
    createdUserIds.push(searcher.id);
    currentTestUserId = searcher.id;

    const publicUser = await createTestUser("public-owner2", {
      isPublic: true,
      username: `owner2_${Date.now()}`,
    });
    createdUserIds.push(publicUser.id);

    // Create inheriting item - should NOT appear in search
    const inheritingItem = await createTestItem(
      publicUser.id,
      "Inheriting Item",
      {
        isPublic: false,
        inheritVisibility: true,
      }
    );

    const result = await searchPublicItems();

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("Expected success");
    expect(
      result.data!.find((i: { id: string }) => i.id === inheritingItem.id)
    ).toBeUndefined();
  });

  it("excludes private items", async () => {
    const searcher = await createTestUser("searcher3");
    createdUserIds.push(searcher.id);
    currentTestUserId = searcher.id;

    const publicUser = await createTestUser("public-owner3", {
      isPublic: true,
      username: `owner3_${Date.now()}`,
    });
    createdUserIds.push(publicUser.id);

    const privateItem = await createTestItem(publicUser.id, "Private Item", {
      isPublic: false,
      inheritVisibility: false,
    });

    const result = await searchPublicItems();

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("Expected success");
    expect(
      result.data!.find((i: { id: string }) => i.id === privateItem.id)
    ).toBeUndefined();
  });

  it("excludes current user's public items", async () => {
    const searcher = await createTestUser("searcher4", {
      isPublic: true,
      username: `searcher4_${Date.now()}`,
    });
    createdUserIds.push(searcher.id);
    currentTestUserId = searcher.id;

    const ownItem = await createTestItem(searcher.id, "Own Public Item", {
      isPublic: true,
      inheritVisibility: false,
    });

    const result = await searchPublicItems();

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("Expected success");
    expect(
      result.data!.find((i: { id: string }) => i.id === ownItem.id)
    ).toBeUndefined();
  });

  it("excludes items from private users", async () => {
    const searcher = await createTestUser("searcher5");
    createdUserIds.push(searcher.id);
    currentTestUserId = searcher.id;

    const privateUser = await createTestUser("private-owner", {
      isPublic: false,
      username: `private_${Date.now()}`,
    });
    createdUserIds.push(privateUser.id);

    const itemFromPrivateUser = await createTestItem(
      privateUser.id,
      "Item From Private User",
      {
        isPublic: true,
        inheritVisibility: false,
      }
    );

    const result = await searchPublicItems();

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("Expected success");
    expect(
      result.data!.find((i: { id: string }) => i.id === itemFromPrivateUser.id)
    ).toBeUndefined();
  });
});
