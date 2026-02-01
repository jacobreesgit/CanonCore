/**
 * Server actions for TMDB metadata operations.
 * Handles search and metadata application with rate limiting and circuit breaker protection.
 */

"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { CircuitBreaker } from "@/lib/circuit-breaker";
import { logger } from "@/lib/logger";
import {
  searchMedia,
  getMovie,
  getTVShow,
  getMovieImages,
  getTVShowImages,
  getTVSeasons,
  getTVEpisodes,
  getEpisodeDetails,
  getSeasonDetails,
  getTVSeasonImages,
  getEpisodeImages,
  downloadPoster,
  downloadBackdrop,
  extractYear,
  truncateOverview,
  isTMDBConfigured,
  getPosterUrl,
  getBackdropUrl,
  getStillUrl,
  type TMDBSearchResult,
  type TMDBImages,
  type TMDBSeasonSummary,
  type TMDBSeasonImages,
  type TMDBEpisodeImages,
  type TMDBEpisode,
} from "@/lib/tmdb-client";
import { uploadBuffer } from "@/lib/google-drive-upload";
import { handlePrismaError } from "@/lib/errors";

/**
 * Options for selectively applying TMDB metadata fields.
 */
export interface ApplyMetadataOptions {
  /** Whether to update the item name */
  updateName?: boolean;
  /** Whether to update the item description */
  updateDescription?: boolean;
  /** Whether to download and upload poster as primary artwork */
  updatePoster?: boolean;
  /** Whether to download and upload backdrop as hero image */
  updateBackdrop?: boolean;
}

/** Default options - update all fields */
const DEFAULT_METADATA_OPTIONS: Required<ApplyMetadataOptions> = {
  updateName: true,
  updateDescription: true,
  updatePoster: true,
  updateBackdrop: true,
};

/**
 * Preview data for metadata confirmation dialog.
 */
export interface MetadataPreview {
  /** Formatted name with year */
  name: string;
  /** Truncated overview/description */
  description: string;
  /** Full poster URL for preview thumbnail */
  posterUrl: string | null;
  /** Full backdrop URL for preview thumbnail */
  backdropUrl: string | null;
  /** Raw poster path for download */
  posterPath: string | null;
  /** Raw backdrop path for download */
  backdropPath: string | null;
}

// Circuit breaker for TMDB API calls
const tmdbCircuitBreaker = new CircuitBreaker({
  failureThreshold: 5,
  resetTimeout: 60000, // 1 minute
  name: "tmdb-api",
});

type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

/**
 * Checks if TMDB is configured for the current user.
 *
 * @returns Whether TMDB features are available
 */
export async function isTMDBAvailable(): Promise<boolean> {
  const session = await auth();
  if (!session?.user?.id) return false;
  return isTMDBConfigured();
}

/**
 * Searches TMDB for movies and TV shows.
 * Rate limited to prevent abuse.
 *
 * @param query - Search query
 * @returns Search results or error
 */
export async function searchMediaAction(
  query: string
): Promise<ActionResult<TMDBSearchResult[]>> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Not authenticated" };
  }

  if (!isTMDBConfigured()) {
    return { success: false, error: "TMDB integration not configured" };
  }

  const rateLimitResult = await checkRateLimit("tmdbSearch");
  if (rateLimitResult) {
    return { success: false, error: rateLimitResult.error };
  }

  try {
    // Use circuit breaker to handle TMDB API failures gracefully
    const results = await tmdbCircuitBreaker.execute(() => searchMedia(query));
    return { success: true, data: results };
  } catch (error) {
    logger.error({ error }, "TMDB search failed");
    return { success: false, error: "Search failed" };
  }
}

/**
 * Applies TMDB metadata to an existing item.
 * Selectively updates name, description, poster, and/or backdrop based on options.
 *
 * @param itemId - Item to update
 * @param tmdbId - TMDB ID
 * @param mediaType - "movie" or "tv"
 * @param options - Which fields to update (defaults to all)
 * @returns Success or error
 */
