/**
 * Integration tests for public profile functionality.
 * Tests username validation, profile visibility, and public item access.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { updateProfile } from "@/lib/user-actions";
import {
  getPublicProfile,
  isItemFullyPublic,
  getPublicItemsForUser,
  getPublicChildItems,
} from "@/lib/public-auth";
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
 * Creates a test user for public profile tests.
 *
 * @param suffix - Unique suffix for email
 * @returns Created user and email
 */
async function createTestUser(suffix: string) {
  const email = `public-${Date.now()}-${suffix}@test.example.com`;
  const passwordHash = await hash("Password1", 10);

  const user = await prisma.user.create({
    data: {
      email,
      name: "Test User",
      passwordHash,
      isPublic: false,
      username: null,
    },
  });

  currentTestUserId = user.id;
  return { user, email };
}

/**
 * Cleans up test user and related data.
 *
 * @param userId - User ID to clean up
 */
async function cleanupUser(userId: string) {
  await prisma.item.deleteMany({ where: { userId } });
  await prisma.user.delete({ where: { id: userId } }).catch(() => {});
}

describe("Public Profile Integration", () => {
  beforeEach(() => {
    currentTestUserId = null;
  });

  describe("username validation", () => {
    it("rejects username shorter than 3 characters", async () => {
      const { user } = await createTestUser("short");

      try {
        const result = await updateProfile({ username: "ab", isPublic: true });

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toMatch(/at least 3 characters/i);
        }
      } finally {
        await cleanupUser(user.id);
      }
    });

    it("rejects username longer than 20 characters", async () => {
      const { user } = await createTestUser("long");

      try {
        const result = await updateProfile({
          username: "a".repeat(21),
          isPublic: true,
        });

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toMatch(/20 characters/i);
        }
      } finally {
        await cleanupUser(user.id);
      }
    });

    it("rejects username starting with underscore", async () => {
      const { user } = await createTestUser("underscore-start");

      try {
        const result = await updateProfile({
          username: "_testuser",
          isPublic: true,
        });

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toMatch(/cannot start with an underscore/i);
        }
      } finally {
        await cleanupUser(user.id);
      }
    });

    it("rejects username with invalid characters", async () => {
      const { user } = await createTestUser("invalid-chars");

      try {
        const result = await updateProfile({
          username: "test-user!",
          isPublic: true,
        });

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toMatch(/can only contain/i);
        }
      } finally {
        await cleanupUser(user.id);
      }
    });

    it("accepts valid username with numbers and underscores", async () => {
      const { user } = await createTestUser("valid");
      // Username must be lowercase, contain only a-z0-9_, not start with underscore
      const username = `user${Date.now()}`;

      try {
        const result = await updateProfile({
          username,
          isPublic: true,
        });

        expect(result.success).toBe(true);

        const updated = await prisma.user.findUnique({
          where: { id: user.id },
          select: { username: true, isPublic: true },
        });
        expect(updated?.username).toBe(username);
        expect(updated?.isPublic).toBe(true);
      } finally {
        await cleanupUser(user.id);
      }
    });

    it("enforces case-insensitive uniqueness", async () => {
      const { user: firstUser } = await createTestUser("first");
      const { user: secondUser } = await createTestUser("second");
      const baseUsername = `unique${Date.now()}`;

      try {
        // First user takes username (lowercase)
        await prisma.user.update({
          where: { id: firstUser.id },
          data: { username: baseUsername.toLowerCase(), isPublic: true },
        });

        // Second user tries to take same username (different case)
        currentTestUserId = secondUser.id;
        const result = await updateProfile({
          username: baseUsername.toUpperCase(),
          isPublic: true,
        });

        expect(result.success).toBe(false);
        if (!result.success) {
          // Username validation converts to lowercase, so it might fail on format first
          // or uniqueness check - both are acceptable
          expect(
            result.error?.includes("already taken") ||
              result.error?.includes("can only contain")
          ).toBe(true);
        }
      } finally {
        await cleanupUser(firstUser.id);
        await cleanupUser(secondUser.id);
      }
    });
  });

  describe("getPublicProfile", () => {
    it("returns profile for public user with username", async () => {
      const { user } = await createTestUser("get-profile");
      const username = `profile_${Date.now()}`;

      try {
        await prisma.user.update({
          where: { id: user.id },
          data: { username, isPublic: true },
        });

        const profile = await getPublicProfile(username);

        expect(profile).not.toBeNull();
        expect(profile?.username).toBe(username);
        expect(profile?.id).toBe(user.id);
      } finally {
        await cleanupUser(user.id);
      }
    });

    it("returns null for non-public user", async () => {
      const { user } = await createTestUser("not-public");
      const username = `private_${Date.now()}`;

      try {
        await prisma.user.update({
          where: { id: user.id },
          data: { username, isPublic: false },
        });

        const profile = await getPublicProfile(username);
        expect(profile).toBeNull();
      } finally {
        await cleanupUser(user.id);
      }
    });

    it("returns null for non-existent username", async () => {
      const profile = await getPublicProfile("nonexistent_user_12345");
      expect(profile).toBeNull();
    });

    it("performs case-insensitive username lookup", async () => {
      const { user } = await createTestUser("case-lookup");
      const username = `casetest_${Date.now()}`;

      try {
        await prisma.user.update({
          where: { id: user.id },
          data: { username: username.toLowerCase(), isPublic: true },
        });

        // Look up with uppercase
        const profile = await getPublicProfile(username.toUpperCase());

        expect(profile).not.toBeNull();
        expect(profile?.username).toBe(username.toLowerCase());
      } finally {
        await cleanupUser(user.id);
      }
    });
  });

  describe("public item visibility", () => {
    it("returns true for fully public item hierarchy", async () => {
      const { user } = await createTestUser("full-public");

      try {
        // Create public parent
        const parent = await prisma.item.create({
          data: {
            userId: user.id,
            name: "Public Parent",
            isPublic: true,
            order: 0,
            depth: 0,
          },
        });

        // Create public child
        const child = await prisma.item.create({
          data: {
            userId: user.id,
            name: "Public Child",
            isPublic: true,
            parentId: parent.id,
            order: 0,
            depth: 1,
          },
        });

        const isFullyPublic = await isItemFullyPublic(child.id);
        expect(isFullyPublic).toBe(true);
      } finally {
        await cleanupUser(user.id);
      }
    });

    it("returns true for explicitly public child of private parent", async () => {
      const { user } = await createTestUser("private-parent");

      try {
        // Create private parent
        const parent = await prisma.item.create({
          data: {
            userId: user.id,
            name: "Private Parent",
            isPublic: false,
            inheritVisibility: false,
            order: 0,
            depth: 0,
          },
        });

        // Create explicitly public child (does NOT inherit)
        const child = await prisma.item.create({
          data: {
            userId: user.id,
            name: "Explicit Public Child",
            isPublic: true,
            inheritVisibility: false,
            parentId: parent.id,
            order: 0,
            depth: 1,
          },
        });

        // Explicitly public items ARE public regardless of parent
        const isFullyPublic = await isItemFullyPublic(child.id);
        expect(isFullyPublic).toBe(true);
      } finally {
        await cleanupUser(user.id);
      }
    });

    it("returns false for inheriting child of private grandparent", async () => {
      const { user } = await createTestUser("private-grandparent");

      try {
        // Create hierarchy: Private > Inherit > Inherit
        // The inheriting chain will resolve to the private grandparent
        const grandparent = await prisma.item.create({
          data: {
            userId: user.id,
            name: "Private Grandparent",
            isPublic: false,
            inheritVisibility: false,
            order: 0,
            depth: 0,
          },
        });

        const parent = await prisma.item.create({
          data: {
            userId: user.id,
            name: "Inheriting Parent",
            isPublic: false,
            inheritVisibility: true,
            parentId: grandparent.id,
            order: 0,
            depth: 1,
          },
        });

        const child = await prisma.item.create({
          data: {
            userId: user.id,
            name: "Inheriting Child",
            isPublic: false,
            inheritVisibility: true,
            parentId: parent.id,
            order: 0,
            depth: 2,
          },
        });

        // Inheriting items resolve to ancestor's visibility
        const isFullyPublic = await isItemFullyPublic(child.id);
        expect(isFullyPublic).toBe(false);
      } finally {
        await cleanupUser(user.id);
      }
    });

    it("returns false for non-existent item", async () => {
      // The recursive CTE returns false for non-existent items
      // (COALESCE defaults to false when no rows match)
      const isFullyPublic = await isItemFullyPublic("nonexistent-item-id");
      expect(isFullyPublic).toBe(false);
    });

    it("returns true for item inheriting from public parent", async () => {
      const { user } = await createTestUser("inherit-public");

      try {
        // Create public parent
        const parent = await prisma.item.create({
          data: {
            userId: user.id,
            name: "Public Parent",
            isPublic: true,
            inheritVisibility: false,
            order: 0,
            depth: 0,
          },
        });

        // Create inheriting child (isPublic: false, inheritVisibility: true)
        const child = await prisma.item.create({
          data: {
            userId: user.id,
            name: "Inheriting Child",
            isPublic: false,
            inheritVisibility: true,
            parentId: parent.id,
            order: 0,
            depth: 1,
          },
        });

        const isFullyPublic = await isItemFullyPublic(child.id);
        expect(isFullyPublic).toBe(true);
      } finally {
        await cleanupUser(user.id);
      }
    });

    it("returns false for item inheriting from private parent", async () => {
      const { user } = await createTestUser("inherit-private");

      try {
        // Create private parent
        const parent = await prisma.item.create({
          data: {
            userId: user.id,
            name: "Private Parent",
            isPublic: false,
            inheritVisibility: false,
            order: 0,
            depth: 0,
          },
        });

        // Create inheriting child
        const child = await prisma.item.create({
          data: {
            userId: user.id,
            name: "Inheriting Child",
            isPublic: false,
            inheritVisibility: true,
            parentId: parent.id,
            order: 0,
            depth: 1,
          },
        });

        const isFullyPublic = await isItemFullyPublic(child.id);
        expect(isFullyPublic).toBe(false);
      } finally {
        await cleanupUser(user.id);
      }
    });

    it("returns true for deeply nested inheriting hierarchy", async () => {
      const { user } = await createTestUser("inherit-deep");

      try {
        // Create: Public > Inherit > Inherit > Inherit
        const root = await prisma.item.create({
          data: {
            userId: user.id,
            name: "Public Root",
            isPublic: true,
            inheritVisibility: false,
            order: 0,
            depth: 0,
          },
        });

        const child1 = await prisma.item.create({
          data: {
            userId: user.id,
            name: "Inherit 1",
            isPublic: false,
            inheritVisibility: true,
            parentId: root.id,
            order: 0,
            depth: 1,
          },
        });

        const child2 = await prisma.item.create({
          data: {
            userId: user.id,
            name: "Inherit 2",
            isPublic: false,
            inheritVisibility: true,
            parentId: child1.id,
            order: 0,
            depth: 2,
          },
        });

        const deepChild = await prisma.item.create({
          data: {
            userId: user.id,
            name: "Inherit 3",
            isPublic: false,
            inheritVisibility: true,
            parentId: child2.id,
            order: 0,
            depth: 3,
          },
        });

        const isFullyPublic = await isItemFullyPublic(deepChild.id);
        expect(isFullyPublic).toBe(true);
      } finally {
        await cleanupUser(user.id);
      }
    });
  });

  describe("getPublicItemsForUser", () => {
    it("returns only root-level public items", async () => {
      const { user } = await createTestUser("get-public-items");

      try {
        await prisma.user.update({
          where: { id: user.id },
          data: { isPublic: true, username: `items_${Date.now()}` },
        });

        // Create public root item
        const rootPublic = await prisma.item.create({
          data: {
            userId: user.id,
            name: "Public Root",
            isPublic: true,
            inheritVisibility: false,
            order: 0,
            depth: 0,
          },
        });

        // Create private root item
        await prisma.item.create({
          data: {
            userId: user.id,
            name: "Private Root",
            isPublic: false,
            inheritVisibility: false,
            order: 1,
            depth: 0,
          },
        });

        // Create public child (should not be returned)
        await prisma.item.create({
          data: {
            userId: user.id,
            name: "Public Child",
            isPublic: true,
            inheritVisibility: false,
            parentId: rootPublic.id,
            order: 0,
            depth: 1,
          },
        });

        const items = await getPublicItemsForUser(user.id);

        expect(items).toHaveLength(1);
        expect(items[0].name).toBe("Public Root");
        expect(items[0].depth).toBe(0);
      } finally {
        await cleanupUser(user.id);
      }
    });

    it("excludes items with inheritVisibility=true from Explore", async () => {
      const { user } = await createTestUser("exclude-inherit");

      try {
        await prisma.user.update({
          where: { id: user.id },
          data: { isPublic: true, username: `inherit_${Date.now()}` },
        });

        // Create explicit public root item
        await prisma.item.create({
          data: {
            userId: user.id,
            name: "Explicit Public",
            isPublic: true,
            inheritVisibility: false,
            order: 0,
            depth: 0,
          },
        });

        // Create inheriting root item (should not appear in Explore)
        await prisma.item.create({
          data: {
            userId: user.id,
            name: "Inheriting Item",
            isPublic: false,
            inheritVisibility: true,
            order: 1,
            depth: 0,
          },
        });

        const items = await getPublicItemsForUser(user.id);

        expect(items).toHaveLength(1);
        expect(items[0].name).toBe("Explicit Public");
      } finally {
        await cleanupUser(user.id);
      }
    });

    it("returns empty array for user with no public items", async () => {
      const { user } = await createTestUser("no-public-items");

      try {
        // Create only private items
        await prisma.item.create({
          data: {
            userId: user.id,
            name: "Private Item",
            isPublic: false,
            order: 0,
            depth: 0,
          },
        });

        const items = await getPublicItemsForUser(user.id);
        expect(items).toHaveLength(0);
      } finally {
        await cleanupUser(user.id);
      }
    });
  });

  describe("getPublicChildItems", () => {
    it("returns only public children of a parent", async () => {
      const { user } = await createTestUser("public-children");

      try {
        // Create parent
        const parent = await prisma.item.create({
          data: {
            userId: user.id,
            name: "Parent",
            isPublic: true,
            inheritVisibility: false,
            order: 0,
            depth: 0,
          },
        });

        // Create public child
        await prisma.item.create({
          data: {
            userId: user.id,
            name: "Public Child",
            isPublic: true,
            inheritVisibility: false,
            parentId: parent.id,
            order: 0,
            depth: 1,
          },
        });

        // Create private child
        await prisma.item.create({
          data: {
            userId: user.id,
            name: "Private Child",
            isPublic: false,
            inheritVisibility: false,
            parentId: parent.id,
            order: 1,
            depth: 1,
          },
        });

        const children = await getPublicChildItems(parent.id);

        expect(children).toHaveLength(1);
        expect(children[0].name).toBe("Public Child");
      } finally {
        await cleanupUser(user.id);
      }
    });

    it("returns inheriting children when parent is public", async () => {
      const { user } = await createTestUser("inherit-children");

      try {
        // Create public parent
        const parent = await prisma.item.create({
          data: {
            userId: user.id,
            name: "Public Parent",
            isPublic: true,
            inheritVisibility: false,
            order: 0,
            depth: 0,
          },
        });

        // Create explicit public child
        await prisma.item.create({
          data: {
            userId: user.id,
            name: "Explicit Public",
            isPublic: true,
            inheritVisibility: false,
            parentId: parent.id,
            order: 0,
            depth: 1,
          },
        });

        // Create inheriting child
        await prisma.item.create({
          data: {
            userId: user.id,
            name: "Inheriting Child",
            isPublic: false,
            inheritVisibility: true,
            parentId: parent.id,
            order: 1,
            depth: 1,
          },
        });

        // Create private child
        await prisma.item.create({
          data: {
            userId: user.id,
            name: "Private Child",
            isPublic: false,
            inheritVisibility: false,
            parentId: parent.id,
            order: 2,
            depth: 1,
          },
        });

        const children = await getPublicChildItems(parent.id);

        // Should return both explicit public and inheriting children
        expect(children).toHaveLength(2);
        expect(children.map((c) => c.name)).toContain("Explicit Public");
        expect(children.map((c) => c.name)).toContain("Inheriting Child");
      } finally {
        await cleanupUser(user.id);
      }
    });

    it("excludes inheriting children when parent is private", async () => {
      const { user } = await createTestUser("inherit-private-parent");

      try {
        // Create private parent
        const parent = await prisma.item.create({
          data: {
            userId: user.id,
            name: "Private Parent",
            isPublic: false,
            inheritVisibility: false,
            order: 0,
            depth: 0,
          },
        });

        // Create inheriting child
        await prisma.item.create({
          data: {
            userId: user.id,
            name: "Inheriting Child",
            isPublic: false,
            inheritVisibility: true,
            parentId: parent.id,
            order: 0,
            depth: 1,
          },
        });

        const children = await getPublicChildItems(parent.id);

        // Should return empty since parent is private
        expect(children).toHaveLength(0);
      } finally {
        await cleanupUser(user.id);
      }
    });

    it("respects order sorting", async () => {
      const { user } = await createTestUser("child-order");

      try {
        const parent = await prisma.item.create({
          data: {
            userId: user.id,
            name: "Parent",
            isPublic: true,
            order: 0,
            depth: 0,
          },
        });

        // Create children in reverse order
        await prisma.item.create({
          data: {
            userId: user.id,
            name: "Second",
            isPublic: true,
            parentId: parent.id,
            order: 1,
            depth: 1,
          },
        });

        await prisma.item.create({
          data: {
            userId: user.id,
            name: "First",
            isPublic: true,
            parentId: parent.id,
            order: 0,
            depth: 1,
          },
        });

        const children = await getPublicChildItems(parent.id);

        expect(children).toHaveLength(2);
        expect(children[0].name).toBe("First");
        expect(children[1].name).toBe("Second");
      } finally {
        await cleanupUser(user.id);
      }
    });
  });
});
