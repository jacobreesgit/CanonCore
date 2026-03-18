import { ScrollView, View } from "@/tw";
import { ActivityIndicator } from "react-native";
import { SectionHeader } from "@/components/section-header";
import { ShelfRow } from "@/components/shelf-row";
import { EmptyState } from "@/components/empty-state";
import { useTRPC } from "@/lib/trpc";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/ctx";

export default function HomeScreen() {
  const { user } = useSession();
  const trpc = useTRPC();

  // Fetch shelves
  const shelvesQuery = useQuery(trpc.shelf.getHomeShelves.queryOptions());

  // Fetch root items sorted by updatedAt (shows recently updated)
  const recentQuery = useQuery(
    trpc.item.list.queryOptions({ parentId: null })
  );

  const shelves = shelvesQuery.data ?? [];
  // Take the first 10 items as "recently updated"
  const recentItems = (recentQuery.data ?? []).slice(0, 10);
  const isLoading = shelvesQuery.isLoading || recentQuery.isLoading;

  if (isLoading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator color="#ffffff" />
      </View>
    );
  }

  return (
    <ScrollView
      testID="home-screen"
      className="flex-1 bg-background"
      contentInsetAdjustmentBehavior="automatic"
    >
      {/* Recently Updated */}
      {recentItems.length > 0 ? (
        <View className="mb-6">
          <SectionHeader title="Recently Updated" />
          <ShelfRow
            items={recentItems.map((item) => ({
              id: item.id,
              name: item.name,
              tmdbPosterPath: item.tmdbPosterPath,
              artworkId: item.artworkId ?? null,
              childCount: item.childCount,
              playbackProgress: null,
            }))}
            ownerUsername={user?.username ?? ""}
            isOwn
          />
        </View>
      ) : null}

      {/* Shelves */}
      {shelves.map((shelf) => (
        <View key={shelf.playlistId} className="mb-6">
          <SectionHeader title={shelf.name} />
          <ShelfRow
            items={shelf.items}
            ownerUsername={user?.username ?? ""}
            isOwn
          />
        </View>
      ))}

      {/* Empty state when no shelves and no recent items */}
      {shelves.length === 0 && recentItems.length === 0 ? (
        <EmptyState
          title="Welcome to CanonCore"
          message="Your library is empty. Add items to get started."
        />
      ) : null}
    </ScrollView>
  );
}
