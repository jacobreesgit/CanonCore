/**
 * Unit tests for searchPublicUsers server action.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import "../setup";

// Mock dependencies - include all Prisma methods that might be used
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
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

import { searchPublicUsers } from "@/lib/public-auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { auth } from "@/lib/auth";

describe("searchPublicUsers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as never);
    vi.mocked(checkRateLimit).mockResolvedValue(null);
  });

  it("returns public users with username", async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      {
        id: "user-2",
        username: "johndoe",
        name: "John Doe",
      },
    ] as never);

    const result = await searchPublicUsers();

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("Expected success");
    expect(result.data!).toHaveLength(1);
    expect(result.data![0].username).toBe("johndoe");
    expect(result.data![0].name).toBe("John Doe");
  });

  it("excludes current user from results", async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([]);

    await searchPublicUsers();

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { not: "user-1" },
        }),
      })
    );
  });

  it("returns all public users when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { id: "user-2", username: "johndoe", name: "John Doe" },
    ] as never);

    const result = await searchPublicUsers();

    expect(result.success).toBe(true);
    // When not authenticated, no user is excluded
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.not.objectContaining({
          id: expect.anything(),
        }),
      })
    );
  });

  it("returns error when rate limited", async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({
      error: "Too many attempts",
    });

    const result = await searchPublicUsers();

    expect(result.success).toBeUndefined();
    expect(result.error).toBe("Too many attempts");
  });

  it("limits results to 50 users", async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([]);

    await searchPublicUsers();

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 50,
      })
    );
  });

  it("only returns users with isPublic true and username set", async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([]);

    await searchPublicUsers();

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isPublic: true,
          username: { not: null },
        }),
      })
    );
  });

  it("returns error when Prisma throws", async () => {
    vi.mocked(prisma.user.findMany).mockRejectedValue(new Error("DB error"));

    const result = await searchPublicUsers();

    expect(result.success).toBeUndefined();
    expect(result.error).toBe("Failed to search users");
  });
});
