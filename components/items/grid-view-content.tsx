/**
 * Grid view content for the items view.
 * Renders editing SortableGrid or view-mode pinned/unpinned sections
 * with context menus and poster cards.
 */

"use client";

import { createContext, useCallback, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { UniqueIdentifier } from "@dnd-kit/core";
import { Section } from "@/components/ui/section";
import { Skeleton } from "@/components/ui/skeleton";
import { ItemContextMenu } from "./item-context-menu";
import { GridItem } from "@/components/sortable-grid/grid-item";
import type { ItemVisibilityOptions, ItemWithArtwork } from "@/lib/types";
import type { CreateItemResult } from "./add-item-dialog";
import {
  markAsWatched,
  markAsUnwatched,
  markAllWatched,
  markAllUnwatched,
} from "@/lib/watch-actions";
import type { ItemResult } from "@/lib/types";
import { useAppDispatch } from "@/lib/store/hooks";
import { playQueue, playNext, addToQueue } from "@/lib/store/playback-slice";
import { buildQueueTrack } from "@/lib/store/track-helpers";
import { getItemFiles } from "@/lib/item-file-actions";
import type { QueueTrack } from "@/lib/store/types";

/**
 * Context providing item action callbacks to server-rendered shelf components.
 * Consumed by ShelfRow to wire up context menus and click handlers.
 */
export interface ShelfActionsContextValue {
  onItemClick: (id: string) => void;
  onOpenSettings: (id: string) => Promise<void>;
  onDeleteItem: (id: string) => Promise<void>;
  onPinItem: (id: string) => Promise<void>;
  onUnpinItem: (id: string) => Promise<void>;
  onMarkWatched: (id: string) => Promise<void>;
  onMarkUnwatched: (id: string) => Promise<void>;
  onMarkAllWatched: (id: string) => Promise<void>;
  onMarkAllUnwatched: (id: string) => Promise<void>;
  onAddChild?: (
    parentId: string,
    name: string,
    description?: string,
    visibilityOptions?: ItemVisibilityOptions
  ) => Promise<CreateItemResult>;
  onAddChildComplete?: () => Promise<void>;
  hasDriveConnection: boolean;
}

export const ShelfActionsContext =
  createContext<ShelfActionsContextValue | null>(null);

/** Loading skeleton for grid view during edit mode chunk load. */
function GridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-5">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="aspect-[2/3] w-full rounded-lg" />
      ))}
    </div>
  );
}

// Dynamic import for edit mode (~15KB dnd-kit loaded on demand)
const SortableGrid = dynamic(
  () => import("@/components/sortable-grid").then((mod) => mod.SortableGrid),
  { loading: () => <GridSkeleton />, ssr: false }
);

// Dynamic import for Move To dialog (avoids loading tree picker in initial bundle)
const MoveToDialog = dynamic(
  () =>
    import("@/components/items/move-to-dialog").then((mod) => ({
      default: mod.MoveToDialog,
    })),
  { ssr: false }
);

interface CurrentUser {
  id: string;
  username: string | null;
  name: string | null;
}

interface GridViewContentProps {
  /** Whether edit/reorder mode is active. */
  isEditing: boolean;
  /** Items at the current hierarchy level (sorted + filtered). */
  currentLevelItems: ItemWithArtwork[];
  /** Pinned items (sorted by pinnedOrder). */
  pinnedItems: ItemWithArtwork[];
  /** Unpinned items. */
  unpinnedItems: ItemWithArtwork[];
  /** Callback when grid items are reordered in edit mode. */
  onItemsChange: (items: ItemWithArtwork[]) => Promise<void>;
  /** Callback when an item is clicked (navigates to detail). */
  onItemClick: (id: UniqueIdentifier) => void;
  /** Callback to open settings dialog for an item. */
  onOpenSettings: (id: string) => Promise<void>;
  /** Callback to delete an item. */
  onDeleteItem: (id: string) => Promise<void>;
  /** Callback to move an item to a different parent. */
  onMoveItem: (
    itemId: string,
    newParentId: string | null
  ) => Promise<ItemResult>;
  /** Callback to pin an item to the sidebar. */
  onPinItem: (id: string) => Promise<void>;
  /** Callback to unpin an item from the sidebar. */
  onUnpinItem: (id: string) => Promise<void>;
  /** Callback to add a child item. */
  onAddChild?(
    parentId: string,
    name: string,
    description?: string,
    visibilityOptions?: ItemVisibilityOptions
  ): Promise<CreateItemResult>;
  /** Callback to refresh data after child item is created. */
  onAddChildComplete?(): Promise<void>;
  /** Whether Google Drive is connected. */
  hasDriveConnection: boolean;
  /** Check if an item is selected (for bulk operations). */
  isItemSelected: (id: string) => boolean;
  /** Callback when item selection changes. */
  onItemSelectChange: (id: string, selected: boolean) => void;
  /** Current user info for owner display in grid items. */
  currentUser?: CurrentUser | null;
  /** Server-rendered shelves inserted between pinned and library sections. */
  shelves?: React.ReactNode;
  /** Callback when mouse enters a grid item (for prefetch). */
  onItemMouseEnter?: (id: string) => void;
}

