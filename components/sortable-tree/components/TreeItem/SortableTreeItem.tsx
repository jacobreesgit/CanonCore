/**
 * Sortable wrapper for TreeItem with dnd-kit integration.
 * Includes context menu for settings, delete, and add child actions.
 * Edit mode: simplified visuals (no artwork), drag handle always visible.
 */

"use client";

import React from "react";
import type { UniqueIdentifier } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { AnimateLayoutChanges } from "@dnd-kit/sortable";

import { TreeItem, TreeItemProps } from "./TreeItem";
import { ItemContextMenu } from "@/components/items/item-context-menu";
import type { CreateItemResult } from "@/components/items/add-item-dialog";

interface SortableTreeItemProps extends Omit<TreeItemProps, "handleProps"> {
  id: UniqueIdentifier;
  /** Google Drive folder ID (if synced) */
  driveFileId?: string | null;
  /** Whether this item is pinned to the sidebar */
  isPinned?: boolean;
  /** Opens the item settings dialog */
  onSettings?(): void;
  onDelete?(): Promise<void>;
  onAddChild?(name: string, description?: string): Promise<CreateItemResult>;
  /** Callback to refresh data after child item is created */
  onAddChildComplete?(): Promise<void>;
  /** Whether user has Google Drive connected (for Add Child dialog) */
  hasDriveConnection?: boolean;
  /** Callback to pin the item to the sidebar */
  onPin?(): Promise<void>;
  /** Callback to unpin the item from the sidebar */
  onUnpin?(): Promise<void>;
  /** Whether the item is selected (for bulk operations). */
  isSelected?: boolean;
  /** Callback when selection state changes. */
  onSelectChange?: (selected: boolean) => void;
}

const animateLayoutChanges: AnimateLayoutChanges = ({
  isSorting,
  wasDragging,
}) => (isSorting || wasDragging ? false : true);

/**
 * Draggable tree item wrapper with dnd-kit sortable integration.
 * Wraps TreeItem with context menu and drag capabilities.
 *
 * @param id - Unique item identifier
 * @param value - Item display name
 * @param driveFileId - Google Drive folder ID (shows "Open in Drive" if set)
 * @param onSettings - Callback to open settings dialog
 * @param onDelete - Callback to delete the item
 * @param onAddChild - Callback to add a child item
 */
export function SortableTreeItem({
  id,
  value,
  driveFileId,
  isPinned = false,
  onSettings,
  onDelete,
  onAddChild,
  onAddChildComplete,
  hasDriveConnection = false,
  onPin,
  onUnpin,
  isSelected,
  onSelectChange,
  ...props
}: SortableTreeItemProps) {
  const {
    attributes,
    isDragging,
    isSorting,
    listeners,
    setDraggableNodeRef,
    setDroppableNodeRef,
    transform,
    transition,
  } = useSortable({
    id,
    animateLayoutChanges,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  return (
    <ItemContextMenu
      itemName={value}
      driveFileId={driveFileId}
      isPinned={isPinned}
      onSettings={onSettings}
      onDelete={onDelete}
      onAddChild={onAddChild}
      onAddChildComplete={onAddChildComplete}
      hasDriveConnection={hasDriveConnection}
      onPin={onPin}
      onUnpin={onUnpin}
    >
      <TreeItem
        ref={setDraggableNodeRef}
        wrapperRef={setDroppableNodeRef}
        id={id}
        value={value}
        style={style}
        ghost={isDragging}
        disableSelection={isSorting}
        disableInteraction={isSorting}
        handleProps={{
          ...attributes,
          ...listeners,
        }}
        showDragHandle={true}
        isSelected={isSelected}
        onSelectChange={onSelectChange}
        {...props}
      />
    </ItemContextMenu>
  );
}
