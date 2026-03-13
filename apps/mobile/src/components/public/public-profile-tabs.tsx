import { useState } from "react";
import { View, Text, Pressable } from "@/tw";
import { useTRPCClient } from "@canoncore/api/client";
import { useInfiniteList } from "@/hooks/use-infinite-list";
import { GridLayout } from "@/components/grid-layout";
import { ItemCard } from "@/components/item-card";
import { PlaylistCard } from "@/components/playlist/playlist-card";
import { EmptyState } from "@/components/empty-state";

type Tab = "items" | "playlists";

interface PublicProfileTabsProps {
  userId: string;
  username: string;
  search: string;
}

export function PublicProfileTabs({
  userId,
  username,
  search,
}: PublicProfileTabsProps) {
  const [activeTab, setActiveTab] = useState<Tab>("items");
  const trpc = useTRPCClient();

  const {
    items: profileItems,
    isLoading: itemsLoading,
    fetchNextPage: fetchMoreItems,
    isFetchingNextPage: isLoadingMoreItems,
  } = useInfiniteList({
    queryKey: ["profile", "items", userId, search],
    queryFn: (cursor) =>
      trpc.public.getProfileItems.query({
        userId,
        cursor: cursor ?? undefined,
        search: search || undefined,
      }),
    enabled: activeTab === "items",
  });

  const {
    items: profilePlaylists,
    isLoading: playlistsLoading,
    fetchNextPage: fetchMorePlaylists,
    isFetchingNextPage: isLoadingMorePlaylists,
  } = useInfiniteList({
    queryKey: ["profile", "playlists", userId, search],
    queryFn: (cursor) =>
      trpc.public.getProfilePlaylists.query({
        userId,
        cursor: cursor ?? undefined,
        search: search || undefined,
      }),
    enabled: activeTab === "playlists",
  });

  return (
    <View className="flex-1">
      {/* Tab switcher */}
      <View className="flex-row mx-4 mb-3 border border-border rounded-lg overflow-hidden">
        <Pressable
          className={`flex-1 py-2 items-center ${activeTab === "items" ? "bg-primary" : "bg-card"}`}
          onPress={() => setActiveTab("items")}
        >
          <Text
            className={`text-sm font-medium ${activeTab === "items" ? "text-primary-foreground" : "text-muted-foreground"}`}
          >
            Items
          </Text>
        </Pressable>
        <Pressable
          className={`flex-1 py-2 items-center ${activeTab === "playlists" ? "bg-primary" : "bg-card"}`}
          onPress={() => setActiveTab("playlists")}
        >
          <Text
            className={`text-sm font-medium ${activeTab === "playlists" ? "text-primary-foreground" : "text-muted-foreground"}`}
          >
            Playlists
          </Text>
        </Pressable>
      </View>

      {/* Items tab */}
      {activeTab === "items" && (
        <GridLayout
          data={profileItems}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ItemCard
              id={item.id}
              name={item.name}
              primaryFileId={item.artworkId ?? null}
              tmdbPosterPath={item.tmdbPosterPath ?? null}
              dominantColour={item.dominantColour ?? null}
              primaryDurationMs={null}
              primaryHeight={null}
              ownerUsername={username}
              href={`/u/${username}/${item.id}`}
            />
          )}
          onEndReached={() => {
            fetchMoreItems();
          }}
          isLoadingMore={isLoadingMoreItems}
          ListEmptyComponent={
            itemsLoading ? null : (
              <EmptyState
                title="No items"
                message={
                  search
                    ? "No items match your search."
                    : "This profile has no public items yet."
                }
              />
            )
          }
        />
      )}

      {/* Playlists tab */}
      {activeTab === "playlists" && (
        <GridLayout
          data={profilePlaylists}
          keyExtractor={(playlist) => playlist.id}
          renderItem={({ item: playlist }) => (
            <PlaylistCard
              playlist={{
                id: playlist.id,
                name: playlist.name,
                itemCount: playlist.itemCount,
                hasArtwork: playlist.hasArtwork,
                previewPosters: playlist.previewPosters,
              }}
              href={`/u/${username}/playlists/${playlist.id}`}
              ownerUsername={username}
            />
          )}
          onEndReached={() => {
            fetchMorePlaylists();
          }}
          isLoadingMore={isLoadingMorePlaylists}
          ListEmptyComponent={
            playlistsLoading ? null : (
              <EmptyState
                title="No playlists"
                message={
                  search
                    ? "No playlists match your search."
                    : "This profile has no public playlists yet."
                }
              />
            )
          }
        />
      )}
    </View>
  );
}
