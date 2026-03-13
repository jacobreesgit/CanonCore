import { useEffect, useRef, useCallback } from "react";
import TrackPlayer, {
  Event,
  useTrackPlayerEvents,
  type Track,
} from "react-native-track-player";
import { useAppDispatch, useAppSelector } from "@canoncore/store/hooks";
import {
  selectCurrentTrack,
  selectQueue,
  selectQueueIndex,
  selectRepeat,
  selectShuffle,
} from "@canoncore/store/selectors";
import { skipNext, skipToIndex, stop } from "@canoncore/store/playback";
import type { QueueTrack } from "@canoncore/store/types";
import { toRNTPRepeatMode, initTrackPlayer } from "@/lib/track-player";
import { useVideoPlayerController } from "./use-video-player";
import { getOfflineAwareStreamUrl } from "@/lib/offline-url";
import { useDownloadManager } from "@/components/providers/download-manager-provider";
import { useCastSession } from "react-native-google-cast";

/**
 * Build an RNTP Track from a Redux QueueTrack.
 * URL is pre-resolved (may be local file:// or remote https://).
 */
function toRNTPTrack(qt: QueueTrack, resolvedUrl: string): Track {
  return {
    id: qt.fileId,
    url: resolvedUrl,
    title: qt.itemName,
    artist: qt.filename,
    artwork: qt.posterUrl ?? undefined,
    duration: qt.duration,
  };
}

/**
 * Central playback controller.
 * Routes audio → RNTP, video → expo-video, syncs Redux ↔ native players.
 *
 * Shuffle: when enabled, the RNTP queue is loaded in shuffled order
 * (Fisher-Yates). RNTP advances linearly through the shuffled array.
 */
