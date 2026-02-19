/**
 * Seed configuration for populating the database with demo content.
 * Uses TMDB IDs to fetch real movie and TV show metadata.
 *
 * IMPORTANT: Google Drive is REQUIRED for seeding. Run setup first:
 *   pnpm run setup:seed
 *
 * Usage:
 *   pnpm run seed
 */

/** Maximum seasons to seed per TV show (0 = unlimited). */
export const MAX_SEASONS = 5;

/** Maximum episodes to seed per season (0 = unlimited). */
export const MAX_EPISODES = 10;

/** Delay between TMDB API calls in ms (rate limiting). */
export const TMDB_API_DELAY_MS = 100;

/** Duration ranges in seconds for different content types. */
export const PLAYBACK_DURATIONS = {
  movie: { min: 5400, max: 10800 }, // 1.5-3 hours
  episode: { min: 1800, max: 4200 }, // 30-70 minutes
};

/** Movie TMDB IDs to seed (superset of all user movies). */
export const MOVIE_IDS = [
  // demo - Classic Cinema Buff
  278, // The Shawshank Redemption
  238, // The Godfather
  240, // The Godfather Part II
  424, // Schindler's List
  389, // 12 Angry Men
  680, // Pulp Fiction
  13, // Forrest Gump
  603, // The Matrix

  // filmfan - International Film
  129, // Spirited Away
  496243, // Parasite
  637, // Life Is Beautiful
  194, // Amélie
  598, // City of God
  1417, // Pan's Labyrinth
];

/** TV Show TMDB IDs to seed (superset of all user shows). */
export const TV_SHOW_IDS = [
  // demo - Classic Cinema Buff
  1396, // Breaking Bad
  1398, // The Sopranos

  // filmfan - International Film
  93405, // Squid Game
  70523, // Dark
];

/** User profile configuration for seeding. */
export interface SeedUserConfig {
  email: string;
  name: string;
  username?: string;
  isPublic?: boolean;
  /** Lorem Picsum seed for avatar image (null = no avatar). */
  avatarSeed?: string | null;
  /** Lorem Picsum seed for hero banner fallback (used if Unsplash unavailable). */
  heroSeed?: string | null;
  /** Direct URL for hero banner (takes precedence over heroSeed). */
  heroUrl?: string | null;
}

/** Content distribution by user email. */
export interface UserContentConfig {
  movieIds: number[];
  showIds: number[];
}

/** Progress simulation range (0-1). */
export interface ProgressRange {
  min: number;
  max: number;
}

/** Avatar image dimensions (square). */
export const AVATAR_SIZE = { width: 800, height: 800 };

/** Hero banner dimensions. */
export const HERO_SIZE = { width: 1920, height: 400 };

/** Playlist artwork dimensions (square, same as avatar). */
export const PLAYLIST_ARTWORK_SIZE = { width: 800, height: 800 };

/**
 * Builds Lorem Picsum URL for reproducible images.
 *
 * @param seed - Seed string for reproducible image
 * @param width - Image width in pixels
 * @param height - Image height in pixels
 * @returns Lorem Picsum URL
 */
export function buildPicsumUrl(
  seed: string,
  width: number,
  height: number
): string {
  return `https://picsum.photos/seed/${seed}/${width}/${height}`;
}

/** Seed user configuration (3 users - demo, filmfan for screenshots, testuser for E2E). */
export const SEED_USERS: SeedUserConfig[] = [
  {
    email: "demo@canoncore.com",
    name: "Demo User",
    username: "demo",
    isPublic: true,
    avatarSeed: "demo-avatar",
    heroSeed: "demo-hero",
    // Walking Dead DVD collection - cinematic hero banner
    heroUrl:
      "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=1920&h=400&fit=crop",
  },
  {
    email: "filmfan@canoncore.com",
    name: "Sarah Mitchell",
    username: "filmfan",
    isPublic: true,
    avatarSeed: "filmfan-avatar",
    heroSeed: "filmfan-hero",
  },
  {
    email: "test@canoncore.com",
    name: "Test User",
    username: "testuser",
    isPublic: false,
    avatarSeed: null,
    heroSeed: null,
  },
];

