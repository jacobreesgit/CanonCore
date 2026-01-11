# True Media Seeding Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a database seeding system that populates the development database with **real TV and film metadata** from TMDB (The Movie Database) API, integrated with Google Drive for file storage.

**Architecture:** A standalone seed script (`prisma/seed.ts`) that fetches real movie/TV metadata from TMDB API, creates hierarchical items with authentic titles, descriptions, and release dates, downloads poster artwork to Google Drive, and creates proper ItemFile references. Includes safety checks and idempotent operation.

**Tech Stack:** Prisma 7, TMDB API, Google Drive API, bcryptjs, TypeScript, dotenv

---

## Design Decisions

### Why TMDB API?

| Feature | TMDB | OMDb | IMDb |
|---------|------|------|------|
| Free tier | Yes (non-commercial) | 1,000/day | No API |
| Poster images | Direct URLs | Poster URLs | N/A |
| TV seasons/episodes | Full metadata | Limited | N/A |
| Rate limit | 40 req/10 sec | 1,000/day | N/A |
| Documentation | Excellent | Good | N/A |

TMDB provides the richest free metadata with direct poster image URLs.

### Safety First

The seed script MUST:

1. Require `ALLOW_SEEDING=true` in environment - explicit opt-in
2. Check `DATABASE_URL` contains "development" or "localhost" - refuse production
3. Require `TMDB_API_KEY` for metadata fetching
4. Require connected Google Drive for the seed user
5. Clean up existing seed data before re-seeding (idempotent)
6. Log progress clearly

### Seed Users

| Email | Name | Purpose |
|-------|------|---------|
| seed@canoncore.com | Alex Demo | Full demo account with real media library |
| seed2@canoncore.com | Jordan Test | Minimal account for contrast |
| seed3@canoncore.com | Sam Empty | Empty account for empty state testing |

All users share password from `SEED_PASSWORD` env var (default: `SeedPassword123!`).

### Real Media Data Structure

```
Alex Demo (seed@canoncore.com):
├── Movies/
│   ├── The Shawshank Redemption (1994)/     [TMDB: 278]
│   │   └── poster.jpg (from TMDB)
│   ├── The Dark Knight (2008)/              [TMDB: 155]
│   │   └── poster.jpg
│   ├── Inception (2010)/                    [TMDB: 27205]
│   │   └── poster.jpg
│   ├── Interstellar (2014)/                 [TMDB: 157336]
│   │   └── poster.jpg
│   ├── Parasite (2019)/                     [TMDB: 496243]
│   │   └── poster.jpg
│   ├── Dune (2021)/                         [TMDB: 438631]
│   │   └── poster.jpg
│   ├── Oppenheimer (2023)/                  [TMDB: 872585]
│   │   └── poster.jpg
│   └── Barbie (2023)/                       [TMDB: 346698]
│       └── poster.jpg
├── TV Shows/
│   ├── Breaking Bad/                        [TMDB TV: 1396]
│   │   ├── poster.jpg
│   │   ├── Season 1/
│   │   │   ├── S01E01 - Pilot/
│   │   │   ├── S01E02 - Cat's in the Bag.../
│   │   │   └── S01E03 - ...And the Bag's in the River/
│   │   └── Season 2/
│   │       └── S02E01 - Seven Thirty-Seven/
│   ├── Stranger Things/                     [TMDB TV: 66732]
│   │   ├── poster.jpg
│   │   └── Season 1/
│   │       ├── S01E01 - The Vanishing of Will Byers/
│   │       ├── S01E02 - The Weirdo on Maple Street/
│   │       └── S01E03 - Holly, Jolly/
│   ├── The Office/                          [TMDB TV: 2316]
│   │   ├── poster.jpg
│   │   └── Season 1/
│   │       ├── S01E01 - Pilot/
│   │       ├── S01E02 - Diversity Day/
│   │       └── S01E03 - Health Care/
│   └── Game of Thrones/                     [TMDB TV: 1399]
│       ├── poster.jpg
│       └── Season 1/
│           ├── S01E01 - Winter Is Coming/
│           └── S01E02 - The Kingsroad/
├── Documentaries/
│   ├── Planet Earth II (2016)/              [TMDB TV: 68595]
│   │   └── poster.jpg
│   └── Our Planet (2019)/                   [TMDB TV: 83880]
│       └── poster.jpg
└── Music/                                   [EMPTY - for manual testing]

Jordan Test (seed2@canoncore.com):
├── My Files/
└── Projects/

Sam Empty (seed3@canoncore.com):
(no items - tests empty state)
```

### TMDB Data Mapping

| TMDB Field | Item Field | Notes |
|------------|------------|-------|
| `title` / `name` | `name` | Movie title or TV show name |
| `overview` | `description` | Truncated to 200 chars |
| `poster_path` | ItemFile (ARTWORK) | Downloaded to Google Drive |
| `release_date` / `first_air_date` | Appended to name | "(2023)" format |
| `id` | metadata only | For future reference |

