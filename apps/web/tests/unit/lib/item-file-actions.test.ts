/**
 * Unit tests for ItemFile server actions.
 * Tests playback position updates and file retrieval.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Session } from "next-auth";
import {
  updatePlaybackPosition,
  getItemFiles,
  getItemFile,
  setPrimaryFile,
  deleteItemFile,
} from "@/lib/item-file-actions";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { createWatchRecordIfNotRecent } from "@/lib/watch-record-utils";
import { FileType } from "@prisma/client";

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

// Mock Prisma
vi.mock("@/lib/prisma", () => ({
  prisma: {
    item: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    itemFile: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    watchRecord: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn((updates) => Promise.all(updates)),
  },
}));

// Mock auth
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

// Mock watch-record-utils (createWatchRecordIfNotRecent is called by auto-scrobble)
vi.mock("@/lib/watch-record-utils", () => ({
  createWatchRecordIfNotRecent: vi.fn().mockResolvedValue(true),
}));

// Mock Google Drive actions
vi.mock("@/lib/google-drive-actions", () => ({
  deleteFileFromDrive: vi.fn().mockResolvedValue(undefined),
  renameItemInGoogleDrive: vi.fn().mockResolvedValue({ success: true }),
}));

// Mock rate limiting
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue(null),
}));

// Mock Next.js cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Mock logger
vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

const mockAuth = auth as unknown as ReturnType<
  typeof vi.fn<() => Promise<Session | null>>
>;

/** Helper to create a mock session */
const mockSession = (userId: string, email: string): Session => ({
  user: { id: userId, email },
  expires: new Date().toISOString(),
});

