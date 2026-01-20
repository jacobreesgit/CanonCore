/**
 * Integration tests for fork operations.
 * Tests forking public items, deduplication, and fork status tracking.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { forkItem, getForkStatus, getForkInfo } from "@/lib/fork-actions";
import "../setup";

// Mock next/headers for server action context
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue("127.0.0.1"),
  }),
}));

// Bypass rate limiting
vi.stubEnv("BYPASS_RATE_LIMIT", "true");

// Track the current test user ID for mocking auth
let currentTestUserId: string | null = null;

// Mock auth to return current test user
vi.mock("@/lib/auth", () => ({
  auth: vi
    .fn()
    .mockImplementation(() =>
      Promise.resolve(
        currentTestUserId ? { user: { id: currentTestUserId } } : null
      )
    ),
}));

/**
 * Creates a test user for fork tests.
 *
 * @param suffix - Unique suffix for email
 * @param options - Optional user configuration
 * @returns Created user and email
 */
async function createTestUser(
  suffix: string,
  options?: { isPublic?: boolean; username?: string }
) {
  const email = `fork-${Date.now()}-${suffix}@test.example.com`;
  const passwordHash = await hash("Password1", 10);

  const user = await prisma.user.create({
    data: {
      email,
      name: "Test User",
      passwordHash,
      isPublic: options?.isPublic ?? false,
      username: options?.username ?? null,
    },
  });

  return { user, email };
}

/**
 * Creates a public item owned by a user.
 *
 * @param userId - Owner user ID
 * @param name - Item name
 * @param parentId - Optional parent item ID
 * @returns Created item
 */
async function createPublicItem(
  userId: string,
  name: string,
  parentId?: string
) {
  const parent = parentId
    ? await prisma.item.findUnique({
        where: { id: parentId },
        select: { depth: true },
      })
    : null;

  return prisma.item.create({
    data: {
      userId,
      name,
      isPublic: true,
      order: 0,
      depth: parent ? parent.depth + 1 : 0,
      parentId: parentId ?? null,
    },
  });
}

/**
 * Cleans up test data for fork tests.
 *
 * @param userIds - Array of user IDs to clean up
 */
async function cleanupTestData(...userIds: string[]) {
  for (const userId of userIds) {
    await prisma.fork.deleteMany({ where: { userId } });
    await prisma.item.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  }
}

