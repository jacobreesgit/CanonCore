/**
 * Database seed script for populating demo content with Google Drive integration.
 * Fetches TMDB metadata, downloads posters, and uploads to Google Drive.
 *
 * IMPORTANT: Google Drive is REQUIRED for seeding. Run setup first:
 *   pnpm run setup:seed
 *
 * MODES:
 *   - Incremental (default): Only re-seeds users whose config has changed
 *   - Clean Slate: Wipes everything and recreates (SEED_INCREMENTAL=false)
 *
 * Flow (Incremental):
 *   1. Validate environment (required vars, production DB check, Drive setup)
 *   2. Compare content hashes to find changed users
 *   3. Clean only affected users (Drive + DB)
 *   4. Recreate affected users with content
 *   5. Save content hash for next run
 *
 * Flow (Clean Slate):
 *   1. Validate environment
 *   2. Clean ALL Google Drive content (delete files, empty trash)
 *   3. Cleanup ALL seed users from database
 *   4. Create all seed users with content
 *
 * Usage:
 *   pnpm seed:quick                    # Incremental - fast when unchanged
 *   pnpm seed:full                     # Clean slate - full rebuild
 *   ALLOW_SEEDING=true npx prisma db seed  # Default incremental
 *   SEED_INCREMENTAL=false ALLOW_SEEDING=true npx prisma db seed  # Force clean
 *
 * Required Environment Variables:
 *   - ALLOW_SEEDING: Must be "true" to run (prevents accidental seeding)
 *   - TMDB_API_KEY: Required for fetching metadata (v3 API key)
 *   - DATABASE_URL: Database connection string (must not be production)
 *   - GOOGLE_SEED_REFRESH_TOKEN: Refresh token for Drive integration
 *   - GOOGLE_SEED_ROOT_FOLDER_ID: Root folder for Drive storage
 *   - GOOGLE_CLIENT_ID: OAuth client ID
 *   - GOOGLE_CLIENT_SECRET: OAuth client secret
 *   - ENCRYPTION_KEY: For encrypting Drive tokens
 *
 * Optional Environment Variables:
 *   - SEED_PASSWORD: Password for seed users (default: SeedPassword123!)
 *   - SEED_ONLY_MOVIES: Skip TV shows, seed only movies (default: false)
 *   - SEED_ONLY_SHOWS: Skip movies, seed only TV shows (default: false)
 *   - SEED_SKIP_ARTWORK: Skip downloading/uploading artwork (default: false)
 *   - SEED_QUIET: Suppress progress output (default: false)
 *   - SEED_MOVIE_COUNT: Limit number of movies (0 = all, default: 0)
 *   - SEED_SHOW_COUNT: Limit number of TV shows (0 = all, default: 0)
 *   - SEED_USER_EMAIL: Override to seed single user only (default: null)
 *   - SEED_MAX_SEASONS: Max seasons per show (0 = unlimited, default: 2)
 *   - SEED_MAX_EPISODES: Max episodes per season (0 = unlimited, default: 10)
 *   - SEED_RANDOM_SEED: Seed for reproducible random file counts (default: random)
 *   - SEED_SIMULATE_PLAYBACK: Generate playback progress data (default: true)
 *   - SEED_INCREMENTAL: Enable incremental mode (default: true, set to "false" for clean slate)
 *
 * Doctor Who Consolidation:
 *   Classic Doctor Who (1963-1989) and Modern Doctor Who (2005+) are consolidated
 *   into a single "Doctor Who" folder with seasons from both eras.
 */

// Load environment variables before any other imports
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

import type { drive_v3 } from "googleapis";
import { FileType, SyncStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import {
  DEFAULT_SEED_PASSWORD,
  MAX_SEASONS,
  MAX_EPISODES,
  RANDOM_SEED,
  TMDB_API_DELAY_MS,
  SEED_SKIP_ARTWORK,
  SEED_QUIET,
  SEED_SIMULATE_PLAYBACK,
  SEED_INCREMENTAL,
  PLAYBACK_DURATIONS,
  getEffectiveMovieIds,
  getEffectiveTVShowIds,
  getEffectiveSeedUsers,
  getEffectiveMovieIdsForUser,
  getEffectiveTVShowIdsForUser,
  USER_PROGRESS_RANGES,
  USER_PINNED_ITEMS,
  AVATAR_SIZE,
  HERO_SIZE,
  buildPicsumUrl,
  validateContentDistribution,
  computeUserContentHash,
  DEMO_USER_EMAIL,
  type SeedUserConfig,
} from "./seed-config";
import { assertDriveConfigured } from "@/lib/drive-verification";

// Prisma will be dynamically imported after env vars are loaded
import type { PrismaClient } from "@prisma/client";
import { SyncLogAction, SyncLogStatus } from "@prisma/client";
let prisma: PrismaClient;

// TMDB API configuration
const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";
const TMDB_TIMEOUT_MS = 10000;

// Local media files for Breaking Bad S1E1 (optional - for video player screenshots)
const BREAKING_BAD_TMDB_ID = 1396;
const LOCAL_VIDEO_PATH = path.resolve(
  __dirname,
  "../Breaking.Bad.S01E01.1080p.BluRay.x265-RARBG.mp4"
);
const LOCAL_SUBTITLE_PATH = path.resolve(__dirname, "../3_English.srt");

interface TMDBMovie {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
}

interface TMDBTVShow {
  id: number;
  name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string;
  number_of_seasons: number;
}

interface TMDBSeasonDetail {
  id: number;
  season_number: number;
  name: string;
  overview: string;
  poster_path: string | null;
  episodes: TMDBEpisode[];
}

interface TMDBSeasonImages {
  backdrops: Array<{
    file_path: string;
    vote_average: number;
  }>;
  posters: Array<{
    file_path: string;
    vote_average: number;
  }>;
}

interface TMDBEpisode {
  id: number;
  episode_number: number;
  name: string;
  overview?: string;
  still_path?: string | null;
}

interface DriveContext {
  drive: Awaited<ReturnType<typeof getDriveClient>>;
  connectionId: string;
  rootFolderId: string;
}

/**
 * Gets a Drive client using the test refresh token.
 */
async function getDriveClient() {
  const { getDriveClientFromRefreshToken } =
    await import("@/lib/google-drive-client");
  const refreshToken = process.env.GOOGLE_SEED_REFRESH_TOKEN!;
  return getDriveClientFromRefreshToken(refreshToken);
}

/**
 * Fetches data from TMDB API with timeout.
 * Uses v3 API key as query parameter for authentication.
 */
async function tmdbFetch<T>(endpoint: string): Promise<T | null> {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    console.error("❌ TMDB_API_KEY not set");
    return null;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TMDB_TIMEOUT_MS);

  // Use query param auth for v3 API key
  const separator = endpoint.includes("?") ? "&" : "?";
  const url = `${TMDB_BASE_URL}${endpoint}${separator}api_key=${apiKey}`;

  try {
    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      console.error(`TMDB API error: ${response.status}`);
      return null;
    }

    return response.json();
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      console.error(`TMDB request timed out: ${endpoint}`);
    } else {
      console.error("TMDB fetch failed:", error);
    }
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Downloads a poster image from TMDB at original quality.
 */
