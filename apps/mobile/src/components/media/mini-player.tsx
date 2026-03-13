import { useCallback } from "react";
import { View, Text, Pressable } from "@/tw";
import { Image } from "expo-image";
import { FontAwesomeIcon } from "@fortawesome/react-native-fontawesome";
import {
  faPlay,
  faPause,
  faForwardStep,
} from "@fortawesome/free-solid-svg-icons";
import { useAppSelector, useAppDispatch } from "@canoncore/store/hooks";
import {
  selectCurrentTrack,
  selectHasNext,
} from "@canoncore/store/selectors";
import { skipNext } from "@canoncore/store/playback";
import { usePlayback } from "@/components/providers/playback-provider";
import { MiniPlayerProgress } from "./mini-player-progress";
import { useIsPlaying } from "react-native-track-player";
import { router } from "expo-router";
import { CastButtonWrapper } from "@/components/cast/cast-button";
import { CastControls } from "@/components/cast/cast-controls";
import { useCastPlayback } from "@/hooks/use-cast-playback";

export function MiniPlayer() {
  const dispatch = useAppDispatch();
  const currentTrack = useAppSelector(selectCurrentTrack);
  const hasNext = useAppSelector(selectHasNext);
  const { activePlayer, play, pause, videoPlayer } = usePlayback();

  const { isCasting, deviceName } = useCastPlayback();
  const { playing: audioPlaying } = useIsPlaying();
  const isPlaying =
    activePlayer === "audio" ? audioPlaying : videoPlayer.isPlaying;

  const handlePlayPause = useCallback(async () => {
    if (isPlaying) {
      await pause();
    } else {
      await play();
    }
  }, [isPlaying, play, pause]);

  const handleSkipNext = useCallback(() => {
    dispatch(skipNext());
  }, [dispatch]);

  const handleExpand = useCallback(() => {
    router.push("/player");
  }, []);

  if (!currentTrack) return null;

  return (
    <View className="bg-card border-t border-border">
      <MiniPlayerProgress />

      <Pressable
        onPress={handleExpand}
        className="flex-row items-center gap-3 px-4 py-2.5"
      >
        {/* Artwork thumbnail */}
        {currentTrack.posterUrl ? (
          <Image
            source={{ uri: currentTrack.posterUrl }}
            style={{
              width: 40,
              height: 40,
              borderRadius: 6,

            }}
            contentFit="cover"
          />
        ) : (
          <View
            className="bg-white/10 items-center justify-center"
            style={{
              width: 40,
              height: 40,
              borderRadius: 6,

            }}
          >
            <FontAwesomeIcon
              icon={faPlay}
              size={14}
              color="rgba(255, 255, 255, 0.5)"
            />
          </View>
        )}

        {/* Track info */}
        <View className="flex-1 gap-0.5">
          <Text className="text-foreground text-sm font-medium" numberOfLines={1}>
            {currentTrack.itemName}
          </Text>
          <Text className="text-muted-foreground text-xs" numberOfLines={1}>
            {isCasting ? `Casting to ${deviceName}` : currentTrack.filename}
          </Text>
        </View>

        {/* Controls — cast or local */}
        {isCasting ? (
          <CastControls variant="mini" deviceName={deviceName} />
        ) : (
          <View className="flex-row items-center gap-4">
            <Pressable
              onPress={handlePlayPause}
              hitSlop={8}
              className="items-center justify-center"
            >
              <FontAwesomeIcon
                icon={isPlaying ? faPause : faPlay}
                size={18}
                color="#ffffff"
              />
            </Pressable>

            {hasNext ? (
              <Pressable
                onPress={handleSkipNext}
                hitSlop={8}
                className="items-center justify-center"
              >
                <FontAwesomeIcon
                  icon={faForwardStep}
                  size={16}
                  color="#ffffff"
                />
              </Pressable>
            ) : null}
          </View>
        )}

        {/* Cast button — visible when devices available */}
        <CastButtonWrapper size={20} tintColor="rgba(255, 255, 255, 0.7)" />
      </Pressable>
    </View>
  );
}
