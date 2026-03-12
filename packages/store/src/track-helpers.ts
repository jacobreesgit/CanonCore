/**
 * Builds a QueueTrack from item + file data.
 * Shared between ItemDetailClient, context menus, and any future entry points.
 */

import type { QueueTrack } from "./types";
import { getTmdbPosterUrl } from "@canoncore/utils";

interface TrackSource {
  fileId: string;
  itemId: string;
  filename: string;
  mimeType: string | null;
  itemName: string;
  tmdbPosterPath?: string | null;
  heroArtworkId?: string | null;
  /** Duration from Drive metadata (ms). Preferred over playbackDuration. */
  durationMs?: number | null;
  playbackDuration?: number | null;
  playbackPosition?: number | null;
}

export function buildQueueTrack(source: TrackSource): QueueTrack {
  return {
    fileId: source.fileId,
    itemId: source.itemId,
    filename: source.filename,
    mimeType: source.mimeType || "application/octet-stream",
    itemName: source.itemName,
    posterUrl: source.tmdbPosterPath
      ? (getTmdbPosterUrl(source.tmdbPosterPath) ?? undefined)
      : source.heroArtworkId
        ? `/api/artwork/${source.heroArtworkId}`
        : undefined,
    duration: source.durationMs
      ? source.durationMs / 1000
      : (source.playbackDuration ?? undefined),
    playbackPosition: source.playbackPosition ?? undefined,
  };
}
