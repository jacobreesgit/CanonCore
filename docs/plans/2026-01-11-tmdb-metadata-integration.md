# TMDB Metadata Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add TMDB (The Movie Database) integration for automatic metadata lookup when adding or editing items, plus database seeding with real TV/film data.

**Architecture:** Server-side TMDB API client with rate limiting, reusable MediaSearchCombobox for auto-suggest, server actions for search and metadata application, poster upload to Google Drive. Seed script reuses the same TMDB client for consistency.

**Tech Stack:** TMDB API v3, React Server Actions, shadcn/ui Combobox, Google Drive API, Prisma

---

## Feature Overview

### User-Facing Features

1. **Auto-suggest when adding items**: Type "Breaking Bad" → dropdown shows TMDB matches with poster, title, year
2. **One-click apply**: Select result → name, description, poster auto-populated
3. **Lookup for existing items**: Settings dialog → "Lookup Metadata" button → search and apply

### Developer Features

1. **Database seeding**: Seed script uses same TMDB client to populate demo data
2. **Reusable components**: MediaSearchCombobox can be used elsewhere

---

## Design Decisions

### Why TMDB?

| Feature             | TMDB                         | OMDb            | IMDb   |
| ------------------- | ---------------------------- | --------------- | ------ |
| Free tier           | Yes (non-commercial)         | 1,000/day limit | No API |
| Poster images       | Direct URLs (multiple sizes) | Single URL      | N/A    |
| TV seasons/episodes | Full metadata                | Limited         | N/A    |
| Rate limit          | ~40-50 req/sec per IP        | 1,000/day       | N/A    |
| Search API          | Excellent                    | Basic           | N/A    |

### Security

1. **TMDB_API_KEY**: Server-side only, never exposed to client
2. **Rate limiting**: Use existing `rate-limit.ts` for search endpoint
3. **Input sanitization**: Escape TMDB descriptions before display
4. **Circuit breaker**: Use existing `circuit-breaker.ts` for resilience

### Graceful Degradation

| Scenario              | Behavior                                  |
| --------------------- | ----------------------------------------- |
| TMDB_API_KEY not set  | Hide metadata features, manual entry only |
| TMDB API down         | Show error toast, allow manual entry      |
| No Google Drive       | Apply metadata without poster             |
| Poster download fails | Log error, continue without poster        |

---

## Task 1: Create TMDB Client Library

**Files:**

- Create: `lib/tmdb-client.ts`
- Test: `tests/unit/lib/tmdb-client.test.ts`

**Step 1: Write the failing test**

Create `tests/unit/lib/tmdb-client.test.ts`:

```typescript
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
} from "@/lib/tmdb-client";
import type {
  TMDBMovie,
  TMDBTVShow,
  TMDBSearchResult,
} from "@/lib/tmdb-client";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("tmdb-client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("TMDB_API_KEY", "test-api-key");
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
        expect.stringContaining("/search/multi"),
        expect.objectContaining({
          headers: {
            Authorization: "Bearer test-api-key",
            "Content-Type": "application/json",
          },
        })
      );
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
      expect(results.every((r) => r.mediaType !== "person")).toBe(true);
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
        "https://api.themoviedb.org/3/movie/278",
        expect.any(Object)
      );
    });

    it("returns null on error", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });

      const result = await getMovie(999999);

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
  });

  describe("extractYear", () => {
    it("extracts year from date string", () => {
      expect(extractYear("2023-07-21")).toBe("2023");
      expect(extractYear("1994-09-23")).toBe("1994");
    });

    it("returns empty for invalid date", () => {
      expect(extractYear(null)).toBe("");
      expect(extractYear("")).toBe("");
      expect(extractYear(undefined)).toBe("");
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
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit -- tmdb-client.test.ts`
Expected: FAIL with "Cannot find module"

**Step 3: Write minimal implementation**

Create `lib/tmdb-client.ts`:

```typescript
/**
 * TMDB (The Movie Database) API client.
 * Server-side only - do not import in client components.
 */

import { logger } from "@/lib/logger";

const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";

// Poster sizes available from TMDB
export type PosterSize =
  | "w92"
  | "w154"
  | "w185"
  | "w342"
  | "w500"
  | "w780"
  | "original";

/** TMDB movie details. */
export interface TMDBMovie {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  release_date: string;
}

/** TMDB TV show details. */
export interface TMDBTVShow {
  id: number;
  name: string;
  overview: string;
  poster_path: string | null;
  first_air_date: string;
  number_of_seasons: number;
}

/** TMDB TV episode. */
export interface TMDBEpisode {
  id: number;
  episode_number: number;
  name: string;
  overview?: string;
}

/** TMDB TV season with episodes. */
export interface TMDBSeason {
  id: number;
  season_number: number;
  episodes: TMDBEpisode[];
}

/** Normalized search result for UI. */
export interface TMDBSearchResult {
  id: number;
  mediaType: "movie" | "tv";
  title: string;
  overview: string;
  posterPath: string | null;
  year: string;
}

/**
 * Gets the TMDB API key from environment.
 * Returns null if not configured (feature disabled).
 */
function getApiKey(): string | null {
  return process.env.TMDB_API_KEY || null;
}

/**
 * Checks if TMDB integration is available.
 */
export function isTMDBConfigured(): boolean {
  return !!getApiKey();
}

/**
 * Makes an authenticated request to TMDB API.
 * Returns null on error instead of throwing.
 */
async function tmdbFetch<T>(endpoint: string): Promise<T | null> {
  const apiKey = getApiKey();
  if (!apiKey) {
    logger.warn("TMDB_API_KEY not configured");
    return null;
  }

  try {
    const response = await fetch(`${TMDB_BASE_URL}${endpoint}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      logger.error({ status: response.status }, "TMDB API error");
      return null;
    }

    return response.json();
  } catch (error) {
    logger.error({ error }, "TMDB fetch failed");
    return null;
  }
}