async function downloadPoster(
  posterPath: string | null
): Promise<Buffer | null> {
  if (!posterPath) return null;

  const url = `${TMDB_IMAGE_BASE}/original${posterPath}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TMDB_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return null;

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Extracts year from date string.
 */
function extractYear(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  return dateStr.split("-")[0] || "";
}

/**
 * Truncates text to max length with ellipsis.
 * Used to fit TMDB overviews into item description (1000 char limit).
 */
function truncateOverview(text: string, maxLength = 1000): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}

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
 * Returns Math.random if no seed provided.
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

// Create seeded random instance
const random = createSeededRandom(RANDOM_SEED);

/**
 * Gets random count in range [min, max] using seeded random.
 */
function getRandomCount(min: number, max: number): number {
  return Math.floor(random() * (max - min + 1)) + min;
}

/** Available subtitle languages for random selection. */
const SUBTITLE_LANGUAGES = ["english", "spanish", "french", "german"];

/**
 * Logs message if not in quiet mode.
 */
function log(message: string): void {
  if (!SEED_QUIET) {
    console.log(message);
  }
}

/**
 * Cleans all content from the seed Google Drive account.
 * Deletes all files/folders in root, empties trash, and verifies empty.
 *
 * Note: Deleting a folder cascades to all nested contents (Google Drive behavior).
 * We only need to delete items directly in the root folder.
 *
 * @throws Error if cleanup fails at any step (abort seed on failure)
 */
/**
 * Legacy cleanup - wipes ALL Google Drive content.
 * Only used when SEED_INCREMENTAL=false (clean slate mode).
 */
async function cleanupAllGoogleDrive(): Promise<void> {
  const refreshToken = process.env.GOOGLE_SEED_REFRESH_TOKEN;
  const rootFolderId = process.env.GOOGLE_SEED_ROOT_FOLDER_ID;

  if (!refreshToken || !rootFolderId) {
    throw new Error("Drive credentials required for cleanup");
  }

  const { getDriveClientFromRefreshToken, emptyTrash, batchDelete } =
    await import("@/lib/google-drive-client");

  const drive = await getDriveClientFromRefreshToken(refreshToken);

  // 1. List ALL items in root folder with pagination
  const allItems: Array<{ id: string; name: string }> = [];
  let pageToken: string | undefined;

  do {
    const response = await drive.files.list({
      q: `'${rootFolderId}' in parents and trashed = false`,
      fields: "files(id, name), nextPageToken",
      pageSize: 1000,
      pageToken,
    });

    const items = response.data.files || [];
    for (const item of items) {
      if (item.id && item.name) {
        allItems.push({ id: item.id, name: item.name });
      }
    }

    pageToken = response.data.nextPageToken ?? undefined;
  } while (pageToken);

  console.log(`🗑️  Found ${allItems.length} items to delete`);

  // 2. Batch delete items (moves to trash, 100 per batch for efficiency)
  if (allItems.length > 0) {
    const fileIds = allItems.map((item) => item.id);

    // Get fresh access token for batch API
    const accessToken = await getAccessTokenFromRefreshToken(refreshToken);

    // batchDelete handles chunking into batches of 100
    const result = await batchDelete(accessToken, fileIds);

    if (result.failed.length > 0) {
      console.warn(
        `⚠️  Failed to delete ${result.failed.length} items:`,
        result.failed.slice(0, 3).map((f: { error: string }) => f.error)
      );
    }

    console.log(`🗑️  Moved ${result.succeeded.length} items to trash`);
  }

  // 3. Empty trash (catches any pre-existing trashed items)
  console.log("🗑️  Emptying trash...");
  await emptyTrash(drive);
  console.log("✅ Trash empty request sent (continuing without verification)");
}

/**
 * Gets an access token from a refresh token for batch API operations.
 *
 * @param refreshToken - The refresh token
 * @returns The access token
 * @throws Error if token refresh fails
 */
async function getAccessTokenFromRefreshToken(
  refreshToken: string
): Promise<string> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to refresh token for Drive cleanup");
  }

  const { access_token } = await response.json();
  return access_token;
}

/**
 * Polls Google Drive until trash is confirmed empty.
 * Google Drive trash emptying can be async, so we verify completion.
 *
 * @param drive - Google Drive client instance
 * @throws Error if trash not empty after 120 seconds
 */
async function _verifyTrashEmpty(drive: drive_v3.Drive): Promise<void> {
  const POLL_INTERVAL_MS = 3000;
  const TIMEOUT_MS = 120000;
  const startTime = Date.now();

  while (Date.now() - startTime < TIMEOUT_MS) {
    const response = await drive.files.list({
      q: "trashed = true",
      fields: "files(id)",
      pageSize: 1,
    });

    const trashedItems = response.data.files || [];
    if (trashedItems.length === 0) {
      console.log("✅ Trash verified empty");
      return;
    }

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log(`  ⏳ Waiting for trash to empty... (${elapsed}s)`);
    await sleep(POLL_INTERVAL_MS);
  }

  throw new Error("Timeout: Trash not empty after 120 seconds");
}

/** Progress tracking for seed operation. */
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
    log(`🎬 Seeding: ${currentItem}`);
    return;
  }

  const avgTimePerItem = elapsed / completedItems;
  const remainingItems = totalItems - completedItems;
  const etaMs = avgTimePerItem * remainingItems;
  const etaMinutes = Math.ceil(etaMs / 60000);

  log(
    `🎬 Seeding: ${currentItem} (${completedItems}/${totalItems}, ~${etaMinutes}min remaining)`
  );
}

/** Item level for determining file types to attach. */
type ItemLevel = "movie" | "show" | "season" | "episode";

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
 * Downloads a backdrop image from TMDB at original quality.
 */
async function downloadBackdrop(
  backdropPath: string | null
): Promise<Buffer | null> {
  if (!backdropPath) return null;

  const url = `${TMDB_IMAGE_BASE}/original${backdropPath}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TMDB_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return null;

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Fetches season images from TMDB and returns the highest-rated backdrop.
 * Returns null if no backdrops are available.
 */
async function fetchSeasonBackdrop(
  tvId: number,
  seasonNumber: number
): Promise<string | null> {
  const images = await tmdbFetch<TMDBSeasonImages>(
    `/tv/${tvId}/season/${seasonNumber}/images`
  );

  if (!images || !images.backdrops || images.backdrops.length === 0) {
    return null;
  }

  // Sort by vote_average descending and return the highest-rated backdrop
  const sortedBackdrops = images.backdrops.sort(
    (a, b) => b.vote_average - a.vote_average
  );

  return sortedBackdrops[0].file_path;
}

/** Downloaded image data with MIME type. */
interface ImageData {
  data: Uint8Array<ArrayBuffer>;
  mime: string;
}

/** Unsplash photo response structure. */
interface UnsplashPhoto {
  id: string;
  urls: {
    raw: string;
    full: string;
    regular: string;
  };
  user: {
    name: string;
  };
}

/** Cached popular Unsplash photos for hero images. */
let cachedUnsplashPhotos: UnsplashPhoto[] | null = null;

/**
 * Fetches popular landscape photos from Unsplash.
 * Caches results for reuse across multiple users.
 *
 * @returns Array of popular Unsplash photos, or empty array on failure
 */
async function fetchPopularUnsplashPhotos(): Promise<UnsplashPhoto[]> {
  if (cachedUnsplashPhotos) return cachedUnsplashPhotos;

  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey) {
    log("  ⚠️  UNSPLASH_ACCESS_KEY not set, falling back to Picsum");
    return [];
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TMDB_TIMEOUT_MS);

  try {
    const url =
      "https://api.unsplash.com/photos?order_by=popular&per_page=10&orientation=landscape";
    const response = await fetch(url, {
      headers: {
        Authorization: `Client-ID ${accessKey}`,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      log(`  ⚠️  Unsplash API error: ${response.status}`);
      return [];
    }

    const photos = (await response.json()) as UnsplashPhoto[];
    cachedUnsplashPhotos = photos;
    log(`  📸 Fetched ${photos.length} popular photos from Unsplash`);
    return photos;
  } catch (error) {
    log(`  ⚠️  Unsplash fetch failed: ${error}`);
    return [];
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Downloads a hero image from Unsplash with custom dimensions.
 *
 * @param photo - Unsplash photo object
 * @param width - Desired width
 * @param height - Desired height
 * @returns Image data and MIME type, or null on failure
 */
async function downloadUnsplashHero(
  photo: UnsplashPhoto,
  width: number,
  height: number
): Promise<ImageData | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TMDB_TIMEOUT_MS);

  try {
    // Construct sized URL from raw URL
    const sizedUrl = `${photo.urls.raw}&w=${width}&h=${height}&fit=crop&q=80`;
    const response = await fetch(sizedUrl, {
      signal: controller.signal,
    });

    if (!response.ok) return null;

    const contentType = response.headers.get("content-type") || "image/jpeg";
    const arrayBuffer = await response.arrayBuffer();
    return {
      data: new Uint8Array(arrayBuffer as ArrayBuffer),
      mime: contentType,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Downloads a profile image from Lorem Picsum.
 * Returns Uint8Array and MIME type for database storage.
 *
 * @param url - Lorem Picsum URL
 * @returns Image data and MIME type, or null on failure
 */
async function downloadProfileImage(url: string): Promise<ImageData | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TMDB_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
    });
    if (!response.ok) return null;

    const contentType = response.headers.get("content-type") || "image/jpeg";
    const arrayBuffer = await response.arrayBuffer();
    // Create Uint8Array with explicit ArrayBuffer type for Prisma Bytes compatibility
    return {
      data: new Uint8Array(arrayBuffer as ArrayBuffer),
      mime: contentType,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

/** Progress range for playback simulation. */
interface ProgressRangeParam {
  min: number;
  max: number;
}

/**
 * Context for ordered progress simulation in TV shows.
 * Enables realistic viewing order where earlier episodes are complete.
 */
interface OrderedProgressContext {
  /** Current episode index (0-based, across all seasons). */
  episodeIndex: number;
  /** Total number of episodes in the show. */
  totalEpisodes: number;
  /** Episode index where user is currently watching (calculated from progress range). */
  watchPoint: number;
  /** Progress percentage for the episode AT the watch point (0-1). */
  watchPointProgress: number;
}

/**
 * Calculates watch point and progress for ordered TV show viewing.
 * - Episodes before watch point: 100% complete
 * - Episode at watch point: partial progress
 * - Episodes after watch point: unwatched
 *
 * @param totalEpisodes - Total episodes in the show
 * @param progressRange - User's progress range (0-1)
 * @returns Watch point and progress for the current episode
 */
function calculateWatchPoint(
  totalEpisodes: number,
  progressRange: ProgressRangeParam
): { watchPoint: number; watchPointProgress: number } {
  if (progressRange.min === 0 && progressRange.max === 0) {
    // Unwatched
    return { watchPoint: -1, watchPointProgress: 0 };
  }

  // Calculate overall progress through the show (average of min/max)
  const overallProgress = (progressRange.min + progressRange.max) / 2;

  // Watch point is the episode the user is currently on
  const watchPoint = Math.floor(overallProgress * totalEpisodes);

  // Progress within the current episode (random within user's range)
  const watchPointProgress =
    progressRange.min + Math.random() * (progressRange.max - progressRange.min);

  return { watchPoint, watchPointProgress };
}

/**
 * Attaches files to an item.
 * - Artwork: Poster as primary, backdrop as hero image (movies/shows only)
 * - Subtitles: Generated placeholder SRT files
 * - Media: Placeholder entries with null driveFileId (episodes/movies only)
 *
 * Respects SEED_SKIP_ARTWORK flag.
 *
 * @param progressRange - Optional progress range for playback simulation (0-1).
 *                        If provided, uses range to determine completion percentage.
 *                        If not provided, uses default 4-bucket distribution.
 * @param orderedProgress - Optional context for ordered TV show progress simulation.
 *                          When provided, uses realistic watch order logic.
 */
async function attachRandomFiles(
  itemId: string,
  itemName: string,
  level: ItemLevel,
  primaryImagePath: string | null,
  backdropPath: string | null,
  ctx: DriveContext | null,
  driveFolderId: string | null,
  progressRange?: ProgressRangeParam,
  orderedProgress?: OrderedProgressContext
): Promise<void> {
  const subtitleCount = getRandomCount(1, 2);
  const mediaCount =
    level === "episode" || level === "movie" ? getRandomCount(1, 2) : 0;

  // --- PRIMARY ARTWORK (poster) - movies and shows only ---
  if (
    !SEED_SKIP_ARTWORK &&
    primaryImagePath &&
    level !== "episode" &&
    ctx &&
    driveFolderId
  ) {
    const posterBuffer = await downloadPoster(primaryImagePath);
    if (posterBuffer) {
      try {
        const uploaded = await uploadToDrive(
          ctx,
          "poster.jpg",
          posterBuffer,
          "image/jpeg",
          driveFolderId
        );

        await prisma.itemFile.create({
          data: {
            itemId,
            filename: "poster.jpg",
            driveFileId: uploaded.id,
            fileType: FileType.ARTWORK,
            mimeType: "image/jpeg",
            size: BigInt(posterBuffer.length),
            isPrimary: true,
            isHero: false,
            syncStatus: SyncStatus.SYNCED,
          },
        });
      } catch {
        // Continue even if upload fails
      }
    }
  }

  // --- HERO IMAGE (backdrop for movies/shows/seasons, still for episodes) ---
  if (!SEED_SKIP_ARTWORK && ctx && driveFolderId) {
    let heroBuffer: Buffer | null = null;
    let filename: string | null = null;

    if (level === "episode" && primaryImagePath) {
      // Episodes use still_path as hero image
      heroBuffer = await downloadPoster(primaryImagePath);
      filename = "still.jpg";
    } else if (
      backdropPath &&
      (level === "movie" || level === "show" || level === "season")
    ) {
      // Movies, shows, and seasons use backdrop as hero image
      heroBuffer = await downloadBackdrop(backdropPath);
      filename = "backdrop.jpg";
    }

    if (heroBuffer && filename) {
      try {
        const uploaded = await uploadToDrive(
          ctx,
          filename,
          heroBuffer,
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
            size: BigInt(heroBuffer.length),
            isPrimary: false,
            isHero: true,
            syncStatus: SyncStatus.SYNCED,
          },
        });
      } catch {
        // Continue even if upload fails
      }
    }
  }

  // --- SUBTITLES (skip if no Drive) ---
  if (ctx && driveFolderId) {
    // Shuffle using seeded random for reproducibility
    const shuffledLanguages = [...SUBTITLE_LANGUAGES].sort(
      () => random() - 0.5
    );
    const selectedLanguages = shuffledLanguages.slice(0, subtitleCount);

    for (let i = 0; i < selectedLanguages.length; i++) {
      const language = selectedLanguages[i];
      const filename = `${language}.srt`;
      const content = generatePlaceholderSubtitle(language, itemName);
      const buffer = Buffer.from(content, "utf-8");

      try {
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
      } catch {
        // Continue even if upload fails
      }
    }
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

    // Generate realistic playback data for progress bar testing
    let playbackDuration: number | null = null;
    let playbackPosition: number | null = null;

    if (SEED_SIMULATE_PLAYBACK) {
      const durationRange =
        level === "movie"
          ? PLAYBACK_DURATIONS.movie
          : PLAYBACK_DURATIONS.episode;

      playbackDuration = Math.floor(
        durationRange.min + random() * (durationRange.max - durationRange.min)
      );

      // Use ordered progress for TV episodes (realistic viewing order)
      if (orderedProgress && level === "episode") {
        const { episodeIndex, watchPoint, watchPointProgress } =
          orderedProgress;

        if (watchPoint < 0) {
          // Show is unwatched
          playbackPosition = null;
        } else if (episodeIndex < watchPoint) {
          // Episodes before current: fully watched (95-100%)
          playbackPosition = Math.floor(
            playbackDuration * (0.95 + random() * 0.05)
          );
        } else if (episodeIndex === watchPoint) {
          // Current episode: partial progress based on user's range
          playbackPosition = Math.floor(playbackDuration * watchPointProgress);
        } else {
          // Episodes after current: unwatched
          playbackPosition = null;
        }
      } else if (progressRange) {
        // Per-user progress range for movies: generate random progress within the range
        if (progressRange.min === 0 && progressRange.max === 0) {
          // Special case: 0-0 means unwatched
          playbackPosition = null;
        } else {
          // Generate progress within user's range
          const progressPercent =
            progressRange.min +
            random() * (progressRange.max - progressRange.min);
          playbackPosition = Math.floor(playbackDuration * progressPercent);
        }
      } else {
        // Default: simulate varying watch states using seeded random
        const watchState = random();
        if (watchState < 0.25) {
          // Unwatched (25%)
          playbackPosition = null;
        } else if (watchState < 0.5) {
          // Partially watched 30-50% (25%)
          playbackPosition = Math.floor(
            playbackDuration * (0.3 + random() * 0.2)
          );
        } else if (watchState < 0.75) {
          // Almost done 70-85%, below 90% threshold (25%)
          playbackPosition = Math.floor(
            playbackDuration * (0.7 + random() * 0.15)
          );
        } else {
          // Complete 91-100% (25%)
          playbackPosition = Math.floor(
            playbackDuration * (0.91 + random() * 0.09)
          );
        }
      }
    }

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
        playbackDuration,
        playbackPosition,
      },
    });
  }
}

