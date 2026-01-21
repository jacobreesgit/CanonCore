/**
 * Seed configuration for populating the database with demo content.
 * Uses TMDB IDs to fetch real movie and TV show metadata.
 *
 * IMPORTANT: Google Drive is REQUIRED for seeding. Run setup first:
 *   pnpm run setup:seed
 *
 * Environment Variables:
 *   - SEED_MAX_SEASONS: Max seasons per show (0 = unlimited, default: 2)
 *   - SEED_MAX_EPISODES: Max episodes per season (0 = unlimited, default: 10)
 *   - SEED_RANDOM_SEED: Seed for reproducible random file counts (default: null = Math.random)
 *   - SEED_ONLY_MOVIES: Skip TV shows, seed only movies (default: false)
 *   - SEED_ONLY_SHOWS: Skip movies, seed only TV shows (default: false)
 *   - SEED_SKIP_ARTWORK: Skip downloading/uploading artwork (default: false)
 *   - SEED_QUIET: Suppress progress output (default: false)
 *   - SEED_MOVIE_COUNT: Limit number of movies (0 = all, default: 0)
 *   - SEED_SHOW_COUNT: Limit number of TV shows (0 = all, default: 0)
 *   - SEED_MOVIE_IDS: Comma-separated TMDB movie IDs to seed (overrides default list)
 *   - SEED_SHOW_IDS: Comma-separated TMDB show IDs to seed (overrides default list)
 *   - SEED_USER_EMAIL: Override to seed single user only (default: null)
 *   - SEED_GROUPED_STRUCTURE: Create Movies/TV Shows parent folders (default: true)
 *   - TMDB_API_DELAY_MS is hardcoded at 100ms for rate limiting
 */

/**
 * Parses boolean environment variable.
 *
 * @param value - Environment variable value
 * @returns true if value is "true" (case-insensitive), false otherwise
 */
function parseBooleanEnv(value: string | undefined): boolean {
  return value?.toLowerCase() === "true";
}

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

/** Skip TV shows, seed only movies. */
export const SEED_ONLY_MOVIES = parseBooleanEnv(process.env.SEED_ONLY_MOVIES);

/** Skip movies, seed only TV shows. */
export const SEED_ONLY_SHOWS = parseBooleanEnv(process.env.SEED_ONLY_SHOWS);

/** Skip downloading/uploading artwork. */
export const SEED_SKIP_ARTWORK = parseBooleanEnv(process.env.SEED_SKIP_ARTWORK);

/** Suppress progress output. */
export const SEED_QUIET = parseBooleanEnv(process.env.SEED_QUIET);

/** Limit number of movies (0 = all). */
export const SEED_MOVIE_COUNT = parseInt(
  process.env.SEED_MOVIE_COUNT || "0",
  10
);

/** Limit number of TV shows (0 = all). */
export const SEED_SHOW_COUNT = parseInt(process.env.SEED_SHOW_COUNT || "0", 10);

/** Override to seed single user only. */
export const SEED_USER_EMAIL = process.env.SEED_USER_EMAIL || null;

/** Specific movie IDs to seed (overrides default list). */
export const SEED_MOVIE_IDS = process.env.SEED_MOVIE_IDS
  ? process.env.SEED_MOVIE_IDS.split(",").map((id) => parseInt(id.trim(), 10))
  : null;

/** Specific TV show IDs to seed (overrides default list). */
export const SEED_SHOW_IDS = process.env.SEED_SHOW_IDS
  ? process.env.SEED_SHOW_IDS.split(",").map((id) => parseInt(id.trim(), 10))
  : null;

/** Enable grouped folder structure (Movies/, TV Shows/) instead of flat. */
export const SEED_GROUPED_STRUCTURE =
  process.env.SEED_GROUPED_STRUCTURE?.toLowerCase() !== "false";

/** Enable playback progress simulation for progress bar testing. */
export const SEED_SIMULATE_PLAYBACK =
  process.env.SEED_SIMULATE_PLAYBACK?.toLowerCase() !== "false";

/** Duration ranges in seconds for different content types. */
export const PLAYBACK_DURATIONS = {
  movie: { min: 5400, max: 10800 }, // 1.5-3 hours
  episode: { min: 1800, max: 4200 }, // 30-70 minutes
};