/** Demo user email - first user in SEED_USERS, used for special handling like real video upload. */
export const DEMO_USER_EMAIL = SEED_USERS[0].email;

/** Content distribution per user for visual variety (zero overlap). */
export const USER_CONTENT_DISTRIBUTION: Record<string, UserContentConfig> = {
  "demo@canoncore.com": {
    // Classic Cinema Buff - award-winning American classics
    movieIds: [278, 238, 240, 424, 389, 680, 13, 603],
    // Shawshank, Godfather I/II, Schindler's, 12 Angry Men, Pulp Fiction, Forrest Gump, Matrix
    showIds: [1396, 1398], // Breaking Bad, The Sopranos
  },
  "filmfan@canoncore.com": {
    // International Film Lover - foreign language masterpieces
    movieIds: [129, 496243, 637, 194, 598, 1417],
    // Spirited Away, Parasite, Life Is Beautiful, Amélie, City of God, Pan's Labyrinth
    showIds: [93405, 70523], // Squid Game, Dark
  },
  "test@canoncore.com": {
    // Empty for E2E testing - start with clean slate
    movieIds: [],
    showIds: [],
  },
};

/** Progress simulation ranges per user for visual variety. */
export const USER_PROGRESS_RANGES: Record<string, ProgressRange> = {
  "demo@canoncore.com": { min: 0.25, max: 0.95 },
  "filmfan@canoncore.com": { min: 0.8, max: 1.0 },
  "test@canoncore.com": { min: 0, max: 0 },
};

/**
 * TMDB IDs to pin for each user (flat structure only).
 * These items will have pinnedOrder set (0, 1, 2...) for sidebar display.
 */
export const USER_PINNED_ITEMS: Record<string, number[]> = {
  "demo@canoncore.com": [1396, 603, 238], // Breaking Bad, The Matrix, The Godfather
  "filmfan@canoncore.com": [129, 496243], // Spirited Away, Parasite
  "test@canoncore.com": [],
};

/** Default password for seed users. */
export const DEFAULT_SEED_PASSWORD = "SeedPassword123!";

/** Folder name created in Google Drive for seeded content. */
export const SEED_DRIVE_FOLDER_NAME = "CanonCore-Seed";

/**
 * Returns movie IDs for a specific user.
 *
 * @param email - User email to get movies for
 * @returns Array of movie TMDB IDs
 */
export function getMovieIdsForUser(email: string): number[] {
  return USER_CONTENT_DISTRIBUTION[email]?.movieIds ?? [];
}

/**
 * Returns TV show IDs for a specific user.
 *
 * @param email - User email to get shows for
 * @returns Array of TV show TMDB IDs
 */
export function getTVShowIdsForUser(email: string): number[] {
  return USER_CONTENT_DISTRIBUTION[email]?.showIds ?? [];
}

/**
 * Validates that all user content IDs exist in the global ID arrays.
 * Call during seed to catch configuration mismatches early.
 *
 * @throws Error if any user movie/show ID is missing from MOVIE_IDS/TV_SHOW_IDS
 */
export function validateContentDistribution(): void {
  const movieIdSet = new Set(MOVIE_IDS);
  const showIdSet = new Set(TV_SHOW_IDS);

  for (const [email, config] of Object.entries(USER_CONTENT_DISTRIBUTION)) {
    for (const movieId of config.movieIds) {
      if (!movieIdSet.has(movieId)) {
        throw new Error(
          `Movie ID ${movieId} for ${email} not found in MOVIE_IDS`
        );
      }
    }
    for (const showId of config.showIds) {
      if (!showIdSet.has(showId)) {
        throw new Error(
          `Show ID ${showId} for ${email} not found in TV_SHOW_IDS`
        );
      }
    }
  }
}