/** Helper to create a mock ItemFile */
const mockItemFile = (
  overrides: Partial<{
    id: string;
    itemId: string;
    filename: string;
    driveFileId: string | null;
    fileType: FileType;
    mimeType: string | null;
    size: bigint | null;
    syncStatus: "SYNCED" | "PENDING" | "SYNCING" | "ERROR";
    syncError: string | null;
    isPrimary: boolean;
    isHero: boolean;
    isLogo: boolean;
    playbackPosition: number | null;
    playbackDuration: number | null;
    durationMs: bigint | null;
    width: number | null;
    height: number | null;
    createdAt: Date;
    updatedAt: Date;
    item?: { userId: string };
  }> = {}
) => ({
  id: "file-1",
  itemId: "item-1",
  filename: "movie.mp4",
  driveFileId: "drive-file-123",
  fileType: FileType.MEDIA,
  mimeType: "video/mp4",
  size: BigInt(1000000),
  syncStatus: "SYNCED" as const,
  syncError: null,
  isPrimary: false,
  isHero: false,
  isLogo: false,
  playbackPosition: null,
  playbackDuration: null,
  durationMs: null,
  width: null,
  height: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe("updatePlaybackPosition", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const result = await updatePlaybackPosition("file-1", 120);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Unauthorized");
    }
  });

  it("returns error when file not found", async () => {
    mockAuth.mockResolvedValue(mockSession("user-1", "test@example.com"));
    vi.mocked(prisma.itemFile.findUnique).mockResolvedValue(null);

    const result = await updatePlaybackPosition("nonexistent", 120);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("File not found");
    }
  });

  it("returns error when user does not own the item", async () => {
    mockAuth.mockResolvedValue(mockSession("user-1", "test@example.com"));
    vi.mocked(prisma.itemFile.findUnique).mockResolvedValue({
      ...mockItemFile(),
      item: { userId: "other-user" },
    } as ReturnType<typeof prisma.itemFile.findUnique> extends Promise<infer T>
      ? T
      : never);

    const result = await updatePlaybackPosition("file-1", 120);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Access denied");
    }
  });

  it("updates position and duration", async () => {
    mockAuth.mockResolvedValue(mockSession("user-1", "test@example.com"));
    vi.mocked(prisma.itemFile.findUnique).mockResolvedValue({
      ...mockItemFile(),
      item: { userId: "user-1" },
    } as ReturnType<typeof prisma.itemFile.findUnique> extends Promise<infer T>
      ? T
      : never);
    vi.mocked(prisma.itemFile.update).mockResolvedValue(mockItemFile());

    const result = await updatePlaybackPosition("file-1", 120.5, 7200);

    expect(result.success).toBe(true);
    expect(prisma.itemFile.update).toHaveBeenCalledWith({
      where: { id: "file-1" },
      data: {
        playbackPosition: 120.5,
        playbackDuration: 7200,
      },
    });
  });

  it("updates position only when duration not provided", async () => {
    mockAuth.mockResolvedValue(mockSession("user-1", "test@example.com"));
    vi.mocked(prisma.itemFile.findUnique).mockResolvedValue({
      ...mockItemFile(),
      item: { userId: "user-1" },
    } as ReturnType<typeof prisma.itemFile.findUnique> extends Promise<infer T>
      ? T
      : never);
    vi.mocked(prisma.itemFile.update).mockResolvedValue(mockItemFile());

    const result = await updatePlaybackPosition("file-1", 60);

    expect(result.success).toBe(true);
    expect(prisma.itemFile.update).toHaveBeenCalledWith({
      where: { id: "file-1" },
      data: {
        playbackPosition: 60,
      },
    });
  });

  it("resets position to 0 when called with 0", async () => {
    mockAuth.mockResolvedValue(mockSession("user-1", "test@example.com"));
    vi.mocked(prisma.itemFile.findUnique).mockResolvedValue({
      ...mockItemFile({ playbackPosition: 120 }),
      item: { userId: "user-1" },
    } as ReturnType<typeof prisma.itemFile.findUnique> extends Promise<infer T>
      ? T
      : never);
    vi.mocked(prisma.itemFile.update).mockResolvedValue(mockItemFile());

    const result = await updatePlaybackPosition("file-1", 0);

    expect(result.success).toBe(true);
    expect(prisma.itemFile.update).toHaveBeenCalledWith({
      where: { id: "file-1" },
      data: {
        playbackPosition: 0,
      },
    });
  });

  describe("boundary conditions", () => {
    it("should NOT reset at 99.9% progress - saves position as-is", async () => {
      mockAuth.mockResolvedValue(mockSession("user-1", "test@example.com"));
      vi.mocked(prisma.itemFile.findUnique).mockResolvedValue({
        ...mockItemFile(),
        item: { userId: "user-1" },
      } as ReturnType<typeof prisma.itemFile.findUnique> extends Promise<
        infer T
      >
        ? T
        : never);
      vi.mocked(prisma.itemFile.update).mockResolvedValue(mockItemFile());

      // At 99.9% of a 100 second video
      const result = await updatePlaybackPosition("file-1", 99.9, 100);

      expect(result.success).toBe(true);
      // Position should be saved as 99.9, not reset to 0
      expect(prisma.itemFile.update).toHaveBeenCalledWith({
        where: { id: "file-1" },
        data: {
          playbackPosition: 99.9,
          playbackDuration: 100,
        },
      });
    });

    it("handles duration = 0 gracefully", async () => {
      mockAuth.mockResolvedValue(mockSession("user-1", "test@example.com"));
      vi.mocked(prisma.itemFile.findUnique).mockResolvedValue({
        ...mockItemFile(),
        item: { userId: "user-1" },
      } as ReturnType<typeof prisma.itemFile.findUnique> extends Promise<
        infer T
      >
        ? T
        : never);
      vi.mocked(prisma.itemFile.update).mockResolvedValue(mockItemFile());

      // Position update with duration 0
      const result = await updatePlaybackPosition("file-1", 10, 0);

      expect(result.success).toBe(true);
      expect(prisma.itemFile.update).toHaveBeenCalledWith({
        where: { id: "file-1" },
        data: {
          playbackPosition: 10,
          playbackDuration: 0,
        },
      });
    });

    it("handles position > duration gracefully", async () => {
      mockAuth.mockResolvedValue(mockSession("user-1", "test@example.com"));
      vi.mocked(prisma.itemFile.findUnique).mockResolvedValue({
        ...mockItemFile(),
        item: { userId: "user-1" },
      } as ReturnType<typeof prisma.itemFile.findUnique> extends Promise<
        infer T
      >
        ? T
        : never);
      vi.mocked(prisma.itemFile.update).mockResolvedValue(mockItemFile());

      // Edge case: position 105 when duration is 100
      const result = await updatePlaybackPosition("file-1", 105, 100);

      // Should still save the values without crashing
      expect(result.success).toBe(true);
      expect(prisma.itemFile.update).toHaveBeenCalledWith({
        where: { id: "file-1" },
        data: {
          playbackPosition: 105,
          playbackDuration: 100,
        },
      });
    });

    it("handles null duration without affecting position", async () => {
      mockAuth.mockResolvedValue(mockSession("user-1", "test@example.com"));
      vi.mocked(prisma.itemFile.findUnique).mockResolvedValue({
        ...mockItemFile(),
        item: { userId: "user-1" },
      } as ReturnType<typeof prisma.itemFile.findUnique> extends Promise<
        infer T
      >
        ? T
        : never);
      vi.mocked(prisma.itemFile.update).mockResolvedValue(mockItemFile());

      // Position update without duration
      const result = await updatePlaybackPosition("file-1", 50, null);

      expect(result.success).toBe(true);
      // Duration should not be included in update
      expect(prisma.itemFile.update).toHaveBeenCalledWith({
        where: { id: "file-1" },
        data: {
          playbackPosition: 50,
        },
      });
    });

    it("handles negative position gracefully", async () => {
      mockAuth.mockResolvedValue(mockSession("user-1", "test@example.com"));
      vi.mocked(prisma.itemFile.findUnique).mockResolvedValue({
        ...mockItemFile(),
        item: { userId: "user-1" },
      } as ReturnType<typeof prisma.itemFile.findUnique> extends Promise<
        infer T
      >
        ? T
        : never);
      vi.mocked(prisma.itemFile.update).mockResolvedValue(mockItemFile());

      // Edge case: negative position (shouldn't happen but handle gracefully)
      const result = await updatePlaybackPosition("file-1", -5);

      expect(result.success).toBe(true);
      expect(prisma.itemFile.update).toHaveBeenCalledWith({
        where: { id: "file-1" },
        data: {
          playbackPosition: -5,
        },
      });
    });

    it("handles very large position values", async () => {
      mockAuth.mockResolvedValue(mockSession("user-1", "test@example.com"));
      vi.mocked(prisma.itemFile.findUnique).mockResolvedValue({
        ...mockItemFile(),
        item: { userId: "user-1" },
      } as ReturnType<typeof prisma.itemFile.findUnique> extends Promise<
        infer T
      >
        ? T
        : never);
      vi.mocked(prisma.itemFile.update).mockResolvedValue(mockItemFile());

      // Very long video position (24 hours in seconds)
      const result = await updatePlaybackPosition("file-1", 86400, 172800);

      expect(result.success).toBe(true);
      expect(prisma.itemFile.update).toHaveBeenCalledWith({
        where: { id: "file-1" },
        data: {
          playbackPosition: 86400,
          playbackDuration: 172800,
        },
      });
    });

    it("handles fractional seconds precisely", async () => {
      mockAuth.mockResolvedValue(mockSession("user-1", "test@example.com"));
      vi.mocked(prisma.itemFile.findUnique).mockResolvedValue({
        ...mockItemFile(),
        item: { userId: "user-1" },
      } as ReturnType<typeof prisma.itemFile.findUnique> extends Promise<
        infer T
      >
        ? T
        : never);
      vi.mocked(prisma.itemFile.update).mockResolvedValue(mockItemFile());

      // Precise fractional position (1:23.456)
      const result = await updatePlaybackPosition("file-1", 83.456, 3600);

      expect(result.success).toBe(true);
      expect(prisma.itemFile.update).toHaveBeenCalledWith({
        where: { id: "file-1" },
        data: {
          playbackPosition: 83.456,
          playbackDuration: 3600,
        },
      });
    });
  });

  describe("auto-scrobble", () => {
    it("calls createWatchRecordIfNotRecent when position crosses 80% threshold", async () => {
      mockAuth.mockResolvedValue(mockSession("user-1", "test@example.com"));
      vi.mocked(prisma.itemFile.findUnique).mockResolvedValue({
        ...mockItemFile({ playbackDuration: 100 }),
        item: { userId: "user-1", id: "item-1" },
      } as ReturnType<typeof prisma.itemFile.findUnique> extends Promise<
        infer T
      >
        ? T
        : never);
      vi.mocked(prisma.itemFile.update).mockResolvedValue(mockItemFile());

      await updatePlaybackPosition("file-1", 85, 100); // 85% > 80%

      expect(createWatchRecordIfNotRecent).toHaveBeenCalledWith(
        "item-1",
        "user-1",
        "AUTO"
      );
    });

    it("does NOT call createWatchRecordIfNotRecent below 80% threshold", async () => {
      mockAuth.mockResolvedValue(mockSession("user-1", "test@example.com"));
      vi.mocked(prisma.itemFile.findUnique).mockResolvedValue({
        ...mockItemFile({ playbackDuration: 100 }),
        item: { userId: "user-1", id: "item-1" },
      } as ReturnType<typeof prisma.itemFile.findUnique> extends Promise<
        infer T
      >
        ? T
        : never);
      vi.mocked(prisma.itemFile.update).mockResolvedValue(mockItemFile());

      await updatePlaybackPosition("file-1", 70, 100); // 70% < 80%

      expect(createWatchRecordIfNotRecent).not.toHaveBeenCalled();
    });
  });
});

