import { useCallback, useState, useEffect } from "react";
import { View, Pressable } from "@/tw";
import { ItemCard } from "@/components/item-card";
import { GridLayout } from "@/components/grid-layout";
import { SearchBar } from "@/components/search-bar";
import { EmptyState } from "@/components/empty-state";
import { LoadingGrid } from "@/components/loading-grid";
import { useDebouncedSearch } from "@/hooks/use-debounced-search";
import { useTRPC } from "@/lib/trpc";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/ctx";
import { useLocalSearchParams } from "expo-router";
import { CreatePlaylistSheet } from "@/components/playlist/create-playlist-sheet";
import { FontAwesomeIcon } from "@fortawesome/react-native-fontawesome";
import { faPlus } from "@fortawesome/free-solid-svg-icons";

export default function LibraryScreen() {
  const { user } = useSession();
  const trpc = useTRPC();
  const { inputValue, debouncedValue, setValue, clear } = useDebouncedSearch();
  const { create } = useLocalSearchParams<{ create?: string }>();
  const [createPlaylistVisible, setCreatePlaylistVisible] = useState(false);

  // Auto-open create playlist sheet via deep link (?create=1)
  useEffect(() => {
    if (create === "1") {
      setCreatePlaylistVisible(true);
    }
  }, [create]);

  // Fetch root items (parentId = null)
  const itemsQuery = useQuery(trpc.item.list.queryOptions({ parentId: null }));

  const items = itemsQuery.data ?? [];

  // Client-side search filter
  const filteredItems = debouncedValue
    ? items.filter((item: { name: string }) =>
        item.name.toLowerCase().includes(debouncedValue.toLowerCase()),
      )
    : items;

  const renderItem = useCallback(
    ({ item }: { item: (typeof items)[number] }) => {
      const hasChildren = item.childCount > 0;
      return (
        <ItemCard
          id={item.id}
          name={item.name}
          primaryFileId={item.artworkId ?? null}
          tmdbPosterPath={item.tmdbPosterPath ?? null}
          dominantColour={item.dominantColour ?? null}
          primaryDurationMs={item.primaryDurationMs ?? null}
          primaryHeight={item.primaryHeight ?? null}
          childCount={item.childCount}
          ownerUsername={user?.username ?? ""}
          isOwn
          href={hasChildren ? `/library/${item.id}` : undefined}
        />
      );
    },
    [user?.username],
  );

  if (itemsQuery.isLoading) {
    return (
      <View className="flex-1 bg-background">
        <SearchBar
          value={inputValue}
          onChangeText={setValue}
          onClear={clear}
          placeholder="Search library..."
        />
        <LoadingGrid />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <SearchBar
        value={inputValue}
        onChangeText={setValue}
        onClear={clear}
        placeholder="Search library..."
      />
      <GridLayout
        data={filteredItems}
        renderItem={renderItem}
        keyExtractor={(item: { id: string }) => item.id}
        isRefreshing={itemsQuery.isRefetching}
        onRefresh={() => itemsQuery.refetch()}
        ListEmptyComponent={
          <EmptyState
            title={debouncedValue ? "No results" : "Library empty"}
            message={
              debouncedValue
                ? "No items match your search."
                : "Add items to your library to see them here."
            }
          />
        }
      />

      {/* Create Playlist FAB */}
      <Pressable
        testID="create-playlist-button"
        onPress={() => setCreatePlaylistVisible(true)}
        className="absolute bottom-6 right-6 bg-indigo-500 rounded-full w-14 h-14 items-center justify-center"
        style={{ elevation: 4 }}
      >
        <FontAwesomeIcon icon={faPlus} size={20} color="#ffffff" />
      </Pressable>

      <CreatePlaylistSheet
        visible={createPlaylistVisible}
        onClose={() => setCreatePlaylistVisible(false)}
      />
    </View>
  );
}
