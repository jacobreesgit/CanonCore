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
  downloadPoster,
  extractYear,
  truncateOverview,
  isTMDBConfigured,
  type TMDBSearchResult,
} from "@/lib/tmdb-client";
import { uploadBuffer } from "@/lib/google-drive-actions";

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
 * Updates name, description, and optionally uploads poster.
 *
 * @param itemId - Item to update
 * @param tmdbId - TMDB ID
 * @param mediaType - "movie" or "tv"
 * @returns Success or error
 */
export async function applyMetadataAction(
  itemId: string,
  tmdbId: number,
  mediaType: "movie" | "tv"
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Not authenticated" };
  }

  // Verify item ownership and get existing artwork
  const item = await prisma.item.findUnique({
    where: { id: itemId },
    select: {
      userId: true,
      driveConnectionId: true,
      files: {
        where: { fileType: "ARTWORK", isPrimary: true },
        select: { id: true },
      },
    },
  });

  if (!item || item.userId !== session.user.id) {
    return { success: false, error: "Item not found" };
  }

  try {
    // Fetch metadata from TMDB
    let name: string;
    let description: string;
    let posterPath: string | null;

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
    } else {
      const show = await tmdbCircuitBreaker.execute(() => getTVShow(tmdbId));
      if (!show) {
        return { success: false, error: "TV show not found on TMDB" };
      }
      const year = extractYear(show.first_air_date);
      name = year ? `${show.name} (${year})` : show.name;
      description = truncateOverview(show.overview);
      posterPath = show.poster_path;
    }

    // Update item metadata
    await prisma.item.update({
      where: { id: itemId },
      data: { name, description: description || null },
    });

    // Upload poster if item has Drive connection and poster exists
    if (item.driveConnectionId && posterPath) {
      const posterBuffer = await downloadPoster(posterPath);

      if (posterBuffer) {
        const uploadResult = await uploadBuffer(
          itemId,
          posterBuffer,
          "poster.jpg",
          "image/jpeg"
        );

        if (uploadResult.success && uploadResult.data?.driveFileId) {
          // Check for existing primary artwork to avoid duplicates
          const existingArtwork = item.files?.[0];

          if (existingArtwork) {
            // Update existing artwork file
            await prisma.itemFile.update({
              where: { id: existingArtwork.id },
              data: {
                filename: "poster.jpg",
                driveFileId: uploadResult.data.driveFileId,
                size: BigInt(posterBuffer.length),
              },
            });
          } else {
            // Create new ItemFile record
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
    }

    revalidatePath("/my-items");
    revalidatePath(`/my-items/${itemId}`);

    return { success: true };
  } catch (error) {
    logger.error({ error, itemId, tmdbId }, "Failed to apply TMDB metadata");
    return { success: false, error: "Failed to apply metadata" };
  }
}