describe("getItemFiles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const result = await getItemFiles("item-1");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Unauthorized");
    }
  });

  it("returns files grouped by type", async () => {
    mockAuth.mockResolvedValue(mockSession("user-1", "test@example.com"));

    const files = [
      mockItemFile({ id: "file-1", filename: "movie.mp4", fileType: "MEDIA" }),
      mockItemFile({
        id: "file-2",
        filename: "trailer.mp4",
        fileType: "MEDIA",
      }),
      mockItemFile({
        id: "file-3",
        filename: "poster.jpg",
        fileType: "ARTWORK",
      }),
      mockItemFile({
        id: "file-4",
        filename: "english.srt",
        fileType: "SUBTITLE",
      }),
    ];
    vi.mocked(prisma.itemFile.findMany).mockResolvedValue(files);

    const result = await getItemFiles("item-1");

    expect(result.success).toBe(true);
    if (result.success && result.data) {
      expect(result.data.media).toHaveLength(2);
      expect(result.data.artwork).toHaveLength(1);
      expect(result.data.subtitles).toHaveLength(1);
    }
  });

  it("returns empty arrays when no files found", async () => {
    mockAuth.mockResolvedValue(mockSession("user-1", "test@example.com"));
    vi.mocked(prisma.itemFile.findMany).mockResolvedValue([]);

    const result = await getItemFiles("item-1");

    expect(result.success).toBe(true);
    if (result.success && result.data) {
      expect(result.data.media).toHaveLength(0);
      expect(result.data.artwork).toHaveLength(0);
      expect(result.data.subtitles).toHaveLength(0);
    }
  });
});

