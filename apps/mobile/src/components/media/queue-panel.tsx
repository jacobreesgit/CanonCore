import { useCallback } from "react";
import { View, Text, Pressable } from "@/tw";
import { FlatList } from "react-native";
import { Image } from "expo-image";
import { FontAwesomeIcon } from "@fortawesome/react-native-fontawesome";
import { faMusic, faListUl } from "@fortawesome/free-solid-svg-icons";
import { useAppDispatch, useAppSelector } from "@canoncore/store/hooks";
import { selectQueue, selectQueueIndex } from "@canoncore/store/selectors";
import { skipToIndex } from "@canoncore/store/playback";
import type { QueueTrack } from "@canoncore/store/types";

interface QueuePanelProps {
  visible: boolean;
  onClose: () => void;
}

function QueueItem({
  track,
  isActive,
  onPress,
}: {
  track: QueueTrack;
  isActive: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center gap-3 px-4 py-2.5 ${
        isActive ? "bg-white/5" : ""
      }`}
    >
      {track.posterUrl ? (
        <Image
          source={{ uri: track.posterUrl }}
          style={{
            width: 36,
            height: 36,
            borderRadius: 4,
          }}
          contentFit="cover"
        />
      ) : (
        <View
          className="bg-white/10 items-center justify-center"
          style={{
            width: 36,
            height: 36,
            borderRadius: 4,
          }}
        >
          <FontAwesomeIcon
            icon={faMusic}
            size={12}
            color="rgba(255, 255, 255, 0.3)"
          />
        </View>
      )}
      <View className="flex-1 gap-0.5">
        <Text
          className={`text-sm ${isActive ? "text-primary font-semibold" : "text-foreground"}`}
          numberOfLines={1}
        >
          {track.itemName}
        </Text>
        <Text className="text-muted-foreground text-xs" numberOfLines={1}>
          {track.filename}
        </Text>
      </View>
    </Pressable>
  );
}

export function QueuePanel({ visible, onClose }: QueuePanelProps) {
  const dispatch = useAppDispatch();
  const queue = useAppSelector(selectQueue);
  const queueIndex = useAppSelector(selectQueueIndex);

  const handleTrackPress = useCallback(
    (index: number) => {
      dispatch(skipToIndex(index));
    },
    [dispatch],
  );

  if (!visible || queue.length === 0) return null;

  // Show only up-next tracks (after current)
  const upNext = queue.filter((_item, i) => i !== queueIndex);

  return (
    <View testID="queue-panel" className="flex-1 bg-card/95 rounded-t-2xl">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
        <View className="flex-row items-center gap-2">
          <FontAwesomeIcon
            icon={faListUl}
            size={14}
            color="rgba(255, 255, 255, 0.7)"
          />
          <Text className="text-foreground text-sm font-semibold">
            Queue ({queue.length})
          </Text>
        </View>
        <Pressable onPress={onClose} hitSlop={8}>
          <Text className="text-primary text-sm">Done</Text>
        </Pressable>
      </View>

      {/* Up Next list */}
      <FlatList
        data={upNext}
        keyExtractor={(item) => item.fileId}
        renderItem={({ item }) => {
          const originalIndex = queue.findIndex(
            (t) => t.fileId === item.fileId,
          );
          return (
            <QueueItem
              track={item}
              isActive={originalIndex === queueIndex}
              onPress={() => handleTrackPress(originalIndex)}
            />
          );
        }}
        contentInsetAdjustmentBehavior="automatic"
      />
    </View>
  );
}