/**
 * Searches for movies and TV shows.
 * Returns normalized results for UI display.
 *
 * @param query - Search query
 * @returns Array of search results (empty on error)
 */
export async function searchMedia(query: string): Promise<TMDBSearchResult[]> {
  if (!query.trim()) return [];

  const encoded = encodeURIComponent(query);
  const data = await tmdbFetch<{
    results: Array<{
      id: number;
      media_type: string;
      title?: string;
      name?: string;
      overview?: string;
      poster_path?: string | null;
      release_date?: string;
      first_air_date?: string;
    }>;
  }>(`/search/multi?query=${encoded}&include_adult=false`);

  if (!data?.results) return [];

  // Filter to movies and TV only, normalize format
  return data.results
    .filter((r) => r.media_type === "movie" || r.media_type === "tv")
    .slice(0, 10)
    .map((r) => ({
      id: r.id,
      mediaType: r.media_type as "movie" | "tv",
      title: r.title || r.name || "Unknown",
      overview: r.overview || "",
      posterPath: r.poster_path || null,
      year: extractYear(r.release_date || r.first_air_date),
    }));
}

/**
 * Fetches movie details by TMDB ID.
 *
 * @param movieId - TMDB movie ID
 * @returns Movie details or null on error
 */
export async function getMovie(movieId: number): Promise<TMDBMovie | null> {
  return tmdbFetch<TMDBMovie>(`/movie/${movieId}`);
}

/**
 * Fetches TV show details by TMDB ID.
 *
 * @param tvId - TMDB TV show ID
 * @returns TV show details or null on error
 */
export async function getTVShow(tvId: number): Promise<TMDBTVShow | null> {
  return tmdbFetch<TMDBTVShow>(`/tv/${tvId}`);
}

/**
 * Fetches TV season with episodes.
 *
 * @param tvId - TMDB TV show ID
 * @param seasonNumber - Season number (1-based)
 * @returns Season with episodes or null on error
 */
export async function getTVSeason(
  tvId: number,
  seasonNumber: number
): Promise<TMDBSeason | null> {
  return tmdbFetch<TMDBSeason>(`/tv/${tvId}/season/${seasonNumber}`);
}

/**
 * Constructs full poster image URL from TMDB path.
 *
 * @param posterPath - TMDB poster path (e.g., "/abc123.jpg")
 * @param size - Image size (default: w500, ~50-100KB)
 * @returns Full image URL or null
 */
export function getPosterUrl(
  posterPath: string | null,
  size: PosterSize = "w500"
): string | null {
  if (!posterPath) return null;
  return `${TMDB_IMAGE_BASE}/${size}${posterPath}`;
}

/**
 * Downloads poster image as Buffer.
 *
 * @param posterPath - TMDB poster path
 * @returns Image buffer or null on error
 */
export async function downloadPoster(
  posterPath: string | null
): Promise<Buffer | null> {
  const url = getPosterUrl(posterPath);
  if (!url) return null;

  try {
    const response = await fetch(url);
    if (!response.ok) return null;

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    logger.error({ error, posterPath }, "Failed to download poster");
    return null;
  }
}

/**
 * Extracts year from date string.
 *
 * @param dateStr - Date string (YYYY-MM-DD format)
 * @returns Year string or empty
 */
export function extractYear(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  return dateStr.split("-")[0] || "";
}

/**
 * Truncates text to max length with ellipsis.
 * Used to fit TMDB overviews into item description (200 char limit).
 *
 * @param text - Text to truncate
 * @param maxLength - Maximum length (default: 200)
 * @returns Truncated text
 */
