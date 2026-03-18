import { useCallback } from "react";
import { useLocalSearchParams } from "expo-router";
import { View } from "@/tw";
import { ItemCard } from "@/components/item-card";
import { GridLayout } from "@/components/grid-layout";
import { SearchBar } from "@/components/search-bar";
import { EmptyState } from "@/components/empty-state";
import { LoadingGrid } from "@/components/loading-grid";
import { useDebouncedSearch } from "@/hooks/use-debounced-search";
import { useTRPC } from "@/lib/trpc";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/ctx";
import { Stack } from "expo-router/stack";

export default function LibraryFolderScreen() {
  const { parentId } = useLocalSearchParams<{ parentId: string }>();
  const { user } = useSession();
  const trpc = useTRPC();
  const { inputValue, debouncedValue, setValue, clear } = useDebouncedSearch();

  const itemsQuery = useQuery(trpc.item.list.queryOptions({ parentId }));

  // Fetch the parent item for the header title
  const parentQuery = useQuery(trpc.item.get.queryOptions({ id: parentId }));

  const items = itemsQuery.data ?? [];
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
        <Stack.Screen options={{ title: "Loading..." }} />
        <LoadingGrid />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen
        options={{ title: parentQuery.data?.item.name ?? "Library" }}
      />
      <SearchBar
        value={inputValue}
        onChangeText={setValue}
        onClear={clear}
        placeholder="Search folder..."
      />
      <GridLayout
        data={filteredItems}
        renderItem={renderItem}
        keyExtractor={(item: { id: string }) => item.id}
        isRefreshing={itemsQuery.isRefetching}
        onRefresh={() => itemsQuery.refetch()}
        ListEmptyComponent={
          <EmptyState
            title={debouncedValue ? "No results" : "Folder empty"}
            message={
              debouncedValue
                ? "No items match your search."
                : "This folder has no items yet."
            }
          />
        }
      />
    </View>
  );
}
