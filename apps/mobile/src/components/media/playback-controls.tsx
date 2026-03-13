import { useCallback, useState } from "react";
import { View, Text, Pressable } from "@/tw";
import { FontAwesomeIcon } from "@fortawesome/react-native-fontawesome";
import {
  faPlay,
  faPause,
  faForwardStep,
  faBackwardStep,
  faShuffle,
  faRepeat,
} from "@fortawesome/free-solid-svg-icons";
import { useAppDispatch, useAppSelector } from "@canoncore/store/hooks";
import {
  selectShuffle,
  selectRepeat,
  selectHasNext,
  selectHasPrevious,
} from "@canoncore/store/selectors";
import {
  skipNext,
  skipPrevious,
  toggleShuffle,
  setRepeat,
} from "@canoncore/store/playback";
import type { RepeatMode } from "@canoncore/store/types";
import { usePlayback } from "@/components/providers/playback-provider";
import { useAudioProgress } from "@/hooks/use-audio-progress";
import { useIsPlaying } from "react-native-track-player";
import Slider from "@react-native-community/slider";

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  if (mins >= 60) {
    const hours = Math.floor(mins / 60);
    const remainMins = mins % 60;
    return `${hours}:${remainMins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

const REPEAT_CYCLE: RepeatMode[] = ["off", "all", "one"];

export function PlaybackControls() {
  const dispatch = useAppDispatch();
  const shuffleOn = useAppSelector(selectShuffle);
  const repeat = useAppSelector(selectRepeat);
  const hasNext = useAppSelector(selectHasNext);
  const hasPrevious = useAppSelector(selectHasPrevious);

  const { activePlayer, play, pause, seekTo, videoPlayer } = usePlayback();
  const audioProgress = useAudioProgress();
  const { playing: audioPlaying } = useIsPlaying();

  const isPlaying =
    activePlayer === "audio" ? audioPlaying : videoPlayer.isPlaying;

  const position =
    activePlayer === "audio"
      ? audioProgress.position
      : videoPlayer.currentTime;
  const duration =
    activePlayer === "audio"
      ? audioProgress.duration
      : videoPlayer.duration;

  const [isSeeking, setIsSeeking] = useState(false);
  const [seekValue, setSeekValue] = useState(0);

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

  const handleSkipPrevious = useCallback(() => {
    dispatch(skipPrevious());
  }, [dispatch]);

  const handleToggleShuffle = useCallback(() => {
    dispatch(toggleShuffle());
  }, [dispatch]);

  const handleCycleRepeat = useCallback(() => {
    const currentIdx = REPEAT_CYCLE.indexOf(repeat);
    const nextMode = REPEAT_CYCLE[(currentIdx + 1) % REPEAT_CYCLE.length];
    dispatch(setRepeat(nextMode));
  }, [repeat, dispatch]);

  const handleSeekStart = useCallback(() => {
    setIsSeeking(true);
    setSeekValue(position);
  }, [position]);

  const handleSeekChange = useCallback((value: number) => {
    setSeekValue(value);
  }, []);

  const handleSeekEnd = useCallback(
    async (value: number) => {
      await seekTo(value);
      setIsSeeking(false);
    },
    [seekTo]
  );

  const displayPosition = isSeeking ? seekValue : position;

  return (
    <View className="px-6 gap-4">
      {/* Seek bar */}
      <View className="gap-1">
        <Slider
          style={{ width: "100%", height: 24 }}
          value={displayPosition}
          minimumValue={0}
          maximumValue={duration > 0 ? duration : 1}
          minimumTrackTintColor="#ffffff"
          maximumTrackTintColor="rgba(255, 255, 255, 0.2)"
          thumbTintColor="#ffffff"
          onSlidingStart={handleSeekStart}
          onValueChange={handleSeekChange}
          onSlidingComplete={handleSeekEnd}
        />
        <View className="flex-row justify-between">
          <Text className="text-muted-foreground text-xs" style={{ fontVariant: ["tabular-nums"] }}>
            {formatTime(displayPosition)}
          </Text>
          <Text className="text-muted-foreground text-xs" style={{ fontVariant: ["tabular-nums"] }}>
            {duration > 0 ? `-${formatTime(duration - displayPosition)}` : "0:00"}
          </Text>
        </View>
      </View>

      {/* Transport controls */}
      <View className="flex-row items-center justify-between">
        {/* Shuffle */}
        <Pressable onPress={handleToggleShuffle} hitSlop={8}>
          <FontAwesomeIcon
            icon={faShuffle}
            size={18}
            color={shuffleOn ? "#3b82f6" : "rgba(255, 255, 255, 0.5)"}
          />
        </Pressable>

        {/* Skip Previous */}
        <Pressable
          onPress={handleSkipPrevious}
          disabled={!hasPrevious}
          hitSlop={8}
          style={{ opacity: hasPrevious ? 1 : 0.3 }}
        >
          <FontAwesomeIcon icon={faBackwardStep} size={24} color="#ffffff" />
        </Pressable>

        {/* Play / Pause */}
        <Pressable
          onPress={handlePlayPause}
          className="w-16 h-16 rounded-full bg-white items-center justify-center"
        >
          <FontAwesomeIcon
            icon={isPlaying ? faPause : faPlay}
            size={24}
            color="#0a0a0a"
          />
        </Pressable>

        {/* Skip Next */}
        <Pressable
          onPress={handleSkipNext}
          disabled={!hasNext}
          hitSlop={8}
          style={{ opacity: hasNext ? 1 : 0.3 }}
        >
          <FontAwesomeIcon icon={faForwardStep} size={24} color="#ffffff" />
        </Pressable>

        {/* Repeat */}
        <Pressable onPress={handleCycleRepeat} hitSlop={8}>
          <View className="relative">
            <FontAwesomeIcon
              icon={faRepeat}
              size={18}
              color={repeat !== "off" ? "#3b82f6" : "rgba(255, 255, 255, 0.5)"}
            />
            {repeat === "one" ? (
              <View className="absolute -top-1 -right-2 bg-primary rounded-full w-3.5 h-3.5 items-center justify-center">
                <Text className="text-white text-[8px] font-bold">1</Text>
              </View>
            ) : null}
          </View>
        </Pressable>
      </View>
    </View>
  );
}