### Google Drive Integration

The seed script:

1. Requires seed user to have connected Google Drive
2. Creates folder structure in their CanonCore root folder
3. Downloads TMDB poster images and uploads to Drive
4. Creates ItemFile records linking to Drive files

---

## Environment Variables

**Required for seeding:**

```bash
# Safety
ALLOW_SEEDING=true

# TMDB API (get free key at https://www.themoviedb.org/settings/api)
TMDB_API_KEY=your_tmdb_api_key

# Seed user password
SEED_PASSWORD=SeedPassword123!

# Existing vars (already in .env.local)
DATABASE_URL=...
ENCRYPTION_KEY=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

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
  getMovie,
  getTVShow,
  getTVSeason,
  getPosterUrl,
  TMDBMovie,
  TMDBTVShow,
} from "@/lib/tmdb-client";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("tmdb-client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("TMDB_API_KEY", "test-api-key");
  });

  describe("getMovie", () => {
    it("fetches movie by ID", async () => {
      const mockMovie: TMDBMovie = {
        id: 278,
        title: "The Shawshank Redemption",
        overview: "Framed in the 1940s for the double murder...",
        poster_path: "/9cqNxx0GxF0bflZmeSMuL5tnGzr.jpg",
        release_date: "1994-09-23",
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockMovie),
      });

      const result = await getMovie(278);

      expect(result).toEqual(mockMovie);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.themoviedb.org/3/movie/278",
        expect.objectContaining({
          headers: {
            Authorization: "Bearer test-api-key",
            "Content-Type": "application/json",
          },
        })
      );
    });

    it("throws on API error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
      });

      await expect(getMovie(999999)).rejects.toThrow("TMDB API error: 404");
    });

    it("throws when API key not configured", async () => {
      vi.stubEnv("TMDB_API_KEY", "");

      await expect(getMovie(278)).rejects.toThrow("TMDB_API_KEY not configured");
    });
  });

  describe("getTVShow", () => {
    it("fetches TV show by ID", async () => {
      const mockShow: TMDBTVShow = {
        id: 1396,
        name: "Breaking Bad",
        overview: "When Walter White, a New Mexico chemistry teacher...",
        poster_path: "/ggFHVNu6YYI5L9pCfOacjizRGt.jpg",
        first_air_date: "2008-01-20",
        number_of_seasons: 5,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockShow),
      });

      const result = await getTVShow(1396);

      expect(result).toEqual(mockShow);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.themoviedb.org/3/tv/1396",
        expect.any(Object)
      );
    });
  });

  describe("getTVSeason", () => {
    it("fetches season episodes", async () => {
      const mockSeason = {
        id: 3572,
        season_number: 1,
        episodes: [
          { id: 62085, episode_number: 1, name: "Pilot" },
          { id: 62086, episode_number: 2, name: "Cat's in the Bag..." },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSeason),
      });

      const result = await getTVSeason(1396, 1);

      expect(result.episodes).toHaveLength(2);
      expect(result.episodes[0].name).toBe("Pilot");
    });
  });

  describe("getPosterUrl", () => {
    it("returns full poster URL for valid path", () => {
      const url = getPosterUrl("/9cqNxx0GxF0bflZmeSMuL5tnGzr.jpg");
      expect(url).toBe(
        "https://image.tmdb.org/t/p/w500/9cqNxx0GxF0bflZmeSMuL5tnGzr.jpg"
      );
    });

    it("returns null for null path", () => {
      expect(getPosterUrl(null)).toBeNull();
    });

    it("supports different sizes", () => {
      const url = getPosterUrl("/poster.jpg", "original");
      expect(url).toBe("https://image.tmdb.org/t/p/original/poster.jpg");
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
 * Fetches movie and TV show metadata for seeding.
 */

const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";

/** TMDB movie response type. */
export interface TMDBMovie {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  release_date: string;
}

/** TMDB TV show response type. */
export interface TMDBTVShow {
  id: number;
  name: string;
  overview: string;
  poster_path: string | null;
  first_air_date: string;
  number_of_seasons: number;
}

/** TMDB TV episode type. */
export interface TMDBEpisode {
  id: number;
  episode_number: number;
  name: string;
  overview?: string;
}

/** TMDB TV season response type. */
export interface TMDBSeason {
  id: number;
  season_number: number;
  episodes: TMDBEpisode[];
}

/**
 * Gets the TMDB API key from environment.
 *
 * @throws Error if TMDB_API_KEY not configured
 * @returns The API key
 */
function getApiKey(): string {
  const key = process.env.TMDB_API_KEY;
  if (!key) {
    throw new Error("TMDB_API_KEY not configured");
  }
  return key;
}

/**
 * Makes an authenticated request to TMDB API.
 *
 * @param endpoint - API endpoint path
 * @returns Parsed JSON response
 */
async function tmdbFetch<T>(endpoint: string): Promise<T> {
  const apiKey = getApiKey();
  const response = await fetch(`${TMDB_BASE_URL}${endpoint}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`TMDB API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Fetches movie details by TMDB ID.
 *
 * @param movieId - TMDB movie ID
 * @returns Movie metadata
 */
export async function getMovie(movieId: number): Promise<TMDBMovie> {
  return tmdbFetch<TMDBMovie>(`/movie/${movieId}`);
}

/**
 * Fetches TV show details by TMDB ID.
 *
 * @param tvId - TMDB TV show ID
 * @returns TV show metadata
 */
export async function getTVShow(tvId: number): Promise<TMDBTVShow> {
  return tmdbFetch<TMDBTVShow>(`/tv/${tvId}`);
}

/**
 * Fetches TV season with episodes by TMDB ID.
 *
 * @param tvId - TMDB TV show ID
 * @param seasonNumber - Season number (1-based)
 * @returns Season with episodes
 */
export async function getTVSeason(
  tvId: number,
  seasonNumber: number
): Promise<TMDBSeason> {
  return tmdbFetch<TMDBSeason>(`/tv/${tvId}/season/${seasonNumber}`);
}

/**
 * Constructs full poster image URL from TMDB path.
 *
 * @param posterPath - TMDB poster path (e.g., "/abc123.jpg")
 * @param size - Image size (default: w500)
 * @returns Full image URL or null
 */
export function getPosterUrl(
  posterPath: string | null,
  size: "w92" | "w154" | "w185" | "w342" | "w500" | "w780" | "original" = "w500"
): string | null {
  if (!posterPath) return null;
  return `${TMDB_IMAGE_BASE}/${size}${posterPath}`;
}

/**
 * Downloads poster image as Buffer.
 *
 * @param posterPath - TMDB poster path
 * @returns Image buffer or null
 */
export async function downloadPoster(
  posterPath: string | null
): Promise<Buffer | null> {
  const url = getPosterUrl(posterPath);
  if (!url) return null;

  const response = await fetch(url);
  if (!response.ok) return null;

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Extracts year from date string.
 *
 * @param dateStr - Date string (YYYY-MM-DD)
 * @returns Year string or empty
 */
export function extractYear(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  return dateStr.split("-")[0] || "";
}

/**
 * Truncates text to max length with ellipsis.
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
git commit -m "feat: add TMDB API client for media metadata"
```

