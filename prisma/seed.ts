/**
 * Database seed script for populating demo content with Google Drive integration.
 * Fetches TMDB metadata, downloads posters, and uploads to Google Drive.
 *
 * IMPORTANT: Google Drive is REQUIRED for seeding. Run setup first:
 *   pnpm run setup:seed
 *
 * The script guarantees a clean slate by automatically cleaning all Google Drive content
 * and emptying trash before seeding. The Google Drive account is dedicated to seeding,
 * so all content can be safely deleted.
 *
 * Flow:
 *   1. Validate environment (required vars, production DB check, Drive setup)
 *   2. Clean Google Drive (delete all files/folders, empty trash, verify)
 *   3. Cleanup seed users from database
 *   4. Create seed users
 *   5. Create Drive connection
 *   6. Seed content (movies, TV shows with TMDB metadata)
 *
 * Usage:
 *   ALLOW_SEEDING=true npx prisma db seed
 *   ALLOW_SEEDING=true SEED_ONLY_MOVIES=true SEED_MOVIE_COUNT=3 npx prisma db seed
 *   ALLOW_SEEDING=true SEED_GROUPED_STRUCTURE=false npx prisma db seed  # Flat structure
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
 *   - SEED_GROUPED_STRUCTURE: Create Movies/TV Shows parent folders (default: true)
 *   - SEED_SIMULATE_PLAYBACK: Generate playback progress data (default: true)
 *
 * Grouped Structure (default):
 *   When SEED_GROUPED_STRUCTURE=true (default), creates pinned parent folders:
 *   - Movies/ (pinnedOrder: 0) contains all movie items
 *   - TV Shows/ (pinnedOrder: 1) contains all TV show items
 *
 * Doctor Who Consolidation:
 *   Classic Doctor Who (1963-1989) and Modern Doctor Who (2005+) are consolidated
 *   into a single "Doctor Who" folder with seasons from both eras.
 */

// Load environment variables before any other imports
import dotenv from "dotenv";
import path from "path";
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
  SEED_GROUPED_STRUCTURE,
  SEED_SIMULATE_PLAYBACK,
  PLAYBACK_DURATIONS,
  getEffectiveMovieIds,
  getEffectiveTVShowIds,
  getEffectiveSeedUsers,
  getEffectiveMovieIdsForUser,
  getEffectiveTVShowIdsForUser,
  isDoctorWho,
  isClassicDoctorWho,
  MODERN_DOCTOR_WHO_ID,
  USER_PROGRESS_RANGES,
  AVATAR_SIZE,
  HERO_SIZE,
  buildPicsumUrl,
  type SeedUserConfig,
} from "./seed-config";
import { assertDriveConfigured } from "@/lib/drive-verification";

// Prisma will be dynamically imported after env vars are loaded
import type { PrismaClient } from "@prisma/client";
let prisma: PrismaClient;

// TMDB API configuration
const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";
const TMDB_TIMEOUT_MS = 10000;

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
 * Downloads a poster image from TMDB.
 */
