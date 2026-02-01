/**
 * TMDB (The Movie Database) API client.
 * Server-side only - do not import in client components.
 */

import { logger } from "@/lib/logger";

const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";
const TMDB_TIMEOUT_MS = 10000; // 10 second timeout for API requests

/** Poster sizes available from TMDB. */
export type PosterSize =
  | "w92"
  | "w154"
  | "w185"
  | "w342"
  | "w500"
  | "w780"
  | "original";

/** Backdrop sizes available from TMDB. */
export type BackdropSize = "w300" | "w780" | "w1280" | "original";

/** TMDB movie details. */
export interface TMDBMovie {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
}

/** TMDB TV show details. */
export interface TMDBTVShow {
  id: number;
  name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string;
  number_of_seasons: number;
}

/** TMDB TV episode. */
export interface TMDBEpisode {
  id: number;
  episode_number: number;
  name: string;
  overview?: string;
  still_path?: string | null;
}

/** TMDB TV season with episodes. */
export interface TMDBSeason {
  id: number;
  season_number: number;
  episodes: TMDBEpisode[];
}

/** TMDB TV season with full episode details. */
export interface TMDBSeasonDetail {
  id: number;
  season_number: number;
  name: string;
  overview: string;
  poster_path: string | null;
  air_date: string | null;
  episodes: TMDBEpisode[];
}

/**
 * Brief season info from TV show details endpoint.
 * Used for displaying season list in episode picker.
 */
export interface TMDBSeasonSummary {
  /** Season ID */
  id: number;
  /** Season number (1-based, 0 for specials) */
  season_number: number;
  /** Season name (e.g., "Season 1" or "Specials") */
  name: string;
  /** Season overview/description */
  overview: string;
  /** Poster path for season artwork */
  poster_path: string | null;
  /** Number of episodes in the season */
  episode_count: number;
  /** Air date of the season */
  air_date: string | null;
}

/**
 * Full episode details from TMDB episode endpoint.
 * Used for applying episode-specific metadata.
 */
export interface TMDBEpisodeDetails {
  /** Episode ID */
  id: number;
  /** Episode number (1-based) */
  episode_number: number;
  /** Season number this episode belongs to */
  season_number: number;
  /** Episode title */
  name: string;
  /** Episode overview/description */
  overview: string;
  /** Still image path (16:9 scene shot) */
  still_path: string | null;
  /** Air date of the episode */
  air_date: string | null;
  /** Runtime in minutes */
  runtime: number | null;
  /** Community vote average (0-10) */
  vote_average: number;
}

/** Normalized search result for UI. */
export interface TMDBSearchResult {
  id: number;
  mediaType: "movie" | "tv";
  title: string;
  overview: string;
  posterPath: string | null;
  backdropPath: string | null;
  year: string;
}

/**
 * TMDB image metadata from the images API.
 * Used for poster and backdrop selection grids.
 */
export interface TMDBImage {
  /** Image file path (e.g., "/abc123.jpg") */
  file_path: string;
  /** Community vote average (0-10) */
  vote_average: number;
  /** Language code or null for textless images */
  iso_639_1: string | null;
  /** Image width in pixels */
  width: number;
  /** Image height in pixels */
  height: number;
}

/**
 * Collection of images for a movie or TV show.
 */
export interface TMDBImages {
  /** Backdrop images (16:9 landscape) */
  backdrops: TMDBImage[];
  /** Poster images (2:3 portrait) */
  posters: TMDBImage[];
}

/**
 * Collection of images for a TV season.
 * Seasons only have posters, no backdrops.
 */
export interface TMDBSeasonImages {
  /** Poster images (2:3 portrait) */
  posters: TMDBImage[];
}

/**
 * Collection of images for a TV episode.
 * Episodes only have stills (scene shots), no posters or backdrops.
 */
export interface TMDBEpisodeImages {
  /** Still images (16:9 scene shots) */
  stills: TMDBImage[];
}

/**
 * Gets the TMDB API key from environment.
 *
 * @returns API key or null if not configured
 */
function getApiKey(): string | null {
  return process.env.TMDB_API_KEY || null;
}

/**
 * Checks if TMDB integration is available.
 *
 * @returns Whether TMDB API key is configured
 */
export function isTMDBConfigured(): boolean {
  return !!getApiKey();
}

/**
 * Makes an authenticated request to TMDB API.
 * Returns null on error instead of throwing.
 *
 * @param endpoint - API endpoint path
 * @returns Response data or null on error
 */
