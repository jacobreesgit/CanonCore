/**
 * Database seed script for populating demo content with Google Drive integration.
 * Fetches TMDB metadata, downloads posters, and uploads to Google Drive.
 *
 * Usage:
 *   ALLOW_SEEDING=true npx prisma db seed
 *
 * Environment Variables:
 *   - ALLOW_SEEDING: Must be "true" to run (prevents accidental seeding)
 *   - TMDB_API_KEY: Required for fetching metadata (v3 API key)
 *   - GOOGLE_TEST_REFRESH_TOKEN: Required for Drive integration
 *   - GOOGLE_TEST_ROOT_FOLDER_ID: Root folder for Drive storage
 *   - GOOGLE_CLIENT_ID: OAuth client ID
 *   - GOOGLE_CLIENT_SECRET: OAuth client secret
 *   - ENCRYPTION_KEY: For encrypting Drive tokens
 *   - SEED_PASSWORD: Optional password for seed users (default: SeedPassword123!)
 *   - DATABASE_URL: Database connection string (must not be production)
 */

// Load environment variables before any other imports
import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

import { FileType, SyncStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import {
  MOVIE_IDS,
  TV_SHOW_IDS,
  SEED_USERS,
  DEFAULT_SEED_PASSWORD,
  MAX_SEASONS,
  MAX_EPISODES,
  RANDOM_SEED,
  TMDB_API_DELAY_MS,
} from "./seed-config";

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
  const refreshToken = process.env.GOOGLE_TEST_REFRESH_TOKEN!;
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
 * Attaches 1-2 of each file type to an item.
 * - Artwork: Downloaded from TMDB (poster/backdrop/still)
 * - Subtitles: Generated placeholder SRT files
 * - Media: Placeholder entries with null driveFileId (episodes/movies only)
 */
async function attachRandomFiles(
  itemId: string,
  itemName: string,
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
    try {
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
    } catch {
      // Continue even if upload fails
    }
  }

  // --- SUBTITLES ---
  // Shuffle using seeded random for reproducibility
  const shuffledLanguages = [...SUBTITLE_LANGUAGES].sort(() => random() - 0.5);
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

  // Check Google Drive credentials
  if (!process.env.GOOGLE_TEST_REFRESH_TOKEN) {
    console.error(
      "❌ GOOGLE_TEST_REFRESH_TOKEN is required for Drive integration"
    );
    process.exit(1);
  }

  if (!process.env.GOOGLE_TEST_ROOT_FOLDER_ID) {
    console.error(
      "❌ GOOGLE_TEST_ROOT_FOLDER_ID is required for Drive integration"
    );
    process.exit(1);
  }

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    console.error("❌ GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required");
    process.exit(1);
  }

  if (!process.env.ENCRYPTION_KEY) {
    console.error("❌ ENCRYPTION_KEY is required for token encryption");
    process.exit(1);
  }

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
 * Creates seed users.
 */
async function createSeedUsers(): Promise<string[]> {
  const password = process.env.SEED_PASSWORD || DEFAULT_SEED_PASSWORD;
  const passwordHash = await bcrypt.hash(password, 10);

  const userIds: string[] = [];

  for (const userData of SEED_USERS) {
    const user = await prisma.user.create({
      data: {
        email: userData.email,
        name: userData.name,
        passwordHash,
      },
    });
    userIds.push(user.id);
    console.log(`👤 Created user: ${userData.email}`);
  }

  return userIds;
}

/**
 * Creates Google Drive connection for a user.
 */
