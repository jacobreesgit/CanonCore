/**
 * Client-side items view with tree/grid toggle and drag-drop support.
 * Handles all item CRUD operations and reordering.
 */

"use client";

import { useState, useTransition, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Loader2, Plus, RefreshCw } from "lucide-react";
import { useControllableState } from "@/hooks/use-controllable-state";
import { UniqueIdentifier } from "@dnd-kit/core";
import { toast } from "sonner";

// Static imports for view-only mode (common case)
import { Tree } from "@/components/sortable-tree";
import { Grid } from "@/components/sortable-grid";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading skeleton for tree view during edit mode chunk load.
 */
function TreeSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

/**
 * Loading skeleton for grid view during edit mode chunk load.
 */
function GridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="aspect-[2/3] w-full rounded-lg" />
      ))}
    </div>
  );
}

// Dynamic imports for edit mode (~15KB dnd-kit loaded on demand)
const SortableTree = dynamic(
  () => import("@/components/sortable-tree").then((mod) => mod.SortableTree),
  { loading: () => <TreeSkeleton />, ssr: false }
);

const SortableGrid = dynamic(
  () => import("@/components/sortable-grid").then((mod) => mod.SortableGrid),
  { loading: () => <GridSkeleton />, ssr: false }
);
import { EditModeToggle } from "./edit-mode-toggle";
import { ViewToggle, useStoredViewMode } from "./view-toggle";
import { SortDropdown } from "./sort-dropdown";
import { FilterDropdown } from "./filter-dropdown";
import { MobileOptionsSheet } from "./mobile-options-sheet";
import { AddItemDialog } from "./add-item-dialog";
import { ItemSettingsDialog } from "./item-settings-dialog";
import { ItemHero } from "./item-hero";
import { EmptyState, type EmptyStateVariant } from "./empty-state";
import { BulkActionsToolbar } from "./bulk-actions-toolbar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useBulkSelection } from "@/hooks/use-bulk-selection";
import type {
  ItemWithArtwork,
  TreeItems,
  SerializedItemFile,
  TMDBMetadataSelection,
  ItemProgress,
} from "@/lib/types";
import { formatProgressLabel } from "@/lib/progress-utils";
import {
  itemsToTree,
  treeToItemUpdates,
  sortItems,
  filterItems,
} from "@/lib/item-utils";
import { useItemsSortFilter } from "@/hooks/use-items-sort-filter";
import { useGoToItem } from "@/hooks/use-go-to-item";
import {
  createItem,
  createItemWithMetadata,
  deleteItem,
  deleteItems,
  reorderItems,
  getItems,
  pinItem,
  unpinItem,
} from "@/lib/item-actions";
import { getItemFiles } from "@/lib/item-file-actions";
import { syncFromGoogleDrive } from "@/lib/google-drive-sync";
import { cn } from "@/lib/utils";
import { useHeroCollapse } from "@/hooks/use-hero-collapse";

/** State for the settings dialog */
interface SettingsDialogState {
  item: {
    id: string;
    name: string;
    description: string | null;
    isPublic: boolean;
    inheritVisibility: boolean;
    hasParent: boolean;
    hasChildren: boolean;
  };
  files: {
    media: SerializedItemFile[];
    artwork: SerializedItemFile[];
    subtitles: SerializedItemFile[];
  };
}