describe("getItemFile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const result = await getItemFile("file-1");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Unauthorized");
    }
  });

  it("returns error when file not found", async () => {
    mockAuth.mockResolvedValue(mockSession("user-1", "test@example.com"));
    vi.mocked(prisma.itemFile.findUnique).mockResolvedValue(null);

    const result = await getItemFile("nonexistent");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("File not found");
    }
  });

  it("returns file when user owns it", async () => {
    mockAuth.mockResolvedValue(mockSession("user-1", "test@example.com"));
    vi.mocked(prisma.itemFile.findUnique).mockResolvedValue({
      ...mockItemFile(),
      item: { userId: "user-1" },
    } as ReturnType<typeof prisma.itemFile.findUnique> extends Promise<infer T>
      ? T
      : never);

    const result = await getItemFile("file-1");

    expect(result.success).toBe(true);
    if (result.success && result.data) {
      expect(result.data.id).toBe("file-1");
      expect(result.data.filename).toBe("movie.mp4");
    }
  });

  it("returns error when user does not own the item", async () => {
    mockAuth.mockResolvedValue(mockSession("user-1", "test@example.com"));
    vi.mocked(prisma.itemFile.findUnique).mockResolvedValue({
      ...mockItemFile(),
      item: { userId: "other-user" },
    } as ReturnType<typeof prisma.itemFile.findUnique> extends Promise<infer T>
      ? T
      : never);

    const result = await getItemFile("file-1");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Access denied");
    }
  });
});

