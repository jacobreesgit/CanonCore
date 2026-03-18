import { useCallback } from "react";
import { View, Text } from "@/tw";
import { FlatList } from "react-native";
import { FontAwesomeIcon } from "@fortawesome/react-native-fontawesome";
import { faDownload } from "@fortawesome/free-solid-svg-icons";
import { useDownloads } from "@/hooks/use-downloads";
import { DownloadItem } from "@/components/downloads/download-item";
import { StorageInfo } from "@/components/downloads/storage-info";
import type { DownloadRecord } from "@/db/schema";

function Separator() {
  return <View className="h-px bg-white/10 mx-4" />;
}

export default function DownloadsScreen() {
  const { downloads, isLoading, refresh } = useDownloads();

  const handleRemoved = useCallback(() => {
    refresh();
  }, [refresh]);

  const handleCleared = useCallback(() => {
    refresh();
  }, [refresh]);

  const renderItem = useCallback(
    ({ item }: { item: DownloadRecord }) => (
      <DownloadItem download={item} onRemoved={handleRemoved} />
    ),
    [handleRemoved],
  );

  const renderEmpty = useCallback(
    () => (
      <View className="flex-1 items-center justify-center py-20 gap-3">
        <FontAwesomeIcon
          icon={faDownload}
          size={40}
          color="rgba(255, 255, 255, 0.15)"
        />
        <Text className="text-neutral-400 text-sm">No downloads yet</Text>
        <Text className="text-neutral-400 text-xs text-center px-12">
          Download items from their detail pages to watch offline
        </Text>
      </View>
    ),
    [],
  );

  return (
    <FlatList
      testID="downloads-list"
      data={downloads}
      keyExtractor={(item) => item.fileId}
      renderItem={renderItem}
      ListHeaderComponent={
        downloads.length > 0 ? <StorageInfo onCleared={handleCleared} /> : null
      }
      ListEmptyComponent={isLoading ? null : renderEmpty}
      contentInsetAdjustmentBehavior="automatic"
      ItemSeparatorComponent={Separator}
      style={{ backgroundColor: "#0a0a0a" }}
    />
  );
}