/**
 * Validates environment before seeding.
 */
function validateEnvironment(): void {
  // Check ALLOW_SEEDING flag
  if (process.env.ALLOW_SEEDING !== "true") {
    console.error("❌ ALLOW_SEEDING must be set to 'true' to run seed script");
    console.error("   Example: ALLOW_SEEDING=true npx prisma db seed");
    process.exit(1);
  }

  // Check TMDB_API_KEY
  if (!process.env.TMDB_API_KEY) {
    console.error("❌ TMDB_API_KEY is required for seeding");
    console.error(
      "   Get a free key at: https://www.themoviedb.org/settings/api"
    );
    process.exit(1);
  }

  // Check ENCRYPTION_KEY (required for storing Drive tokens)
  if (!process.env.ENCRYPTION_KEY) {
    console.error("❌ ENCRYPTION_KEY is required for token encryption");
    console.error("   Generate with: openssl rand -base64 32");
    process.exit(1);
  }

  // Note: Google Drive credentials are validated by assertDriveConfigured()
  // which is called in main() before this function

  // Block production database - check against known production Neon endpoint
  const dbUrl = process.env.DATABASE_URL || "";
  const PRODUCTION_NEON_ENDPOINT = "ep-dry-poetry-ab4m7vi1";

  if (dbUrl.includes(PRODUCTION_NEON_ENDPOINT)) {
    console.error("❌ DATABASE_URL is the production database");
    console.error("   Seeding is only allowed on development/test databases");
    process.exit(1);
  }

  // Additional safety: require explicit dev/test/local pattern for extra confidence
  const safePatterns = [
    "development",
    "dev.",
    "-dev-",
    "_dev_",
    "devdb",
    "test",
    "staging",
    "local",
    "localhost",
    "127.0.0.1",
  ];

  const hasSafePattern = safePatterns.some((pattern) =>
    dbUrl.includes(pattern)
  );

  if (!hasSafePattern) {
    console.warn(
      "⚠️  DATABASE_URL does not contain a recognized dev/test pattern"
    );
    console.warn(
      "   Proceeding because ALLOW_SEEDING=true, but please verify this is not production"
    );
  }

  console.log("✅ Environment validated");
}

/**
 * Cleans up existing seed users.
 */
async function cleanupSeedUsers(): Promise<void> {
  const seedEmails = getEffectiveSeedUsers().map((u) => u.email);

  // Delete ItemFiles first
  await prisma.itemFile.deleteMany({
    where: {
      item: {
        user: {
          email: { in: seedEmails },
        },
      },
    },
  });

  // Delete Items
  await prisma.item.deleteMany({
    where: {
      user: {
        email: { in: seedEmails },
      },
    },
  });

  // Delete GoogleDriveConnections
  await prisma.googleDriveConnection.deleteMany({
    where: {
      user: {
        email: { in: seedEmails },
      },
    },
  });

  // Delete users
  const deleted = await prisma.user.deleteMany({
    where: {
      email: { in: seedEmails },
    },
  });

  if (deleted.count > 0) {
    console.log(`🗑️  Cleaned up ${deleted.count} existing seed user(s)`);
  }
}

/**
 * Cleans up specific seed users from database.
 * Deletes users and all related data (items, files, connections).
 *
 * @param emails - Array of user emails to clean up
 */
async function cleanupSpecificSeedUsers(emails: string[]): Promise<void> {
  if (emails.length === 0) return;

  const seedUserEmails = getEffectiveSeedUsers().map((u) => u.email);
  const toDelete = emails.filter((e) => seedUserEmails.includes(e));

  if (toDelete.length === 0) return;

  // Delete ItemFiles first
  await prisma.itemFile.deleteMany({
    where: {
      item: {
        user: {
          email: { in: toDelete },
        },
      },
    },
  });

  // Delete Items
  await prisma.item.deleteMany({
    where: {
      user: {
        email: { in: toDelete },
      },
    },
  });

  // Delete GoogleDriveConnections
  await prisma.googleDriveConnection.deleteMany({
    where: {
      user: {
        email: { in: toDelete },
      },
    },
  });

  // Delete users
  await prisma.user.deleteMany({
    where: { email: { in: toDelete } },
  });

  console.log(`🗑️  Cleaned up ${toDelete.length} seed user(s)`);
}

/**
 * Determines which users need to be seeded based on content hash comparison.
 * In incremental mode, only returns users whose config has changed.
 * Uses batch query (findMany) to avoid N+1 database calls.
 *
 * @returns Object with usersToSeed array and skippedUsers list
 */
async function getUsersToSeed(): Promise<{
  usersToSeed: SeedUserConfig[];
  skippedUsers: string[];
}> {
  const effectiveUsers = getEffectiveSeedUsers();

  if (!SEED_INCREMENTAL) {
    // Legacy mode: seed all users
    return { usersToSeed: effectiveUsers, skippedUsers: [] };
  }

  // Batch query: fetch all existing users in one DB call (avoids N+1)
  const emails = effectiveUsers.map((u) => u.email);
  const existingUsers = await prisma.user.findMany({
    where: { email: { in: emails } },
    select: { email: true, seedContentHash: true },
  });

  // Build lookup map for O(1) access
  const hashMap = new Map(
    existingUsers.map((u) => [u.email, u.seedContentHash])
  );

  const usersToSeed: SeedUserConfig[] = [];
  const skippedUsers: string[] = [];

  for (const userConfig of effectiveUsers) {
    const newHash = computeUserContentHash(userConfig.email);
    const existingHash = hashMap.get(userConfig.email);

    if (existingHash === newHash) {
      skippedUsers.push(userConfig.email);
    } else {
      usersToSeed.push(userConfig);
    }
  }

  return { usersToSeed, skippedUsers };
}

