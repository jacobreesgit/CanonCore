import { View, Text, Pressable } from "@/tw";
import { Alert } from "react-native";
import { useStorageInfo } from "@/hooks/use-storage-info";
import { useDownloadManager } from "@/components/providers/download-manager-provider";

interface StorageInfoProps {
  onCleared?: () => void;
}

export function StorageInfo({ onCleared }: StorageInfoProps) {
  const { usedFormatted, limitFormatted, usageRatio } = useStorageInfo();
  const manager = useDownloadManager();

  const handleClearAll = () => {
    Alert.alert(
      "Clear All Downloads",
      "This will delete all downloaded files from your device. You can re-download them later.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear All",
          style: "destructive",
          onPress: async () => {
            await manager.removeAll();
            onCleared?.();
          },
        },
      ],
    );
  };

  const barColor =
    usageRatio > 0.9
      ? "bg-red-500"
      : usageRatio > 0.7
        ? "bg-yellow-500"
        : "bg-blue-500";

  return (
    <View className="px-4 py-3 gap-2">
      {/* Usage bar */}
      <View className="h-2 bg-white/10 rounded-full overflow-hidden">
        <View
          className={`h-full rounded-full ${barColor}`}
          style={{ width: `${Math.min(usageRatio * 100, 100)}%` }}
        />
      </View>

      {/* Labels */}
      <View className="flex-row items-center justify-between">
        <Text className="text-neutral-400 text-xs">
          {usedFormatted} of {limitFormatted} used
        </Text>
        <Pressable onPress={handleClearAll}>
          <Text className="text-red-400 text-xs font-medium">Clear All</Text>
        </Pressable>
      </View>
    </View>
  );
}