// =============================================================================
// Doctor Who Special Handling
// =============================================================================

/** Classic Doctor Who TMDB ID (1963-1989). */
export const CLASSIC_DOCTOR_WHO_ID = 121;

/** Modern Doctor Who TMDB ID (2005+). */
export const MODERN_DOCTOR_WHO_ID = 57243;

/**
 * Checks if a TV show ID is Classic Doctor Who.
 *
 * @param id - TMDB show ID
 * @returns True if Classic Doctor Who
 */
export function isClassicDoctorWho(id: number): boolean {
  return id === CLASSIC_DOCTOR_WHO_ID;
}

/**
 * Checks if a TV show ID is Modern Doctor Who.
 *
 * @param id - TMDB show ID
 * @returns True if Modern Doctor Who
 */
export function isModernDoctorWho(id: number): boolean {
  return id === MODERN_DOCTOR_WHO_ID;
}

/**
 * Checks if a TV show ID is any Doctor Who (Classic or Modern).
 *
 * @param id - TMDB show ID
 * @returns True if any Doctor Who
 */
export function isDoctorWho(id: number): boolean {
  return isClassicDoctorWho(id) || isModernDoctorWho(id);
}

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

  // bingewatcher - Peak TV
  155, // The Dark Knight
  27205, // Inception
  157336, // Interstellar

  // scifi_jordan - Sci-Fi/Fantasy
  78, // Blade Runner
  438631, // Dune
  329865, // Arrival
  264660, // Ex Machina
  286217, // The Martian
];

/** TV Show TMDB IDs to seed (superset of all user shows). */
export const TV_SHOW_IDS = [
  // demo - Classic Cinema Buff
  1396, // Breaking Bad
  1398, // The Sopranos

  // filmfan - International Film
  93405, // Squid Game
  70523, // Dark

  // bingewatcher - Peak TV
  1399, // Game of Thrones
  66732, // Stranger Things
  2316, // The Office
  1668, // Friends

  // scifi_jordan - Sci-Fi/Fantasy
  121, // Doctor Who (Classic, 1963-1989)
  57243, // Doctor Who (Modern, 2005+)
  63639, // The Expanse
  42009, // Black Mirror
];