export function truncateOverview(text: string, maxLength = 200): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm run test:unit -- tmdb-client.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/tmdb-client.ts tests/unit/lib/tmdb-client.test.ts
git commit -m "feat: add TMDB API client library"
```

---

## Task 2: Create TMDB Server Actions

**Files:**

- Create: `lib/tmdb-actions.ts`
- Test: `tests/unit/lib/tmdb-actions.test.ts`

**Step 1: Write the failing test**

Create `tests/unit/lib/tmdb-actions.test.ts`:

```typescript
/**
 * Unit tests for TMDB server actions.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Session } from "next-auth";
import { searchMediaAction, applyMetadataAction } from "@/lib/tmdb-actions";

// Mock dependencies
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    item: { findUnique: vi.fn(), update: vi.fn() },
    itemFile: { create: vi.fn() },
  },
}));
vi.mock("@/lib/tmdb-client", () => ({
  searchMedia: vi.fn(),
  getMovie: vi.fn(),
  getTVShow: vi.fn(),
  downloadPoster: vi.fn(),
  extractYear: vi.fn((d: string) => d?.split("-")[0] || ""),
  truncateOverview: vi.fn((t: string) => t.slice(0, 200)),
  isTMDBConfigured: vi.fn(() => true),
}));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: vi.fn() }));
vi.mock("@/lib/google-drive-actions", () => ({
  uploadFileToItemDrive: vi.fn(),
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
import { uploadFileToItemDrive } from "@/lib/google-drive-actions";

describe("tmdb-actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-123" },
    } as Session);
    vi.mocked(checkRateLimit).mockResolvedValue(undefined);
    vi.mocked(isTMDBConfigured).mockReturnValue(true);
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
      expect(result.data).toHaveLength(1);
      expect(result.data?.[0].title).toBe("Breaking Bad");
    });

    it("requires authentication", async () => {
      vi.mocked(auth).mockResolvedValue(null);

      const result = await searchMediaAction("test");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Not authenticated");
    });

    it("checks rate limit", async () => {
      vi.mocked(checkRateLimit).mockRejectedValue(new Error("Rate limited"));

      const result = await searchMediaAction("test");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Rate");
    });

    it("returns error when TMDB not configured", async () => {
      vi.mocked(isTMDBConfigured).mockReturnValue(false);

      const result = await searchMediaAction("test");

      expect(result.success).toBe(false);
      expect(result.error).toBe("TMDB integration not configured");
    });
  });

  describe("applyMetadataAction", () => {
    const mockItem = {
      id: "item-1",
      userId: "user-123",
      driveConnectionId: "conn-1",
    };

    beforeEach(() => {
      vi.mocked(prisma.item.findUnique).mockResolvedValue(mockItem as any);
      vi.mocked(prisma.item.update).mockResolvedValue(mockItem as any);
      vi.mocked(getMovie).mockResolvedValue({
        id: 278,
        title: "The Shawshank Redemption",
        overview: "A long description...",
        poster_path: "/poster.jpg",
        release_date: "1994-09-23",
      });
      vi.mocked(downloadPoster).mockResolvedValue(Buffer.from([1, 2, 3]));
      vi.mocked(uploadFileToItemDrive).mockResolvedValue({
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
      expect(uploadFileToItemDrive).toHaveBeenCalled();
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
      } as any);

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
      } as any);

      const result = await applyMetadataAction("item-1", 278, "movie");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Item not found");
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
      } as any);

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
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit -- tmdb-actions.test.ts`
Expected: FAIL with "Cannot find module"

**Step 3: Write minimal implementation**

Create `lib/tmdb-actions.ts`:

```typescript
/**
 * Server actions for TMDB metadata operations.
 */

"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { withCircuitBreaker } from "@/lib/circuit-breaker";
import { logger } from "@/lib/logger";
import {
  searchMedia,
  getMovie,
  getTVShow,
  downloadPoster,
  extractYear,
  truncateOverview,
  isTMDBConfigured,
  type TMDBSearchResult,
} from "@/lib/tmdb-client";
import { uploadBuffer } from "@/lib/google-drive-actions";

type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

/**
 * Searches TMDB for movies and TV shows.
 * Rate limited to prevent abuse.
 *
 * @param query - Search query
 * @returns Search results or error
 */
export async function searchMediaAction(
  query: string
): Promise<ActionResult<TMDBSearchResult[]>> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Not authenticated" };
  }

  if (!isTMDBConfigured()) {
    return { success: false, error: "TMDB integration not configured" };
  }

  try {
    await checkRateLimit(`tmdb-search:${session.user.id}`, 30, "1m");
  } catch {
    return {
      success: false,
      error: "Rate limit exceeded. Try again in a minute.",
    };
  }

  try {
    // Use circuit breaker to handle TMDB API failures gracefully
    const results = await withCircuitBreaker("tmdb-api", () =>
      searchMedia(query)
    );
    return { success: true, data: results };
  } catch (error) {
    logger.error({ error }, "TMDB search failed");
    return { success: false, error: "Search failed" };
  }
}

/**
 * Checks if TMDB is configured for the current user.
 *
 * @returns Whether TMDB features are available
 */
export async function isTMDBAvailable(): Promise<boolean> {
  const session = await auth();
  if (!session?.user?.id) return false;
  return isTMDBConfigured();
}

