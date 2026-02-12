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

import { SortableGridItem } from "./sortable-grid-item";
import { GridItem } from "./grid-item";
import type { ItemWithArtwork } from "@/lib/types";

interface CurrentUser {
  id: string;
  username: string | null;
  name: string | null;
}

interface SortableGridProps {
  items: ItemWithArtwork[];
  onItemsChange?(items: ItemWithArtwork[]): void;
  onItemClick?(id: UniqueIdentifier): void;
  /** Opens the settings dialog for an item */
  onOpenSettings?(id: string): void;
  onDeleteItem?(id: string): Promise<void>;
  /** Whether user has Google Drive connected. */
  hasDriveConnection?: boolean;
  /** Callback to pin an item to the sidebar. */
  onPinItem?(id: string): Promise<void>;
  /** Callback to unpin an item from the sidebar. */
  onUnpinItem?(id: string): Promise<void>;
  /** Check if an item is selected (for bulk operations). */
  isItemSelected?: (id: string) => boolean;
  /** Callback when an item's selection state changes. */
  onItemSelectChange?: (id: string, selected: boolean) => void;
  /** Current user info for owner display. */
  currentUser?: CurrentUser | null;
}

/**
 * Drag-and-drop sortable grid for item reordering in edit mode.
 * Uses dnd-kit for smooth animations and keyboard support.
 *
 * @param items - Items to display and reorder
 * @param onItemsChange - Callback when items are reordered
 * @param onItemClick - Callback when an item is clicked
 * @param onOpenSettings - Callback to open settings dialog
 * @param onDeleteItem - Callback to delete an item
 */
export function SortableGrid({
  items: defaultItems,
  onItemsChange,
  onItemClick,
  onOpenSettings,
  onDeleteItem,
  hasDriveConnection = false,
  onPinItem,
  onUnpinItem,
  isItemSelected,
  onItemSelectChange,
  currentUser: _currentUser,
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
        <div
          data-testid="items-grid-view"
          className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5"
        >
          {items.map((item) => (
            <SortableGridItem
              key={item.id}
              id={item.id}
              name={item.name}
              description={item.description}
              onClick={() => onItemClick?.(item.id)}
              onSettings={
                onOpenSettings ? () => onOpenSettings(item.id) : undefined
              }
              onDelete={onDeleteItem ? () => onDeleteItem(item.id) : undefined}
              tmdbPosterPath={item.tmdbPosterPath}
              artworkId={item.artworkId}
              driveFileId={item.driveFileId}
              showDescription={false}
              hasDriveConnection={hasDriveConnection}
              isPinned={item.pinnedOrder != null}
              onPin={onPinItem ? () => onPinItem(item.id) : undefined}
              onUnpin={onUnpinItem ? () => onUnpinItem(item.id) : undefined}
              isSelected={isItemSelected?.(item.id)}
              onSelectChange={
                onItemSelectChange
                  ? (selected) => onItemSelectChange(item.id, selected)
                  : undefined
              }
            />
          ))}
        </div>
      </SortableContext>
      {typeof document !== "undefined" &&
        createPortal(
          <DragOverlay>
            {activeId && activeItem ? (
              <GridItem
                id={activeId}
                name={activeItem.name}
                tmdbPosterPath={activeItem.tmdbPosterPath}
                artworkId={activeItem.artworkId}
                isOverlay
              />
            ) : null}
          </DragOverlay>,
          document.body
        )}
    </DndContext>
  );
}
