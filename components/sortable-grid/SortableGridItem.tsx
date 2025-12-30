/**
 * Sortable wrapper for GridItem with dnd-kit integration.
 * Includes context menu for rename and delete actions.
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
  onRename?(newName: string): Promise<void>;
  onDelete?(): Promise<void>;
}

export function SortableGridItem({
  id,
  name,
  onRename,
  onDelete,
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
      onRename={onRename}
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
        {...props}
      />
    </ItemContextMenu>
  );
}