async function downloadPoster(
  posterPath: string | null
): Promise<Buffer | null> {
  if (!posterPath) return null;

  const url = `${TMDB_IMAGE_BASE}/w500${posterPath}`;
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

  // 4. Verify trash is empty (poll with timeout)
  await verifyTrashEmpty(drive);
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
async function verifyTrashEmpty(drive: drive_v3.Drive): Promise<void> {
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
 * Downloads a backdrop image from TMDB.
 * Uses w1280 size for high-quality hero images.
 */
async function downloadBackdrop(
  backdropPath: string | null
): Promise<Buffer | null> {
  if (!backdropPath) return null;

  const url = `${TMDB_IMAGE_BASE}/w1280${backdropPath}`;
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

/** Downloaded image data with MIME type. */
interface ImageData {
  data: Uint8Array<ArrayBuffer>;
  mime: string;
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
 */
async function attachRandomFiles(
  itemId: string,
  itemName: string,
  level: ItemLevel,
  primaryImagePath: string | null,
  backdropPath: string | null,
  ctx: DriveContext | null,
  driveFolderId: string | null,
  progressRange?: ProgressRangeParam
): Promise<void> {
  const subtitleCount = getRandomCount(1, 2);
  const mediaCount =
    level === "episode" || level === "movie" ? getRandomCount(1, 2) : 0;

  // --- PRIMARY ARTWORK (poster) ---
  if (!SEED_SKIP_ARTWORK && primaryImagePath && ctx && driveFolderId) {
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

  // --- HERO IMAGE (backdrop) - movies and shows only ---
  if (
    !SEED_SKIP_ARTWORK &&
    backdropPath &&
    (level === "movie" || level === "show") &&
    ctx &&
    driveFolderId
  ) {
    const backdropBuffer = await downloadBackdrop(backdropPath);
    if (backdropBuffer) {
      try {
        const uploaded = await uploadToDrive(
          ctx,
          "backdrop.jpg",
          backdropBuffer,
          "image/jpeg",
          driveFolderId
        );

        await prisma.itemFile.create({
          data: {
            itemId,
            filename: "backdrop.jpg",
            driveFileId: uploaded.id,
            fileType: FileType.ARTWORK,
            mimeType: "image/jpeg",
            size: BigInt(backdropBuffer.length),
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

      // Use progress range if provided, otherwise use default 4-bucket distribution
      if (progressRange) {
        // Per-user progress range: generate random progress within the range
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
 * Creates seed users with profile images and public profile settings.
 */
async function createSeedUsers(): Promise<
  Array<{ id: string; email: string; config: SeedUserConfig }>
> {
  const password = process.env.SEED_PASSWORD || DEFAULT_SEED_PASSWORD;
  const passwordHash = await bcrypt.hash(password, 10);
  const seedUsers = getEffectiveSeedUsers();

  const users: Array<{ id: string; email: string; config: SeedUserConfig }> =
    [];

  for (const userData of seedUsers) {
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

    if (userData.heroSeed) {
      const heroUrl = buildPicsumUrl(
        userData.heroSeed,
        HERO_SIZE.width,
        HERO_SIZE.height
      );
      log(`  🖼️  Downloading hero for ${userData.email}...`);
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
 * Creates parent folders (Movies, TV Shows) based on user's content distribution.
 * Only creates folders for content types the user has.
 * Parent folders are always private (organizational) - individual movies/shows are public.
 */
async function createParentFoldersForUser(
  userId: string,
  ctx: DriveContext | null,
  movieIds: number[],
  showIds: number[]
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

  // Create Movies folder if user has movies
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
        pinnedOrder: 0,
        isPublic: false, // Parent folders are always private (organizational)
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

  // Create TV Shows folder if user has shows
  if (showIds.length > 0) {
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
        pinnedOrder: 1,
        isPublic: false, // Parent folders are always private (organizational)
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
 * @param depthOffset - Offset to add to base depth (0 for flat, 1 for grouped structure)
 * @param progressRange - Progress range for playback simulation (0-1)
 * @param isPublic - Whether items should be public (for public profiles)
 */
async function seedEpisodes(
  episodes: TMDBEpisode[],
  seasonItemId: string,
  seasonDriveFolderId: string | null,
  userId: string,
  ctx: DriveContext | null,
  depthOffset = 0,
  progressRange?: ProgressRangeParam,
  isPublic = false
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

    // Attach files (artwork from still, subtitles, media placeholders)
    await attachRandomFiles(
      episodeItem.id,
      episodeName,
      "episode",
      episode.still_path || null,
      null, // No backdrop for episodes
      ctx,
      episodeDriveFolderId,
      progressRange
    );

    count++;
  }

  return count;
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
  isPublic = false
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
    log(`    ⏳ Fetching season ${seasonNum}/${maxSeasons}...`);

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
      null, // No backdrop for seasons
      ctx,
      seasonDriveFolderId,
      progressRange
    );

    // Seed episodes
    const episodeCount = await seedEpisodes(
      season.episodes,
      seasonItem.id,
      seasonDriveFolderId,
      userId,
      ctx,
      depthOffset,
      progressRange,
      isPublic
    );

    totalItems += 1 + episodeCount;
    log(`    📁 ${seasonName} (${episodeCount} episodes)`);
  }

  return totalItems;
}

/**
 * Seeds TV shows for a user with Drive integration.
 * Creates hierarchical structure: Show → Seasons → Episodes.
 * When parentInfo is provided, creates items under the parent folder (grouped structure).
 * Creates Drive folders when ctx is provided (first user only).
 *
 * Special handling for Doctor Who:
 * - Classic Doctor Who (ID 121) and Modern Doctor Who (ID 57243) are consolidated
 * - Creates single "Doctor Who" folder with seasons from both eras
 * - Classic seasons appear first, Modern seasons follow with offset
 */
async function _seedTVShows(
  userId: string,
  ctx: DriveContext | null,
  startOrder: number,
  progress: SeedProgress,
  parentInfo?: ParentFolderInfo | null
): Promise<number> {
  let count = 0;
  const tvShowIds = getEffectiveTVShowIds();

  // Determine parent folder context
  const parentId = parentInfo?.itemId ?? null;
  const parentDriveFolderId = parentInfo?.driveFolderId ?? ctx?.rootFolderId;
  const baseDepth = parentInfo ? 1 : 0;
  const depthOffset = parentInfo ? 1 : 0;

  // Track which Doctor Who has been processed (for consolidation)
  let doctorWhoProcessed = false;
  let orderOffset = 0; // Adjust order when Doctor Who eras are consolidated

  for (let i = 0; i < tvShowIds.length; i++) {
    const showId = tvShowIds[i];

    // Special handling: Skip Modern Doctor Who if Classic was already processed
    // (they're consolidated into a single "Doctor Who" folder)
    if (isDoctorWho(showId) && doctorWhoProcessed) {
      orderOffset--; // Compensate for skipped show
      continue;
    }

    // Rate limiting
    await sleep(TMDB_API_DELAY_MS);

    const show = await tmdbFetch<TMDBTVShow>(`/tv/${showId}`);

    if (!show) {
      console.warn(`⚠️  Failed to fetch TV show ${showId}`);
      continue;
    }

    // Special handling for Doctor Who: Use unified name and description
    let name: string;
    let description: string;
    if (isDoctorWho(showId)) {
      name = "Doctor Who";
      description = truncateOverview(
        "The adventures of the Doctor, a Time Lord who travels through time and space " +
          "in the TARDIS with various companions, battling evil and righting wrongs. " +
          "Spanning from 1963 to the present day."
      );
    } else {
      const year = extractYear(show.first_air_date);
      name = sanitizeFolderName(year ? `${show.name} (${year})` : show.name);
      description = truncateOverview(show.overview);
    }

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

    // Create Item record (under parent if grouped, otherwise at root)
    const item = await prisma.item.create({
      data: {
        name,
        description: description || null,
        userId,
        parentId,
        order: startOrder + i + orderOffset,
        depth: baseDepth,
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
      showDriveFolderId
    );

    // Seed seasons and episodes
    let seasonItemCount: number;

    if (isClassicDoctorWho(showId)) {
      // Doctor Who: Seed Classic era seasons first
      seasonItemCount = await seedSeasons(
        showId,
        item.id,
        showDriveFolderId,
        name,
        show.number_of_seasons,
        userId,
        ctx,
        depthOffset,
        0 // Start at order 0
      );

      // Then seed Modern era seasons with offset
      // Fetch Modern Doctor Who metadata
      await sleep(TMDB_API_DELAY_MS);
      const modernShow = await tmdbFetch<TMDBTVShow>(
        `/tv/${MODERN_DOCTOR_WHO_ID}`
      );

      if (modernShow) {
        // Apply same MAX_SEASONS limit to get the actual classic season count
        const classicSeasonCount =
          MAX_SEASONS === 0
            ? show.number_of_seasons
            : Math.min(show.number_of_seasons, MAX_SEASONS);

        const modernSeasonCount = await seedSeasons(
          MODERN_DOCTOR_WHO_ID,
          item.id,
          showDriveFolderId,
          name,
          modernShow.number_of_seasons,
          userId,
          ctx,
          depthOffset,
          classicSeasonCount // Offset Modern seasons after Classic
        );
        seasonItemCount += modernSeasonCount;
        log(`  🎬 Doctor Who (Modern era): ${modernSeasonCount} items`);
      }

      doctorWhoProcessed = true;
    } else {
      // Normal show: seed seasons normally
      seasonItemCount = await seedSeasons(
        showId,
        item.id,
        showDriveFolderId,
        name,
        show.number_of_seasons,
        userId,
        ctx,
        depthOffset
      );
    }

    count += 1 + seasonItemCount;
    progress.completedShows++;
    logProgress(progress, name);
  }

  return count;
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
 */
async function seedTVShowsForUser(
  userId: string,
  ctx: DriveContext | null,
  startOrder: number,
  progress: SeedProgress,
  tvShowIds: number[],
  parentInfo?: ParentFolderInfo | null,
  progressRange?: ProgressRangeParam,
  isPublic = false
): Promise<number> {
  let count = 0;

  // Determine parent folder context
  const parentId = parentInfo?.itemId ?? null;
  const parentDriveFolderId = parentInfo?.driveFolderId ?? ctx?.rootFolderId;
  const baseDepth = parentInfo ? 1 : 0;
  const depthOffset = parentInfo ? 1 : 0;

  // Track which Doctor Who has been processed (for consolidation)
  let doctorWhoProcessed = false;
  let orderOffset = 0;

  for (let i = 0; i < tvShowIds.length; i++) {
    const showId = tvShowIds[i];

    // Special handling: Skip Modern Doctor Who if Classic was already processed
    if (isDoctorWho(showId) && doctorWhoProcessed) {
      orderOffset--;
      continue;
    }

    // Rate limiting
    await sleep(TMDB_API_DELAY_MS);

    const show = await tmdbFetch<TMDBTVShow>(`/tv/${showId}`);

    if (!show) {
      console.warn(`⚠️  Failed to fetch TV show ${showId}`);
      continue;
    }

    // Special handling for Doctor Who: Use unified name and description
    let name: string;
    let description: string;
    if (isDoctorWho(showId)) {
      name = "Doctor Who";
      description = truncateOverview(
        "The adventures of the Doctor, a Time Lord who travels through time and space " +
          "in the TARDIS with various companions, battling evil and righting wrongs. " +
          "Spanning from 1963 to the present day."
      );
    } else {
      const year = extractYear(show.first_air_date);
      name = sanitizeFolderName(year ? `${show.name} (${year})` : show.name);
      description = truncateOverview(show.overview);
    }

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
        order: startOrder + i + orderOffset,
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
    let seasonItemCount: number;

    if (isClassicDoctorWho(showId)) {
      // Doctor Who: Seed Classic era seasons first
      seasonItemCount = await seedSeasons(
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
        isPublic
      );

      // Check if Modern Doctor Who is also in the user's list
      if (tvShowIds.includes(MODERN_DOCTOR_WHO_ID)) {
        await sleep(TMDB_API_DELAY_MS);
        const modernShow = await tmdbFetch<TMDBTVShow>(
          `/tv/${MODERN_DOCTOR_WHO_ID}`
        );

        if (modernShow) {
          const classicSeasonCount =
            MAX_SEASONS === 0
              ? show.number_of_seasons
              : Math.min(show.number_of_seasons, MAX_SEASONS);

          const modernSeasonCount = await seedSeasons(
            MODERN_DOCTOR_WHO_ID,
            item.id,
            showDriveFolderId,
            name,
            modernShow.number_of_seasons,
            userId,
            ctx,
            depthOffset,
            classicSeasonCount,
            progressRange,
            isPublic
          );
          seasonItemCount += modernSeasonCount;
          log(`  🎬 Doctor Who (Modern era): ${modernSeasonCount} items`);
        }
      }

      doctorWhoProcessed = true;
    } else {
      // Normal show: seed seasons normally
      seasonItemCount = await seedSeasons(
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
        isPublic
      );
    }

    count += 1 + seasonItemCount;
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
 * Main seed function.
 * Google Drive is REQUIRED - validates setup before proceeding.
 * Respects SEED_GROUPED_STRUCTURE to create Movies/TV Shows parent folders.
 */
async function main(): Promise<void> {
  const structureLabel = SEED_GROUPED_STRUCTURE ? "grouped" : "flat";
  log(
    `\n🌱 Starting database seed with Google Drive integration (${structureLabel} structure)...\n`
  );

  // Pre-flight check: Drive is REQUIRED for seeding
  // This will throw with clear instructions if not configured
  await assertDriveConfigured("seed");

  // Validate environment (ALLOW_SEEDING, TMDB_API_KEY, etc.)
  validateEnvironment();

  // Dynamic import of prisma after env vars are loaded
  const prismaModule = await import("@/lib/prisma");
  prisma = prismaModule.prisma;

  // Clean Google Drive first (guaranteed clean slate)
  // Note: If this succeeds but DB cleanup fails, re-running seed will fix it
  console.log("\n🧹 Cleaning Google Drive...\n");
  await cleanupGoogleDrive();

  // Cleanup existing seed users from database
  await cleanupSeedUsers();

  // Create seed users
  const users = await createSeedUsers();

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
      // Create Drive connection only for first user (demo user)
      let ctx: DriveContext | null = null;
      if (isFirstUser) {
        ctx = await createDriveConnection(userId);
      }

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

      let movieCount: number;
      let tvCount: number;

      if (SEED_GROUPED_STRUCTURE) {
        // Grouped structure: Create Movies and TV Shows parent folders with pinning
        log("📁 Creating grouped folder structure...\n");
        const parentFolders = await createParentFoldersForUser(
          userId,
          ctx,
          userMovieIds,
          userShowIds
        );

        // Seed movies under Movies folder
        movieCount = await seedMoviesForUser(
          userId,
          ctx,
          0,
          progress,
          userMovieIds,
          parentFolders.movies,
          progressRange,
          config.isPublic ?? false
        );

        // Seed TV shows under TV Shows folder
        tvCount = await seedTVShowsForUser(
          userId,
          ctx,
          0,
          progress,
          userShowIds,
          parentFolders.tvShows,
          progressRange,
          config.isPublic ?? false
        );

        // Add parent folder count to totals
        const parentFolderCount =
          (parentFolders.movies ? 1 : 0) + (parentFolders.tvShows ? 1 : 0);
        if (parentFolderCount > 0) {
          log(
            `\n📌 Created ${parentFolderCount} pinned parent folder(s): ${[
              parentFolders.movies && "Movies",
              parentFolders.tvShows && "TV Shows",
            ]
              .filter(Boolean)
              .join(", ")}`
          );
        }
      } else {
        // Flat structure: Seed directly at root level
        movieCount = await seedMoviesForUser(
          userId,
          ctx,
          0,
          progress,
          userMovieIds,
          undefined,
          progressRange,
          config.isPublic ?? false
        );
        tvCount = await seedTVShowsForUser(
          userId,
          ctx,
          movieCount,
          progress,
          userShowIds,
          undefined,
          progressRange,
          config.isPublic ?? false
        );
      }

      const totalTime = Math.round((Date.now() - progress.startTime) / 1000);
      log(
        `\n✅ Seeded ${movieCount} movies and ${tvCount} TV show items in ${totalTime}s`
      );

      if (isFirstUser) {
        log(`   📁 Content synced to Google Drive`);

        // Run auto-sync to catch any pre-existing files and set changePageToken
        try {
          const { syncByUserId } = await import("@/lib/google-drive-sync");
          const syncResult = await syncByUserId(userId);
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
      }

      if (SEED_GROUPED_STRUCTURE && (movieCount > 0 || tvCount > 0)) {
        log(`   📌 Movies and TV Shows folders pinned to sidebar`);
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
