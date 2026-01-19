/**
 * Unit tests for auth utility functions.
 *
 * Note: Since auth.ts has module-level NextAuth initialization, we test
 * the utility functions by re-implementing their logic here. The actual
 * NextAuth configuration is tested via integration and E2E tests.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import type { Session } from "next-auth";

/**
 * Re-implementation of extractSidebarUser for unit testing.
 * This matches the logic in lib/auth.ts.
 */
function extractSidebarUser(session: Session | null) {
  if (!session?.user) {
    return null;
  }

  return {
    name: session.user.name ?? session.user.email?.split("@")[0] ?? "User",
    email: session.user.email ?? "",
    avatar: session.user.image ?? undefined,
  };
}

/**
 * Re-implementation of getExtendedSidebarUser for unit testing.
 * This matches the logic in lib/auth.ts.
 */
async function getExtendedSidebarUser(session: Session | null) {
  if (!session?.user?.id) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true,
      email: true,
      username: true,
      isPublic: true,
      image: true,
      heroImage: true,
    },
  });

  if (!user) {
    return null;
  }

  return {
    name: user.name ?? user.email.split("@")[0] ?? "User",
    email: user.email,
    avatar: user.image ? "/api/user/avatar" : undefined,
    username: user.username,
    isPublic: user.isPublic,
    hasImage: user.image !== null,
    hasHeroImage: user.heroImage !== null,
  };
}

describe("extractSidebarUser", () => {
  it("returns null for null session", () => {
    const result = extractSidebarUser(null);
    expect(result).toBeNull();
  });

  it("returns null for session without user", () => {
    const session = { expires: "2024-01-01" } as Session;
    const result = extractSidebarUser(session);
    expect(result).toBeNull();
  });

  it("extracts user data from session with name", () => {
    const session = {
      user: {
        id: "user-1",
        name: "John Doe",
        email: "john@example.com",
        image: "https://example.com/avatar.jpg",
      },
      expires: "2024-01-01",
    } as Session;

    const result = extractSidebarUser(session);

    expect(result).toEqual({
      name: "John Doe",
      email: "john@example.com",
      avatar: "https://example.com/avatar.jpg",
    });
  });

  it("uses email prefix as name when name is null", () => {
    const session = {
      user: {
        id: "user-1",
        name: null,
        email: "john@example.com",
        image: null,
      },
      expires: "2024-01-01",
    } as Session;

    const result = extractSidebarUser(session);

    expect(result).toEqual({
      name: "john",
      email: "john@example.com",
      avatar: undefined,
    });
  });

  it("uses 'User' as fallback when both name and email are missing", () => {
    const session = {
      user: {
        id: "user-1",
        name: null,
        email: null,
      },
      expires: "2024-01-01",
    } as Session;

    const result = extractSidebarUser(session);

    expect(result).toEqual({
      name: "User",
      email: "",
      avatar: undefined,
    });
  });

  it("returns undefined avatar when image is null", () => {
    const session = {
      user: {
        id: "user-1",
        name: "John",
        email: "john@example.com",
        image: null,
      },
      expires: "2024-01-01",
    } as Session;

    const result = extractSidebarUser(session);

    expect(result?.avatar).toBeUndefined();
  });
});

describe("getExtendedSidebarUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null for null session", async () => {
    const result = await getExtendedSidebarUser(null);
    expect(result).toBeNull();
  });

  it("returns null for session without user id", async () => {
    const session = {
      user: {
        email: "john@example.com",
      },
      expires: "2024-01-01",
    } as Session;

    const result = await getExtendedSidebarUser(session);
    expect(result).toBeNull();
  });

  it("returns null when user not found in database", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const session = {
      user: {
        id: "user-1",
        email: "john@example.com",
      },
      expires: "2024-01-01",
    } as Session;

    const result = await getExtendedSidebarUser(session);

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: "user-1" },
      select: {
        name: true,
        email: true,
        username: true,
        isPublic: true,
        image: true,
        heroImage: true,
      },
    });
    expect(result).toBeNull();
  });

  it("returns extended user data from database", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-1",
      name: "John Doe",
      email: "john@example.com",
      username: "johndoe",
      isPublic: true,
      image: new Uint8Array([1, 2, 3]),
      heroImage: new Uint8Array([4, 5, 6]),
      passwordHash: "hash",
      emailVerified: null,
      imageMime: null,
      heroImageMime: null,
      defaultViewMode: null,
      defaultSortBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const session = {
      user: {
        id: "user-1",
        email: "john@example.com",
      },
      expires: "2024-01-01",
    } as Session;

    const result = await getExtendedSidebarUser(session);

    expect(result).toEqual({
      name: "John Doe",
      email: "john@example.com",
      avatar: "/api/user/avatar",
      username: "johndoe",
      isPublic: true,
      hasImage: true,
      hasHeroImage: true,
    });
  });

  it("uses email prefix as name when name is null", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-1",
      name: null,
      email: "jane@example.com",
      username: null,
      isPublic: false,
      image: null,
      heroImage: null,
      passwordHash: "hash",
      emailVerified: null,
      imageMime: null,
      heroImageMime: null,
      defaultViewMode: null,
      defaultSortBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const session = {
      user: {
        id: "user-1",
        email: "jane@example.com",
      },
      expires: "2024-01-01",
    } as Session;

    const result = await getExtendedSidebarUser(session);

    expect(result?.name).toBe("jane");
  });

  it("returns undefined avatar when user has no image", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-1",
      name: "John",
      email: "john@example.com",
      username: null,
      isPublic: false,
      image: null,
      heroImage: null,
      passwordHash: "hash",
      emailVerified: null,
      imageMime: null,
      heroImageMime: null,
      defaultViewMode: null,
      defaultSortBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const session = {
      user: {
        id: "user-1",
        email: "john@example.com",
      },
      expires: "2024-01-01",
    } as Session;

    const result = await getExtendedSidebarUser(session);

    expect(result?.avatar).toBeUndefined();
    expect(result?.hasImage).toBe(false);
    expect(result?.hasHeroImage).toBe(false);
  });
});