/**
 * Cleans up Google Drive content for a specific user.
 * Finds and deletes the user's content folder (by email prefix) in the root folder.
 * Gracefully handles errors to allow seed to continue with database-only cleanup.
 *
 * @param userEmail - Email of user whose content to clean
 */
async function cleanupGoogleDriveForUser(userEmail: string): Promise<void> {
  const refreshToken = process.env.GOOGLE_SEED_REFRESH_TOKEN;
  const rootFolderId = process.env.GOOGLE_SEED_ROOT_FOLDER_ID;
  const username = userEmail.split("@")[0];

  if (!refreshToken || !rootFolderId) {
    console.warn(
      `  ⚠️  Drive credentials not configured, skipping Drive cleanup for ${username}`
    );
    return;
  }

  try {
    const { batchDelete } = await import("@/lib/google-drive-client");

    // Find items that belong to this user
    const user = await prisma.user.findUnique({
      where: { email: userEmail },
      include: {
        items: {
          where: { driveFileId: { not: null } },
          select: { driveFileId: true },
        },
      },
    });

    if (!user) {
      console.log(`  ℹ️  No existing user ${username} to clean`);
      return;
    }

    const driveFileIds = user.items
      .map((item) => item.driveFileId)
      .filter((id): id is string => id !== null);

    if (driveFileIds.length === 0) {
      console.log(`  ℹ️  No Drive content for ${username}`);
      return;
    }

    console.log(
      `  🗑️  Cleaning ${driveFileIds.length} Drive items for ${username}`
    );

    const accessToken = await getAccessTokenFromRefreshToken(refreshToken);
    const result = await batchDelete(accessToken, driveFileIds);

    if (result.failed.length > 0) {
      console.warn(
        `  ⚠️  Failed to delete ${result.failed.length} items for ${username}`
      );
    }

    console.log(`  ✅ Cleaned ${result.succeeded.length} Drive items`);
  } catch (error) {
    // Graceful failure - log warning but continue with database cleanup
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`  ⚠️  Failed to cleanup Drive for ${username}: ${message}`);
    console.warn(`     Proceeding with database cleanup only`);
  }
}

/**
 * Creates seed users with profile images and public profile settings.
 * Uses Unsplash popular photos for heroes (different photo per user).
 */
async function createSeedUsers(): Promise<
  Array<{ id: string; email: string; config: SeedUserConfig }>
> {
  const password = process.env.SEED_PASSWORD || DEFAULT_SEED_PASSWORD;
  const passwordHash = await bcrypt.hash(password, 10);
  const seedUsers = getEffectiveSeedUsers();

  // Fetch popular Unsplash photos for hero images (each user gets different one)
  const unsplashPhotos = await fetchPopularUnsplashPhotos();

  const users: Array<{ id: string; email: string; config: SeedUserConfig }> =
    [];

  for (let i = 0; i < seedUsers.length; i++) {
    const userData = seedUsers[i];
    // Download profile images if seeds are provided
    let avatarData: ImageData | null = null;
    let heroData: ImageData | null = null;

    if (userData.avatarSeed) {
      const avatarUrl = buildPicsumUrl(
        userData.avatarSeed,
        AVATAR_SIZE.width,
        AVATAR_SIZE.height
      );
      log(`  📷 Downloading avatar for ${userData.email}...`);
      avatarData = await downloadProfileImage(avatarUrl);
    }

    // Try direct heroUrl first (takes precedence over Unsplash/Picsum)
    if (userData.heroUrl) {
      log(`  🖼️  Downloading custom hero for ${userData.email}...`);
      heroData = await downloadProfileImage(userData.heroUrl);
    }

    // Try Unsplash if no direct URL (each user gets a different popular photo)
    if (!heroData && unsplashPhotos.length > 0 && i < unsplashPhotos.length) {
      const photo = unsplashPhotos[i];
      log(
        `  🖼️  Downloading Unsplash hero for ${userData.email} (by ${photo.user.name})...`
      );
      heroData = await downloadUnsplashHero(
        photo,
        HERO_SIZE.width,
        HERO_SIZE.height
      );
    }

    // Fallback to Picsum if Unsplash failed or unavailable
    if (!heroData && userData.heroSeed) {
      const heroUrl = buildPicsumUrl(
        userData.heroSeed,
        HERO_SIZE.width,
        HERO_SIZE.height
      );
      log(`  🖼️  Downloading Picsum hero for ${userData.email}...`);
      heroData = await downloadProfileImage(heroUrl);
    }

    const user = await prisma.user.create({
      data: {
        email: userData.email,
        name: userData.name,
        username: userData.username,
        isPublic: userData.isPublic ?? false,
        // Store as Bytes with MIME type (schema requirement)
        image: avatarData?.data ?? null,
        imageMime: avatarData?.mime ?? null,
        heroImage: heroData?.data ?? null,
        heroImageMime: heroData?.mime ?? null,
        passwordHash,
      },
    });

    users.push({ id: user.id, email: user.email, config: userData });
    const publicLabel = userData.isPublic ? " (public)" : "";
    log(`👤 Created user: ${userData.email}${publicLabel}`);
  }

  return users;
}

/**
 * Creates seed users from a filtered list (for incremental seeding).
 * Only creates users in the provided list, with profile images.
 *
 * @param usersToCreate - Array of user configs to create
 * @returns Created user records with IDs
 */
async function createSeedUsersFiltered(
  usersToCreate: SeedUserConfig[]
): Promise<Array<{ id: string; email: string; config: SeedUserConfig }>> {
  const password = process.env.SEED_PASSWORD || DEFAULT_SEED_PASSWORD;
  const passwordHash = await bcrypt.hash(password, 10);

  // Fetch popular Unsplash photos for hero images (each user gets different one)
  const unsplashPhotos = await fetchPopularUnsplashPhotos();

  const users: Array<{ id: string; email: string; config: SeedUserConfig }> =
    [];

  for (let i = 0; i < usersToCreate.length; i++) {
    const userData = usersToCreate[i];
    // Download profile images if seeds are provided
    let avatarData: ImageData | null = null;
    let heroData: ImageData | null = null;

    if (userData.avatarSeed) {
      const avatarUrl = buildPicsumUrl(
        userData.avatarSeed,
        AVATAR_SIZE.width,
        AVATAR_SIZE.height
      );
      log(`  📷 Downloading avatar for ${userData.email}...`);
      avatarData = await downloadProfileImage(avatarUrl);
    }

    // Try direct heroUrl first (takes precedence over Unsplash/Picsum)
    if (userData.heroUrl) {
      log(`  🖼️  Downloading custom hero for ${userData.email}...`);
      heroData = await downloadProfileImage(userData.heroUrl);
    }

    // Try Unsplash if no direct URL (each user gets a different popular photo)
    if (!heroData && unsplashPhotos.length > 0 && i < unsplashPhotos.length) {
      const photo = unsplashPhotos[i];
      log(
        `  🖼️  Downloading Unsplash hero for ${userData.email} (by ${photo.user.name})...`
      );
      heroData = await downloadUnsplashHero(
        photo,
        HERO_SIZE.width,
        HERO_SIZE.height
      );
    }

    // Fallback to Picsum if Unsplash failed or unavailable
    if (!heroData && userData.heroSeed) {
      const heroUrl = buildPicsumUrl(
        userData.heroSeed,
        HERO_SIZE.width,
        HERO_SIZE.height
      );
      log(`  🖼️  Downloading Picsum hero for ${userData.email}...`);
      heroData = await downloadProfileImage(heroUrl);
    }

    const user = await prisma.user.create({
      data: {
        email: userData.email,
        name: userData.name,
        username: userData.username,
        isPublic: userData.isPublic ?? false,
        // Store as Bytes with MIME type (schema requirement)
        image: avatarData?.data ?? null,
        imageMime: avatarData?.mime ?? null,
        heroImage: heroData?.data ?? null,
        heroImageMime: heroData?.mime ?? null,
        passwordHash,
      },
    });

    users.push({ id: user.id, email: user.email, config: userData });
    const publicLabel = userData.isPublic ? " (public)" : "";
    log(`👤 Created user: ${userData.email}${publicLabel}`);
  }

  return users;
}

/**
 * Creates Google Drive connection for a user.
 */
async function createDriveConnection(userId: string): Promise<DriveContext> {
  const { encryptCredential } = await import("@/lib/crypto");

  const refreshToken = process.env.GOOGLE_SEED_REFRESH_TOKEN!;
  const rootFolderId = process.env.GOOGLE_SEED_ROOT_FOLDER_ID!;

  // Create connection with encrypted tokens
  const connection = await prisma.googleDriveConnection.create({
    data: {
      userId,
      name: "Seed Demo Drive",
      email: process.env.GOOGLE_SEED_EMAIL || "seed@canoncore.com",
      encryptedAccessToken: encryptCredential("pending-refresh"),
      encryptedRefreshToken: encryptCredential(refreshToken),
      accessTokenExpiry: new Date(0), // Force refresh on first use
      rootFolderId,
      isActive: true,
      needsReauth: false,
    },
  });

  console.log("🔗 Created Google Drive connection");

  const drive = await getDriveClient();

  return {
    drive,
    connectionId: connection.id,
    rootFolderId,
  };
}

/**
 * Creates a folder in Google Drive.
 */
async function createDriveFolder(
  ctx: DriveContext,
  name: string,
  parentId: string
): Promise<string> {
  const { createFolder } = await import("@/lib/google-drive-client");
  return createFolder(ctx.drive, name, parentId);
}

