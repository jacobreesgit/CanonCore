/**
 * Seed configuration for populating the database with demo content.
 * Uses TMDB IDs to fetch real movie and TV show metadata.
 *
 * Environment Variables:
 *   - SEED_MAX_SEASONS: Max seasons per show (0 = unlimited, default: 2)
 *   - SEED_MAX_EPISODES: Max episodes per season (0 = unlimited, default: 10)
 *   - SEED_RANDOM_SEED: Seed for reproducible random file counts (default: null = Math.random)
 *   - SEED_ONLY_MOVIES: Skip TV shows, seed only movies (default: false)
 *   - SEED_ONLY_SHOWS: Skip movies, seed only TV shows (default: false)
 *   - SEED_SKIP_DRIVE: Skip Google Drive uploads (default: false)
 *   - SEED_SKIP_ARTWORK: Skip downloading/uploading artwork (default: false)
 *   - SEED_QUIET: Suppress progress output (default: false)
 *   - SEED_MOVIE_COUNT: Limit number of movies (0 = all, default: 0)
 *   - SEED_SHOW_COUNT: Limit number of TV shows (0 = all, default: 0)
 *   - SEED_USER_EMAIL: Override to seed single user only (default: null)
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

/** Skip Google Drive uploads. */
export const SEED_SKIP_DRIVE = parseBooleanEnv(process.env.SEED_SKIP_DRIVE);

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

/** Movie TMDB IDs to seed. */
export const MOVIE_IDS = [
  278, // The Shawshank Redemption
  238, // The Godfather
  240, // The Godfather Part II
  424, // Schindler's List
  389, // 12 Angry Men
  129, // Spirited Away
  19404, // Dilwale Dulhania Le Jayenge
  496243, // Parasite
  637, // Life Is Beautiful
  155, // The Dark Knight
];

/** TV Show TMDB IDs to seed. */
export const TV_SHOW_IDS = [
  57243, // Doctor Who (2005)
  1396, // Breaking Bad
  1399, // Game of Thrones
  60625, // Rick and Morty
  1418, // The Big Bang Theory
  456, // The Simpsons
  66732, // Stranger Things
  1100, // How I Met Your Mother
  71912, // The Witcher
  84958, // Loki
];

/** Seed user configuration. */
export const SEED_USERS = [
  {
    email: "demo@canoncore.com",
    name: "Demo User",
  },
  {
    email: "test@canoncore.com",
    name: "Test User",
  },
];

/** Default password for seed users (override with SEED_PASSWORD env var). */
export const DEFAULT_SEED_PASSWORD = "SeedPassword123!";

/** Folder name created in Google Drive for seeded content. */
export const SEED_DRIVE_FOLDER_NAME = "CanonCore-Seed";

/** Protected folders that should never be deleted during cleanup. */
export const PROTECTED_FOLDERS = ["Breaking Bad", "CanonCore"];

/**
 * Returns effective movie IDs based on flags.
 * Respects SEED_ONLY_SHOWS and SEED_MOVIE_COUNT.
 *
 * @returns Array of movie TMDB IDs to seed
 */
export function getEffectiveMovieIds(): number[] {
  if (SEED_ONLY_SHOWS) return [];
  if (SEED_MOVIE_COUNT > 0) return MOVIE_IDS.slice(0, SEED_MOVIE_COUNT);
  return MOVIE_IDS;
}

/**
 * Returns effective TV show IDs based on flags.
 * Respects SEED_ONLY_MOVIES and SEED_SHOW_COUNT.
 *
 * @returns Array of TV show TMDB IDs to seed
 */
export function getEffectiveTVShowIds(): number[] {
  if (SEED_ONLY_MOVIES) return [];
  if (SEED_SHOW_COUNT > 0) return TV_SHOW_IDS.slice(0, SEED_SHOW_COUNT);
  return TV_SHOW_IDS;
}

/**
 * Returns effective seed users based on flags.
 * Respects SEED_USER_EMAIL to filter to single user.
 *
 * @returns Array of user configurations to seed
 */
export function getEffectiveSeedUsers(): typeof SEED_USERS {
  if (SEED_USER_EMAIL) {
    return [
      {
        email: SEED_USER_EMAIL,
        name: SEED_USER_EMAIL.split("@")[0],
      },
    ];
  }
  return SEED_USERS;
}
