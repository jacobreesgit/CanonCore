import { useRef, useCallback } from "react";
import { StyleSheet, Platform } from "react-native";
import { VideoView, VideoAirPlayButton as AirPlayButton } from "expo-video";
import type { VideoView as VideoViewType } from "expo-video";
import { View, Pressable } from "@/tw";
import { FontAwesomeIcon } from "@fortawesome/react-native-fontawesome";
import { faArrowUpRightFromSquare } from "@fortawesome/free-solid-svg-icons";
import { usePlayback } from "@/components/providers/playback-provider";

interface VideoViewportProps {
  variant?: "expanded" | "compact";
}

export function VideoViewport({ variant = "expanded" }: VideoViewportProps) {
  const { videoPlayer } = usePlayback();
  const videoRef = useRef<VideoViewType>(null);

  const handlePiP = useCallback(() => {
    videoRef.current?.startPictureInPicture().catch(() => {});
  }, []);

  return (
    <View
      className={
        variant === "expanded"
          ? "w-full aspect-video bg-black"
          : "w-full aspect-video bg-black max-h-[240px]"
      }
    >
      <VideoView
        ref={videoRef}
        player={videoPlayer.player}
        style={StyleSheet.absoluteFill}
        allowsFullscreen
        allowsPictureInPicture
        nativeControls={false}
      />

      {/* Overlay controls: AirPlay + PiP */}
      <View className="absolute top-2 right-2 flex-row items-center gap-2">
        {Platform.OS === "ios" ? (
          <AirPlayButton
            style={{ width: 28, height: 28 }}
            tint="#ffffff"
            prioritizeVideoDevices
          />
        ) : null}
        <Pressable onPress={handlePiP} hitSlop={8}>
          <FontAwesomeIcon
            icon={faArrowUpRightFromSquare}
            size={16}
            color="#ffffff"
          />
        </Pressable>
      </View>
    </View>
  );
}