/** Parent folder info for grouped seed structure. */
interface ParentFolderInfo {
  itemId: string;
  driveFolderId: string | null;
}

/**
 * Creates parent folders (Movies, TV Shows) for grouped structure.
 * These folders are pinned to the sidebar for quick navigation.
 */
async function _createParentFolders(
  userId: string,
  ctx: DriveContext | null
): Promise<{
  movies: ParentFolderInfo | null;
  tvShows: ParentFolderInfo | null;
}> {
  const result: {
    movies: ParentFolderInfo | null;
    tvShows: ParentFolderInfo | null;
  } = {
    movies: null,
    tvShows: null,
  };

  const movieIds = getEffectiveMovieIds();
  const tvShowIds = getEffectiveTVShowIds();

  // Create Movies folder if we have movies to seed
  if (movieIds.length > 0) {
    let moviesDriveFolderId: string | null = null;
    if (ctx) {
      try {
        moviesDriveFolderId = await createDriveFolder(
          ctx,
          "Movies",
          ctx.rootFolderId
        );
      } catch (error) {
        console.error("❌ Failed to create Movies Drive folder:", error);
      }
    }

    const moviesItem = await prisma.item.create({
      data: {
        name: "Movies",
        description: "A collection of films from various genres and eras.",
        userId,
        parentId: null,
        order: 0,
        depth: 0,
        pinnedOrder: 0, // Pin Movies first
        inheritVisibility: false, // Root items cannot inherit
        driveConnectionId: ctx?.connectionId || null,
        driveFileId: moviesDriveFolderId,
        syncStatus: moviesDriveFolderId
          ? SyncStatus.SYNCED
          : SyncStatus.PENDING,
      },
    });

    result.movies = {
      itemId: moviesItem.id,
      driveFolderId: moviesDriveFolderId,
    };

    log("📁 Created Movies folder (pinned)");
  }

  // Create TV Shows folder if we have shows to seed
  if (tvShowIds.length > 0) {
    let tvShowsDriveFolderId: string | null = null;
    if (ctx) {
      try {
        tvShowsDriveFolderId = await createDriveFolder(
          ctx,
          "TV Shows",
          ctx.rootFolderId
        );
      } catch (error) {
        console.error("❌ Failed to create TV Shows Drive folder:", error);
      }
    }

    const tvShowsItem = await prisma.item.create({
      data: {
        name: "TV Shows",
        description:
          "A collection of television series spanning multiple genres.",
        userId,
        parentId: null,
        order: 1,
        depth: 0,
        pinnedOrder: 1, // Pin TV Shows second
        inheritVisibility: false, // Root items cannot inherit
        driveConnectionId: ctx?.connectionId || null,
        driveFileId: tvShowsDriveFolderId,
        syncStatus: tvShowsDriveFolderId
          ? SyncStatus.SYNCED
          : SyncStatus.PENDING,
      },
    });

    result.tvShows = {
      itemId: tvShowsItem.id,
      driveFolderId: tvShowsDriveFolderId,
    };

    log("📁 Created TV Shows folder (pinned)");
  }

  return result;
}

/**
 * Uploads a file to Google Drive.
 */
async function uploadToDrive(
  ctx: DriveContext,
  filename: string,
  content: Buffer,
  mimeType: string,
  parentId: string
): Promise<{ id: string; name: string }> {
  const { uploadFile } = await import("@/lib/google-drive-client");
  return uploadFile(ctx.drive, filename, content, mimeType, parentId);
}

/**
 * Checks if local Breaking Bad media files exist for seeding.
 *
 * @returns Object with video and subtitle availability
 */
function checkLocalMediaFiles(): { hasVideo: boolean; hasSubtitle: boolean } {
  const hasVideo = fs.existsSync(LOCAL_VIDEO_PATH);
  const hasSubtitle = fs.existsSync(LOCAL_SUBTITLE_PATH);

  console.log("🔍 Checking for local Breaking Bad S1E1 media files:");
  console.log(
    `   Video: ${hasVideo ? "✅ FOUND" : "❌ NOT FOUND"} at ${LOCAL_VIDEO_PATH}`
  );
  console.log(
    `   Subtitle: ${hasSubtitle ? "✅ FOUND" : "❌ NOT FOUND"} at ${LOCAL_SUBTITLE_PATH}`
  );

  return { hasVideo, hasSubtitle };
}

/**
 * Uploads local Breaking Bad S1E1 video to Google Drive.
 * Used for demo user to enable video player screenshots.
 *
 * @param ctx - Google Drive context
 * @param parentId - Parent folder ID in Drive
 * @returns Upload result with file ID, or null on failure
 */
async function uploadLocalVideo(
  ctx: DriveContext,
  parentId: string
): Promise<{ id: string; size: number } | null> {
  if (!fs.existsSync(LOCAL_VIDEO_PATH)) {
    return null;
  }

  try {
    log(
      "      📹 Uploading Breaking Bad S1E1 video (this may take a while)..."
    );
    const videoBuffer = fs.readFileSync(LOCAL_VIDEO_PATH);
    const filename = path.basename(LOCAL_VIDEO_PATH);

    const result = await uploadToDrive(
      ctx,
      filename,
      videoBuffer,
      "video/mp4",
      parentId
    );

    log(
      `      ✅ Video uploaded: ${filename} (${(videoBuffer.length / 1024 / 1024).toFixed(1)} MB)`
    );
    return { id: result.id, size: videoBuffer.length };
  } catch (error) {
    console.error("      ❌ Failed to upload video:", error);
    return null;
  }
}

/**
 * Uploads local Breaking Bad S1E1 subtitle to Google Drive.
 *
 * @param ctx - Google Drive context
 * @param parentId - Parent folder ID in Drive
 * @returns Upload result with file ID, or null on failure
 */
async function uploadLocalSubtitle(
  ctx: DriveContext,
  parentId: string
): Promise<{ id: string; size: number } | null> {
  if (!fs.existsSync(LOCAL_SUBTITLE_PATH)) {
    return null;
  }

  try {
    log("      📄 Uploading Breaking Bad S1E1 subtitle...");
    const subtitleBuffer = fs.readFileSync(LOCAL_SUBTITLE_PATH);
    const result = await uploadToDrive(
      ctx,
      "English.srt",
      subtitleBuffer,
      "application/x-subrip",
      parentId
    );

    log("      ✅ Subtitle uploaded: English.srt");
    return { id: result.id, size: subtitleBuffer.length };
  } catch (error) {
    console.error("      ❌ Failed to upload subtitle:", error);
    return null;
  }
}

/**
 * Seeds movies for a user with Drive integration.
 * When parentInfo is provided, creates items under the parent folder (grouped structure).
 * Otherwise creates items at root level (flat structure).
 * Creates Drive folders when ctx is provided (first user only).
 */
async function _seedMovies(
  userId: string,
  ctx: DriveContext | null,
  startOrder: number,
  progress: SeedProgress,
  parentInfo?: ParentFolderInfo | null
): Promise<number> {
  let count = 0;
  const movieIds = getEffectiveMovieIds();

  // Determine parent folder context
  const parentId = parentInfo?.itemId ?? null;
  const parentDriveFolderId = parentInfo?.driveFolderId ?? ctx?.rootFolderId;
  const baseDepth = parentInfo ? 1 : 0;

  for (let i = 0; i < movieIds.length; i++) {
    const movieId = movieIds[i];

    // Rate limiting
    await sleep(TMDB_API_DELAY_MS);

    const movie = await tmdbFetch<TMDBMovie>(`/movie/${movieId}`);

    if (!movie) {
      console.warn(`⚠️  Failed to fetch movie ${movieId}`);
      continue;
    }

    const year = extractYear(movie.release_date);
    const name = sanitizeFolderName(
      year ? `${movie.title} (${year})` : movie.title
    );
    const description = truncateOverview(movie.overview);

    // Create folder for this movie in Drive
    let movieDriveFolderId: string | null = null;
    if (ctx && parentDriveFolderId) {
      try {
        movieDriveFolderId = await createDriveFolder(
          ctx,
          name,
          parentDriveFolderId
        );
      } catch (error) {
        console.error(`❌ Failed to create Drive folder for ${name}:`, error);
        continue;
      }
    }

    // Create Item record (under parent if grouped, otherwise at root)
    const item = await prisma.item.create({
      data: {
        name,
        description: description || null,
        userId,
        parentId,
        order: startOrder + i,
        depth: baseDepth,
        inheritVisibility: false, // Movies are explicitly public/private
        driveConnectionId: ctx?.connectionId || null,
        driveFileId: movieDriveFolderId,
        syncStatus: movieDriveFolderId ? SyncStatus.SYNCED : SyncStatus.PENDING,
      },
    });

    // Attach files (artwork, subtitles, media placeholders)
    await attachRandomFiles(
      item.id,
      name,
      "movie",
      movie.poster_path,
      movie.backdrop_path,
      ctx,
      movieDriveFolderId
    );

    count++;
    progress.completedMovies++;
    logProgress(progress, name);
  }

  return count;
}

/**
 * Seeds movies for a user from a specific list of TMDB IDs.
 * Used for per-user content distribution.
 *
 * @param progressRange - Progress range for playback simulation (0-1)
 * @param isPublic - Whether items should be public (for public profiles)
 */
