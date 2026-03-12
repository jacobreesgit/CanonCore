import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { rateLimit } from "../middleware/rate-limit";
import {
  clearTmdbFieldSchema,
  tmdbDisplayOptionsSchema,
} from "@canoncore/validators";

// ═══════════════════════════════════════════════════════════════════════════════
// TMDB API Client (embedded — shared by web + mobile)
// ═══════════════════════════════════════════════════════════════════════════════

const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";
const TMDB_TIMEOUT_MS = 10000;

/** Pattern for valid TMDB image paths (e.g., /abc123XYZ.jpg) */
const VALID_IMAGE_PATH_PATTERN = /^\/[a-zA-Z0-9]+\.(jpg|png)$/;

function isValidImagePath(imagePath: string | null): boolean {
  if (!imagePath) return false;
  return VALID_IMAGE_PATH_PATTERN.test(imagePath);
}

function getApiKey(): string | null {
  return process.env.TMDB_API_KEY || null;
}

function isTMDBConfigured(): boolean {
  return !!getApiKey();
}

function getPosterUrl(
  posterPath: string | null,
  size = "w500"
): string | null {
  if (!posterPath || !isValidImagePath(posterPath)) return null;
  return `${TMDB_IMAGE_BASE}/${size}${posterPath}`;
}

function getBackdropUrl(
  backdropPath: string | null,
  size: string = "original"
): string | null {
  if (!backdropPath || !isValidImagePath(backdropPath)) return null;
  return `${TMDB_IMAGE_BASE}/${size}${backdropPath}`;
}

function getStillUrl(
  stillPath: string | null,
  size: string = "w300"
): string | null {
  if (!stillPath || !isValidImagePath(stillPath)) return null;
  return `${TMDB_IMAGE_BASE}/${size}${stillPath}`;
}

function extractYear(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  return dateStr.split("-")[0] || "";
}

function truncateOverview(text: string, maxLength = 1000): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}

// ═══════════════════════════════════════════════════════════════════════════════
// TMDB API Types
// ═══════════════════════════════════════════════════════════════════════════════

interface TMDBMovie {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  tagline: string;
  runtime: number | null;
  vote_average: number;
  vote_count: number;
  genres: { id: number; name: string }[];
}

interface TMDBTVShow {
  id: number;
  name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string;
  number_of_seasons: number;
  tagline: string;
  vote_average: number;
  vote_count: number;
  genres: { id: number; name: string }[];
}

export interface TMDBEpisode {
  id: number;
  episode_number: number;
  name: string;
  overview?: string;
  still_path?: string | null;
}

export interface TMDBSeasonSummary {
  id: number;
  season_number: number;
  name: string;
  overview: string;
  poster_path: string | null;
  episode_count: number;
  air_date: string | null;
}

interface TMDBSeasonDetail {
  id: number;
  season_number: number;
  name: string;
  overview: string;
  poster_path: string | null;
  air_date: string | null;
  episodes: TMDBEpisode[];
}

interface TMDBEpisodeDetails {
  id: number;
  episode_number: number;
  season_number: number;
  name: string;
  overview: string;
  still_path: string | null;
  air_date: string | null;
  runtime: number | null;
  vote_average: number;
}

export interface TMDBSearchResult {
  id: number;
  mediaType: "movie" | "tv";
  title: string;
  overview: string;
  posterPath: string | null;
  backdropPath: string | null;
  year: string;
}

interface TMDBImage {
  file_path: string;
  vote_average: number;
  iso_639_1: string | null;
  width: number;
  height: number;
}

export interface TMDBImages {
  backdrops: TMDBImage[];
  posters: TMDBImage[];
  logos?: TMDBImage[];
}

export interface TMDBSeasonImages {
  posters: TMDBImage[];
}

