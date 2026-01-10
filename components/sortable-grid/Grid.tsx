/**
 * View-only grid container for items display.
 * Renders items with full visual richness (artwork, sync badges).
 * No drag-and-drop functionality - use SortableGrid for edit mode.
 */

"use client";

import React from "react";

import { GridItem } from "./GridItem";
import { ItemContextMenu } from "@/components/items/item-context-menu";
import type { ItemWithArtwork } from "@/lib/types";

interface GridProps {
  /** Items to display in the grid. */
  items: ItemWithArtwork[];
  /** Callback when an item is clicked. */
  onItemClick?(id: string): void;
  /** Callback to open settings dialog for an item. */
  onOpenSettings?(id: string): void;
  /** Callback to delete an item. */
  onDeleteItem?(id: string): Promise<void>;
}

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
}: GridProps) {
  return (
    <div
      data-testid="items-grid-view"
      className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4"
    >
      {items.map((item) => (
        <ItemContextMenu
          key={item.id}
          itemName={item.name}
          showAddChild={false}
          onSettings={
            onOpenSettings ? () => onOpenSettings(item.id) : undefined
          }
          onDelete={onDeleteItem ? () => onDeleteItem(item.id) : undefined}
        >
          <GridItem
            id={item.id}
            name={item.name}
            description={item.description}
            onClick={() => onItemClick?.(item.id)}
            artworkId={item.artworkId}
            fileCounts={item.fileCounts}
            childCount={item.childCount}
            primaryMediaName={item.primaryMediaName}
            mediaIconType={item.mediaIconType}
            showArtwork={true}
            showDescription={true}
          />
        </ItemContextMenu>
      ))}
    </div>
  );
}