/** User profile configuration for seeding. */
export interface SeedUserConfig {
  email: string;
  name: string;
  username?: string;
  isPublic?: boolean;
  /** Lorem Picsum seed for avatar image (null = no avatar). */
  avatarSeed?: string | null;
  /** Lorem Picsum seed for hero banner (null = no hero). */
  heroSeed?: string | null;
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

/** Avatar image dimensions. */
export const AVATAR_SIZE = { width: 400, height: 400 };

/** Hero banner dimensions. */
export const HERO_SIZE = { width: 1920, height: 400 };

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

/** Seed user configuration (5 users for Explore page variety). */
export const SEED_USERS: SeedUserConfig[] = [
  {
    email: "demo@canoncore.com",
    name: "Demo User",
    username: "demo",
    isPublic: true,
    avatarSeed: "demo-avatar",
    heroSeed: "demo-hero",
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
    email: "bingewatcher@canoncore.com",
    name: "Alex Chen",
    username: "bingewatcher",
    isPublic: true,
    avatarSeed: "bingewatcher-avatar",
    heroSeed: "bingewatcher-hero",
  },
  {
    email: "scifi@canoncore.com",
    name: "Jordan Taylor",
    username: "scifi_jordan",
    isPublic: true,
    avatarSeed: "scifi-avatar",
    heroSeed: "scifi-hero",
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
  "bingewatcher@canoncore.com": {
    // Peak TV Enthusiast - Christopher Nolan films + binge-worthy shows
    movieIds: [155, 27205, 157336],
    // Dark Knight, Inception, Interstellar
    showIds: [1399, 66732, 2316, 1668], // Game of Thrones, Stranger Things, The Office, Friends
  },
  "scifi@canoncore.com": {
    // Sci-Fi/Fantasy Fan - science fiction films and shows
    movieIds: [78, 438631, 329865, 264660, 286217],
    // Blade Runner, Dune, Arrival, Ex Machina, The Martian
    showIds: [121, 57243, 63639, 42009], // Doctor Who (Classic + Modern), The Expanse, Black Mirror
  },
  "test@canoncore.com": {
    // Empty for E2E testing - start with clean slate
    movieIds: [],
    showIds: [],
  },
};

/** Progress simulation ranges per user for visual variety. */
export const USER_PROGRESS_RANGES: Record<string, ProgressRange> = {
  "demo@canoncore.com": { min: 0.25, max: 0.75 },
  "filmfan@canoncore.com": { min: 0.8, max: 1.0 },
  "bingewatcher@canoncore.com": { min: 0.1, max: 0.3 },
  "scifi@canoncore.com": { min: 0.4, max: 0.6 },
  "test@canoncore.com": { min: 0, max: 0 },
};

/** Default password for seed users (override with SEED_PASSWORD env var). */
export const DEFAULT_SEED_PASSWORD = "SeedPassword123!";

/** Folder name created in Google Drive for seeded content. */
export const SEED_DRIVE_FOLDER_NAME = "CanonCore-Seed";

/**
 * Returns effective movie IDs based on flags.
 * Respects SEED_ONLY_SHOWS, SEED_MOVIE_IDS, and SEED_MOVIE_COUNT.
 *
 * @returns Array of movie TMDB IDs to seed
 */
export function getEffectiveMovieIds(): number[] {
  if (SEED_ONLY_SHOWS) return [];
  if (SEED_MOVIE_IDS) return SEED_MOVIE_IDS;
  if (SEED_MOVIE_COUNT > 0) return MOVIE_IDS.slice(0, SEED_MOVIE_COUNT);
  return MOVIE_IDS;
}

/**
 * Returns effective TV show IDs based on flags.
 * Respects SEED_ONLY_MOVIES, SEED_SHOW_IDS, and SEED_SHOW_COUNT.
 *
 * @returns Array of TV show TMDB IDs to seed
 */
export function getEffectiveTVShowIds(): number[] {
  if (SEED_ONLY_MOVIES) return [];
  if (SEED_SHOW_IDS) return SEED_SHOW_IDS;
  if (SEED_SHOW_COUNT > 0) return TV_SHOW_IDS.slice(0, SEED_SHOW_COUNT);
  return TV_SHOW_IDS;
}

/**
 * Returns effective seed users based on flags.
 * Respects SEED_USER_EMAIL to filter to single user.
 *
 * @returns Array of user configurations to seed
 */
export function getEffectiveSeedUsers(): SeedUserConfig[] {
  if (SEED_USER_EMAIL) {
    // Find the user in SEED_USERS or create a minimal config
    const existingUser = SEED_USERS.find((u) => u.email === SEED_USER_EMAIL);
    if (existingUser) {
      return [existingUser];
    }
    return [
      {
        email: SEED_USER_EMAIL,
        name: SEED_USER_EMAIL.split("@")[0],
        isPublic: false,
        avatarSeed: null,
        heroSeed: null,
      },
    ];
  }
  return SEED_USERS;
}

/**
 * Returns effective movie IDs for a specific user.
 * Falls back to global effective IDs if user not in distribution config.
 *
 * @param email - User email to get movies for
 * @returns Array of movie TMDB IDs
 */
export function getEffectiveMovieIdsForUser(email: string): number[] {
  const userConfig = USER_CONTENT_DISTRIBUTION[email];
  if (userConfig) {
    // Apply global limits if set
    if (SEED_MOVIE_COUNT > 0) {
      return userConfig.movieIds.slice(0, SEED_MOVIE_COUNT);
    }
    return userConfig.movieIds;
  }
  return getEffectiveMovieIds();
}

/**
 * Returns effective TV show IDs for a specific user.
 * Falls back to global effective IDs if user not in distribution config.
 *
 * @param email - User email to get shows for
 * @returns Array of TV show TMDB IDs
 */
export function getEffectiveTVShowIdsForUser(email: string): number[] {
  const userConfig = USER_CONTENT_DISTRIBUTION[email];
  if (userConfig) {
    // Apply global limits if set
    if (SEED_SHOW_COUNT > 0) {
      return userConfig.showIds.slice(0, SEED_SHOW_COUNT);
    }
    return userConfig.showIds;
  }
  return getEffectiveTVShowIds();
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