export interface TMDBEpisodeImages {
  stills: TMDBImage[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// TMDB Fetch Helpers
// ═══════════════════════════════════════════════════════════════════════════════

async function tmdbFetch<T>(endpoint: string): Promise<T | null> {
  const apiKey = getApiKey();
  if (!apiKey) return null;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TMDB_TIMEOUT_MS);

  const separator = endpoint.includes("?") ? "&" : "?";
  const url = `${TMDB_BASE_URL}${endpoint}${separator}api_key=${apiKey}`;

  try {
    const response = await fetch(url, {
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
    });

    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function getMovie(movieId: number): Promise<TMDBMovie | null> {
  return tmdbFetch<TMDBMovie>(`/movie/${movieId}`);
}

async function getTVShow(tvId: number): Promise<TMDBTVShow | null> {
  return tmdbFetch<TMDBTVShow>(`/tv/${tvId}`);
}

async function searchMedia(query: string): Promise<TMDBSearchResult[]> {
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

async function getMovieImages(movieId: number): Promise<TMDBImages | null> {
  const data = await tmdbFetch<TMDBImages>(`/movie/${movieId}/images`);
  if (!data) return null;
  return {
    backdrops: (data.backdrops || [])
      .filter((img) => isValidImagePath(img.file_path))
      .sort((a, b) => b.vote_average - a.vote_average),
    posters: (data.posters || [])
      .filter((img) => isValidImagePath(img.file_path))
      .sort((a, b) => b.vote_average - a.vote_average),
    logos: (data.logos || [])
      .filter((img) => isValidImagePath(img.file_path))
      .sort((a, b) => b.vote_average - a.vote_average),
  };
}

async function getTVShowImages(tvId: number): Promise<TMDBImages | null> {
  const data = await tmdbFetch<TMDBImages>(`/tv/${tvId}/images`);
  if (!data) return null;
  return {
    backdrops: (data.backdrops || [])
      .filter((img) => isValidImagePath(img.file_path))
      .sort((a, b) => b.vote_average - a.vote_average),
    posters: (data.posters || [])
      .filter((img) => isValidImagePath(img.file_path))
      .sort((a, b) => b.vote_average - a.vote_average),
    logos: (data.logos || [])
      .filter((img) => isValidImagePath(img.file_path))
      .sort((a, b) => b.vote_average - a.vote_average),
  };
}

function getBestLogo(images: TMDBImages): string | null {
  if (!images.logos?.length) return null;
  const valid = images.logos.filter((img) => isValidImagePath(img.file_path));
  if (!valid.length) return null;
  const scored = valid.map((img) => ({
    path: img.file_path,
    score: (img.iso_639_1 === "en" ? 500 : 0) + img.vote_average,
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored[0].path;
}

async function getTVSeasons(
  tvId: number
): Promise<TMDBSeasonSummary[] | null> {
  const data = await tmdbFetch<{ seasons?: TMDBSeasonSummary[] }>(`/tv/${tvId}`);
  if (!data?.seasons) return null;
  return data.seasons.sort((a, b) => a.season_number - b.season_number);
}

async function getTVSeason(
  tvId: number,
  seasonNumber: number
): Promise<{ id: number; season_number: number; episodes: TMDBEpisode[] } | null> {
  return tmdbFetch(`/tv/${tvId}/season/${seasonNumber}`);
}

async function getTVEpisodes(
  tvId: number,
  seasonNumber: number
): Promise<TMDBEpisode[] | null> {
  const season = await getTVSeason(tvId, seasonNumber);
  if (!season?.episodes) return null;
  return season.episodes.sort((a, b) => a.episode_number - b.episode_number);
}

async function getEpisodeDetails(
  tvId: number,
  seasonNumber: number,
  episodeNumber: number
): Promise<TMDBEpisodeDetails | null> {
  return tmdbFetch<TMDBEpisodeDetails>(
    `/tv/${tvId}/season/${seasonNumber}/episode/${episodeNumber}`
  );
}

async function getSeasonDetails(
  tvId: number,
  seasonNumber: number
): Promise<TMDBSeasonDetail | null> {
  return tmdbFetch<TMDBSeasonDetail>(`/tv/${tvId}/season/${seasonNumber}`);
}

async function getTVSeasonImages(
  tvId: number,
  seasonNumber: number
): Promise<TMDBSeasonImages | null> {
  const data = await tmdbFetch<{ posters?: TMDBImage[] }>(
    `/tv/${tvId}/season/${seasonNumber}/images`
  );
  if (!data) return null;
  return {
    posters: (data.posters || [])
      .filter((img) => isValidImagePath(img.file_path))
      .sort((a, b) => b.vote_average - a.vote_average),
  };
}

async function getEpisodeImages(
  tvId: number,
  seasonNumber: number,
  episodeNumber: number
): Promise<TMDBEpisodeImages | null> {
  const data = await tmdbFetch<{ stills?: TMDBImage[] }>(
    `/tv/${tvId}/season/${seasonNumber}/episode/${episodeNumber}/images`
  );
  if (!data) return null;
  return {
    stills: (data.stills || [])
      .filter((img) => isValidImagePath(img.file_path))
      .sort((a, b) => b.vote_average - a.vote_average),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Shared Input Schemas
// ═══════════════════════════════════════════════════════════════════════════════

const mediaTypeSchema = z.enum(["movie", "tv"]);

// ═══════════════════════════════════════════════════════════════════════════════
// Router
// ═══════════════════════════════════════════════════════════════════════════════

export const tmdbRouter = createTRPCRouter({
  /**
   * Checks if TMDB API is configured and available.
   * No rate limiting — lightweight config check.
   */
  isTMDBAvailable: protectedProcedure.query(() => {
    return { available: isTMDBConfigured() };
  }),

  /**
   * Searches TMDB for movies and TV shows.
   */
  search: protectedProcedure
    .use(rateLimit("tmdbSearch"))
    .input(z.object({ query: z.string().min(1).max(200) }))
    .mutation(async ({ input }) => {
      if (!isTMDBConfigured()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "TMDB integration not configured",
        });
      }

      const results = await searchMedia(input.query);
      return results;
    }),

  /**
   * Fetches TMDB metadata preview for confirmation dialog.
   * Returns formatted name, description, and image URLs without modifying data.
   */
  getPreview: protectedProcedure
    .use(rateLimit("tmdbPreview"))
    .input(
      z.object({
        tmdbId: z.number().int().positive(),
        mediaType: mediaTypeSchema,
      })
    )
    .mutation(async ({ input }) => {
      if (!isTMDBConfigured()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "TMDB integration not configured",
        });
      }

      let name: string;
      let description: string;
      let posterPath: string | null;
      let backdropPath: string | null;

      if (input.mediaType === "movie") {
        const movie = await getMovie(input.tmdbId);
        if (!movie) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Movie not found on TMDB",
          });
        }
        const year = extractYear(movie.release_date);
        name = year ? `${movie.title} (${year})` : movie.title;
        description = truncateOverview(movie.overview);
        posterPath = movie.poster_path;
        backdropPath = movie.backdrop_path;
      } else {
        const show = await getTVShow(input.tmdbId);
        if (!show) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "TV show not found on TMDB",
          });
        }
        const year = extractYear(show.first_air_date);
        name = year ? `${show.name} (${year})` : show.name;
        description = truncateOverview(show.overview);
        posterPath = show.poster_path;
        backdropPath = show.backdrop_path;
      }

      return {
        name,
        description,
        posterUrl: getPosterUrl(posterPath, "w342"),
        backdropUrl: getBackdropUrl(backdropPath, "w780"),
        posterPath,
        backdropPath,
      };
    }),