export async function applyMetadataAction(
  itemId: string,
  tmdbId: number,
  mediaType: "movie" | "tv",
  options: ApplyMetadataOptions = DEFAULT_METADATA_OPTIONS
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Not authenticated" };
  }

  // Merge with defaults
  const opts = { ...DEFAULT_METADATA_OPTIONS, ...options };

  // Verify item ownership and get existing artwork files
  const item = await prisma.item.findUnique({
    where: { id: itemId },
    select: {
      userId: true,
      driveConnectionId: true,
      files: {
        where: { fileType: "ARTWORK" },
        select: { id: true, isPrimary: true, isHero: true },
      },
    },
  });

  if (!item || item.userId !== session.user.id) {
    return { success: false, error: "Item not found" };
  }

  // Check if user has a Drive connection (item may not have driveConnectionId yet
  // if this is called immediately after item creation, before async Drive folder sync)
  const userHasDriveConnection = await prisma.googleDriveConnection.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });

  try {
    // Fetch metadata from TMDB
    let name: string;
    let description: string;
    let posterPath: string | null;
    let backdropPath: string | null;

    // Fetch metadata with circuit breaker protection
    if (mediaType === "movie") {
      const movie = await tmdbCircuitBreaker.execute(() => getMovie(tmdbId));
      if (!movie) {
        return { success: false, error: "Movie not found on TMDB" };
      }
      const year = extractYear(movie.release_date);
      name = year ? `${movie.title} (${year})` : movie.title;
      description = truncateOverview(movie.overview);
      posterPath = movie.poster_path;
      backdropPath = movie.backdrop_path;
    } else {
      const show = await tmdbCircuitBreaker.execute(() => getTVShow(tmdbId));
      if (!show) {
        return { success: false, error: "TV show not found on TMDB" };
      }
      const year = extractYear(show.first_air_date);
      name = year ? `${show.name} (${year})` : show.name;
      description = truncateOverview(show.overview);
      posterPath = show.poster_path;
      backdropPath = show.backdrop_path;
    }

    // Build update data based on options
    const updateData: { name?: string; description?: string | null } = {};
    if (opts.updateName) {
      updateData.name = name;
    }
    if (opts.updateDescription) {
      updateData.description = description || null;
    }

    // Update item metadata if any text fields selected
    if (Object.keys(updateData).length > 0) {
      await prisma.item.update({
        where: { id: itemId },
        data: updateData,
      });
    }

    // Find existing artwork files
    const existingPrimary = item.files?.find((f) => f.isPrimary);
    const existingHero = item.files?.find((f) => f.isHero);

    // Download poster and backdrop in parallel (async-parallel pattern)
    const shouldDownloadPoster =
      opts.updatePoster && userHasDriveConnection && posterPath;
    const shouldDownloadBackdrop =
      opts.updateBackdrop && userHasDriveConnection && backdropPath;

    const [posterBuffer, backdropBuffer] = await Promise.all([
      shouldDownloadPoster
        ? downloadPoster(posterPath!)
        : Promise.resolve(null),
      shouldDownloadBackdrop
        ? downloadBackdrop(backdropPath!)
        : Promise.resolve(null),
    ]);

    // Upload poster if downloaded successfully
    if (posterBuffer) {
      const uploadResult = await uploadBuffer(
        itemId,
        posterBuffer,
        "poster.jpg",
        "image/jpeg"
      );

      if (uploadResult.success && uploadResult.data?.driveFileId) {
        if (existingPrimary) {
          // Update existing primary artwork file
          await prisma.itemFile.update({
            where: { id: existingPrimary.id },
            data: {
              filename: "poster.jpg",
              driveFileId: uploadResult.data.driveFileId,
              size: BigInt(posterBuffer.length),
            },
          });
        } else {
          // Create new ItemFile record for poster
          await prisma.itemFile.create({
            data: {
              itemId,
              filename: "poster.jpg",
              fileType: "ARTWORK",
              mimeType: "image/jpeg",
              size: BigInt(posterBuffer.length),
              driveFileId: uploadResult.data.driveFileId,
              isPrimary: true,
            },
          });
        }
      }
    }

    // Upload backdrop as hero image if downloaded successfully
    if (backdropBuffer) {
      const uploadResult = await uploadBuffer(
        itemId,
        backdropBuffer,
        "backdrop.jpg",
        "image/jpeg"
      );

      if (uploadResult.success && uploadResult.data?.driveFileId) {
        if (existingHero) {
          // Update existing hero artwork file
          await prisma.itemFile.update({
            where: { id: existingHero.id },
            data: {
              filename: "backdrop.jpg",
              driveFileId: uploadResult.data.driveFileId,
              size: BigInt(backdropBuffer.length),
            },
          });
        } else {
          // Create new ItemFile record for backdrop (hero image)
          await prisma.itemFile.create({
            data: {
              itemId,
              filename: "backdrop.jpg",
              fileType: "ARTWORK",
              mimeType: "image/jpeg",
              size: BigInt(backdropBuffer.length),
              driveFileId: uploadResult.data.driveFileId,
              isPrimary: false,
              isHero: true,
            },
          });
        }
      }
    }

    revalidatePath("/u", "layout");

    return { success: true };
  } catch (error) {
    // Check for user account deleted error first
    const prismaError = handlePrismaError(error);
    if (prismaError) {
      return { success: false, error: prismaError.error };
    }

    logger.error({ error, itemId, tmdbId }, "Failed to apply TMDB metadata");
    return { success: false, error: "Failed to apply metadata" };
  }
}

