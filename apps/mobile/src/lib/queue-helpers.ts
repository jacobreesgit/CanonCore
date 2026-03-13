import type { QueueTrack } from "@canoncore/store/types";
import { getArtworkUrl, getTmdbPosterUrl } from "@/lib/image-url";

interface MobileTrackSource {
  fileId: string;
  itemId: string;
  filename: string;
  mimeType: string | null;
  itemName: string;
  tmdbPosterPath?: string | null;
  heroArtworkId?: string | null;
  durationMs?: number | null;
  playbackDuration?: number | null;
  playbackPosition?: number | null;
}

/**
 * Build a QueueTrack for mobile.
 * Uses absolute URLs for poster (getArtworkUrl / getTmdbPosterUrl)
 * instead of the relative /api/artwork/ paths used on web.
 */
export function buildMobileQueueTrack(source: MobileTrackSource): QueueTrack {
  return {
    fileId: source.fileId,
    itemId: source.itemId,
    filename: source.filename,
    mimeType: source.mimeType || "application/octet-stream",
    itemName: source.itemName,
    posterUrl: source.tmdbPosterPath
      ? getTmdbPosterUrl(source.tmdbPosterPath)
      : source.heroArtworkId
        ? getArtworkUrl(source.heroArtworkId)
        : undefined,
    duration: source.durationMs
      ? source.durationMs / 1000
      : (source.playbackDuration ?? undefined),
    playbackPosition: source.playbackPosition ?? undefined,
  };
}
