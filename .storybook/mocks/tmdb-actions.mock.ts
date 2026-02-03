/**
 * Mock for lib/tmdb-actions.ts
 * Calls TMDB API directly from browser for Storybook stories.
 */

import { fn } from "storybook/test";

// TMDB API configuration
const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_API_KEY = process.env.STORYBOOK_TMDB_API_KEY;

interface TMDBSearchResult {
  id: number;
  mediaType: "movie" | "tv";
  title: string;
  overview: string | null;
  posterPath: string | null;
  backdropPath: string | null;
  year: string | null;
}

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
}

type TMDBResult = TMDBMovie & TMDBTVShow & { media_type?: string };

/**
 * Fetches from TMDB API with API key as query parameter.
 */
async function fetchTMDB<T>(endpoint: string): Promise<T> {
  const separator = endpoint.includes("?") ? "&" : "?";
  const url = `${TMDB_BASE_URL}${endpoint}${separator}api_key=${TMDB_API_KEY}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`TMDB API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Check if TMDB is available.
 * Always returns true in Storybook to enable combobox rendering even without API key.
 */
export const isTMDBAvailable = fn(async (): Promise<boolean> => {
  return true;
});

/**
 * Search for movies and TV shows on TMDB.
 */
export const searchMediaAction = fn(
  async (
    query: string
  ): Promise<
    { success: true; data: TMDBSearchResult[] } | { error: string }
  > => {
    if (!TMDB_API_KEY) {
      return { error: "TMDB API not configured" };
    }

    if (!query || query.length < 2) {
      return { success: true, data: [] };
    }

    try {
      const data = await fetchTMDB<{ results: TMDBResult[] }>(
        `/search/multi?query=${encodeURIComponent(query)}&include_adult=false`
      );

      const results: TMDBSearchResult[] = data.results
        .filter((r) => r.media_type === "movie" || r.media_type === "tv")
        .slice(0, 10)
        .map((r) => ({
          id: r.id,
          mediaType: r.media_type as "movie" | "tv",
          title: r.title || r.name,
          overview: r.overview || null,
          posterPath: r.poster_path,
          backdropPath: r.backdrop_path,
          year:
            r.release_date?.slice(0, 4) ||
            r.first_air_date?.slice(0, 4) ||
            null,
        }));

      return { success: true, data: results };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Search failed",
      };
    }
  }
);

interface MetadataPreview {
  name: string;
  description: string;
  posterUrl: string | null;
  backdropUrl: string | null;
  posterPath: string | null;
  backdropPath: string | null;
}

interface EpisodeMetadataPreview {
  name: string;
  description: string;
  stillUrl: string | null;
  stillPath: string | null;
  seasonNumber: number;
  episodeNumber: number;
}

interface SeasonMetadataPreview {
  name: string;
  description: string;
  posterUrl: string | null;
  posterPath: string | null;
  seasonNumber: number;
  airDate: string | null;
}

/**
 * Get metadata preview for a movie or TV show.
 */
export const getMetadataPreviewAction = fn(
  async (
    tmdbId: number,
    mediaType: "movie" | "tv"
  ): Promise<
    { success: true; data: MetadataPreview } | { success: false; error: string }
  > => {
    if (!TMDB_API_KEY) {
      return { success: false, error: "TMDB API not configured" };
    }

    try {
      if (mediaType === "movie") {
        const data = await fetchTMDB<TMDBMovie>(`/movie/${tmdbId}`);
        const year = data.release_date?.slice(0, 4);
        return {
          success: true,
          data: {
            name: year ? `${data.title} (${year})` : data.title,
            description: data.overview?.slice(0, 500) || "",
            posterUrl: data.poster_path
              ? `https://image.tmdb.org/t/p/w342${data.poster_path}`
              : null,
            backdropUrl: data.backdrop_path
              ? `https://image.tmdb.org/t/p/w780${data.backdrop_path}`
              : null,
            posterPath: data.poster_path,
            backdropPath: data.backdrop_path,
          },
        };
      } else {
        const data = await fetchTMDB<TMDBTVShow>(`/tv/${tmdbId}`);
        const year = data.first_air_date?.slice(0, 4);
        return {
          success: true,
          data: {
            name: year ? `${data.name} (${year})` : data.name,
            description: data.overview?.slice(0, 500) || "",
            posterUrl: data.poster_path
              ? `https://image.tmdb.org/t/p/w342${data.poster_path}`
              : null,
            backdropUrl: data.backdrop_path
              ? `https://image.tmdb.org/t/p/w780${data.backdrop_path}`
              : null,
            posterPath: data.poster_path,
            backdropPath: data.backdrop_path,
          },
        };
      }
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to fetch metadata",
      };
    }
  }
);

