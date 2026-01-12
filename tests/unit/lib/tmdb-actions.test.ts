/**
 * Unit tests for TMDB server actions.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  searchMediaAction,
  applyMetadataAction,
  isTMDBAvailable,
} from "@/lib/tmdb-actions";

// Mock dependencies
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    item: { findUnique: vi.fn(), update: vi.fn() },
    itemFile: { create: vi.fn(), update: vi.fn() },
  },
}));
vi.mock("@/lib/tmdb-client", () => ({
  searchMedia: vi.fn(),
  getMovie: vi.fn(),
  getTVShow: vi.fn(),
  downloadPoster: vi.fn(),
  extractYear: vi.fn((d: string) => d?.split("-")[0] || ""),
  truncateOverview: vi.fn((t: string) => t?.slice(0, 200) || ""),
  isTMDBConfigured: vi.fn(() => true),
}));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: vi.fn() }));
vi.mock("@/lib/google-drive-actions", () => ({
  uploadBuffer: vi.fn(),
}));
vi.mock("@/lib/circuit-breaker", () => ({
  CircuitBreaker: class MockCircuitBreaker {
    execute = vi.fn((fn: () => unknown) => fn());
  },
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  searchMedia,
  getMovie,
  getTVShow,
  downloadPoster,
  isTMDBConfigured,
} from "@/lib/tmdb-client";
import { checkRateLimit } from "@/lib/rate-limit";
import { uploadBuffer } from "@/lib/google-drive-actions";

describe("tmdb-actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-123" },
    } as never);
    vi.mocked(checkRateLimit).mockResolvedValue(null);
    vi.mocked(isTMDBConfigured).mockReturnValue(true);
  });

  describe("isTMDBAvailable", () => {
    it("returns true when user authenticated and TMDB configured", async () => {
      const result = await isTMDBAvailable();
      expect(result).toBe(true);
    });

    it("returns false when not authenticated", async () => {
      vi.mocked(auth).mockResolvedValue(null as never);
      const result = await isTMDBAvailable();
      expect(result).toBe(false);
    });

    it("returns false when TMDB not configured", async () => {
      vi.mocked(isTMDBConfigured).mockReturnValue(false);
      const result = await isTMDBAvailable();
      expect(result).toBe(false);
    });
  });

  describe("searchMediaAction", () => {
    it("returns search results for authenticated user", async () => {
      vi.mocked(searchMedia).mockResolvedValue([
        {
          id: 1396,
          mediaType: "tv",
          title: "Breaking Bad",
          overview: "A chemistry teacher...",
          posterPath: "/poster.jpg",
          year: "2008",
        },
      ]);

      const result = await searchMediaAction("Breaking Bad");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(1);
        expect(result.data?.[0].title).toBe("Breaking Bad");
      }
    });

    it("requires authentication", async () => {
      vi.mocked(auth).mockResolvedValue(null as never);

      const result = await searchMediaAction("test");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Not authenticated");
      }
    });

    it("checks rate limit", async () => {
      vi.mocked(checkRateLimit).mockResolvedValue({
        error: "Too many attempts. Please try again later.",
      });

      const result = await searchMediaAction("test");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Too many attempts");
      }
    });

    it("returns error when TMDB not configured", async () => {
      vi.mocked(isTMDBConfigured).mockReturnValue(false);

      const result = await searchMediaAction("test");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("TMDB integration not configured");
      }
    });

    it("returns empty data on search error", async () => {
      vi.mocked(searchMedia).mockRejectedValue(new Error("API error"));

      const result = await searchMediaAction("test");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Search failed");
      }
    });
  });

  describe("applyMetadataAction", () => {
    const mockItem = {
      id: "item-1",
      userId: "user-123",
      driveConnectionId: "conn-1",
      files: [],
    };

    beforeEach(() => {
      vi.mocked(prisma.item.findUnique).mockResolvedValue(mockItem as never);
      vi.mocked(prisma.item.update).mockResolvedValue(mockItem as never);
      vi.mocked(getMovie).mockResolvedValue({
        id: 278,
        title: "The Shawshank Redemption",
        overview: "A long description...",
        poster_path: "/poster.jpg",
        release_date: "1994-09-23",
      });
      vi.mocked(downloadPoster).mockResolvedValue(Buffer.from([1, 2, 3]));
      vi.mocked(uploadBuffer).mockResolvedValue({
        success: true,
        data: { driveFileId: "drive-123" },
      });
    });

    it("updates item with movie metadata", async () => {
      const result = await applyMetadataAction("item-1", 278, "movie");

      expect(result.success).toBe(true);
      expect(prisma.item.update).toHaveBeenCalledWith({
        where: { id: "item-1" },
        data: {
          name: "The Shawshank Redemption (1994)",
          description: expect.any(String),
        },
      });
    });

    it("uploads poster to Google Drive", async () => {
      await applyMetadataAction("item-1", 278, "movie");

      expect(downloadPoster).toHaveBeenCalledWith("/poster.jpg");
      expect(uploadBuffer).toHaveBeenCalled();
    });

    it("creates ItemFile for poster", async () => {
      await applyMetadataAction("item-1", 278, "movie");

      expect(prisma.itemFile.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          itemId: "item-1",
          filename: "poster.jpg",
          fileType: "ARTWORK",
          isPrimary: true,
        }),
      });
    });

    it("skips poster when item has no Drive connection", async () => {
      vi.mocked(prisma.item.findUnique).mockResolvedValue({
        ...mockItem,
        driveConnectionId: null,
      } as never);

      const result = await applyMetadataAction("item-1", 278, "movie");

      expect(result.success).toBe(true);
      expect(downloadPoster).not.toHaveBeenCalled();
    });

    it("continues without poster when download fails", async () => {
      vi.mocked(downloadPoster).mockResolvedValue(null);

      const result = await applyMetadataAction("item-1", 278, "movie");

      expect(result.success).toBe(true);
      expect(prisma.item.update).toHaveBeenCalled();
    });

    it("verifies item ownership", async () => {
      vi.mocked(prisma.item.findUnique).mockResolvedValue({
        ...mockItem,
        userId: "different-user",
      } as never);

      const result = await applyMetadataAction("item-1", 278, "movie");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Item not found");
      }
    });

    it("handles TV shows", async () => {
      vi.mocked(getTVShow).mockResolvedValue({
        id: 1396,
        name: "Breaking Bad",
        overview: "A chemistry teacher...",
        poster_path: "/bb.jpg",
        first_air_date: "2008-01-20",
        number_of_seasons: 5,
      });

      const result = await applyMetadataAction("item-1", 1396, "tv");

      expect(result.success).toBe(true);
      expect(prisma.item.update).toHaveBeenCalledWith({
        where: { id: "item-1" },
        data: {
          name: "Breaking Bad (2008)",
          description: expect.any(String),
        },
      });
    });

    it("updates existing artwork instead of creating duplicate", async () => {
      vi.mocked(prisma.item.findUnique).mockResolvedValue({
        ...mockItem,
        files: [{ id: "existing-artwork-id" }],
      } as never);

      await applyMetadataAction("item-1", 278, "movie");

      expect(prisma.itemFile.update).toHaveBeenCalledWith({
        where: { id: "existing-artwork-id" },
        data: expect.objectContaining({
          filename: "poster.jpg",
          driveFileId: "drive-123",
        }),
      });
      expect(prisma.itemFile.create).not.toHaveBeenCalled();
    });

    it("returns error when movie not found on TMDB", async () => {
      vi.mocked(getMovie).mockResolvedValue(null);

      const result = await applyMetadataAction("item-1", 999999, "movie");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Movie not found on TMDB");
      }
    });

    it("returns error when TV show not found on TMDB", async () => {
      vi.mocked(getTVShow).mockResolvedValue(null);

      const result = await applyMetadataAction("item-1", 999999, "tv");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("TV show not found on TMDB");
      }
    });

    it("requires authentication", async () => {
      vi.mocked(auth).mockResolvedValue(null as never);

      const result = await applyMetadataAction("item-1", 278, "movie");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Not authenticated");
      }
    });

    it("handles item not found", async () => {
      vi.mocked(prisma.item.findUnique).mockResolvedValue(null);

      const result = await applyMetadataAction("item-1", 278, "movie");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Item not found");
      }
    });

    it("continues when upload fails", async () => {
      vi.mocked(uploadBuffer).mockResolvedValue({
        success: false,
        error: "Upload failed",
      });

      const result = await applyMetadataAction("item-1", 278, "movie");

      // Should still succeed - poster is optional
      expect(result.success).toBe(true);
      expect(prisma.item.update).toHaveBeenCalled();
    });
  });
});
