import { useState } from "react";
import { View, Text, Pressable } from "@/tw";
import {
  Modal,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { FontAwesomeIcon } from "@fortawesome/react-native-fontawesome";
import { faXmark, faCheck, faPlus } from "@fortawesome/free-solid-svg-icons";
import { useTRPC } from "@/lib/trpc";
import { useQuery } from "@tanstack/react-query";
import { usePlaylistMutations } from "@/hooks/use-playlist-mutations";

interface PlaylistEntry {
  id: string;
  name: string;
  isMember: boolean;
}

interface AddToPlaylistSheetProps {
  visible: boolean;
  onClose: () => void;
  itemId: string;
  onCreatePlaylist?: () => void;
}

export function AddToPlaylistSheet({
  visible,
  onClose,
  itemId,
  onCreatePlaylist,
}: AddToPlaylistSheetProps) {
  const trpc = useTRPC();
  const { addItems, removeItem } = usePlaylistMutations();

  // Track in-flight toggles to prevent double-taps
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  const { data: playlists, isLoading, isError } = useQuery(
    trpc.playlist.getForItem.queryOptions(
      { itemId },
      { enabled: visible && !!itemId }
    )
  );

  const handleToggle = (playlist: PlaylistEntry) => {
    if (pendingIds.has(playlist.id)) return;

    setPendingIds((prev) => new Set(prev).add(playlist.id));

    if (playlist.isMember) {
      removeItem.mutate(
        { playlistId: playlist.id, itemId },
        {
          onSettled: () => {
            setPendingIds((prev) => {
              const next = new Set(prev);
              next.delete(playlist.id);
              return next;
            });
          },
        }
      );
    } else {
      addItems.mutate(
        { itemId, playlistIds: [playlist.id] },
        {
          onSettled: () => {
            setPendingIds((prev) => {
              const next = new Set(prev);
              next.delete(playlist.id);
              return next;
            });
          },
        }
      );
    }
  };

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
            Add to Playlist
          </Text>
          {/* Spacer to balance header */}
          <View style={{ width: 18 }} />
        </View>

        {/* New playlist button */}
        {onCreatePlaylist ? (
          <Pressable
            onPress={() => {
              onClose();
              onCreatePlaylist();
            }}
            className="flex-row items-center gap-3 px-4 py-3 border-b border-border"
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                backgroundColor: "rgba(99, 102, 241, 0.15)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <FontAwesomeIcon icon={faPlus} size={14} color="#6366f1" />
            </View>
            <Text className="text-primary text-sm font-medium">
              New Playlist
            </Text>
          </Pressable>
        ) : null}

        {/* Loading state */}
        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#6366f1" />
          </View>
        ) : isError ? (
          <View className="flex-1 items-center justify-center px-6">
            <Text className="text-muted-foreground text-sm text-center">
              Failed to load playlists
            </Text>
          </View>
        ) : playlists && playlists.length === 0 ? (
          <View className="flex-1 items-center justify-center px-6">
            <Text className="text-muted-foreground text-sm text-center">
              No playlists yet. Create one to get started.
            </Text>
          </View>
        ) : (
          <FlatList
            data={playlists}
            keyExtractor={(item) => item.id}
            renderItem={({ item: playlist }) => {
              const isPending = pendingIds.has(playlist.id);
              return (
                <Pressable
                  onPress={() => handleToggle(playlist)}
                  disabled={isPending}
                  className="flex-row items-center justify-between px-4 py-3 border-b border-border"
                  style={{ opacity: isPending ? 0.6 : 1 }}
                >
                  <Text className="text-foreground text-sm flex-1 mr-3" numberOfLines={1}>
                    {playlist.name}
                  </Text>
                  <View
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 6,
                      borderWidth: 2,
                      borderColor: playlist.isMember
                        ? "#6366f1"
                        : "rgba(255,255,255,0.3)",
                      backgroundColor: playlist.isMember
                        ? "#6366f1"
                        : "transparent",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {isPending ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : playlist.isMember ? (
                      <FontAwesomeIcon icon={faCheck} size={12} color="#ffffff" />
                    ) : null}
                  </View>
                </Pressable>
              );
            }}
          />
        )}
      </View>
    </Modal>
  );
}
