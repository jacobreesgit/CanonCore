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
  getMetadataPreviewAction,
  getImagesAction,
  getSeasonMetadataAction,
  getSeasonImagesAction,
  getEpisodeImagesAction,
  getSeasonDataAction,
  clearTmdbFieldAction,
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
  getSeasonDetails: vi.fn(),
  getMovieImages: vi.fn(),
  getTVShowImages: vi.fn(),
  getTVSeasonImages: vi.fn(),
  getEpisodeImages: vi.fn(),
  getBestLogo: vi.fn(),
  getPosterUrl: vi.fn((p: string | null, size?: string) =>
    p ? `https://image.tmdb.org/t/p/${size || "w342"}${p}` : null
  ),
  getBackdropUrl: vi.fn((p: string | null, size?: string) =>
    p ? `https://image.tmdb.org/t/p/${size || "w780"}${p}` : null
  ),
  getStillUrl: vi.fn((p: string | null) =>
    p ? `https://image.tmdb.org/t/p/w300${p}` : null
  ),
  extractYear: vi.fn((d: string) => d?.split("-")[0] || ""),
  truncateOverview: vi.fn((t: string) => t?.slice(0, 200) || ""),
  isTMDBConfigured: vi.fn(() => true),
}));
vi.mock("@/lib/colour-extract", () => ({
  extractDominantColour: vi.fn().mockResolvedValue("#1a3a5c"),
}));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: vi.fn() }));
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
  getSeasonDetails,
  getMovieImages,
  getTVShowImages,
  getTVSeasonImages,
  getEpisodeImages,
  getBestLogo,
  isTMDBConfigured,
} from "@/lib/tmdb-client";
import { checkRateLimit } from "@/lib/rate-limit";
import { extractDominantColour } from "@/lib/colour-extract";

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

    const mockImagesWithLogo = {
      posters: [],
      backdrops: [],
      logos: [
        {
          file_path: "/logo1.png",
          vote_average: 5.5,
          iso_639_1: "en",
          width: 400,
          height: 150,
        },
      ],
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
        tagline: "",
        runtime: null,
        vote_average: 0,
        vote_count: 0,
        genres: [],
      });
      // Default: images endpoint returns logos, getBestLogo selects one
      vi.mocked(getMovieImages).mockResolvedValue(mockImagesWithLogo);
      vi.mocked(getTVShowImages).mockResolvedValue(mockImagesWithLogo);
      vi.mocked(getBestLogo).mockReturnValue("/logo1.png");
      vi.mocked(extractDominantColour).mockResolvedValue("#1a3a5c");
    });

    it("updates item with movie metadata and tmdbId/tmdbType", async () => {
      const result = await applyMetadataAction("item-1", 278, "movie");

      expect(result.success).toBe(true);
      expect(prisma.item.update).toHaveBeenCalledWith({
        where: { id: "item-1" },
        data: expect.objectContaining({
          tmdbId: 278,
          tmdbType: "movie",
          name: "The Shawshank Redemption (1994)",
          description: expect.any(String),
          tmdbPosterPath: "/poster.jpg",
          tmdbBackdropPath: "/backdrop.jpg",
        }),
      });
    });

    it("stores TMDB poster and backdrop paths on item", async () => {
      await applyMetadataAction("item-1", 278, "movie");

      expect(prisma.item.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tmdbPosterPath: "/poster.jpg",
            tmdbBackdropPath: "/backdrop.jpg",
          }),
        })
      );
    });

    it("skips poster/backdrop paths when updatePoster/updateBackdrop are false", async () => {
      await applyMetadataAction("item-1", 278, "movie", {
        updateName: true,
        updateDescription: true,
        updatePoster: false,
        updateBackdrop: false,
      });

      expect(prisma.item.update).toHaveBeenCalledWith({
        where: { id: "item-1" },
        data: expect.objectContaining({
          tmdbId: 278,
          tmdbType: "movie",
          name: "The Shawshank Redemption (1994)",
          description: expect.any(String),
        }),
      });
      // Verify poster/backdrop are NOT included
      const updateCall = vi.mocked(prisma.item.update).mock.calls[0][0];
      expect(updateCall.data).not.toHaveProperty("tmdbPosterPath");
      expect(updateCall.data).not.toHaveProperty("tmdbBackdropPath");
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

    it("handles TV shows and stores tmdbId/tmdbType", async () => {
      vi.mocked(getTVShow).mockResolvedValue({
        id: 1396,
        name: "Breaking Bad",
        overview: "A chemistry teacher...",
        poster_path: "/bb.jpg",
        backdrop_path: "/bb-backdrop.jpg",
        first_air_date: "2008-01-20",
        number_of_seasons: 5,
        tagline: "",
        vote_average: 0,
        vote_count: 0,
        genres: [],
      });

      const result = await applyMetadataAction("item-1", 1396, "tv");

      expect(result.success).toBe(true);
      expect(prisma.item.update).toHaveBeenCalledWith({
        where: { id: "item-1" },
        data: expect.objectContaining({
          tmdbId: 1396,
          tmdbType: "tv",
          name: "Breaking Bad (2008)",
          description: expect.any(String),
          tmdbPosterPath: "/bb.jpg",
          tmdbBackdropPath: "/bb-backdrop.jpg",
        }),
      });
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

    it("uses wizard-selected poster path when provided", async () => {
      await applyMetadataAction("item-1", 278, "movie", {
        updateName: true,
        updateDescription: true,
        updatePoster: true,
        updateBackdrop: true,
        posterPath: "/custom-poster.jpg",
        backdropPath: "/custom-backdrop.jpg",
      });

      expect(prisma.item.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tmdbPosterPath: "/custom-poster.jpg",
            tmdbBackdropPath: "/custom-backdrop.jpg",
          }),
        })
      );
    });

    it("stores tmdbLogoPath from best logo", async () => {
      const result = await applyMetadataAction("item-1", 278, "movie");

      expect(result.success).toBe(true);
      expect(getMovieImages).toHaveBeenCalledWith(278);
      expect(getBestLogo).toHaveBeenCalledWith(mockImagesWithLogo);
      expect(prisma.item.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tmdbLogoPath: "/logo1.png",
          }),
        })
      );
    });

    it("stores dominantColour extracted from backdrop", async () => {
      const result = await applyMetadataAction("item-1", 278, "movie");

      expect(result.success).toBe(true);
      expect(extractDominantColour).toHaveBeenCalledWith(
        "https://image.tmdb.org/t/p/w300/backdrop.jpg"
      );
      expect(prisma.item.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            dominantColour: "#1a3a5c",
          }),
        })
      );
    });

    it("saves metadata even when colour extraction fails", async () => {
      vi.mocked(extractDominantColour).mockResolvedValue(null);

      const result = await applyMetadataAction("item-1", 278, "movie");

      expect(result.success).toBe(true);
      // dominantColour should be explicitly set to null (clears stale colour)
      const updateCall = vi.mocked(prisma.item.update).mock.calls[0][0];
      expect(updateCall.data).toHaveProperty("dominantColour", null);
    });

    it("uses wizard-selected logoPath when provided", async () => {
      await applyMetadataAction("item-1", 278, "movie", {
        logoPath: "/custom-logo.png",
      });

      expect(prisma.item.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tmdbLogoPath: "/custom-logo.png",
          }),
        })
      );
      // Should use the provided path, not call getBestLogo for auto-selection
    });

    it("skips logo when updateLogo is false", async () => {
      await applyMetadataAction("item-1", 278, "movie", {
        updateLogo: false,
      });

      const updateCall = vi.mocked(prisma.item.update).mock.calls[0][0];
      expect(updateCall.data).not.toHaveProperty("tmdbLogoPath");
    });

    it("fetches TV show images for logo when mediaType is tv", async () => {
      vi.mocked(getTVShow).mockResolvedValue({
        id: 1396,
        name: "Breaking Bad",
        overview: "A chemistry teacher...",
        poster_path: "/bb.jpg",
        backdrop_path: "/bb-backdrop.jpg",
        first_air_date: "2008-01-20",
        number_of_seasons: 5,
        tagline: "",
        vote_average: 0,
        vote_count: 0,
        genres: [],
      });

      await applyMetadataAction("item-1", 1396, "tv");

      expect(getTVShowImages).toHaveBeenCalledWith(1396);
    });

    it("extracts colour from poster path when no backdrop is available (seasons)", async () => {
      vi.mocked(getMovie).mockResolvedValue({
        id: 278,
        title: "Season 1",
        overview: "Season overview",
        poster_path: "/season-poster.jpg",
        backdrop_path: null,
        release_date: "",
        tagline: "",
        runtime: null,
        vote_average: 0,
        vote_count: 0,
        genres: [],
      });
      vi.mocked(extractDominantColour).mockResolvedValue("#2b4a6d");

      await applyMetadataAction("item-1", 278, "movie", {
        updatePoster: true,
        posterPath: "/season-poster.jpg",
      });

      // Should extract from poster since no backdrop
      expect(extractDominantColour).toHaveBeenCalledWith(
        "https://image.tmdb.org/t/p/w300/season-poster.jpg"
      );
      expect(prisma.item.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            dominantColour: "#2b4a6d",
          }),
        })
      );
    });

    it("prefers backdrop over poster for colour extraction when both exist", async () => {
      vi.mocked(extractDominantColour).mockResolvedValue("#1a3a5c");

      await applyMetadataAction("item-1", 278, "movie");

      // backdrop.jpg comes from the mock getMovie (has backdrop_path)
      expect(extractDominantColour).toHaveBeenCalledWith(
        "https://image.tmdb.org/t/p/w300/backdrop.jpg"
      );
    });

    it("skips colour extraction when neither backdrop nor poster exists", async () => {
      vi.mocked(getMovie).mockResolvedValue({
        id: 278,
        title: "No Images",
        overview: "Overview",
        poster_path: null,
        backdrop_path: null,
        release_date: "",
        tagline: "",
        runtime: null,
        vote_average: 0,
        vote_count: 0,
        genres: [],
      });

      await applyMetadataAction("item-1", 278, "movie", {
        updatePoster: false,
      });

      expect(extractDominantColour).not.toHaveBeenCalled();
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

  describe("getMetadataPreviewAction", () => {
    it("returns preview for movie", async () => {
      vi.mocked(getMovie).mockResolvedValue({
        id: 278,
        title: "The Shawshank Redemption",
        overview: "Two imprisoned men bond over a number of years...",
        poster_path: "/poster.jpg",
        backdrop_path: "/backdrop.jpg",
        release_date: "1994-09-23",
        tagline: "",
        runtime: null,
        vote_average: 0,
        vote_count: 0,
        genres: [],
      });

      const result = await getMetadataPreviewAction(278, "movie");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data?.name).toBe("The Shawshank Redemption (1994)");
        expect(result.data?.posterUrl).toContain("/poster.jpg");
        expect(result.data?.backdropUrl).toContain("/backdrop.jpg");
      }
    });

    it("returns preview for TV show", async () => {
      vi.mocked(getTVShow).mockResolvedValue({
        id: 1396,
        name: "Breaking Bad",
        overview: "A chemistry teacher diagnosed with terminal lung cancer...",
        poster_path: "/bb-poster.jpg",
        backdrop_path: "/bb-backdrop.jpg",
        first_air_date: "2008-01-20",
        number_of_seasons: 5,
        tagline: "",
        vote_average: 0,
        vote_count: 0,
        genres: [],
      });

      const result = await getMetadataPreviewAction(1396, "tv");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data?.name).toBe("Breaking Bad (2008)");
        expect(result.data?.posterUrl).toContain("/bb-poster.jpg");
      }
    });

    it("requires authentication", async () => {
      vi.mocked(auth).mockResolvedValue(null as never);

      const result = await getMetadataPreviewAction(278, "movie");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Not authenticated");
      }
    });

    it("checks rate limit", async () => {
      vi.mocked(checkRateLimit).mockResolvedValue({
        error: "Too many attempts. Please try again later.",
      });

      const result = await getMetadataPreviewAction(278, "movie");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Too many attempts");
      }
    });

    it("returns error when TMDB not configured", async () => {
      vi.mocked(isTMDBConfigured).mockReturnValue(false);

      const result = await getMetadataPreviewAction(278, "movie");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("TMDB integration not configured");
      }
    });

    it("returns error when movie not found", async () => {
      vi.mocked(getMovie).mockResolvedValue(null);

      const result = await getMetadataPreviewAction(999999, "movie");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Movie not found on TMDB");
      }
    });

    it("returns error when TV show not found", async () => {
      vi.mocked(getTVShow).mockResolvedValue(null);

      const result = await getMetadataPreviewAction(999999, "tv");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("TV show not found on TMDB");
      }
    });

    it("handles fetch errors", async () => {
      vi.mocked(getMovie).mockRejectedValue(new Error("Network error"));

      const result = await getMetadataPreviewAction(278, "movie");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Failed to fetch preview");
      }
    });
  });

  describe("getImagesAction", () => {
    const mockImages = {
      posters: [
        {
          file_path: "/poster1.jpg",
          vote_average: 5.5,
          iso_639_1: "en",
          width: 500,
          height: 750,
        },
        {
          file_path: "/poster2.jpg",
          vote_average: 4.2,
          iso_639_1: null,
          width: 500,
          height: 750,
        },
      ],
      backdrops: [
        {
          file_path: "/bd1.jpg",
          vote_average: 5.8,
          iso_639_1: null,
          width: 1920,
          height: 1080,
        },
      ],
    };

    it("returns images for movie", async () => {
      vi.mocked(getMovieImages).mockResolvedValue(mockImages);

      const result = await getImagesAction(278, "movie");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data?.posters).toHaveLength(2);
        expect(result.data?.backdrops).toHaveLength(1);
      }
      expect(getMovieImages).toHaveBeenCalledWith(278);
    });

    it("returns images for TV show", async () => {
      vi.mocked(getTVShowImages).mockResolvedValue(mockImages);

      const result = await getImagesAction(1396, "tv");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data?.posters).toHaveLength(2);
      }
      expect(getTVShowImages).toHaveBeenCalledWith(1396);
    });

    it("requires authentication", async () => {
      vi.mocked(auth).mockResolvedValue(null as never);

      const result = await getImagesAction(278, "movie");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Not authenticated");
      }
    });

    it("checks rate limit", async () => {
      vi.mocked(checkRateLimit).mockResolvedValue({
        error: "Too many attempts. Please try again later.",
      });

      const result = await getImagesAction(278, "movie");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Too many attempts");
      }
    });

    it("returns error when TMDB not configured", async () => {
      vi.mocked(isTMDBConfigured).mockReturnValue(false);

      const result = await getImagesAction(278, "movie");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("TMDB integration not configured");
      }
    });

    it("returns error when images not found", async () => {
      vi.mocked(getMovieImages).mockResolvedValue(null);

      const result = await getImagesAction(999999, "movie");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Images not found");
      }
    });

    it("handles fetch errors", async () => {
      vi.mocked(getMovieImages).mockRejectedValue(new Error("Network error"));

      const result = await getImagesAction(278, "movie");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Failed to fetch images");
      }
    });
  });

  describe("getSeasonMetadataAction", () => {
    const mockSeason = {
      id: 3572,
      season_number: 1,
      name: "Season 1",
      overview: "Walter White starts cooking meth...",
      poster_path: "/s1-poster.jpg",
      air_date: "2008-01-20",
      episodes: [],
    };

    it("returns season metadata for authenticated user", async () => {
      vi.mocked(getSeasonDetails).mockResolvedValue(mockSeason);

      const result = await getSeasonMetadataAction(1396, 1);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data?.name).toBe("Season 1");
        expect(result.data?.seasonNumber).toBe(1);
        expect(result.data?.posterUrl).toContain("/s1-poster.jpg");
      }
    });

    it("passes correct tvId and seasonNumber", async () => {
      vi.mocked(getSeasonDetails).mockResolvedValue(mockSeason);

      await getSeasonMetadataAction(1396, 3);

      expect(getSeasonDetails).toHaveBeenCalledWith(1396, 3);
    });

    it("requires authentication", async () => {
      vi.mocked(auth).mockResolvedValue(null as never);

      const result = await getSeasonMetadataAction(1396, 1);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Not authenticated");
      }
    });

    it("checks rate limit", async () => {
      vi.mocked(checkRateLimit).mockResolvedValue({
        error: "Too many attempts. Please try again later.",
      });

      const result = await getSeasonMetadataAction(1396, 1);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Too many attempts");
      }
    });

    it("returns error when TMDB not configured", async () => {
      vi.mocked(isTMDBConfigured).mockReturnValue(false);

      const result = await getSeasonMetadataAction(1396, 1);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("TMDB integration not configured");
      }
    });

    it("returns error when season not found", async () => {
      vi.mocked(getSeasonDetails).mockResolvedValue(null);

      const result = await getSeasonMetadataAction(1396, 99);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Season not found on TMDB");
      }
    });

    it("handles fetch errors", async () => {
      vi.mocked(getSeasonDetails).mockRejectedValue(new Error("Network error"));

      const result = await getSeasonMetadataAction(1396, 1);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Failed to fetch season details");
      }
    });
  });

  describe("getSeasonImagesAction", () => {
    const mockSeasonImages = {
      posters: [
        {
          file_path: "/s1-p1.jpg",
          width: 500,
          height: 750,
          vote_average: 5.5,
          iso_639_1: "en",
        },
        {
          file_path: "/s1-p2.jpg",
          width: 500,
          height: 750,
          vote_average: 4.2,
          iso_639_1: null,
        },
      ],
    };

    it("returns season images for authenticated user", async () => {
      vi.mocked(getTVSeasonImages).mockResolvedValue(mockSeasonImages);

      const result = await getSeasonImagesAction(1396, 1);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data?.posters).toHaveLength(2);
        expect(result.data?.posters[0].file_path).toBe("/s1-p1.jpg");
      }
    });

    it("passes correct tvId and seasonNumber", async () => {
      vi.mocked(getTVSeasonImages).mockResolvedValue(mockSeasonImages);

      await getSeasonImagesAction(1396, 3);

      expect(getTVSeasonImages).toHaveBeenCalledWith(1396, 3);
    });

    it("requires authentication", async () => {
      vi.mocked(auth).mockResolvedValue(null as never);

      const result = await getSeasonImagesAction(1396, 1);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Not authenticated");
      }
    });

    it("checks rate limit", async () => {
      vi.mocked(checkRateLimit).mockResolvedValue({
        error: "Too many attempts. Please try again later.",
      });

      const result = await getSeasonImagesAction(1396, 1);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Too many attempts");
      }
    });

    it("returns error when TMDB not configured", async () => {
      vi.mocked(isTMDBConfigured).mockReturnValue(false);

      const result = await getSeasonImagesAction(1396, 1);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("TMDB integration not configured");
      }
    });

    it("returns error when images not found", async () => {
      vi.mocked(getTVSeasonImages).mockResolvedValue(null);

      const result = await getSeasonImagesAction(1396, 99);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Season images not found");
      }
    });

    it("handles fetch errors", async () => {
      vi.mocked(getTVSeasonImages).mockRejectedValue(
        new Error("Network error")
      );

      const result = await getSeasonImagesAction(1396, 1);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Failed to fetch season images");
      }
    });
  });

  describe("getEpisodeImagesAction", () => {
    const mockEpisodeImages = {
      stills: [
        {
          file_path: "/ep1-still1.jpg",
          width: 1920,
          height: 1080,
          vote_average: 5.8,
          aspect_ratio: 1.778,
          iso_639_1: null,
        },
        {
          file_path: "/ep1-still2.jpg",
          width: 1920,
          height: 1080,
          vote_average: 4.5,
          aspect_ratio: 1.778,
          iso_639_1: null,
        },
      ],
    };

    it("returns episode images for authenticated user", async () => {
      vi.mocked(getEpisodeImages).mockResolvedValue(mockEpisodeImages);

      const result = await getEpisodeImagesAction(1396, 1, 1);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data?.stills).toHaveLength(2);
        expect(result.data?.stills[0].file_path).toBe("/ep1-still1.jpg");
      }
    });

    it("passes correct tvId, seasonNumber, and episodeNumber", async () => {
      vi.mocked(getEpisodeImages).mockResolvedValue(mockEpisodeImages);

      await getEpisodeImagesAction(1396, 5, 16);

      expect(getEpisodeImages).toHaveBeenCalledWith(1396, 5, 16);
    });

    it("requires authentication", async () => {
      vi.mocked(auth).mockResolvedValue(null as never);

      const result = await getEpisodeImagesAction(1396, 1, 1);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Not authenticated");
      }
    });

    it("checks rate limit", async () => {
      vi.mocked(checkRateLimit).mockResolvedValue({
        error: "Too many attempts. Please try again later.",
      });

      const result = await getEpisodeImagesAction(1396, 1, 1);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Too many attempts");
      }
    });

    it("returns error when TMDB not configured", async () => {
      vi.mocked(isTMDBConfigured).mockReturnValue(false);

      const result = await getEpisodeImagesAction(1396, 1, 1);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("TMDB integration not configured");
      }
    });

    it("returns error when images not found", async () => {
      vi.mocked(getEpisodeImages).mockResolvedValue(null);

      const result = await getEpisodeImagesAction(1396, 1, 99);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Episode images not found");
      }
    });

    it("handles fetch errors", async () => {
      vi.mocked(getEpisodeImages).mockRejectedValue(new Error("Network error"));

      const result = await getEpisodeImagesAction(1396, 1, 1);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Failed to fetch episode images");
      }
    });
  });

  describe("getSeasonDataAction", () => {
    const mockSeason = {
      id: 3572,
      season_number: 1,
      name: "Season 1",
      overview: "Walter White starts cooking meth...",
      poster_path: "/s1-poster.jpg",
      air_date: "2008-01-20",
      episodes: [],
    };

    const mockSeasonImages = {
      posters: [
        {
          file_path: "/s1-p1.jpg",
          width: 500,
          height: 750,
          vote_average: 5.5,
          iso_639_1: "en",
        },
      ],
    };

    it("returns combined season data for authenticated user", async () => {
      vi.mocked(getSeasonDetails).mockResolvedValue(mockSeason);
      vi.mocked(getTVSeasonImages).mockResolvedValue(mockSeasonImages);

      const result = await getSeasonDataAction(1396, 1);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data?.metadata.name).toBe("Season 1");
        expect(result.data?.images.posters).toHaveLength(1);
      }
    });

    it("fetches metadata and images in parallel", async () => {
      vi.mocked(getSeasonDetails).mockResolvedValue(mockSeason);
      vi.mocked(getTVSeasonImages).mockResolvedValue(mockSeasonImages);

      await getSeasonDataAction(1396, 1);

      // Both should have been called
      expect(getSeasonDetails).toHaveBeenCalledWith(1396, 1);
      expect(getTVSeasonImages).toHaveBeenCalledWith(1396, 1);
    });

    it("returns empty posters when images not found", async () => {
      vi.mocked(getSeasonDetails).mockResolvedValue(mockSeason);
      vi.mocked(getTVSeasonImages).mockResolvedValue(null);

      const result = await getSeasonDataAction(1396, 1);

      // Should still succeed with metadata but empty images
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data?.metadata.name).toBe("Season 1");
        expect(result.data?.images.posters).toHaveLength(0);
      }
    });

    it("requires authentication", async () => {
      vi.mocked(auth).mockResolvedValue(null as never);

      const result = await getSeasonDataAction(1396, 1);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Not authenticated");
      }
    });

    it("checks rate limit", async () => {
      vi.mocked(checkRateLimit).mockResolvedValue({
        error: "Too many attempts. Please try again later.",
      });

      const result = await getSeasonDataAction(1396, 1);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Too many attempts");
      }
    });

    it("returns error when TMDB not configured", async () => {
      vi.mocked(isTMDBConfigured).mockReturnValue(false);

      const result = await getSeasonDataAction(1396, 1);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("TMDB integration not configured");
      }
    });

    it("returns error when season not found", async () => {
      vi.mocked(getSeasonDetails).mockResolvedValue(null);
      vi.mocked(getTVSeasonImages).mockResolvedValue(mockSeasonImages);

      const result = await getSeasonDataAction(1396, 99);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Season not found on TMDB");
      }
    });

    it("handles fetch errors", async () => {
      vi.mocked(getSeasonDetails).mockRejectedValue(new Error("Network error"));

      const result = await getSeasonDataAction(1396, 1);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Failed to fetch season data");
      }
    });
  });

  describe("clearTmdbFieldAction", () => {
    const mockItem = {
      id: "item-123",
      userId: "user-123",
      tmdbId: 155,
      tmdbType: "movie",
      tmdbPosterPath: "/poster.jpg",
      tmdbBackdropPath: "/backdrop.jpg",
    };

    it("clears poster path only", async () => {
      vi.mocked(prisma.item.findUnique).mockResolvedValue(mockItem as never);
      vi.mocked(prisma.item.update).mockResolvedValue(mockItem as never);

      const result = await clearTmdbFieldAction("item-123", "poster");

      expect(result).toEqual({ success: true });
      expect(prisma.item.update).toHaveBeenCalledWith({
        where: { id: "item-123" },
        data: { tmdbPosterPath: null },
      });
    });

    it("clears backdrop path and dominant colour", async () => {
      vi.mocked(prisma.item.findUnique).mockResolvedValue(mockItem as never);
      vi.mocked(prisma.item.update).mockResolvedValue(mockItem as never);

      const result = await clearTmdbFieldAction("item-123", "backdrop");

      expect(result).toEqual({ success: true });
      expect(prisma.item.update).toHaveBeenCalledWith({
        where: { id: "item-123" },
        data: { tmdbBackdropPath: null, dominantColour: null },
      });
    });

    it("clears all TMDB fields on full detach", async () => {
      vi.mocked(prisma.item.findUnique).mockResolvedValue(mockItem as never);
      vi.mocked(prisma.item.update).mockResolvedValue(mockItem as never);

      const result = await clearTmdbFieldAction("item-123", "all");

      expect(result).toEqual({ success: true });
      expect(prisma.item.update).toHaveBeenCalledWith({
        where: { id: "item-123" },
        data: {
          tmdbId: null,
          tmdbType: null,
          tmdbPosterPath: null,
          tmdbBackdropPath: null,
          tmdbLogoPath: null,
          dominantColour: null,
          tmdbShowTagline: true,
          tmdbShowMetadata: true,
          tmdbShowGenres: true,
          tmdbShowCast: true,
          tmdbShowProviders: true,
          tmdbShowVideos: true,
          tmdbShowRecommendations: true,
        },
      });
    });

    it("clears logo path only", async () => {
      vi.mocked(prisma.item.findUnique).mockResolvedValue(mockItem as never);
      vi.mocked(prisma.item.update).mockResolvedValue(mockItem as never);

      const result = await clearTmdbFieldAction("item-123", "logo");

      expect(result).toEqual({ success: true });
      expect(prisma.item.update).toHaveBeenCalledWith({
        where: { id: "item-123" },
        data: { tmdbLogoPath: null },
      });
    });

    it("rejects unauthenticated requests", async () => {
      vi.mocked(auth).mockResolvedValue(null as never);

      const result = await clearTmdbFieldAction("item-123", "poster");

      expect(result).toEqual({ success: false, error: "Unauthorized" });
    });

    it("rejects rate-limited requests", async () => {
      vi.mocked(checkRateLimit).mockResolvedValue({
        error: "Too many requests",
      });

      const result = await clearTmdbFieldAction("item-123", "poster");

      expect(result).toEqual({ success: false, error: "Too many requests" });
    });

    it("rejects non-owner requests", async () => {
      vi.mocked(prisma.item.findUnique).mockResolvedValue({
        ...mockItem,
        userId: "other-user",
      } as never);

      const result = await clearTmdbFieldAction("item-123", "poster");

      expect(result).toEqual({ success: false, error: "Unauthorized" });
    });

    it("returns error for non-existent item", async () => {
      vi.mocked(prisma.item.findUnique).mockResolvedValue(null);

      const result = await clearTmdbFieldAction("item-123", "poster");

      expect(result).toEqual({ success: false, error: "Item not found" });
    });

    it("rejects invalid field values via Zod validation", async () => {
      const result = await clearTmdbFieldAction("item-123", "invalid" as never);

      expect(result).toEqual({ success: false, error: "Invalid input" });
      // Should short-circuit before hitting rate limit or auth
      expect(checkRateLimit).not.toHaveBeenCalled();
    });

    it("calls revalidatePath after successful clear", async () => {
      vi.mocked(prisma.item.findUnique).mockResolvedValue(mockItem as never);
      vi.mocked(prisma.item.update).mockResolvedValue(mockItem as never);

      await clearTmdbFieldAction("item-123", "poster");

      const { revalidatePath } = await import("next/cache");
      expect(revalidatePath).toHaveBeenCalledWith("/u", "layout");
    });
  });
});