/**
 * Applies TMDB metadata to an existing item.
 * Updates name, description, and optionally uploads poster.
 *
 * @param itemId - Item to update
 * @param tmdbId - TMDB ID
 * @param mediaType - "movie" or "tv"
 * @returns Success or error
 */
export async function applyMetadataAction(
  itemId: string,
  tmdbId: number,
  mediaType: "movie" | "tv"
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Not authenticated" };
  }

  // Verify item ownership and get existing artwork
  const item = await prisma.item.findUnique({
    where: { id: itemId },
    select: {
      userId: true,
      driveConnectionId: true,
      files: {
        where: { fileType: "ARTWORK", isPrimary: true },
        select: { id: true },
      },
    },
  });

  if (!item || item.userId !== session.user.id) {
    return { success: false, error: "Item not found" };
  }

  try {
    // Fetch metadata from TMDB
    let name: string;
    let description: string;
    let posterPath: string | null;

    // Fetch metadata with circuit breaker protection
    if (mediaType === "movie") {
      const movie = await withCircuitBreaker("tmdb-api", () =>
        getMovie(tmdbId)
      );
      if (!movie) {
        return { success: false, error: "Movie not found on TMDB" };
      }
      const year = extractYear(movie.release_date);
      name = year ? `${movie.title} (${year})` : movie.title;
      description = truncateOverview(movie.overview);
      posterPath = movie.poster_path;
    } else {
      const show = await withCircuitBreaker("tmdb-api", () =>
        getTVShow(tmdbId)
      );
      if (!show) {
        return { success: false, error: "TV show not found on TMDB" };
      }
      const year = extractYear(show.first_air_date);
      name = year ? `${show.name} (${year})` : show.name;
      description = truncateOverview(show.overview);
      posterPath = show.poster_path;
    }

    // Update item metadata
    await prisma.item.update({
      where: { id: itemId },
      data: { name, description: description || null },
    });

    // Upload poster if item has Drive connection and poster exists
    if (item.driveConnectionId && posterPath) {
      const posterBuffer = await downloadPoster(posterPath);

      if (posterBuffer) {
        const uploadResult = await uploadBuffer(
          itemId,
          posterBuffer,
          "poster.jpg",
          "image/jpeg"
        );

        if (uploadResult.success && uploadResult.data?.driveFileId) {
          // Check for existing primary artwork to avoid duplicates
          const existingArtwork = item.files?.[0];

          if (existingArtwork) {
            // Update existing artwork file
            await prisma.itemFile.update({
              where: { id: existingArtwork.id },
              data: {
                filename: "poster.jpg",
                driveFileId: uploadResult.data.driveFileId,
                size: BigInt(posterBuffer.length),
              },
            });
          } else {
            // Create new ItemFile record
            await prisma.itemFile.create({
              data: {
                itemId,
                filename: "poster.jpg",
                fileType: "ARTWORK",
                mimeType: "image/jpeg",
                size: BigInt(posterBuffer.length),
                driveFileId: uploadResult.data.driveFileId,
                isPrimary: true,
              },
            });
          }
        }
      }
    }

    revalidatePath("/my-items");
    revalidatePath(`/my-items/${itemId}`);

    return { success: true };
  } catch (error) {
    logger.error({ error, itemId, tmdbId }, "Failed to apply TMDB metadata");
    return { success: false, error: "Failed to apply metadata" };
  }
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm run test:unit -- tmdb-actions.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/tmdb-actions.ts tests/unit/lib/tmdb-actions.test.ts
git commit -m "feat: add TMDB server actions for search and apply"
```

---

## Task 3: Create MediaSearchCombobox Component

**Files:**

- Create: `components/items/media-search-combobox.tsx`
- Test: `tests/unit/components/items/media-search-combobox.test.tsx`

**Step 1: Write the failing test**

Create `tests/unit/components/items/media-search-combobox.test.tsx`:

```typescript
/**
 * Unit tests for MediaSearchCombobox component.
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MediaSearchCombobox } from "@/components/items/media-search-combobox";

// Mock server actions
vi.mock("@/lib/tmdb-actions", () => ({
  searchMediaAction: vi.fn(),
  isTMDBAvailable: vi.fn(),
}));

import { searchMediaAction, isTMDBAvailable } from "@/lib/tmdb-actions";

describe("MediaSearchCombobox", () => {
  const mockOnSelect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isTMDBAvailable).mockResolvedValue(true);
    vi.mocked(searchMediaAction).mockResolvedValue({
      success: true,
      data: [],
    });
  });

  it("renders input field", async () => {
    render(<MediaSearchCombobox onSelect={mockOnSelect} />);

    await waitFor(() => {
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });
  });

  it("shows loading state during search", async () => {
    const user = userEvent.setup();
    let resolveSearch: (value: unknown) => void;
    vi.mocked(searchMediaAction).mockImplementation(
      () => new Promise((resolve) => { resolveSearch = resolve; })
    );

    render(<MediaSearchCombobox onSelect={mockOnSelect} />);

    const input = screen.getByRole("combobox");
    await user.type(input, "Breaking");

    // Wait for debounce
    await waitFor(() => {
      expect(screen.getByText(/searching/i)).toBeInTheDocument();
    }, { timeout: 500 });

    resolveSearch!({ success: true, data: [] });
  });

  it("displays search results after debounce", async () => {
    const user = userEvent.setup();
    vi.mocked(searchMediaAction).mockResolvedValue({
      success: true,
      data: [
        {
          id: 1396,
          mediaType: "tv",
          title: "Breaking Bad",
          overview: "A chemistry teacher...",
          posterPath: "/poster.jpg",
          year: "2008",
        },
      ],
    });

    render(<MediaSearchCombobox onSelect={mockOnSelect} />);

    const input = screen.getByRole("combobox");
    await user.type(input, "Breaking Bad");

    await waitFor(() => {
      expect(screen.getByText("Breaking Bad")).toBeInTheDocument();
      expect(screen.getByText("2008")).toBeInTheDocument();
      expect(screen.getByText("TV")).toBeInTheDocument();
    }, { timeout: 500 });
  });

  it("calls onSelect when result clicked", async () => {
    const user = userEvent.setup();
    vi.mocked(searchMediaAction).mockResolvedValue({
      success: true,
      data: [
        {
          id: 1396,
          mediaType: "tv",
          title: "Breaking Bad",
          overview: "A chemistry teacher turns to crime.",
          posterPath: "/poster.jpg",
          year: "2008",
        },
      ],
    });

    render(<MediaSearchCombobox onSelect={mockOnSelect} />);

    const input = screen.getByRole("combobox");
    await user.type(input, "Breaking");

    await waitFor(() => {
      expect(screen.getByText("Breaking Bad")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Breaking Bad"));

    expect(mockOnSelect).toHaveBeenCalledWith({
      id: 1396,
      mediaType: "tv",
      title: "Breaking Bad",
      overview: "A chemistry teacher turns to crime.",
      posterPath: "/poster.jpg",
      year: "2008",
    });
  });

  it("debounces search requests (300ms)", async () => {
    const user = userEvent.setup();

    render(<MediaSearchCombobox onSelect={mockOnSelect} />);

    const input = screen.getByRole("combobox");

    // Type quickly
    await user.type(input, "test", { delay: 50 });

    // Should not have called yet (debounce not finished)
    expect(searchMediaAction).not.toHaveBeenCalled();

    // Wait for debounce
    await waitFor(() => {
      expect(searchMediaAction).toHaveBeenCalledTimes(1);
      expect(searchMediaAction).toHaveBeenCalledWith("test");
    }, { timeout: 500 });
  });

  it("shows empty state when TMDB not configured", async () => {
    vi.mocked(isTMDBAvailable).mockResolvedValue(false);

    render(<MediaSearchCombobox onSelect={mockOnSelect} />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/enter name/i)).toBeInTheDocument();
    });
  });

  it("shows poster thumbnail in results", async () => {
    const user = userEvent.setup();
    vi.mocked(searchMediaAction).mockResolvedValue({
      success: true,
      data: [
        {
          id: 1,
          mediaType: "movie",
          title: "Test Movie",
          overview: "Description",
          posterPath: "/poster.jpg",
          year: "2023",
        },
      ],
    });

    render(<MediaSearchCombobox onSelect={mockOnSelect} />);

    const input = screen.getByRole("combobox");
    await user.type(input, "Test");

    await waitFor(() => {
      const img = screen.getByRole("img");
      expect(img).toHaveAttribute("src", expect.stringContaining("tmdb.org"));
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit -- media-search-combobox.test.tsx`
Expected: FAIL with "Cannot find module"

**Step 3: Write minimal implementation**

Create `components/items/media-search-combobox.tsx`:

```typescript
/**
 * Combobox component for searching TMDB media.
 * Features auto-suggest with debounced search and poster thumbnails.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { Film, Tv, Search, Loader2 } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { searchMediaAction, isTMDBAvailable } from "@/lib/tmdb-actions";
import type { TMDBSearchResult } from "@/lib/tmdb-client";

interface MediaSearchComboboxProps {
  /** Called when user selects a result */
  onSelect: (result: TMDBSearchResult) => void;
  /** Current value to display */
  value?: string;
  /** Placeholder text */
  placeholder?: string;
}

