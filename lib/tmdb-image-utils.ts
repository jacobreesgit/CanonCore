/**
 * TMDB image URL utilities.
 * Client-safe - no server dependencies (Prisma, React cache, etc.).
 * Used by client components to construct TMDB CDN image URLs.
 *
 * Also provides `resolveArtworkId` for server-side artwork resolution
 * (TMDB poster path takes precedence over Drive-hosted artwork files).
 */

const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";

/**
 * Constructs a full TMDB poster URL from a stored path.
 *
 * @param path - TMDB poster path (e.g., "/abc123.jpg")
 * @param size - Poster size (default: "w780")
 * @returns Full TMDB CDN URL or null if path is empty
 */
export function getTmdbPosterUrl(
  path: string | null,
  size = "w780"
): string | null {
  if (!path) return null;
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
}

/**
 * Constructs a full TMDB backdrop URL from a stored path.
 *
 * @param path - TMDB backdrop path (e.g., "/xyz789.jpg")
 * @param size - Backdrop size (default: "original")
 * @returns Full TMDB CDN URL or null if path is empty
 */
export function getTmdbBackdropUrl(
  path: string | null,
  size = "original"
): string | null {
  if (!path) return null;
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
}

/** Minimal shape needed for artwork ID resolution. */
interface ArtworkResolvable {
  tmdbPosterPath?: string | null;
  files: { id: string; fileType: string; isPrimary: boolean }[];
}

/**
 * Resolves the artwork file ID for an item.
 * Returns null when a TMDB poster path exists (images served from CDN).
 * Otherwise returns the primary artwork file ID, or the first artwork file.
 *
 * @param item - Item with tmdbPosterPath and files array
 * @returns Artwork file ID or null
 */
export function resolveArtworkId(item: ArtworkResolvable): string | null {
  if (item.tmdbPosterPath) return null;
  return (
    item.files.find((f) => f.fileType === "ARTWORK" && f.isPrimary)?.id ??
    item.files.find((f) => f.fileType === "ARTWORK")?.id ??
    null
  );
}
