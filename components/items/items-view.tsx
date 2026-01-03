/**
 * Client-side items view with tree/grid toggle and drag-drop support.
 * Handles all item CRUD operations and reordering.
 * Supports SFTP integration with sync and upload functionality.
 */

"use client";

import { useState, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Folder, Home, Server } from "lucide-react";
import { UniqueIdentifier } from "@dnd-kit/core";
import { toast } from "sonner";

import { SortableTree } from "@/components/sortable-tree";
import { SortableGrid } from "@/components/sortable-grid";
import { ViewToggle, useStoredViewMode } from "./view-toggle";
import { AddItemButton } from "./add-item-button";
import { ItemSettingsDialog } from "./item-settings-dialog";
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
  item: { id: string; name: string };
  files: {
    media: SerializedItemFile[];
    artwork: SerializedItemFile[];
    subtitles: SerializedItemFile[];
  };
}

interface ItemsViewProps {
  items: ItemWithArtwork[];
  parentId?: string | null;
  breadcrumbs?: Array<{ id: string; name: string }>;
  /** SFTP connection ID if this view is for an SFTP-connected folder. */
  connectionId?: string | null;
}

export function ItemsView({
  items: initialItems,
  parentId = null,
  breadcrumbs = [],
  connectionId = null,
}: ItemsViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [items, setItems] = useState<ItemWithArtwork[]>(initialItems);
  // Single source of truth for view mode - hydration-safe via useSyncExternalStore
  const [viewMode] = useStoredViewMode();
  // Settings dialog state
  const [settingsDialog, setSettingsDialog] =
    useState<SettingsDialogState | null>(null);

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
  }, [connectionId, parentId]);

  /**
   * Opens the settings dialog for an item.
   * Fetches the item's files before opening.
   */
  const handleOpenSettings = useCallback(
    async (id: string) => {
      const item = items.find((i) => i.id === id);
      if (!item) return;

      // Fetch files for this item
      const filesResult = await getItemFiles(id);
      const files =
        filesResult.success && filesResult.data
          ? filesResult.data
          : { media: [], artwork: [], subtitles: [] };

      setSettingsDialog({
        item: { id: item.id, name: item.name },
        files,
      });
    },
    [items]
  );

  // Handle item click - navigate to item detail
  const handleItemClick = useCallback(
    (id: UniqueIdentifier) => {
      if (connectionId) {
        router.push(`/dashboard/connections/${connectionId}/${id}`);
      } else {
        router.push(`/dashboard/${id}`);
      }
    },
    [router, connectionId]
  );

  /**
   * Generates the href for a breadcrumb based on context.
   *
   * @param crumbId - The breadcrumb item ID
   * @param index - Position in breadcrumb array (0 = first after home/connection)
   * @returns The href for navigation
   */
  const getBreadcrumbHref = useCallback(
    (crumbId: string, index: number): string => {
      if (!connectionId) {
        // Regular items - first crumb is a folder
        return `/dashboard/${crumbId}`;
      }
      // Connection items: first crumb is connection root, rest are folders
      if (index === 0) {
        return `/dashboard/connections/${connectionId}`;
      }
      return `/dashboard/connections/${connectionId}/${crumbId}`;
    },
    [connectionId]
  );

  // Handle creating new item at root level
  const handleCreateItem = useCallback(
    async (name: string): Promise<string | undefined> => {
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
          const result = await createItem(parentId, name);
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
    [parentId, connectionId, refetchItems]
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
    [items, refetchItems]
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
    [items, refetchItems]
  );

  // Handle adding child item
  const handleAddChild = useCallback(
    async (parentItemId: string, name: string): Promise<string | undefined> => {
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
          const result = await createItem(parentItemId, name);
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
    [items, connectionId, refetchItems]
  );

  // Handle tree reordering
  const handleTreeItemsChange = useCallback(async (newTreeItems: TreeItems) => {
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
  }, []);

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
    []
  );

  // Filter items for current level (grid view shows only current level)
  const currentLevelItems = items.filter((item) => item.parentId === parentId);

  return (
    <div className={cn("flex flex-col gap-6", isPending && "opacity-70")}>
      {/* Header with breadcrumbs and controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Breadcrumb navigation */}
        <nav
          aria-label="Items breadcrumb"
          className="flex items-center gap-1.5 text-sm"
        >
          {connectionId ? (
            // Connection context: show Connections link first
            <Link
              href="/dashboard/connections"
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2 py-1",
                "text-muted-foreground hover:text-foreground",
                "transition-colors duration-150"
              )}
            >
              <Server className="size-4" strokeWidth={2} />
              <span>Connections</span>
            </Link>
          ) : (
            // Regular context: show My Files
            <Link
              href="/dashboard"
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2 py-1",
                "text-muted-foreground hover:text-foreground",
                "transition-colors duration-150",
                breadcrumbs.length === 0 && "text-foreground font-medium"
              )}
            >
              <Home className="size-4" strokeWidth={2} />
              <span>My Files</span>
            </Link>
          )}

          {breadcrumbs.map((crumb, index) => (
            <div key={crumb.id} className="flex items-center gap-1.5">
              <span className="text-muted-foreground/50">/</span>
              <Link
                href={getBreadcrumbHref(crumb.id, index)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-2 py-1",
                  "text-muted-foreground hover:text-foreground",
                  "transition-colors duration-150",
                  index === breadcrumbs.length - 1 &&
                    "text-foreground font-medium"
                )}
              >
                {connectionId && index === 0 ? (
                  <Server className="size-4" strokeWidth={2} />
                ) : (
                  <Folder className="size-4" strokeWidth={2} />
                )}
                <span className="max-w-32 truncate">{crumb.name}</span>
              </Link>
            </div>
          ))}
        </nav>

        {/* Controls - hide add button when showing empty state */}
        <div className="flex items-center gap-3">
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
          {items.length > 0 && <AddItemButton onAdd={handleCreateItem} />}
          <ViewToggle />
        </div>
      </div>

      {/* Items display */}
      <div className="min-h-[200px]">
        {items.length === 0 ? (
          <EmptyState onAdd={handleCreateItem} />
        ) : viewMode === "tree" ? (
          <SortableTree
            items={treeItems}
            onItemsChange={handleTreeItemsChange}
            onItemClick={handleItemClick}
            onOpenSettings={handleOpenSettings}
            onDeleteItem={handleDeleteItem}
            onAddChild={handleAddChild}
          />
        ) : (
          <SortableGrid
            items={currentLevelItems}
            onItemsChange={handleGridItemsChange}
            onItemClick={handleItemClick}
            onOpenSettings={handleOpenSettings}
            onDeleteItem={handleDeleteItem}
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
          onSettingsChange={refetchItems}
        />
      )}
    </div>
  );
}

// Empty state component
function EmptyState({
  onAdd,
}: {
  onAdd: (name: string) => Promise<string | undefined>;
}) {
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
      <AddItemButton onAdd={onAdd} />
    </div>
  );
}
