/**
 * Sortable wrapper for TreeItem with dnd-kit integration.
 * Includes context menu for rename, delete, and add child actions.
 */

"use client";

import React from "react";
import type { UniqueIdentifier } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { AnimateLayoutChanges } from "@dnd-kit/sortable";

import { TreeItem, TreeItemProps } from "./TreeItem";
import { ItemContextMenu } from "@/components/items/item-context-menu";

interface SortableTreeItemProps extends Omit<TreeItemProps, "handleProps"> {
  id: UniqueIdentifier;
  onRename?(newName: string): Promise<void>;
  onDelete?(): Promise<void>;
  onAddChild?(name: string): Promise<string | undefined>;
}

const animateLayoutChanges: AnimateLayoutChanges = ({
  isSorting,
  wasDragging,
}) => (isSorting || wasDragging ? false : true);

export function SortableTreeItem({
  id,
  value,
  onRename,
  onDelete,
  onAddChild,
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
      onRename={onRename}
      onDelete={onDelete}
      onAddChild={onAddChild}
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
        {...props}
      />
    </ItemContextMenu>
  );
}