async function seedMoviesForUser(
  userId: string,
  ctx: DriveContext | null,
  startOrder: number,
  progress: SeedProgress,
  movieIds: number[],
  parentInfo?: ParentFolderInfo | null,
  progressRange?: ProgressRangeParam,
  isPublic = false
): Promise<number> {
  let count = 0;

  // Determine parent folder context
  const parentId = parentInfo?.itemId ?? null;
  const parentDriveFolderId = parentInfo?.driveFolderId ?? ctx?.rootFolderId;
  const baseDepth = parentInfo ? 1 : 0;

  for (let i = 0; i < movieIds.length; i++) {
    const movieId = movieIds[i];

    // Rate limiting
    await sleep(TMDB_API_DELAY_MS);

    const movie = await tmdbFetch<TMDBMovie>(`/movie/${movieId}`);

    if (!movie) {
      console.warn(`⚠️  Failed to fetch movie ${movieId}`);
      continue;
    }

    const year = extractYear(movie.release_date);
    const name = sanitizeFolderName(
      year ? `${movie.title} (${year})` : movie.title
    );
    const description = truncateOverview(movie.overview);

    // Create folder for this movie in Drive
    let movieDriveFolderId: string | null = null;
    if (ctx && parentDriveFolderId) {
      try {
        movieDriveFolderId = await createDriveFolder(
          ctx,
          name,
          parentDriveFolderId
        );
      } catch (error) {
        console.error(`❌ Failed to create Drive folder for ${name}:`, error);
        continue;
      }
    }

    // Create Item record (under parent if grouped, otherwise at root)
    const item = await prisma.item.create({
      data: {
        name,
        description: description || null,
        userId,
        parentId,
        order: startOrder + i,
        depth: baseDepth,
        isPublic,
        inheritVisibility: false, // Movies are explicitly public/private
        driveConnectionId: ctx?.connectionId || null,
        driveFileId: movieDriveFolderId,
        syncStatus: movieDriveFolderId ? SyncStatus.SYNCED : SyncStatus.PENDING,
      },
    });

    // Attach files (artwork, subtitles, media placeholders)
    await attachRandomFiles(
      item.id,
      name,
      "movie",
      movie.poster_path,
      movie.backdrop_path,
      ctx,
      movieDriveFolderId,
      progressRange
    );

    count++;
    progress.completedMovies++;
    logProgress(progress, name);
  }

  return count;
}

/**
 * Seeds all episodes for a season.
 * Creates Drive folders when ctx is provided (first user only).
 *
 * For Breaking Bad S1E1 with demo user, uploads actual video file if available locally.
 * This enables video player screenshots for portfolio.
 *
 * @param depthOffset - Offset to add to base depth (0 for flat, 1 for grouped structure)
 * @param progressRange - Progress range for playback simulation (0-1)
 * @param isPublic - Whether items should be public (for public profiles)
 * @param showTmdbId - TMDB ID of the parent show (for Breaking Bad detection)
 * @param seasonNumber - Season number (for S1 detection)
 * @param userEmail - User email (for demo user detection)
 * @param episodeStartIndex - Starting index for ordered progress tracking
 * @param orderedProgressBase - Base context for ordered progress (totalEpisodes, watchPoint)
 * @returns Object with count of items created and next episode index
 */
async function seedEpisodes(
  episodes: TMDBEpisode[],
  seasonItemId: string,
  seasonDriveFolderId: string | null,
  userId: string,
  ctx: DriveContext | null,
  depthOffset = 0,
  progressRange?: ProgressRangeParam,
  isPublic = false,
  showTmdbId?: number,
  seasonNumber?: number,
  userEmail?: string,
  episodeStartIndex = 0,
  orderedProgressBase?: {
    totalEpisodes: number;
    watchPoint: number;
    watchPointProgress: number;
  }
): Promise<{ count: number; nextIndex: number }> {
  let count = 0;
  let currentEpisodeIndex = episodeStartIndex;

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

    // Build ordered progress context for this episode
    const orderedProgress: OrderedProgressContext | undefined =
      orderedProgressBase
        ? {
            episodeIndex: currentEpisodeIndex,
            totalEpisodes: orderedProgressBase.totalEpisodes,
            watchPoint: orderedProgressBase.watchPoint,
            watchPointProgress: orderedProgressBase.watchPointProgress,
          }
        : undefined;

    // Create Drive folder for episode
    let episodeDriveFolderId: string | null = null;
    if (ctx && seasonDriveFolderId) {
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
    }

    // Create episode Item
    // Use array index for order (not episode_number which can have gaps)
    // Episode depth: 2 in flat structure, 3 in grouped structure
    const episodeItem = await prisma.item.create({
      data: {
        name: episodeName,
        description: truncateOverview(episode.overview || ""),
        userId,
        parentId: seasonItemId,
        order: i, // Array index, not episode_number
        depth: 2 + depthOffset,
        isPublic,
        inheritVisibility: true, // Episodes inherit from season
        driveConnectionId: ctx?.connectionId || null,
        driveFileId: episodeDriveFolderId,
        syncStatus: episodeDriveFolderId
          ? SyncStatus.SYNCED
          : SyncStatus.PENDING,
      },
    });

    // Check if this is Breaking Bad S1E1 for demo user - upload real video if available
    const isBreakingBadS1E1 =
      showTmdbId === BREAKING_BAD_TMDB_ID &&
      seasonNumber === 1 &&
      episode.episode_number === 1 &&
      userEmail === DEMO_USER_EMAIL;

    if (isBreakingBadS1E1) {
      console.log(`\n🎯 Breaking Bad S1E1 detected for demo user!`);
      console.log(
        `   Show TMDB ID: ${showTmdbId} (expected: ${BREAKING_BAD_TMDB_ID})`
      );
      console.log(
        `   Season: ${seasonNumber}, Episode: ${episode.episode_number}`
      );
      console.log(`   User: ${userEmail} (expected: ${DEMO_USER_EMAIL})`);
      console.log(`   Drive context: ${ctx ? "✅ Available" : "❌ Missing"}`);
      console.log(
        `   Episode folder ID: ${episodeDriveFolderId || "❌ Missing"}\n`
      );
    }

    if (isBreakingBadS1E1 && ctx && episodeDriveFolderId) {
      const localMedia = checkLocalMediaFiles();

      if (localMedia.hasVideo || localMedia.hasSubtitle) {
        log(
          "    🎬 Breaking Bad S1E1 detected - uploading real media files..."
        );

        // Upload artwork first (still image as hero banner)
        if (!SEED_SKIP_ARTWORK && episode.still_path) {
          const stillBuffer = await downloadPoster(episode.still_path);
          if (stillBuffer) {
            try {
              const uploaded = await uploadToDrive(
                ctx,
                "still.jpg",
                stillBuffer,
                "image/jpeg",
                episodeDriveFolderId
              );
              await prisma.itemFile.create({
                data: {
                  itemId: episodeItem.id,
                  filename: "still.jpg",
                  driveFileId: uploaded.id,
                  fileType: FileType.ARTWORK,
                  mimeType: "image/jpeg",
                  size: BigInt(stillBuffer.length),
                  isPrimary: false,
                  isHero: true,
                  syncStatus: SyncStatus.SYNCED,
                },
              });
            } catch {
              // Continue even if upload fails
            }
          }
        }

        // Upload real subtitle if available
        if (localMedia.hasSubtitle) {
          const subtitleResult = await uploadLocalSubtitle(
            ctx,
            episodeDriveFolderId
          );
          if (subtitleResult) {
            await prisma.itemFile.create({
              data: {
                itemId: episodeItem.id,
                filename: "English.srt",
                driveFileId: subtitleResult.id,
                fileType: FileType.SUBTITLE,
                mimeType: "application/x-subrip",
                size: BigInt(subtitleResult.size),
                isPrimary: true,
                isHero: false,
                syncStatus: SyncStatus.SYNCED,
              },
            });
            log(`      ✅ Subtitle file attached to episode`);
          }
        }

        // Upload real video if available
        if (localMedia.hasVideo) {
          const videoResult = await uploadLocalVideo(ctx, episodeDriveFolderId);
          if (videoResult) {
            // Get video duration (approximate - 58 minutes for pilot)
            const playbackDuration = 58 * 60; // 58 minutes in seconds
            const playbackPosition = Math.floor(playbackDuration * 0.99); // 99% watched

            await prisma.itemFile.create({
              data: {
                itemId: episodeItem.id,
                filename: path.basename(LOCAL_VIDEO_PATH),
                driveFileId: videoResult.id,
                fileType: FileType.MEDIA,
                mimeType: "video/mp4",
                size: BigInt(videoResult.size),
                isPrimary: true,
                isHero: false,
                syncStatus: SyncStatus.SYNCED,
                playbackDuration,
                playbackPosition,
              },
            });
            log(
              `      ✅ Video file attached to episode (duration: ${Math.floor(playbackDuration / 60)}min, position: ${Math.floor((playbackPosition / playbackDuration) * 100)}%)`
            );
          }
        }
      } else {
        // No local files, fall back to placeholders
        await attachRandomFiles(
          episodeItem.id,
          episodeName,
          "episode",
          episode.still_path || null,
          null,
          ctx,
          episodeDriveFolderId,
          progressRange,
          orderedProgress
        );
      }
    } else {
      // Regular episode - use placeholder files
      await attachRandomFiles(
        episodeItem.id,
        episodeName,
        "episode",
        episode.still_path || null,
        null, // No backdrop for episodes
        ctx,
        episodeDriveFolderId,
        progressRange,
        orderedProgress
      );
    }

    count++;
    currentEpisodeIndex++;
  }

  return { count, nextIndex: currentEpisodeIndex };
}

/**
 * Seeds all seasons for a TV show.
 * Creates Drive folders when ctx is provided (first user only).
 *
 * Note: Season 0 (specials) is intentionally skipped.
 * TMDB stores specials in Season 0, but they're often incomplete
 * and not part of the main series progression.
 *
 * @param depthOffset - Offset to add to base depth (0 for flat, 1 for grouped structure)
 * @param seasonOrderOffset - Offset for season order (used when combining Classic/Modern Doctor Who)
 * @param progressRange - Progress range for playback simulation (0-1)
 * @param isPublic - Whether items should be public (for public profiles)
 * @param userEmail - User email (passed to seedEpisodes for demo user detection)
 * @param episodeStartIndex - Starting episode index for ordered progress (default 0)
 * @returns Object with total items created and next episode index
 */
