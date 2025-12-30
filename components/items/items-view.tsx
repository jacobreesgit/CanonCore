/**
 * Client-side items view with tree/grid toggle and drag-drop support.
 * Handles all item CRUD operations and reordering.
 */

"use client";

import { useState, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Folder, Home } from "lucide-react";
import { UniqueIdentifier } from "@dnd-kit/core";
import { toast } from "sonner";

import { SortableTree } from "@/components/sortable-tree";
import { SortableGrid } from "@/components/sortable-grid";
import { ViewToggle, useStoredViewMode } from "./view-toggle";
import { AddItemButton } from "./add-item-button";
import type { Item, TreeItems } from "@/lib/types";
import { itemsToTree, treeToItemUpdates } from "@/lib/item-utils";
import {
  createItem,
  updateItem,
  deleteItem,
  reorderItems,
} from "@/lib/item-actions";
import { cn } from "@/lib/utils";

interface ItemsViewProps {
  items: Item[];
  parentId?: string | null;
  breadcrumbs?: Array<{ id: string; name: string }>;
}

export function ItemsView({
  items: initialItems,
  parentId = null,
  breadcrumbs = [],
}: ItemsViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [items, setItems] = useState<Item[]>(initialItems);
  // Single source of truth for view mode - hydration-safe via useSyncExternalStore
  const [viewMode] = useStoredViewMode();

  // Convert flat items to tree structure for SortableTree
  const treeItems = itemsToTree(items);

  // Refetch items after mutations
  const refetchItems = useCallback(() => {
    router.refresh();
  }, [router]);

  // Handle item click - navigate to item detail
  const handleItemClick = useCallback(
    (id: UniqueIdentifier) => {
      router.push(`/dashboard/${id}`);
    },
    [router]
  );

  // Handle creating new item at root level
  const handleCreateItem = useCallback(
    async (name: string): Promise<string | undefined> => {
      try {
        const result = await createItem(parentId, name);
        if (result.success && result.data) {
          const newItem = result.data;
          setItems((prev) => [...prev, newItem]);
          startTransition(() => refetchItems());
          toast.success(`Created "${name}"`);
          return undefined;
        }
        toast.error(result.error || "Failed to create folder");
        return result.error;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to create folder";
        toast.error(message);
        return message;
      }
    },
    [parentId, refetchItems]
  );

  // Handle renaming an item
  const handleRenameItem = useCallback(
    async (id: string, newName: string) => {
      const result = await updateItem(id, { name: newName });
      if (result.success) {
        setItems((prev) =>
          prev.map((item) =>
            item.id === id ? { ...item, name: newName } : item
          )
        );
        startTransition(() => refetchItems());
        toast.success(`Renamed to "${newName}"`);
      } else {
        toast.error(result.error || "Failed to rename folder");
      }
    },
    [refetchItems]
  );

  // Handle deleting an item
  const handleDeleteItem = useCallback(
    async (id: string) => {
      const result = await deleteItem(id);
      if (result.success) {
        setItems((prev) => prev.filter((item) => item.id !== id));
        startTransition(() => refetchItems());
        toast.success("Folder deleted");
      } else {
        toast.error(result.error || "Failed to delete folder");
      }
    },
    [refetchItems]
  );

  // Handle adding child item
  const handleAddChild = useCallback(
    async (parentItemId: string, name: string): Promise<string | undefined> => {
      try {
        const result = await createItem(parentItemId, name);
        if (result.success && result.data) {
          const newItem = result.data;
          setItems((prev) => [...prev, newItem]);
          startTransition(() => refetchItems());
          toast.success(`Created "${name}"`);
          return undefined;
        }
        toast.error(result.error || "Failed to create folder");
        return result.error;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to create folder";
        toast.error(message);
        return message;
      }
    },
    [refetchItems]
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
  const handleGridItemsChange = useCallback(async (newItems: Item[]) => {
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
  }, []);

  // Filter items for current level (grid view shows only current level)
  const currentLevelItems = items.filter((item) => item.parentId === parentId);

  return (
    <div className={cn("flex flex-col gap-6", isPending && "opacity-70")}>
      {/* Header with breadcrumbs and controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Breadcrumb navigation */}
        <nav className="flex items-center gap-1.5 text-sm">
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2 py-1",
              "text-muted-foreground hover:text-foreground",
              "transition-colors duration-150",
              breadcrumbs.length === 0 && "text-foreground font-medium"
            )}
          >
            <Home className="size-4" strokeWidth={2} />
            <span>My Files</span>
          </button>

          {breadcrumbs.map((crumb, index) => (
            <div key={crumb.id} className="flex items-center gap-1.5">
              <span className="text-muted-foreground/50">/</span>
              <button
                type="button"
                onClick={() => router.push(`/dashboard/${crumb.id}`)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-2 py-1",
                  "text-muted-foreground hover:text-foreground",
                  "transition-colors duration-150",
                  index === breadcrumbs.length - 1 &&
                    "text-foreground font-medium"
                )}
              >
                <Folder className="size-4" strokeWidth={2} />
                <span className="max-w-32 truncate">{crumb.name}</span>
              </button>
            </div>
          ))}
        </nav>

        {/* Controls - hide add button when showing empty state */}
        <div className="flex items-center gap-3">
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
            onRenameItem={handleRenameItem}
            onDeleteItem={handleDeleteItem}
            onAddChild={handleAddChild}
          />
        ) : (
          <SortableGrid
            items={currentLevelItems}
            onItemsChange={handleGridItemsChange}
            onItemClick={handleItemClick}
            onRenameItem={handleRenameItem}
            onDeleteItem={handleDeleteItem}
          />
        )}
      </div>
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