async function tmdbFetch<T>(endpoint: string): Promise<T | null> {
  const apiKey = getApiKey();
  if (!apiKey) {
    logger.warn("TMDB_API_KEY not configured");
    return null;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TMDB_TIMEOUT_MS);

  // Use query param auth for v3 API key (same as seed.ts)
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
      logger.error({ status: response.status }, "TMDB API error");
      return null;
    }

    return response.json();
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      logger.error({ endpoint }, "TMDB request timed out");
    } else {
      logger.error({ error }, "TMDB fetch failed");
    }
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Searches for movies and TV shows.
 * Returns normalized results for UI display.
 *
 * @param query - Search query
 * @returns Array of search results (empty on error)
 */
export async function searchMedia(query: string): Promise<TMDBSearchResult[]> {
  if (!query.trim()) return [];

  const encoded = encodeURIComponent(query);
  const data = await tmdbFetch<{
    results: Array<{
      id: number;
      media_type: string;
      title?: string;
      name?: string;
      overview?: string;
      poster_path?: string | null;
      backdrop_path?: string | null;
      release_date?: string;
      first_air_date?: string;
    }>;
  }>(`/search/multi?query=${encoded}&include_adult=false`);

  if (!data?.results) return [];

  // Filter to movies and TV only, normalize format
  return data.results
    .filter((r) => r.media_type === "movie" || r.media_type === "tv")
    .slice(0, 10)
    .map((r) => ({
      id: r.id,
      mediaType: r.media_type as "movie" | "tv",
      title: r.title || r.name || "Unknown",
      overview: r.overview || "",
      posterPath: r.poster_path || null,
      backdropPath: r.backdrop_path || null,
      year: extractYear(r.release_date || r.first_air_date),
    }));
}

/**
 * Fetches movie details by TMDB ID.
 *
 * @param movieId - TMDB movie ID
 * @returns Movie details or null on error
 */
export async function getMovie(movieId: number): Promise<TMDBMovie | null> {
  return tmdbFetch<TMDBMovie>(`/movie/${movieId}`);
}

/**
 * Fetches TV show details by TMDB ID.
 *
 * @param tvId - TMDB TV show ID
 * @returns TV show details or null on error
 */
export async function getTVShow(tvId: number): Promise<TMDBTVShow | null> {
  return tmdbFetch<TMDBTVShow>(`/tv/${tvId}`);
}

/**
 * Fetches TV season with episodes.
 *
 * @param tvId - TMDB TV show ID
 * @param seasonNumber - Season number (1-based)
 * @returns Season with episodes or null on error
 */
export async function getTVSeason(
  tvId: number,
  seasonNumber: number
): Promise<TMDBSeason | null> {
  return tmdbFetch<TMDBSeason>(`/tv/${tvId}/season/${seasonNumber}`);
}

/**
 * Fetches all seasons for a TV show.
 * Returns season summaries with episode counts for episode picker display.
 *
 * @param tvId - TMDB TV show ID
 * @returns Array of season summaries or null on error
 */
export async function getTVSeasons(
  tvId: number
): Promise<TMDBSeasonSummary[] | null> {
  // Fetch show details which includes seasons array
  const data = await tmdbFetch<{
    seasons?: TMDBSeasonSummary[];
  }>(`/tv/${tvId}`);

  if (!data?.seasons) return null;

  // Sort by season number (specials first, then numbered seasons)
  return data.seasons.sort((a, b) => a.season_number - b.season_number);
}

/**
 * Fetches all episodes for a specific season.
 * Wrapper around getTVSeason that returns just the episodes array.
 *
 * @param tvId - TMDB TV show ID
 * @param seasonNumber - Season number (0 for specials, 1+ for numbered seasons)
 * @returns Array of episodes or null on error
 */
export async function getTVEpisodes(
  tvId: number,
  seasonNumber: number
): Promise<TMDBEpisode[] | null> {
  const season = await getTVSeason(tvId, seasonNumber);
  if (!season?.episodes) return null;

  // Sort by episode number
  return season.episodes.sort((a, b) => a.episode_number - b.episode_number);
}

/**
 * Fetches full details for a specific episode.
 * Returns episode metadata including still image path.
 *
 * @param tvId - TMDB TV show ID
 * @param seasonNumber - Season number (0 for specials, 1+ for numbered seasons)
 * @param episodeNumber - Episode number (1-based)
 * @returns Episode details or null on error
 */
