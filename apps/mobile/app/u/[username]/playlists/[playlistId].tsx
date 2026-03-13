import { useLocalSearchParams } from "expo-router";
import { View, Text } from "@/tw";
import { ActivityIndicator, ScrollView } from "react-native";
import { Stack } from "expo-router/stack";
import { useTRPC } from "@/lib/trpc";
import { useQuery } from "@tanstack/react-query";
import { PlaylistDetailHero } from "@/components/playlist/playlist-detail-hero";
import { PlaylistDetailTabs } from "@/components/playlist/playlist-detail-tabs";

export default function PublicPlaylistDetailScreen() {
  const { username, playlistId } = useLocalSearchParams<{
    username: string;
    playlistId: string;
  }>();
  const trpc = useTRPC();

  // public.getPlaylistDetail returns { playlist, items }
  const playlistQuery = useQuery(
    trpc.public.getPlaylistDetail.queryOptions({ playlistId })
  );

  if (playlistQuery.isLoading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <Stack.Screen options={{ title: "" }} />
        <ActivityIndicator color="#ffffff" />
      </View>
    );
  }

  if (playlistQuery.isError || !playlistQuery.data) {
    return (
      <View className="flex-1 bg-background items-center justify-center px-8">
        <Stack.Screen options={{ title: "Not found" }} />
        <Text className="text-foreground text-lg font-semibold mb-2">
          Playlist not found
        </Text>
        <Text className="text-muted-foreground text-center">
          This playlist may have been removed or made private.
        </Text>
      </View>
    );
  }

  const { playlist, items } = playlistQuery.data;

  // Map flat public items to the PlaylistItem shape expected by PlaylistDetailTabs
  const mappedItems = items.map((item, index) => ({
    playlistItemId: item.id,
    order: index,
    addedAt: new Date(),
    item: {
      id: item.id,
      name: item.name,
      tmdbPosterPath: item.tmdbPosterPath ?? null,
      dominantColour: item.dominantColour ?? null,
      primaryDurationMs: null,
      primaryHeight: null,
      artworkId: item.artworkId ?? null,
    },
  }));

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen
        options={{ title: playlist.name, headerTransparent: true }}
      />

      <ScrollView
        className="flex-1"
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        <PlaylistDetailHero
          playlist={{
            id: playlist.id,
            name: playlist.name,
            description: playlist.description ?? null,
            dominantColour: playlist.dominantColour ?? null,
            hasArtwork: playlist.hasArtwork ?? false,
            items: items.map((item) => ({
              item: {
                tmdbBackdropPath: null,
                tmdbPosterPath: item.tmdbPosterPath ?? null,
                artworkId: item.artworkId ?? null,
              },
            })),
          }}
          itemCount={items.length}
        />

        <PlaylistDetailTabs
          playlistId={playlistId}
          items={mappedItems}
          description={playlist.description ?? null}
          isPublic
          createdAt={playlist.createdAt}
          ownerUsername={username}
        />
      </ScrollView>
    </View>
  );
}
