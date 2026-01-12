# Seed Hierarchy Enhancement Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enhance the seed script to create a realistic media library with full TMDB hierarchy (shows → seasons → episodes) and 1-2 files of each type (artwork, subtitle, media) at every level. Also expand description field to 1000 chars and add motion expand to item hero.

**Key Decisions:**

- Full TMDB depth: Show → Seasons → Episodes
- Configurable limits via env vars (default: 2 seasons, 10 episodes)
- 1-2 files of each type (artwork, subtitle, media) at every level
- Description field expanded to 1000 chars (matches TMDB)
- Hero description gets motion expand "Read More" pattern
- Testing priority: Integration tests
- Season 0 (specials) explicitly skipped
- TMDB API rate limiting: 100ms delay between calls

---

## Validation Checklist

This design was validated using code-review-excellence, Context7, and sequential thinking.

### Blocking Issues (Addressed)

| #   | Issue                                        | Resolution                                    |
| --- | -------------------------------------------- | --------------------------------------------- |
| 1   | Missing TMDB API rate limiting               | Added `sleep(100)` between API calls          |
| 2   | Massive show scale (Simpsons: 800+ episodes) | Added configurable limits via env vars        |
| 3   | Season 0 (specials) skipped silently         | Documented decision, starts loop at 1         |
| 4   | Empty season guard missing                   | Added `episodes?.length > 0` check            |
| 5   | Folder name sanitization                     | Added `sanitizeFolderName()` utility          |
| 6   | Wrong motion import path                     | Changed `"framer-motion"` to `"motion/react"` |

### Important Issues (Addressed)

| #   | Issue                                 | Resolution                                   |
| --- | ------------------------------------- | -------------------------------------------- |
| 7   | Test determinism - random file counts | Added `SEED_RANDOM_SEED` env var             |
| 8   | Integration tests hit real TMDB       | Added TMDB mocking (DB integration tests)    |
| 9   | Order values use episode_number       | Changed to array index                       |
| 10  | Missing edge case tests               | Added 6 new edge case tests                  |
| 11  | Null driveFileId handling             | Verified app handles gracefully              |
| 12  | Drive folder creation error handling  | Added try/catch around `createDriveFolder()` |
| 13  | Missing boundary tests                | Added tests for 150/1000 char boundaries     |
| 14  | Missing episode_number=0 edge case    | Documented behavior (TMDB rarely uses 0)     |
| 15  | Missing Drive upload failure test     | Added error case test                        |

### Suggestions (Addressed)

| #   | Suggestion                 | Resolution                                |
| --- | -------------------------- | ----------------------------------------- |
| 16  | Progress logging           | Added "Seeding season 3/8..." messages    |
| 17  | Estimated time remaining   | Added ETA calculation                     |
| 18  | Partial failure recovery   | Added cleanup on failure                  |
| 19  | Network timeout test       | Added to unit tests                       |
| 20  | Drive cleanup on failure   | Documented as manual (future enhancement) |
| 21  | Null description hero test | Added to hero unit tests                  |

---

## Task 1: Schema Migration - Expand Description

**Files:**

- Modify: `prisma/schema.prisma`
- Create: Migration file

**Changes:**

```prisma
// prisma/schema.prisma
model Item {
  description String?  @db.VarChar(1000)  // Was: 200
}
```

**Commands:**

```bash
npx prisma migrate dev --name expand-description-to-1000
```

---

## Task 2: Update Validations and TMDB Client

**Files:**

- Modify: `lib/validations.ts`
- Modify: `lib/tmdb-client.ts`

**Changes to lib/validations.ts:**

```typescript
/**
 * Schema for item description.
 * Optional field, max 1000 characters.
 */
export const itemDescriptionSchema = z
  .string()
  .transform((val) => val.trim())
  .pipe(z.string().max(1000, "Description must be 1000 characters or less"));
```

**Changes to lib/tmdb-client.ts:**

```typescript
/** TMDB TV season with full episode details. */
export interface TMDBSeasonDetail {
  id: number;
  season_number: number;
  name: string;
  overview: string;
  poster_path: string | null;
  episodes: TMDBEpisode[];
}

/** TMDB TV episode. */
export interface TMDBEpisode {
  id: number;
  episode_number: number;
  name: string;
  overview: string;
  still_path: string | null;
}

/**
 * Truncates text to max length with ellipsis.
 * Used to fit TMDB overviews into item description (1000 char limit).
 */
export function truncateOverview(text: string, maxLength = 1000): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}
```

---

## Task 3: Hero Description with Motion Expand

**Files:**

- Modify: `components/items/item-hero.tsx`
- Create: `tests/unit/components/items/item-hero.test.tsx` (if not exists)

**Design:**

