/**
 * Unit tests for TMDB API client.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  searchMedia,
  getMovie,
  getTVShow,
  getPosterUrl,
  downloadPoster,
  extractYear,
  truncateOverview,
  isTMDBConfigured,
} from "@/lib/tmdb-client";
import type { TMDBMovie, TMDBTVShow } from "@/lib/tmdb-client";

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
});
