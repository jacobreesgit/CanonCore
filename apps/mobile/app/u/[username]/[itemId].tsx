import { useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { View, Text, Pressable } from "@/tw";
import { ActivityIndicator, ScrollView } from "react-native";
import { Stack } from "expo-router/stack";
import { useTRPC } from "@/lib/trpc";
import { useQuery } from "@tanstack/react-query";
import { FontAwesomeIcon } from "@fortawesome/react-native-fontawesome";
import { faCodeBranch, faPlus } from "@fortawesome/free-solid-svg-icons";
import { getArtworkUrl, getTmdbBackdropUrl } from "@/lib/image-url";
import { CinematicHero } from "@/components/cinematic-hero";
import { HeroContent } from "@/components/hero-content";
import { ForkDestinationSheet } from "@/components/fork/fork-destination-sheet";
import { AddToPlaylistSheet } from "@/components/playlist/add-to-playlist-sheet";
import { CreatePlaylistSheet } from "@/components/playlist/create-playlist-sheet";

export default function PublicItemDetailScreen() {
  const { itemId } = useLocalSearchParams<{ username: string; itemId: string }>();
  const trpc = useTRPC();

  const [forkVisible, setForkVisible] = useState(false);
  const [addToPlaylistVisible, setAddToPlaylistVisible] = useState(false);
  const [createPlaylistVisible, setCreatePlaylistVisible] = useState(false);

  const itemQuery = useQuery(
    trpc.public.getItemDetail.queryOptions({ itemId })
  );

  // Loading state
  if (itemQuery.isLoading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <Stack.Screen options={{ title: "" }} />
        <ActivityIndicator color="#ffffff" />
      </View>
    );
  }

  // Error / not found
  if (itemQuery.isError || !itemQuery.data) {
    return (
      <View className="flex-1 bg-background items-center justify-center px-8">
        <Stack.Screen options={{ title: "Not found" }} />
        <Text className="text-foreground text-lg font-semibold mb-2">
          Item not found
        </Text>
        <Text className="text-muted-foreground text-center">
          This item may have been removed or made private.
        </Text>
      </View>
    );
  }

  const item = itemQuery.data;

  // Resolve backdrop: artworkId > TMDB backdrop
  const backdropUrl = item.artworkId
    ? getArtworkUrl(item.artworkId)
    : item.tmdbBackdropPath
      ? getTmdbBackdropUrl(item.tmdbBackdropPath)
      : null;

  // Build subtitle from description
  const subtitle = item.description
    ? item.description.length > 100
      ? `${item.description.slice(0, 100)}…`
      : item.description
    : undefined;

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ title: item.name, headerTransparent: true }} />

      <ScrollView
        className="flex-1"
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        {/* Cinematic hero */}
        <CinematicHero
          backdropUrl={backdropUrl}
          dominantColour={item.dominantColour ?? null}
        >
          <HeroContent title={item.name} subtitle={subtitle}>
            {/* Fork button */}
            <Pressable
              onPress={() => setForkVisible(true)}
              className="flex-row items-center gap-2 bg-white/15 rounded-full px-4 py-2"
            >
              <FontAwesomeIcon icon={faCodeBranch} size={14} color="#ffffff" />
              <Text className="text-white text-sm font-medium">Fork</Text>
            </Pressable>

            {/* Add to playlist button */}
            <Pressable
              onPress={() => setAddToPlaylistVisible(true)}
              className="flex-row items-center gap-2 bg-white/15 rounded-full px-4 py-2"
            >
              <FontAwesomeIcon icon={faPlus} size={14} color="#ffffff" />
              <Text className="text-white text-sm font-medium">Add to Playlist</Text>
            </Pressable>
          </HeroContent>
        </CinematicHero>

        {/* Description (full) */}
        {item.description ? (
          <View className="px-4 pt-4 pb-6">
            <Text className="text-foreground/80 text-sm leading-5">
              {item.description}
            </Text>
          </View>
        ) : null}
      </ScrollView>

      {/* Fork sheet */}
      <ForkDestinationSheet
        visible={forkVisible}
        onClose={() => setForkVisible(false)}
        sourceItemId={itemId}
        sourceItemName={item.name}
      />

      {/* Add to playlist sheet */}
      <AddToPlaylistSheet
        visible={addToPlaylistVisible}
        onClose={() => setAddToPlaylistVisible(false)}
        itemId={itemId}
        onCreatePlaylist={() => {
          setAddToPlaylistVisible(false);
          setCreatePlaylistVisible(true);
        }}
      />

      {/* Create playlist sheet (launched from add-to-playlist) */}
      <CreatePlaylistSheet
        visible={createPlaylistVisible}
        onClose={() => setCreatePlaylistVisible(false)}
        initialItemIds={[itemId]}
      />
    </View>
  );
}
