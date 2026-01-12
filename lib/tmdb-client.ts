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

/** TMDB movie details. */
export interface TMDBMovie {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  release_date: string;
}

/** TMDB TV show details. */
export interface TMDBTVShow {
  id: number;
  name: string;
  overview: string;
  poster_path: string | null;
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
  episodes: TMDBEpisode[];
}

/** Normalized search result for UI. */
export interface TMDBSearchResult {
  id: number;
  mediaType: "movie" | "tv";
  title: string;
  overview: string;
  posterPath: string | null;
  year: string;
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