/**
 * Fetches TMDB metadata preview for confirmation dialog.
 * Returns formatted name, description, and image URLs without modifying any data.
 *
 * @param tmdbId - TMDB ID
 * @param mediaType - "movie" or "tv"
 * @returns Preview data or error
 */
export async function getMetadataPreviewAction(
  tmdbId: number,
  mediaType: "movie" | "tv"
): Promise<ActionResult<MetadataPreview>> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Not authenticated" };
  }

  if (!isTMDBConfigured()) {
    return { success: false, error: "TMDB integration not configured" };
  }

  const rateLimitResult = await checkRateLimit("tmdbPreview");
  if (rateLimitResult) {
    return { success: false, error: rateLimitResult.error };
  }

  try {
    let name: string;
    let description: string;
    let posterPath: string | null;
    let backdropPath: string | null;

    if (mediaType === "movie") {
      const movie = await tmdbCircuitBreaker.execute(() => getMovie(tmdbId));
      if (!movie) {
        return { success: false, error: "Movie not found on TMDB" };
      }
      const year = extractYear(movie.release_date);
      name = year ? `${movie.title} (${year})` : movie.title;
      description = truncateOverview(movie.overview);
      posterPath = movie.poster_path;
      backdropPath = movie.backdrop_path;
    } else {
      const show = await tmdbCircuitBreaker.execute(() => getTVShow(tmdbId));
      if (!show) {
        return { success: false, error: "TV show not found on TMDB" };
      }
      const year = extractYear(show.first_air_date);
      name = year ? `${show.name} (${year})` : show.name;
      description = truncateOverview(show.overview);
      posterPath = show.poster_path;
      backdropPath = show.backdrop_path;
    }

    return {
      success: true,
      data: {
        name,
        description,
        posterUrl: getPosterUrl(posterPath, "w342"),
        backdropUrl: getBackdropUrl(backdropPath, "w780"), // Preview thumbnail, not final download
        posterPath,
        backdropPath,
      },
    };
  } catch (error) {
    logger.error({ error, tmdbId }, "Failed to fetch TMDB preview");
    return { success: false, error: "Failed to fetch preview" };
  }
}

/**
 * Fetches all available images for a movie or TV show.
 * Returns posters and backdrops sorted by vote average for selection grids.
 *
 * @param tmdbId - TMDB ID
 * @param mediaType - "movie" or "tv"
 * @returns Images collection or error
 */
export async function getImagesAction(
  tmdbId: number,
  mediaType: "movie" | "tv"
): Promise<ActionResult<TMDBImages>> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Not authenticated" };
  }

  if (!isTMDBConfigured()) {
    return { success: false, error: "TMDB integration not configured" };
  }

  const rateLimitResult = await checkRateLimit("tmdbImages");
  if (rateLimitResult) {
    return { success: false, error: rateLimitResult.error };
  }

  try {
    const images = await tmdbCircuitBreaker.execute(() =>
      mediaType === "movie" ? getMovieImages(tmdbId) : getTVShowImages(tmdbId)
    );

    if (!images) {
      return { success: false, error: "Images not found" };
    }

    return { success: true, data: images };
  } catch (error) {
    logger.error({ error, tmdbId, mediaType }, "Failed to fetch TMDB images");
    return { success: false, error: "Failed to fetch images" };
  }
}

