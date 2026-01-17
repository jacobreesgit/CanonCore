/**
 * Unit tests for TMDB server actions.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  searchMediaAction,
  applyMetadataAction,
  isTMDBAvailable,
  getSeasonsAction,
  getEpisodesAction,
  getEpisodePreviewAction,
} from "@/lib/tmdb-actions";

// Mock dependencies
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    item: { findUnique: vi.fn(), update: vi.fn() },
    itemFile: { create: vi.fn(), update: vi.fn() },
    googleDriveConnection: { findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/tmdb-client", () => ({
  searchMedia: vi.fn(),
  getMovie: vi.fn(),
  getTVShow: vi.fn(),
  getTVSeasons: vi.fn(),
  getTVEpisodes: vi.fn(),
  getEpisodeDetails: vi.fn(),
  getStillUrl: vi.fn((p: string | null) =>
    p ? `https://image.tmdb.org/t/p/w300${p}` : null
  ),
  downloadPoster: vi.fn(),
  downloadBackdrop: vi.fn(),
  extractYear: vi.fn((d: string) => d?.split("-")[0] || ""),
  truncateOverview: vi.fn((t: string) => t?.slice(0, 200) || ""),
  isTMDBConfigured: vi.fn(() => true),
}));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: vi.fn() }));
vi.mock("@/lib/google-drive-upload", () => ({
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
  getTVSeasons,
  getTVEpisodes,
  getEpisodeDetails,
  downloadPoster,
  downloadBackdrop,
  isTMDBConfigured,
} from "@/lib/tmdb-client";
import { checkRateLimit } from "@/lib/rate-limit";
import { uploadBuffer } from "@/lib/google-drive-upload";

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
          backdropPath: "/backdrop.jpg",
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
      // Mock user has a Drive connection (required for poster uploads)
      vi.mocked(prisma.googleDriveConnection.findUnique).mockResolvedValue({
        id: "conn-1",
      } as never);
      vi.mocked(getMovie).mockResolvedValue({
        id: 278,
        title: "The Shawshank Redemption",
        overview: "A long description...",
        poster_path: "/poster.jpg",
        backdrop_path: "/backdrop.jpg",
        release_date: "1994-09-23",
      });
      vi.mocked(downloadPoster).mockResolvedValue(Buffer.from([1, 2, 3]));
      vi.mocked(downloadBackdrop).mockResolvedValue(Buffer.from([4, 5, 6]));
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
      // User has no Drive connection
      vi.mocked(prisma.googleDriveConnection.findUnique).mockResolvedValue(
        null as never
      );

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
        backdrop_path: "/bb-backdrop.jpg",
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
        files: [{ id: "existing-artwork-id", isPrimary: true, isHero: false }],
      } as never);

      await applyMetadataAction("item-1", 278, "movie");

      expect(prisma.itemFile.update).toHaveBeenCalledWith({
        where: { id: "existing-artwork-id" },
        data: expect.objectContaining({
          filename: "poster.jpg",
          driveFileId: "drive-123",
        }),
      });
      // Note: backdrop still creates new file since there's no existing hero
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

  describe("getSeasonsAction", () => {
    const mockSeasons = [
      {
        id: 1,
        season_number: 1,
        name: "Season 1",
        overview: "First season",
        poster_path: "/s1.jpg",
        episode_count: 10,
        air_date: "2020-01-01",
      },
      {
        id: 2,
        season_number: 2,
        name: "Season 2",
        overview: "Second season",
        poster_path: null,
        episode_count: 8,
        air_date: "2021-01-01",
      },
    ];

    it("returns seasons for authenticated user", async () => {
      vi.mocked(getTVSeasons).mockResolvedValue(mockSeasons);

      const result = await getSeasonsAction(1396);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(2);
        expect(result.data?.[0].name).toBe("Season 1");
      }
    });

    it("requires authentication", async () => {
      vi.mocked(auth).mockResolvedValue(null as never);

      const result = await getSeasonsAction(1396);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Not authenticated");
      }
    });

    it("checks rate limit", async () => {
      vi.mocked(checkRateLimit).mockResolvedValue({
        error: "Too many attempts. Please try again later.",
      });

      const result = await getSeasonsAction(1396);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Too many attempts");
      }
    });

    it("returns error when TMDB not configured", async () => {
      vi.mocked(isTMDBConfigured).mockReturnValue(false);

      const result = await getSeasonsAction(1396);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("TMDB integration not configured");
      }
    });

    it("returns error when seasons not found", async () => {
      vi.mocked(getTVSeasons).mockResolvedValue(null);

      const result = await getSeasonsAction(999999);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Seasons not found");
      }
    });

    it("handles fetch errors", async () => {
      vi.mocked(getTVSeasons).mockRejectedValue(new Error("Network error"));

      const result = await getSeasonsAction(1396);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Failed to fetch seasons");
      }
    });
  });

  describe("getEpisodesAction", () => {
    const mockEpisodes = [
      {
        id: 101,
        episode_number: 1,
        name: "Pilot",
        overview: "First episode",
        still_path: "/ep1.jpg",
      },
      {
        id: 102,
        episode_number: 2,
        name: "Second Episode",
        overview: "Second episode",
        still_path: null,
      },
    ];

    it("returns episodes for authenticated user", async () => {
      vi.mocked(getTVEpisodes).mockResolvedValue(mockEpisodes);

      const result = await getEpisodesAction(1396, 1);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(2);
        expect(result.data?.[0].name).toBe("Pilot");
      }
    });

    it("passes correct tvId and season number", async () => {
      vi.mocked(getTVEpisodes).mockResolvedValue(mockEpisodes);

      await getEpisodesAction(1396, 3);

      expect(getTVEpisodes).toHaveBeenCalledWith(1396, 3);
    });

    it("requires authentication", async () => {
      vi.mocked(auth).mockResolvedValue(null as never);

      const result = await getEpisodesAction(1396, 1);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Not authenticated");
      }
    });

    it("checks rate limit", async () => {
      vi.mocked(checkRateLimit).mockResolvedValue({
        error: "Too many attempts. Please try again later.",
      });

      const result = await getEpisodesAction(1396, 1);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Too many attempts");
      }
    });

    it("returns error when TMDB not configured", async () => {
      vi.mocked(isTMDBConfigured).mockReturnValue(false);

      const result = await getEpisodesAction(1396, 1);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("TMDB integration not configured");
      }
    });

    it("returns error when episodes not found", async () => {
      vi.mocked(getTVEpisodes).mockResolvedValue(null);

      const result = await getEpisodesAction(1396, 99);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Episodes not found");
      }
    });

    it("handles fetch errors", async () => {
      vi.mocked(getTVEpisodes).mockRejectedValue(new Error("Network error"));

      const result = await getEpisodesAction(1396, 1);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Failed to fetch episodes");
      }
    });
  });

  describe("getEpisodePreviewAction", () => {
    const mockEpisode = {
      id: 62085,
      episode_number: 1,
      season_number: 1,
      name: "Pilot",
      overview: "A chemistry teacher diagnosed with cancer...",
      still_path: "/pilot.jpg",
      air_date: "2008-01-20",
      runtime: 58,
      vote_average: 8.2,
    };

    it("returns episode preview for authenticated user", async () => {
      vi.mocked(getEpisodeDetails).mockResolvedValue(mockEpisode);

      const result = await getEpisodePreviewAction(1396, 1, 1);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data?.name).toBe("S01E01 - Pilot");
        expect(result.data?.seasonNumber).toBe(1);
        expect(result.data?.episodeNumber).toBe(1);
      }
    });

    it("formats episode name with padded numbers", async () => {
      vi.mocked(getEpisodeDetails).mockResolvedValue({
        ...mockEpisode,
        season_number: 5,
        episode_number: 16,
        name: "Felina",
      });

      const result = await getEpisodePreviewAction(1396, 5, 16);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data?.name).toBe("S05E16 - Felina");
      }
    });

    it("includes still URL when available", async () => {
      vi.mocked(getEpisodeDetails).mockResolvedValue(mockEpisode);

      const result = await getEpisodePreviewAction(1396, 1, 1);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data?.stillUrl).toBe(
          "https://image.tmdb.org/t/p/w300/pilot.jpg"
        );
        expect(result.data?.stillPath).toBe("/pilot.jpg");
      }
    });

    it("handles null still path", async () => {
      vi.mocked(getEpisodeDetails).mockResolvedValue({
        ...mockEpisode,
        still_path: null,
      });

      const result = await getEpisodePreviewAction(1396, 1, 1);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data?.stillUrl).toBeNull();
        expect(result.data?.stillPath).toBeNull();
      }
    });

    it("requires authentication", async () => {
      vi.mocked(auth).mockResolvedValue(null as never);

      const result = await getEpisodePreviewAction(1396, 1, 1);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Not authenticated");
      }
    });

    it("checks rate limit", async () => {
      vi.mocked(checkRateLimit).mockResolvedValue({
        error: "Too many attempts. Please try again later.",
      });

      const result = await getEpisodePreviewAction(1396, 1, 1);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Too many attempts");
      }
    });

    it("returns error when TMDB not configured", async () => {
      vi.mocked(isTMDBConfigured).mockReturnValue(false);

      const result = await getEpisodePreviewAction(1396, 1, 1);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("TMDB integration not configured");
      }
    });

    it("returns error when episode not found", async () => {
      vi.mocked(getEpisodeDetails).mockResolvedValue(null);

      const result = await getEpisodePreviewAction(1396, 1, 99);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Episode not found on TMDB");
      }
    });

    it("handles fetch errors", async () => {
      vi.mocked(getEpisodeDetails).mockRejectedValue(
        new Error("Network error")
      );

      const result = await getEpisodePreviewAction(1396, 1, 1);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Failed to fetch episode preview");
      }
    });
  });
});
