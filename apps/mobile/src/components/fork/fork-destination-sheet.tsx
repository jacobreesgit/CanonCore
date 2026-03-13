import { useCallback } from "react";
import { View, Text, Pressable } from "@/tw";
import { Modal, FlatList, ActivityIndicator, Alert } from "react-native";
import { Image } from "@/tw/image";
import { FontAwesomeIcon } from "@fortawesome/react-native-fontawesome";
import {
  faXmark,
  faFolder,
  faFolderOpen,
} from "@fortawesome/free-solid-svg-icons";
import { useTRPC } from "@/lib/trpc";
import { useQuery } from "@tanstack/react-query";
import { useFork } from "@/hooks/use-fork";
import { getArtworkUrl, getTmdbPosterUrl } from "@/lib/image-url";
import { router } from "expo-router";

interface ForkDestinationSheetProps {
  visible: boolean;
  onClose: () => void;
  sourceItemId: string;
  sourceItemName: string;
}

type FolderItem = {
  id: string;
  name: string;
  tmdbPosterPath: string | null;
  dominantColour: string | null;
  artworkId: string | null;
  childCount: number;
};

function FolderRow({
  item,
  onPress,
}: {
  item: FolderItem;
  onPress: () => void;
}) {
  const imageSource = item.artworkId
    ? getArtworkUrl(item.artworkId)
    : item.tmdbPosterPath
      ? getTmdbPosterUrl(item.tmdbPosterPath, "w185")
      : null;

  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-3 px-4 py-3 active:bg-white/5"
    >
      {imageSource ? (
        <Image
          source={imageSource}
          className="rounded bg-card"
          style={{ width: 40, height: 40 }}
          transition={200}
        />
      ) : (
        <View
          className="rounded items-center justify-center"
          style={[
            { width: 40, height: 40 },
            item.dominantColour
              ? { backgroundColor: item.dominantColour }
              : { backgroundColor: "rgba(255, 255, 255, 0.08)" },
          ]}
        >
          <FontAwesomeIcon
            icon={faFolder}
            size={18}
            color="rgba(255, 255, 255, 0.5)"
          />
        </View>
      )}
      <View className="flex-1">
        <Text
          className="text-foreground text-sm font-medium"
          numberOfLines={1}
        >
          {item.name}
        </Text>
        {item.childCount > 0 ? (
          <Text className="text-muted-foreground text-xs">
            {item.childCount} {item.childCount === 1 ? "item" : "items"}
          </Text>
        ) : null}
      </View>
      <FontAwesomeIcon
        icon={faFolder}
        size={14}
        color="rgba(255, 255, 255, 0.3)"
      />
    </Pressable>
  );
}

export function ForkDestinationSheet({
  visible,
  onClose,
  sourceItemId,
  sourceItemName,
}: ForkDestinationSheetProps) {
  const trpc = useTRPC();
  const fork = useFork();

  const rootItemsQuery = useQuery(
    trpc.item.list.queryOptions({ parentId: null })
  );

  // Only show folders (items with children) as valid destinations
  const folders: FolderItem[] = (rootItemsQuery.data ?? []).filter(
    (item) => item.childCount > 0 && item.id !== sourceItemId
  );

  const handleFork = useCallback(
    (parentId: string | null) => {
      fork.mutate(
        { sourceItemId, parentId },
        {
          onSuccess: (data) => {
            onClose();
            Alert.alert("Forked!", `"${sourceItemName}" has been forked.`, [
              { text: "Dismiss", style: "cancel" },
              {
                text: "View",
                onPress: () => router.push(`/item/${data.itemId}`),
              },
            ]);
          },
          onError: (error) => {
            Alert.alert(
              "Fork Failed",
              error?.message ?? "Something went wrong. Please try again."
            );
          },
        }
      );
    },
    [fork, sourceItemId, sourceItemName, onClose]
  );

  const renderFolder = useCallback(
    ({ item }: { item: FolderItem }) => (
      <FolderRow item={item} onPress={() => handleFork(item.id)} />
    ),
    [handleFork]
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="formSheet"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-background">
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
          <Pressable onPress={onClose} hitSlop={8}>
            <FontAwesomeIcon icon={faXmark} size={18} color="#ffffff" />
          </Pressable>
          <Text className="text-foreground text-base font-semibold">
            Fork to...
          </Text>
          <View style={{ width: 18 }} />
        </View>

        {/* Source item label */}
        <View className="px-4 py-2 border-b border-border">
          <Text className="text-muted-foreground text-xs" numberOfLines={1}>
            Forking:{" "}
            <Text className="text-foreground text-xs font-medium">
              {sourceItemName}
            </Text>
          </Text>
        </View>

        {fork.isPending ? (
          <View className="flex-1 items-center justify-center gap-3">
            <ActivityIndicator color="#ffffff" size="large" />
            <Text className="text-muted-foreground text-sm">Forking...</Text>
          </View>
        ) : rootItemsQuery.isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#ffffff" />
          </View>
        ) : (
          <FlatList
            data={folders}
            renderItem={renderFolder}
            keyExtractor={(item) => item.id}
            ListHeaderComponent={
              /* My Items (Root) option */
              <Pressable
                onPress={() => handleFork(null)}
                className="flex-row items-center gap-3 px-4 py-3 active:bg-white/5 border-b border-border"
              >
                <View
                  className="rounded items-center justify-center"
                  style={{
                    width: 40,
                    height: 40,
                    backgroundColor: "rgba(99, 102, 241, 0.15)",
                  }}
                >
                  <FontAwesomeIcon
                    icon={faFolderOpen}
                    size={18}
                    color="#6366f1"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-foreground text-sm font-medium">
                    My Items (Root)
                  </Text>
                  <Text className="text-muted-foreground text-xs">
                    Add to your top-level library
                  </Text>
                </View>
              </Pressable>
            }
            ListEmptyComponent={
              folders.length === 0 && !rootItemsQuery.isLoading ? (
                <View className="items-center py-8">
                  <Text className="text-muted-foreground text-sm">
                    No folders available
                  </Text>
                </View>
              ) : null
            }
            contentContainerStyle={{ paddingBottom: 24 }}
          />
        )}

        {/* Cancel button */}
        <View className="px-4 py-3 border-t border-border">
          <Pressable
            onPress={onClose}
            disabled={fork.isPending}
            className="items-center py-3 rounded-lg bg-card active:bg-white/10"
            style={{ opacity: fork.isPending ? 0.5 : 1 }}
          >
            <Text className="text-foreground text-base font-medium">
              Cancel
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
