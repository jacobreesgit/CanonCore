import { StyleSheet } from "react-native";
import { VideoView } from "expo-video";
import { View } from "@/tw";
import { usePlayback } from "@/components/providers/playback-provider";

interface VideoViewportProps {
  variant?: "expanded" | "compact";
}

export function VideoViewport({ variant = "expanded" }: VideoViewportProps) {
  const { videoPlayer } = usePlayback();

  return (
    <View
      className={
        variant === "expanded"
          ? "w-full aspect-video bg-black"
          : "w-full aspect-video bg-black max-h-[240px]"
      }
    >
      <VideoView
        player={videoPlayer.player}
        style={StyleSheet.absoluteFill}
        allowsFullscreen
        allowsPictureInPicture
        nativeControls={false}
      />
    </View>
  );
}