/**
 * Fetches all seasons for a TV show.
 * Used by EpisodePicker to display season list with episode counts.
 *
 * @param tvId - TMDB TV show ID
 * @returns Array of season summaries or error
 */
export async function getSeasonsAction(
  tvId: number
): Promise<ActionResult<TMDBSeasonSummary[]>> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Not authenticated" };
  }

  if (!isTMDBConfigured()) {
    return { success: false, error: "TMDB integration not configured" };
  }

  const rateLimitResult = await checkRateLimit("tmdbPreview");
  if (rateLimitResult) {
    return { success: false, error: rateLimitResult.error };
  }

  try {
    const seasons = await tmdbCircuitBreaker.execute(() => getTVSeasons(tvId));

    if (!seasons) {
      return { success: false, error: "Seasons not found" };
    }

    return { success: true, data: seasons };
  } catch (error) {
    logger.error({ error, tvId }, "Failed to fetch TV seasons");
    return { success: false, error: "Failed to fetch seasons" };
  }
}

/**
 * Fetches all episodes for a specific season.
 * Used by EpisodePicker to display episode list.
 *
 * @param tvId - TMDB TV show ID
 * @param seasonNumber - Season number (0 for specials, 1+ for numbered seasons)
 * @returns Array of episodes or error
 */
export async function getEpisodesAction(
  tvId: number,
  seasonNumber: number
): Promise<ActionResult<TMDBEpisode[]>> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Not authenticated" };
  }

  if (!isTMDBConfigured()) {
    return { success: false, error: "TMDB integration not configured" };
  }

  const rateLimitResult = await checkRateLimit("tmdbPreview");
  if (rateLimitResult) {
    return { success: false, error: rateLimitResult.error };
  }

  try {
    const episodes = await tmdbCircuitBreaker.execute(() =>
      getTVEpisodes(tvId, seasonNumber)
    );

    if (!episodes) {
      return { success: false, error: "Episodes not found" };
    }

    return { success: true, data: episodes };
  } catch (error) {
    logger.error({ error, tvId, seasonNumber }, "Failed to fetch TV episodes");
    return { success: false, error: "Failed to fetch episodes" };
  }
}

/**
 * Preview data for episode metadata confirmation.
 * Similar to MetadataPreview but for episode-specific data.
 */
export interface EpisodeMetadataPreview {
  /** Formatted episode title (e.g., "S01E01 - Pilot") */
  name: string;
  /** Episode overview/description */
  description: string;
  /** Full still URL for preview thumbnail */
  stillUrl: string | null;
  /** Raw still path for download */
  stillPath: string | null;
  /** Season number */
  seasonNumber: number;
  /** Episode number */
  episodeNumber: number;
}

/**
 * Fetches episode metadata preview for confirmation dialog.
 * Returns formatted episode name, description, and still image URL.
 *
 * @param tvId - TMDB TV show ID
 * @param seasonNumber - Season number
 * @param episodeNumber - Episode number
 * @returns Episode preview data or error
 */
export async function getEpisodePreviewAction(
  tvId: number,
  seasonNumber: number,
  episodeNumber: number
): Promise<ActionResult<EpisodeMetadataPreview>> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Not authenticated" };
  }

  if (!isTMDBConfigured()) {
    return { success: false, error: "TMDB integration not configured" };
  }

  const rateLimitResult = await checkRateLimit("tmdbPreview");
  if (rateLimitResult) {
    return { success: false, error: rateLimitResult.error };
  }

  try {
    const episode = await tmdbCircuitBreaker.execute(() =>
      getEpisodeDetails(tvId, seasonNumber, episodeNumber)
    );

    if (!episode) {
      return { success: false, error: "Episode not found on TMDB" };
    }

    // Format episode title: "S01E01 - Episode Name"
    const seasonStr = String(seasonNumber).padStart(2, "0");
    const episodeStr = String(episodeNumber).padStart(2, "0");
    const name = `S${seasonStr}E${episodeStr} - ${episode.name}`;

    return {
      success: true,
      data: {
        name,
        description: truncateOverview(episode.overview || ""),
        stillUrl: getStillUrl(episode.still_path, "w780"),
        stillPath: episode.still_path,
        seasonNumber,
        episodeNumber,
      },
    };
  } catch (error) {
    logger.error(
      { error, tvId, seasonNumber, episodeNumber },
      "Failed to fetch episode preview"
    );
    return { success: false, error: "Failed to fetch episode preview" };
  }
}

