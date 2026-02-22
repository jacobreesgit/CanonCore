/**
 * Unit tests for account deletion and data export server actions.
 * Follows patterns from tests/unit/lib/user-actions.test.ts.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";

// Mock @/lib/env
vi.mock("@/lib/env", () => ({
  env: {
    DATABASE_URL: "postgresql://test:test@localhost:5432/test",
    AUTH_SECRET: "test-auth-secret",
    RESEND_API_KEY: "re_test_key",
    EMAIL_FROM: "test@example.com",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    UPSTASH_REDIS_REST_URL: "https://test.upstash.io",
    UPSTASH_REDIS_REST_TOKEN: "test-token",
    BYPASS_RATE_LIMIT: "true",
  },
}));

// Mock next/headers
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue("127.0.0.1"),
  }),
}));

// Mock auth
const mockUserId = "user-123";
vi.mock("@/lib/auth", () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: "user-123" },
  }),
}));

// Mock bcryptjs — matches existing convention in user-actions.test.ts:
// "Password1" with hash "mock-password-hash" returns true, all else false
vi.mock("bcryptjs", () => ({
  compare: vi.fn((password: string, hash: string) => {
    return Promise.resolve(
      password === "Password1" && hash === "mock-password-hash"
    );
  }),
  hash: vi.fn(() => Promise.resolve("$2a$12$mockedhash")),
}));

// Mock google-drive-client (NOT google-drive-actions) —
// deleteAccount imports getDriveClient/withRateLimit from google-drive-client
const mockDriveFilesUpdate = vi.fn().mockResolvedValue({});
const mockGetDriveClient = vi.fn().mockResolvedValue({
  files: { update: mockDriveFilesUpdate },
});
const mockWithRateLimit = vi.fn((fn: () => unknown) => fn());
vi.mock("@/lib/google-drive-client", () => ({
  getDriveClient: (...args: Parameters<typeof mockGetDriveClient>) =>
    mockGetDriveClient(...args),
  withRateLimit: (...args: Parameters<typeof mockWithRateLimit>) =>
    mockWithRateLimit(...args),
}));

vi.stubEnv("BYPASS_RATE_LIMIT", "true");

// Static imports — matches existing test pattern (no dynamic await import())
import { deleteAccount, exportAccountData } from "@/lib/user-actions";
import { auth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";

describe("deleteAccount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({
      user: { id: mockUserId },
      expires: "",
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never);
  });

  it("rejects unauthenticated requests", async () => {
    vi.mocked(auth).mockResolvedValueOnce(null as never);

    const result = await deleteAccount("password", "DELETE");

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("Not authenticated");
    expect(prisma.user.delete).not.toHaveBeenCalled();
  });

  it("rejects when rate limited", async () => {
    vi.stubEnv("BYPASS_RATE_LIMIT", "false");
    vi.mocked(checkRateLimit).mockResolvedValueOnce({
      error: "Too many attempts. Please try again later.",
    });

    const result = await deleteAccount("password", "DELETE");

    expect(result.success).toBe(false);
    vi.stubEnv("BYPASS_RATE_LIMIT", "true");
  });

  it("rejects when confirmText is not DELETE", async () => {
    const result = await deleteAccount("Password1", "delete");

    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error).toContain('You must type "DELETE" to confirm');
  });

  it("rejects wrong password", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      id: mockUserId,
      passwordHash: "mock-password-hash",
      googleDriveConnection: null,
    } as never);

    const result = await deleteAccount("WrongPassword1", "DELETE");

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("Incorrect password");
  });

  it("deletes user on success", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      id: mockUserId,
      passwordHash: "mock-password-hash",
      googleDriveConnection: null,
    } as never);
    vi.mocked(prisma.user.delete).mockResolvedValueOnce({} as never);

    const result = await deleteAccount("Password1", "DELETE");

    expect(result.success).toBe(true);
    expect(prisma.user.delete).toHaveBeenCalledWith({
      where: { id: mockUserId },
    });
  });

  it("trashes Drive folder before deleting if connected", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      id: mockUserId,
      passwordHash: "mock-password-hash",
      googleDriveConnection: {
        id: "drive-conn-1",
        rootFolderId: "folder-123",
      },
    } as never);
    vi.mocked(prisma.user.delete).mockResolvedValueOnce({} as never);

    const result = await deleteAccount("Password1", "DELETE");

    expect(result.success).toBe(true);
    expect(mockGetDriveClient).toHaveBeenCalled();
    expect(mockDriveFilesUpdate).toHaveBeenCalledWith({
      fileId: "folder-123",
      requestBody: { trashed: true },
    });
    expect(prisma.user.delete).toHaveBeenCalled();
  });

  it("still deletes user if Drive trash fails", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      id: mockUserId,
      passwordHash: "mock-password-hash",
      googleDriveConnection: {
        id: "drive-conn-1",
        rootFolderId: "folder-123",
      },
    } as never);
    mockGetDriveClient.mockRejectedValueOnce(new Error("Drive API error"));
    vi.mocked(prisma.user.delete).mockResolvedValueOnce({} as never);

    const result = await deleteAccount("Password1", "DELETE");

    expect(result.success).toBe(true);
    expect(prisma.user.delete).toHaveBeenCalled();
  });
});

describe("exportAccountData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({
      user: { id: mockUserId },
      expires: "",
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never);
  });

  it("rejects unauthenticated requests", async () => {
    vi.mocked(auth).mockResolvedValueOnce(null as never);

    const result = await exportAccountData();

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("Not authenticated");
  });

  it("returns user not found for deleted user", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);

    const result = await exportAccountData();

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("User not found");
  });

  it("returns correctly shaped JSON", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      name: "Test User",
      email: "test@example.com",
      username: "testuser",
      isPublic: false,
      createdAt: new Date("2025-01-01"),
      items: [
        {
          id: "item-1",
          name: "Movie 1",
          description: "A movie",
          isPublic: true,
          inheritVisibility: false,
          tmdbId: 123,
          tmdbType: "movie",
          tmdbPosterPath: "/poster.jpg",
          tmdbBackdropPath: "/backdrop.jpg",
          createdAt: new Date("2025-01-01"),
          parentId: null,
          files: [
            {
              filename: "video.mp4",
              mimeType: "video/mp4",
              size: 1000000,
              fileType: "MEDIA",
              isPrimary: true,
              isHero: false,
            },
          ],
        },
      ],
      playlists: [
        {
          name: "My Playlist",
          description: "A playlist",
          isPublic: false,
          createdAt: new Date("2025-01-01"),
          playlistItems: [
            {
              order: 0,
              addedAt: new Date("2025-01-01"),
              item: { name: "Movie 1" },
            },
          ],
        },
      ],
      forks: [
        {
          sourceItem: { name: "Original" },
          targetItem: { name: "My Fork" },
          createdAt: new Date("2025-01-01"),
        },
      ],
    } as never);

    const result = await exportAccountData();

    expect(result.success).toBe(true);
    if (result.success && result.data) {
      expect(result.data.user.email).toBe("test@example.com");
      expect(result.data.items).toHaveLength(1);
      expect(result.data.items[0].name).toBe("Movie 1");
      expect(result.data.items[0].files).toHaveLength(1);
      expect(result.data.playlists).toHaveLength(1);
      expect(result.data.playlists[0].items).toHaveLength(1);
      expect(result.data.forks).toHaveLength(1);
      expect(result.data.exportedAt).toBeDefined();
    }
  });

  it("handles empty library", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      name: "Empty User",
      email: "empty@example.com",
      username: "emptyuser",
      isPublic: false,
      createdAt: new Date("2025-01-01"),
      items: [],
      playlists: [],
      forks: [],
    } as never);

    const result = await exportAccountData();

    expect(result.success).toBe(true);
    if (result.success && result.data) {
      expect(result.data.items).toEqual([]);
      expect(result.data.playlists).toEqual([]);
      expect(result.data.forks).toEqual([]);
    }
  });
});
