/**
 * Shelf configuration UI for the settings dialog.
 * Allows users to add/remove playlists as home page shelves and reorder them.
 * Fetches config on mount via server action. Uses optimistic state updates.
 */

"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faGripVertical,
  faPlus,
  faSpinner,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  getShelfConfig,
  addPlaylistAsShelf,
  removeShelf,
  reorderShelves,
} from "@/lib/shelf-actions";
import type { ShelfConfig } from "@/lib/types";

/**
 * Fetches shelf config on mount and renders sortable active shelves + available playlists.
 */
export function ShelfSettings() {
  const [config, setConfig] = useState<ShelfConfig[] | null>(null);
  const [isPending, startTransition] = useTransition();

  // Fetch shelf config on mount
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const result = await getShelfConfig();
      if (!cancelled && result.success) {
        setConfig(result.data);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (config === null) {
    return (
      <div className="flex items-center justify-center py-8" role="status">
        <FontAwesomeIcon
          icon={faSpinner}
          className="text-muted-foreground size-5 animate-spin"
          aria-hidden="true"
        />
        <span className="sr-only">Loading shelf configuration</span>
      </div>
    );
  }

  return (
    <ShelfSettingsContent
      config={config}
      setConfig={setConfig}
      isPending={isPending}
      startTransition={startTransition}
    />
  );
}

// ---------------------------------------------------------------------------
// Content (separated so hooks are unconditional)
// ---------------------------------------------------------------------------

interface ShelfSettingsContentProps {
  config: ShelfConfig[];
  setConfig: React.Dispatch<React.SetStateAction<ShelfConfig[] | null>>;
  isPending: boolean;
  startTransition: React.TransitionStartFunction;
}

function ShelfSettingsContent({
  config,
  setConfig,
  isPending,
  startTransition,
}: ShelfSettingsContentProps) {
  const activeShelves = config
    .filter((c) => c.shelfOrder !== null)
    .toSorted((a, b) => (a.shelfOrder ?? 0) - (b.shelfOrder ?? 0));

  const availablePlaylists = config
    .filter((c) => c.shelfOrder === null)
    .toSorted((a, b) => a.name.localeCompare(b.name));

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleAdd = useCallback(
    (playlistId: string) => {
      const previousConfig = config;
      setConfig((prev) =>
        prev
          ? prev.map((c) =>
              c.playlistId === playlistId
                ? {
                    ...c,
                    shelfOrder:
                      Math.max(...prev.map((p) => p.shelfOrder ?? 0)) + 1,
                  }
                : c
            )
          : prev
      );
      startTransition(async () => {
        const result = await addPlaylistAsShelf(playlistId);
        if (!result.success) {
          setConfig(previousConfig);
        }
      });
    },
    [config, setConfig, startTransition]
  );

  const handleRemove = useCallback(
    (playlistId: string) => {
      const previousConfig = config;
      setConfig((prev) =>
        prev
          ? prev.map((c) =>
              c.playlistId === playlistId ? { ...c, shelfOrder: null } : c
            )
          : prev
      );
      startTransition(async () => {
        const result = await removeShelf(playlistId);
        if (!result.success) {
          setConfig(previousConfig);
        }
      });
    },
    [config, setConfig, startTransition]
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    // Derive active shelves from config inside the handler to avoid
    // stale closure over the derived `activeShelves` array.
    const currentActive = config
      .filter((c) => c.shelfOrder !== null)
      .toSorted((a, b) => (a.shelfOrder ?? 0) - (b.shelfOrder ?? 0));

    const oldIndex = currentActive.findIndex((s) => s.playlistId === active.id);
    const newIndex = currentActive.findIndex((s) => s.playlistId === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = [...currentActive];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);
    const orderedIds = reordered.map((s) => s.playlistId);

    const previousConfig = config;
    setConfig((prev) =>
      prev
        ? prev.map((c) => {
            const idx = orderedIds.indexOf(c.playlistId);
            return idx >= 0 ? { ...c, shelfOrder: idx + 1 } : c;
          })
        : prev
    );

    startTransition(async () => {
      const result = await reorderShelves(orderedIds);
      if (!result.success) {
        setConfig(previousConfig);
      }
    });
  }

  return (
    <div
      className={cn("space-y-6", isPending && "pointer-events-none opacity-60")}
    >
      {/* Active Shelves */}
      <div>
        <h3 className="mb-1 text-sm font-medium">Active Shelves</h3>
        <p className="text-muted-foreground mb-3 text-xs">
          Drag to reorder. These playlists appear as shelves on your home page.
        </p>

        {activeShelves.length === 0 ? (
          <p className="text-muted-foreground py-4 text-center text-xs">
            No active shelves. Add a playlist below to get started.
          </p>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={activeShelves.map((s) => s.playlistId)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-1">
                {activeShelves.map((shelf) => (
                  <SortableShelfItem
                    key={shelf.playlistId}
                    shelf={shelf}
                    onRemove={handleRemove}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* Available Playlists */}
      {availablePlaylists.length > 0 && (
        <div>
          <h3 className="mb-1 text-sm font-medium">Available Playlists</h3>
          <p className="text-muted-foreground mb-3 text-xs">
            Add any playlist as a shelf on your home page.
          </p>
          <div className="space-y-1">
            {availablePlaylists.map((playlist) => (
              <div
                key={playlist.playlistId}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2",
                  "bg-[var(--glass-bg)] ring-1 ring-[var(--glass-border)]",
                  "transition-colors hover:bg-[var(--glass-hover)]"
                )}
              >
                <span className="min-w-0 flex-1 truncate text-sm">
                  {playlist.name}
                </span>
                {playlist.systemType && (
                  <Badge
                    variant="secondary"
                    className="flex-shrink-0 text-[10px]"
                  >
                    System
                  </Badge>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 flex-shrink-0"
                  onClick={() => handleAdd(playlist.playlistId)}
                  aria-label={`Add ${playlist.name} as shelf`}
                >
                  <FontAwesomeIcon
                    icon={faPlus}
                    className="size-3"
                    aria-hidden="true"
                  />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sortable shelf item
// ---------------------------------------------------------------------------

interface SortableShelfItemProps {
  shelf: ShelfConfig;
  onRemove: (playlistId: string) => void;
}

function SortableShelfItem({ shelf, onRemove }: SortableShelfItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: shelf.playlistId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2",
        "bg-[var(--glass-bg)] ring-1 ring-[var(--glass-border)]",
        isDragging && "z-50 opacity-80 shadow-lg"
      )}
      aria-roledescription="sortable"
    >
      <button
        type="button"
        className={cn(
          "flex-shrink-0 cursor-grab touch-none text-[var(--tertiary-foreground)]",
          "transition-colors hover:text-white",
          "active:cursor-grabbing"
        )}
        aria-label={`Reorder ${shelf.name}`}
        {...attributes}
        {...listeners}
      >
        <FontAwesomeIcon
          icon={faGripVertical}
          className="size-3.5"
          aria-hidden="true"
        />
      </button>

      <span className="min-w-0 flex-1 truncate text-sm">{shelf.name}</span>

      {shelf.systemType && (
        <Badge variant="secondary" className="flex-shrink-0 text-[10px]">
          System
        </Badge>
      )}

      <Button
        variant="ghost"
        size="icon"
        className="size-7 flex-shrink-0"
        onClick={() => onRemove(shelf.playlistId)}
        aria-label={`Remove ${shelf.name} from shelves`}
      >
        <FontAwesomeIcon icon={faXmark} className="size-3" aria-hidden="true" />
      </Button>
    </div>
  );
}
