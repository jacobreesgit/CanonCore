/**
 * Integration tests for getFeaturedItems with real database.
 */

import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { getFeaturedItems } from "@/lib/public-auth";
import "../setup";

// Mock next/headers for server action context
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue("127.0.0.1"),
  }),
}));

// Mock auth (required for "use server" module resolution)
vi.mock("@/lib/auth", () => ({
  auth: vi.fn().mockImplementation(() => Promise.resolve(null)),
}));

// Bypass rate limiting
vi.stubEnv("BYPASS_RATE_LIMIT", "true");

describe("getFeaturedItems integration", () => {
  let testUserId: string;
  let testItemId: string;

  beforeAll(async () => {
    // Create test user with public profile
    const user = await prisma.user.create({
      data: {
        email: `featured-test-${Date.now()}@test.com`,
        passwordHash: "hashedpassword",
        name: "Featured Test User",
        username: `featuredtest${Date.now()}`,
        isPublic: true,
      },
    });
    testUserId = user.id;

    // Create public item with artwork
    const item = await prisma.item.create({
      data: {
        name: "Featured Test Item",
        description: "Test description",
        userId: testUserId,
        isPublic: true,
        inheritVisibility: false,
        files: {
          create: {
            filename: "poster.jpg",
            fileType: "ARTWORK",
            driveFileId: "test-drive-id",
          },
        },
      },
    });
    testItemId = item.id;
  });

  afterAll(async () => {
    await prisma.itemFile.deleteMany({
      where: { item: { userId: testUserId } },
    });
    await prisma.item.deleteMany({ where: { userId: testUserId } });
    await prisma.user.delete({ where: { id: testUserId } });
  });

  it("should return featured items from database", async () => {
    const result = await getFeaturedItems(5);

    const testItem = result.find((item) => item.id === testItemId);
    expect(testItem).toBeDefined();
    expect(testItem?.name).toBe("Featured Test Item");
    expect(testItem?.artworkId).toBeDefined();
  });

  it("should respect limit parameter", async () => {
    const result = await getFeaturedItems(1);
    expect(result.length).toBeLessThanOrEqual(1);
  });
});