/**
 * Get episode metadata preview.
 */
export const getEpisodePreviewAction = fn(
  async (
    tvId: number,
    seasonNumber: number,
    episodeNumber: number
  ): Promise<
    | { success: true; data: EpisodeMetadataPreview }
    | { success: false; error: string }
  > => {
    if (!TMDB_API_KEY) {
      return { success: false, error: "TMDB API not configured" };
    }

    try {
      const data = await fetchTMDB<TMDBEpisode>(
        `/tv/${tvId}/season/${seasonNumber}/episode/${episodeNumber}`
      );
      const seasonStr = String(seasonNumber).padStart(2, "0");
      const episodeStr = String(episodeNumber).padStart(2, "0");
      return {
        success: true,
        data: {
          name: `S${seasonStr}E${episodeStr} - ${data.name}`,
          description: data.overview?.slice(0, 500) || "",
          stillUrl: data.still_path
            ? `https://image.tmdb.org/t/p/w780${data.still_path}`
            : null,
          stillPath: data.still_path,
          seasonNumber,
          episodeNumber,
        },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch episode preview",
      };
    }
  }
);

interface TMDBSeasonDetailsResponse {
  name: string;
  overview: string | null;
  poster_path: string | null;
  season_number: number;
  air_date: string | null;
}

/**
 * Get season metadata preview.
 */
export const getSeasonMetadataAction = fn(
  async (
    tvId: number,
    seasonNumber: number
  ): Promise<
    | { success: true; data: SeasonMetadataPreview }
    | { success: false; error: string }
  > => {
    if (!TMDB_API_KEY) {
      return { success: false, error: "TMDB API not configured" };
    }

    try {
      const data = await fetchTMDB<TMDBSeasonDetailsResponse>(
        `/tv/${tvId}/season/${seasonNumber}`
      );
      return {
        success: true,
        data: {
          name: data.name,
          description: data.overview?.slice(0, 500) || "",
          posterUrl: data.poster_path
            ? `https://image.tmdb.org/t/p/w342${data.poster_path}`
            : null,
          posterPath: data.poster_path,
          seasonNumber: data.season_number,
          airDate: data.air_date,
        },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch season metadata",
      };
    }
  }
);

interface ApplyMetadataOptions {
  updateName?: boolean;
  updateDescription?: boolean;
  updatePoster?: boolean;
  updateBackdrop?: boolean;
}

/**
 * Apply TMDB metadata to an item (stub - does nothing in Storybook).
 */
export const applyMetadataAction = fn(
  async (
    _itemId: string,
    _tmdbId: number,
    _mediaType: "movie" | "tv",
    _options?: ApplyMetadataOptions
  ): Promise<{ success: true } | { success: false; error: string }> => {
    // In Storybook, we just return success without doing anything
    return { success: true };
  }
);

interface TMDBImages {
  posters: TMDBImage[];
  backdrops: TMDBImage[];
}

interface TMDBImagesResponse {
  posters: TMDBImage[];
  backdrops: TMDBImage[];
}

/**
 * Get images for a movie or TV show.
 */
export const getImagesAction = fn(
  async (
    tmdbId: number,
    mediaType: "movie" | "tv"
  ): Promise<
    { success: true; data: TMDBImages } | { success: false; error: string }
  > => {
    if (!TMDB_API_KEY) {
      return { success: false, error: "TMDB API not configured" };
    }

    try {
      const endpoint =
        mediaType === "movie"
          ? `/movie/${tmdbId}/images`
          : `/tv/${tmdbId}/images`;
      const data = await fetchTMDB<TMDBImagesResponse>(endpoint);
      return {
        success: true,
        data: {
          posters: data.posters || [],
          backdrops: data.backdrops || [],
        },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to fetch images",
      };
    }
  }
);