async function seedSeasons(
  tvId: number,
  showItemId: string,
  showDriveFolderId: string | null,
  showName: string,
  numberOfSeasons: number,
  userId: string,
  ctx: DriveContext | null,
  depthOffset = 0,
  seasonOrderOffset = 0,
  progressRange?: ProgressRangeParam,
  isPublic = false,
  userEmail?: string,
  episodeStartIndex = 0
): Promise<{ totalItems: number; nextIndex: number }> {
  let totalItems = 0;
  let currentEpisodeIndex = episodeStartIndex;

  // Apply season limit (0 = unlimited)
  const maxSeasons =
    MAX_SEASONS === 0
      ? numberOfSeasons
      : Math.min(numberOfSeasons, MAX_SEASONS);

  // PHASE 1: Fetch all season metadata to get actual episode counts from TMDB
  log(`    ⏳ Fetching ${maxSeasons} seasons from TMDB...`);
  const seasonDetails: TMDBSeasonDetail[] = [];
  let actualTotalEpisodes = 0;

  for (let seasonNum = 1; seasonNum <= maxSeasons; seasonNum++) {
    await sleep(TMDB_API_DELAY_MS);
    const season = await tmdbFetch<TMDBSeasonDetail>(
      `/tv/${tvId}/season/${seasonNum}`
    );

    if (season && season.episodes && season.episodes.length > 0) {
      // Apply episode limit per season
      const episodeCount =
        MAX_EPISODES === 0
          ? season.episodes.length
          : Math.min(season.episodes.length, MAX_EPISODES);
      actualTotalEpisodes += episodeCount;
      seasonDetails.push(season);
    }
  }

  // Calculate watch point for ordered progress using actual TMDB data
  let orderedProgressBase:
    | { totalEpisodes: number; watchPoint: number; watchPointProgress: number }
    | undefined;
  if (progressRange && SEED_SIMULATE_PLAYBACK && actualTotalEpisodes > 0) {
    const { watchPoint, watchPointProgress } = calculateWatchPoint(
      actualTotalEpisodes,
      progressRange
    );
    orderedProgressBase = {
      totalEpisodes: actualTotalEpisodes,
      watchPoint,
      watchPointProgress,
    };
    log(
      `    📊 Progress: ${actualTotalEpisodes} episodes, watch point at episode ${watchPoint + 1}`
    );
  }

  // PHASE 2: Seed each season with the pre-fetched data
  for (let i = 0; i < seasonDetails.length; i++) {
    const season = seasonDetails[i];
    const seasonNum = season.season_number;
    const seasonName = sanitizeFolderName(season.name || `Season ${seasonNum}`);

    // Fetch season-specific backdrop
    await sleep(TMDB_API_DELAY_MS);
    const seasonBackdrop = await fetchSeasonBackdrop(tvId, seasonNum);

    // Create Drive folder for season
    let seasonDriveFolderId: string | null = null;
    if (ctx && showDriveFolderId) {
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
    }

    // Create season Item
    // Season depth: 1 in flat structure, 2 in grouped structure
    const seasonItem = await prisma.item.create({
      data: {
        name: seasonName,
        description: truncateOverview(season.overview || ""),
        userId,
        parentId: showItemId,
        order: seasonOrderOffset + seasonNum - 1, // 0-indexed order with optional offset
        depth: 1 + depthOffset,
        isPublic,
        inheritVisibility: true, // Seasons inherit from show
        driveConnectionId: ctx?.connectionId || null,
        driveFileId: seasonDriveFolderId,
        syncStatus: seasonDriveFolderId
          ? SyncStatus.SYNCED
          : SyncStatus.PENDING,
      },
    });

    // Attach files (artwork, subtitles - no media for seasons)
    await attachRandomFiles(
      seasonItem.id,
      seasonName,
      "season",
      season.poster_path,
      seasonBackdrop, // Use season-specific backdrop
      ctx,
      seasonDriveFolderId,
      progressRange
    );

    // Seed episodes with ordered progress tracking
    const episodeResult = await seedEpisodes(
      season.episodes,
      seasonItem.id,
      seasonDriveFolderId,
      userId,
      ctx,
      depthOffset,
      progressRange,
      isPublic,
      tvId,
      seasonNum,
      userEmail,
      currentEpisodeIndex,
      orderedProgressBase
    );

    totalItems += 1 + episodeResult.count;
    currentEpisodeIndex = episodeResult.nextIndex;
    log(`    📁 ${seasonName} (${episodeResult.count} episodes)`);
  }

  return { totalItems, nextIndex: currentEpisodeIndex };
}

/**
 * Seeds TV shows for a user from a specific list of TMDB IDs.
 * Used for per-user content distribution.
 *
 * Special handling for Doctor Who:
 * - Classic Doctor Who (ID 121) and Modern Doctor Who (ID 57243) are consolidated
 * - Creates single "Doctor Who" folder with seasons from both eras
 *
 * @param progressRange - Progress range for playback simulation (0-1)
 * @param isPublic - Whether items should be public (for public profiles)
 * @param userEmail - User email (for demo user detection in Breaking Bad S1E1)
 */
async function seedTVShowsForUser(
  userId: string,
  ctx: DriveContext | null,
  startOrder: number,
  progress: SeedProgress,
  tvShowIds: number[],
  parentInfo?: ParentFolderInfo | null,
  progressRange?: ProgressRangeParam,
  isPublic = false,
  userEmail?: string
): Promise<number> {
  let count = 0;

  // Determine parent folder context
  const parentId = parentInfo?.itemId ?? null;
  const parentDriveFolderId = parentInfo?.driveFolderId ?? ctx?.rootFolderId;
  const baseDepth = parentInfo ? 1 : 0;
  const depthOffset = parentInfo ? 1 : 0;

  // Track which Doctor Who has been processed (for consolidation)
  for (let i = 0; i < tvShowIds.length; i++) {
    const showId = tvShowIds[i];

    // Rate limiting
    await sleep(TMDB_API_DELAY_MS);

    const show = await tmdbFetch<TMDBTVShow>(`/tv/${showId}`);

    if (!show) {
      console.warn(`⚠️  Failed to fetch TV show ${showId}`);
      continue;
    }

    const year = extractYear(show.first_air_date);
    const name = sanitizeFolderName(
      year ? `${show.name} (${year})` : show.name
    );
    const description = truncateOverview(show.overview);

    // Create folder for this show in Drive
    let showDriveFolderId: string | null = null;
    if (ctx && parentDriveFolderId) {
      try {
        showDriveFolderId = await createDriveFolder(
          ctx,
          name,
          parentDriveFolderId
        );
      } catch (error) {
        console.error(`❌ Failed to create Drive folder for ${name}:`, error);
        continue;
      }
    }

    // Create Item record
    const item = await prisma.item.create({
      data: {
        name,
        description: description || null,
        userId,
        parentId,
        order: startOrder + i,
        depth: baseDepth,
        isPublic,
        inheritVisibility: false, // TV shows are explicitly public/private
        driveConnectionId: ctx?.connectionId || null,
        driveFileId: showDriveFolderId,
        syncStatus: showDriveFolderId ? SyncStatus.SYNCED : SyncStatus.PENDING,
      },
    });

    // Attach files (artwork, subtitles - no media for shows)
    await attachRandomFiles(
      item.id,
      name,
      "show",
      show.poster_path,
      show.backdrop_path,
      ctx,
      showDriveFolderId,
      progressRange
    );

    // Seed seasons and episodes
    const result = await seedSeasons(
      showId,
      item.id,
      showDriveFolderId,
      name,
      show.number_of_seasons,
      userId,
      ctx,
      depthOffset,
      0,
      progressRange,
      isPublic,
      userEmail
    );

    count += 1 + result.totalItems;
    progress.completedShows++;
    logProgress(progress, name);
  }

  return count;
}

/**
 * Cleans up partially seeded data on failure.
 * Removes orphaned database records for the demo user.
 * Note: Drive folders are NOT deleted automatically and may need manual cleanup.
 */
async function cleanupOnFailure(userId: string): Promise<void> {
  console.log("\n🧹 Cleaning up partial seed data...");

  try {
    // Delete ItemFiles first (foreign key constraint)
    const deletedFiles = await prisma.itemFile.deleteMany({
      where: { item: { userId } },
    });
    if (deletedFiles.count > 0) {
      console.log(`  🗑️  Deleted ${deletedFiles.count} item file(s)`);
    }

    // Delete Items
    const deletedItems = await prisma.item.deleteMany({
      where: { userId },
    });
    if (deletedItems.count > 0) {
      console.log(`  🗑️  Deleted ${deletedItems.count} item(s)`);
    }

    // Delete GoogleDriveConnection
    const deletedConnections = await prisma.googleDriveConnection.deleteMany({
      where: { userId },
    });
    if (deletedConnections.count > 0) {
      console.log(
        `  🗑️  Deleted ${deletedConnections.count} Drive connection(s)`
      );
    }

    console.log(
      "⚠️  Database cleaned. Re-run seed to clean Drive and try again."
    );
  } catch (cleanupError) {
    console.error("❌ Cleanup failed:", cleanupError);
  }
}

/**
 * Pins specific items for a user based on USER_PINNED_ITEMS config.
 * Only used in flat structure mode. Fetches TMDB titles to match items by name.
 *
 * @param userId - User's database ID
 * @param email - User's email for config lookup
 */
async function pinItemsForUser(userId: string, email: string): Promise<void> {
  const pinnedTmdbIds = USER_PINNED_ITEMS[email] || [];
  if (pinnedTmdbIds.length === 0) return;

  const pinnedItems: { name: string; order: number }[] = [];

  for (let i = 0; i < pinnedTmdbIds.length; i++) {
    const tmdbId = pinnedTmdbIds[i];

    // Try movie first, then TV show
    let title: string | null = null;
    let year: string | null = null;

    // Check if it's a movie
    const movie = await tmdbFetch<TMDBMovie>(`/movie/${tmdbId}`);
    if (movie) {
      title = movie.title;
      year = extractYear(movie.release_date);
    } else {
      // Try TV show
      const show = await tmdbFetch<TMDBTVShow>(`/tv/${tmdbId}`);
      if (show) {
        title = show.name;
        year = extractYear(show.first_air_date);
      }
    }

    if (title) {
      const name = year ? `${title} (${year})` : title;
      pinnedItems.push({ name, order: i });
    }

    await sleep(TMDB_API_DELAY_MS);
  }

  // Update pinnedOrder for matching items
  for (const { name, order } of pinnedItems) {
    await prisma.item.updateMany({
      where: {
        userId,
        name,
        parentId: null, // Only root-level items
      },
      data: {
        pinnedOrder: order,
      },
    });
  }

  if (pinnedItems.length > 0) {
    log(`   📌 Pinned ${pinnedItems.length} items to sidebar`);
  }
}

