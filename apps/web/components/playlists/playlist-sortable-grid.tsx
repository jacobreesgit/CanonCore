/**
 * Sortable grid for playlist item reordering.
 * Lightweight dnd-kit wrapper typed for playlist items (not ItemWithArtwork).
 * Mirrors sortable-grid-component.tsx pattern but uses PlaylistItemContextMenu.
 */

"use client";

import { useState, useEffect } from "react";
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
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { GridItem } from "@/components/sortable-grid/grid-item";
import { PlaylistItemContextMenu } from "@/components/playlists/playlist-context-menu";

/** Minimal item shape for the sortable grid. */
interface PlaylistSortableItem {
  playlistItemId: string;
  order: number;
  item: {
    id: string;
    name: string;
    description: string | null;
    tmdbPosterPath?: string | null;
    artworkId: string | null;
  };
}

interface PlaylistSortableGridProps {
  items: PlaylistSortableItem[];
  username: string;
  onReorder(items: PlaylistSortableItem[]): void;
  onRemoveItem(itemId: string): void | Promise<void>;
  gridClassName: string;
}

/** Single sortable item with drag handle and context menu. */
function SortablePlaylistItem({
  entry,
  username,
  onRemove,
}: {
  entry: PlaylistSortableItem;
  username: string;
  onRemove(): Promise<void>;
}) {
  const {
    attributes,
    isDragging,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: entry.playlistItemId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const itemHref = `/u/${username}/${entry.item.id}`;

  return (
    <PlaylistItemContextMenu
      itemName={entry.item.name}
      itemHref={itemHref}
      onRemove={onRemove}
    >
      <GridItem
        ref={setNodeRef}
        id={entry.playlistItemId}
        name={entry.item.name}
        description={entry.item.description}
        tmdbPosterPath={entry.item.tmdbPosterPath}
        artworkId={entry.item.artworkId}
        style={style}
        isDragging={isDragging}
        handleProps={{ ...attributes, ...listeners }}
        showArtwork
        showDescription={false}
      />
    </PlaylistItemContextMenu>
  );
}

/**
 * Drag-and-drop sortable grid for playlist item reordering.
 * Uses dnd-kit with pointer and keyboard sensors.
 */
export function PlaylistSortableGrid({
  items: defaultItems,
  username,
  onReorder,
  onRemoveItem,
  gridClassName,
}: PlaylistSortableGridProps) {
  const [items, setItems] = useState(defaultItems);
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);

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
    ? items.find((i) => i.playlistItemId === activeId)
    : null;

  function handleDragStart({ active }: DragStartEvent) {
    setActiveId(active.id);
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);

    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex((i) => i.playlistItemId === active.id);
      const newIndex = items.findIndex((i) => i.playlistItemId === over.id);

      const newItems = arrayMove(items, oldIndex, newIndex).map(
        (item, index) => ({
          ...item,
          order: index,
        })
      );

      setItems(newItems);
      onReorder(newItems);
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
        items={items.map((i) => i.playlistItemId)}
        strategy={rectSortingStrategy}
      >
        <div className={gridClassName}>
          {items.map((entry) => (
            <SortablePlaylistItem
              key={entry.playlistItemId}
              entry={entry}
              username={username}
              onRemove={async () => onRemoveItem(entry.item.id)}
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
                name={activeItem.item.name}
                tmdbPosterPath={activeItem.item.tmdbPosterPath}
                artworkId={activeItem.item.artworkId}
                isOverlay
              />
            ) : null}
          </DragOverlay>,
          document.body
        )}
    </DndContext>
  );
}