// =============================================================================
// Season and Episode Image Actions (for TV Picker and Wizard)
// =============================================================================

/**
 * Preview data for season metadata confirmation.
 */
export interface SeasonMetadataPreview {
  /** Season name (e.g., "Season 1") */
  name: string;
  /** Season overview/description */
  description: string;
  /** Full poster URL for preview thumbnail */
  posterUrl: string | null;
  /** Raw poster path for download */
  posterPath: string | null;
  /** Season number */
  seasonNumber: number;
  /** Air date of the season */
  airDate: string | null;
}

/**
 * Fetches season metadata for the wizard.
 * Returns formatted season name, description, and poster URL.
 * Uses parallel auth + rate limit checks per codebase pattern.
 *
 * @param tvId - TMDB TV show ID
 * @param seasonNumber - Season number (0 for specials, 1+ for numbered seasons)
 * @returns Season metadata preview or error
 *
 * @example
 * const result = await getSeasonMetadataAction(1396, 1); // Breaking Bad S1
 */
export async function getSeasonMetadataAction(
  tvId: number,
  seasonNumber: number
): Promise<ActionResult<SeasonMetadataPreview>> {
  // Parallel auth + rate limit (per codebase pattern)
  const [session, rateLimitResult] = await Promise.all([
    auth(),
    checkRateLimit("tmdbPreview"),
  ]);

  if (!session?.user?.id) {
    return { success: false, error: "Not authenticated" };
  }

  if (!isTMDBConfigured()) {
    return { success: false, error: "TMDB integration not configured" };
  }

  if (rateLimitResult) {
    return { success: false, error: rateLimitResult.error };
  }

  try {
    const season = await tmdbCircuitBreaker.execute(() =>
      getSeasonDetails(tvId, seasonNumber)
    );

    if (!season) {
      return { success: false, error: "Season not found on TMDB" };
    }

    return {
      success: true,
      data: {
        name: season.name,
        description: truncateOverview(season.overview || ""),
        posterUrl: getPosterUrl(season.poster_path, "w342"),
        posterPath: season.poster_path,
        seasonNumber: season.season_number,
        airDate: season.air_date,
      },
    };
  } catch (error) {
    logger.error(
      { error, tvId, seasonNumber },
      "Failed to fetch season metadata"
    );
    return { success: false, error: "Failed to fetch season details" };
  }
}

/**
 * Fetches all available images for a TV season.
 * Returns posters only (seasons don't have backdrops), sorted by vote average.
 *
 * @param tvId - TMDB TV show ID
 * @param seasonNumber - Season number (0 for specials, 1+ for numbered seasons)
 * @returns Season images collection or error
 *
 * @example
 * const result = await getSeasonImagesAction(1396, 1); // Breaking Bad S1 posters
 */
export async function getSeasonImagesAction(
  tvId: number,
  seasonNumber: number
): Promise<ActionResult<TMDBSeasonImages>> {
  // Parallel auth + rate limit (per codebase pattern)
  const [session, rateLimitResult] = await Promise.all([
    auth(),
    checkRateLimit("tmdbImages"),
  ]);

  if (!session?.user?.id) {
    return { success: false, error: "Not authenticated" };
  }

  if (!isTMDBConfigured()) {
    return { success: false, error: "TMDB integration not configured" };
  }

  if (rateLimitResult) {
    return { success: false, error: rateLimitResult.error };
  }

  try {
    const images = await tmdbCircuitBreaker.execute(() =>
      getTVSeasonImages(tvId, seasonNumber)
    );

    if (!images) {
      return { success: false, error: "Season images not found" };
    }

    return { success: true, data: images };
  } catch (error) {
    logger.error(
      { error, tvId, seasonNumber },
      "Failed to fetch season images"
    );
    return { success: false, error: "Failed to fetch season images" };
  }
}

