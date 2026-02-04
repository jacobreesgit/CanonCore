/**
 * TMDB API utilities for Apple TV+ redesign demo.
 * Fetches extended movie/TV data including cast, recommendations, and watch providers.
 */

import { getBackdropUrl, getPosterUrl, extractYear } from "@/lib/tmdb-client";

const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";

/** Hardcoded TMDB IDs for consistent demo content. */
export const DEMO_TMDB_IDS = {
  /** Main movie demo - Dune: Part Two */
  movie: 693134,
  /** Main TV demo - Severance */
  tvShow: 95396,
  /** Explore carousel featured items */
  featured: [693134, 872585, 792307, 466420, 346698],
  /** Library grid items (movies) */
  libraryMovies: [840430, 666277, 467244, 829557, 915935, 1011985],
  /** Library grid items (TV shows) */
  libraryTvShows: [136315, 126308, 106379, 108545, 224458],
};

/** Cast member from TMDB credits. */
export interface DemoCastMember {
  id: number;
  name: string;
  character: string;
  profilePath: string | null;
}

/** Crew member from TMDB credits. */
export interface DemoCrewMember {
  id: number;
  name: string;
  job: string;
  profilePath: string | null;
}

/** Watch provider from TMDB. */
export interface DemoWatchProvider {
  providerId: number;
  providerName: string;
  logoPath: string;
}

/** Video from TMDB (trailers, teasers). */
export interface DemoVideo {
  id: string;
  key: string;
  name: string;
  type: string;
  site: string;
}

/** Recommendation from TMDB. */
export interface DemoRecommendation {
  id: number;
  title: string;
  posterPath: string | null;
  backdropPath: string | null;
  mediaType: "movie" | "tv";
}

/** Full movie details for demo. */
export interface DemoMovieDetails {
  id: number;
  title: string;
  tagline: string;
  overview: string;
  releaseDate: string;
  year: string;
  runtime: number;
  voteAverage: number;
  genres: string[];
  contentRating: string;
  backdropUrl: string | null;
  posterUrl: string | null;
  cast: DemoCastMember[];
  crew: DemoCrewMember[];
  watchProviders: DemoWatchProvider[];
  videos: DemoVideo[];
  recommendations: DemoRecommendation[];
}

/** Full TV show details for demo. */
export interface DemoTvShowDetails {
  id: number;
  name: string;
  tagline: string;
  overview: string;
  firstAirDate: string;
  year: string;
  voteAverage: number;
  genres: string[];
  contentRating: string;
  backdropUrl: string | null;
  posterUrl: string | null;
  numberOfSeasons: number;
  seasons: DemoSeason[];
  cast: DemoCastMember[];
  crew: DemoCrewMember[];
  watchProviders: DemoWatchProvider[];
  videos: DemoVideo[];
  recommendations: DemoRecommendation[];
}

/** Season summary for demo. */
export interface DemoSeason {
  id: number;
  seasonNumber: number;
  name: string;
  overview: string;
  posterPath: string | null;
  episodeCount: number;
  airDate: string | null;
}

/** Grid item for explore/library pages. */
export interface DemoGridItem {
  id: number;
  title: string;
  overview: string;
  posterUrl: string | null;
  backdropUrl: string | null;
  year: string;
  mediaType: "movie" | "tv";
  /** Mock data for demo */
  progress?: number;
  owner?: { name: string; username: string };
}

/**
 * Fetches data from TMDB API.
 *
 * @param endpoint - API endpoint
 * @returns Response data or null on error
 */
