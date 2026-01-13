/**
 * Client-side items view with tree/grid toggle and drag-drop support.
 * Handles all item CRUD operations and reordering.
 */

"use client";

import { useState, useTransition, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Folder, Loader2, Plus, RefreshCw } from "lucide-react";
import { useControllableState } from "@/hooks/use-controllable-state";
import { UniqueIdentifier } from "@dnd-kit/core";
import { toast } from "sonner";

import { SortableTree, Tree } from "@/components/sortable-tree";
import { SortableGrid, Grid } from "@/components/sortable-grid";
import { EditModeToggle } from "./edit-mode-toggle";
import { ViewToggle, useStoredViewMode } from "./view-toggle";
import { AddItemDialog } from "./add-item-dialog";
import { ItemSettingsDialog } from "./item-settings-dialog";
import { ItemHero } from "./item-hero";
import { Button } from "@/components/ui/button";
import type {
  ItemWithArtwork,
  TreeItems,
  SerializedItemFile,
} from "@/lib/types";
import { itemsToTree, treeToItemUpdates } from "@/lib/item-utils";
import {
  createItem,
  deleteItem,
  reorderItems,
  getItems,
} from "@/lib/item-actions";
import { getItemFiles } from "@/lib/item-file-actions";
import { syncFromGoogleDrive } from "@/lib/google-drive-sync";
import { cn } from "@/lib/utils";
import { useHeroCollapse } from "@/hooks/use-hero-collapse";

/** State for the settings dialog */
interface SettingsDialogState {
  item: { id: string; name: string; description: string | null };
  files: {
    media: SerializedItemFile[];
    artwork: SerializedItemFile[];
    subtitles: SerializedItemFile[];
  };
}

interface ItemsViewProps {
  items: ItemWithArtwork[];
  parentId?: string | null;
  /** Hide the internal toolbar (when using external ItemsToolbar). */
  hideToolbar?: boolean;
  /** External edit mode control - when provided, overrides internal state. */
  isEditing?: boolean;
  /** Callback when edit mode changes (for external control). */
  onEditingChange?: (editing: boolean) => void;
  /** External add item dialog control - when provided, overrides internal state. */
  addItemOpen?: boolean;
  /** Callback when add item dialog state changes (for external control). */
  onAddItemOpenChange?: (open: boolean) => void;
  /** Hero title (displays ItemHero after toolbar when provided). */
  heroTitle?: string;
  /** Item count for hero stats display. */
  heroItemCount?: number;
  /** Background URL for hero (e.g., /api/user/hero for My Items page). */
  heroBackgroundUrl?: string;
  /** Whether user has Google Drive connected (shows Sync button). */
  hasDriveConnection?: boolean;
}

/**
 * Client-side items view with tree/grid toggle and drag-drop support.
 * Manages CRUD operations, reordering, and settings dialogs.
 * Supports both internal state and external control via props.
 *
 * @param items - Initial items to display
 * @param parentId - Parent item ID (null for root)
 * @param hideToolbar - Hide internal toolbar (when using external toolbar)
 * @param isEditing - External edit mode control
 * @param onEditingChange - Callback when edit mode changes
 * @param addItemOpen - External add dialog control
 * @param onAddItemOpenChange - Callback when add dialog state changes
 * @param heroTitle - Title for hero banner (when provided)
 * @param heroItemCount - Item count for hero stats
 * @param heroBackgroundUrl - Background URL for hero
 * @param hasDriveConnection - Whether Google Drive is connected
 */