describe("setPrimaryFile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const result = await setPrimaryFile("file-1");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Unauthorized");
    }
  });

  it("returns error when file not found", async () => {
    mockAuth.mockResolvedValue(mockSession("user-1", "test@example.com"));
    vi.mocked(prisma.itemFile.findUnique).mockResolvedValue(null);

    const result = await setPrimaryFile("nonexistent");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("File not found");
    }
  });

  it("returns error when user does not own the item", async () => {
    mockAuth.mockResolvedValue(mockSession("user-1", "test@example.com"));
    vi.mocked(prisma.itemFile.findUnique).mockResolvedValue({
      ...mockItemFile({ fileType: "ARTWORK" }),
      item: { userId: "other-user" },
    } as ReturnType<typeof prisma.itemFile.findUnique> extends Promise<infer T>
      ? T
      : never);

    const result = await setPrimaryFile("file-1");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Access denied");
    }
  });

  it("sets isPrimary using transaction", async () => {
    mockAuth.mockResolvedValue(mockSession("user-1", "test@example.com"));
    vi.mocked(prisma.itemFile.findUnique).mockResolvedValue({
      ...mockItemFile({ id: "file-1", itemId: "item-1", fileType: "ARTWORK" }),
      item: { userId: "user-1" },
    } as ReturnType<typeof prisma.itemFile.findUnique> extends Promise<infer T>
      ? T
      : never);
    // Mock updateMany and update to return proper PrismaPromise-like objects
    vi.mocked(prisma.itemFile.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.itemFile.update).mockResolvedValue({
      ...mockItemFile({ isPrimary: true }),
    });

    const result = await setPrimaryFile("file-1");

    expect(result.success).toBe(true);
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it("succeeds when file is already primary (idempotent)", async () => {
    mockAuth.mockResolvedValue(mockSession("user-1", "test@example.com"));
    vi.mocked(prisma.itemFile.findUnique).mockResolvedValue({
      ...mockItemFile({
        id: "file-1",
        itemId: "item-1",
        fileType: "ARTWORK",
        isPrimary: true,
      }),
      item: { userId: "user-1" },
    } as ReturnType<typeof prisma.itemFile.findUnique> extends Promise<infer T>
      ? T
      : never);
    // Mock updateMany and update to return proper values
    vi.mocked(prisma.itemFile.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.itemFile.update).mockResolvedValue({
      ...mockItemFile({ isPrimary: true }),
    });

    const result = await setPrimaryFile("file-1");

    expect(result.success).toBe(true);
  });
});