/**
 * Grid view content with editing and view modes.
 * Edit mode: SortableGrid with drag-and-drop reordering.
 * View mode: Pinned items section + Library section with context menus.
 */
export function GridViewContent({
  isEditing,
  currentLevelItems,
  pinnedItems,
  unpinnedItems,
  onItemsChange,
  onItemClick,
  onOpenSettings,
  onDeleteItem,
  onMoveItem,
  onPinItem,
  onUnpinItem,
  onAddChild,
  onAddChildComplete,
  hasDriveConnection,
  isItemSelected,
  onItemSelectChange,
  currentUser,
  shelves,
  onItemMouseEnter,
}: GridViewContentProps) {
  const dispatch = useAppDispatch();
  const [moveToItem, setMoveToItem] = useState<{
    id: string;
    name: string;
    parentId: string | null;
  } | null>(null);

  const getTracksForItem = useCallback(
    async (item: ItemWithArtwork): Promise<QueueTrack[] | null> => {
      const result = await getItemFiles(item.id);
      if (!result.success || !result.data?.media.length) return null;
      return result.data.media.map((f) =>
        buildQueueTrack({
          fileId: f.id,
          itemId: item.id,
          filename: f.filename,
          mimeType: f.mimeType,
          itemName: item.name,
          tmdbPosterPath: item.tmdbPosterPath,
          heroArtworkId: item.artworkId,
          playbackDuration: f.playbackDuration,
          playbackPosition: f.playbackPosition,
        })
      );
    },
    []
  );

  /** Build watch-related menu props from an item's progress data. */
  function watchMenuProps(item: ItemWithArtwork) {
    const hasChildren = (item.childCount ?? 0) > 0;
    const watched = item.progress?.watchedItems ?? 0;
    const withMedia = item.progress?.itemsWithMedia ?? 0;

    if (hasChildren) {
      // Parent: toggle "Mark All as Watched" / "Mark All as Unwatched"
      const allWatched = withMedia > 0 && watched >= withMedia;
      return {
        isAllWatched: allWatched,
        onMarkAllWatched: async () => {
          await markAllWatched(item.id);
        },
        onMarkAllUnwatched: async () => {
          await markAllUnwatched(item.id);
        },
      };
    }

    // Leaf: toggle "Mark as Watched" / "Mark as Unwatched"
    const isWatched = withMedia > 0 && watched >= withMedia;
    return {
      isWatched,
      onMarkWatched: async () => {
        await markAsWatched(item.id);
      },
      onMarkUnwatched: async () => {
        await markAsUnwatched(item.id);
      },
    };
  }

  return (
    <>
      {/* Edit mode: SortableGrid (conditionally rendered — dynamic import) */}
      {isEditing && (
        <Section className="py-8" aria-label="Contents">
          <SortableGrid
            items={currentLevelItems}
            onItemsChange={onItemsChange}
            onItemClick={onItemClick}
            onOpenSettings={onOpenSettings}
            onDeleteItem={onDeleteItem}
            hasDriveConnection={hasDriveConnection}
            onPinItem={onPinItem}
            onUnpinItem={onUnpinItem}
            isItemSelected={isItemSelected}
            onItemSelectChange={onItemSelectChange}
            currentUser={currentUser}
          />
        </Section>
      )}

      {/* View mode: always mounted to prevent flash on edit→view toggle */}
      <div style={{ display: isEditing ? "none" : "contents" }}>
        {/* Pinned items section */}
        {pinnedItems.length > 0 && (
          <Section className="py-8" aria-label="Pinned items">
            <h2 className="mb-4 text-xs font-medium tracking-[0.2em] text-[var(--tertiary-foreground)] uppercase">
              Pinned
            </h2>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
              {/* GridItem is memoized — context menu wrapper props recreate per render
                  but are lightweight (Radix portal, no heavy DOM) */}
              {pinnedItems.map((item, index) => {
                const watchProps = watchMenuProps(item);
                const baseMenuProps = {
                  itemName: item.name,
                  driveFileId: item.driveFileId,
                  username: currentUser?.username ?? undefined,
                  itemId: item.id,
                  hasDriveConnection,
                  isPinned: true,
                  showAddChild: true,
                  onSettings: () => onOpenSettings(item.id),
                  onDelete: () => onDeleteItem(item.id),
                  onAddChild: onAddChild
                    ? (n: string, d?: string, v?: ItemVisibilityOptions) =>
                        onAddChild(item.id, n, d, v)
                    : undefined,
                  onAddChildComplete,
                  onPin: () => onPinItem(item.id),
                  onUnpin: () => onUnpinItem(item.id),
                  hasMedia: (item.fileCounts?.media ?? 0) > 0,
                  onGetTracks: () => getTracksForItem(item),
                  onPlay: (tracks: QueueTrack[]) =>
                    dispatch(playQueue({ tracks })),
                  onPlayNext: (track: QueueTrack) => dispatch(playNext(track)),
                  onAddToQueue: (track: QueueTrack) =>
                    dispatch(addToQueue(track)),
                  onMoveToOpen: () =>
                    setMoveToItem({
                      id: item.id,
                      name: item.name,
                      parentId: item.parentId,
                    }),
                  ...watchProps,
                };
                return (
                  <ItemContextMenu key={item.id} {...baseMenuProps}>
                    <GridItem
                      id={item.id}
                      name={item.name}
                      description={item.description}
                      onClick={() => onItemClick(item.id)}
                      onMouseEnter={
                        onItemMouseEnter
                          ? () => onItemMouseEnter(item.id)
                          : undefined
                      }
                      tmdbPosterPath={item.tmdbPosterPath}
                      artworkId={item.artworkId}
                      progressPercentage={item.progress?.percentage ?? null}
                      watchedCount={item.progress?.watchedItems}
                      totalMediaCount={item.progress?.itemsWithMedia}
                      totalItems={item.progress?.totalItems}
                      showArtwork={true}
                      showDescription={true}
                      priority={index < 5}
                      driveFileId={item.driveFileId}
                      primaryDurationMs={item.primaryDurationMs}
                      primaryHeight={item.primaryHeight}
                      moreMenuProps={baseMenuProps}
                    />
                  </ItemContextMenu>
                );
              })}
            </div>
          </Section>
        )}

        {/* Shelves (server-rendered, between pinned and library) */}
        <ShelfActionsContextProvider
          onItemClick={onItemClick}
          onOpenSettings={onOpenSettings}
          onDeleteItem={onDeleteItem}
          onPinItem={onPinItem}
          onUnpinItem={onUnpinItem}
          onAddChild={onAddChild}
          onAddChildComplete={onAddChildComplete}
          hasDriveConnection={hasDriveConnection}
        >
          {shelves}
        </ShelfActionsContextProvider>

        {/* Library section (items not pinned) */}
        {unpinnedItems.length > 0 && (
          <Section className="py-8" aria-label="Library">
            {pinnedItems.length > 0 && (
              <h2 className="mb-4 text-xs font-medium tracking-[0.2em] text-[var(--tertiary-foreground)] uppercase">
                Library
              </h2>
            )}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
              {/* GridItem is memoized — context menu wrapper props recreate per render
                  but are lightweight (Radix portal, no heavy DOM) */}
              {unpinnedItems.map((item, index) => {
                const watchProps = watchMenuProps(item);
                const baseMenuProps = {
                  itemName: item.name,
                  driveFileId: item.driveFileId,
                  username: currentUser?.username ?? undefined,
                  itemId: item.id,
                  hasDriveConnection,
                  isPinned: false,
                  showAddChild: true,
                  onSettings: () => onOpenSettings(item.id),
                  onDelete: () => onDeleteItem(item.id),
                  onAddChild: onAddChild
                    ? (n: string, d?: string, v?: ItemVisibilityOptions) =>
                        onAddChild(item.id, n, d, v)
                    : undefined,
                  onAddChildComplete,
                  onPin: () => onPinItem(item.id),
                  onUnpin: () => onUnpinItem(item.id),
                  hasMedia: (item.fileCounts?.media ?? 0) > 0,
                  onGetTracks: () => getTracksForItem(item),
                  onPlay: (tracks: QueueTrack[]) =>
                    dispatch(playQueue({ tracks })),
                  onPlayNext: (track: QueueTrack) => dispatch(playNext(track)),
                  onAddToQueue: (track: QueueTrack) =>
                    dispatch(addToQueue(track)),
                  onMoveToOpen: () =>
                    setMoveToItem({
                      id: item.id,
                      name: item.name,
                      parentId: item.parentId,
                    }),
                  ...watchProps,
                };
                return (
                  <ItemContextMenu key={item.id} {...baseMenuProps}>
                    <GridItem
                      id={item.id}
                      name={item.name}
                      description={item.description}
                      onClick={() => onItemClick(item.id)}
                      onMouseEnter={
                        onItemMouseEnter
                          ? () => onItemMouseEnter(item.id)
                          : undefined
                      }
                      tmdbPosterPath={item.tmdbPosterPath}
                      artworkId={item.artworkId}
                      progressPercentage={item.progress?.percentage ?? null}
                      watchedCount={item.progress?.watchedItems}
                      totalMediaCount={item.progress?.itemsWithMedia}
                      totalItems={item.progress?.totalItems}
                      showArtwork={true}
                      showDescription={true}
                      priority={index < 8}
                      driveFileId={item.driveFileId}
                      primaryDurationMs={item.primaryDurationMs}
                      primaryHeight={item.primaryHeight}
                      moreMenuProps={baseMenuProps}
                    />
                  </ItemContextMenu>
                );
              })}
            </div>
          </Section>
        )}
      </div>

      {/* Move To Dialog */}
      {moveToItem && (
        <MoveToDialog
          open={!!moveToItem}
          onOpenChange={(open) => {
            if (!open) setMoveToItem(null);
          }}
          itemId={moveToItem.id}
          itemName={moveToItem.name}
          currentParentId={moveToItem.parentId}
          onMove={(newParentId) => onMoveItem(moveToItem.id, newParentId)}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Memoised context provider (avoids new object on every GridViewContent render)
// ---------------------------------------------------------------------------

interface ShelfActionsContextProviderProps {
  onItemClick: (id: UniqueIdentifier) => void;
  onOpenSettings: (id: string) => Promise<void>;
  onDeleteItem: (id: string) => Promise<void>;
  onPinItem: (id: string) => Promise<void>;
  onUnpinItem: (id: string) => Promise<void>;
  onAddChild?: (
    parentId: string,
    name: string,
    description?: string,
    visibilityOptions?: ItemVisibilityOptions
  ) => Promise<CreateItemResult>;
  onAddChildComplete?: () => Promise<void>;
  hasDriveConnection: boolean;
  children: React.ReactNode;
}

function ShelfActionsContextProvider({
  onItemClick,
  onOpenSettings,
  onDeleteItem,
  onPinItem,
  onUnpinItem,
  onAddChild,
  onAddChildComplete,
  hasDriveConnection,
  children,
}: ShelfActionsContextProviderProps) {
  const value = useMemo<ShelfActionsContextValue>(
    () => ({
      onItemClick: (id) => onItemClick(id),
      onOpenSettings,
      onDeleteItem,
      onPinItem,
      onUnpinItem,
      onMarkWatched: async (id) => {
        await markAsWatched(id);
      },
      onMarkUnwatched: async (id) => {
        await markAsUnwatched(id);
      },
      onMarkAllWatched: async (id) => {
        await markAllWatched(id);
      },
      onMarkAllUnwatched: async (id) => {
        await markAllUnwatched(id);
      },
      onAddChild,
      onAddChildComplete,
      hasDriveConnection,
    }),
    [
      onItemClick,
      onOpenSettings,
      onDeleteItem,
      onPinItem,
      onUnpinItem,
      onAddChild,
      onAddChildComplete,
      hasDriveConnection,
    ]
  );

  return (
    <ShelfActionsContext.Provider value={value}>
      {children}
    </ShelfActionsContext.Provider>
  );
}