export function usePlaybackController() {
  const dispatch = useAppDispatch();
  const currentTrack = useAppSelector(selectCurrentTrack);
  const queue = useAppSelector(selectQueue);
  const queueIndex = useAppSelector(selectQueueIndex);
  const repeat = useAppSelector(selectRepeat);
  const shuffle = useAppSelector(selectShuffle);
  const downloadManager = useDownloadManager();
  const castSession = useCastSession();
  const isCasting = !!castSession;

  // Track what native players currently have loaded
  const loadedTrackRef = useRef<string | null>(null);
  const activePlayerRef = useRef<"audio" | "video" | null>(null);
  const syncingFromRNTPRef = useRef(false);
  const queueRef = useRef(queue);
  queueRef.current = queue;
  const queueIndexRef = useRef(queueIndex);
  queueIndexRef.current = queueIndex;
  const repeatRef = useRef(repeat);
  repeatRef.current = repeat;
  const shuffleRef = useRef(shuffle);
  shuffleRef.current = shuffle;

  // Video player
  const videoPlayer = useVideoPlayerController({
    onPlayToEnd: () => {
      dispatch(skipNext());
    },
  });

  // Init TrackPlayer on mount
  useEffect(() => {
    initTrackPlayer();
  }, []);

  // Sync repeat mode to RNTP
  useEffect(() => {
    if (activePlayerRef.current === "audio") {
      TrackPlayer.setRepeatMode(toRNTPRepeatMode(repeat));
    }
  }, [repeat]);

  // Fisher-Yates shuffle keeping current track at index 0
  const shuffleQueue = useCallback(
    (tracks: QueueTrack[], currentFileId: string): QueueTrack[] => {
      const shuffled = [...tracks];
      const currentIdx = shuffled.findIndex((t) => t.fileId === currentFileId);
      if (currentIdx > 0) {
        [shuffled[0], shuffled[currentIdx]] = [shuffled[currentIdx], shuffled[0]];
      }
      for (let i = shuffled.length - 1; i > 1; i--) {
        const j = 1 + Math.floor(Math.random() * i);
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    },
    []
  );

  // Main sync: when Redux currentTrack changes, load into correct player
  useEffect(() => {
    if (syncingFromRNTPRef.current) {
      syncingFromRNTPRef.current = false;
      return;
    }

    // Don't load media locally when casting — cast hook handles remote playback
    if (isCasting) {
      TrackPlayer.pause().catch(() => {});
      videoPlayer.pause();
      return;
    }

    if (!currentTrack) {
      if (activePlayerRef.current === "audio") {
        TrackPlayer.reset();
      } else if (activePlayerRef.current === "video") {
        videoPlayer.stop();
      }
      loadedTrackRef.current = null;
      activePlayerRef.current = null;
      return;
    }

    if (loadedTrackRef.current === currentTrack.fileId) return;

    const isVideoTrack = currentTrack.mimeType.startsWith("video/");

    // Stop the OTHER player if switching types
    if (isVideoTrack && activePlayerRef.current === "audio") {
      TrackPlayer.reset();
    } else if (!isVideoTrack && activePlayerRef.current === "video") {
      videoPlayer.stop();
    }

    if (isVideoTrack) {
      activePlayerRef.current = "video";
      // Resolve offline-aware URL (local file:// if downloaded, else remote)
      (async () => {
        const videoUrl = await getOfflineAwareStreamUrl(
          currentTrack.fileId,
          downloadManager
        );
        videoPlayer.loadSource(videoUrl, currentTrack.playbackPosition);
      })();
    } else {
      activePlayerRef.current = "audio";

      (async () => {
        let rntpTracks: Track[];
        let startIndex: number;

        if (queue.length > 0) {
          const orderedTracks = shuffle
            ? shuffleQueue(queue, currentTrack.fileId)
            : queue;

          // Resolve URLs (check local downloads first, fall back to streaming)
          const resolvedUrls = await Promise.all(
            orderedTracks.map((t) =>
              getOfflineAwareStreamUrl(t.fileId, downloadManager)
            )
          );

          rntpTracks = orderedTracks.map((t, i) =>
            toRNTPTrack(t, resolvedUrls[i])
          );
          startIndex = shuffle ? 0 : Math.max(queueIndex, 0);
        } else {
          const singleUrl = await getOfflineAwareStreamUrl(
            currentTrack.fileId,
            downloadManager
          );
          rntpTracks = [toRNTPTrack(currentTrack, singleUrl)];
          startIndex = 0;
        }

        const startPosition = currentTrack.playbackPosition ?? 0;

        await TrackPlayer.reset();
        await TrackPlayer.add(rntpTracks);
        await TrackPlayer.skip(startIndex, startPosition);
        await TrackPlayer.play();
        await TrackPlayer.setRepeatMode(toRNTPRepeatMode(repeat));
      })();
    }

    loadedTrackRef.current = currentTrack.fileId;
  }, [currentTrack, queue, queueIndex, repeat, shuffle, videoPlayer, dispatch, shuffleQueue, downloadManager, isCasting]);

  // Listen to RNTP events: track change + queue end
  useTrackPlayerEvents(
    [Event.PlaybackActiveTrackChanged, Event.PlaybackQueueEnded],
    async (event) => {
      if (activePlayerRef.current !== "audio") return;

      if (event.type === Event.PlaybackActiveTrackChanged && event.track != null) {
        const rntpTrack = await TrackPlayer.getActiveTrack();
        if (!rntpTrack) return;

        const reduxIdx = queueRef.current.findIndex(
          (t) => t.fileId === rntpTrack.id
        );
        if (reduxIdx >= 0 && reduxIdx !== queueIndexRef.current) {
          syncingFromRNTPRef.current = true;
          dispatch(skipToIndex(reduxIdx));
          loadedTrackRef.current = queueRef.current[reduxIdx]?.fileId ?? null;
        }
      }

      if (event.type === Event.PlaybackQueueEnded) {
        if (repeatRef.current === "off") {
          dispatch(stop());
          loadedTrackRef.current = null;
          activePlayerRef.current = null;
        }
      }
    }
  );

  // Play / Pause / Seek helpers (route to active player)
  const play = useCallback(async () => {
    if (activePlayerRef.current === "audio") {
      await TrackPlayer.play();
    } else if (activePlayerRef.current === "video") {
      videoPlayer.play();
    }
  }, [videoPlayer]);

  const pause = useCallback(async () => {
    if (activePlayerRef.current === "audio") {
      await TrackPlayer.pause();
    } else if (activePlayerRef.current === "video") {
      videoPlayer.pause();
    }
  }, [videoPlayer]);

  const seekTo = useCallback(
    async (seconds: number) => {
      if (activePlayerRef.current === "audio") {
        await TrackPlayer.seekTo(seconds);
      } else if (activePlayerRef.current === "video") {
        videoPlayer.seekTo(seconds);
      }
    },
    [videoPlayer]
  );

  return {
    currentTrack,
    isVideo: currentTrack?.mimeType.startsWith("video/") ?? false,
    isPlaying:
      activePlayerRef.current === "video" ? videoPlayer.isPlaying : false,
    activePlayer: activePlayerRef.current,
    videoPlayer,
    play,
    pause,
    seekTo,
  };
}
