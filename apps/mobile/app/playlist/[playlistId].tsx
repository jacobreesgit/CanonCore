import { useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { View, Text, Pressable } from "@/tw";
import { ActivityIndicator } from "react-native";
import { Stack } from "expo-router/stack";
import { FontAwesomeIcon } from "@fortawesome/react-native-fontawesome";
import { faGear } from "@fortawesome/free-solid-svg-icons";
import { ScrollView } from "@/tw";
import { useTRPC } from "@/lib/trpc";
import { useQuery } from "@tanstack/react-query";

import { PlaylistDetailHero } from "@/components/playlist/playlist-detail-hero";
import { PlaylistDetailTabs } from "@/components/playlist/playlist-detail-tabs";
import { EditPlaylistSheet } from "@/components/playlist/edit-playlist-sheet";
import { useSession } from "@/ctx";

export default function PlaylistDetailScreen() {
  const { playlistId } = useLocalSearchParams<{ playlistId: string }>();
  const router = useRouter();
  const { user } = useSession();
  const trpc = useTRPC();

  const [editVisible, setEditVisible] = useState(false);

  const playlistQuery = useQuery(
    trpc.playlist.get.queryOptions({ playlistId })
  );

  // Loading state
  if (playlistQuery.isLoading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <Stack.Screen options={{ title: "" }} />
        <ActivityIndicator color="#ffffff" />
      </View>
    );
  }

  // Error state
  if (playlistQuery.isError || !playlistQuery.data) {
    return (
      <View className="flex-1 bg-background items-center justify-center px-8">
        <Stack.Screen options={{ title: "Error" }} />
        <Text className="text-foreground text-lg font-semibold mb-2">
          Playlist not found
        </Text>
        <Text className="text-muted-foreground text-center">
          This playlist may have been deleted or you don&apos;t have access.
        </Text>
      </View>
    );
  }

  const playlist = playlistQuery.data;
  const itemCount = playlist.items.length;

  // Build hero-compatible items shape
  const heroItems = playlist.items.map((pi) => ({
    item: {
      tmdbBackdropPath: pi.item.tmdbBackdropPath ?? null,
      tmdbPosterPath: pi.item.tmdbPosterPath ?? null,
      artworkId: pi.item.artworkId ?? null,
    },
  }));

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen
        options={{
          title: playlist.name,
          headerTransparent: true,
          headerRight: () => (
            <Pressable
              onPress={() => setEditVisible(true)}
              hitSlop={8}
              style={{ paddingHorizontal: 4 }}
            >
              <FontAwesomeIcon icon={faGear} size={18} color="#ffffff" />
            </Pressable>
          ),
        }}
      />

      <ScrollView
        className="flex-1"
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        {/* Hero section */}
        <PlaylistDetailHero
          playlist={{
            id: playlist.id,
            name: playlist.name,
            description: playlist.description,
            dominantColour: playlist.dominantColour,
            hasArtwork: playlist.hasArtwork,
            items: heroItems,
          }}
          itemCount={itemCount}
        />

        {/* Tabs */}
        <PlaylistDetailTabs
          items={playlist.items.map((pi) => ({
            playlistItemId: pi.playlistItemId,
            order: pi.order,
            addedAt: pi.addedAt,
            item: {
              id: pi.item.id,
              name: pi.item.name,
              tmdbPosterPath: pi.item.tmdbPosterPath ?? null,
              dominantColour: pi.item.dominantColour ?? null,
              primaryDurationMs: pi.item.primaryDurationMs ?? null,
              primaryHeight: pi.item.primaryHeight ?? null,
              artworkId: pi.item.artworkId ?? null,
            },
          }))}
          description={playlist.description}
          isPublic={playlist.isPublic}
          createdAt={playlist.createdAt}
          ownerUsername={user?.username ?? ""}
          playlistId={playlist.id}
        />
      </ScrollView>

      {/* Edit sheet */}
      <EditPlaylistSheet
        visible={editVisible}
        onClose={() => setEditVisible(false)}
        playlist={{
          id: playlist.id,
          name: playlist.name,
          description: playlist.description,
          isPublic: playlist.isPublic,
          shareToken: playlist.shareToken,
        }}
        onDeleted={() => {
          setEditVisible(false);
          router.back();
        }}
      />
    </View>
  );
}