/**
 * Generates realistic sync activity log entries for a user.
 * Creates a variety of sync actions to populate the Activity tab.
 *
 * @param userId - User ID to create sync logs for
 */
async function generateSyncActivityLogs(userId: string): Promise<void> {
  // Get some items for the user to reference in logs
  const items = await prisma.item.findMany({
    where: { userId },
    take: 20,
    include: { files: { take: 1 } },
  });

  if (items.length === 0) return;

  const syncLogs: Array<{
    userId: string;
    action: SyncLogAction;
    itemId?: string;
    itemName?: string;
    fileId?: string;
    fileName?: string;
    status: SyncLogStatus;
    duration?: number;
    createdAt: Date;
  }> = [];

  const now = new Date();

  // Generate varied sync activity over the past 7 days
  const actions: Array<{
    action: SyncLogAction;
    weight: number;
    hasFile: boolean;
  }> = [
    { action: SyncLogAction.SYNC, weight: 30, hasFile: false },
    { action: SyncLogAction.UPLOAD, weight: 25, hasFile: true },
    { action: SyncLogAction.CREATE, weight: 20, hasFile: false },
    { action: SyncLogAction.DOWNLOAD, weight: 10, hasFile: true },
    { action: SyncLogAction.RENAME, weight: 8, hasFile: false },
    { action: SyncLogAction.MOVE, weight: 5, hasFile: false },
    { action: SyncLogAction.DELETE, weight: 2, hasFile: false },
  ];

  // Create 25-40 log entries spread over the past week
  const logCount = 25 + Math.floor(Math.random() * 16);

  for (let i = 0; i < logCount; i++) {
    // Pick a random item
    const item = items[Math.floor(Math.random() * items.length)];

    // Pick a weighted random action
    const totalWeight = actions.reduce((sum, a) => sum + a.weight, 0);
    let randomWeight = Math.random() * totalWeight;
    let selectedAction = actions[0];
    for (const action of actions) {
      randomWeight -= action.weight;
      if (randomWeight <= 0) {
        selectedAction = action;
        break;
      }
    }

    // Random time in past 7 days (more recent entries more likely)
    const hoursAgo = Math.pow(Math.random(), 2) * 168; // 0-168 hours (7 days)
    const createdAt = new Date(now.getTime() - hoursAgo * 60 * 60 * 1000);

    // Most entries are successful, occasional failures
    const status =
      Math.random() > 0.05 ? SyncLogStatus.SUCCESS : SyncLogStatus.FAILED;

    // Duration varies by action type (ms)
    const baseDuration =
      selectedAction.action === SyncLogAction.UPLOAD
        ? 2000
        : selectedAction.action === SyncLogAction.DOWNLOAD
          ? 1500
          : selectedAction.action === SyncLogAction.SYNC
            ? 500
            : 200;
    const duration = Math.round(baseDuration * (0.5 + Math.random()));

    const file = selectedAction.hasFile ? item.files[0] : null;

    syncLogs.push({
      userId,
      action: selectedAction.action,
      itemId: item.id,
      itemName: item.name,
      fileId: file?.id,
      fileName: file?.filename,
      status,
      duration,
      createdAt,
      ...(status === SyncLogStatus.FAILED && {
        error: "Network timeout - will retry",
      }),
    });
  }

  // Batch insert all logs
  await prisma.syncLog.createMany({
    data: syncLogs,
  });

  log(`   📊 Created ${syncLogs.length} sync activity log entries`);
}

/**
 * Main seed function.
 * Google Drive is REQUIRED - validates setup before proceeding.
 * Creates items in flat structure at root level with selective pinning.
 */
async function main(): Promise<void> {
  // Validate configuration before seeding
  validateContentDistribution();

  log(
    `\n🌱 Starting database seed with Google Drive integration (flat structure)...\n`
  );

  // Pre-flight check: Drive is REQUIRED for seeding
  // This will throw with clear instructions if not configured
  await assertDriveConfigured("seed");

  // Validate environment (ALLOW_SEEDING, TMDB_API_KEY, etc.)
  validateEnvironment();

  // Dynamic import of prisma after env vars are loaded
  const prismaModule = await import("@/lib/prisma");
  prisma = prismaModule.prisma;

  let users: Array<{ id: string; email: string; config: SeedUserConfig }>;

  if (SEED_INCREMENTAL) {
    console.log("📊 Incremental mode: checking for changes...\n");

    const { usersToSeed, skippedUsers } = await getUsersToSeed();

    if (skippedUsers.length > 0) {
      console.log(
        `⏭️  Skipping ${skippedUsers.length} unchanged user(s): ${skippedUsers.join(", ")}`
      );
    }

    if (usersToSeed.length === 0) {
      console.log("\n✅ All users up to date. Nothing to seed.\n");
      return;
    }

    console.log(
      `🔄 Seeding ${usersToSeed.length} user(s): ${usersToSeed.map((u) => u.email).join(", ")}\n`
    );

    // Clean affected users in parallel (Drive + DB cleanup per user)
    console.log("🧹 Cleaning up affected users...\n");
    await Promise.all(
      usersToSeed.map(async (userConfig) => {
        await cleanupGoogleDriveForUser(userConfig.email);
        await cleanupSpecificSeedUsers([userConfig.email]);
      })
    );

    // Create seed users (only the ones we're reseeding)
    users = await createSeedUsersFiltered(usersToSeed);
  } else {
    // Legacy clean-slate mode
    console.log("🧹 Clean slate mode: wiping all content...\n");
    await cleanupAllGoogleDrive();
    await cleanupSeedUsers();

    // Create all seed users
    users = await createSeedUsers();
  }

  // Seed content for all users with their configured distribution
  for (let userIndex = 0; userIndex < users.length; userIndex++) {
    const { id: userId, email, config } = users[userIndex];
    const isFirstUser = userIndex === 0;

    // Get per-user content distribution
    const userMovieIds = getEffectiveMovieIdsForUser(email);
    const userShowIds = getEffectiveTVShowIdsForUser(email);

    // Skip users with no content
    if (userMovieIds.length === 0 && userShowIds.length === 0) {
      log(`\n⏭️  Skipping ${email} (no content configured)`);
      continue;
    }

    log(`\n📚 Seeding content for ${email}...`);

    try {
      // Create Drive connection for all users (shared seed Drive account)
      const ctx = await createDriveConnection(userId);

      // Initialize progress tracking with user-specific IDs
      const progress: SeedProgress = {
        startTime: Date.now(),
        totalShows: userShowIds.length,
        completedShows: 0,
        totalMovies: userMovieIds.length,
        completedMovies: 0,
      };

      // Get per-user progress range for playback simulation
      const progressRange = USER_PROGRESS_RANGES[email];

      // Flat structure: Seed directly at root level
      const movieCount = await seedMoviesForUser(
        userId,
        ctx,
        0,
        progress,
        userMovieIds,
        undefined,
        progressRange,
        config.isPublic ?? false
      );
      const tvCount = await seedTVShowsForUser(
        userId,
        ctx,
        movieCount,
        progress,
        userShowIds,
        undefined,
        progressRange,
        config.isPublic ?? false,
        config.email
      );

      // Pin specific items for flat structure
      await pinItemsForUser(userId, config.email);

      const totalTime = Math.round((Date.now() - progress.startTime) / 1000);
      log(
        `\n✅ Seeded ${movieCount} movies and ${tvCount} TV show items in ${totalTime}s`
      );

      if (isFirstUser) {
        log(`   📁 Content synced to Google Drive`);

        // Run auto-sync to catch any pre-existing files, set changePageToken, and fetch quota
        try {
          const { syncByUserId } = await import("@/lib/google-drive-sync");
          const syncResult = await syncByUserId(userId, { fetchQuota: true });
          if (syncResult.success) {
            const created = syncResult.itemsCreated ?? 0;
            const updated = syncResult.itemsUpdated ?? 0;
            if (created > 0 || updated > 0) {
              log(
                `   🔄 Auto-sync complete: ${created} created, ${updated} updated`
              );
            } else {
              log(`   🔄 Auto-sync complete: no additional changes`);
            }
          } else {
            console.warn(
              `   ⚠️ Auto-sync warning: ${syncResult.error} (items created locally)`
            );
          }
        } catch (syncError) {
          console.warn(
            "   ⚠️ Auto-sync failed (items created locally):",
            syncError instanceof Error ? syncError.message : syncError
          );
          // Don't fail seed - user can sync manually later
        }

        // Generate sync activity logs for demo user to populate Activity tab
        await generateSyncActivityLogs(userId);
      }

      // Save content hash for incremental seeding
      const contentHash = computeUserContentHash(email);
      await prisma.user.update({
        where: { id: userId },
        data: { seedContentHash: contentHash },
      });
      log(`   🔐 Content hash saved for incremental seeding`);
    } catch (error) {
      console.error(`\n❌ Seed failed for ${email}:`, error);
      await cleanupOnFailure(userId);
      throw error;
    }
  }

  log("\n🎉 Seeding complete!\n");
  log("Login credentials (all users have same password):");
  for (const user of users) {
    const publicLabel = user.config.isPublic ? " (public)" : "";
    log(`  • ${user.email}${publicLabel}`);
  }
  log(`  Password: ${process.env.SEED_PASSWORD || DEFAULT_SEED_PASSWORD}\n`);
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    if (prisma) {
      await prisma.$disconnect();
    }
  });
