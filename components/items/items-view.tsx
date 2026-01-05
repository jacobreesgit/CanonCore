/**
 * Client-side items view with tree/grid toggle and drag-drop support.
 * Handles all item CRUD operations and reordering.
 * Supports SFTP integration with sync and upload functionality.
 */

"use client";

import { useState, useCallback, useTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Folder, Plus } from "lucide-react";
import { useQuickCreateOptional } from "@/contexts/add-folder-context";
import { UniqueIdentifier } from "@dnd-kit/core";
import { toast } from "sonner";

import { SortableTree, Tree } from "@/components/sortable-tree";
import { SortableGrid, Grid } from "@/components/sortable-grid";
import { EditModeToggle } from "./edit-mode-toggle";
import { ViewToggle, useStoredViewMode } from "./view-toggle";
import { AddFolderDialog } from "./add-folder-dialog";
import { ItemSettingsDialog } from "./item-settings-dialog";
import { Button } from "@/components/ui/button";
import { SyncButton } from "@/components/sftp/sync-button";
import type {
  ItemWithArtwork,
  TreeItems,
  SerializedItemFile,
} from "@/lib/types";
import { itemsToTree, treeToItemUpdates } from "@/lib/item-utils";
import {
  createItem,
  updateItem,
  deleteItem,
  reorderItems,
  getItems,
} from "@/lib/item-actions";
import { getItemFiles } from "@/lib/item-file-actions";
import {
  createSftpFolder,
  renameSftpItem,
  deleteSftpItem,
  getItemsByConnection,
} from "@/lib/sftp-actions";
import { cn } from "@/lib/utils";

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
  /** SFTP connection ID if this view is for an SFTP-connected folder. */
  connectionId?: string | null;
}

