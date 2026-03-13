import { useState, useEffect } from "react";
import { View } from "@/tw";
import { useAudioProgress } from "@/hooks/use-audio-progress";
import { usePlayback } from "@/components/providers/playback-provider";

/**
 * Full-bleed seek bar at top of mini-player.
 * Subscribes to progress independently to avoid re-rendering parent.
 *
 * Audio: uses RNTP useProgress (~1Hz re-renders).
 * Video: polls expo-video player.currentTime every 500ms.
 */
export function MiniPlayerProgress() {
  const { activePlayer, videoPlayer } = usePlayback();
  const audioProgress = useAudioProgress();
  const [videoProgress, setVideoProgress] = useState(0);

  useEffect(() => {
    if (activePlayer !== "video") {
      setVideoProgress(0);
      return;
    }

    const interval = setInterval(() => {
      const duration = videoPlayer.duration;
      const currentTime = videoPlayer.currentTime;
      setVideoProgress(duration > 0 ? currentTime / duration : 0);
    }, 500);

    return () => clearInterval(interval);
  }, [activePlayer, videoPlayer]);

  const progress =
    activePlayer === "audio" ? audioProgress.progress : videoProgress;

  return (
    <View className="h-[3px] bg-white/10 w-full">
      <View
        className="h-full bg-primary"
        style={{ width: `${Math.min(progress * 100, 100)}%` }}
      />
    </View>
  );
}
