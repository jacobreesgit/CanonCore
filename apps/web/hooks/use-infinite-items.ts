"use client";

import { useInfiniteQuery, keepPreviousData } from "@tanstack/react-query";
import type { PaginatedResult } from "@/lib/types";

interface UseInfiniteItemsOptions<T> {
  queryKey: unknown[];
  fetchAction: (cursor: string | null) => Promise<PaginatedResult<T>>;
  initialData?: PaginatedResult<T>;
  enabled?: boolean;
  /** Cap the number of pages kept in memory (default: 5). */
  maxPages?: number;
}

export function useInfiniteItems<T>({
  queryKey,
  fetchAction,
  initialData,
  enabled = true,
  maxPages = 5,
}: UseInfiniteItemsOptions<T>) {
  const query = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) => fetchAction(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    placeholderData: keepPreviousData,
    enabled,
    maxPages,
    ...(initialData && {
      initialData: {
        pages: [initialData],
        pageParams: [null],
      },
    }),
  });

  const items = query.data?.pages.flatMap((page) => page.items) ?? [];

  return {
    items,
    fetchNextPage: query.fetchNextPage,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    isLoading: query.isLoading,
    isPlaceholderData: query.isPlaceholderData,
    refetch: query.refetch,
  };
}