export function ItemsView({
  items: initialItems,
  parentId = null,
  connectionId = null,
}: ItemsViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [items, setItemsState] = useState<ItemWithArtwork[]>(initialItems);
  // Ref to always access latest items (avoids stale closure in callbacks)
  const itemsRef = useRef(items);

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
  // Edit mode state - when true, shows DnD-enabled components
  const [isEditing, setIsEditing] = useState(false);
  // Settings dialog state
  const [settingsDialog, setSettingsDialog] =
    useState<SettingsDialogState | null>(null);
  // Add folder dialog state
  const [addFolderOpen, setAddFolderOpen] = useState(false);

  // Exit edit mode when view mode changes - intentional minimal cascade
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsEditing(false);
  }, [viewMode]);

  // Sync local state when props change
  useEffect(() => {
    setItems(initialItems);
  }, [initialItems, setItems]);

  // Convert flat items to tree structure for SortableTree
  const treeItems = itemsToTree(items);

  /**
   * Refetch items from server and update local state.
   * Uses appropriate action based on whether viewing SFTP connection or regular items.
   */
  const refetchItems = useCallback(async () => {
    const result = connectionId
      ? await getItemsByConnection(connectionId, parentId)
      : await getItems(parentId);

    if (result.success && result.data) {
      setItems(result.data);
    }
  }, [connectionId, parentId, setItems]);

  // Subscribe to Quick Create events for explicit refetch (only at root level)
  const quickCreate = useQuickCreateOptional();
  useEffect(() => {
    if (!quickCreate || parentId) return; // Only subscribe at root level
    return quickCreate.subscribeToCreation(() => {
      startTransition(() => refetchItems());
    });
  }, [quickCreate, parentId, refetchItems]);

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
      if (connectionId) {
        router.push(`/my-items/connections/${connectionId}/${id}`);
      } else {
        router.push(`/my-items/${id}`);
      }
    },
    [router, connectionId]
  );

  // Handle creating new item at root level
  const handleCreateItem = useCallback(
    async (name: string, description?: string): Promise<string | undefined> => {
      try {
        // Use SFTP action when in an SFTP-connected context
        if (connectionId) {
          const result = await createSftpFolder(connectionId, parentId, name);
          if (result.success && result.data) {
            // Update local state immediately with the returned item
            const newItem: ItemWithArtwork = {
              ...result.data,
              artworkId: null,
            };
            setItems((prev) => [...prev, newItem]);
            startTransition(() => refetchItems());
            toast.success(`Created "${name}"`);
            return undefined;
          }
          const errorMsg = !result.success
            ? result.error
            : "Failed to create folder";
          toast.error(errorMsg || "Failed to create folder");
          return errorMsg;
        } else {
          const result = await createItem(parentId, name, description);
          if (result.success && result.data) {
            const newItem: ItemWithArtwork = {
              ...result.data,
              artworkId: null,
            };
            setItems((prev) => [...prev, newItem]);
            startTransition(() => refetchItems());
            toast.success(`Created "${name}"`);
            return undefined;
          }
          toast.error(result.error || "Failed to create folder");
          return result.error;
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to create folder";
        toast.error(message);
        return message;
      }
    },
    [parentId, connectionId, refetchItems, setItems]
  );

  // Handle renaming an item
  const handleRenameItem = useCallback(
    async (id: string, newName: string) => {
      // Check if item has sftpPath to determine which action to use
      const item = items.find((i) => i.id === id);
      const result = item?.sftpPath
        ? await renameSftpItem(id, newName)
        : await updateItem(id, { name: newName });
      if (result.success) {
        setItems((prev) =>
          prev.map((i) => (i.id === id ? { ...i, name: newName } : i))
        );
        startTransition(() => refetchItems());
        toast.success(`Renamed to "${newName}"`);
      } else {
        toast.error(result.error || "Failed to rename");
      }
    },
    [items, refetchItems, setItems]
  );

  // Handle updating item description
  const handleUpdateDescription = useCallback(
    async (id: string, description: string) => {
      const result = await updateItem(id, { description });
      if (result.success) {
        setItems((prev) =>
          prev.map((i) =>
            i.id === id ? { ...i, description: description || null } : i
          )
        );
        startTransition(() => refetchItems());
        toast.success("Description updated");
      } else {
        toast.error(result.error || "Failed to update description");
      }
    },
    [refetchItems, setItems]
  );

  // Handle deleting an item
  const handleDeleteItem = useCallback(
    async (id: string) => {
      // Check if item has sftpPath to determine which action to use
      const item = items.find((i) => i.id === id);
      const result = item?.sftpPath
        ? await deleteSftpItem(id)
        : await deleteItem(id);
      if (result.success) {
        setItems((prev) => prev.filter((i) => i.id !== id));
        startTransition(() => refetchItems());
        toast.success("Deleted successfully");
      } else {
        toast.error(result.error || "Failed to delete");
      }
    },
    [items, refetchItems, setItems]
  );

  // Handle adding child item
  const handleAddChild = useCallback(
    async (
      parentItemId: string,
      name: string,
      description?: string
    ): Promise<string | undefined> => {
      try {
        // Check if parent has connectionId to determine which action to use
        const parentItem = items.find((i) => i.id === parentItemId);
        const connId = parentItem?.connectionId || connectionId;

        if (connId) {
          const result = await createSftpFolder(connId, parentItemId, name);
          if (result.success && result.data) {
            // Update local state immediately with the returned item
            const newItem: ItemWithArtwork = {
              ...result.data,
              artworkId: null,
            };
            setItems((prev) => [...prev, newItem]);
            startTransition(() => refetchItems());
            toast.success(`Created "${name}"`);
            return undefined;
          }
          const errorMsg = !result.success
            ? result.error
            : "Failed to create folder";
          toast.error(errorMsg || "Failed to create folder");
          return errorMsg;
        } else {
          const result = await createItem(parentItemId, name, description);
          if (result.success && result.data) {
            const newItem: ItemWithArtwork = {
              ...result.data,
              artworkId: null,
            };
            setItems((prev) => [...prev, newItem]);
            startTransition(() => refetchItems());
            toast.success(`Created "${name}"`);
            return undefined;
          }
          toast.error(result.error || "Failed to create folder");
          return result.error;
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to create folder";
        toast.error(message);
        return message;
      }
    },
    [items, connectionId, refetchItems, setItems]
  );

  // Handle tree reordering
  const handleTreeItemsChange = useCallback(
    async (newTreeItems: TreeItems) => {
      const updates = treeToItemUpdates(newTreeItems);
      const result = await reorderItems(updates);
      if (result.success) {
        // Update local state with new positions
        setItems((prev) =>
          prev.map((item) => {
            const update = updates.find((u) => u.id === item.id);
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
      }
    },
    [setItems]
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
      }
    },
    [setItems]
  );

  // Filter items for current level (grid view shows only current level)
  const currentLevelItems = items.filter((item) => item.parentId === parentId);

  return (
    <div className={cn("flex flex-col gap-6", isPending && "opacity-70")}>
      {/* Controls */}
      <div className="flex items-center justify-end gap-3">
        {/* SFTP Sync button - only show when connected */}
        {connectionId && (
          <SyncButton
            connectionId={connectionId}
            size="sm"
            onSyncComplete={async () => {
              await refetchItems();
            }}
          />
        )}
        {items.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAddFolderOpen(true)}
            className="gap-1.5"
          >
            <Plus className="size-4" strokeWidth={2} />
            <span>Add Folder</span>
          </Button>
        )}
        {items.length > 0 && (
          <>
            <EditModeToggle
              isEditing={isEditing}
              onToggle={() => setIsEditing((prev) => !prev)}
            />
            <ViewToggle />
          </>
        )}
      </div>

      {/* Items display */}
      <div className="min-h-[200px]">
        {items.length === 0 ? (
          <EmptyState onOpenAddFolder={() => setAddFolderOpen(true)} />
        ) : viewMode === "grid" ? (
          isEditing ? (
            <SortableGrid
              items={currentLevelItems}
              onItemsChange={handleGridItemsChange}
              onItemClick={handleItemClick}
              onOpenSettings={handleOpenSettings}
              onDeleteItem={handleDeleteItem}
            />
          ) : (
            <Grid
              items={currentLevelItems}
              onItemClick={handleItemClick}
              onOpenSettings={handleOpenSettings}
              onDeleteItem={handleDeleteItem}
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
          />
        ) : (
          <Tree
            items={treeItems}
            onItemClick={handleItemClick}
            onOpenSettings={handleOpenSettings}
            onDeleteItem={handleDeleteItem}
            onAddChild={handleAddChild}
          />
        )}
      </div>

      {/* Item Settings Dialog */}
      {settingsDialog && (
        <ItemSettingsDialog
          open={!!settingsDialog}
          onOpenChange={(open) => !open && setSettingsDialog(null)}
          item={settingsDialog.item}
          files={settingsDialog.files}
          onRename={async (newName) => {
            await handleRenameItem(settingsDialog.item.id, newName);
            // Update dialog state with new name
            setSettingsDialog((prev) =>
              prev ? { ...prev, item: { ...prev.item, name: newName } } : null
            );
          }}
          onDescriptionChange={async (description) => {
            await handleUpdateDescription(settingsDialog.item.id, description);
            // Update dialog state with new description
            setSettingsDialog((prev) =>
              prev
                ? {
                    ...prev,
                    item: {
                      ...prev.item,
                      description: description || null,
                    },
                  }
                : null
            );
          }}
          onSettingsChange={refetchItems}
        />
      )}

      {/* Add Folder Dialog */}
      <AddFolderDialog
        open={addFolderOpen}
        onOpenChange={setAddFolderOpen}
        onAdd={handleCreateItem}
      />
    </div>
  );
}

/** Empty state with call-to-action for folder creation. */
function EmptyState({ onOpenAddFolder }: { onOpenAddFolder: () => void }) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 py-16",
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
        <h3 className="text-foreground text-lg font-medium">No folders yet</h3>
        <p className="text-muted-foreground mt-1 text-sm">
          Create your first folder to get started
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={onOpenAddFolder}
        className="gap-1.5"
      >
        <Plus className="size-4" strokeWidth={2} />
        <span>Add Folder</span>
      </Button>
    </div>
  );
}