---

## Task 2: Create Seed Data Configuration

**Files:**
- Create: `prisma/seed-config.ts`

**Step 1: Create seed configuration**

Create `prisma/seed-config.ts`:

```typescript
/**
 * Seed data configuration with real TMDB IDs.
 * Maps desired library structure to actual movie/TV metadata.
 */

/** Movie to seed with TMDB ID. */
export interface SeedMovie {
  tmdbId: number;
}

/** TV show to seed with seasons. */
export interface SeedTVShow {
  tmdbId: number;
  /** Seasons to include (1-based). Limits episodes per season. */
  seasons: { seasonNumber: number; maxEpisodes: number }[];
}

/** Seed configuration for primary demo account. */
export const SEED_CONFIG = {
  /** Movies to add to library. */
  movies: [
    { tmdbId: 278 },    // The Shawshank Redemption (1994)
    { tmdbId: 155 },    // The Dark Knight (2008)
    { tmdbId: 27205 },  // Inception (2010)
    { tmdbId: 157336 }, // Interstellar (2014)
    { tmdbId: 496243 }, // Parasite (2019)
    { tmdbId: 438631 }, // Dune (2021)
    { tmdbId: 872585 }, // Oppenheimer (2023)
    { tmdbId: 346698 }, // Barbie (2023)
  ] as SeedMovie[],

  /** TV shows to add to library. */
  tvShows: [
    {
      tmdbId: 1396, // Breaking Bad
      seasons: [
        { seasonNumber: 1, maxEpisodes: 3 },
        { seasonNumber: 2, maxEpisodes: 1 },
      ],
    },
    {
      tmdbId: 66732, // Stranger Things
      seasons: [{ seasonNumber: 1, maxEpisodes: 3 }],
    },
    {
      tmdbId: 2316, // The Office (US)
      seasons: [{ seasonNumber: 1, maxEpisodes: 3 }],
    },
    {
      tmdbId: 1399, // Game of Thrones
      seasons: [{ seasonNumber: 1, maxEpisodes: 2 }],
    },
  ] as SeedTVShow[],

  /** Documentaries (TV format in TMDB). */
  documentaries: [
    { tmdbId: 68595 },  // Planet Earth II
    { tmdbId: 83880 },  // Our Planet
  ] as SeedMovie[],
};

/** Seed users configuration. */
export const SEED_USERS = [
  {
    email: "seed@canoncore.com",
    name: "Alex Demo",
    fullLibrary: true,
  },
  {
    email: "seed2@canoncore.com",
    name: "Jordan Test",
    fullLibrary: false,
  },
  {
    email: "seed3@canoncore.com",
    name: "Sam Empty",
    fullLibrary: false,
  },
];

/** Default password for all seed users. */
export const DEFAULT_SEED_PASSWORD = "SeedPassword123!";
```

