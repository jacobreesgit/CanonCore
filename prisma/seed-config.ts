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

  // demo - MCU Marathon
  1726, // Iron Man
  24428, // The Avengers
  100402, // Captain America: The Winter Soldier
  118340, // Guardians of the Galaxy
  271110, // Captain America: Civil War
  284052, // Doctor Strange
  315635, // Spider-Man: Homecoming
  284054, // Black Panther
  299536, // Avengers: Infinity War
  299534, // Avengers: Endgame
  566525, // Shang-Chi and the Legend of the Ten Rings
  634649, // Spider-Man: No Way Home

  // demo - Additional classics (pagination testing)
  155, // The Dark Knight
  27205, // Inception
  157336, // Interstellar
  550, // Fight Club
  1422, // The Departed
  769, // Goodfellas
  1124, // The Prestige
  98, // Gladiator
  857, // Saving Private Ryan
  497, // The Green Mile
  807, // Se7en
  274, // The Silence of the Lambs
  348, // Alien
  78, // Blade Runner
  6977, // No Country for Old Men

  // filmfan - International Film
  129, // Spirited Away
  496243, // Parasite
  637, // Life Is Beautiful
  194, // Amélie
  598, // City of God
  1417, // Pan's Labyrinth

  // filmfan - Additional international (pagination testing)
  11216, // Cinema Paradiso
  843, // In the Mood for Love
  548, // Rashomon
  346, // Seven Samurai
  316029, // The Handmaiden
  670, // Oldboy
  7549, // Y Tu Mamá También
  395992, // Roma
  146, // Crouching Tiger, Hidden Dragon
  1865, // Hero
  153919, // A Separation
  12124, // The Secret in Their Eyes
  505192, // Shoplifters
  728328, // Drive My Car
  522444, // Another Round
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
  /** Short bio for public profile. */
  bio?: string;
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
    bio: "Film enthusiast and classic cinema collector. Curating the greatest stories ever told.",
  },
  {
    email: "filmfan@canoncore.com",
    name: "Sarah Mitchell",
    username: "filmfan",
    isPublic: true,
    avatarSeed: "filmfan-avatar",
    heroSeed: "filmfan-hero",
    bio: "International cinema lover. Always watching something with subtitles.",
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
    movieIds: [
      278, 238, 240, 424, 389, 680, 13, 603,
      // MCU Marathon
      1726, 24428, 100402, 118340, 271110, 284052, 315635, 284054, 299536,
      299534, 566525, 634649,
      // Additional classics (pagination testing — 35 movies total)
      155, 27205, 157336, 550, 1422, 769, 1124, 98, 857, 497, 807, 274, 348, 78,
      6977,
    ],
    showIds: [1396, 1398], // Breaking Bad, The Sopranos
  },
  "filmfan@canoncore.com": {
    // International Film Lover - foreign language masterpieces
    movieIds: [
      129, 496243, 637, 194, 598, 1417,
      // Additional international (pagination testing — 21 movies total)
      11216, 843, 548, 346, 316029, 670, 7549, 395992, 146, 1865, 153919, 12124,
      505192, 728328, 522444,
    ],
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

/**
 * TMDB IDs of items to mark as private after seeding (negative testing).
 * These items should NOT appear in explore or visitor profile views.
 */
export const PRIVATE_ITEM_TMDB_IDS: Record<string, number[]> = {
  "demo@canoncore.com": [348, 78], // Alien, Blade Runner
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