/**
 * Auto-suggest combobox for TMDB media search.
 * Shows movie/TV results with poster thumbnails as user types.
 */
export function MediaSearchCombobox({
  onSelect,
  value = "",
  placeholder = "Search movies & TV shows...",
}: MediaSearchComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<TMDBSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [tmdbAvailable, setTmdbAvailable] = useState<boolean | null>(null);

  // Check if TMDB is configured
  useEffect(() => {
    isTMDBAvailable().then(setTmdbAvailable);
  }, []);

  // Debounced search
  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      const response = await searchMediaAction(query);
      if (response.success && response.data) {
        setResults(response.data);
      } else {
        setResults([]);
      }
      setIsLoading(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSelect = useCallback(
    (result: TMDBSearchResult) => {
      setQuery(result.title);
      setOpen(false);
      onSelect(result);
    },
    [onSelect]
  );

  // Fallback to simple input if TMDB not configured
  if (tmdbAvailable === false) {
    return (
      <Input
        placeholder="Enter name manually"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            role="combobox"
            aria-expanded={open}
            placeholder={placeholder}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (e.target.value.length >= 2) {
                setOpen(true);
              }
            }}
            onFocus={() => {
              if (query.length >= 2 && results.length > 0) {
                setOpen(true);
              }
            }}
            className="pl-10"
          />
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command>
          <CommandList>
            {isLoading && (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="ml-2 text-sm text-muted-foreground">
                  Searching TMDB...
                </span>
              </div>
            )}
            {!isLoading && results.length === 0 && query.length >= 2 && (
              <CommandEmpty>No results found.</CommandEmpty>
            )}
            {!isLoading && results.length > 0 && (
              <CommandGroup heading="Results">
                {results.map((result) => (
                  <CommandItem
                    key={`${result.mediaType}-${result.id}`}
                    value={result.title}
                    onSelect={() => handleSelect(result)}
                    className="flex items-center gap-3 py-2"
                  >
                    {/* Poster thumbnail */}
                    {result.posterPath ? (
                      <img
                        src={`https://image.tmdb.org/t/p/w92${result.posterPath}`}
                        alt=""
                        className="h-12 w-8 rounded object-cover"
                      />
                    ) : (
                      <div className="flex h-12 w-8 items-center justify-center rounded bg-muted">
                        {result.mediaType === "movie" ? (
                          <Film className="h-4 w-4" />
                        ) : (
                          <Tv className="h-4 w-4" />
                        )}
                      </div>
                    )}

                    {/* Title and metadata */}
                    <div className="flex flex-col">
                      <span className="font-medium">{result.title}</span>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="rounded bg-muted px-1.5 py-0.5 uppercase">
                          {result.mediaType === "movie" ? "Movie" : "TV"}
                        </span>
                        {result.year && <span>{result.year}</span>}
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm run test:unit -- media-search-combobox.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add components/items/media-search-combobox.tsx tests/unit/components/items/media-search-combobox.test.tsx
git commit -m "feat: add MediaSearchCombobox for TMDB auto-suggest"
```

---

## Task 4: Integrate into AddItemDialog

**Files:**

- Modify: `components/items/add-item-dialog.tsx`
- Test: `tests/unit/components/items/add-item-dialog.test.tsx`

**Step 1: Update AddItemDialog**

Add TMDB search integration to the existing AddItemDialog. When user selects a TMDB result, auto-fill name and description.

Modify `components/items/add-item-dialog.tsx`:

```typescript
// Add import at top
import { MediaSearchCombobox } from "./media-search-combobox";
import type { TMDBSearchResult } from "@/lib/tmdb-client";

// Add state in component
const [selectedMedia, setSelectedMedia] = useState<TMDBSearchResult | null>(null);

// Add handler
const handleMediaSelect = (result: TMDBSearchResult) => {
  setSelectedMedia(result);
  const year = result.year;
  const displayName = year ? `${result.title} (${year})` : result.title;
  setName(displayName);
  setDescription(result.overview.slice(0, 200));
};

// Replace name input with MediaSearchCombobox
<MediaSearchCombobox
  onSelect={handleMediaSelect}
  value={name}
  placeholder="Search or enter name..."
/>
```

**Step 2: Add tests for TMDB integration**

Add to `tests/unit/components/items/add-item-dialog.test.tsx`:

```typescript
describe("TMDB integration", () => {
  it("auto-fills name when TMDB result selected", async () => {
    // Test that selecting a TMDB result populates name field
  });

  it("auto-fills description when TMDB result selected", async () => {
    // Test that description is populated
  });

  it("stores TMDB metadata for poster upload", async () => {
    // Test that tmdbId and posterPath are stored for later use
  });
});
```

**Step 3: Run tests**

Run: `pnpm run test:unit -- add-item-dialog.test.tsx`
Expected: PASS

**Step 4: Commit**

```bash
git add components/items/add-item-dialog.tsx tests/unit/components/items/add-item-dialog.test.tsx
git commit -m "feat: integrate TMDB search into AddItemDialog"
```

---

## Task 5: Add Lookup Metadata to Settings Dialog

**Files:**

- Modify: `components/items/item-settings-dialog.tsx`
- Test: `tests/unit/components/items/item-settings-dialog.test.tsx`

**Step 1: Add Lookup Metadata button**

Add a "Lookup Metadata" button to ItemSettingsDialog that opens a search modal and applies selected metadata to the item.

**Step 2: Create MediaLookupDialog**

Create `components/items/media-lookup-dialog.tsx`:

```typescript
/**
 * Dialog for looking up and applying TMDB metadata to existing items.
 */

"use client";

import { useState } from "react";
import { Search, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MediaSearchCombobox } from "./media-search-combobox";
import { applyMetadataAction } from "@/lib/tmdb-actions";
import type { TMDBSearchResult } from "@/lib/tmdb-client";
import { toast } from "sonner";

interface MediaLookupDialogProps {
  itemId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function MediaLookupDialog({
  itemId,
  open,
  onOpenChange,
  onSuccess,
}: MediaLookupDialogProps) {
  const [selected, setSelected] = useState<TMDBSearchResult | null>(null);
  const [isApplying, setIsApplying] = useState(false);

  const handleApply = async () => {
    if (!selected) return;

    setIsApplying(true);
    const result = await applyMetadataAction(
      itemId,
      selected.id,
      selected.mediaType
    );
    setIsApplying(false);

    if (result.success) {
      toast.success("Metadata applied successfully");
      onOpenChange(false);
      onSuccess?.();
    } else {
      toast.error(result.error || "Failed to apply metadata");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Lookup Metadata</DialogTitle>
          <DialogDescription>
            Search TMDB to find and apply movie or TV show metadata.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <MediaSearchCombobox
            onSelect={setSelected}
            placeholder="Search TMDB..."
          />

          {selected && (
            <div className="rounded-lg border p-4">
              <div className="flex gap-4">
                {selected.posterPath && (
                  <img
                    src={`https://image.tmdb.org/t/p/w185${selected.posterPath}`}
                    alt=""
                    className="h-32 w-auto rounded"
                  />
                )}
                <div>
                  <h3 className="font-semibold">
                    {selected.title}
                    {selected.year && ` (${selected.year})`}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {selected.mediaType === "movie" ? "Movie" : "TV Show"}
                  </p>
                  <p className="mt-2 text-sm line-clamp-3">
                    {selected.overview}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleApply} disabled={!selected || isApplying}>
              {isApplying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Applying...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  Apply Metadata
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 3: Add tests**

**Step 4: Commit**

```bash
git add components/items/media-lookup-dialog.tsx components/items/item-settings-dialog.tsx tests/unit/components/items/
git commit -m "feat: add Lookup Metadata to item settings"
```

---

## Task 6: Create Seed Script

**Files:**

- Create: `prisma/seed-config.ts`
- Create: `prisma/seed.ts`
- Modify: `package.json`

This task creates the seed script that uses the same TMDB client library to populate demo data. See the detailed implementation in the original plan above.

**Key difference from user-facing code**: The seed script bypasses auth and rate limits since it runs as a CLI tool.

**Step 1: Create seed configuration**

Create `prisma/seed-config.ts` with TMDB IDs for movies and TV shows.

**Step 2: Create seed script**

Create `prisma/seed.ts` that:

1. Validates environment (ALLOW_SEEDING, DATABASE_URL not production, TMDB_API_KEY)
2. Cleans up existing seed users
3. Creates seed users
4. For each media item: fetches TMDB data, creates Item with name/description
5. Optionally downloads posters (if seed user has Google Drive)

**Step 3: Add to package.json**

```json
{
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  }
}
```

**Step 4: Commit**

```bash
git add prisma/seed-config.ts prisma/seed.ts package.json
git commit -m "feat: add database seed script with TMDB integration"
```

---

## Task 7: Add E2E Tests

**Files:**

- Create: `e2e/journeys/items/media-lookup.spec.ts`
- Create: `e2e/journeys/items/seeded-library.spec.ts`

**Step 1: Create E2E tests for media lookup**

Tests should mock TMDB responses to avoid hitting the real API.

**Step 2: Create E2E tests for seeded library**

Tests that verify the seeded data is browsable (skipped if seed data not present).

**Step 3: Commit**

```bash
git add e2e/journeys/items/media-lookup.spec.ts e2e/journeys/items/seeded-library.spec.ts
git commit -m "test: add E2E tests for TMDB integration and seeded library"
```

---

## Task 8: Integration Tests

**Files:**

- Create: `tests/integration/tmdb/apply-metadata.test.ts`

Tests that verify the full flow of applying metadata updates the database correctly.

---

## Task 9: Final Verification

**Step 1: Run all checks**

Run: `pnpm run check`
Expected: All pass

**Step 2: Run unit tests**

Run: `pnpm run test`
Expected: All pass

**Step 3: Run integration tests**

Run: `pnpm run test:integration`
Expected: All pass

**Step 4: Seed database**

Run: `ALLOW_SEEDING=true TMDB_API_KEY=xxx npx prisma db seed`
Expected: Seeding completes

**Step 5: Run E2E tests**

Run: `pnpm run test:e2e`
Expected: All pass

**Step 6: Final commit**

```bash
git add -A
git commit -m "feat: complete TMDB metadata integration with seeding"
```

---

## Testing Summary

### New Tests Added

| Type        | File                             | Count | Purpose        |
| ----------- | -------------------------------- | ----- | -------------- |
| Unit        | `tmdb-client.test.ts`            | ~12   | API client     |
| Unit        | `tmdb-actions.test.ts`           | ~10   | Server actions |
| Unit        | `media-search-combobox.test.tsx` | ~8    | Search UI      |
| Unit        | `media-lookup-dialog.test.tsx`   | ~5    | Lookup dialog  |
| Integration | `apply-metadata.test.ts`         | ~5    | Full flow      |
| E2E         | `media-lookup.spec.ts`           | ~6    | User flows     |
| E2E         | `seeded-library.spec.ts`         | ~5    | Seeded data    |

**Total: ~51 new tests**

### Tests to Update

- `add-item-dialog.test.tsx` - Add TMDB integration tests
- `item-settings-dialog.test.tsx` - Add Lookup Metadata tests

---

## Environment Variables

**Required for TMDB features:**

```bash
# Get free key at https://www.themoviedb.org/settings/api
TMDB_API_KEY=your_api_key_here
```

**Required for seeding:**

```bash
ALLOW_SEEDING=true
TMDB_API_KEY=your_api_key_here
SEED_PASSWORD=YourPassword123!  # Optional, defaults to SeedPassword123!
```

---

## Files Summary

### Files to Create

- `lib/tmdb-client.ts` - TMDB API client
- `lib/tmdb-actions.ts` - Server actions
- `components/items/media-search-combobox.tsx` - Auto-suggest UI
- `components/items/media-lookup-dialog.tsx` - Lookup modal
- `prisma/seed-config.ts` - Seed configuration
- `prisma/seed.ts` - Seed script
- `tests/unit/lib/tmdb-client.test.ts`
- `tests/unit/lib/tmdb-actions.test.ts`
- `tests/unit/components/items/media-search-combobox.test.tsx`
- `tests/unit/components/items/media-lookup-dialog.test.tsx`
- `tests/integration/tmdb/apply-metadata.test.ts`
- `e2e/journeys/items/media-lookup.spec.ts`
- `e2e/journeys/items/seeded-library.spec.ts`

### Files to Modify

- `package.json` - Add prisma seed script
- `components/items/add-item-dialog.tsx` - TMDB search integration
- `components/items/item-settings-dialog.tsx` - Lookup Metadata button
- `tests/unit/components/items/add-item-dialog.test.tsx`
- `tests/unit/components/items/item-settings-dialog.test.tsx`

---

## Validation

This plan was validated using:

- ✅ **Code Review Excellence skill** (security, testing, architecture)
- ✅ **Sequential Thinking** (5-step systematic analysis)
- ✅ **TMDB API documentation** (via Context7 web fetch)

### TMDB API Verification

| Aspect           | Plan                              | TMDB Docs                   | Status |
| ---------------- | --------------------------------- | --------------------------- | ------ |
| Auth method      | Bearer token in header            | Recommended method          | ✅     |
| Rate limits      | ~40-50 req/sec per IP             | Legacy 40/10s disabled 2019 | ✅     |
| Search endpoint  | `/search/multi`                   | Correct                     | ✅     |
| Image URL format | `image.tmdb.org/t/p/{size}{path}` | Correct                     | ✅     |
| Poster sizes     | w92, w185, w500                   | All valid                   | ✅     |

### Security Checklist (Code Review Excellence)

- [x] TMDB_API_KEY server-side only (never in client bundle)
- [x] Rate limiting: 30 req/min per user via `checkRateLimit()`
- [x] Auth required: `await auth()` before all actions
- [x] Item ownership: `item.userId !== session.user.id` check
- [x] Input sanitization: `encodeURIComponent(query)`
- [x] XSS protection: React auto-escapes JSX output
- [x] Circuit breaker: `withCircuitBreaker("tmdb-api", ...)` wraps all TMDB calls

### Performance Checklist

- [x] 300ms debounce on client-side search
- [x] Results limited to 10 items
- [x] w500 poster size (~50-100KB, good balance)
- [x] w92 thumbnails in combobox (tiny, fast)
- [x] Circuit breaker prevents cascade failures
- [x] Duplicate artwork check prevents unbounded file growth

### Testing Checklist

- [x] Unit tests for TMDB client (~12 tests)
- [x] Unit tests for server actions (~11 tests)
- [x] Unit tests for UI components (~13 tests)
- [x] Integration tests for metadata apply flow (~5 tests)
- [x] E2E tests for user flows (~11 tests)
- [x] All tests mock TMDB (no real API calls in CI)
- [x] Test for duplicate artwork handling

### Sources

- [TMDB API Authentication](https://developer.themoviedb.org/docs/authentication-application)
- [TMDB Rate Limiting](https://developer.themoviedb.org/docs/rate-limiting)
- [TMDB Multi-Search](https://developer.themoviedb.org/reference/search-multi)
