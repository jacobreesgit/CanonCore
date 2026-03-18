import {
  MediaStreamType,
  type MediaLoadRequest,
} from "react-native-google-cast";
import type { QueueTrack } from "@canoncore/store/types";
import { getStreamUrl } from "@/lib/image-url";

/**
 * Convert a QueueTrack into a Google Cast MediaLoadRequest.
 * The Chromecast receiver fetches media directly from the server,
 * so we use the full stream URL (not a local file path).
 */
export function buildCastMediaRequest(
  track: QueueTrack,
  startTime = 0,
): MediaLoadRequest {
  const contentUrl = getStreamUrl(track.fileId);
  const isVideo = track.mimeType.startsWith("video/");

  return {
    autoplay: true,
    startTime,
    mediaInfo: {
      contentUrl,
      contentType: track.mimeType,
      streamType: MediaStreamType.BUFFERED,
      streamDuration: track.duration,
      metadata: {
        type: isVideo ? "movie" : "musicTrack",
        title: track.itemName,
        subtitle: track.filename,
        images: track.posterUrl ? [{ url: track.posterUrl }] : [],
      },
    },
  };
}

/**
 * Build a cast queue from multiple QueueTracks.
 */
export function buildCastQueue(
  tracks: QueueTrack[],
  startIndex: number,
): MediaLoadRequest {
  const startTrack = tracks[startIndex];
  if (!startTrack) {
    throw new Error("Invalid start index for cast queue");
  }

  return {
    autoplay: true,
    startTime: startTrack.playbackPosition ?? 0,
    queueData: {
      items: tracks.map((track) => {
        const isVideo = track.mimeType.startsWith("video/");
        return {
          mediaInfo: {
            contentUrl: getStreamUrl(track.fileId),
            contentType: track.mimeType,
            streamType: MediaStreamType.BUFFERED,
            streamDuration: track.duration,
            metadata: {
              type: isVideo ? ("movie" as const) : ("musicTrack" as const),
              title: track.itemName,
              subtitle: track.filename,
              images: track.posterUrl ? [{ url: track.posterUrl }] : [],
            },
          },
          autoplay: true,
        };
      }),
      startIndex,
    },
  };
}