interface CurrentUser {
  id: string;
  username: string | null;
  name: string | null;
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
  /** Background URL for hero (e.g., /api/user/hero for My Items page). */
  heroBackgroundUrl?: string;
  /** Progress data for hero display (library-wide progress for My Items). */
  heroProgress?: ItemProgress | null;
  /** Whether user has Google Drive connected (shows Sync button). */
  hasDriveConnection?: boolean;
  /** Current user info for owner display in grid items. */
  currentUser?: CurrentUser | null;
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
  heroBackgroundUrl,
  heroProgress,
  hasDriveConnection = false,
  currentUser,
}: ItemsViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [items, setItemsState] = useState<ItemWithArtwork[]>(initialItems);
  // Ref to always access latest items (avoids stale closure in callbacks)
  const itemsRef = useRef(items);

  // Hero collapse state with localStorage persistence
  const { isCollapsed, toggleCollapse } = useHeroCollapse();

  // First incomplete item for "Go to" button (only when hero is shown)
  const { nextItem, goToNext } = useGoToItem({
    parentId: parentId ?? undefined,
    enabled: !!heroTitle,
  });

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

  // Sort/filter state from hook (persisted to localStorage)
  const {
    sortBy,
    setSortBy,
    filterBy,
    setFilterBy,
    isCustomSort,
    hasActiveFilter,
  } = useItemsSortFilter();

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
  // Bulk delete state
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);

  // Exit edit mode when view mode changes - intentional minimal cascade
  useEffect(() => {
    setIsEditing(false);
  }, [viewMode, setIsEditing]);

  // Sync local state when props change
  useEffect(() => {
    setItems(initialItems);
  }, [initialItems, setItems]);

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
      item: {
        id: item.id,
        name: item.name,
        description: item.description,
        isPublic: item.isPublic,
        inheritVisibility: item.inheritVisibility,
        hasParent: item.parentId !== null,
        hasChildren: item.childCount > 0,
      },
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
  // Returns itemId on success for AddItemDialog to handle file uploads
  const handleCreateItem = useCallback(
    async (
      name: string,
      description?: string,
      tmdbSelection?: TMDBMetadataSelection
    ): Promise<{ itemId?: string; error?: string }> => {
      try {
        // Use createItemWithMetadata if TMDB selection provided, otherwise basic createItem
        const result = tmdbSelection
          ? await createItemWithMetadata(parentId, name, description, {
              tmdbId: tmdbSelection.tmdbId,
              mediaType: tmdbSelection.mediaType,
              options: tmdbSelection.options,
            })
          : await createItem(parentId, name, description);

        if (result.success && result.data) {
          const newItem: ItemWithArtwork = {
            ...result.data,
            artworkId: null,
            fileCounts: { media: 0, artwork: 0, subtitles: 0 },
            childCount: 0,
            primaryMediaName: null,
            mediaIconType: null,
            progress: null,
          };
          setItems((prev) => [...prev, newItem]);
          return { itemId: result.data.id };
        }
        return { error: result.error || "Failed to create item" };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to create item";
        return { error: message };
      }
    },
    [parentId, setItems]
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
  // Returns itemId on success for AddItemDialog to handle file uploads
  const handleAddChild = useCallback(
    async (
      parentItemId: string,
      name: string,
      description?: string
    ): Promise<{ itemId?: string; error?: string }> => {
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
            progress: null,
          };
          setItems((prev) => [...prev, newItem]);
          return { itemId: result.data.id };
        }
        return { error: result.error || "Failed to create item" };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to create item";
        return { error: message };
      }
    },
    [setItems]
  );

  // Handle pinning an item to the sidebar
  const handlePinItem = useCallback(
    async (id: string) => {
      const result = await pinItem(id);
      if (result.success) {
        // Update local state to reflect pinned status
        setItems((prev) =>
          prev.map((item) =>
            item.id === id
              ? { ...item, pinnedOrder: Date.now() } // Use timestamp as temporary order
              : item
          )
        );
        toast.success("Pinned to sidebar");
        router.refresh();
      } else {
        toast.error(result.error || "Failed to pin item");
      }
    },
    [setItems, router]
  );

  // Handle unpinning an item from the sidebar
  const handleUnpinItem = useCallback(
    async (id: string) => {
      const result = await unpinItem(id);
      if (result.success) {
        // Update local state to reflect unpinned status
        setItems((prev) =>
          prev.map((item) =>
            item.id === id ? { ...item, pinnedOrder: null } : item
          )
        );
        toast.success("Unpinned from sidebar");
        router.refresh();
      } else {
        toast.error(result.error || "Failed to unpin item");
      }
    },
    [setItems, router]
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

  // Apply sort and filter to items (sort first, then filter)
  const sortedItems = sortItems(items, sortBy);
  const processedItems = filterItems(sortedItems, filterBy);

  // Convert flat items to tree structure for SortableTree (uses processed items)
  const treeItemsProcessed = itemsToTree(processedItems);

  // Filter items for current level (grid view shows only current level)
  const currentLevelItems = processedItems.filter(
    (item) => item.parentId === parentId
  );

  // Bulk selection for edit mode operations
  const bulkSelection = useBulkSelection(currentLevelItems);

  // Clear selection when exiting edit mode
  useEffect(() => {
    if (!isEditing) {
      bulkSelection.deselectAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Only trigger on edit mode change
  }, [isEditing]);

  /**
   * Handles bulk deletion of selected items.
   * Called after user confirms in the dialog.
   */
  const handleBulkDelete = useCallback(async () => {
    const ids = Array.from(bulkSelection.selectedIds);
    if (ids.length === 0) return;

    setIsBulkDeleting(true);
    try {
      const result = await deleteItems(ids);
      if (result.success && result.data) {
        const { deleted, skipped } = result.data;
        setItems((prev) => prev.filter((item) => !ids.includes(item.id)));
        bulkSelection.deselectAll();
        setBulkDeleteDialogOpen(false);
        startTransition(() => refetchItems());

        if (skipped > 0) {
          toast.success(`Deleted ${deleted} items (${skipped} skipped)`);
        } else {
          toast.success(`Deleted ${deleted} items`);
        }
      } else {
        toast.error(result.error || "Failed to delete items");
      }
    } finally {
      setIsBulkDeleting(false);
    }
  }, [bulkSelection, setItems, refetchItems]);

  /**
   * Determines empty state variant based on context.
   * Priority: filter-empty > no-children > first-time
   */
  const getEmptyStateVariant = (): EmptyStateVariant => {
    if (hasActiveFilter) return "filter-empty";
    if (parentId) return "no-children";
    return "first-time";
  };

  /**
   * Handles empty state action based on variant.
   */
  const handleEmptyStateAction = () => {
    const variant = getEmptyStateVariant();
    if (variant === "filter-empty") {
      setFilterBy("all");
    } else {
      setAddItemOpen(true);
    }
  };

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
          backgroundUrl={heroBackgroundUrl}
          progressPercentage={heroProgress?.percentage ?? null}
          progressLabel={
            heroProgress ? formatProgressLabel(heroProgress) : null
          }
          nextItem={nextItem ?? null}
          onGoToNext={goToNext}
          isCollapsed={isCollapsed}
          onCollapse={toggleCollapse}
        />
      )}

      {/* Toolbar - always visible, buttons disabled when not applicable */}
      {!hideToolbar && (
        <div className="flex items-center justify-between gap-2 sm:gap-3">
          {/* Left side: Mobile options sheet OR Desktop sync + dropdowns */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Mobile: Sync button + Options sheet */}
            <div className="flex items-center gap-2 sm:hidden">
              <Button
                variant="outline"
                size="icon"
                onClick={handleSync}
                disabled={!hasDriveConnection || isSyncing}
                aria-label={isSyncing ? "Syncing" : "Sync"}
                className="size-9"
              >
                {isSyncing ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RefreshCw className="size-4" />
                )}
              </Button>
              <MobileOptionsSheet
                sortBy={sortBy}
                onSortChange={setSortBy}
                filterBy={filterBy}
                onFilterChange={setFilterBy}
                disabled={items.length === 0}
              />
            </div>

            {/* Desktop: Sync button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleSync}
              disabled={!hasDriveConnection || isSyncing}
              className="hidden gap-1.5 sm:inline-flex"
            >
              {isSyncing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              <span>{isSyncing ? "Syncing..." : "Sync"}</span>
            </Button>

            {/* Desktop: Sort/Filter dropdowns */}
            <div className="hidden items-center gap-3 sm:flex">
              <SortDropdown
                value={sortBy}
                onChange={setSortBy}
                disabled={items.length === 0}
              />
              <FilterDropdown
                value={filterBy}
                onChange={setFilterBy}
                disabled={items.length === 0}
              />
            </div>
          </div>

          {/* Right side: Add Item + Edit + View toggle */}
          <div className="flex items-center gap-2 sm:gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAddItemOpen(true)}
              className="gap-1.5"
              aria-label="Add"
            >
              <Plus className="size-4" strokeWidth={2} />
              <span className="hidden sm:inline" aria-hidden="true">
                Add
              </span>
            </Button>
            <EditModeToggle
              isEditing={isEditing}
              onToggle={() => setIsEditing((prev) => !prev)}
              disabled={items.length === 0 || !isCustomSort}
              disabledReason={
                items.length === 0
                  ? "No items to edit"
                  : !isCustomSort
                    ? "Set sort to Custom Order to reorder"
                    : undefined
              }
            />
            <ViewToggle disabled={items.length === 0} />
          </div>
        </div>
      )}

      {/* Bulk actions toolbar - shown in edit mode when items exist */}
      {isEditing && currentLevelItems.length > 0 && (
        <BulkActionsToolbar
          selectionCount={bulkSelection.selectionCount}
          isAllSelected={bulkSelection.isAllSelected}
          onSelectAll={bulkSelection.selectAll}
          onDeselectAll={bulkSelection.deselectAll}
          onDelete={() => setBulkDeleteDialogOpen(true)}
          isDeleting={isBulkDeleting}
        />
      )}

      {/* Items display */}
      {currentLevelItems.length === 0 ? (
        <EmptyState
          variant={getEmptyStateVariant()}
          onAction={handleEmptyStateAction}
        />
      ) : viewMode === "grid" ? (
        isEditing ? (
          <SortableGrid
            items={currentLevelItems}
            onItemsChange={handleGridItemsChange}
            onItemClick={handleItemClick}
            onOpenSettings={handleOpenSettings}
            onDeleteItem={handleDeleteItem}
            hasDriveConnection={hasDriveConnection}
            onPinItem={handlePinItem}
            onUnpinItem={handleUnpinItem}
            isItemSelected={bulkSelection.isSelected}
            onItemSelectChange={(id, selected) =>
              selected !== bulkSelection.isSelected(id) &&
              bulkSelection.toggleItem(id)
            }
          />
        ) : (
          <Grid
            items={currentLevelItems}
            onItemClick={handleItemClick}
            onOpenSettings={handleOpenSettings}
            onDeleteItem={handleDeleteItem}
            hasDriveConnection={hasDriveConnection}
            onPinItem={handlePinItem}
            onUnpinItem={handleUnpinItem}
            currentUser={currentUser}
          />
        )
      ) : isEditing ? (
        <SortableTree
          items={treeItemsProcessed}
          onItemsChange={handleTreeItemsChange}
          onItemClick={handleItemClick}
          onOpenSettings={handleOpenSettings}
          onDeleteItem={handleDeleteItem}
          onAddChild={handleAddChild}
          onAddChildComplete={refetchItems}
          hasDriveConnection={hasDriveConnection}
          onPinItem={handlePinItem}
          onUnpinItem={handleUnpinItem}
          isItemSelected={bulkSelection.isSelected}
          onItemSelectChange={(id, selected) =>
            selected !== bulkSelection.isSelected(id) &&
            bulkSelection.toggleItem(id)
          }
        />
      ) : (
        <Tree
          items={treeItemsProcessed}
          onItemClick={handleItemClick}
          onOpenSettings={handleOpenSettings}
          onDeleteItem={handleDeleteItem}
          onAddChild={handleAddChild}
          onAddChildComplete={refetchItems}
          hasDriveConnection={hasDriveConnection}
          onPinItem={handlePinItem}
          onUnpinItem={handleUnpinItem}
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

            // Refetch item data from local state to get updated values
            const updatedItem = itemsRef.current.find(
              (i) => i.id === settingsDialog.item.id
            );
            if (updatedItem) {
              setSettingsDialog({
                item: {
                  id: updatedItem.id,
                  name: updatedItem.name,
                  description: updatedItem.description,
                  isPublic: updatedItem.isPublic,
                  inheritVisibility: updatedItem.inheritVisibility,
                  hasParent: updatedItem.parentId !== null,
                  hasChildren: updatedItem.childCount > 0,
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
        onComplete={refetchItems}
        hasDriveConnection={hasDriveConnection}
      />

      {/* Bulk Delete Confirmation Dialog */}
      <Dialog
        open={bulkDeleteDialogOpen}
        onOpenChange={setBulkDeleteDialogOpen}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Items</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {bulkSelection.selectionCount}{" "}
              {bulkSelection.selectionCount === 1 ? "item" : "items"}? This will
              also delete all child items. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBulkDeleteDialogOpen(false)}
              disabled={isBulkDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleBulkDelete}
              disabled={isBulkDeleting}
            >
              {isBulkDeleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
