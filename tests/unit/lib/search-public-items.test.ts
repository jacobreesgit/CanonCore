/**
 * Unit tests for searchPublicItems server action.
 * Tests visibility logic: only explicitly public items appear in search.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import "../setup";

// Mock dependencies - include all Prisma methods that might be used
vi.mock("@/lib/prisma", () => ({
  prisma: {
    item: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
    },
  },
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: "user-1" } }),
}));

import { searchPublicItems } from "@/lib/public-auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { auth } from "@/lib/auth";

describe("searchPublicItems", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as never);
    vi.mocked(checkRateLimit).mockResolvedValue(null);
  });

  it("returns explicitly public items from other users", async () => {
    vi.mocked(prisma.item.findMany).mockResolvedValue([
      {
        id: "item-1",
        name: "Star Wars Collection",
        description: "Original trilogy",
        files: [{ id: "artwork-1" }],
        user: { username: "johndoe", name: "John Doe" },
      },
    ] as never);

    const result = await searchPublicItems();

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("Expected success");
    expect(result.data!).toHaveLength(1);
    expect(result.data![0].name).toBe("Star Wars Collection");
    expect(result.data![0].ownerUsername).toBe("johndoe");
    expect(result.data![0].artworkId).toBe("artwork-1");
  });

  it("excludes current user's items", async () => {
    vi.mocked(prisma.item.findMany).mockResolvedValue([]);

    await searchPublicItems();

    expect(prisma.item.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: { not: "user-1" },
        }),
      })
    );
  });

  it("only queries explicitly public items (isPublic=true, inheritVisibility=false)", async () => {
    vi.mocked(prisma.item.findMany).mockResolvedValue([]);

    await searchPublicItems();

    expect(prisma.item.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isPublic: true,
          inheritVisibility: false,
        }),
      })
    );
  });

  it("only includes items from public users with usernames", async () => {
    vi.mocked(prisma.item.findMany).mockResolvedValue([]);

    await searchPublicItems();

    expect(prisma.item.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          user: {
            isPublic: true,
            username: { not: null },
          },
        }),
      })
    );
  });

  it("returns results without user exclusion when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    vi.mocked(prisma.item.findMany).mockResolvedValue([
      {
        id: "item-1",
        name: "Public Collection",
        description: "Description",
        files: [],
        user: { username: "johndoe", name: "John Doe" },
      },
    ] as never);

    const result = await searchPublicItems();

    // Should succeed for unauthenticated users
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(1);
    }

    // Verify query does not exclude any user's items when not authenticated
    expect(prisma.item.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.not.objectContaining({
          userId: expect.anything(),
        }),
      })
    );
  });

  it("returns error when rate limited", async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({
      error: "Too many attempts",
    });

    const result = await searchPublicItems();

    expect(result.success).toBeUndefined();
    expect(result.error).toBe("Too many attempts");
  });

  it("limits results to 100 items", async () => {
    vi.mocked(prisma.item.findMany).mockResolvedValue([]);

    await searchPublicItems();

    expect(prisma.item.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 100,
      })
    );
  });

  it("returns null artworkId when no artwork files", async () => {
    vi.mocked(prisma.item.findMany).mockResolvedValue([
      {
        id: "item-1",
        name: "No Artwork Item",
        description: null,
        files: [],
        user: { username: "johndoe", name: "John Doe" },
      },
    ] as never);

    const result = await searchPublicItems();

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("Expected success");
    expect(result.data![0].artworkId).toBeNull();
  });

  it("returns error when Prisma throws", async () => {
    vi.mocked(prisma.item.findMany).mockRejectedValue(new Error("DB error"));

    const result = await searchPublicItems();

    expect(result.success).toBeUndefined();
    expect(result.error).toBe("Failed to search public items");
  });
});