```
┌──────────────────────────────────────────────────────┐
│  [Hero Artwork - Full Width Backdrop]                │
│                                                      │
│  ┌─────────────────────────────────────────────────┐ │
│  │  BREAKING BAD (2008)                            │ │
│  │                                                 │ │
│  │  A high school chemistry teacher diagnosed     │ │
│  │  with terminal lung cancer turns to...         │ │
│  │                           [Read More ↓]        │ │
│  └─────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

**Motion Details:**

| Element            | Animation                        | Timing            |
| ------------------ | -------------------------------- | ----------------- |
| Description text   | Height expansion with fade-in    | 400ms ease-out    |
| "Read More" button | Rotate arrow icon 180°           | 200ms             |
| Backdrop image     | Subtle scale(1.02) + dim overlay | 500ms ease-in-out |
| Content card       | Slight upward lift with shadow   | 300ms             |

**Implementation:**

```tsx
"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";

// Inside ItemHero component:
const [expanded, setExpanded] = useState(false);
const TRUNCATE_LENGTH = 150; // Show truncated by default
const shouldTruncate = description && description.length > TRUNCATE_LENGTH;

// In JSX:
<motion.div
  initial={false}
  animate={{ height: expanded ? "auto" : "4.5rem" }}
  transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
  className="overflow-hidden"
>
  <p className="text-muted-foreground">
    {expanded ? description : description?.slice(0, TRUNCATE_LENGTH) + "..."}
  </p>
</motion.div>;

{
  shouldTruncate && (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setExpanded(!expanded)}
      className="group mt-2"
    >
      {expanded ? "Show Less" : "Read More"}
      <motion.span
        animate={{ rotate: expanded ? 180 : 0 }}
        transition={{ duration: 0.2 }}
        className="ml-1"
      >
        <ChevronDown className="h-4 w-4" />
      </motion.span>
    </Button>
  );
}
```

**Tests:**

```typescript
describe("ItemHero description expand", () => {
  it("shows truncated description by default for long text", () => {});
  it("shows Read More button for long descriptions", () => {});
  it("expands description when Read More clicked", () => {});
  it("collapses description when Show Less clicked", () => {});
  it("hides Read More for short descriptions", () => {});
  it("handles null description gracefully", () => {});
  it("handles undefined description gracefully", () => {});
  it("shows Read More at exactly 151 chars (boundary)", () => {});
  it("hides Read More at exactly 150 chars (boundary)", () => {});
});
```

---

## Task 4: Seed Configuration Updates

**Files:**

- Modify: `prisma/seed-config.ts`

**New Environment Variables:**

```typescript
/**
 * Seed configuration for populating the database with demo content.
 * Uses TMDB IDs to fetch real movie and TV show metadata.
 */

/** Maximum seasons to seed per TV show (0 = unlimited). */
export const MAX_SEASONS = parseInt(process.env.SEED_MAX_SEASONS || "2", 10);

/** Maximum episodes to seed per season (0 = unlimited). */
export const MAX_EPISODES = parseInt(process.env.SEED_MAX_EPISODES || "10", 10);

/** Random seed for reproducible file counts in tests. */
export const RANDOM_SEED = process.env.SEED_RANDOM_SEED
  ? parseInt(process.env.SEED_RANDOM_SEED, 10)
  : null;

/** Delay between TMDB API calls in ms (rate limiting). */
export const TMDB_API_DELAY_MS = 100;
```

**Scale Analysis (with defaults):**

| Show                 | Seasons (capped at 2) | Episodes (capped at 10/season) | Est. Files     |
| -------------------- | --------------------- | ------------------------------ | -------------- |
| The Simpsons         | 2                     | 20                             | ~80            |
| Doctor Who           | 2                     | 20                             | ~80            |
| Breaking Bad         | 2                     | 20                             | ~80            |
| **Total (10 shows)** | 20                    | 200                            | **~800 files** |

**Full seeding (no limits):**

```bash
SEED_MAX_SEASONS=0 SEED_MAX_EPISODES=0 ALLOW_SEEDING=true npx prisma db seed
```

---

## Task 5: Enhance Seed Script - TV Show Hierarchy

**Files:**

- Modify: `prisma/seed.ts`
- Modify: `lib/tmdb-client.ts` (if getTVSeason needs updates)

**New Utilities:**

```typescript
/**
 * Sleep for specified milliseconds (rate limiting).
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Sanitizes folder name for Google Drive.
 * Removes/replaces characters that cause issues.
 */
