/**
 * Hook for fetching first incomplete item and navigating to it.
 * Used by ItemDetailClient and My Items page for "Go to" button.
 */

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getFirstIncompleteItem } from "@/lib/item-actions";
import type { NextItem } from "@/lib/types";

interface UseGoToItemOptions {
  /** Optional parent ID to search within (null = entire library). */
  parentId?: string | null;
  /** Whether to enable fetching (default: true). */
  enabled?: boolean;
}

interface UseGoToItemReturn {
  /** First incomplete item, null if all complete, undefined while loading. */
  nextItem: NextItem | null | undefined;
  /** Whether fetch is in progress. */
  isLoading: boolean;
  /** Navigate to the next incomplete item. */
  goToNext: (item: NextItem) => void;
  /** Refetch the first incomplete item. */
  refetch: () => Promise<void>;
}

/**
 * Fetches the first incomplete item and provides navigation.
 *
 * @param options - Hook options
 * @returns Next item data and navigation handler
 *
 * @example
 * const { nextItem, goToNext } = useGoToItem({ parentId: item.id });
 * // Pass to ItemHero: nextItem={nextItem ?? null} onGoToNext={goToNext}
 */
export function useGoToItem({
  parentId,
  enabled = true,
}: UseGoToItemOptions = {}): UseGoToItemReturn {
  const router = useRouter();
  const [nextItem, setNextItem] = useState<NextItem | null | undefined>(
    undefined
  );
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Fetches the first incomplete item from server.
   */
  const fetchNextItem = useCallback(async () => {
    if (!enabled) return;

    setIsLoading(true);
    try {
      const result = await getFirstIncompleteItem(parentId);
      if (result.success) {
        setNextItem(result.data);
      } else {
        setNextItem(null);
      }
    } catch {
      setNextItem(null);
    } finally {
      setIsLoading(false);
    }
  }, [parentId, enabled]);

  // Fetch on mount and when parentId changes
  useEffect(() => {
    fetchNextItem();
  }, [fetchNextItem]);

  /**
   * Navigates to the next incomplete item.
   */
  const goToNext = useCallback(
    (item: NextItem) => {
      router.push(`/my-items/${item.id}`);
    },
    [router]
  );

  return {
    nextItem,
    isLoading,
    goToNext,
    refetch: fetchNextItem,
  };
}