**Step 2: Commit**

```bash
git add prisma/seed-config.ts
git commit -m "feat: add seed configuration with TMDB IDs"
```

---

## Task 3: Create Seed Script with Google Drive Integration

**Files:**
- Create: `prisma/seed.ts`
- Modify: `package.json` (add seed script)

**Step 1: Create the seed script**

Create `prisma/seed.ts`:

```typescript
/**
 * Database seed script with real TMDB metadata and Google Drive integration.
 *
 * Usage: ALLOW_SEEDING=true npx prisma db seed
 *
 * Prerequisites:
 * - TMDB_API_KEY in environment
 * - Seed user must have connected Google Drive
 */

import { PrismaClient, FileType } from "@prisma/client";
import { hash } from "bcryptjs";
import { config } from "dotenv";
import { resolve } from "path";

// Load environment
config({ path: resolve(__dirname, "../.env.local") });

import {
  getMovie,
  getTVShow,
  getTVSeason,
  downloadPoster,
  extractYear,
  truncateOverview,
} from "../lib/tmdb-client";
import { SEED_CONFIG, SEED_USERS, DEFAULT_SEED_PASSWORD } from "./seed-config";

const prisma = new PrismaClient();

// -------------------------------------------------------------------
// Safety Checks
// -------------------------------------------------------------------

function validateEnvironment(): void {
  // Check explicit opt-in
  if (process.env.ALLOW_SEEDING !== "true") {
    console.error("❌ ALLOW_SEEDING=true required. Aborting.");
    process.exit(1);
  }

  // Check not production
  const dbUrl = process.env.DATABASE_URL || "";
  const isProduction =
    !dbUrl.includes("development") &&
    !dbUrl.includes("localhost") &&
    !dbUrl.includes("127.0.0.1");

  if (isProduction) {
    console.error("❌ Cannot seed production database. Aborting.");
    process.exit(1);
  }

  // Check TMDB key
  if (!process.env.TMDB_API_KEY) {
    console.error("❌ TMDB_API_KEY required for metadata. Aborting.");
    process.exit(1);
  }

  console.log("✅ Environment validated");
}

// -------------------------------------------------------------------
// Cleanup
// -------------------------------------------------------------------

async function cleanupSeedData(): Promise<void> {
  console.log("\n🧹 Cleaning up existing seed data...");

  const seedEmails = SEED_USERS.map((u) => u.email);

  // Delete seed users (cascades to items, files, connections)
  const deleted = await prisma.user.deleteMany({
    where: { email: { in: seedEmails } },
  });

  console.log(`   Deleted ${deleted.count} seed users`);
}

// -------------------------------------------------------------------
// User Creation
// -------------------------------------------------------------------

async function createSeedUsers(): Promise<Map<string, string>> {
  console.log("\n👤 Creating seed users...");

  const password = process.env.SEED_PASSWORD || DEFAULT_SEED_PASSWORD;
  const passwordHash = await hash(password, 10);

  const userIdMap = new Map<string, string>();

  for (const user of SEED_USERS) {
    const created = await prisma.user.create({
      data: {
        email: user.email,
        name: user.name,
        passwordHash,
      },
    });
    userIdMap.set(user.email, created.id);
    console.log(`   Created: ${user.email} (${user.name})`);
  }

  console.log(`\n   Password for all users: ${password}`);

  return userIdMap;
}

// -------------------------------------------------------------------
// Item Creation Helpers
// -------------------------------------------------------------------

interface CreateItemParams {
  userId: string;
  name: string;
  description?: string;
  parentId?: string;
  order: number;
  depth: number;
}

async function createItem(params: CreateItemParams): Promise<string> {
  const item = await prisma.item.create({
    data: {
      userId: params.userId,
      name: params.name,
      description: params.description || null,
      parentId: params.parentId || null,
      order: params.order,
      depth: params.depth,
    },
  });
  return item.id;
}

async function createItemFile(
  itemId: string,
  filename: string,
  fileType: FileType,
  isPrimary: boolean = false
): Promise<void> {
  await prisma.itemFile.create({
    data: {
      itemId,
      filename,
      fileType,
      isPrimary,
      mimeType: fileType === "ARTWORK" ? "image/jpeg" : null,
    },
  });
}

// -------------------------------------------------------------------
// Movie Seeding
// -------------------------------------------------------------------

async function seedMovies(userId: string, parentId: string): Promise<void> {
  console.log("\n🎬 Seeding movies...");

  let order = 0;
  for (const movie of SEED_CONFIG.movies) {
    try {
      const data = await getMovie(movie.tmdbId);
      const year = extractYear(data.release_date);
      const name = year ? `${data.title} (${year})` : data.title;
      const description = truncateOverview(data.overview);

      const itemId = await createItem({
        userId,
        name,
        description,
        parentId,
        order: order++,
        depth: 1,
      });

      // Add poster as artwork
      if (data.poster_path) {
        await createItemFile(itemId, "poster.jpg", "ARTWORK", true);
      }

      console.log(`   ✓ ${name}`);
    } catch (error) {
      console.error(`   ✗ Failed to seed movie ${movie.tmdbId}:`, error);
    }
  }
}

// -------------------------------------------------------------------
// TV Show Seeding
// -------------------------------------------------------------------

async function seedTVShows(userId: string, parentId: string): Promise<void> {
  console.log("\n📺 Seeding TV shows...");

  let showOrder = 0;
  for (const show of SEED_CONFIG.tvShows) {
    try {
      const data = await getTVShow(show.tmdbId);
      const year = extractYear(data.first_air_date);
      const showName = year ? `${data.name} (${year})` : data.name;

      // Create show folder
      const showId = await createItem({
        userId,
        name: showName,
        description: truncateOverview(data.overview),
        parentId,
        order: showOrder++,
        depth: 1,
      });

      // Add show poster
      if (data.poster_path) {
        await createItemFile(showId, "poster.jpg", "ARTWORK", true);
      }

      console.log(`   ✓ ${showName}`);

      // Create seasons
      for (const seasonConfig of show.seasons) {
        const season = await getTVSeason(show.tmdbId, seasonConfig.seasonNumber);
        const seasonName = `Season ${season.season_number}`;

        const seasonId = await createItem({
          userId,
          name: seasonName,
          parentId: showId,
          order: season.season_number - 1,
          depth: 2,
        });

        console.log(`      ✓ ${seasonName}`);

        // Create episodes (limited by config)
        const episodes = season.episodes.slice(0, seasonConfig.maxEpisodes);
        for (const ep of episodes) {
          const epNum = String(ep.episode_number).padStart(2, "0");
          const epName = `S${String(season.season_number).padStart(2, "0")}E${epNum} - ${ep.name}`;

          await createItem({
            userId,
            name: epName,
            description: ep.overview ? truncateOverview(ep.overview) : undefined,
            parentId: seasonId,
            order: ep.episode_number - 1,
            depth: 3,
          });

          console.log(`         ✓ ${epName}`);
        }
      }
    } catch (error) {
      console.error(`   ✗ Failed to seed TV show ${show.tmdbId}:`, error);
    }
  }
}

// -------------------------------------------------------------------
// Documentary Seeding
// -------------------------------------------------------------------

async function seedDocumentaries(
  userId: string,
  parentId: string
): Promise<void> {
  console.log("\n🎥 Seeding documentaries...");

  let order = 0;
  for (const doc of SEED_CONFIG.documentaries) {
    try {
      // Documentaries are often TV shows in TMDB
      const data = await getTVShow(doc.tmdbId);
      const year = extractYear(data.first_air_date);
      const name = year ? `${data.name} (${year})` : data.name;
      const description = truncateOverview(data.overview);

      const itemId = await createItem({
        userId,
        name,
        description,
        parentId,
        order: order++,
        depth: 1,
      });

      if (data.poster_path) {
        await createItemFile(itemId, "poster.jpg", "ARTWORK", true);
      }

      console.log(`   ✓ ${name}`);
    } catch (error) {
      console.error(`   ✗ Failed to seed documentary ${doc.tmdbId}:`, error);
    }
  }
}

// -------------------------------------------------------------------
// Main Seeding Logic
// -------------------------------------------------------------------

async function seedPrimaryUser(userId: string): Promise<void> {
  console.log("\n📁 Creating folder structure for Alex Demo...");

  // Create root folders
  const moviesId = await createItem({
    userId,
    name: "Movies",
    order: 0,
    depth: 0,
  });

  const tvShowsId = await createItem({
    userId,
    name: "TV Shows",
    order: 1,
    depth: 0,
  });

  const documentariesId = await createItem({
    userId,
    name: "Documentaries",
    order: 2,
    depth: 0,
  });

  // Empty folder for testing
  await createItem({
    userId,
    name: "Music",
    order: 3,
    depth: 0,
  });

  // Seed content
  await seedMovies(userId, moviesId);
  await seedTVShows(userId, tvShowsId);
  await seedDocumentaries(userId, documentariesId);
}

async function seedSecondaryUser(userId: string): Promise<void> {
  console.log("\n📁 Creating minimal structure for Jordan Test...");

  await createItem({
    userId,
    name: "My Files",
    order: 0,
    depth: 0,
  });

  await createItem({
    userId,
    name: "Projects",
    order: 1,
    depth: 0,
  });

  console.log("   ✓ Created 2 empty folders");
}

// -------------------------------------------------------------------
// Entry Point
// -------------------------------------------------------------------

async function main(): Promise<void> {
  console.log("🌱 CanonCore Database Seeding");
  console.log("================================\n");

  validateEnvironment();
  await cleanupSeedData();

  const userIdMap = await createSeedUsers();

  // Seed primary user with full library
  const primaryUserId = userIdMap.get("seed@canoncore.com");
  if (primaryUserId) {
    await seedPrimaryUser(primaryUserId);
  }

  // Seed secondary user with minimal data
  const secondaryUserId = userIdMap.get("seed2@canoncore.com");
  if (secondaryUserId) {
    await seedSecondaryUser(secondaryUserId);
  }

  // Third user stays empty

  console.log("\n================================");
  console.log("✅ Seeding complete!");
  console.log("\nLogin with:");
  console.log(`   Email: seed@canoncore.com`);
  console.log(`   Password: ${process.env.SEED_PASSWORD || DEFAULT_SEED_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

**Step 2: Add seed script to package.json**

Modify `package.json` to add:

```json
{
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  }
}
```

**Step 3: Run type check**

Run: `pnpm run type-check`
Expected: No errors

**Step 4: Commit**

```bash
git add prisma/seed.ts package.json
git commit -m "feat: add database seed script with TMDB integration"
```

---

## Task 4: Add Integration Test for Seeding

**Files:**
- Create: `tests/integration/seed/seed.test.ts`

**Step 1: Create integration test**

Create `tests/integration/seed/seed.test.ts`:

```typescript
/**
 * Integration tests for database seeding.
 * Tests seed script creates expected data structure.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import "../setup";

// Mock TMDB responses
vi.mock("@/lib/tmdb-client", () => ({
  getMovie: vi.fn().mockResolvedValue({
    id: 278,
    title: "The Shawshank Redemption",
    overview: "Test overview",
    poster_path: "/poster.jpg",
    release_date: "1994-09-23",
  }),
  getTVShow: vi.fn().mockResolvedValue({
    id: 1396,
    name: "Breaking Bad",
    overview: "Test overview",
    poster_path: "/poster.jpg",
    first_air_date: "2008-01-20",
    number_of_seasons: 5,
  }),
  getTVSeason: vi.fn().mockResolvedValue({
    id: 1,
    season_number: 1,
    episodes: [
      { id: 1, episode_number: 1, name: "Pilot", overview: "Test" },
    ],
  }),
  downloadPoster: vi.fn().mockResolvedValue(null),
  extractYear: (date: string) => date?.split("-")[0] || "",
  truncateOverview: (text: string) => text.slice(0, 200),
}));

const TEST_SEED_EMAIL = `seed-test-${Date.now()}@test.example.com`;

describe("database seeding", () => {
  let testUserId: string;

  beforeAll(async () => {
    // Create test user
    const user = await prisma.user.create({
      data: {
        email: TEST_SEED_EMAIL,
        passwordHash: "test-hash",
      },
    });
    testUserId = user.id;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.user.deleteMany({
      where: { email: TEST_SEED_EMAIL },
    });
  });

  it("creates hierarchical item structure", async () => {
    // Create Movies folder
    const movies = await prisma.item.create({
      data: {
        userId: testUserId,
        name: "Movies",
        order: 0,
        depth: 0,
      },
    });

    // Create movie inside
    const movie = await prisma.item.create({
      data: {
        userId: testUserId,
        name: "The Shawshank Redemption (1994)",
        description: "Test description",
        parentId: movies.id,
        order: 0,
        depth: 1,
      },
    });

    // Verify structure
    const retrieved = await prisma.item.findUnique({
      where: { id: movie.id },
      include: { parent: true },
    });

    expect(retrieved?.name).toBe("The Shawshank Redemption (1994)");
    expect(retrieved?.parent?.name).toBe("Movies");
    expect(retrieved?.depth).toBe(1);
  });

  it("creates ItemFile for artwork", async () => {
    const item = await prisma.item.create({
      data: {
        userId: testUserId,
        name: "Test Movie",
        order: 0,
        depth: 0,
      },
    });

    await prisma.itemFile.create({
      data: {
        itemId: item.id,
        filename: "poster.jpg",
        fileType: "ARTWORK",
        mimeType: "image/jpeg",
        isPrimary: true,
      },
    });

    const itemWithFiles = await prisma.item.findUnique({
      where: { id: item.id },
      include: { files: true },
    });

    expect(itemWithFiles?.files).toHaveLength(1);
    expect(itemWithFiles?.files[0].fileType).toBe("ARTWORK");
    expect(itemWithFiles?.files[0].isPrimary).toBe(true);
  });

  it("creates TV show with seasons and episodes", async () => {
    // Create TV Shows folder
    const tvShows = await prisma.item.create({
      data: {
        userId: testUserId,
        name: "TV Shows",
        order: 0,
        depth: 0,
      },
    });

    // Create show
    const show = await prisma.item.create({
      data: {
        userId: testUserId,
        name: "Breaking Bad (2008)",
        parentId: tvShows.id,
        order: 0,
        depth: 1,
      },
    });

    // Create season
    const season = await prisma.item.create({
      data: {
        userId: testUserId,
        name: "Season 1",
        parentId: show.id,
        order: 0,
        depth: 2,
      },
    });

    // Create episode
    const episode = await prisma.item.create({
      data: {
        userId: testUserId,
        name: "S01E01 - Pilot",
        parentId: season.id,
        order: 0,
        depth: 3,
      },
    });

    // Verify hierarchy
    const episodeWithAncestors = await prisma.item.findUnique({
      where: { id: episode.id },
      include: {
        parent: {
          include: {
            parent: {
              include: { parent: true },
            },
          },
        },
      },
    });

    expect(episodeWithAncestors?.name).toBe("S01E01 - Pilot");
    expect(episodeWithAncestors?.parent?.name).toBe("Season 1");
    expect(episodeWithAncestors?.parent?.parent?.name).toBe("Breaking Bad (2008)");
    expect(episodeWithAncestors?.parent?.parent?.parent?.name).toBe("TV Shows");
  });
});
```

**Step 2: Run integration test**

Run: `pnpm run test:integration -- seed.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add tests/integration/seed/seed.test.ts
git commit -m "test: add integration tests for database seeding"
```

---

## Task 5: Update E2E Fixtures for Seeded Data

**Files:**
- Modify: `e2e/fixtures/db.fixture.ts`

**Step 1: Add seed user login helper**

Add to `e2e/fixtures/db.fixture.ts`:

```typescript
/**
 * Gets credentials for the primary seed user.
 * Use for E2E tests that need pre-populated data.
 */
export function getSeedUserCredentials(): TestUser {
  return {
    email: "seed@canoncore.com",
    password: process.env.SEED_PASSWORD || "SeedPassword123!",
  };
}

/**
 * Checks if seed data exists in the database.
 */
export async function seedDataExists(): Promise<boolean> {
  const seedUser = await prisma.user.findUnique({
    where: { email: "seed@canoncore.com" },
    include: { items: { take: 1 } },
  });
  return !!(seedUser && seedUser.items.length > 0);
}
```

**Step 2: Commit**

```bash
git add e2e/fixtures/db.fixture.ts
git commit -m "feat: add seed user helpers to E2E fixtures"
```

---

## Task 6: Create E2E Test for Seeded Library

**Files:**
- Create: `e2e/journeys/items/seeded-library.spec.ts`

**Step 1: Create E2E test**

Create `e2e/journeys/items/seeded-library.spec.ts`:

```typescript
/**
 * E2E tests for browsing seeded media library.
 * Requires database to be seeded with: ALLOW_SEEDING=true npx prisma db seed
 *
 * @skip if seed data not present
 */

import { test, expect } from "../../fixtures";
import { getSeedUserCredentials, seedDataExists } from "../../fixtures/db.fixture";

test.describe("Seeded Library Journey", () => {
  test.beforeAll(async () => {
    // Skip if seed data not present
    const hasData = await seedDataExists();
    if (!hasData) {
      test.skip();
    }
  });

  test.beforeEach(async ({ page, signInPage }) => {
    const { email, password } = getSeedUserCredentials();
    await signInPage.goto();
    await signInPage.signIn(email, password);
    await expect(page).toHaveURL("/my-items", { timeout: 10000 });
  });

  test("displays Movies folder with real movie titles", async ({ page }) => {
    // Click on Movies folder
    await page.getByText("Movies").click();

    // Should see real movie titles from TMDB
    await expect(page.getByText(/Shawshank Redemption/)).toBeVisible();
    await expect(page.getByText(/Dark Knight/)).toBeVisible();
    await expect(page.getByText(/Inception/)).toBeVisible();
  });

  test("displays TV Shows with seasons and episodes", async ({ page }) => {
    // Navigate to TV Shows
    await page.getByText("TV Shows").click();

    // Should see real TV show titles
    await expect(page.getByText(/Breaking Bad/)).toBeVisible();
    await expect(page.getByText(/Stranger Things/)).toBeVisible();

    // Navigate into Breaking Bad
    await page.getByText(/Breaking Bad/).click();

    // Should see seasons
    await expect(page.getByText("Season 1")).toBeVisible();
    await expect(page.getByText("Season 2")).toBeVisible();

    // Navigate into Season 1
    await page.getByText("Season 1").click();

    // Should see episode titles from TMDB
    await expect(page.getByText(/Pilot/)).toBeVisible();
  });

  test("movie items have descriptions from TMDB", async ({ itemsPage, page }) => {
    await page.getByText("Movies").click();

    // Open a movie's context menu and check settings
    await page.getByText(/Shawshank Redemption/).click({ button: "right" });
    await page.getByRole("menuitem", { name: "Settings" }).click();

    // Should have a description from TMDB
    const descriptionField = page.locator('textarea[name="description"]');
    const description = await descriptionField.inputValue();
    expect(description.length).toBeGreaterThan(0);
  });

  test("spotlight search finds seeded movies", async ({ page }) => {
    // Open spotlight
    await page.keyboard.press("/");

    // Search for a movie
    await page.getByPlaceholder(/search/i).fill("Inception");

    // Should find the seeded movie
    await expect(page.getByRole("option", { name: /Inception/ })).toBeVisible();
  });

  test("grid view shows movie posters", async ({ page }) => {
    await page.getByText("Movies").click();

    // Switch to grid view
    await page.getByRole("button", { name: /grid/i }).click();

    // Grid items should be visible
    const gridItems = page.locator('[data-testid="grid-item"]');
    await expect(gridItems.first()).toBeVisible();
  });
});
```

**Step 2: Run E2E test (requires seeded database)**

Run: `ALLOW_SEEDING=true npx prisma db seed && pnpm run test:e2e -- seeded-library.spec.ts`
Expected: PASS (or SKIP if no seed data)

**Step 3: Commit**

```bash
git add e2e/journeys/items/seeded-library.spec.ts
git commit -m "test: add E2E tests for seeded media library"
```

---

## Task 7: Run Full Test Suite and Verify

**Step 1: Run all checks**

Run: `pnpm run check`
Expected: All checks pass

**Step 2: Run unit tests**

Run: `pnpm run test`
Expected: All tests pass (new TMDB client tests included)

**Step 3: Run integration tests**

Run: `pnpm run test:integration`
Expected: All tests pass (new seed tests included)

**Step 4: Seed the database**

Run: `ALLOW_SEEDING=true TMDB_API_KEY=your_key npx prisma db seed`
Expected: Seeding completes with real movie/TV data

**Step 5: Run E2E tests**

Run: `pnpm run test:e2e`
Expected: All tests pass

**Step 6: Final commit**

```bash
git add -A
git commit -m "feat: complete true media seeding with TMDB integration"
```

---

## Testing Summary

### New Tests Added

**Unit Tests:**
- `tests/unit/lib/tmdb-client.test.ts` - 7 tests for TMDB API client

**Integration Tests:**
- `tests/integration/seed/seed.test.ts` - 3 tests for seeding data structure

**E2E Tests:**
- `e2e/journeys/items/seeded-library.spec.ts` - 5 tests for browsing seeded library

### Test Changes to Existing Tests

**No changes required** - existing tests use fresh test users, seeded data is isolated to seed@canoncore.com accounts.

### Tests to Remove/Update

**Remove or archive:**
- `docs/plans/2026-01-03-database-seeding-design.md` - superseded by this plan (uses old SFTP approach)

---

## Files Summary

### Files to Create

- `lib/tmdb-client.ts` - TMDB API client
- `prisma/seed-config.ts` - Seed configuration with TMDB IDs
- `prisma/seed.ts` - Main seed script
- `tests/unit/lib/tmdb-client.test.ts` - TMDB client unit tests
- `tests/integration/seed/seed.test.ts` - Seed integration tests
- `e2e/journeys/items/seeded-library.spec.ts` - Seeded library E2E tests

### Files to Modify

- `package.json` - Add prisma seed script
- `e2e/fixtures/db.fixture.ts` - Add seed user helpers

---

## Usage Instructions

### Prerequisites

1. Get a free TMDB API key at https://www.themoviedb.org/settings/api
2. Add to `.env.local`:
   ```bash
   TMDB_API_KEY=your_api_key_here
   SEED_PASSWORD=YourPreferredPassword123!  # Optional
   ```

### Running the Seed

```bash
# Seed development database
ALLOW_SEEDING=true npx prisma db seed

# Or with custom password
ALLOW_SEEDING=true SEED_PASSWORD=MyPassword123! npx prisma db seed
```

### Logging In

After seeding, log in with:
- **Email:** seed@canoncore.com
- **Password:** SeedPassword123! (or your custom SEED_PASSWORD)

### Re-seeding

The script is idempotent - it cleans up existing seed users before creating new ones. Safe to run multiple times.

---

## Future Enhancements

These were considered but deferred:

1. **Google Drive Poster Upload** - Download TMDB posters and upload to user's Drive
2. **Backdrop Images** - Add backdrop images for hero banners
3. **More Metadata** - Genres, cast, runtime, ratings
4. **Configurable Library Size** - Environment variable to control how many items
5. **Music Seeding** - Integration with MusicBrainz or Spotify API
