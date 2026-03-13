import { useProgress } from "react-native-track-player";

/**
 * Audio playback progress from react-native-track-player.
 * Updates at ~1 second intervals by default.
 * Only valid when activePlayer === "audio".
 */
export function useAudioProgress(updateInterval = 1000) {
  const { position, duration, buffered } = useProgress(updateInterval);

  return {
    position,
    duration,
    buffered,
    progress: duration > 0 ? position / duration : 0,
  };
}
