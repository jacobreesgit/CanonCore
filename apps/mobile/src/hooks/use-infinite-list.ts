import { useInfiniteQuery } from "@tanstack/react-query";

interface PaginatedResult<T> {
  items: T[];
  nextCursor: string | null;
}

interface UseInfiniteListOptions<T> {
  queryKey: readonly unknown[];
  queryFn: (cursor: string | null) => Promise<PaginatedResult<T>>;
  enabled?: boolean;
  maxPages?: number;
}

/**
 * Generic infinite scroll hook for FlatList.
 *
 * Usage with FlatList:
 *   onEndReached={() => { if (hasNextPage && !isFetchingNextPage) fetchNextPage(); }}
 *   onEndReachedThreshold={0.5}
 */
export function useInfiniteList<T>({
  queryKey,
  queryFn,
  enabled = true,
  maxPages = 5,
}: UseInfiniteListOptions<T>) {
  const query = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) => queryFn(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled,
    maxPages,
  });

  const items = query.data?.pages.flatMap((page) => page.items) ?? [];

  return {
    items,
    fetchNextPage: query.fetchNextPage,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    isRefetching: query.isRefetching,
  } as const;
}
