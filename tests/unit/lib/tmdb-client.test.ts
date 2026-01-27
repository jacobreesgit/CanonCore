/**
 * Unit tests for TMDB API client.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  searchMedia,
  getMovie,
  getTVShow,
  getPosterUrl,
  getBackdropUrl,
  downloadPoster,
  extractYear,
  truncateOverview,
  isTMDBConfigured,
  isValidImagePath,
  getMovieImages,
  getTVShowImages,
  getBestTextlessBackdrop,
  getTVSeasons,
  getTVEpisodes,
  getEpisodeDetails,
  getStillUrl,
} from "@/lib/tmdb-client";
import type { TMDBMovie, TMDBTVShow, TMDBImages } from "@/lib/tmdb-client";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("tmdb-client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("TMDB_API_KEY", "test-api-key");
  });

  describe("isTMDBConfigured", () => {
    it("returns true when API key is set", () => {
      expect(isTMDBConfigured()).toBe(true);
    });

    it("returns false when API key is empty", () => {
      vi.stubEnv("TMDB_API_KEY", "");
      expect(isTMDBConfigured()).toBe(false);
    });

    it("returns false when API key is not set", () => {
      vi.unstubAllEnvs();
      expect(isTMDBConfigured()).toBe(false);
    });
  });

  describe("searchMedia", () => {
    it("searches movies and TV shows", async () => {
      const mockResults = {
        results: [
          {
            id: 1396,
            media_type: "tv",
            name: "Breaking Bad",
            overview: "A high school chemistry teacher...",
            poster_path: "/poster.jpg",
            first_air_date: "2008-01-20",
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResults),
      });

      const results = await searchMedia("Breaking Bad");

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe("Breaking Bad");
      expect(results[0].mediaType).toBe("tv");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/search/multi?query=Breaking%20Bad"),
        expect.objectContaining({
          headers: {
            "Content-Type": "application/json",
          },
        })
      );
      // Verify API key is passed as query param
      expect(mockFetch.mock.calls[0][0]).toContain("api_key=test-api-key");
    });

    it("filters out person results", async () => {
      const mockResults = {
        results: [
          { id: 1, media_type: "movie", title: "Movie" },
          { id: 2, media_type: "person", name: "Actor" },
          { id: 3, media_type: "tv", name: "Show" },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResults),
      });

      const results = await searchMedia("test");

      expect(results).toHaveLength(2);
      // Verify person results were filtered out (comparing as string since type is "movie" | "tv")
      expect(results.every((r) => (r.mediaType as string) !== "person")).toBe(
        true
      );
    });

    it("returns empty array on error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      const results = await searchMedia("test");

      expect(results).toEqual([]);
    });

    it("returns empty array when API key not configured", async () => {
      vi.stubEnv("TMDB_API_KEY", "");

      const results = await searchMedia("test");

      expect(results).toEqual([]);
    });

    it("returns empty array for empty query", async () => {
      const results = await searchMedia("");
      expect(results).toEqual([]);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("returns empty array for whitespace-only query", async () => {
      const results = await searchMedia("   ");
      expect(results).toEqual([]);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("limits results to 10 items", async () => {
      const mockResults = {
        results: Array.from({ length: 20 }, (_, i) => ({
          id: i,
          media_type: "movie",
          title: `Movie ${i}`,
        })),
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResults),
      });

      const results = await searchMedia("test");

      expect(results).toHaveLength(10);
    });

    it("handles network errors gracefully", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const results = await searchMedia("test");

      expect(results).toEqual([]);
    });

    it("handles timeout errors gracefully", async () => {
      const abortError = new Error("Aborted");
      abortError.name = "AbortError";
      mockFetch.mockRejectedValueOnce(abortError);

      const results = await searchMedia("test");

      expect(results).toEqual([]);
    });
  });

  describe("getMovie", () => {
    it("fetches movie by ID", async () => {
      const mockMovie: TMDBMovie = {
        id: 278,
        title: "The Shawshank Redemption",
        overview: "Framed in the 1940s...",
        poster_path: "/poster.jpg",
        backdrop_path: "/backdrop.jpg",
        release_date: "1994-09-23",
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockMovie),
      });

      const result = await getMovie(278);

      expect(result?.title).toBe("The Shawshank Redemption");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/movie/278?api_key=test-api-key"),
        expect.any(Object)
      );
    });

    it("returns null on error", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });

      const result = await getMovie(999999);

      expect(result).toBeNull();
    });

    it("returns null when API key not configured", async () => {
      vi.stubEnv("TMDB_API_KEY", "");

      const result = await getMovie(278);

      expect(result).toBeNull();
    });
  });

  describe("getTVShow", () => {
    it("fetches TV show by ID", async () => {
      const mockShow: TMDBTVShow = {
        id: 1396,
        name: "Breaking Bad",
        overview: "A chemistry teacher...",
        poster_path: "/poster.jpg",
        backdrop_path: "/backdrop.jpg",
        first_air_date: "2008-01-20",
        number_of_seasons: 5,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockShow),
      });

      const result = await getTVShow(1396);

      expect(result?.name).toBe("Breaking Bad");
      expect(result?.number_of_seasons).toBe(5);
    });

    it("returns null on error", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });

      const result = await getTVShow(999999);

      expect(result).toBeNull();
    });
  });

  describe("getPosterUrl", () => {
    it("returns full URL for valid path", () => {
      const url = getPosterUrl("/abc123.jpg");
      expect(url).toBe("https://image.tmdb.org/t/p/w500/abc123.jpg");
    });

    it("returns null for null path", () => {
      expect(getPosterUrl(null)).toBeNull();
    });

    it("supports different sizes", () => {
      const url = getPosterUrl("/poster.jpg", "w185");
      expect(url).toContain("/w185/");
    });

    it("supports w92 size for thumbnails", () => {
      const url = getPosterUrl("/poster.jpg", "w92");
      expect(url).toBe("https://image.tmdb.org/t/p/w92/poster.jpg");
    });

    it("supports original size", () => {
      const url = getPosterUrl("/poster.jpg", "original");
      expect(url).toBe("https://image.tmdb.org/t/p/original/poster.jpg");
    });
  });

  describe("downloadPoster", () => {
    it("downloads poster as buffer", async () => {
      const mockImageData = new Uint8Array([1, 2, 3, 4]);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(mockImageData.buffer),
      });

      const result = await downloadPoster("/poster.jpg");

      expect(result).toBeInstanceOf(Buffer);
      expect(result?.length).toBe(4);
    });

    it("returns null for null path", async () => {
      const result = await downloadPoster(null);
      expect(result).toBeNull();
    });

    it("returns null on download error", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false });

      const result = await downloadPoster("/poster.jpg");

      expect(result).toBeNull();
    });

    it("returns null on network error", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await downloadPoster("/poster.jpg");

      expect(result).toBeNull();
    });

    it("returns null on timeout error", async () => {
      const abortError = new Error("Aborted");
      abortError.name = "AbortError";
      mockFetch.mockRejectedValueOnce(abortError);

      const result = await downloadPoster("/poster.jpg");

      expect(result).toBeNull();
    });
  });

  describe("extractYear", () => {
    it("extracts year from date string", () => {
      expect(extractYear("2023-07-21")).toBe("2023");
      expect(extractYear("1994-09-23")).toBe("1994");
    });

    it("returns empty for null", () => {
      expect(extractYear(null)).toBe("");
    });

    it("returns empty for undefined", () => {
      expect(extractYear(undefined)).toBe("");
    });

    it("returns empty for empty string", () => {
      expect(extractYear("")).toBe("");
    });

    it("handles malformed date strings", () => {
      expect(extractYear("invalid")).toBe("invalid");
      expect(extractYear("2023")).toBe("2023");
    });
  });

  describe("truncateOverview", () => {
    it("truncates long text with ellipsis", () => {
      const long = "a".repeat(250);
      const result = truncateOverview(long, 200);
      expect(result.length).toBe(200);
      expect(result.endsWith("...")).toBe(true);
    });

    it("returns short text unchanged", () => {
      expect(truncateOverview("Short text", 200)).toBe("Short text");
    });

    it("uses default max length of 1000", () => {
      const long = "a".repeat(1100);
      const result = truncateOverview(long);
      expect(result.length).toBe(1000);
    });

    it("handles empty string", () => {
      expect(truncateOverview("")).toBe("");
    });

    it("handles text exactly at max length", () => {
      const exact = "a".repeat(200);
      expect(truncateOverview(exact, 200)).toBe(exact);
    });
  });

  describe("isValidImagePath", () => {
    it("returns true for valid jpg paths", () => {
      expect(isValidImagePath("/abc123.jpg")).toBe(true);
      expect(isValidImagePath("/xYz789ABC.jpg")).toBe(true);
    });

    it("returns true for valid png paths", () => {
      expect(isValidImagePath("/poster123.png")).toBe(true);
    });

    it("returns false for null", () => {
      expect(isValidImagePath(null)).toBe(false);
    });

    it("returns false for paths without leading slash", () => {
      expect(isValidImagePath("abc123.jpg")).toBe(false);
    });

    it("returns false for paths with traversal", () => {
      expect(isValidImagePath("/../secret.jpg")).toBe(false);
      expect(isValidImagePath("/../../etc/passwd")).toBe(false);
    });

    it("returns false for paths with subdirectories", () => {
      expect(isValidImagePath("/sub/dir/image.jpg")).toBe(false);
    });

    it("returns false for invalid extensions", () => {
      expect(isValidImagePath("/image.gif")).toBe(false);
      expect(isValidImagePath("/image.webp")).toBe(false);
      expect(isValidImagePath("/script.js")).toBe(false);
    });

    it("returns false for empty path", () => {
      expect(isValidImagePath("")).toBe(false);
    });
  });

  describe("getBackdropUrl", () => {
    it("returns full URL for valid path with original size by default", () => {
      const url = getBackdropUrl("/abc123.jpg");
      expect(url).toBe("https://image.tmdb.org/t/p/original/abc123.jpg");
    });

    it("returns null for null path", () => {
      expect(getBackdropUrl(null)).toBeNull();
    });

    it("returns null for invalid path", () => {
      expect(getBackdropUrl("invalid")).toBeNull();
      expect(getBackdropUrl("/../malicious.jpg")).toBeNull();
    });

    it("supports w300 size for thumbnails", () => {
      const url = getBackdropUrl("/backdrop.jpg", "w300");
      expect(url).toBe("https://image.tmdb.org/t/p/w300/backdrop.jpg");
    });

    it("supports w780 size", () => {
      const url = getBackdropUrl("/backdrop.jpg", "w780");
      expect(url).toBe("https://image.tmdb.org/t/p/w780/backdrop.jpg");
    });

    it("supports original size", () => {
      const url = getBackdropUrl("/backdrop.jpg", "original");
      expect(url).toBe("https://image.tmdb.org/t/p/original/backdrop.jpg");
    });
  });

  describe("getMovieImages", () => {
    const mockImagesResponse: TMDBImages = {
      backdrops: [
        {
          file_path: "/back1.jpg",
          vote_average: 5.5,
          iso_639_1: "en",
          width: 1920,
          height: 1080,
        },
        {
          file_path: "/back2.jpg",
          vote_average: 8.0,
          iso_639_1: null,
          width: 1920,
          height: 1080,
        },
        {
          file_path: "/back3.jpg",
          vote_average: 6.5,
          iso_639_1: "de",
          width: 1920,
          height: 1080,
        },
      ],
      posters: [
        {
          file_path: "/post1.jpg",
          vote_average: 7.0,
          iso_639_1: "en",
          width: 500,
          height: 750,
        },
        {
          file_path: "/post2.jpg",
          vote_average: 9.0,
          iso_639_1: null,
          width: 500,
          height: 750,
        },
      ],
    };

    it("fetches and sorts movie images by vote average", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockImagesResponse),
      });

      const result = await getMovieImages(278);

      expect(result).not.toBeNull();
      expect(result!.backdrops).toHaveLength(3);
      expect(result!.posters).toHaveLength(2);

      // Verify sorted by vote_average (highest first)
      expect(result!.backdrops[0].vote_average).toBe(8.0);
      expect(result!.backdrops[1].vote_average).toBe(6.5);
      expect(result!.backdrops[2].vote_average).toBe(5.5);

      expect(result!.posters[0].vote_average).toBe(9.0);
      expect(result!.posters[1].vote_average).toBe(7.0);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/movie/278/images?api_key=test-api-key"),
        expect.any(Object)
      );
    });

    it("filters out images with invalid paths", async () => {
      const responseWithInvalid: TMDBImages = {
        backdrops: [
          {
            file_path: "/valid.jpg",
            vote_average: 5.0,
            iso_639_1: null,
            width: 1920,
            height: 1080,
          },
          {
            file_path: "/../malicious.jpg",
            vote_average: 9.0,
            iso_639_1: null,
            width: 1920,
            height: 1080,
          },
          {
            file_path: "/another.png",
            vote_average: 6.0,
            iso_639_1: null,
            width: 1920,
            height: 1080,
          },
        ],
        posters: [
          {
            file_path: "/sub/dir/image.jpg",
            vote_average: 8.0,
            iso_639_1: null,
            width: 500,
            height: 750,
          },
          {
            file_path: "/good.jpg",
            vote_average: 7.0,
            iso_639_1: null,
            width: 500,
            height: 750,
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(responseWithInvalid),
      });

      const result = await getMovieImages(123);

      expect(result!.backdrops).toHaveLength(2);
      expect(result!.posters).toHaveLength(1);
      expect(
        result!.backdrops.every((b) => isValidImagePath(b.file_path))
      ).toBe(true);
    });

    it("returns null on API error", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });

      const result = await getMovieImages(999999);

      expect(result).toBeNull();
    });

    it("returns null when API key not configured", async () => {
      vi.stubEnv("TMDB_API_KEY", "");

      const result = await getMovieImages(278);

      expect(result).toBeNull();
    });

    it("handles empty arrays gracefully", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ backdrops: [], posters: [] }),
      });

      const result = await getMovieImages(278);

      expect(result).not.toBeNull();
      expect(result!.backdrops).toHaveLength(0);
      expect(result!.posters).toHaveLength(0);
    });

    it("handles missing arrays gracefully", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const result = await getMovieImages(278);

      expect(result).not.toBeNull();
      expect(result!.backdrops).toHaveLength(0);
      expect(result!.posters).toHaveLength(0);
    });

    it("handles network errors gracefully", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await getMovieImages(278);

      expect(result).toBeNull();
    });
  });

  describe("getTVShowImages", () => {
    const mockImagesResponse: TMDBImages = {
      backdrops: [
        {
          file_path: "/tvback1.jpg",
          vote_average: 7.2,
          iso_639_1: "en",
          width: 1920,
          height: 1080,
        },
        {
          file_path: "/tvback2.jpg",
          vote_average: 8.5,
          iso_639_1: null,
          width: 1920,
          height: 1080,
        },
      ],
      posters: [
        {
          file_path: "/tvpost1.jpg",
          vote_average: 8.0,
          iso_639_1: "en",
          width: 500,
          height: 750,
        },
        {
          file_path: "/tvpost2.jpg",
          vote_average: 6.0,
          iso_639_1: null,
          width: 500,
          height: 750,
        },
      ],
    };

    it("fetches and sorts TV show images by vote average", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockImagesResponse),
      });

      const result = await getTVShowImages(1396);

      expect(result).not.toBeNull();
      expect(result!.backdrops).toHaveLength(2);
      expect(result!.posters).toHaveLength(2);

      // Verify sorted by vote_average (highest first)
      expect(result!.backdrops[0].vote_average).toBe(8.5);
      expect(result!.backdrops[1].vote_average).toBe(7.2);

      expect(result!.posters[0].vote_average).toBe(8.0);
      expect(result!.posters[1].vote_average).toBe(6.0);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/tv/1396/images?api_key=test-api-key"),
        expect.any(Object)
      );
    });

    it("returns null on API error", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });

      const result = await getTVShowImages(999999);

      expect(result).toBeNull();
    });

    it("returns null when API key not configured", async () => {
      vi.stubEnv("TMDB_API_KEY", "");

      const result = await getTVShowImages(1396);

      expect(result).toBeNull();
    });

    it("filters out images with invalid paths", async () => {
      const responseWithInvalid: TMDBImages = {
        backdrops: [
          {
            file_path: "/valid.jpg",
            vote_average: 5.0,
            iso_639_1: null,
            width: 1920,
            height: 1080,
          },
          {
            file_path: "no-slash.jpg",
            vote_average: 9.0,
            iso_639_1: null,
            width: 1920,
            height: 1080,
          },
        ],
        posters: [
          {
            file_path: "/good.jpg",
            vote_average: 8.0,
            iso_639_1: null,
            width: 500,
            height: 750,
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(responseWithInvalid),
      });

      const result = await getTVShowImages(1396);

      expect(result!.backdrops).toHaveLength(1);
      expect(result!.backdrops[0].file_path).toBe("/valid.jpg");
    });
  });

  describe("getBestTextlessBackdrop", () => {
    it("returns textless backdrop with highest vote average", () => {
      const images: TMDBImages = {
        backdrops: [
          {
            file_path: "/text1.jpg",
            vote_average: 9.0,
            iso_639_1: "en",
            width: 1920,
            height: 1080,
          },
          {
            file_path: "/textless1.jpg",
            vote_average: 7.0,
            iso_639_1: null,
            width: 1920,
            height: 1080,
          },
          {
            file_path: "/textless2.jpg",
            vote_average: 8.0,
            iso_639_1: null,
            width: 1920,
            height: 1080,
          },
          {
            file_path: "/text2.jpg",
            vote_average: 8.5,
            iso_639_1: "de",
            width: 1920,
            height: 1080,
          },
        ],
        posters: [],
      };

      // Note: backdrops should be pre-sorted by getMovieImages/getTVShowImages
      // but getBestTextlessBackdrop works on already sorted arrays
      const sortedImages: TMDBImages = {
        backdrops: [...images.backdrops].sort(
          (a, b) => b.vote_average - a.vote_average
        ),
        posters: [],
      };

      const result = getBestTextlessBackdrop(sortedImages);

      // Should prefer textless, and among textless pick highest vote
      expect(result).toBe("/textless2.jpg");
    });

    it("falls back to any backdrop when no textless available", () => {
      const images: TMDBImages = {
        backdrops: [
          {
            file_path: "/text1.jpg",
            vote_average: 8.0,
            iso_639_1: "en",
            width: 1920,
            height: 1080,
          },
          {
            file_path: "/text2.jpg",
            vote_average: 9.0,
            iso_639_1: "de",
            width: 1920,
            height: 1080,
          },
        ],
        posters: [],
      };

      // Pre-sort as the function expects
      const sortedImages: TMDBImages = {
        backdrops: [...images.backdrops].sort(
          (a, b) => b.vote_average - a.vote_average
        ),
        posters: [],
      };

      const result = getBestTextlessBackdrop(sortedImages);

      // Falls back to first (highest voted) since no textless
      expect(result).toBe("/text2.jpg");
    });

    it("returns null for empty backdrops array", () => {
      const images: TMDBImages = {
        backdrops: [],
        posters: [
          {
            file_path: "/poster.jpg",
            vote_average: 8.0,
            iso_639_1: null,
            width: 500,
            height: 750,
          },
        ],
      };

      const result = getBestTextlessBackdrop(images);

      expect(result).toBeNull();
    });

    it("returns null for undefined backdrops", () => {
      const images = {
        backdrops: undefined,
        posters: [],
      } as unknown as TMDBImages;

      const result = getBestTextlessBackdrop(images);

      expect(result).toBeNull();
    });

    it("handles single textless backdrop", () => {
      const images: TMDBImages = {
        backdrops: [
          {
            file_path: "/only.jpg",
            vote_average: 5.0,
            iso_639_1: null,
            width: 1920,
            height: 1080,
          },
        ],
        posters: [],
      };

      const result = getBestTextlessBackdrop(images);

      expect(result).toBe("/only.jpg");
    });

    it("handles single non-textless backdrop", () => {
      const images: TMDBImages = {
        backdrops: [
          {
            file_path: "/withtext.jpg",
            vote_average: 5.0,
            iso_639_1: "en",
            width: 1920,
            height: 1080,
          },
        ],
        posters: [],
      };

      const result = getBestTextlessBackdrop(images);

      expect(result).toBe("/withtext.jpg");
    });
  });

  describe("getTVSeasons", () => {
    it("fetches and sorts seasons by season number", async () => {
      const mockShowWithSeasons = {
        seasons: [
          {
            id: 3,
            season_number: 2,
            name: "Season 2",
            overview: "Second season",
            poster_path: "/s2.jpg",
            episode_count: 13,
            air_date: "2009-03-08",
          },
          {
            id: 1,
            season_number: 0,
            name: "Specials",
            overview: "Special episodes",
            poster_path: null,
            episode_count: 5,
            air_date: null,
          },
          {
            id: 2,
            season_number: 1,
            name: "Season 1",
            overview: "First season",
            poster_path: "/s1.jpg",
            episode_count: 7,
            air_date: "2008-01-20",
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockShowWithSeasons),
      });

      const result = await getTVSeasons(1396);

      expect(result).not.toBeNull();
      expect(result).toHaveLength(3);
      // Verify sorted by season_number
      expect(result![0].season_number).toBe(0);
      expect(result![1].season_number).toBe(1);
      expect(result![2].season_number).toBe(2);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/tv/1396?api_key=test-api-key"),
        expect.any(Object)
      );
    });

    it("returns null when seasons array is missing", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const result = await getTVSeasons(1396);

      expect(result).toBeNull();
    });

    it("returns null on API error", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });

      const result = await getTVSeasons(999999);

      expect(result).toBeNull();
    });

    it("returns null when API key not configured", async () => {
      vi.stubEnv("TMDB_API_KEY", "");

      const result = await getTVSeasons(1396);

      expect(result).toBeNull();
    });
  });

  describe("getTVEpisodes", () => {
    it("fetches and sorts episodes by episode number", async () => {
      const mockSeason = {
        id: 1,
        season_number: 1,
        episodes: [
          {
            id: 103,
            episode_number: 3,
            name: "Episode 3",
            overview: "Third episode",
            still_path: "/ep3.jpg",
          },
          {
            id: 101,
            episode_number: 1,
            name: "Episode 1",
            overview: "First episode",
            still_path: "/ep1.jpg",
          },
          {
            id: 102,
            episode_number: 2,
            name: "Episode 2",
            overview: "Second episode",
            still_path: null,
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSeason),
      });

      const result = await getTVEpisodes(1396, 1);

      expect(result).not.toBeNull();
      expect(result).toHaveLength(3);
      // Verify sorted by episode_number
      expect(result![0].episode_number).toBe(1);
      expect(result![1].episode_number).toBe(2);
      expect(result![2].episode_number).toBe(3);
    });

    it("returns null when episodes array is missing", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 1, season_number: 1 }),
      });

      const result = await getTVEpisodes(1396, 1);

      expect(result).toBeNull();
    });

    it("returns null on API error", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });

      const result = await getTVEpisodes(1396, 99);

      expect(result).toBeNull();
    });
  });

  describe("getEpisodeDetails", () => {
    it("fetches episode details", async () => {
      const mockEpisode = {
        id: 62085,
        episode_number: 1,
        season_number: 1,
        name: "Pilot",
        overview: "A high school chemistry teacher...",
        still_path: "/pilot.jpg",
        air_date: "2008-01-20",
        runtime: 58,
        vote_average: 8.2,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockEpisode),
      });

      const result = await getEpisodeDetails(1396, 1, 1);

      expect(result).not.toBeNull();
      expect(result!.name).toBe("Pilot");
      expect(result!.episode_number).toBe(1);
      expect(result!.season_number).toBe(1);
      expect(result!.still_path).toBe("/pilot.jpg");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(
          "/tv/1396/season/1/episode/1?api_key=test-api-key"
        ),
        expect.any(Object)
      );
    });

    it("returns null on API error", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });

      const result = await getEpisodeDetails(1396, 1, 99);

      expect(result).toBeNull();
    });

    it("returns null when API key not configured", async () => {
      vi.stubEnv("TMDB_API_KEY", "");

      const result = await getEpisodeDetails(1396, 1, 1);

      expect(result).toBeNull();
    });
  });

  describe("getStillUrl", () => {
    it("returns full URL for valid path", () => {
      const url = getStillUrl("/abc123.jpg");
      expect(url).toBe("https://image.tmdb.org/t/p/w300/abc123.jpg");
    });

    it("returns null for null path", () => {
      expect(getStillUrl(null)).toBeNull();
    });

    it("returns null for invalid path", () => {
      expect(getStillUrl("invalid")).toBeNull();
      expect(getStillUrl("/../malicious.jpg")).toBeNull();
    });

    it("supports w780 size", () => {
      const url = getStillUrl("/still.jpg", "w780");
      expect(url).toBe("https://image.tmdb.org/t/p/w780/still.jpg");
    });

    it("supports w1280 size", () => {
      const url = getStillUrl("/still.jpg", "w1280");
      expect(url).toBe("https://image.tmdb.org/t/p/w1280/still.jpg");
    });
  });
});
