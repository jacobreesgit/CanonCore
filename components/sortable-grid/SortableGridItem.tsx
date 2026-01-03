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
  /** SFTP path if linked to remote server. */
  sftpPath?: string | null;
  /** Artwork file ID for thumbnail display. */
  artworkId?: string | null;
}

export function SortableGridItem({
  id,
  name,
  onSettings,
  onDelete,
  sftpPath,
  artworkId,
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
        sftpPath={sftpPath}
        artworkId={artworkId}
        {...props}
      />
    </ItemContextMenu>
  );
}
