import { useState, useCallback, useEffect } from "react";
import { View, Text, Pressable } from "@/tw";
import { Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FontAwesomeIcon } from "@fortawesome/react-native-fontawesome";
import { faChevronDown, faListUl } from "@fortawesome/free-solid-svg-icons";
import { faChromecast } from "@fortawesome/free-brands-svg-icons";
import type { IconProp } from "@fortawesome/fontawesome-svg-core";
import { Stack } from "expo-router/stack";
import { router } from "expo-router";
import { useAppSelector } from "@canoncore/store/hooks";
import {
  selectCurrentTrack,
  selectIsVideoFile,
  selectQueue,
} from "@canoncore/store/selectors";
import { VideoViewport } from "@/components/media/video-viewport";
import { AudioArtwork } from "@/components/media/audio-artwork";
import { PlaybackControls } from "@/components/media/playback-controls";
import { QueuePanel } from "@/components/media/queue-panel";
import { CastButtonWrapper } from "@/components/cast/cast-button";
import { CastControls } from "@/components/cast/cast-controls";
import { useCastPlayback } from "@/hooks/use-cast-playback";
import { VideoAirPlayButton as AirPlayButton } from "expo-video";

export default function ExpandedPlayerScreen() {
  const currentTrack = useAppSelector(selectCurrentTrack);
  const isVideo = useAppSelector(selectIsVideoFile);
  const queue = useAppSelector(selectQueue);
  const [queueVisible, setQueueVisible] = useState(false);
  const { isCasting, deviceName } = useCastPlayback();

  const handleDismiss = useCallback(() => {
    router.back();
  }, []);

  const toggleQueue = useCallback(() => {
    setQueueVisible((v) => !v);
  }, []);

  // Dismiss modal when track stops
  useEffect(() => {
    if (!currentTrack) {
      router.back();
    }
  }, [currentTrack]);

  if (!currentTrack) return null;

  return (
    <SafeAreaView testID="expanded-player" style={{ flex: 1, backgroundColor: "#0a0a0a" }} edges={["top"]}>
      <Stack.Screen
        options={{
          headerShown: false,
          presentation: "modal",
          contentStyle: { backgroundColor: "#0a0a0a" },
        }}
      />

      {queueVisible ? (
        <QueuePanel
          visible={queueVisible}
          onClose={() => setQueueVisible(false)}
        />
      ) : (
        <View className="flex-1">
          {/* Top bar: dismiss + AirPlay + Cast + queue toggle */}
          <View className="flex-row items-center justify-between px-4 py-2">
            <Pressable testID="close-player" onPress={handleDismiss} hitSlop={8}>
              <FontAwesomeIcon
                icon={faChevronDown}
                size={18}
                color="#ffffff"
              />
            </Pressable>
            <Text className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
              Now Playing
            </Text>
            <View className="flex-row items-center gap-3">
              {Platform.OS === "ios" ? (
                <AirPlayButton
                  style={{ width: 22, height: 22 }}
                  tint="#ffffff"
                  prioritizeVideoDevices
                />
              ) : null}
              <CastButtonWrapper size={22} tintColor="#ffffff" />
              <Pressable testID="queue-button" onPress={toggleQueue} hitSlop={8}>
                <FontAwesomeIcon
                  icon={faListUl}
                  size={18}
                  color={queue.length > 0 ? "#ffffff" : "rgba(255, 255, 255, 0.3)"}
                />
              </Pressable>
            </View>
          </View>

          {/* Media viewport */}
          <View className="flex-1 justify-center">
            {isCasting ? (
              <View className="flex-1 items-center justify-center gap-4">
                <FontAwesomeIcon
                  icon={faChromecast as IconProp}
                  size={48}
                  color="rgba(255, 255, 255, 0.3)"
                />
                <Text className="text-muted-foreground text-sm">
                  Casting to {deviceName}
                </Text>
              </View>
            ) : isVideo ? (
              <VideoViewport variant="expanded" />
            ) : (
              <AudioArtwork posterUrl={currentTrack.posterUrl} />
            )}
          </View>

          {/* Track info */}
          <View className="px-6 gap-1 mb-2">
            <Text className="text-foreground text-lg font-semibold" numberOfLines={1}>
              {currentTrack.itemName}
            </Text>
            <Text className="text-muted-foreground text-sm" numberOfLines={1}>
              {currentTrack.filename}
            </Text>
          </View>

          {/* Transport controls — cast or local */}
          {isCasting ? (
            <CastControls variant="expanded" deviceName={deviceName} />
          ) : (
            <PlaybackControls />
          )}

          {/* Bottom spacer for safe area */}
          <View className="h-8" />
        </View>
      )}
    </SafeAreaView>
  );
}
