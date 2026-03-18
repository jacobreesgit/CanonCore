import { useCallback } from "react";
import { View, Text, Pressable } from "@/tw";
import { Image } from "@/tw/image";
import { ActivityIndicator, Alert } from "react-native";
import { FontAwesomeIcon } from "@fortawesome/react-native-fontawesome";
import {
  faMusic,
  faCircleCheck,
  faRotateRight,
  faClock,
  faTrash,
} from "@fortawesome/free-solid-svg-icons";
import { router } from "expo-router";
import type { DownloadRecord } from "@/db/schema";
import { useDownloadManager } from "@/components/providers/download-manager-provider";
import { formatBytes } from "@/lib/format-bytes";

interface DownloadItemProps {
  download: DownloadRecord;
  onRemoved?: () => void;
}

export function DownloadItem({ download, onRemoved }: DownloadItemProps) {
  const manager = useDownloadManager();

  const handlePress = useCallback(() => {
    router.push(`/item/${download.itemId}`);
  }, [download.itemId]);

  const handleRemove = useCallback(() => {
    Alert.alert(
      "Remove Download",
      `Delete "${download.itemName}" from downloads?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            await manager.remove(download.fileId);
            onRemoved?.();
          },
        },
      ],
    );
  }, [download, manager, onRemoved]);

  const progressPercent =
    download.totalBytes > 0
      ? Math.min((download.bytesDownloaded / download.totalBytes) * 100, 100)
      : 0;

  return (
    <Pressable
      onPress={handlePress}
      className="flex-row items-center gap-3 px-4 py-3"
    >
      {/* Artwork */}
      {download.posterUrl ? (
        <Image
          source={{ uri: download.posterUrl }}
          style={{
            width: 48,
            height: 48,
            borderRadius: 8,
          }}
          contentFit="cover"
        />
      ) : (
        <View
          className="bg-white/10 items-center justify-center"
          style={{
            width: 48,
            height: 48,
            borderRadius: 8,
          }}
        >
          <FontAwesomeIcon
            icon={faMusic}
            size={16}
            color="rgba(255, 255, 255, 0.3)"
          />
        </View>
      )}

      {/* Info */}
      <View className="flex-1 gap-0.5">
        <Text className="text-white text-sm font-medium" numberOfLines={1}>
          {download.itemName}
        </Text>
        <View className="flex-row items-center gap-2">
          <Text
            className="text-neutral-400 text-xs flex-shrink"
            numberOfLines={1}
          >
            {download.filename}
          </Text>
          {download.totalBytes > 0 ? (
            <Text className="text-neutral-400 text-xs">
              · {formatBytes(download.totalBytes)}
            </Text>
          ) : null}
        </View>

        {/* Progress bar for active downloads */}
        {download.status === "downloading" ? (
          <View className="h-1 bg-white/10 rounded-full mt-1 overflow-hidden">
            <View
              className="h-full bg-blue-500 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </View>
        ) : null}
      </View>

      {/* Status / Actions */}
      <View className="flex-row items-center gap-2">
        {download.status === "downloading" ? (
          <ActivityIndicator size="small" color="#3b82f6" />
        ) : download.status === "queued" ? (
          <FontAwesomeIcon
            icon={faClock}
            size={14}
            color="rgba(255, 255, 255, 0.4)"
          />
        ) : download.status === "complete" ? (
          <FontAwesomeIcon icon={faCircleCheck} size={14} color="#22c55e" />
        ) : download.status === "failed" ? (
          <FontAwesomeIcon icon={faRotateRight} size={14} color="#ef4444" />
        ) : null}

        <Pressable onPress={handleRemove} hitSlop={8}>
          <FontAwesomeIcon
            icon={faTrash}
            size={14}
            color="rgba(255, 255, 255, 0.4)"
          />
        </Pressable>
      </View>
    </Pressable>
  );
}