interface TMDBSeasonSummary {
  id: number;
  season_number: number;
  name: string;
  overview: string | null;
  poster_path: string | null;
  episode_count: number;
  air_date: string | null;
}

interface TMDBEpisode {
  id: number;
  episode_number: number;
  name: string;
  overview: string | null;
  still_path: string | null;
  air_date: string | null;
}

interface TMDBTVDetails {
  seasons: TMDBSeasonSummary[];
}

interface TMDBSeasonDetails {
  episodes: TMDBEpisode[];
}

/**
 * Get seasons for a TV show.
 */
export const getSeasonsAction = fn(
  async (
    tmdbId: number
  ): Promise<
    | { success: true; data: TMDBSeasonSummary[] }
    | { success: false; error: string }
  > => {
    if (!TMDB_API_KEY) {
      return { success: false, error: "TMDB API not configured" };
    }

    try {
      const data = await fetchTMDB<TMDBTVDetails>(`/tv/${tmdbId}`);
      // Filter out "Specials" (season 0) and map to our format
      const seasons = data.seasons
        .filter((s) => s.season_number > 0)
        .map((s) => ({
          id: s.id,
          season_number: s.season_number,
          name: s.name,
          overview: s.overview,
          poster_path: s.poster_path,
          episode_count: s.episode_count,
          air_date: s.air_date,
        }));
      return { success: true, data: seasons };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to load seasons",
      };
    }
  }
);

/**
 * Get episodes for a TV show season.
 */
export const getEpisodesAction = fn(
  async (
    tmdbId: number,
    seasonNumber: number
  ): Promise<
    { success: true; data: TMDBEpisode[] } | { success: false; error: string }
  > => {
    if (!TMDB_API_KEY) {
      return { success: false, error: "TMDB API not configured" };
    }

    try {
      const data = await fetchTMDB<TMDBSeasonDetails>(
        `/tv/${tmdbId}/season/${seasonNumber}`
      );
      const episodes = data.episodes.map((e) => ({
        id: e.id,
        episode_number: e.episode_number,
        name: e.name,
        overview: e.overview,
        still_path: e.still_path,
        air_date: e.air_date,
      }));
      return { success: true, data: episodes };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to load episodes",
      };
    }
  }
);

interface TMDBImage {
  file_path: string;
  vote_average: number;
  iso_639_1: string | null;
  width: number;
  height: number;
}

interface TMDBSeasonImages {
  posters: TMDBImage[];
}

interface TMDBEpisodeImages {
  stills: TMDBImage[];
}

interface TMDBSeasonImagesResponse {
  posters: TMDBImage[];
}

interface TMDBEpisodeImagesResponse {
  stills: TMDBImage[];
}

/**
 * Get images for a TV season.
 */
export const getSeasonImagesAction = fn(
  async (
    tmdbId: number,
    seasonNumber: number
  ): Promise<
    | { success: true; data: TMDBSeasonImages }
    | { success: false; error: string }
  > => {
    if (!TMDB_API_KEY) {
      return { success: false, error: "TMDB API not configured" };
    }

    try {
      const data = await fetchTMDB<TMDBSeasonImagesResponse>(
        `/tv/${tmdbId}/season/${seasonNumber}/images`
      );
      return {
        success: true,
        data: {
          posters: data.posters || [],
        },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to load season images",
      };
    }
  }
);

/**
 * Get images for a TV episode.
 */
export const getEpisodeImagesAction = fn(
  async (
    tmdbId: number,
    seasonNumber: number,
    episodeNumber: number
  ): Promise<
    | { success: true; data: TMDBEpisodeImages }
    | { success: false; error: string }
  > => {
    if (!TMDB_API_KEY) {
      return { success: false, error: "TMDB API not configured" };
    }

    try {
      const data = await fetchTMDB<TMDBEpisodeImagesResponse>(
        `/tv/${tmdbId}/season/${seasonNumber}/episode/${episodeNumber}/images`
      );
      return {
        success: true,
        data: {
          stills: data.stills || [],
        },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to load episode images",
      };
    }
  }
);