describe("updateItemSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when rate limited", async () => {
    const { checkRateLimit } = await import("@/lib/rate-limit");
    vi.mocked(checkRateLimit).mockResolvedValueOnce({
      error: "Too many attempts. Please try again later.",
    });
    const { updateItemSettings } = await import("@/lib/item-file-actions");

    const result = await updateItemSettings("item-1", { name: "New Name" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Too many attempts. Please try again later.");
    }
  });

  it("returns error when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const { updateItemSettings } = await import("@/lib/item-file-actions");

    const result = await updateItemSettings("item-1", { name: "New Name" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Unauthorized");
    }
  });

  it("returns error when item not found", async () => {
    mockAuth.mockResolvedValue(mockSession("user-1", "test@example.com"));
    vi.mocked(prisma.item.findUnique).mockResolvedValue(null);
    const { updateItemSettings } = await import("@/lib/item-file-actions");

    const result = await updateItemSettings("nonexistent", {
      name: "New Name",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Item not found");
    }
  });

  it("returns error when user does not own the item", async () => {
    mockAuth.mockResolvedValue(mockSession("user-1", "test@example.com"));
    vi.mocked(prisma.item.findUnique).mockResolvedValue({
      id: "item-1",
      userId: "other-user",
      name: "Old Name",
      driveFileId: null,
    } as never);
    const { updateItemSettings } = await import("@/lib/item-file-actions");

    const result = await updateItemSettings("item-1", { name: "New Name" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Access denied");
    }
  });

  it("returns error for invalid name (empty)", async () => {
    mockAuth.mockResolvedValue(mockSession("user-1", "test@example.com"));
    vi.mocked(prisma.item.findUnique).mockResolvedValue({
      id: "item-1",
      userId: "user-1",
      name: "Old Name",
      driveFileId: null,
    } as never);
    const { updateItemSettings } = await import("@/lib/item-file-actions");

    const result = await updateItemSettings("item-1", { name: "" });

    expect(result.success).toBe(false);
  });

  it("returns error for description exceeding max length", async () => {
    mockAuth.mockResolvedValue(mockSession("user-1", "test@example.com"));
    vi.mocked(prisma.item.findUnique).mockResolvedValue({
      id: "item-1",
      userId: "user-1",
      name: "Old Name",
      driveFileId: null,
    } as never);
    const { updateItemSettings } = await import("@/lib/item-file-actions");

    const result = await updateItemSettings("item-1", {
      description: "x".repeat(1001), // Max is 1000
    });

    expect(result.success).toBe(false);
  });

  it("updates item name successfully", async () => {
    mockAuth.mockResolvedValue(mockSession("user-1", "test@example.com"));
    vi.mocked(prisma.item.findUnique).mockResolvedValue({
      id: "item-1",
      userId: "user-1",
      name: "Old Name",
      driveFileId: null,
    } as never);
    vi.mocked(prisma.$transaction).mockImplementation(async (fn) => {
      if (typeof fn === "function") {
        return fn(prisma);
      }
      return Promise.all(fn);
    });
    vi.mocked(prisma.item.update).mockResolvedValue({
      id: "item-1",
      name: "New Name",
    } as never);
    const { updateItemSettings } = await import("@/lib/item-file-actions");

    const result = await updateItemSettings("item-1", { name: "New Name" });

    expect(result.success).toBe(true);
  });

  it("updates item description successfully", async () => {
    mockAuth.mockResolvedValue(mockSession("user-1", "test@example.com"));
    vi.mocked(prisma.item.findUnique).mockResolvedValue({
      id: "item-1",
      userId: "user-1",
      name: "Old Name",
      driveFileId: null,
    } as never);
    vi.mocked(prisma.$transaction).mockImplementation(async (fn) => {
      if (typeof fn === "function") {
        return fn(prisma);
      }
      return Promise.all(fn);
    });
    vi.mocked(prisma.item.update).mockResolvedValue({
      id: "item-1",
      description: "New description",
    } as never);
    const { updateItemSettings } = await import("@/lib/item-file-actions");

    const result = await updateItemSettings("item-1", {
      description: "New description",
    });

    expect(result.success).toBe(true);
  });

  it("clears description when empty string provided", async () => {
    mockAuth.mockResolvedValue(mockSession("user-1", "test@example.com"));
    vi.mocked(prisma.item.findUnique).mockResolvedValue({
      id: "item-1",
      userId: "user-1",
      name: "Old Name",
      driveFileId: null,
    } as never);
    vi.mocked(prisma.$transaction).mockImplementation(async (fn) => {
      if (typeof fn === "function") {
        return fn(prisma);
      }
      return Promise.all(fn);
    });
    vi.mocked(prisma.item.update).mockResolvedValue({
      id: "item-1",
      description: null,
    } as never);
    const { updateItemSettings } = await import("@/lib/item-file-actions");

    const result = await updateItemSettings("item-1", { description: "" });

    expect(result.success).toBe(true);
  });

  it("returns error when file not found for primary selection", async () => {
    mockAuth.mockResolvedValue(mockSession("user-1", "test@example.com"));
    vi.mocked(prisma.item.findUnique).mockResolvedValue({
      id: "item-1",
      userId: "user-1",
      name: "Old Name",
      driveFileId: null,
    } as never);
    vi.mocked(prisma.itemFile.findMany).mockResolvedValue([]);
    const { updateItemSettings } = await import("@/lib/item-file-actions");

    const result = await updateItemSettings("item-1", {
      primaryMediaId: "nonexistent-file",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("One or more files not found");
    }
  });

  it("returns error when file belongs to different item", async () => {
    mockAuth.mockResolvedValue(mockSession("user-1", "test@example.com"));
    vi.mocked(prisma.item.findUnique).mockResolvedValue({
      id: "item-1",
      userId: "user-1",
      name: "Old Name",
      driveFileId: null,
    } as never);
    vi.mocked(prisma.itemFile.findMany).mockResolvedValue([
      { id: "file-1", itemId: "different-item", fileType: "MEDIA" },
    ] as never);
    const { updateItemSettings } = await import("@/lib/item-file-actions");

    const result = await updateItemSettings("item-1", {
      primaryMediaId: "file-1",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("File does not belong to this item");
    }
  });

  it("returns error when primary media is wrong file type", async () => {
    mockAuth.mockResolvedValue(mockSession("user-1", "test@example.com"));
    vi.mocked(prisma.item.findUnique).mockResolvedValue({
      id: "item-1",
      userId: "user-1",
      name: "Old Name",
      driveFileId: null,
    } as never);
    vi.mocked(prisma.itemFile.findMany).mockResolvedValue([
      { id: "file-1", itemId: "item-1", fileType: "ARTWORK" },
    ] as never);
    const { updateItemSettings } = await import("@/lib/item-file-actions");

    const result = await updateItemSettings("item-1", {
      primaryMediaId: "file-1",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Primary media must be a MEDIA file");
    }
  });

  it("returns error when primary artwork is wrong file type", async () => {
    mockAuth.mockResolvedValue(mockSession("user-1", "test@example.com"));
    vi.mocked(prisma.item.findUnique).mockResolvedValue({
      id: "item-1",
      userId: "user-1",
      name: "Old Name",
      driveFileId: null,
    } as never);
    vi.mocked(prisma.itemFile.findMany).mockResolvedValue([
      { id: "file-1", itemId: "item-1", fileType: "MEDIA" },
    ] as never);
    const { updateItemSettings } = await import("@/lib/item-file-actions");

    const result = await updateItemSettings("item-1", {
      primaryArtworkId: "file-1",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Primary artwork must be an ARTWORK file");
    }
  });

  it("returns error when hero image is wrong file type", async () => {
    mockAuth.mockResolvedValue(mockSession("user-1", "test@example.com"));
    vi.mocked(prisma.item.findUnique).mockResolvedValue({
      id: "item-1",
      userId: "user-1",
      name: "Old Name",
      driveFileId: null,
    } as never);
    vi.mocked(prisma.itemFile.findMany).mockResolvedValue([
      { id: "file-1", itemId: "item-1", fileType: "SUBTITLE" },
    ] as never);
    const { updateItemSettings } = await import("@/lib/item-file-actions");

    const result = await updateItemSettings("item-1", {
      heroArtworkId: "file-1",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Hero image must be an ARTWORK file");
    }
  });

  it("returns error when primary subtitle is wrong file type", async () => {
    mockAuth.mockResolvedValue(mockSession("user-1", "test@example.com"));
    vi.mocked(prisma.item.findUnique).mockResolvedValue({
      id: "item-1",
      userId: "user-1",
      name: "Old Name",
      driveFileId: null,
    } as never);
    vi.mocked(prisma.itemFile.findMany).mockResolvedValue([
      { id: "file-1", itemId: "item-1", fileType: "MEDIA" },
    ] as never);
    const { updateItemSettings } = await import("@/lib/item-file-actions");

    const result = await updateItemSettings("item-1", {
      primarySubtitleId: "file-1",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Primary subtitle must be a SUBTITLE file");
    }
  });

  it("triggers Google Drive rename when item has driveFileId", async () => {
    mockAuth.mockResolvedValue(mockSession("user-1", "test@example.com"));
    vi.mocked(prisma.item.findUnique).mockResolvedValue({
      id: "item-1",
      userId: "user-1",
      name: "Old Name",
      driveFileId: "drive-file-123",
    } as never);
    vi.mocked(prisma.$transaction).mockImplementation(async (fn) => {
      if (typeof fn === "function") {
        return fn(prisma);
      }
      return Promise.all(fn);
    });
    vi.mocked(prisma.item.update).mockResolvedValue({
      id: "item-1",
      name: "New Name",
    } as never);

    const { renameItemInGoogleDrive } =
      await import("@/lib/google-drive-actions");
    vi.mocked(renameItemInGoogleDrive).mockResolvedValue({ success: true });

    const { updateItemSettings } = await import("@/lib/item-file-actions");

    await updateItemSettings("item-1", { name: "New Name" });

    // Give time for async call
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(renameItemInGoogleDrive).toHaveBeenCalledWith("item-1", "New Name");
  });

  it("updates all settings atomically", async () => {
    mockAuth.mockResolvedValue(mockSession("user-1", "test@example.com"));
    vi.mocked(prisma.item.findUnique).mockResolvedValue({
      id: "item-1",
      userId: "user-1",
      name: "Old Name",
      driveFileId: null,
    } as never);
    vi.mocked(prisma.itemFile.findMany).mockResolvedValue([
      { id: "media-1", itemId: "item-1", fileType: "MEDIA" },
      { id: "artwork-1", itemId: "item-1", fileType: "ARTWORK" },
    ] as never);
    vi.mocked(prisma.$transaction).mockImplementation(async (fn) => {
      if (typeof fn === "function") {
        return fn(prisma);
      }
      return Promise.all(fn);
    });
    vi.mocked(prisma.item.update).mockResolvedValue({} as never);
    vi.mocked(prisma.itemFile.updateMany).mockResolvedValue({
      count: 1,
    } as never);
    vi.mocked(prisma.itemFile.update).mockResolvedValue({} as never);

    const { updateItemSettings } = await import("@/lib/item-file-actions");

    const result = await updateItemSettings("item-1", {
      name: "New Name",
      description: "New description",
      primaryMediaId: "media-1",
      primaryArtworkId: "artwork-1",
    });

    expect(result.success).toBe(true);
    expect(prisma.$transaction).toHaveBeenCalled();
  });
});

describe("deleteItemFile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return error when rate limited", async () => {
    const { checkRateLimit } = await import("@/lib/rate-limit");
    vi.mocked(checkRateLimit).mockResolvedValueOnce({
      error: "Too many attempts. Please try again later.",
    });

    const result = await deleteItemFile("file-1");

    expect(result).toEqual({
      success: false,
      error: "Too many attempts. Please try again later.",
    });
  });

  it("should return error when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const result = await deleteItemFile("file-1");

    expect(result).toEqual({ success: false, error: "Unauthorized" });
  });

  it("should return error when file not found", async () => {
    mockAuth.mockResolvedValue(mockSession("user-1", "test@example.com"));
    vi.mocked(prisma.itemFile.findUnique).mockResolvedValue(null);

    const result = await deleteItemFile("nonexistent");

    expect(result).toEqual({ success: false, error: "File not found" });
  });

  it("should return error when user does not own file", async () => {
    mockAuth.mockResolvedValue(mockSession("user-1", "test@example.com"));
    vi.mocked(prisma.itemFile.findUnique).mockResolvedValue({
      id: "file-1",
      itemId: "item-1",
      driveFileId: "drive-1",
      item: { userId: "other-user" },
    } as unknown as Awaited<ReturnType<typeof prisma.itemFile.findUnique>>);

    const result = await deleteItemFile("file-1");

    expect(result).toEqual({ success: false, error: "Access denied" });
  });

  it("should delete file from database and Google Drive", async () => {
    mockAuth.mockResolvedValue(mockSession("user-1", "test@example.com"));
    vi.mocked(prisma.itemFile.findUnique).mockResolvedValue({
      id: "file-1",
      itemId: "item-1",
      driveFileId: "drive-file-123",
      item: {
        userId: "user-1",
        driveConnection: { id: "conn-1" },
      },
    } as unknown as Awaited<ReturnType<typeof prisma.itemFile.findUnique>>);
    vi.mocked(prisma.itemFile.delete).mockResolvedValue(
      {} as unknown as Awaited<ReturnType<typeof prisma.itemFile.delete>>
    );

    const result = await deleteItemFile("file-1");

    expect(result).toEqual({ success: true });
    expect(prisma.itemFile.delete).toHaveBeenCalledWith({
      where: { id: "file-1" },
    });
  });

  it("should delete file even without Drive connection", async () => {
    mockAuth.mockResolvedValue(mockSession("user-1", "test@example.com"));
    vi.mocked(prisma.itemFile.findUnique).mockResolvedValue({
      id: "file-1",
      itemId: "item-1",
      driveFileId: null,
      item: {
        userId: "user-1",
        driveConnection: null,
      },
    } as unknown as Awaited<ReturnType<typeof prisma.itemFile.findUnique>>);
    vi.mocked(prisma.itemFile.delete).mockResolvedValue(
      {} as unknown as Awaited<ReturnType<typeof prisma.itemFile.delete>>
    );

    const result = await deleteItemFile("file-1");

    expect(result).toEqual({ success: true });
  });

  it("should return error when database delete fails", async () => {
    mockAuth.mockResolvedValue(mockSession("user-1", "test@example.com"));
    vi.mocked(prisma.itemFile.findUnique).mockResolvedValue({
      id: "file-1",
      itemId: "item-1",
      driveFileId: null,
      item: { userId: "user-1", driveConnection: null },
    } as unknown as Awaited<ReturnType<typeof prisma.itemFile.findUnique>>);
    vi.mocked(prisma.itemFile.delete).mockRejectedValue(new Error("DB error"));

    const result = await deleteItemFile("file-1");

    expect(result).toEqual({ success: false, error: "Failed to delete file" });
  });
});
