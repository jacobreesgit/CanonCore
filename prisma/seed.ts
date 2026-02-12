/**
 * Database seed script for populating demo content with Google Drive integration.
 * Fetches TMDB metadata and stores poster/backdrop paths directly on items.
 *
 * IMPORTANT: Google Drive is REQUIRED for seeding. Run setup first:
 *   pnpm run setup:seed
 *
 * Usage:
 *   pnpm run seed                          # Seeds development (default)
 *   SEED_TARGET=production pnpm run seed   # Seeds production
 *   SEED_TARGET=e2e pnpm run seed          # Seeds e2e
 *   pnpm run seed:production               # Convenience script
 *   pnpm run seed:e2e                      # Convenience script
 *
 * Flow:
 *   1. Resolve SEED_TARGET to pick correct DATABASE_URL and Drive root folder
 *   2. Validate environment (required vars, production DB check, Drive setup)
 *   3. Clean ALL Google Drive content in the target root folder
 *   4. Cleanup ALL seed users from database
 *   5. Create all seed users with content
 *
 * Branching Strategy:
 *   Same Google Drive account with separate root folders per Neon branch.
 *   SEED_TARGET selects which DATABASE_URL and root folder to use:
 *     - development: DATABASE_URL + GOOGLE_SEED_ROOT_FOLDER_ID (defaults)
 *     - production:  SEED_PRODUCTION_DATABASE_URL + SEED_PRODUCTION_ROOT_FOLDER_ID
 *     - e2e:         E2E_DATABASE_URL + SEED_E2E_ROOT_FOLDER_ID
 *
 * Required Environment Variables:
 *   - ALLOW_SEEDING: Must be "true" to run (prevents accidental seeding)
 *   - TMDB_API_KEY: Required for fetching metadata (v3 API key)
 *   - DATABASE_URL: Database connection string (development, or overridden by SEED_TARGET)
 *   - GOOGLE_SEED_REFRESH_TOKEN: Refresh token for Drive integration (shared across targets)
 *   - GOOGLE_SEED_ROOT_FOLDER_ID: Root folder for Drive storage (development)
 *   - GOOGLE_CLIENT_ID: OAuth client ID
 *   - GOOGLE_CLIENT_SECRET: OAuth client secret
 *   - ENCRYPTION_KEY: For encrypting Drive tokens
 *
 * Optional (for non-development targets):
 *   - SEED_TARGET: "development" | "production" | "e2e" (default: "development")
 *   - SEED_PRODUCTION_DATABASE_URL: Production Neon connection string
 *   - SEED_PRODUCTION_ROOT_FOLDER_ID: Production Drive root folder
 *   - SEED_E2E_ROOT_FOLDER_ID: E2E Drive root folder
 */

// Load environment variables before any other imports
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

/** Valid seed target branches. */
type SeedTarget = "development" | "production" | "e2e";

const VALID_SEED_TARGETS: SeedTarget[] = ["development", "production", "e2e"];

/**
 * Resolves SEED_TARGET to the correct DATABASE_URL and Drive root folder ID.
 * Overrides process.env so downstream code (Prisma, Drive client) uses the right values.
 *
 * @returns The resolved seed target name
 */