export async function getEpisodeDetails(
  tvId: number,
  seasonNumber: number,
  episodeNumber: number
): Promise<TMDBEpisodeDetails | null> {
  return tmdbFetch<TMDBEpisodeDetails>(
    `/tv/${tvId}/season/${seasonNumber}/episode/${episodeNumber}`
  );
}

/**
 * Constructs full still image URL from TMDB path.
 * Stills are 16:9 scene shots used for episode thumbnails.
 *
 * @param stillPath - TMDB still path (e.g., "/abc123.jpg")
 * @param size - Image size (default: w300 for thumbnails)
 * @returns Full image URL or null if invalid path
 */
export function getStillUrl(
  stillPath: string | null,
  size: BackdropSize = "w300"
): string | null {
  if (!stillPath || !isValidImagePath(stillPath)) return null;
  return `${TMDB_IMAGE_BASE}/${size}${stillPath}`;
}

/**
 * Constructs full poster image URL from TMDB path.
 *
 * @param posterPath - TMDB poster path (e.g., "/abc123.jpg")
 * @param size - Image size (default: w500, ~50-100KB)
 * @returns Full image URL or null
 */
export function getPosterUrl(
  posterPath: string | null,
  size: PosterSize = "w500"
): string | null {
  if (!posterPath) return null;
  return `${TMDB_IMAGE_BASE}/${size}${posterPath}`;
}

/**
 * Downloads poster image as Buffer.
 *
 * @param posterPath - TMDB poster path
 * @returns Image buffer or null on error
 */
export async function downloadPoster(
  posterPath: string | null
): Promise<Buffer | null> {
  const url = getPosterUrl(posterPath);
  if (!url) return null;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TMDB_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return null;

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      logger.error({ posterPath }, "Poster download timed out");
    } else {
      logger.error({ error, posterPath }, "Failed to download poster");
    }
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

/** Pattern for valid TMDB image paths (e.g., /abc123XYZ.jpg) */
const VALID_IMAGE_PATH_PATTERN = /^\/[a-zA-Z0-9]+\.(jpg|png)$/;

/**
 * Validates a TMDB image path for security.
 * Prevents malicious path injection.
 *
 * @param imagePath - TMDB image path to validate
 * @returns Whether the path is valid
 */
export function isValidImagePath(imagePath: string | null): boolean {
  if (!imagePath) return false;
  return VALID_IMAGE_PATH_PATTERN.test(imagePath);
}

/**
 * Constructs full backdrop image URL from TMDB path.
 *
 * @param backdropPath - TMDB backdrop path (e.g., "/abc123.jpg")
 * @param size - Image size (default: original for hero images)
 * @returns Full image URL or null if invalid path
 */
export function getBackdropUrl(
  backdropPath: string | null,
  size: BackdropSize = "original"
): string | null {
  if (!backdropPath || !isValidImagePath(backdropPath)) return null;
  return `${TMDB_IMAGE_BASE}/${size}${backdropPath}`;
}

/**
 * Downloads backdrop image as Buffer.
 * Uses original size for maximum quality.
 *
 * @param backdropPath - TMDB backdrop path
 * @returns Image buffer or null on error
 */
export async function downloadBackdrop(
  backdropPath: string | null
): Promise<Buffer | null> {
  const url = getBackdropUrl(backdropPath, "original");
  if (!url) return null;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TMDB_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return null;

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      logger.error({ backdropPath }, "Backdrop download timed out");
    } else {
      logger.error({ error, backdropPath }, "Failed to download backdrop");
    }
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Extracts year from date string.
 *
 * @param dateStr - Date string (YYYY-MM-DD format)
 * @returns Year string or empty
 */
export function extractYear(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  return dateStr.split("-")[0] || "";
}

/**
 * Truncates text to max length with ellipsis.
 * Used to fit TMDB overviews into item description (1000 char limit).
 *
 * @param text - Text to truncate
 * @param maxLength - Maximum length (default: 1000)
 * @returns Truncated text
 */
export function truncateOverview(text: string, maxLength = 1000): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}

/**
 * Fetches all available images for a movie.
 * Returns posters and backdrops sorted by vote average.
 *
 * @param movieId - TMDB movie ID
 * @returns Images collection or null on error
 */
