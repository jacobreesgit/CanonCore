/**
 * Browser-safe TMDB API client for Storybook story loaders.
 * Fetches real data from TMDB v3 API using CORS-compatible requests.
 *
 * Unlike lib/tmdb-client.ts, this module avoids Node.js-only dependencies
 * (React.cache, logger, Buffer) so it can run in the browser.
 */

import type {
  CastMember,
  WatchProvider,
  Video,
  Recommendation,
  TmdbItemDetails,
  TMDBImage,
  TMDBImages,
  TMDBEpisodeImages,
} from "@/lib/tmdb-client";

const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";

/** In-memory cache keyed by endpoint URL to avoid redundant fetches. */
const cache = new Map<string, unknown>();

/**
 * Fetches a TMDB endpoint with api_key query param (CORS-safe).
 * Results are cached in-memory for the Storybook session.
 */
async function tmdbFetch<T>(path: string): Promise<T | null> {
  const apiKey = process.env.STORYBOOK_TMDB_API_KEY;
  if (!apiKey) return null;

  const url = `${TMDB_BASE}${path}?api_key=${apiKey}`;
  if (cache.has(url)) return cache.get(url) as T;

  const res = await fetch(url);
  if (!res.ok) return null;

  const data = (await res.json()) as T;
  cache.set(url, data);
  return data;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Response types (mirrors private types from lib/tmdb-client.ts)
// ═══════════════════════════════════════════════════════════════════════════════

interface CreditsResponse {
  cast?: {
    id: number;
    name: string;
    character: string;
    profile_path: string | null;
    order: number;
  }[];
}

interface WatchProvidersResponse {
  results?: {
    US?: {
      flatrate?: {
        provider_id: number;
        provider_name: string;
        logo_path: string;
      }[];
    };
  };
}

interface VideosResponse {
  results?: {
    id: string;
    key: string;
    name: string;
    type: string;
    site: string;
  }[];
}

interface RecommendationsResponse {
  results?: {
    id: number;
    title?: string;
    name?: string;
    poster_path: string | null;
    backdrop_path: string | null;
    media_type: string;
  }[];
}

interface ImagesResponse {
  posters?: TMDBImage[];
  backdrops?: TMDBImage[];
}

interface EpisodeImagesResponse {
  stills?: TMDBImage[];
}

interface MovieDetailsResponse {
  overview?: string;
}

interface TvDetailsResponse {
  overview?: string;
}

/**
 * Fetches extended TMDB details (cast, providers, videos, recommendations).
 * Mirrors the transformation logic from lib/tmdb-client.ts getItemTmdbDetails().
 *
 * @param tmdbId - TMDB movie or TV show ID
 * @param mediaType - "movie" or "tv"
 * @returns Combined details or null if TMDB is not configured
 */
export async function fetchTmdbDetails(
  tmdbId: number,
  mediaType: "movie" | "tv"
): Promise<TmdbItemDetails | null> {
  const prefix = mediaType === "movie" ? "movie" : "tv";

  const [credits, watchProviders, videos, recommendations] = await Promise.all([
    tmdbFetch<CreditsResponse>(`/${prefix}/${tmdbId}/credits`),
    tmdbFetch<WatchProvidersResponse>(`/${prefix}/${tmdbId}/watch/providers`),
    tmdbFetch<VideosResponse>(`/${prefix}/${tmdbId}/videos`),
    tmdbFetch<RecommendationsResponse>(`/${prefix}/${tmdbId}/recommendations`),
  ]);

  return {
    cast: (credits?.cast ?? [])
      .sort((a, b) => a.order - b.order)
      .slice(0, 10)
      .map(
        (c): CastMember => ({
          id: c.id,
          name: c.name,
          character: c.character,
          profilePath: c.profile_path,
        })
      ),
    providers: (watchProviders?.results?.US?.flatrate ?? []).map(
      (p): WatchProvider => ({
        providerId: p.provider_id,
        providerName: p.provider_name,
        logoPath: `${TMDB_IMAGE_BASE}/w92${p.logo_path}`,
      })
    ),
    videos: (videos?.results ?? [])
      .filter((v) => v.site === "YouTube")
      .slice(0, 4)
      .map(
        (v): Video => ({
          id: v.id,
          key: v.key,
          name: v.name,
          type: v.type,
          site: v.site,
        })
      ),
    recommendations: (recommendations?.results ?? [])
      .filter((r) => r.media_type === "movie" || r.media_type === "tv")
      .slice(0, 6)
      .map(
        (r): Recommendation => ({
          id: r.id,
          title: r.title || r.name || "Unknown",
          posterPath: r.poster_path,
          backdropPath: r.backdrop_path,
          mediaType: r.media_type as "movie" | "tv",
        })
      ),
  };
}

/**
 * Fetches the overview text for a movie or TV show.
 *
 * @param tmdbId - TMDB movie or TV show ID
 * @param mediaType - "movie" or "tv"
 * @returns Overview string or empty string
 */
export async function fetchTmdbOverview(
  tmdbId: number,
  mediaType: "movie" | "tv"
): Promise<string> {
  const prefix = mediaType === "movie" ? "movie" : "tv";
  const data = await tmdbFetch<MovieDetailsResponse | TvDetailsResponse>(
    `/${prefix}/${tmdbId}`
  );
  return data?.overview ?? "";
}

/**
 * Fetches poster and backdrop images for a movie or TV show.
 *
 * @param tmdbId - TMDB movie or TV show ID
 * @param mediaType - "movie" or "tv"
 * @returns Images object with posters and backdrops arrays
 */
export async function fetchTmdbImages(
  tmdbId: number,
  mediaType: "movie" | "tv"
): Promise<TMDBImages> {
  const prefix = mediaType === "movie" ? "movie" : "tv";
  const data = await tmdbFetch<ImagesResponse>(`/${prefix}/${tmdbId}/images`);
  return {
    posters: data?.posters ?? [],
    backdrops: data?.backdrops ?? [],
  };
}

/**
 * Fetches episode still images for a TV episode.
 *
 * @param tvId - TMDB TV show ID
 * @param season - Season number
 * @param episode - Episode number
 * @returns Episode images object with stills array
 */
export async function fetchEpisodeStills(
  tvId: number,
  season: number,
  episode: number
): Promise<TMDBEpisodeImages> {
  const data = await tmdbFetch<EpisodeImagesResponse>(
    `/tv/${tvId}/season/${season}/episode/${episode}/images`
  );
  return {
    stills: data?.stills ?? [],
  };
}
