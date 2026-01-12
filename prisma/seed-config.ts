/**
 * Seed configuration for populating the database with demo content.
 * Uses TMDB IDs to fetch real movie and TV show metadata.
 *
 * Environment Variables:
 *   - SEED_MAX_SEASONS: Max seasons per show (0 = unlimited, default: 2)
 *   - SEED_MAX_EPISODES: Max episodes per season (0 = unlimited, default: 10)
 *   - SEED_RANDOM_SEED: Seed for reproducible random file counts (default: null = Math.random)
 *   - TMDB_API_DELAY_MS is hardcoded at 100ms for rate limiting
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