async function tmdbFetch<T>(endpoint: string): Promise<T | null> {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    console.warn("TMDB_API_KEY not configured");
    return null;
  }

  const separator = endpoint.includes("?") ? "&" : "?";
  const url = `${TMDB_BASE_URL}${endpoint}${separator}api_key=${apiKey}`;

  try {
    const response = await fetch(url, { next: { revalidate: 3600 } });
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

/**
 * Fetches full movie details with credits, recommendations, watch providers, and videos.
 *
 * @param movieId - TMDB movie ID
 * @returns Full movie details or null on error
 */
export async function getDemoMovie(
  movieId: number = DEMO_TMDB_IDS.movie
): Promise<DemoMovieDetails | null> {
  const [
    details,
    credits,
    recommendations,
    watchProviders,
    videos,
    releaseDates,
  ] = await Promise.all([
    tmdbFetch<{
      id: number;
      title: string;
      tagline: string;
      overview: string;
      release_date: string;
      runtime: number;
      vote_average: number;
      genres: { id: number; name: string }[];
      backdrop_path: string | null;
      poster_path: string | null;
    }>(`/movie/${movieId}`),
    tmdbFetch<{
      cast: {
        id: number;
        name: string;
        character: string;
        profile_path: string | null;
      }[];
      crew: {
        id: number;
        name: string;
        job: string;
        profile_path: string | null;
      }[];
    }>(`/movie/${movieId}/credits`),
    tmdbFetch<{
      results: {
        id: number;
        title: string;
        poster_path: string | null;
        backdrop_path: string | null;
      }[];
    }>(`/movie/${movieId}/recommendations`),
    tmdbFetch<{
      results: {
        US?: {
          flatrate?: {
            provider_id: number;
            provider_name: string;
            logo_path: string;
          }[];
        };
      };
    }>(`/movie/${movieId}/watch/providers`),
    tmdbFetch<{
      results: {
        id: string;
        key: string;
        name: string;
        type: string;
        site: string;
      }[];
    }>(`/movie/${movieId}/videos`),
    tmdbFetch<{
      results: {
        iso_3166_1: string;
        release_dates: { certification: string }[];
      }[];
    }>(`/movie/${movieId}/release_dates`),
  ]);

  if (!details) return null;

  // Extract US content rating
  const usRelease = releaseDates?.results?.find((r) => r.iso_3166_1 === "US");
  const contentRating =
    usRelease?.release_dates?.find((rd) => rd.certification)?.certification ||
    "NR";

  return {
    id: details.id,
    title: details.title,
    tagline: details.tagline || "",
    overview: details.overview,
    releaseDate: details.release_date,
    year: extractYear(details.release_date),
    runtime: details.runtime,
    voteAverage: details.vote_average,
    genres: details.genres.map((g) => g.name),
    contentRating,
    backdropUrl: getBackdropUrl(details.backdrop_path),
    posterUrl: getPosterUrl(details.poster_path),
    cast: (credits?.cast || []).slice(0, 10).map((c) => ({
      id: c.id,
      name: c.name,
      character: c.character,
      profilePath: c.profile_path,
    })),
    crew: (credits?.crew || [])
      .filter((c) => ["Director", "Writer", "Screenplay"].includes(c.job))
      .slice(0, 5)
      .map((c) => ({
        id: c.id,
        name: c.name,
        job: c.job,
        profilePath: c.profile_path,
      })),
    watchProviders: (watchProviders?.results?.US?.flatrate || []).map((p) => ({
      providerId: p.provider_id,
      providerName: p.provider_name,
      logoPath: `${TMDB_IMAGE_BASE}/w92${p.logo_path}`,
    })),
    videos: (videos?.results || [])
      .filter((v) => v.site === "YouTube")
      .slice(0, 4)
      .map((v) => ({
        id: v.id,
        key: v.key,
        name: v.name,
        type: v.type,
        site: v.site,
      })),
    recommendations: (recommendations?.results || []).slice(0, 6).map((r) => ({
      id: r.id,
      title: r.title,
      posterPath: r.poster_path,
      backdropPath: r.backdrop_path,
      mediaType: "movie" as const,
    })),
  };
}

/**
 * Fetches full TV show details with credits, seasons, recommendations, and videos.
 *
 * @param tvId - TMDB TV show ID
 * @returns Full TV show details or null on error
 */
export async function getDemoTvShow(
  tvId: number = DEMO_TMDB_IDS.tvShow
): Promise<DemoTvShowDetails | null> {
  const [
    details,
    credits,
    recommendations,
    watchProviders,
    videos,
    contentRatings,
  ] = await Promise.all([
    tmdbFetch<{
      id: number;
      name: string;
      tagline: string;
      overview: string;
      first_air_date: string;
      vote_average: number;
      genres: { id: number; name: string }[];
      backdrop_path: string | null;
      poster_path: string | null;
      number_of_seasons: number;
      seasons: {
        id: number;
        season_number: number;
        name: string;
        overview: string;
        poster_path: string | null;
        episode_count: number;
        air_date: string | null;
      }[];
    }>(`/tv/${tvId}`),
    tmdbFetch<{
      cast: {
        id: number;
        name: string;
        character: string;
        profile_path: string | null;
      }[];
      crew: {
        id: number;
        name: string;
        job: string;
        profile_path: string | null;
      }[];
    }>(`/tv/${tvId}/credits`),
    tmdbFetch<{
      results: {
        id: number;
        name: string;
        poster_path: string | null;
        backdrop_path: string | null;
      }[];
    }>(`/tv/${tvId}/recommendations`),
    tmdbFetch<{
      results: {
        US?: {
          flatrate?: {
            provider_id: number;
            provider_name: string;
            logo_path: string;
          }[];
        };
      };
    }>(`/tv/${tvId}/watch/providers`),
    tmdbFetch<{
      results: {
        id: string;
        key: string;
        name: string;
        type: string;
        site: string;
      }[];
    }>(`/tv/${tvId}/videos`),
    tmdbFetch<{
      results: {
        iso_3166_1: string;
        rating: string;
      }[];
    }>(`/tv/${tvId}/content_ratings`),
  ]);

  if (!details) return null;

  // Extract US content rating
  const usRating = contentRatings?.results?.find((r) => r.iso_3166_1 === "US");
  const contentRating = usRating?.rating || "NR";

  return {
    id: details.id,
    name: details.name,
    tagline: details.tagline || "",
    overview: details.overview,
    firstAirDate: details.first_air_date,
    year: extractYear(details.first_air_date),
    voteAverage: details.vote_average,
    genres: details.genres.map((g) => g.name),
    contentRating,
    backdropUrl: getBackdropUrl(details.backdrop_path),
    posterUrl: getPosterUrl(details.poster_path),
    numberOfSeasons: details.number_of_seasons,
    seasons: (details.seasons || [])
      .filter((s) => s.season_number > 0)
      .map((s) => ({
        id: s.id,
        seasonNumber: s.season_number,
        name: s.name,
        overview: s.overview,
        posterPath: s.poster_path,
        episodeCount: s.episode_count,
        airDate: s.air_date,
      })),
    cast: (credits?.cast || []).slice(0, 10).map((c) => ({
      id: c.id,
      name: c.name,
      character: c.character,
      profilePath: c.profile_path,
    })),
    crew: (credits?.crew || [])
      .filter((c) => ["Creator", "Executive Producer"].includes(c.job))
      .slice(0, 5)
      .map((c) => ({
        id: c.id,
        name: c.name,
        job: c.job,
        profilePath: c.profile_path,
      })),
    watchProviders: (watchProviders?.results?.US?.flatrate || []).map((p) => ({
      providerId: p.provider_id,
      providerName: p.provider_name,
      logoPath: `${TMDB_IMAGE_BASE}/w92${p.logo_path}`,
    })),
    videos: (videos?.results || [])
      .filter((v) => v.site === "YouTube")
      .slice(0, 4)
      .map((v) => ({
        id: v.id,
        key: v.key,
        name: v.name,
        type: v.type,
        site: v.site,
      })),
    recommendations: (recommendations?.results || []).slice(0, 6).map((r) => ({
      id: r.id,
      title: r.name,
      posterPath: r.poster_path,
      backdropPath: r.backdrop_path,
      mediaType: "tv" as const,
    })),
  };
}

/**
 * Fetches multiple movies for grid display.
 *
 * @param movieIds - Array of TMDB movie IDs
 * @returns Array of grid items
 */
export async function getDemoMovieGrid(
  movieIds: number[] = DEMO_TMDB_IDS.libraryMovies
): Promise<DemoGridItem[]> {
  const movies = await Promise.all(
    movieIds.map((id) =>
      tmdbFetch<{
        id: number;
        title: string;
        overview: string;
        poster_path: string | null;
        backdrop_path: string | null;
        release_date: string;
      }>(`/movie/${id}`)
    )
  );

  return movies
    .filter((m): m is NonNullable<typeof m> => m !== null)
    .map((m) => ({
      id: m.id,
      title: m.title,
      overview: m.overview,
      posterUrl: getPosterUrl(m.poster_path),
      backdropUrl: getBackdropUrl(m.backdrop_path),
      year: extractYear(m.release_date),
      mediaType: "movie" as const,
    }));
}

/**
 * Fetches multiple TV shows for grid display.
 *
 * @param tvIds - Array of TMDB TV show IDs
 * @returns Array of grid items
 */
export async function getDemoTvShowGrid(
  tvIds: number[] = DEMO_TMDB_IDS.libraryTvShows
): Promise<DemoGridItem[]> {
  const shows = await Promise.all(
    tvIds.map((id) =>
      tmdbFetch<{
        id: number;
        name: string;
        overview: string;
        poster_path: string | null;
        backdrop_path: string | null;
        first_air_date: string;
      }>(`/tv/${id}`)
    )
  );

  return shows
    .filter((s): s is NonNullable<typeof s> => s !== null)
    .map((s) => ({
      id: s.id,
      title: s.name,
      overview: s.overview,
      posterUrl: getPosterUrl(s.poster_path),
      backdropUrl: getBackdropUrl(s.backdrop_path),
      year: extractYear(s.first_air_date),
      mediaType: "tv" as const,
    }));
}

/**
 * Fetches featured items for explore carousel.
 *
 * @returns Array of grid items with backdrop URLs
 */
export async function getDemoFeaturedItems(): Promise<DemoGridItem[]> {
  return getDemoMovieGrid(DEMO_TMDB_IDS.featured);
}

/**
 * Mock user data for demo profiles.
 */
export const MOCK_USERS = [
  { name: "Film Fan", username: "filmfan" },
  { name: "Movie Buff", username: "moviebuff" },
  { name: "Cine Lover", username: "cinelover" },
  { name: "Screen Sage", username: "screensage" },
];

/**
 * Gets a random mock user.
 *
 * @returns Mock user data
 */
export function getRandomMockUser() {
  return MOCK_USERS[Math.floor(Math.random() * MOCK_USERS.length)];
}

/**
 * Gets a random progress percentage for demo.
 *
 * @returns Progress 0-100
 */
export function getRandomProgress(): number {
  return Math.floor(Math.random() * 100);
}

/**
 * Formats runtime in hours and minutes.
 *
 * @param minutes - Runtime in minutes
 * @returns Formatted string (e.g., "2h 46m")
 */
export function formatRuntime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

/**
 * Gets profile image URL from TMDB path.
 *
 * @param profilePath - TMDB profile path
 * @returns Full image URL or null
 */
export function getProfileImageUrl(profilePath: string | null): string | null {
  if (!profilePath) return null;
  return `${TMDB_IMAGE_BASE}/w185${profilePath}`;
}