function resolveSeedTarget(): SeedTarget {
  const target = (process.env.SEED_TARGET || "development") as SeedTarget;

  if (!VALID_SEED_TARGETS.includes(target)) {
    console.error(`❌ Invalid SEED_TARGET: "${target}"`);
    console.error(`   Valid targets: ${VALID_SEED_TARGETS.join(", ")}`);
    process.exit(1);
  }

  switch (target) {
    case "development":
      // Uses existing DATABASE_URL and GOOGLE_SEED_ROOT_FOLDER_ID (no override needed)
      break;

    case "production": {
      const prodDbUrl = process.env.SEED_PRODUCTION_DATABASE_URL;
      const prodRootFolder = process.env.SEED_PRODUCTION_ROOT_FOLDER_ID;

      if (!prodDbUrl) {
        console.error(
          "❌ SEED_PRODUCTION_DATABASE_URL is required when SEED_TARGET=production"
        );
        process.exit(1);
      }
      if (!prodRootFolder) {
        console.error(
          "❌ SEED_PRODUCTION_ROOT_FOLDER_ID is required when SEED_TARGET=production"
        );
        process.exit(1);
      }

      process.env.DATABASE_URL = prodDbUrl;
      process.env.GOOGLE_SEED_ROOT_FOLDER_ID = prodRootFolder;
      break;
    }

    case "e2e": {
      const e2eDbUrl = process.env.E2E_DATABASE_URL;
      const e2eRootFolder = process.env.SEED_E2E_ROOT_FOLDER_ID;

      if (!e2eDbUrl) {
        console.error("❌ E2E_DATABASE_URL is required when SEED_TARGET=e2e");
        process.exit(1);
      }
      if (!e2eRootFolder) {
        console.error(
          "❌ SEED_E2E_ROOT_FOLDER_ID is required when SEED_TARGET=e2e"
        );
        process.exit(1);
      }

      process.env.DATABASE_URL = e2eDbUrl;
      process.env.GOOGLE_SEED_ROOT_FOLDER_ID = e2eRootFolder;
      break;
    }
  }

  return target;
}

// Resolve target before any other imports that read env vars
const seedTarget = resolveSeedTarget();

