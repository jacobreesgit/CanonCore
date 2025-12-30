/**
 * Sortable grid container for flat item reordering.
 */

"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  UniqueIdentifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";

import { SortableGridItem } from "./SortableGridItem";
import { GridItem } from "./GridItem";
import type { Item } from "@/lib/types";

interface SortableGridProps {
  items: Item[];
  onItemsChange?(items: Item[]): void;
  onItemClick?(id: UniqueIdentifier): void;
  onRenameItem?(id: string, newName: string): Promise<void>;
  onDeleteItem?(id: string): Promise<void>;
}

export function SortableGrid({
  items: defaultItems,
  onItemsChange,
  onItemClick,
  onRenameItem,
  onDeleteItem,
}: SortableGridProps) {
  const [items, setItems] = useState(defaultItems);
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);

  // Sync with external items
  useEffect(() => {
    setItems(defaultItems);
  }, [defaultItems]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const activeItem = activeId
    ? items.find((item) => item.id === activeId)
    : null;

  function handleDragStart({ active }: DragStartEvent) {
    setActiveId(active.id);
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);

    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);

      const newItems = arrayMove(items, oldIndex, newIndex).map(
        (item, index) => ({
          ...item,
          order: index,
        })
      );

      setItems(newItems);
      onItemsChange?.(newItems);
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={items.map((i) => i.id)}
        strategy={rectSortingStrategy}
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {items.map((item) => (
            <SortableGridItem
              key={item.id}
              id={item.id}
              name={item.name}
              onClick={() => onItemClick?.(item.id)}
              onRename={
                onRenameItem
                  ? (newName) => onRenameItem(item.id, newName)
                  : undefined
              }
              onDelete={onDeleteItem ? () => onDeleteItem(item.id) : undefined}
            />
          ))}
        </div>
      </SortableContext>
      {typeof document !== "undefined" &&
        createPortal(
          <DragOverlay>
            {activeId && activeItem ? (
              <GridItem id={activeId} name={activeItem.name} isOverlay />
            ) : null}
          </DragOverlay>,
          document.body
        )}
    </DndContext>
  );
}