export function ItemsView({
  items: initialItems,
  parentId = null,
  hideToolbar = false,
  isEditing: externalIsEditing,
  onEditingChange,
  addItemOpen: externalAddItemOpen,
  onAddItemOpenChange,
  heroTitle,
  heroItemCount,
  heroBackgroundUrl,
  hasDriveConnection = false,
}: ItemsViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [items, setItemsState] = useState<ItemWithArtwork[]>(initialItems);
  // Ref to always access latest items (avoids stale closure in callbacks)
  const itemsRef = useRef(items);

  // Hero collapse state with localStorage persistence
  const { isCollapsed, toggleCollapse } = useHeroCollapse();

  /**
   * Wrapper around setItems that also updates the ref synchronously.
   * This ensures handleOpenSettings always sees the latest items.
   */
  const setItems = useCallback(
    (
      update:
        | ItemWithArtwork[]
        | ((prev: ItemWithArtwork[]) => ItemWithArtwork[])
    ) => {
      setItemsState((prev) => {
        const next = typeof update === "function" ? update(prev) : update;
        itemsRef.current = next;
        return next;
      });
    },
    []
  );
  // Single source of truth for view mode - hydration-safe via useSyncExternalStore
  const [viewMode] = useStoredViewMode();
  // Edit mode state - supports external control or internal state via useControllableState
  const [isEditing, setIsEditing] = useControllableState({
    value: externalIsEditing,
    defaultValue: false,
    onChange: onEditingChange,
  });
  // Settings dialog state
  const [settingsDialog, setSettingsDialog] =
    useState<SettingsDialogState | null>(null);
  // Add item dialog state - supports external control or internal state via useControllableState
  const [addItemOpen, setAddItemOpen] = useControllableState({
    value: externalAddItemOpen,
    defaultValue: false,
    onChange: onAddItemOpenChange,
  });
  // Sync state
  const [isSyncing, startSyncTransition] = useTransition();

  // Exit edit mode when view mode changes - intentional minimal cascade
  useEffect(() => {
    setIsEditing(false);
  }, [viewMode, setIsEditing]);

  // Sync local state when props change
  useEffect(() => {
    setItems(initialItems);
  }, [initialItems, setItems]);

  // Convert flat items to tree structure for SortableTree
  const treeItems = itemsToTree(items);

  /**
   * Refetch items from server and update local state.
   */
  const refetchItems = useCallback(async () => {
    const result = await getItems(parentId);

    if (result.success && result.data) {
      setItems(result.data);
    }
  }, [parentId, setItems]);

  /**
   * Triggers a sync from Google Drive.
   */
  const handleSync = useCallback(() => {
    startSyncTransition(async () => {
      const result = await syncFromGoogleDrive();

      if (result.success) {
        const parts = [];
        if (result.itemsCreated) parts.push(`${result.itemsCreated} created`);
        if (result.itemsUpdated) parts.push(`${result.itemsUpdated} updated`);
        if (result.itemsErrored) parts.push(`${result.itemsErrored} failed`);

        const message =
          parts.length > 0 ? parts.join(", ") : "Already up to date";
        toast.success(`Sync complete: ${message}`);
        await refetchItems();
      } else {
        // Show user-friendly message for root folder errors (detailed UI in settings)
        if (result.error === "ROOT_FOLDER_TRASHED") {
          toast.error(
            "Sync paused: CanonCore folder is in Trash. Check settings to restore."
          );
        } else if (result.error === "ROOT_FOLDER_DELETED") {
          toast.error(
            "Sync paused: CanonCore folder was deleted. Reconnect in settings."
          );
        } else {
          toast.error(result.error || "Sync failed");
        }
      }
    });
  }, [refetchItems]);

  /**
   * Opens the settings dialog for an item.
   * Uses itemsRef to always get latest items (avoids stale closure).
   * Fetches the item's files before opening.
   */
  const handleOpenSettings = useCallback(async (id: string) => {
    // Use ref to avoid stale closure when items update right before reopening
    const item = itemsRef.current.find((i) => i.id === id);
    if (!item) return;

    // Fetch files for this item
    const filesResult = await getItemFiles(id);
    const files =
      filesResult.success && filesResult.data
        ? filesResult.data
        : { media: [], artwork: [], subtitles: [] };

    setSettingsDialog({
      item: { id: item.id, name: item.name, description: item.description },
      files,
    });
  }, []);

  // Handle item click - navigate to item detail
  const handleItemClick = useCallback(
    (id: UniqueIdentifier) => {
      router.push(`/my-items/${id}`);
    },
    [router]
  );

  // Handle creating new item at root level
  const handleCreateItem = useCallback(
    async (name: string, description?: string): Promise<string | undefined> => {
      try {
        const result = await createItem(parentId, name, description);
        if (result.success && result.data) {
          const newItem: ItemWithArtwork = {
            ...result.data,
            artworkId: null,
            fileCounts: { media: 0, artwork: 0, subtitles: 0 },
            childCount: 0,
            primaryMediaName: null,
            mediaIconType: null,
          };
          setItems((prev) => [...prev, newItem]);
          startTransition(() => refetchItems());
          toast.success(`Created "${name}"`);
          return undefined;
        }
        toast.error(result.error || "Failed to create item");
        return result.error;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to create item";
        toast.error(message);
        return message;
      }
    },
    [parentId, refetchItems, setItems]
  );

  // Handle deleting an item
  const handleDeleteItem = useCallback(
    async (id: string) => {
      const result = await deleteItem(id);
      if (result.success) {
        setItems((prev) => prev.filter((i) => i.id !== id));
        startTransition(() => refetchItems());
        toast.success("Deleted successfully");
      } else {
        toast.error(result.error || "Failed to delete");
      }
    },
    [refetchItems, setItems]
  );

  // Handle adding child item
  const handleAddChild = useCallback(
    async (
      parentItemId: string,
      name: string,
      description?: string
    ): Promise<string | undefined> => {
      try {
        const result = await createItem(parentItemId, name, description);
        if (result.success && result.data) {
          const newItem: ItemWithArtwork = {
            ...result.data,
            artworkId: null,
            fileCounts: { media: 0, artwork: 0, subtitles: 0 },
            childCount: 0,
            primaryMediaName: null,
            mediaIconType: null,
          };
          setItems((prev) => [...prev, newItem]);
          startTransition(() => refetchItems());
          toast.success(`Created "${name}"`);
          return undefined;
        }
        toast.error(result.error || "Failed to create item");
        return result.error;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to create item";
        toast.error(message);
        return message;
      }
    },
    [refetchItems, setItems]
  );

  // Handle tree reordering
  const handleTreeItemsChange = useCallback(
    async (newTreeItems: TreeItems) => {
      const updates = treeToItemUpdates(newTreeItems);

      // Fix: On detail pages, the tree treats descendants as "root" nodes with parentId=null
      // and depth=0. We need to correct these based on actual context.
      // Get the base depth from initial items (they have correct DB depths).
      const directChildren = parentId
        ? items.filter((i) => i.parentId === parentId)
        : [];
      const baseDepth =
        directChildren.length > 0
          ? Math.min(...directChildren.map((i) => i.depth))
          : 0;

      const correctedUpdates = parentId
        ? updates.map((update) => ({
            ...update,
            // Offset tree depth by base depth to get actual depth
            depth: update.depth + baseDepth,
            // For items at tree depth 0, set parentId to the current page's item
            parentId: update.depth === 0 ? parentId : update.parentId,
          }))
        : updates;

      const result = await reorderItems(correctedUpdates);
      if (result.success) {
        // Update local state with new positions
        setItems((prev) =>
          prev.map((item) => {
            const update = correctedUpdates.find((u) => u.id === item.id);
            if (update) {
              return {
                ...item,
                parentId: update.parentId,
                depth: update.depth,
                order: update.order,
              };
            }
            return item;
          })
        );
        toast.success("Changes saved");
      } else {
        toast.error(result.error || "Failed to save changes");
      }
    },
    [setItems, parentId, items]
  );

  // Handle grid reordering (same level only)
  const handleGridItemsChange = useCallback(
    async (newItems: ItemWithArtwork[]) => {
      const updates = newItems.map((item, index) => ({
        id: item.id,
        parentId: item.parentId,
        depth: item.depth,
        order: index,
      }));

      const result = await reorderItems(updates);
      if (result.success) {
        setItems(newItems);
        toast.success("Changes saved");
      } else {
        toast.error(result.error || "Failed to save changes");
      }
    },
    [setItems]
  );

  // Filter items for current level (grid view shows only current level)
  const currentLevelItems = items.filter((item) => item.parentId === parentId);

  return (
    <div
      className={cn(
        "flex flex-col gap-6",
        items.length === 0 && "flex-1",
        isPending && "opacity-70"
      )}
    >
      {/* Hero section - shown when heroTitle provided */}
      {heroTitle && (
        <ItemHero
          name={heroTitle}
          childCount={heroItemCount ?? items.length}
          backgroundUrl={heroBackgroundUrl}
          isCollapsed={isCollapsed}
          onCollapse={toggleCollapse}
        />
      )}

      {/* Toolbar - always visible, buttons disabled when not applicable */}
      {!hideToolbar && (
        <div className="flex items-center justify-between gap-3">
          {/* Left side: Sync button */}
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSync}
              disabled={!hasDriveConnection || isSyncing}
              className="gap-1.5"
            >
              {isSyncing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              <span>{isSyncing ? "Syncing..." : "Sync"}</span>
            </Button>
          </div>

          {/* Right side: Add Item + Edit + View toggle */}
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAddItemOpen(true)}
              className="gap-1.5"
            >
              <Plus className="size-4" strokeWidth={2} />
              <span>Add Item</span>
            </Button>
            <EditModeToggle
              isEditing={isEditing}
              onToggle={() => setIsEditing((prev) => !prev)}
              disabled={items.length === 0}
            />
            <ViewToggle disabled={items.length === 0} />
          </div>
        </div>
      )}

      {/* Items display */}
      {items.length === 0 ? (
        <EmptyState onOpenAddItem={() => setAddItemOpen(true)} />
      ) : viewMode === "grid" ? (
        isEditing ? (
          <SortableGrid
            items={currentLevelItems}
            onItemsChange={handleGridItemsChange}
            onItemClick={handleItemClick}
            onOpenSettings={handleOpenSettings}
            onDeleteItem={handleDeleteItem}
            hasDriveConnection={hasDriveConnection}
          />
        ) : (
          <Grid
            items={currentLevelItems}
            onItemClick={handleItemClick}
            onOpenSettings={handleOpenSettings}
            onDeleteItem={handleDeleteItem}
            hasDriveConnection={hasDriveConnection}
          />
        )
      ) : isEditing ? (
        <SortableTree
          items={treeItems}
          onItemsChange={handleTreeItemsChange}
          onItemClick={handleItemClick}
          onOpenSettings={handleOpenSettings}
          onDeleteItem={handleDeleteItem}
          onAddChild={handleAddChild}
          hasDriveConnection={hasDriveConnection}
        />
      ) : (
        <Tree
          items={treeItems}
          onItemClick={handleItemClick}
          onOpenSettings={handleOpenSettings}
          onDeleteItem={handleDeleteItem}
          onAddChild={handleAddChild}
          hasDriveConnection={hasDriveConnection}
        />
      )}

      {/* Item Settings Dialog */}
      {settingsDialog && (
        <ItemSettingsDialog
          open={!!settingsDialog}
          onOpenChange={(open) => !open && setSettingsDialog(null)}
          item={settingsDialog.item}
          files={settingsDialog.files}
          hasDriveConnection={hasDriveConnection}
          onSettingsChange={async () => {
            await refetchItems();
            // Refetch dialog state to show updated values
            const filesResult = await getItemFiles(settingsDialog.item.id);
            const updatedFiles =
              filesResult.success && filesResult.data
                ? filesResult.data
                : settingsDialog.files;

            // Refetch item data from local state to get updated name/description
            const updatedItem = itemsRef.current.find(
              (i) => i.id === settingsDialog.item.id
            );
            if (updatedItem) {
              setSettingsDialog({
                item: {
                  id: updatedItem.id,
                  name: updatedItem.name,
                  description: updatedItem.description,
                },
                files: updatedFiles,
              });
            }
          }}
        />
      )}

      {/* Add Item Dialog */}
      <AddItemDialog
        open={addItemOpen}
        onOpenChange={setAddItemOpen}
        onAdd={handleCreateItem}
        hasDriveConnection={hasDriveConnection}
      />
    </div>
  );
}

/** Empty state with call-to-action for item creation. */
function EmptyState({ onOpenAddItem }: { onOpenAddItem: () => void }) {
  return (
    <div
      className={cn(
        "flex flex-1 flex-col items-center justify-center gap-4",
        "border-border/60 rounded-xl border-2 border-dashed",
        "bg-muted/20"
      )}
    >
      <div
        className={cn(
          "flex size-16 items-center justify-center rounded-full",
          "bg-muted/60 text-muted-foreground"
        )}
      >
        <Folder className="size-8" strokeWidth={1.5} />
      </div>
      <div className="text-center">
        <h3 className="text-foreground text-lg font-medium">No items yet</h3>
        <p className="text-muted-foreground mt-1 text-sm">
          Create your first item to get started
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={onOpenAddItem}
        className="gap-1.5"
      >
        <Plus className="size-4" strokeWidth={2} />
        <span>Add Item</span>
      </Button>
    </div>
  );
}