import { FileType, SyncStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import {
  DEFAULT_SEED_PASSWORD,
  MAX_SEASONS,
  MAX_EPISODES,
  TMDB_API_DELAY_MS,
  PLAYBACK_DURATIONS,
  SEED_USERS,
  USER_PROGRESS_RANGES,
  USER_PINNED_ITEMS,
  AVATAR_SIZE,
  HERO_SIZE,
  buildPicsumUrl,
  validateContentDistribution,
  getMovieIdsForUser,
  getTVShowIdsForUser,
  DEMO_USER_EMAIL,
  type SeedUserConfig,
} from "./seed-config";
import { assertDriveConfigured } from "@/lib/drive-verification";
import { withAuditContext } from "@/lib/audit-context";

// Prisma will be dynamically imported after env vars are loaded
import type { ExtendedPrismaClient } from "@/lib/prisma";
import { SyncLogAction, SyncLogStatus } from "@prisma/client";
let prisma: ExtendedPrismaClient;

// TMDB API configuration
const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_TIMEOUT_MS = 10000;

// Local media files for Breaking Bad S1E1 (optional - for video player screenshots)
const BREAKING_BAD_TMDB_ID = 1396;
const LOCAL_VIDEO_PATH = path.resolve(__dirname, "../video.mp4");
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
 * Gets random count in range [min, max].
 */
function getRandomCount(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Available subtitle languages for random selection. */
const SUBTITLE_LANGUAGES = ["english", "spanish", "french", "german"];

/**
 * Logs message.
 */
function log(message: string): void {
  console.log(message);
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
async function cleanupGoogleDrive(): Promise<void> {
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
  console.log("✅ Trash empty request sent");
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
 * - Subtitles: Generated placeholder SRT files
 * - Media: Placeholder entries with null driveFileId (episodes/movies only)
 *
 * Note: Poster and backdrop images are stored as TMDB paths directly on the item
 * (tmdbPosterPath, tmdbBackdropPath) rather than downloaded and uploaded to Drive.
 *
 * @param progressRange - Optional progress range for playback simulation (0-1).
 *                        If provided, uses range to determine completion percentage.
 * @param orderedProgress - Optional context for ordered TV show progress simulation.
 *                          When provided, uses realistic watch order logic.
 */
async function attachRandomFiles(
  itemId: string,
  itemName: string,
  level: ItemLevel,
  ctx: DriveContext | null,
  driveFolderId: string | null,
  progressRange?: ProgressRangeParam,
  orderedProgress?: OrderedProgressContext
): Promise<void> {
  const subtitleCount = getRandomCount(1, 2);
  const mediaCount =
    level === "episode" || level === "movie" ? getRandomCount(1, 2) : 0;

  // --- SUBTITLES (skip if no Drive) ---
  if (ctx && driveFolderId) {
    // Shuffle for variety
    const shuffledLanguages = [...SUBTITLE_LANGUAGES].sort(
      () => Math.random() - 0.5
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

    const durationRange =
      level === "movie" ? PLAYBACK_DURATIONS.movie : PLAYBACK_DURATIONS.episode;

    playbackDuration = Math.floor(
      durationRange.min +
        Math.random() * (durationRange.max - durationRange.min)
    );

    // Use ordered progress for TV episodes (realistic viewing order)
    if (orderedProgress && level === "episode") {
      const { episodeIndex, watchPoint, watchPointProgress } = orderedProgress;

      if (watchPoint < 0) {
        // Show is unwatched
        playbackPosition = null;
      } else if (episodeIndex < watchPoint) {
        // Episodes before current: fully watched (95-100%)
        playbackPosition = Math.floor(
          playbackDuration * (0.95 + Math.random() * 0.05)
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
          Math.random() * (progressRange.max - progressRange.min);
        playbackPosition = Math.floor(playbackDuration * progressPercent);
      }
    } else {
      // Default: simulate varying watch states
      const watchState = Math.random();
      if (watchState < 0.25) {
        // Unwatched (25%)
        playbackPosition = null;
      } else if (watchState < 0.5) {
        // Partially watched 30-50% (25%)
        playbackPosition = Math.floor(
          playbackDuration * (0.3 + Math.random() * 0.2)
        );
      } else if (watchState < 0.75) {
        // Almost done 70-85%, below 90% threshold (25%)
        playbackPosition = Math.floor(
          playbackDuration * (0.7 + Math.random() * 0.15)
        );
      } else {
        // Complete 91-100% (25%)
        playbackPosition = Math.floor(
          playbackDuration * (0.91 + Math.random() * 0.09)
        );
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

  // Block production database UNLESS explicitly targeting production via SEED_TARGET
  const dbUrl = process.env.DATABASE_URL || "";
  const PRODUCTION_NEON_ENDPOINT = "ep-dry-poetry-ab4m7vi1";

  if (dbUrl.includes(PRODUCTION_NEON_ENDPOINT) && seedTarget !== "production") {
    console.error("❌ DATABASE_URL is the production database");
    console.error(
      "   Use SEED_TARGET=production to explicitly seed production"
    );
    process.exit(1);
  }

  if (seedTarget === "production") {
    console.warn("⚠️  SEED_TARGET=production — seeding PRODUCTION database");
    console.warn("   This will wipe all seed users and Drive content!");
  }

  // Additional safety for non-explicit targets: require dev/test/local pattern
  if (seedTarget === "development") {
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
  }

  console.log(`✅ Environment validated (target: ${seedTarget})`);
}

/**
 * Cleans up existing seed users from database.
 */
async function cleanupSeedUsers(): Promise<void> {
  const seedEmails = SEED_USERS.map((u) => u.email);

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
 * Creates seed users with profile images and public profile settings.
 * Uses Unsplash popular photos for heroes (different photo per user).
 */
async function createSeedUsers(): Promise<
  Array<{ id: string; email: string; config: SeedUserConfig }>
> {
  const password = process.env.SEED_PASSWORD || DEFAULT_SEED_PASSWORD;
  const passwordHash = await bcrypt.hash(password, 10);

  // Fetch popular Unsplash photos for hero images (each user gets different one)
  const unsplashPhotos = await fetchPopularUnsplashPhotos();

  const users: Array<{ id: string; email: string; config: SeedUserConfig }> =
    [];

  for (let i = 0; i < SEED_USERS.length; i++) {
    const userData = SEED_USERS[i];
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
 * Seeds movies for a user from a specific list of TMDB IDs.
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
  progressRange?: ProgressRangeParam,
  isPublic = false
): Promise<number> {
  let count = 0;

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
    if (ctx) {
      try {
        movieDriveFolderId = await createDriveFolder(
          ctx,
          name,
          ctx.rootFolderId
        );
      } catch (error) {
        console.error(`❌ Failed to create Drive folder for ${name}:`, error);
        continue;
      }
    }

    // Create Item record at root level
    const item = await prisma.item.create({
      data: {
        name,
        description: description || null,
        userId,
        parentId: null,
        order: startOrder + i,
        depth: 0,
        isPublic,
        inheritVisibility: false,
        tmdbId: movieId,
        tmdbType: "movie",
        tmdbPosterPath: movie.poster_path,
        tmdbBackdropPath: movie.backdrop_path,
        driveConnectionId: ctx?.connectionId || null,
        driveFileId: movieDriveFolderId,
        syncStatus: movieDriveFolderId ? SyncStatus.SYNCED : SyncStatus.PENDING,
      },
    });

    // Attach files (subtitles, media placeholders)
    await attachRandomFiles(
      item.id,
      name,
      "movie",
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
 *
 * For Breaking Bad S1E1 with demo user, uploads actual video file if available locally.
 * This enables video player screenshots for portfolio.
 *
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

  // Apply episode limit
  const limitedEpisodes = episodes.slice(0, MAX_EPISODES);

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
        continue;
      }
    }

    // Create episode Item (depth 2: show > season > episode)
    const episodeItem = await prisma.item.create({
      data: {
        name: episodeName,
        description: truncateOverview(episode.overview || ""),
        userId,
        parentId: seasonItemId,
        order: i,
        depth: 2,
        isPublic,
        inheritVisibility: true, // Episodes inherit from season
        tmdbId: episode.id,
        tmdbType: "episode",
        tmdbPosterPath: episode.still_path ?? null,
        tmdbBackdropPath: episode.still_path ?? null,
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
 *
 * Note: Season 0 (specials) is intentionally skipped.
 * TMDB stores specials in Season 0, but they're often incomplete
 * and not part of the main series progression.
 *
 * @param progressRange - Progress range for playback simulation (0-1)
 * @param isPublic - Whether items should be public (for public profiles)
 * @param userEmail - User email (passed to seedEpisodes for demo user detection)
 * @returns Object with total items created and next episode index
 */
async function seedSeasons(
  tvId: number,
  showItemId: string,
  showDriveFolderId: string | null,
  numberOfSeasons: number,
  userId: string,
  ctx: DriveContext | null,
  progressRange?: ProgressRangeParam,
  isPublic = false,
  userEmail?: string
): Promise<{ totalItems: number; nextIndex: number }> {
  let totalItems = 0;
  let currentEpisodeIndex = 0;

  // Apply season limit
  const maxSeasons = Math.min(numberOfSeasons, MAX_SEASONS);

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
      const episodeCount = Math.min(season.episodes.length, MAX_EPISODES);
      actualTotalEpisodes += episodeCount;
      seasonDetails.push(season);
    }
  }

  // Calculate watch point for ordered progress using actual TMDB data
  let orderedProgressBase:
    | { totalEpisodes: number; watchPoint: number; watchPointProgress: number }
    | undefined;
  if (progressRange && actualTotalEpisodes > 0) {
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
        continue;
      }
    }

    // Create season Item (depth 1: show > season)
    const seasonItem = await prisma.item.create({
      data: {
        name: seasonName,
        description: truncateOverview(season.overview || ""),
        userId,
        parentId: showItemId,
        order: seasonNum - 1, // 0-indexed order
        depth: 1,
        isPublic,
        inheritVisibility: true, // Seasons inherit from show
        tmdbId: season.id,
        tmdbType: "season",
        tmdbPosterPath: season.poster_path,
        tmdbBackdropPath: season.poster_path,
        driveConnectionId: ctx?.connectionId || null,
        driveFileId: seasonDriveFolderId,
        syncStatus: seasonDriveFolderId
          ? SyncStatus.SYNCED
          : SyncStatus.PENDING,
      },
    });

    // Attach files (subtitles only - season artwork skipped for performance)
    await attachRandomFiles(
      seasonItem.id,
      seasonName,
      "season",
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
  progressRange?: ProgressRangeParam,
  isPublic = false,
  userEmail?: string
): Promise<number> {
  let count = 0;

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
    if (ctx) {
      try {
        showDriveFolderId = await createDriveFolder(
          ctx,
          name,
          ctx.rootFolderId
        );
      } catch (error) {
        console.error(`❌ Failed to create Drive folder for ${name}:`, error);
        continue;
      }
    }

    // Create Item record (depth 0: root level)
    const item = await prisma.item.create({
      data: {
        name,
        description: description || null,
        userId,
        parentId: null,
        order: startOrder + i,
        depth: 0,
        isPublic,
        inheritVisibility: false,
        tmdbId: showId,
        tmdbType: "tv",
        tmdbPosterPath: show.poster_path,
        tmdbBackdropPath: show.backdrop_path,
        driveConnectionId: ctx?.connectionId || null,
        driveFileId: showDriveFolderId,
        syncStatus: showDriveFolderId ? SyncStatus.SYNCED : SyncStatus.PENDING,
      },
    });

    // Attach files (subtitles - no media for shows)
    await attachRandomFiles(
      item.id,
      name,
      "show",
      ctx,
      showDriveFolderId,
      progressRange
    );

    // Seed seasons and episodes
    const result = await seedSeasons(
      showId,
      item.id,
      showDriveFolderId,
      show.number_of_seasons,
      userId,
      ctx,
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
 * Removes orphaned database records for the user.
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
 * Fetches TMDB titles to match items by name.
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
 * Always does a full wipe of Drive and database before seeding.
 */
async function main(): Promise<void> {
  // Validate configuration before seeding
  validateContentDistribution();

  log(
    `\n🌱 Starting database seed (target: ${seedTarget}) with Google Drive integration...\n`
  );

  // Pre-flight check: Drive is REQUIRED for seeding
  // This will throw with clear instructions if not configured
  await assertDriveConfigured("seed");

  // Validate environment (ALLOW_SEEDING, TMDB_API_KEY, etc.)
  validateEnvironment();

  // Dynamic import of prisma after env vars are loaded
  const prismaModule = await import("@/lib/prisma");
  prisma = prismaModule.prisma;

  // Wrap all database operations with audit context for tracking
  await withAuditContext({ source: "seed" }, async () => {
    // Full wipe: Clean Google Drive and database
    console.log("🧹 Wiping all content...\n");
    await cleanupGoogleDrive();
    await cleanupSeedUsers();

    // Create all seed users
    const users = await createSeedUsers();

    // Seed content for all users with their configured distribution
    for (let userIndex = 0; userIndex < users.length; userIndex++) {
      const { id: userId, email, config } = users[userIndex];
      const isFirstUser = userIndex === 0;

      // Get per-user content distribution
      const userMovieIds = getMovieIdsForUser(email);
      const userShowIds = getTVShowIdsForUser(email);

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

        // Seed movies and TV shows at root level
        const movieCount = await seedMoviesForUser(
          userId,
          ctx,
          0,
          progress,
          userMovieIds,
          progressRange,
          config.isPublic ?? false
        );
        const tvCount = await seedTVShowsForUser(
          userId,
          ctx,
          movieCount,
          progress,
          userShowIds,
          progressRange,
          config.isPublic ?? false,
          config.email
        );

        // Pin specific items
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
  });
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