  /**
   * Fetches all available images for a movie or TV show.
   * Returns posters, backdrops, and logos sorted by vote average.
   */
  getImages: protectedProcedure
    .use(rateLimit("tmdbImages"))
    .input(
      z.object({
        tmdbId: z.number().int().positive(),
        mediaType: mediaTypeSchema,
      })
    )
    .mutation(async ({ input }) => {
      if (!isTMDBConfigured()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "TMDB integration not configured",
        });
      }

      const images =
        input.mediaType === "movie"
          ? await getMovieImages(input.tmdbId)
          : await getTVShowImages(input.tmdbId);

      if (!images) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Images not found",
        });
      }

      return images;
    }),

  /**
   * Applies TMDB metadata to an existing item.
   * Selectively updates name, description, poster, backdrop, logo based on options.
   */
  applyMetadata: protectedProcedure
    .use(rateLimit("itemUpdate"))
    .input(
      z.object({
        itemId: z.string().min(1),
        tmdbId: z.number().int().positive(),
        mediaType: mediaTypeSchema,
        options: z
          .object({
            updateName: z.boolean().default(true),
            updateDescription: z.boolean().default(true),
            updatePoster: z.boolean().default(true),
            updateBackdrop: z.boolean().default(true),
            updateLogo: z.boolean().default(true),
            posterPath: z.string().nullable().default(null),
            backdropPath: z.string().nullable().default(null),
            logoPath: z.string().nullable().default(null),
          })
          .default({
            updateName: true,
            updateDescription: true,
            updatePoster: true,
            updateBackdrop: true,
            updateLogo: true,
            posterPath: null,
            backdropPath: null,
            logoPath: null,
          }),
        displayOptions: tmdbDisplayOptionsSchema.optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify item ownership
      const item = await ctx.prisma.item.findUnique({
        where: { id: input.itemId },
        select: { userId: true },
      });

      if (!item) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Item not found" });
      }
      if (item.userId !== ctx.userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }

      // Fetch metadata from TMDB
      let name: string;
      let description: string;
      let posterPath: string | null;
      let backdropPath: string | null;

      if (input.mediaType === "movie") {
        const movie = await getMovie(input.tmdbId);
        if (!movie) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Movie not found on TMDB",
          });
        }
        const year = extractYear(movie.release_date);
        name = year ? `${movie.title} (${year})` : movie.title;
        description = truncateOverview(movie.overview);
        posterPath = movie.poster_path;
        backdropPath = movie.backdrop_path;
      } else {
        const show = await getTVShow(input.tmdbId);
        if (!show) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "TV show not found on TMDB",
          });
        }
        const year = extractYear(show.first_air_date);
        name = year ? `${show.name} (${year})` : show.name;
        description = truncateOverview(show.overview);
        posterPath = show.poster_path;
        backdropPath = show.backdrop_path;
      }

      const opts = input.options;

      // Build update data — always persist tmdbId/tmdbType
      const updateData: Record<string, unknown> = {
        tmdbId: input.tmdbId,
        tmdbType: input.mediaType,
      };

      if (opts.updateName) {
        updateData.name = name;
      }
      if (opts.updateDescription) {
        updateData.description = description || null;
      }
      if (opts.updatePoster) {
        updateData.tmdbPosterPath = opts.posterPath ?? posterPath;
      }
      if (opts.updateBackdrop) {
        updateData.tmdbBackdropPath = opts.backdropPath ?? backdropPath;
      }

      // Fetch images for logo selection
      const images = await (input.mediaType === "movie"
        ? getMovieImages(input.tmdbId)
        : getTVShowImages(input.tmdbId)
      ).catch(() => null);

      // Logo: wizard-selected path takes precedence, otherwise auto-select best
      if (opts.updateLogo !== false) {
        if (opts.logoPath) {
          updateData.tmdbLogoPath = opts.logoPath;
        } else if (images) {
          const logoPath = getBestLogo(images);
          if (logoPath) {
            updateData.tmdbLogoPath = logoPath;
          }
        }
      }

      // Persist display preferences if provided
      if (input.displayOptions) {
        updateData.tmdbShowTagline = input.displayOptions.showTagline;
        updateData.tmdbShowMetadata = input.displayOptions.showMetadata;
        updateData.tmdbShowGenres = input.displayOptions.showGenres;
        updateData.tmdbShowCast = input.displayOptions.showCast;
        updateData.tmdbShowProviders = input.displayOptions.showProviders;
        updateData.tmdbShowVideos = input.displayOptions.showVideos;
        updateData.tmdbShowRecommendations =
          input.displayOptions.showRecommendations;
      }

      await ctx.prisma.item.update({
        where: { id: input.itemId },
        data: updateData,
      });

      return { success: true };
    }),

  /**
   * Clears individual TMDB fields or fully detaches TMDB metadata from an item.
   */
  clearField: protectedProcedure
    .use(rateLimit("itemUpdate"))
    .input(clearTmdbFieldSchema)
    .mutation(async ({ ctx, input }) => {
      const item = await ctx.prisma.item.findUnique({
        where: { id: input.itemId },
        select: { userId: true },
      });

      if (!item) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Item not found" });
      }
      if (item.userId !== ctx.userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }

      const data =
        input.field === "all"
          ? {
              tmdbId: null,
              tmdbType: null,
              tmdbPosterPath: null,
              tmdbBackdropPath: null,
              tmdbLogoPath: null,
              dominantColour: null,
              tmdbShowTagline: true,
              tmdbShowMetadata: true,
              tmdbShowGenres: true,
              tmdbShowCast: true,
              tmdbShowProviders: true,
              tmdbShowVideos: true,
              tmdbShowRecommendations: true,
            }
          : input.field === "poster"
            ? { tmdbPosterPath: null }
            : input.field === "backdrop"
              ? { tmdbBackdropPath: null, dominantColour: null }
              : { tmdbLogoPath: null };

      await ctx.prisma.item.update({
        where: { id: input.itemId },
        data,
      });

      return { success: true };
    }),

  /**
   * Clears all TMDB metadata from an item.
   * Convenience alias that calls clearField with field="all".
   */
  clearAll: protectedProcedure
    .use(rateLimit("itemUpdate"))
    .input(z.object({ itemId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const item = await ctx.prisma.item.findUnique({
        where: { id: input.itemId },
        select: { userId: true },
      });

      if (!item) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Item not found" });
      }
      if (item.userId !== ctx.userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }

      await ctx.prisma.item.update({
        where: { id: input.itemId },
        data: {
          tmdbId: null,
          tmdbType: null,
          tmdbPosterPath: null,
          tmdbBackdropPath: null,
          tmdbLogoPath: null,
          dominantColour: null,
          tmdbShowTagline: true,
          tmdbShowMetadata: true,
          tmdbShowGenres: true,
          tmdbShowCast: true,
          tmdbShowProviders: true,
          tmdbShowVideos: true,
          tmdbShowRecommendations: true,
        },
      });

      return { success: true };
    }),

  /**
   * Updates TMDB display options for an item.
   * Only modifies the 7 boolean display preference fields.
   */
  updateDisplayOptions: protectedProcedure
    .use(rateLimit("itemUpdate"))
    .input(
      z.object({
        itemId: z.string().min(1),
        displayOptions: tmdbDisplayOptionsSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const item = await ctx.prisma.item.findUnique({
        where: { id: input.itemId },
        select: { userId: true, tmdbId: true },
      });

      if (!item) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Item not found" });
      }
      if (item.userId !== ctx.userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }
      if (!item.tmdbId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Item has no TMDB metadata",
        });
      }

      await ctx.prisma.item.update({
        where: { id: input.itemId },
        data: {
          tmdbShowTagline: input.displayOptions.showTagline,
          tmdbShowMetadata: input.displayOptions.showMetadata,
          tmdbShowGenres: input.displayOptions.showGenres,
          tmdbShowCast: input.displayOptions.showCast,
          tmdbShowProviders: input.displayOptions.showProviders,
          tmdbShowVideos: input.displayOptions.showVideos,
          tmdbShowRecommendations: input.displayOptions.showRecommendations,
        },
      });

      return { success: true };
    }),

  /**
   * Fetches all seasons for a TV show.
   */
  getSeasons: protectedProcedure
    .use(rateLimit("tmdbPreview"))
    .input(z.object({ tmdbId: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      if (!isTMDBConfigured()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "TMDB integration not configured",
        });
      }

      const seasons = await getTVSeasons(input.tmdbId);
      if (!seasons) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Seasons not found",
        });
      }

      return seasons;
    }),

  /**
   * Fetches all episodes for a specific season.
   */
  getEpisodes: protectedProcedure
    .use(rateLimit("tmdbPreview"))
    .input(
      z.object({
        tmdbId: z.number().int().positive(),
        seasonNumber: z.number().int().min(0),
      })
    )
    .mutation(async ({ input }) => {
      if (!isTMDBConfigured()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "TMDB integration not configured",
        });
      }

      const episodes = await getTVEpisodes(input.tmdbId, input.seasonNumber);
      if (!episodes) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Episodes not found",
        });
      }

      return episodes;
    }),

  /**
   * Fetches episode metadata preview for confirmation dialog.
   */
  getEpisodePreview: protectedProcedure
    .use(rateLimit("tmdbPreview"))
    .input(
      z.object({
        tmdbId: z.number().int().positive(),
        seasonNumber: z.number().int().min(0),
        episodeNumber: z.number().int().positive(),
      })
    )
    .mutation(async ({ input }) => {
      if (!isTMDBConfigured()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "TMDB integration not configured",
        });
      }

      const episode = await getEpisodeDetails(
        input.tmdbId,
        input.seasonNumber,
        input.episodeNumber
      );

      if (!episode) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Episode not found on TMDB",
        });
      }

      const seasonStr = String(input.seasonNumber).padStart(2, "0");
      const episodeStr = String(input.episodeNumber).padStart(2, "0");
      const name = `S${seasonStr}E${episodeStr} - ${episode.name}`;

      return {
        name,
        description: truncateOverview(episode.overview || ""),
        stillUrl: getStillUrl(episode.still_path, "w780"),
        stillPath: episode.still_path,
        seasonNumber: input.seasonNumber,
        episodeNumber: input.episodeNumber,
      };
    }),

  /**
   * Fetches season metadata for the wizard.
   */
  getSeasonMetadata: protectedProcedure
    .use(rateLimit("tmdbPreview"))
    .input(
      z.object({
        tmdbId: z.number().int().positive(),
        seasonNumber: z.number().int().min(0),
      })
    )
    .mutation(async ({ input }) => {
      if (!isTMDBConfigured()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "TMDB integration not configured",
        });
      }

      const season = await getSeasonDetails(input.tmdbId, input.seasonNumber);
      if (!season) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Season not found on TMDB",
        });
      }

      return {
        name: season.name,
        description: truncateOverview(season.overview || ""),
        posterUrl: getPosterUrl(season.poster_path, "w342"),
        posterPath: season.poster_path,
        seasonNumber: season.season_number,
        airDate: season.air_date,
      };
    }),

  /**
   * Fetches season metadata AND images in parallel.
   * Avoids waterfall requests when both are needed.
   */
  getSeasonData: protectedProcedure
    .use(rateLimit("tmdbPreview"))
    .input(
      z.object({
        tmdbId: z.number().int().positive(),
        seasonNumber: z.number().int().min(0),
      })
    )
    .mutation(async ({ input }) => {
      if (!isTMDBConfigured()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "TMDB integration not configured",
        });
      }

      const [season, images] = await Promise.all([
        getSeasonDetails(input.tmdbId, input.seasonNumber),
        getTVSeasonImages(input.tmdbId, input.seasonNumber),
      ]);

      if (!season) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Season not found on TMDB",
        });
      }

      return {
        metadata: {
          name: season.name,
          description: truncateOverview(season.overview || ""),
          posterUrl: getPosterUrl(season.poster_path, "w342"),
          posterPath: season.poster_path,
          seasonNumber: season.season_number,
          airDate: season.air_date,
        },
        images: images || { posters: [] },
      };
    }),

  /**
   * Fetches all available images for a TV season.
   */
  getSeasonImages: protectedProcedure
    .use(rateLimit("tmdbImages"))
    .input(
      z.object({
        tmdbId: z.number().int().positive(),
        seasonNumber: z.number().int().min(0),
      })
    )
    .mutation(async ({ input }) => {
      if (!isTMDBConfigured()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "TMDB integration not configured",
        });
      }

      const images = await getTVSeasonImages(input.tmdbId, input.seasonNumber);
      if (!images) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Season images not found",
        });
      }

      return images;
    }),

  /**
   * Fetches all available still images for a TV episode.
   */
  getEpisodeImages: protectedProcedure
    .use(rateLimit("tmdbImages"))
    .input(
      z.object({
        tmdbId: z.number().int().positive(),
        seasonNumber: z.number().int().min(0),
        episodeNumber: z.number().int().positive(),
      })
    )
    .mutation(async ({ input }) => {
      if (!isTMDBConfigured()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "TMDB integration not configured",
        });
      }

      const images = await getEpisodeImages(
        input.tmdbId,
        input.seasonNumber,
        input.episodeNumber
      );

      if (!images) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Episode images not found",
        });
      }

      return images;
    }),
});