async function createDriveConnection(userId: string): Promise<DriveContext> {
  const { encryptCredential } = await import("@/lib/crypto");

  const refreshToken = process.env.GOOGLE_TEST_REFRESH_TOKEN!;
  const rootFolderId = process.env.GOOGLE_TEST_ROOT_FOLDER_ID!;

  // Create connection with encrypted tokens
  const connection = await prisma.googleDriveConnection.create({
    data: {
      userId,
      name: "Seed Demo Drive",
      email: process.env.GOOGLE_TEST_EMAIL || "seed@canoncore.com",
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
 * Seeds movies for a user with Drive integration.
 * Creates items directly at root level (flat structure).
 */
async function seedMovies(
  userId: string,
  ctx: DriveContext,
  startOrder: number,
  progress: SeedProgress
): Promise<number> {
  let count = 0;

  for (let i = 0; i < MOVIE_IDS.length; i++) {
    const movieId = MOVIE_IDS[i];

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

    // Create folder for this movie in Drive (directly under root)
    let movieDriveFolderId: string;
    try {
      movieDriveFolderId = await createDriveFolder(ctx, name, ctx.rootFolderId);
    } catch (error) {
      console.error(`❌ Failed to create Drive folder for ${name}:`, error);
      continue;
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
        driveConnectionId: ctx.connectionId,
        driveFileId: movieDriveFolderId,
        syncStatus: SyncStatus.SYNCED,
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

    // Attach files (artwork from still, subtitles, media placeholders)
    await attachRandomFiles(
      episodeItem.id,
      episodeName,
      "episode",
      episode.still_path || null,
      null, // No backdrop for episodes
      ctx,
      episodeDriveFolderId
    );

    count++;
  }

  return count;
}

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

    // Attach files (artwork, subtitles - no media for seasons)
    await attachRandomFiles(
      seasonItem.id,
      seasonName,
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
 * Seeds TV shows for a user with Drive integration.
 * Creates hierarchical structure: Show → Seasons → Episodes.
 */
async function seedTVShows(
  userId: string,
  ctx: DriveContext,
  startOrder: number,
  progress: SeedProgress
): Promise<number> {
  let count = 0;

  for (let i = 0; i < TV_SHOW_IDS.length; i++) {
    const showId = TV_SHOW_IDS[i];

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

    // Create folder for this show in Drive (directly under root)
    let showDriveFolderId: string;
    try {
      showDriveFolderId = await createDriveFolder(ctx, name, ctx.rootFolderId);
    } catch (error) {
      console.error(`❌ Failed to create Drive folder for ${name}:`, error);
      continue;
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
        driveConnectionId: ctx.connectionId,
        driveFileId: showDriveFolderId,
        syncStatus: SyncStatus.SYNCED,
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
    const seasonItemCount = await seedSeasons(
      showId,
      item.id,
      showDriveFolderId,
      name,
      show.number_of_seasons,
      userId,
      ctx
    );

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

    console.log("⚠️  Database cleaned. Drive folders may need manual cleanup.");
    console.log("   Run: ALLOW_SEEDING=true npx tsx prisma/seed-cleanup.ts");
  } catch (cleanupError) {
    console.error("❌ Cleanup failed:", cleanupError);
  }
}

/**
 * Main seed function.
 */
async function main(): Promise<void> {
  console.log("\n🌱 Starting database seed with Google Drive integration...\n");

  // Validate environment
  validateEnvironment();

  // Dynamic import of prisma after env vars are loaded
  const prismaModule = await import("@/lib/prisma");
  prisma = prismaModule.prisma;

  // Cleanup existing seed users
  await cleanupSeedUsers();

  // Create seed users
  const userIds = await createSeedUsers();

  // Seed content for first user only (demo user)
  const demoUserId = userIds[0];
  if (demoUserId) {
    console.log("\n📚 Seeding content for demo user...\n");

    try {
      // Create Drive connection
      const ctx = await createDriveConnection(demoUserId);

      // Initialize progress tracking
      const progress: SeedProgress = {
        startTime: Date.now(),
        totalShows: TV_SHOW_IDS.length,
        completedShows: 0,
        totalMovies: MOVIE_IDS.length,
        completedMovies: 0,
      };

      const movieCount = await seedMovies(demoUserId, ctx, 0, progress);
      const tvCount = await seedTVShows(demoUserId, ctx, movieCount, progress);

      const totalTime = Math.round((Date.now() - progress.startTime) / 1000);
      console.log(
        `\n✅ Seeded ${movieCount} movies and ${tvCount} TV show items in ${totalTime}s`
      );
      console.log(`   📁 Content synced to Google Drive`);
    } catch (error) {
      console.error("\n❌ Seed failed:", error);
      await cleanupOnFailure(demoUserId);
      throw error;
    }
  }

  console.log("\n🎉 Seeding complete!\n");
  console.log("Login credentials:");
  console.log(`  Email: demo@canoncore.com`);
  console.log(
    `  Password: ${process.env.SEED_PASSWORD || DEFAULT_SEED_PASSWORD}\n`
  );
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
