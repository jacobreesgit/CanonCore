/**
 * Client-side wrapper for ItemsView with connection filtering.
 * Manages filter state and refetches items when filter changes.
 */

"use client";

import { Suspense, useState, useCallback, useTransition } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";
import { ItemsView } from "./items-view";
import type { ItemWithArtwork } from "@/lib/types";
import { getItems } from "@/lib/item-actions";
import { getItemsByConnection } from "@/lib/sftp-actions";

interface FilteredItemsViewProps {
  /** Initial items to display (pre-filtered on server) */
  initialItems: ItemWithArtwork[];
  /** Available SFTP connections for filtering */
  connections: Array<{ id: string; name: string }>;
  /** Initial connection filter from server-side searchParams */
  initialConnectionId: string | null;
}

/**
 * Inner component that uses useSearchParams (requires Suspense boundary).
 */
function FilteredItemsViewInner({
  initialItems,
  connections,
  initialConnectionId,
}: FilteredItemsViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Get filter from URL, fallback to initial server value
  const urlConnectionId = searchParams.get("connection") ?? initialConnectionId;
  const [items, setItems] = useState<ItemWithArtwork[]>(initialItems);

  // Auto-select connection when there's exactly one
  const hasSingleConnection = connections.length === 1;
  const connectionId = hasSingleConnection
    ? connections[0].id
    : urlConnectionId;

  /**
   * Refetches items based on current filter state.
   */
  const refetchItems = useCallback(async () => {
    startTransition(async () => {
      const result = connectionId
        ? await getItemsByConnection(connectionId, null)
        : await getItems(null);

      if (result.success && result.data) {
        setItems(result.data);
      }
    });
  }, [connectionId]);

  const handleConnectionChange = useCallback(
    async (newConnectionId: string | null) => {
      // Update URL
      const params = new URLSearchParams(searchParams.toString());
      if (newConnectionId) {
        params.set("connection", newConnectionId);
      } else {
        params.delete("connection");
      }
      const newUrl = params.toString()
        ? `${pathname}?${params.toString()}`
        : pathname;
      router.push(newUrl);

      // Fetch filtered items
      startTransition(async () => {
        const result = newConnectionId
          ? await getItemsByConnection(newConnectionId, null)
          : await getItems(null);

        if (result.success && result.data) {
          setItems(result.data);
        }
      });
    },
    [router, pathname, searchParams]
  );

  return (
    <ItemsView
      items={items}
      parentId={null}
      connectionId={connectionId}
      connections={connections}
      selectedConnectionId={connectionId}
      onConnectionChange={handleConnectionChange}
      isFilterPending={isPending}
      onSyncComplete={refetchItems}
    />
  );
}

/**
 * ItemsView with connection filtering support.
 * Wrapped in Suspense for useSearchParams hydration safety.
 *
 * @param initialItems - Initial items to display (pre-filtered on server)
 * @param connections - Available SFTP connections for filtering
 * @param initialConnectionId - Connection filter from server searchParams
 */
export function FilteredItemsView(props: FilteredItemsViewProps) {
  return (
    <Suspense
      fallback={
        <div className="text-muted-foreground flex items-center gap-2">
          <Loader2 className="size-4 animate-spin" />
          <span>Loading...</span>
        </div>
      }
    >
      <FilteredItemsViewInner {...props} />
    </Suspense>
  );
}
