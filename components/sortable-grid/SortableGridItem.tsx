/**
 * Sortable wrapper for GridItem with dnd-kit integration.
 * Includes context menu for settings and delete actions.
 * Edit mode: simplified visuals (no artwork).
 */

"use client";

import React from "react";
import type { UniqueIdentifier } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { GridItem, GridItemProps } from "./GridItem";
import { ItemContextMenu } from "@/components/items/item-context-menu";
import type { FileCounts } from "@/lib/types";

interface SortableGridItemProps extends Omit<GridItemProps, "handleProps"> {
  id: UniqueIdentifier;
  /** Opens the item settings dialog */
  onSettings?(): void;
  onDelete?(): Promise<void>;
  /** Artwork file ID for thumbnail display. */
  artworkId?: string | null;
  /** File counts by type for display. */
  fileCounts?: FileCounts;
  /** Number of child items (subfolders). */
  childCount?: number;
}

export function SortableGridItem({
  id,
  name,
  onSettings,
  onDelete,
  artworkId,
  fileCounts,
  childCount,
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
      showAddChild={false}
      onSettings={onSettings}
      onDelete={onDelete}
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
        fileCounts={fileCounts}
        childCount={childCount}
        showArtwork={false}
        showCounts={false}
        {...props}
      />
    </ItemContextMenu>
  );
}