describe("Fork Integration", () => {
  beforeEach(() => {
    currentTestUserId = null;
  });

  describe("forkItem", () => {
    it("creates a copy of public item in forker library", async () => {
      const { user: owner } = await createTestUser("owner", {
        isPublic: true,
        username: `owner${Date.now()}`,
      });
      const { user: forker } = await createTestUser("forker");
      const publicItem = await createPublicItem(owner.id, "Public Movie");

      try {
        currentTestUserId = forker.id;
        const result = await forkItem(publicItem.id);

        expect("success" in result && result.success).toBe(true);
        if ("success" in result && result.success && result.data) {
          // Verify forked item exists in forker's library
          const forkedItem = await prisma.item.findUnique({
            where: { id: result.data.itemId },
          });
          expect(forkedItem).not.toBeNull();
          expect(forkedItem?.userId).toBe(forker.id);
          expect(forkedItem?.name).toBe("Public Movie");
          expect(forkedItem?.isPublic).toBe(false); // Forked items start private
          expect(forkedItem?.inheritVisibility).toBe(false); // Forked items use explicit visibility
          expect(forkedItem?.forkedFromId).toBe(publicItem.id);
        }
      } finally {
        await cleanupTestData(owner.id, forker.id);
      }
    });

    it("forks item to specified parent folder", async () => {
      const { user: owner } = await createTestUser("owner-parent", {
        isPublic: true,
        username: `ownerp${Date.now()}`,
      });
      const { user: forker } = await createTestUser("forker-parent");
      const publicItem = await createPublicItem(owner.id, "Fork Target");

      // Create a folder in forker's library
      const folder = await prisma.item.create({
        data: {
          userId: forker.id,
          name: "My Folder",
          isPublic: false,
          order: 0,
          depth: 0,
        },
      });

      try {
        currentTestUserId = forker.id;
        const result = await forkItem(publicItem.id, folder.id);

        expect("success" in result && result.success).toBe(true);
        if ("success" in result && result.success && result.data) {
          const forkedItem = await prisma.item.findUnique({
            where: { id: result.data.itemId },
          });
          expect(forkedItem?.parentId).toBe(folder.id);
          expect(forkedItem?.depth).toBe(1);
        }
      } finally {
        await cleanupTestData(owner.id, forker.id);
      }
    });

    it("prevents forking own item", async () => {
      const { user: owner } = await createTestUser("owner-own", {
        isPublic: true,
        username: `ownero${Date.now()}`,
      });
      const publicItem = await createPublicItem(owner.id, "Own Movie");

      try {
        currentTestUserId = owner.id; // Owner trying to fork own item
        const result = await forkItem(publicItem.id);

        expect("error" in result).toBe(true);
        if ("error" in result) {
          expect(result.error).toMatch(/own/i);
        }
      } finally {
        await cleanupTestData(owner.id);
      }
    });

    it("prevents duplicate forks", async () => {
      const { user: owner } = await createTestUser("owner-dup", {
        isPublic: true,
        username: `ownerd${Date.now()}`,
      });
      const { user: forker } = await createTestUser("forker-dup");
      const publicItem = await createPublicItem(owner.id, "Dup Movie");

      try {
        currentTestUserId = forker.id;

        // First fork should succeed
        const firstResult = await forkItem(publicItem.id);
        expect("success" in firstResult && firstResult.success).toBe(true);

        // Second fork should fail
        const secondResult = await forkItem(publicItem.id);
        expect("error" in secondResult).toBe(true);
        if ("error" in secondResult) {
          expect(secondResult.error).toMatch(/already/i);
        }
      } finally {
        await cleanupTestData(owner.id, forker.id);
      }
    });

    it("creates Fork record for tracking", async () => {
      const { user: owner } = await createTestUser("owner-track", {
        isPublic: true,
        username: `ownert${Date.now()}`,
      });
      const { user: forker } = await createTestUser("forker-track");
      const publicItem = await createPublicItem(owner.id, "Track Movie");

      try {
        currentTestUserId = forker.id;
        const result = await forkItem(publicItem.id);

        expect("success" in result && result.success).toBe(true);

        const fork = await prisma.fork.findFirst({
          where: {
            sourceItemId: publicItem.id,
            userId: forker.id,
          },
        });

        expect(fork).not.toBeNull();
        expect(fork?.sourceItemId).toBe(publicItem.id);
        expect(fork?.userId).toBe(forker.id);
      } finally {
        await cleanupTestData(owner.id, forker.id);
      }
    });

    it("prevents forking non-public item", async () => {
      const { user: owner } = await createTestUser("owner-private");
      const { user: forker } = await createTestUser("forker-private");

      // Create private item
      const privateItem = await prisma.item.create({
        data: {
          userId: owner.id,
          name: "Private Movie",
          isPublic: false,
          order: 0,
          depth: 0,
        },
      });

      try {
        currentTestUserId = forker.id;
        const result = await forkItem(privateItem.id);

        expect("error" in result).toBe(true);
        if ("error" in result) {
          expect(result.error).toMatch(/not publicly/i);
        }
      } finally {
        await cleanupTestData(owner.id, forker.id);
      }
    });

    it("prevents forking item that inherits from private ancestor", async () => {
      const { user: owner } = await createTestUser("owner-ancestor", {
        isPublic: true,
        username: `ownera${Date.now()}`,
      });
      const { user: forker } = await createTestUser("forker-ancestor");

      // Create: Private Parent > Inheriting Child
      const privateParent = await prisma.item.create({
        data: {
          userId: owner.id,
          name: "Private Parent",
          isPublic: false,
          inheritVisibility: false,
          order: 0,
          depth: 0,
        },
      });

      // Child inherits visibility from private parent (effectively private)
      const inheritingChild = await prisma.item.create({
        data: {
          userId: owner.id,
          name: "Inheriting Child",
          isPublic: false,
          inheritVisibility: true,
          parentId: privateParent.id,
          order: 0,
          depth: 1,
        },
      });

      try {
        currentTestUserId = forker.id;
        const result = await forkItem(inheritingChild.id);

        expect("error" in result).toBe(true);
        if ("error" in result) {
          expect(result.error).toMatch(/not publicly/i);
        }
      } finally {
        await cleanupTestData(owner.id, forker.id);
      }
    });

    it("returns error when not authenticated", async () => {
      const { user: owner } = await createTestUser("owner-unauth", {
        isPublic: true,
        username: `owneru${Date.now()}`,
      });
      const publicItem = await createPublicItem(owner.id, "Unauth Movie");

      try {
        currentTestUserId = null; // Not authenticated
        const result = await forkItem(publicItem.id);

        expect("error" in result).toBe(true);
        if ("error" in result) {
          expect(result.error).toMatch(/authenticated/i);
        }
      } finally {
        await cleanupTestData(owner.id);
      }
    });
  });

  describe("getForkStatus", () => {
    it("returns hasForked true for forked items", async () => {
      const { user: owner } = await createTestUser("owner-status-in", {
        isPublic: true,
        username: `owners${Date.now()}`,
      });
      const { user: forker } = await createTestUser("forker-status-in");
      const publicItem = await createPublicItem(owner.id, "Status Movie");

      try {
        currentTestUserId = forker.id;

        // Fork the item first
        await forkItem(publicItem.id);

        // Now check status
        const result = await getForkStatus(publicItem.id);

        expect("success" in result && result.success).toBe(true);
        if ("success" in result && result.success && result.data) {
          expect(result.data.hasForked).toBe(true);
          expect(result.data.forkedItemId).not.toBeNull();
        }
      } finally {
        await cleanupTestData(owner.id, forker.id);
      }
    });

    it("returns hasForked false for unforked items", async () => {
      const { user: owner } = await createTestUser("owner-status-out", {
        isPublic: true,
        username: `ownerso${Date.now()}`,
      });
      const { user: forker } = await createTestUser("forker-status-out");
      const publicItem = await createPublicItem(owner.id, "Unforked Movie");

      try {
        currentTestUserId = forker.id;

        // Don't fork, just check status
        const result = await getForkStatus(publicItem.id);

        expect("success" in result && result.success).toBe(true);
        if ("success" in result && result.success && result.data) {
          expect(result.data.hasForked).toBe(false);
          expect(result.data.forkedItemId).toBeNull();
        }
      } finally {
        await cleanupTestData(owner.id, forker.id);
      }
    });

    it("returns hasForked false for unauthenticated users", async () => {
      const { user: owner } = await createTestUser("owner-status-unauth", {
        isPublic: true,
        username: `ownersu${Date.now()}`,
      });
      const publicItem = await createPublicItem(owner.id, "Public Movie");

      try {
        currentTestUserId = null; // Not authenticated
        const result = await getForkStatus(publicItem.id);

        expect("success" in result && result.success).toBe(true);
        if ("success" in result && result.success && result.data) {
          expect(result.data.hasForked).toBe(false);
          expect(result.data.forkedItemId).toBeNull();
        }
      } finally {
        await cleanupTestData(owner.id);
      }
    });
  });

  describe("getForkInfo", () => {
    it("returns fork count for public items", async () => {
      const { user: owner } = await createTestUser("owner-info", {
        isPublic: true,
        username: `owneri${Date.now()}`,
      });
      const { user: forker1 } = await createTestUser("forker-info-1");
      const { user: forker2 } = await createTestUser("forker-info-2");
      const publicItem = await createPublicItem(owner.id, "Popular Movie");

      try {
        // Fork from two different users
        currentTestUserId = forker1.id;
        await forkItem(publicItem.id);

        currentTestUserId = forker2.id;
        await forkItem(publicItem.id);

        // Check fork info
        const result = await getForkInfo(publicItem.id);

        expect("success" in result && result.success).toBe(true);
        if ("success" in result && result.success && result.data) {
          expect(result.data.forkCount).toBe(2);
        }
      } finally {
        await cleanupTestData(owner.id, forker1.id, forker2.id);
      }
    });

    it("returns source info for forked items", async () => {
      const { user: owner } = await createTestUser("owner-source", {
        isPublic: true,
        username: `ownersc${Date.now()}`,
      });
      const { user: forker } = await createTestUser("forker-source");
      const publicItem = await createPublicItem(owner.id, "Source Movie");

      try {
        currentTestUserId = forker.id;
        const forkResult = await forkItem(publicItem.id);

        expect("success" in forkResult && forkResult.success).toBe(true);
        if ("success" in forkResult && forkResult.success && forkResult.data) {
          // Get fork info for the forked item
          const result = await getForkInfo(forkResult.data.itemId);

          expect("success" in result && result.success).toBe(true);
          if ("success" in result && result.success && result.data) {
            expect(result.data.source).not.toBeNull();
            expect(result.data.source?.id).toBe(publicItem.id);
            expect(result.data.source?.name).toBe("Source Movie");
          }
        }
      } finally {
        await cleanupTestData(owner.id, forker.id);
      }
    });

    it("returns null source for original items", async () => {
      const { user: owner } = await createTestUser("owner-original", {
        isPublic: true,
        username: `owneror${Date.now()}`,
      });
      const publicItem = await createPublicItem(owner.id, "Original Movie");

      try {
        currentTestUserId = owner.id;
        const result = await getForkInfo(publicItem.id);

        expect("success" in result && result.success).toBe(true);
        if ("success" in result && result.success && result.data) {
          expect(result.data.source).toBeNull();
          expect(result.data.forkCount).toBe(0);
        }
      } finally {
        await cleanupTestData(owner.id);
      }
    });

    it("returns error for non-existent item", async () => {
      const { user: forker } = await createTestUser("forker-nonexist");

      try {
        currentTestUserId = forker.id;
        const result = await getForkInfo("nonexistent-item-id");

        expect("error" in result).toBe(true);
        if ("error" in result) {
          expect(result.error).toMatch(/not found/i);
        }
      } finally {
        await cleanupTestData(forker.id);
      }
    });
  });
});