export async function getMovieImages(
  movieId: number
): Promise<TMDBImages | null> {
  const data = await tmdbFetch<TMDBImages>(`/movie/${movieId}/images`);
  if (!data) return null;

  // Sort by vote average (highest first) and validate paths
  return {
    backdrops: (data.backdrops || [])
      .filter((img) => isValidImagePath(img.file_path))
      .sort((a, b) => b.vote_average - a.vote_average),
    posters: (data.posters || [])
      .filter((img) => isValidImagePath(img.file_path))
      .sort((a, b) => b.vote_average - a.vote_average),
  };
}

/**
 * Fetches all available images for a TV show.
 * Returns posters and backdrops sorted by vote average.
 *
 * @param tvId - TMDB TV show ID
 * @returns Images collection or null on error
 */
export async function getTVShowImages(
  tvId: number
): Promise<TMDBImages | null> {
  const data = await tmdbFetch<TMDBImages>(`/tv/${tvId}/images`);
  if (!data) return null;

  // Sort by vote average (highest first) and validate paths
  return {
    backdrops: (data.backdrops || [])
      .filter((img) => isValidImagePath(img.file_path))
      .sort((a, b) => b.vote_average - a.vote_average),
    posters: (data.posters || [])
      .filter((img) => isValidImagePath(img.file_path))
      .sort((a, b) => b.vote_average - a.vote_average),
  };
}

/**
 * Fetches full details for a specific season.
 * Returns season metadata including name, overview, and poster path.
 *
 * @param tvId - TMDB TV show ID
 * @param seasonNumber - Season number (0 for specials, 1+ for numbered seasons)
 * @returns Season details or null on error
 *
 * @example
 * const season = await getSeasonDetails(1396, 1); // Breaking Bad S1
 */
export async function getSeasonDetails(
  tvId: number,
  seasonNumber: number
): Promise<TMDBSeasonDetail | null> {
  return tmdbFetch<TMDBSeasonDetail>(`/tv/${tvId}/season/${seasonNumber}`);
}

/**
 * Fetches all available images for a TV season.
 * Returns posters only (seasons don't have backdrops), sorted by vote average.
 *
 * @param tvId - TMDB TV show ID
 * @param seasonNumber - Season number (0 for specials, 1+ for numbered seasons)
 * @returns Season images collection or null on error
 *
 * @example
 * const images = await getTVSeasonImages(1396, 1); // Breaking Bad S1 posters
 */
export async function getTVSeasonImages(
  tvId: number,
  seasonNumber: number
): Promise<TMDBSeasonImages | null> {
  const data = await tmdbFetch<{ posters?: TMDBImage[] }>(
    `/tv/${tvId}/season/${seasonNumber}/images`
  );
  if (!data) return null;

  // Sort by vote average (highest first) and validate paths
  return {
    posters: (data.posters || [])
      .filter((img) => isValidImagePath(img.file_path))
      .sort((a, b) => b.vote_average - a.vote_average),
  };
}

/**
 * Fetches all available images for a TV episode.
 * Returns stills only (16:9 scene shots), sorted by vote average.
 *
 * @param tvId - TMDB TV show ID
 * @param seasonNumber - Season number (0 for specials, 1+ for numbered seasons)
 * @param episodeNumber - Episode number (1-based)
 * @returns Episode images collection or null on error
 *
 * @example
 * const images = await getEpisodeImages(1396, 1, 1); // Breaking Bad S01E01 stills
 */
export async function getEpisodeImages(
  tvId: number,
  seasonNumber: number,
  episodeNumber: number
): Promise<TMDBEpisodeImages | null> {
  const data = await tmdbFetch<{ stills?: TMDBImage[] }>(
    `/tv/${tvId}/season/${seasonNumber}/episode/${episodeNumber}/images`
  );
  if (!data) return null;

  // Sort by vote average (highest first) and validate paths
  return {
    stills: (data.stills || [])
      .filter((img) => isValidImagePath(img.file_path))
      .sort((a, b) => b.vote_average - a.vote_average),
  };
}

/**
 * Gets the best textless backdrop from an images collection.
 * Prefers textless (iso_639_1: null) backdrops with highest vote average.
 *
 * @param images - TMDB images collection
 * @returns Best backdrop path or null if none available
 */
export function getBestTextlessBackdrop(images: TMDBImages): string | null {
  if (!images.backdrops?.length) return null;

  // Filter to textless only (iso_639_1 is null)
  const textless = images.backdrops.filter((img) => img.iso_639_1 === null);

  // If no textless, fall back to any backdrop
  const candidates = textless.length > 0 ? textless : images.backdrops;

  // Already sorted by vote_average, so first is best
  return candidates[0]?.file_path || null;
}
