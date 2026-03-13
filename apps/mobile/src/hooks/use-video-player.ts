import { useCallback, useRef } from "react";
import {
  useVideoPlayer as useExpoVideoPlayer,
} from "expo-video";
import { useEvent, useEventListener } from "expo";

interface UseVideoPlayerOptions {
  onPlayToEnd?: () => void;
}

export function useVideoPlayerController(options?: UseVideoPlayerOptions) {
  const onPlayToEndRef = useRef(options?.onPlayToEnd);
  onPlayToEndRef.current = options?.onPlayToEnd;

  // Create a single persistent video player with null source (idle).
  const player = useExpoVideoPlayer(null, (p) => {
    p.loop = false;
  });

  // Track playing state reactively
  const { isPlaying } = useEvent(player, "playingChange", {
    isPlaying: player.playing,
  });

  // Track status reactively
  const { status } = useEvent(player, "statusChange", {
    status: player.status,
  });

  // Listen for playback completion
  useEventListener(player, "playToEnd", () => {
    onPlayToEndRef.current?.();
  });

  /**
   * Load a source URL into the video player.
   * Accepts a remote https:// URL or a local file:// URI
   * (for offline-downloaded media).
   */
  const loadSource = useCallback(
    async (source: string, startPosition?: number) => {
      await player.replaceAsync({ uri: source });
      if (startPosition && startPosition > 0) {
        player.currentTime = startPosition;
      }
      player.play();
    },
    [player]
  );

  const play = useCallback(() => player.play(), [player]);
  const pause = useCallback(() => player.pause(), [player]);
  const seekTo = useCallback(
    (seconds: number) => {
      player.currentTime = seconds;
    },
    [player]
  );
  const stop = useCallback(async () => {
    player.pause();
    await player.replaceAsync(null);
  }, [player]);

  return {
    player,
    isPlaying,
    status,
    loadSource,
    play,
    pause,
    seekTo,
    stop,
    get currentTime() {
      return player.currentTime;
    },
    get duration() {
      return player.duration;
    },
  };
}
