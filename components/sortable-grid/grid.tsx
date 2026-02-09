/**
 * View-only grid container for items display.
 * Renders items with full visual richness (artwork, sync badges).
 * No drag-and-drop functionality - use SortableGrid for edit mode.
 */

"use client";

import React from "react";

import { GridItem } from "./grid-item";
import { ItemContextMenu } from "@/components/items/item-context-menu";
import type { ItemWithArtwork } from "@/lib/types";

interface CurrentUser {
  id: string;
  username: string | null;
  name: string | null;
}

interface GridProps {
  /** Items to display in the grid. */
  items: ItemWithArtwork[];
  /** Callback when an item is clicked. */
  onItemClick?(id: string): void;
  /** Callback to open settings dialog for an item. */
  onOpenSettings?(id: string): void;
  /** Callback to delete an item. */
  onDeleteItem?(id: string): Promise<void>;
  /** Whether user has Google Drive connected. */
  hasDriveConnection?: boolean;
  /** Callback to pin an item to the sidebar. */
  onPinItem?(id: string): Promise<void>;
  /** Callback to unpin an item from the sidebar. */
  onUnpinItem?(id: string): Promise<void>;
  /** Current user info for owner display. */
  currentUser?: CurrentUser | null;
}

/** Number of items to load with priority (above the fold). */
const PRIORITY_COUNT = 8;

/**
 * View-only grid component for browsing items.
 * Shows artwork thumbnails and sync badges.
 * For reordering, use SortableGrid in edit mode.
 *
 * @param props - Grid properties
 */
export function Grid({
  items,
  onItemClick,
  onOpenSettings,
  onDeleteItem,
  hasDriveConnection = false,
  onPinItem,
  onUnpinItem,
  currentUser: _currentUser,
}: GridProps) {
  return (
    <div
      data-testid="items-grid-view"
      className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-5"
    >
      {items.map((item, index) => (
        <ItemContextMenu
          key={item.id}
          itemName={item.name}
          driveFileId={item.driveFileId}
          showAddChild={false}
          isPinned={item.pinnedOrder != null}
          onSettings={
            onOpenSettings ? () => onOpenSettings(item.id) : undefined
          }
          onDelete={onDeleteItem ? () => onDeleteItem(item.id) : undefined}
          hasDriveConnection={hasDriveConnection}
          onPin={onPinItem ? () => onPinItem(item.id) : undefined}
          onUnpin={onUnpinItem ? () => onUnpinItem(item.id) : undefined}
        >
          <GridItem
            id={item.id}
            name={item.name}
            description={item.description}
            onClick={() => onItemClick?.(item.id)}
            artworkId={item.artworkId}
            progressPercentage={item.progress?.percentage ?? null}
            watchedCount={item.progress?.watchedItems}
            totalMediaCount={item.progress?.itemsWithMedia}
            totalItems={item.progress?.totalItems}
            showArtwork={true}
            showDescription={true}
            priority={index < PRIORITY_COUNT}
            moreMenuProps={{
              itemName: item.name,
              driveFileId: item.driveFileId,
              hasDriveConnection,
              isPinned: item.pinnedOrder != null,
              showAddChild: false,
              onSettings: onOpenSettings
                ? () => onOpenSettings(item.id)
                : undefined,
              onDelete: onDeleteItem ? () => onDeleteItem(item.id) : undefined,
              onPin: onPinItem ? () => onPinItem(item.id) : undefined,
              onUnpin: onUnpinItem ? () => onUnpinItem(item.id) : undefined,
            }}
          />
        </ItemContextMenu>
      ))}
    </div>
  );
}