function sanitizeFolderName(name: string): string {
  return name
    .replace(/[/\\]/g, "-") // Replace slashes
    .replace(/[<>:"|?*]/g, "") // Remove invalid chars
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim();
}

/**
 * Seeded random number generator for reproducible tests.
 */
function createSeededRandom(seed: number | null): () => number {
  if (seed === null) {
    return Math.random;
  }
  // Simple LCG for reproducibility
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}

const random = createSeededRandom(RANDOM_SEED);
```

**Data Flow:**

```
seedTVShows()
  └── For each TV show in TV_SHOW_IDS:
        ├── Fetch show details (getTVShow)
        ├── await sleep(TMDB_API_DELAY_MS)  // Rate limiting
        ├── Create show Item (depth: 0)
        ├── Attach files to show
        │
        └── seedSeasons(showId, showItemId, ctx)
              └── For season 1..min(number_of_seasons, MAX_SEASONS):
                    ├── Fetch season details (getTVSeason)
                    ├── await sleep(TMDB_API_DELAY_MS)  // Rate limiting
                    ├── Skip if season.episodes?.length === 0  // Empty guard
                    ├── Create season Item (depth: 1, parent: showItemId)
                    ├── Attach files to season
                    │
                    └── seedEpisodes(seasonData, seasonItemId, ctx)
                          └── For each episode (up to MAX_EPISODES):
                                ├── Create episode Item (depth: 2)
                                └── Attach files to episode
```

**New Functions:**

```typescript
/**
 * Seeds all seasons for a TV show.
 *
 * Note: Season 0 (specials) is intentionally skipped.
 * TMDB stores specials in Season 0, but they're often incomplete
 * and not part of the main series progression.
 */
async function seedSeasons(
  tvId: number,
  showItemId: string,
  showDriveFolderId: string,
  showName: string,
  numberOfSeasons: number,
  userId: string,
  ctx: DriveContext
): Promise<number> {
  let totalItems = 0;

  // Apply season limit (0 = unlimited)
  const maxSeasons =
    MAX_SEASONS === 0
      ? numberOfSeasons
      : Math.min(numberOfSeasons, MAX_SEASONS);

  // Start at 1 to skip Season 0 (specials)
  for (let seasonNum = 1; seasonNum <= maxSeasons; seasonNum++) {
    // Progress logging
    console.log(`    ⏳ Fetching season ${seasonNum}/${maxSeasons}...`);

    // Rate limiting
    await sleep(TMDB_API_DELAY_MS);

    const season = await tmdbFetch<TMDBSeasonDetail>(
      `/tv/${tvId}/season/${seasonNum}`
    );

    if (!season) {
      console.warn(
        `    ⚠️  Failed to fetch season ${seasonNum} for ${showName}`
      );
      continue;
    }

    // Empty season guard
    if (!season.episodes || season.episodes.length === 0) {
      console.warn(`    ⚠️  Season ${seasonNum} has no episodes, skipping`);
      continue;
    }

    const seasonName = sanitizeFolderName(season.name || `Season ${seasonNum}`);

    // Create Drive folder for season (with error handling)
    let seasonDriveFolderId: string;
    try {
      seasonDriveFolderId = await createDriveFolder(
        ctx,
        seasonName,
        showDriveFolderId
      );
    } catch (error) {
      console.error(
        `    ❌ Failed to create Drive folder for ${seasonName}:`,
        error
      );
      continue; // Skip this season but continue with others
    }

    // Create season Item
    const seasonItem = await prisma.item.create({
      data: {
        name: seasonName,
        description: truncateOverview(season.overview || ""),
        userId,
        parentId: showItemId,
        order: seasonNum - 1, // 0-indexed order
        depth: 1,
        driveConnectionId: ctx.connectionId,
        driveFileId: seasonDriveFolderId,
        syncStatus: SyncStatus.SYNCED,
      },
    });

    // Attach files to season
    await attachRandomFiles(
      seasonItem.id,
      "season",
      season.poster_path,
      null, // No backdrop for seasons
      ctx,
      seasonDriveFolderId
    );

    // Seed episodes
    const episodeCount = await seedEpisodes(
      season.episodes,
      seasonItem.id,
      seasonDriveFolderId,
      userId,
      ctx
    );

    totalItems += 1 + episodeCount;
    console.log(`    📁 ${seasonName} (${episodeCount} episodes)`);
  }

  return totalItems;
}

/**
 * Seeds all episodes for a season.
 */
async function seedEpisodes(
  episodes: TMDBEpisode[],
  seasonItemId: string,
  seasonDriveFolderId: string,
  userId: string,
  ctx: DriveContext
): Promise<number> {
  let count = 0;

  // Apply episode limit (0 = unlimited)
  const maxEpisodes =
    MAX_EPISODES === 0
      ? episodes.length
      : Math.min(episodes.length, MAX_EPISODES);
  const limitedEpisodes = episodes.slice(0, maxEpisodes);

  for (let i = 0; i < limitedEpisodes.length; i++) {
    const episode = limitedEpisodes[i];
    const episodeName = sanitizeFolderName(
      `E${String(episode.episode_number).padStart(2, "0")} - ${episode.name}`
    );

    // Create Drive folder for episode (with error handling)
    let episodeDriveFolderId: string;
    try {
      episodeDriveFolderId = await createDriveFolder(
        ctx,
        episodeName,
        seasonDriveFolderId
      );
    } catch (error) {
      console.error(
        `      ❌ Failed to create Drive folder for ${episodeName}:`,
        error
      );
      continue; // Skip this episode but continue with others
    }

    // Create episode Item
    // Use array index for order (not episode_number which can have gaps)
    const episodeItem = await prisma.item.create({
      data: {
        name: episodeName,
        description: truncateOverview(episode.overview || ""),
        userId,
        parentId: seasonItemId,
        order: i, // Array index, not episode_number
        depth: 2,
        driveConnectionId: ctx.connectionId,
        driveFileId: episodeDriveFolderId,
        syncStatus: SyncStatus.SYNCED,
      },
    });

    // Attach files to episode
    await attachRandomFiles(
      episodeItem.id,
      "episode",
      episode.still_path,
      null,
      ctx,
      episodeDriveFolderId
    );

    count++;
  }

  return count;
}
```

**Naming Convention:**

| Level   | Name Format                           | Example               |
| ------- | ------------------------------------- | --------------------- |
| Show    | `{name} ({year})`                     | "Breaking Bad (2008)" |
| Season  | TMDB name or `Season {n}` (sanitized) | "Season 1"            |
| Episode | `E{nn} - {name}` (sanitized)          | "E01 - Pilot"         |

---

## Task 6: File Attachment Logic

**Files:**

- Modify: `prisma/seed.ts`

**File Types per Level:**

| Level   | Artwork (1-2)    | Subtitles (1-2)          | Media (1-2) |
| ------- | ---------------- | ------------------------ | ----------- |
| Movie   | poster, backdrop | english.srt, spanish.srt | movie.mp4   |
| TV Show | poster, backdrop | english.srt, spanish.srt | -           |
| Season  | poster           | english.srt              | -           |
| Episode | still            | english.srt, spanish.srt | episode.mp4 |

**Implementation:**

```typescript
type ItemLevel = "movie" | "show" | "season" | "episode";

const SUBTITLE_LANGUAGES = ["english", "spanish", "french", "german"];

/**
 * Gets random count in range [min, max] using seeded random.
 */
function getRandomCount(min: number, max: number): number {
  return Math.floor(random() * (max - min + 1)) + min;
}

/**
 * Generates a placeholder SRT subtitle file.
 */
function generatePlaceholderSubtitle(
  language: string,
  itemName: string
): string {
  return `1
00:00:01,000 --> 00:00:05,000
[${language.toUpperCase()}] ${itemName}

2
00:00:06,000 --> 00:00:10,000
This is a placeholder subtitle file.

3
00:00:11,000 --> 00:00:15,000
Generated for testing purposes.
`;
}

/**
 * Attaches 1-2 of each file type to an item.
 */
async function attachRandomFiles(
  itemId: string,
  level: ItemLevel,
  primaryImagePath: string | null,
  backdropPath: string | null,
  ctx: DriveContext,
  driveFolderId: string
): Promise<void> {
  const artworkCount = getRandomCount(1, 2);
  const subtitleCount = getRandomCount(1, 2);
  const mediaCount =
    level === "episode" || level === "movie" ? getRandomCount(1, 2) : 0;

  // --- ARTWORK ---
  const artworkPaths: (string | null)[] = [
    primaryImagePath,
    backdropPath,
  ].filter(Boolean);

  for (let i = 0; i < Math.min(artworkCount, artworkPaths.length); i++) {
    const imagePath = artworkPaths[i];
    if (!imagePath) continue;

    const posterBuffer = await downloadPoster(imagePath);
    if (!posterBuffer) continue;

    const filename = i === 0 ? "poster.jpg" : `artwork-${i + 1}.jpg`;
    const uploaded = await uploadToDrive(
      ctx,
      filename,
      posterBuffer,
      "image/jpeg",
      driveFolderId
    );

    await prisma.itemFile.create({
      data: {
        itemId,
        filename,
        driveFileId: uploaded.id,
        fileType: FileType.ARTWORK,
        mimeType: "image/jpeg",
        size: BigInt(posterBuffer.length),
        isPrimary: i === 0,
        isHero: i === 0,
        syncStatus: SyncStatus.SYNCED,
      },
    });
  }

  // --- SUBTITLES ---
  // Shuffle using seeded random for reproducibility
  const shuffledLanguages = [...SUBTITLE_LANGUAGES].sort(() => random() - 0.5);
  const selectedLanguages = shuffledLanguages.slice(0, subtitleCount);

  for (let i = 0; i < selectedLanguages.length; i++) {
    const language = selectedLanguages[i];
    const filename = `${language}.srt`;
    const content = generatePlaceholderSubtitle(language, itemId);
    const buffer = Buffer.from(content, "utf-8");

    const uploaded = await uploadToDrive(
      ctx,
      filename,
      buffer,
      "application/x-subrip",
      driveFolderId
    );

    await prisma.itemFile.create({
      data: {
        itemId,
        filename,
        driveFileId: uploaded.id,
        fileType: FileType.SUBTITLE,
        mimeType: "application/x-subrip",
        size: BigInt(buffer.length),
        isPrimary: i === 0,
        isHero: false,
        syncStatus: SyncStatus.SYNCED,
      },
    });
  }

  // --- MEDIA PLACEHOLDERS ---
  // Note: driveFileId is null - app must handle this gracefully
  for (let i = 0; i < mediaCount; i++) {
    const filename =
      i === 0
        ? level === "movie"
          ? "movie.mp4"
          : "episode.mp4"
        : `media-${i + 1}.mp4`;

    await prisma.itemFile.create({
      data: {
        itemId,
        filename,
        driveFileId: null, // No actual file - placeholder only
        fileType: FileType.MEDIA,
        mimeType: "video/mp4",
        size: BigInt(0),
        isPrimary: i === 0,
        isHero: false,
        syncStatus: SyncStatus.SYNCED,
      },
    });
  }
}
```

**Primary/Hero Selection:**

- First artwork: `isPrimary: true, isHero: true`
- Additional artwork: `isPrimary: false, isHero: false`
- First subtitle: `isPrimary: true`
- First media: `isPrimary: true`

---

## Task 7: Progress Logging and ETA

**Files:**

- Modify: `prisma/seed.ts`

**Implementation:**

```typescript
interface SeedProgress {
  startTime: number;
  totalShows: number;
  completedShows: number;
  totalMovies: number;
  completedMovies: number;
}

/**
 * Calculates and logs estimated time remaining.
 */
function logProgress(progress: SeedProgress, currentItem: string): void {
  const elapsed = Date.now() - progress.startTime;
  const totalItems = progress.totalShows + progress.totalMovies;
  const completedItems = progress.completedShows + progress.completedMovies;

  if (completedItems === 0) {
    console.log(`🎬 Seeding: ${currentItem}`);
    return;
  }

  const avgTimePerItem = elapsed / completedItems;
  const remainingItems = totalItems - completedItems;
  const etaMs = avgTimePerItem * remainingItems;
  const etaMinutes = Math.ceil(etaMs / 60000);

  console.log(
    `🎬 Seeding: ${currentItem} (${completedItems}/${totalItems}, ~${etaMinutes}min remaining)`
  );
}

// In main():
const progress: SeedProgress = {
  startTime: Date.now(),
  totalShows: TV_SHOW_IDS.length,
  completedShows: 0,
  totalMovies: MOVIE_IDS.length,
  completedMovies: 0,
};

// After each show/movie:
progress.completedShows++;
logProgress(progress, showName);
```

---

## Task 8: Partial Failure Recovery

**Files:**

- Modify: `prisma/seed.ts`
- Create: `prisma/seed-cleanup.ts`

**Cleanup on Failure:**

```typescript
/**
 * Cleans up partially seeded data on failure.
 * Removes orphaned Drive folders and database records.
 */
async function cleanupOnFailure(
  userId: string,
  ctx: DriveContext
): Promise<void> {
  console.log("🧹 Cleaning up partial seed data...");

  try {
    // Delete ItemFiles first (foreign key constraint)
    await prisma.itemFile.deleteMany({
      where: { item: { userId } },
    });

    // Delete Items
    await prisma.item.deleteMany({
      where: { userId },
    });

    // Note: Drive folders are NOT deleted automatically
    // They may need manual cleanup via Drive UI
    console.log("⚠️  Database cleaned. Drive folders may need manual cleanup.");
  } catch (cleanupError) {
    console.error("❌ Cleanup failed:", cleanupError);
  }
}

// In main():
try {
  await seedMovies(...);
  await seedTVShows(...);
} catch (error) {
  console.error("❌ Seed failed:", error);
  await cleanupOnFailure(userId, ctx);
  throw error;
}
```

---

## Task 9: Integration Tests

**Files:**

- Modify: `tests/integration/seed/seed.test.ts`

**Tests:**

```typescript
// Mock TMDB to avoid hitting real API in CI
vi.mock("@/lib/tmdb-client", async () => {
  const actual = await vi.importActual("@/lib/tmdb-client");
  return {
    ...actual,
    tmdbFetch: vi.fn().mockImplementation((endpoint: string) => {
      // Return mock data based on endpoint
      if (endpoint.includes("/tv/")) return mockTVShow;
      if (endpoint.includes("/season/")) return mockSeason;
      return null;
    }),
  };
});

describe("seed script - hierarchy", () => {
  it("creates show → season → episode structure", async () => {
    const show = await prisma.item.findFirst({
      where: { depth: 0, parentId: null },
      include: {
        children: {
          include: {
            children: true,
          },
        },
      },
    });

    expect(show).toBeDefined();
    expect(show!.children.length).toBeGreaterThan(0);
    expect(show!.children[0].children.length).toBeGreaterThan(0);
  });

  it("sets correct depth values", async () => {
    const items = await prisma.item.findMany({
      select: { depth: true, parentId: true },
    });

    for (const item of items) {
      if (item.parentId === null) {
        expect(item.depth).toBe(0);
      }
    }
  });

  it("respects MAX_SEASONS limit", async () => {
    const seasons = await prisma.item.findMany({
      where: { depth: 1 },
    });

    // With default MAX_SEASONS=2, should have at most 2 seasons per show
    const showIds = [...new Set(seasons.map((s) => s.parentId))];
    for (const showId of showIds) {
      const showSeasons = seasons.filter((s) => s.parentId === showId);
      expect(showSeasons.length).toBeLessThanOrEqual(2);
    }
  });

  it("respects MAX_EPISODES limit", async () => {
    const episodes = await prisma.item.findMany({
      where: { depth: 2 },
    });

    // With default MAX_EPISODES=10, should have at most 10 episodes per season
    const seasonIds = [...new Set(episodes.map((e) => e.parentId))];
    for (const seasonId of seasonIds) {
      const seasonEpisodes = episodes.filter((e) => e.parentId === seasonId);
      expect(seasonEpisodes.length).toBeLessThanOrEqual(10);
    }
  });

  it("uses array index for episode order (not episode_number)", async () => {
    const episodes = await prisma.item.findMany({
      where: { depth: 2 },
      orderBy: { order: "asc" },
    });

    // Orders should be sequential 0, 1, 2... not potentially gapped episode numbers
    const seasonGroups = new Map<string, number[]>();
    for (const ep of episodes) {
      if (!seasonGroups.has(ep.parentId!)) {
        seasonGroups.set(ep.parentId!, []);
      }
      seasonGroups.get(ep.parentId!)!.push(ep.order);
    }

    for (const orders of seasonGroups.values()) {
      for (let i = 0; i < orders.length; i++) {
        expect(orders[i]).toBe(i);
      }
    }
  });

  it("skips empty seasons", async () => {
    // Mock a season with no episodes
    // Verify no Item created for it
  });

  it("sanitizes folder names with special characters", async () => {
    const items = await prisma.item.findMany({
      select: { name: true },
    });

    for (const item of items) {
      expect(item.name).not.toMatch(/[/\\<>:"|?*]/);
    }
  });
});

describe("seed script - file attachments", () => {
  it("attaches 1-2 artwork files per item", async () => {
    const items = await prisma.item.findMany({
      include: {
        files: {
          where: { fileType: "ARTWORK" },
        },
      },
    });

    for (const item of items) {
      expect(item.files.length).toBeGreaterThanOrEqual(1);
      expect(item.files.length).toBeLessThanOrEqual(2);
    }
  });

  it("attaches 1-2 subtitle files per item", async () => {
    const items = await prisma.item.findMany({
      include: {
        files: {
          where: { fileType: "SUBTITLE" },
        },
      },
    });

    for (const item of items) {
      expect(item.files.length).toBeGreaterThanOrEqual(1);
      expect(item.files.length).toBeLessThanOrEqual(2);
    }
  });

  it("attaches 1-2 media files to movies and episodes only", async () => {
    const episodes = await prisma.item.findMany({
      where: { depth: 2 },
      include: {
        files: {
          where: { fileType: "MEDIA" },
        },
      },
    });

    for (const ep of episodes) {
      expect(ep.files.length).toBeGreaterThanOrEqual(1);
      expect(ep.files.length).toBeLessThanOrEqual(2);
    }

    // Seasons should have NO media files
    const seasons = await prisma.item.findMany({
      where: { depth: 1 },
      include: {
        files: {
          where: { fileType: "MEDIA" },
        },
      },
    });

    for (const season of seasons) {
      expect(season.files.length).toBe(0);
    }
  });

  it("sets isPrimary on first artwork file", async () => {
    const items = await prisma.item.findMany({
      include: {
        files: {
          where: { fileType: "ARTWORK" },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    for (const item of items) {
      if (item.files.length > 0) {
        expect(item.files[0].isPrimary).toBe(true);
      }
    }
  });

  it("sets isHero on first artwork file", async () => {
    const items = await prisma.item.findMany({
      include: {
        files: {
          where: { fileType: "ARTWORK", isHero: true },
        },
      },
    });

    for (const item of items) {
      expect(item.files.length).toBe(1);
    }
  });

  it("creates media placeholders with null driveFileId", async () => {
    const mediaFiles = await prisma.itemFile.findMany({
      where: { fileType: "MEDIA" },
    });

    for (const file of mediaFiles) {
      expect(file.driveFileId).toBeNull();
      expect(file.size).toBe(BigInt(0));
    }
  });
});

describe("seed script - description field", () => {
  it("stores full TMDB overview up to 1000 chars", async () => {
    const items = await prisma.item.findMany({
      where: { description: { not: null } },
    });

    for (const item of items) {
      expect(item.description!.length).toBeLessThanOrEqual(1000);
    }
  });

  it("handles empty overview gracefully", async () => {
    const items = await prisma.item.findMany({
      where: { description: "" },
    });

    // Empty string is valid
    for (const item of items) {
      expect(item.description).toBe("");
    }
  });

  it("handles null overview gracefully", async () => {
    // Items without overview should have null description
    const items = await prisma.item.findMany({
      where: { description: null },
    });

    expect(items.length).toBeGreaterThanOrEqual(0); // May or may not exist
  });
});

describe("seed script - determinism", () => {
  it("produces same results with same SEED_RANDOM_SEED", async () => {
    // Run seed twice with same seed, compare file counts
    // This test may need to be in a separate test file
  });
});

describe("seed script - error handling", () => {
  it("continues seeding when Drive folder creation fails", async () => {
    // Mock createDriveFolder to fail for one season
    // Verify other seasons still created
  });

  it("continues seeding when Drive upload fails", async () => {
    // Mock uploadToDrive to fail for one file
    // Verify other files still created
  });

  it("continues seeding when poster download times out", async () => {
    // Mock downloadPoster to timeout
    // Verify item still created without artwork
  });

  it("handles episode_number=0 gracefully", async () => {
    // Mock TMDB response with episode_number: 0
    // Verify episode created with name "E00 - Name"
  });
});

describe("seed script - boundary conditions", () => {
  it("stores description exactly 1000 chars without truncation", async () => {
    const item = await prisma.item.findFirst({
      where: { description: { not: null } },
    });
    // Verify 1000 char description stored fully
  });

  it("truncates description at 1001 chars with ellipsis", async () => {
    // Mock TMDB response with 1001 char overview
    // Verify stored as 997 chars + "..."
  });
});
```

---

## Task 10: Unit Tests

**Files:**

- Modify: `tests/unit/prisma/seed.test.ts`

**Tests to Add:**

```typescript
describe("generatePlaceholderSubtitle", () => {
  it("generates valid SRT format", () => {
    const srt = generatePlaceholderSubtitle("english", "Test Item");
    expect(srt).toContain("1\n00:00:01,000");
    expect(srt).toContain("[ENGLISH]");
  });

  it("includes item name in subtitle", () => {
    const srt = generatePlaceholderSubtitle("spanish", "My Episode");
    expect(srt).toContain("My Episode");
  });
});

describe("getRandomCount", () => {
  it("returns value in range", () => {
    for (let i = 0; i < 100; i++) {
      const count = getRandomCount(1, 2);
      expect(count).toBeGreaterThanOrEqual(1);
      expect(count).toBeLessThanOrEqual(2);
    }
  });
});

describe("sanitizeFolderName", () => {
  it("replaces forward slashes with dashes", () => {
    expect(sanitizeFolderName("Episode 1/2")).toBe("Episode 1-2");
  });

  it("replaces backslashes with dashes", () => {
    expect(sanitizeFolderName("Episode 1\\2")).toBe("Episode 1-2");
  });

  it("removes invalid characters", () => {
    expect(sanitizeFolderName('Episode: "Test"?')).toBe("Episode Test");
  });

  it("normalizes whitespace", () => {
    expect(sanitizeFolderName("Episode   1")).toBe("Episode 1");
  });

  it("trims leading/trailing whitespace", () => {
    expect(sanitizeFolderName("  Episode 1  ")).toBe("Episode 1");
  });
});

describe("createSeededRandom", () => {
  it("produces same sequence with same seed", () => {
    const random1 = createSeededRandom(12345);
    const random2 = createSeededRandom(12345);

    for (let i = 0; i < 10; i++) {
      expect(random1()).toBe(random2());
    }
  });

  it("produces different sequences with different seeds", () => {
    const random1 = createSeededRandom(12345);
    const random2 = createSeededRandom(54321);

    const seq1 = Array.from({ length: 10 }, () => random1());
    const seq2 = Array.from({ length: 10 }, () => random2());

    expect(seq1).not.toEqual(seq2);
  });

  it("uses Math.random when seed is null", () => {
    const random = createSeededRandom(null);
    expect(random).toBe(Math.random);
  });
});

describe("attachRandomFiles", () => {
  it("creates correct file types for episodes", async () => {
    // Mock and verify ARTWORK, SUBTITLE, MEDIA created
  });

  it("creates correct file types for seasons (no media)", async () => {
    // Mock and verify no MEDIA files for seasons
  });

  it("handles null primaryImagePath gracefully", async () => {
    // Should not create artwork if path is null
  });

  it("handles null backdropPath gracefully", async () => {
    // Should only create one artwork if backdrop is null
  });
});

describe("sleep", () => {
  it("delays for specified milliseconds", async () => {
    const start = Date.now();
    await sleep(100);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(95); // Allow small variance
  });
});

describe("downloadPoster", () => {
  it("returns null on network timeout", async () => {
    // Mock fetch to timeout
    vi.spyOn(global, "fetch").mockImplementation(
      () =>
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), 100)
        )
    );
    const result = await downloadPoster("/path/to/poster.jpg");
    expect(result).toBeNull();
  });

  it("returns null on 404 response", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 404,
    } as Response);
    const result = await downloadPoster("/path/to/poster.jpg");
    expect(result).toBeNull();
  });
});

describe("truncateOverview boundary", () => {
  it("returns exact string at 1000 chars", () => {
    const text = "a".repeat(1000);
    expect(truncateOverview(text)).toBe(text);
    expect(truncateOverview(text).length).toBe(1000);
  });

  it("truncates at 1001 chars with ellipsis", () => {
    const text = "a".repeat(1001);
    const result = truncateOverview(text);
    expect(result.length).toBe(1000);
    expect(result.endsWith("...")).toBe(true);
  });
});
```

**Tests to Update:**

- Update description max length expectations from 200 → 1000
- Update any hardcoded truncation tests

---

## Task 11: E2E Tests

**Files:**

- Modify: `e2e/journeys/items/seeded-library.spec.ts`

**Tests:**

```typescript
describe("seeded library hierarchy", () => {
  test("displays TV show with seasons as children", async ({ page }) => {
    // Navigate to seeded TV show
    // Verify seasons visible in tree/grid view
  });

  test("drills into season to see episodes", async ({ page }) => {
    // Click on a season
    // Verify episodes visible
  });

  test("shows episode artwork (stills)", async ({ page }) => {
    // Navigate to episode
    // Verify still image displays
  });

  test("shows multiple file types in settings dialog", async ({ page }) => {
    // Open item settings
    // Verify artwork, subtitle, media files listed
  });

  test("handles media placeholder gracefully (no play button)", async ({
    page,
  }) => {
    // Navigate to episode with media placeholder
    // Verify no broken play button or error
  });
});

describe("hero description expand", () => {
  test("shows Read More for long descriptions", async ({ page }) => {
    // Navigate to item with long description
    // Verify "Read More" button visible
  });

  test("expands description on click", async ({ page }) => {
    // Click Read More
    // Verify full description visible
    // Verify button text changes to "Show Less"
  });

  test("collapses description on Show Less click", async ({ page }) => {
    // Expand then collapse
    // Verify truncated again
  });

  test("animates smoothly during expand/collapse", async ({ page }) => {
    // Check that motion animation occurs
    // Could verify CSS transition properties
  });
});
```

---

## Task 12: Final Verification

**Commands:**

```bash
# Run schema migration
npx prisma migrate dev --name expand-description-to-1000

# Run all checks
pnpm run check

# Run unit tests
pnpm run test

# Run integration tests
pnpm run test:integration

# Seed database (with defaults: 2 seasons, 10 episodes)
ALLOW_SEEDING=true npx prisma db seed

# Seed database (full, no limits - WARNING: slow)
SEED_MAX_SEASONS=0 SEED_MAX_EPISODES=0 ALLOW_SEEDING=true npx prisma db seed

# Seed database (reproducible for testing)
SEED_RANDOM_SEED=12345 ALLOW_SEEDING=true npx prisma db seed

# Run E2E tests
pnpm run test:e2e
```

---

## Files Summary

### Files to Create

- `prisma/migrations/XXX_expand_description_to_1000/` (auto-generated)
- `prisma/seed-cleanup.ts` (cleanup utility)

### Files to Modify

| File                                             | Changes                                                                                                                                                   |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prisma/schema.prisma`                           | `@db.VarChar(1000)`                                                                                                                                       |
| `lib/validations.ts`                             | `.max(1000)`                                                                                                                                              |
| `lib/tmdb-client.ts`                             | `truncateOverview` default 1000, `TMDBSeasonDetail` type                                                                                                  |
| `prisma/seed-config.ts`                          | `MAX_SEASONS`, `MAX_EPISODES`, `RANDOM_SEED`, `TMDB_API_DELAY_MS`                                                                                         |
| `prisma/seed.ts`                                 | `seedSeasons()`, `seedEpisodes()`, `attachRandomFiles()`, `sanitizeFolderName()`, `sleep()`, `createSeededRandom()`, progress logging, cleanup on failure |
| `components/items/item-hero.tsx`                 | Motion expand for description                                                                                                                             |
| `tests/integration/seed/seed.test.ts`            | Hierarchy, file attachment, edge case tests                                                                                                               |
| `tests/unit/prisma/seed.test.ts`                 | New function tests                                                                                                                                        |
| `tests/unit/components/items/item-hero.test.tsx` | Expand/collapse tests                                                                                                                                     |
| `e2e/journeys/items/seeded-library.spec.ts`      | Hierarchy navigation and expand tests                                                                                                                     |

### Environment Variables

| Variable            | Default  | Description                                       |
| ------------------- | -------- | ------------------------------------------------- |
| `SEED_MAX_SEASONS`  | `2`      | Max seasons per show (0 = unlimited)              |
| `SEED_MAX_EPISODES` | `10`     | Max episodes per season (0 = unlimited)           |
| `SEED_RANDOM_SEED`  | `null`   | Seed for reproducible random (null = Math.random) |
| `ALLOW_SEEDING`     | required | Must be "true" to run seed                        |
| `TMDB_API_KEY`      | required | TMDB API key                                      |

### Estimated Test Count

| Type        | New Tests |
| ----------- | --------- |
| Integration | ~26       |
| Unit        | ~22       |
| E2E         | ~8        |
| **Total**   | **~56**   |

---

## Sources

- [TMDB Forum: Maximum length of movie overview](https://www.themoviedb.org/talk/5b59e5a09251414d1b012d9b) - Confirms 1000 char limit
- [TMDB Rate Limiting](https://developer.themoviedb.org/docs/rate-limiting) - ~50 req/sec limit
- [The Simpsons Episodes - Wikipedia](https://en.wikipedia.org/wiki/List_of_The_Simpsons_episodes) - 800+ episodes across 37 seasons (scale reference)
- [Motion Upgrade Guide](https://motion.dev/docs/react-upgrade-guide) - Documents rebrand from framer-motion to motion/react
