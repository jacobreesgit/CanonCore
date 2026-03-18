import { useState } from "react";
import { View, Text, Pressable } from "@/tw";
import { useTRPCClient } from "@canoncore/api/client";
import { useInfiniteList } from "@/hooks/use-infinite-list";
import { GridLayout } from "@/components/grid-layout";
import { ItemCard } from "@/components/item-card";
import { PlaylistCard } from "@/components/playlist/playlist-card";
import { EmptyState } from "@/components/empty-state";

type Tab = "items" | "playlists";

interface ExploreTabsProps {
  search: string;
}

export function ExploreTabs({ search }: ExploreTabsProps) {
  const [activeTab, setActiveTab] = useState<Tab>("items");
  const trpc = useTRPCClient();

  const {
    items: exploreItems,
    isLoading: itemsLoading,
    fetchNextPage: loadMoreItems,
    isFetchingNextPage: isLoadingMoreItems,
  } = useInfiniteList({
    queryKey: ["explore", "items", search],
    queryFn: (cursor) =>
      trpc.explore.getItems.query({ cursor: cursor ?? undefined, search }),
    enabled: activeTab === "items",
  });

  const {
    items: explorePlaylists,
    isLoading: playlistsLoading,
    fetchNextPage: loadMorePlaylists,
    isFetchingNextPage: isLoadingMorePlaylists,
  } = useInfiniteList({
    queryKey: ["explore", "playlists", search],
    queryFn: (cursor) =>
      trpc.explore.getPlaylists.query({
        cursor: cursor ?? undefined,
        search,
      }),
    enabled: activeTab === "playlists",
  });

  return (
    <View className="flex-1">
      {/* Tab switcher */}
      <View className="flex-row mx-4 mb-3 border border-border rounded-lg overflow-hidden">
        <Pressable
          testID="explore-tab-items"
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
          testID="explore-tab-playlists"
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
          data={exploreItems}
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
              ownerUsername={item.ownerUsername}
              href={`/u/${item.ownerUsername}/${item.id}`}
            />
          )}
          onEndReached={loadMoreItems}
          isLoadingMore={isLoadingMoreItems}
          ListEmptyComponent={
            itemsLoading ? null : (
              <EmptyState
                title="No items found"
                message={
                  search
                    ? "Try a different search term."
                    : "No public items have been shared yet."
                }
              />
            )
          }
        />
      )}

      {/* Playlists tab */}
      {activeTab === "playlists" && (
        <GridLayout
          data={explorePlaylists}
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
              href={`/u/${playlist.ownerUsername}/playlists/${playlist.id}`}
              ownerUsername={playlist.ownerUsername}
            />
          )}
          onEndReached={loadMorePlaylists}
          isLoadingMore={isLoadingMorePlaylists}
          ListEmptyComponent={
            playlistsLoading ? null : (
              <EmptyState
                title="No playlists found"
                message={
                  search
                    ? "Try a different search term."
                    : "No public playlists have been shared yet."
                }
              />
            )
          }
        />
      )}
    </View>
  );
}