/**
 * Fetches all available still images for a TV episode.
 * Returns stills (16:9 scene shots), sorted by vote average.
 *
 * @param tvId - TMDB TV show ID
 * @param seasonNumber - Season number (0 for specials, 1+ for numbered seasons)
 * @param episodeNumber - Episode number (1-based)
 * @returns Episode images collection or error
 *
 * @example
 * const result = await getEpisodeImagesAction(1396, 1, 1); // Breaking Bad S01E01 stills
 */
export async function getEpisodeImagesAction(
  tvId: number,
  seasonNumber: number,
  episodeNumber: number
): Promise<ActionResult<TMDBEpisodeImages>> {
  // Parallel auth + rate limit (per codebase pattern)
  const [session, rateLimitResult] = await Promise.all([
    auth(),
    checkRateLimit("tmdbImages"),
  ]);

  if (!session?.user?.id) {
    return { success: false, error: "Not authenticated" };
  }

  if (!isTMDBConfigured()) {
    return { success: false, error: "TMDB integration not configured" };
  }

  if (rateLimitResult) {
    return { success: false, error: rateLimitResult.error };
  }

  try {
    const images = await tmdbCircuitBreaker.execute(() =>
      getEpisodeImages(tvId, seasonNumber, episodeNumber)
    );

    if (!images) {
      return { success: false, error: "Episode images not found" };
    }

    return { success: true, data: images };
  } catch (error) {
    logger.error(
      { error, tvId, seasonNumber, episodeNumber },
      "Failed to fetch episode images"
    );
    return { success: false, error: "Failed to fetch episode images" };
  }
}

/**
 * Combined data for a season including metadata and images.
 */
export interface SeasonData {
  /** Season metadata */
  metadata: SeasonMetadataPreview;
  /** Season images (posters only) */
  images: TMDBSeasonImages;
}

/**
 * Fetches season metadata AND images in parallel.
 * IMPORTANT: Use this instead of calling metadata + images sequentially
 * to avoid waterfall requests (per react-best-practices async-parallel rule).
 *
 * @param tvId - TMDB TV show ID
 * @param seasonNumber - Season number (0 for specials, 1+ for numbered seasons)
 * @returns Combined season data or error
 *
 * @example
 * const result = await getSeasonDataAction(1396, 1);
 * if (result.success) {
 *   const { metadata, images } = result.data;
 * }
 */
export async function getSeasonDataAction(
  tvId: number,
  seasonNumber: number
): Promise<ActionResult<SeasonData>> {
  // Parallel auth + rate limit (per codebase pattern)
  const [session, rateLimitResult] = await Promise.all([
    auth(),
    checkRateLimit("tmdbPreview"),
  ]);

  if (!session?.user?.id) {
    return { success: false, error: "Not authenticated" };
  }

  if (!isTMDBConfigured()) {
    return { success: false, error: "TMDB integration not configured" };
  }

  if (rateLimitResult) {
    return { success: false, error: rateLimitResult.error };
  }

  try {
    // Fetch metadata and images in parallel to avoid waterfall
    const [season, images] = await Promise.all([
      tmdbCircuitBreaker.execute(() => getSeasonDetails(tvId, seasonNumber)),
      tmdbCircuitBreaker.execute(() => getTVSeasonImages(tvId, seasonNumber)),
    ]);

    // Metadata is required, images are optional
    if (!season) {
      return { success: false, error: "Season not found on TMDB" };
    }

    return {
      success: true,
      data: {
        metadata: {
          name: season.name,
          description: truncateOverview(season.overview || ""),
          posterUrl: getPosterUrl(season.poster_path, "w342"),
          posterPath: season.poster_path,
          seasonNumber: season.season_number,
          airDate: season.air_date,
        },
        // Fallback to empty posters if images fetch failed
        images: images || { posters: [] },
      },
    };
  } catch (error) {
    logger.error({ error, tvId, seasonNumber }, "Failed to fetch season data");
    return { success: false, error: "Failed to fetch season data" };
  }
}
