/**
 * Sortable wrapper for GridItem with dnd-kit integration.
 * Includes context menu for settings and delete actions.
 */

"use client";

import React from "react";
import type { UniqueIdentifier } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { GridItem, GridItemProps } from "./GridItem";
import { ItemContextMenu } from "@/components/items/item-context-menu";

interface SortableGridItemProps extends Omit<GridItemProps, "handleProps"> {
  id: UniqueIdentifier;
  /** Opens the item settings dialog */
  onSettings?(): void;
  onDelete?(): Promise<void>;
  /** Artwork file ID for thumbnail display. */
  artworkId?: string | null;
  /** Google Drive folder ID (if synced). */
  driveFileId?: string | null;
  /** Whether user has Google Drive connected. */
  hasDriveConnection?: boolean;
  /** Whether this item is pinned to the sidebar */
  isPinned?: boolean;
  /** Callback to pin the item to the sidebar */
  onPin?(): Promise<void>;
  /** Callback to unpin the item from the sidebar */
  onUnpin?(): Promise<void>;
  /** Whether the item is selected (for bulk operations). */
  isSelected?: boolean;
  /** Callback when selection state changes. */
  onSelectChange?: (selected: boolean) => void;
}

/**
 * Draggable grid item wrapper with dnd-kit sortable integration.
 * Wraps GridItem with context menu and drag handle.
 *
 * @param id - Unique item identifier
 * @param name - Item display name
 * @param onSettings - Callback to open settings dialog
 * @param onDelete - Callback to delete the item
 * @param artworkId - Artwork file ID for thumbnail
 * @param driveFileId - Google Drive folder ID (shows "Open in Drive" if set)
 */
export function SortableGridItem({
  id,
  name,
  onSettings,
  onDelete,
  artworkId,
  driveFileId,
  hasDriveConnection = false,
  isPinned = false,
  onPin,
  onUnpin,
  isSelected,
  onSelectChange,
  ...props
}: SortableGridItemProps) {
  const {
    attributes,
    isDragging,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <ItemContextMenu
      itemName={name}
      driveFileId={driveFileId}
      showAddChild={false}
      isPinned={isPinned}
      onSettings={onSettings}
      onDelete={onDelete}
      hasDriveConnection={hasDriveConnection}
      onPin={onPin}
      onUnpin={onUnpin}
    >
      <GridItem
        ref={setNodeRef}
        id={id}
        name={name}
        style={style}
        isDragging={isDragging}
        handleProps={{
          ...attributes,
          ...listeners,
        }}
        artworkId={artworkId}
        showArtwork={true}
        isSelected={isSelected}
        onSelectChange={onSelectChange}
        {...props}
      />
    </ItemContextMenu>
  );
}
