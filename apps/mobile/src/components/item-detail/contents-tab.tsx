import { useCallback } from "react";
import { ItemCard } from "@/components/item-card";
import { GridLayout } from "@/components/grid-layout";
import { EmptyState } from "@/components/empty-state";
import { LoadingGrid } from "@/components/loading-grid";
import { useTRPC } from "@/lib/trpc";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/ctx";

interface ContentsTabProps {
  parentId: string;
}

export function ContentsTab({ parentId }: ContentsTabProps) {
  const { user } = useSession();
  const trpc = useTRPC();

  const childrenQuery = useQuery(trpc.item.list.queryOptions({ parentId }));

  // item.list returns ItemWithArtwork[] directly (not PaginatedResult)
  const items = childrenQuery.data ?? [];

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
          href={hasChildren ? `/library/${item.id}` : `/item/${item.id}`}
        />
      );
    },
    [user?.username],
  );

  if (childrenQuery.isLoading) {
    return <LoadingGrid count={4} />;
  }

  if (items.length === 0) {
    return (
      <EmptyState
        title="No contents"
        message="This item has no children yet."
      />
    );
  }

  return (
    <GridLayout
      data={items}
      renderItem={renderItem}
      keyExtractor={(item: { id: string }) => item.id}
      isRefreshing={childrenQuery.isRefetching}
      onRefresh={() => childrenQuery.refetch()}
    />
  );
}
