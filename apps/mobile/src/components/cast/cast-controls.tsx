import { View, Text, Pressable } from "@/tw";
import { FontAwesomeIcon } from "@fortawesome/react-native-fontawesome";
import {
  faPlay,
  faPause,
  faForwardStep,
  faBackwardStep,
} from "@fortawesome/free-solid-svg-icons";
import {
  useRemoteMediaClient,
  useMediaStatus,
  useStreamPosition,
  MediaPlayerState,
} from "react-native-google-cast";
import { useCallback } from "react";

interface CastControlsProps {
  variant: "mini" | "expanded";
  /** Pass from parent to avoid duplicate useCastPlayback hook calls */
  deviceName: string | null;
}

export function CastControls({ variant, deviceName }: CastControlsProps) {
  const client = useRemoteMediaClient();
  const mediaStatus = useMediaStatus();
  const streamPosition = useStreamPosition();

  const isPlaying = mediaStatus?.playerState === MediaPlayerState.PLAYING;
  const duration = mediaStatus?.mediaInfo?.streamDuration ?? 0;
  const progress = duration > 0 ? (streamPosition ?? 0) / duration : 0;

  const handlePlayPause = useCallback(() => {
    if (!client) return;
    if (isPlaying) {
      client.pause();
    } else {
      client.play();
    }
  }, [client, isPlaying]);

  const handleNext = useCallback(() => {
    client?.queueNext();
  }, [client]);

  const handlePrevious = useCallback(() => {
    client?.queuePrev();
  }, [client]);

  if (variant === "mini") {
    return (
      <View className="flex-row items-center gap-2">
        <Pressable onPress={handlePlayPause} hitSlop={8}>
          <FontAwesomeIcon
            icon={isPlaying ? faPause : faPlay}
            size={16}
            color="#ffffff"
          />
        </Pressable>
        <Pressable onPress={handleNext} hitSlop={8}>
          <FontAwesomeIcon
            icon={faForwardStep}
            size={14}
            color="rgba(255, 255, 255, 0.7)"
          />
        </Pressable>
      </View>
    );
  }

  // Expanded variant
  return (
    <View className="items-center gap-6 px-8">
      {/* Casting indicator */}
      <Text className="text-primary text-sm font-medium">
        Casting to {deviceName}
      </Text>

      {/* Progress */}
      <View className="w-full gap-1">
        <View
          className="h-1 bg-white/10 rounded-full w-full"
          style={{ borderCurve: "continuous" }}
        >
          <View
            className="h-full bg-primary rounded-full"
            style={{
              width: `${Math.min(progress * 100, 100)}%`,
              borderCurve: "continuous",
            }}
          />
        </View>
        <View className="flex-row justify-between">
          <Text className="text-muted-foreground text-xs">
            {formatTime(streamPosition ?? 0)}
          </Text>
          <Text className="text-muted-foreground text-xs">
            {formatTime(duration)}
          </Text>
        </View>
      </View>

      {/* Controls */}
      <View className="flex-row items-center gap-8">
        <Pressable onPress={handlePrevious} hitSlop={12}>
          <FontAwesomeIcon
            icon={faBackwardStep}
            size={24}
            color="rgba(255, 255, 255, 0.7)"
          />
        </Pressable>
        <Pressable
          onPress={handlePlayPause}
          className="w-16 h-16 rounded-full bg-white items-center justify-center"
          style={{ borderCurve: "continuous" }}
          hitSlop={8}
        >
          <FontAwesomeIcon
            icon={isPlaying ? faPause : faPlay}
            size={24}
            color="#000000"
          />
        </Pressable>
        <Pressable onPress={handleNext} hitSlop={12}>
          <FontAwesomeIcon
            icon={faForwardStep}
            size={24}
            color="rgba(255, 255, 255, 0.7)"
          />
        </Pressable>
      </View>
    </View>
  );
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
