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
} from "@/lib/item-file-actions";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
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

// Mock auth
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
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
    sftpPath: string;
    fileType: FileType;
    mimeType: string | null;
    size: bigint | null;
    sftpModifiedAt: Date | null;
    isPrimary: boolean;
    isHero: boolean;
    playbackPosition: number | null;
    playbackDuration: number | null;
    createdAt: Date;
    updatedAt: Date;
    item?: { userId: string };
  }> = {}
) => ({
  id: "file-1",
  itemId: "item-1",
  filename: "movie.mp4",
  sftpPath: "/videos/movie.mp4",
  fileType: FileType.MEDIA,
  mimeType: "video/mp4",
  size: BigInt(1000000),
  sftpModifiedAt: new Date(),
  isPrimary: false,
  isHero: false,
  playbackPosition: null,
  playbackDuration: null,
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
