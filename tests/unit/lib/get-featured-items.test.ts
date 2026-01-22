/**
 * Unit tests for getFeaturedItems server action.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Prisma
vi.mock("@/lib/prisma", () => ({
  prisma: {
    item: {
      findMany: vi.fn(),
    },
  },
}));

// Mock logger
vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getFeaturedItems } from "@/lib/public-auth";

describe("getFeaturedItems", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return up to 5 featured items with artwork", async () => {
    const mockItems = [
      {
        id: "item-1",
        name: "Featured Movie",
        description: "A great movie",
        userId: "user-1",
        updatedAt: new Date(),
        files: [{ id: "art-1", driveFileId: "drive-1" }],
        user: { username: "testuser", name: "Test User" },
      },
    ];

    vi.mocked(prisma.item.findMany).mockResolvedValue(mockItems as never);

    const result = await getFeaturedItems(5);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "item-1",
      name: "Featured Movie",
      artworkId: "art-1",
      ownerUsername: "testuser",
    });
  });

  it("should only include items with artwork files", async () => {
    vi.mocked(prisma.item.findMany).mockResolvedValue([]);

    await getFeaturedItems(5);

    expect(prisma.item.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          files: { some: { fileType: "ARTWORK" } },
        }),
      })
    );
  });

  it("should order by updatedAt descending", async () => {
    vi.mocked(prisma.item.findMany).mockResolvedValue([]);

    await getFeaturedItems(5);

    expect(prisma.item.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { updatedAt: "desc" },
      })
    );
  });

  it("should respect limit parameter", async () => {
    vi.mocked(prisma.item.findMany).mockResolvedValue([]);

    await getFeaturedItems(3);

    expect(prisma.item.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 3,
      })
    );
  });

  it("should filter out items with empty artwork IDs", async () => {
    const mockItems = [
      {
        id: "item-1",
        name: "Has Artwork",
        description: "Good",
        userId: "user-1",
        files: [{ id: "art-1" }],
        user: { username: "testuser", name: "Test" },
      },
      {
        id: "item-2",
        name: "No Artwork",
        description: "Bad",
        userId: "user-2",
        files: [], // Empty files array
        user: { username: "testuser2", name: "Test2" },
      },
    ];

    vi.mocked(prisma.item.findMany).mockResolvedValue(mockItems as never);

    const result = await getFeaturedItems(5);

    // Should only include items with valid artwork
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("item-1");
  });

  it("should filter out items with null username", async () => {
    const mockItems = [
      {
        id: "item-1",
        name: "Has Username",
        description: "Good",
        userId: "user-1",
        files: [{ id: "art-1" }],
        user: { username: "validuser", name: "Test" },
      },
      {
        id: "item-2",
        name: "No Username",
        description: "Bad",
        userId: "user-2",
        files: [{ id: "art-2" }],
        user: { username: null, name: "Test2" }, // Null username - should be filtered
      },
    ];

    vi.mocked(prisma.item.findMany).mockResolvedValue(mockItems as never);

    const result = await getFeaturedItems(5);

    // Should only include items with valid username
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("item-1");
    expect(result[0].ownerUsername).toBe("validuser");
  });

  it("should return empty array on database error (graceful degradation)", async () => {
    vi.mocked(prisma.item.findMany).mockRejectedValue(
      new Error("Database connection failed")
    );

    const result = await getFeaturedItems(5);

    expect(result).toEqual([]);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.any(Error), limit: 5 }),
      "Failed to fetch featured items"
    );
  });

  it("should generate correct link for each item", async () => {
    const mockItems = [
      {
        id: "item-123",
        name: "Test Item",
        description: null,
        userId: "user-1",
        files: [{ id: "art-1" }],
        user: { username: "johndoe", name: "John Doe" },
      },
    ];

    vi.mocked(prisma.item.findMany).mockResolvedValue(mockItems as never);

    const result = await getFeaturedItems(5);

    expect(result[0].link).toBe("/u/johndoe/item-123");
  });
});
