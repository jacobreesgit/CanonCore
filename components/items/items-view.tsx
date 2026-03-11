/**
 * Client-side items view with tree/grid toggle and drag-drop support.
 * Handles all item CRUD operations and reordering.
 */

"use client";

import {
  useState,
  useTransition,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useControllableState } from "@/hooks/use-controllable-state";
import { useSettingsDialog } from "@/hooks/use-settings-dialog";
import { UniqueIdentifier } from "@dnd-kit/core";
import { toast } from "sonner";

import { Section } from "@/components/ui/section";
import { Skeleton } from "@/components/ui/skeleton";
import { GridViewContent } from "./grid-view-content";

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

// Dynamic import for edit mode (~15KB dnd-kit loaded on demand)
const SortableTree = dynamic(
  () => import("@/components/sortable-tree").then((mod) => mod.SortableTree),
  { loading: () => <TreeSkeleton />, ssr: false }
);

// Dynamic imports for heavy dialogs (loaded on demand when user opens them)
const AddItemDialog = dynamic(
  () =>
    import("./add-item-dialog").then((mod) => ({ default: mod.AddItemDialog })),
  {
    ssr: false,
  }
);

const MobileAddItemSheet = dynamic(() => import("./mobile-add-item-sheet"), {
  ssr: false,
});

const ItemSettingsDialog = dynamic(
  () =>
    import("./item-settings-dialog").then((mod) => ({
      default: mod.ItemSettingsDialog,
    })),
  {
    ssr: false,
  }
);

import { useItemsUrlState } from "@/hooks/use-items-url-state";
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
  ItemVisibilityOptions,
  ItemWithArtwork,
  TreeItems,
  TMDBMetadataSelection,
  SortOption,
  ContentFilter,
} from "@/lib/types";
import {
  itemsToTree,
  treeToItemUpdates,
  sortItems,
  filterItems,
  filterItemsBySearch,
} from "@/lib/item-utils";
import {
  createItem,
  createItemWithMetadata,
  deleteItem,
  deleteItems,
  reorderItems,
  moveItem,
  getItems,
  pinItem,
  unpinItem,
} from "@/lib/item-actions";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

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
  /** External sort control - when provided, overrides internal state. */
  sortBy?: SortOption;
  /** Callback when sort changes (for external control). */
  onSortChange?: (sort: SortOption) => void;
  /** External filter control - active content filters. */
  filters?: ContentFilter[];
  /** Clear all active filters (for empty state action). */
  clearFilters?: () => void;
  /** Callback when items change (for parent state sync). */
  onItemsChange?: (items: ItemWithArtwork[]) => void;
  /** Whether user has Google Drive connected (shows Upload button in settings). */
  hasDriveConnection?: boolean;
  /** Current user info for owner display in grid items. */
  currentUser?: CurrentUser | null;
  /** Disable tree view option (forces grid view, hides view toggle). */
  disableTreeView?: boolean;
  /** Server-rendered shelves inserted between pinned and library sections. */
  shelves?: React.ReactNode;
  /** Client-side text search query (filters items by name/description). */
  searchQuery?: string;
  /** Callback to clear the search query (for empty state action). */
  onSearchClear?: () => void;
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
 * @param hasDriveConnection - Whether Google Drive is connected
 */
export function ItemsView({
  items: initialItems,
  parentId = null,
  hideToolbar: _hideToolbar = false,
  isEditing: externalIsEditing,
  onEditingChange,
  addItemOpen: externalAddItemOpen,
  onAddItemOpenChange,
  sortBy: externalSortBy,
  onSortChange: _onSortChange,
  filters: externalFilters,
  clearFilters: externalClearFilters,
  onItemsChange,
  hasDriveConnection = false,
  currentUser,
  disableTreeView = false,
  shelves,
  searchQuery,
  onSearchClear,
}: ItemsViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [items, setItemsState] = useState<ItemWithArtwork[]>(initialItems);
  // Ref to always access latest items (avoids stale closure in callbacks)
  const itemsRef = useRef(items);

  /**
   * Wrapper around setItems that also updates the ref synchronously
   * and notifies parent of changes.
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
        // Notify parent of item changes (async to avoid setState during render)
        if (onItemsChange) {
          queueMicrotask(() => onItemsChange(next));
        }
        return next;
      });
    },
    [onItemsChange]
  );
  // URL-backed sort/filter/view state (used as fallback when no external control)
  const {
    sortBy: internalSortBy,
    filters: internalFilters,
    clearFilters: internalClearFilters,
    viewMode: internalViewMode,
  } = useItemsUrlState();

  // Support external or internal control for sort/filter
  const sortBy = externalSortBy ?? internalSortBy;
  const filters = externalFilters ?? internalFilters;
  const clearFilters = externalClearFilters ?? internalClearFilters;
  const hasActiveFilter = filters.length > 0;

  // Force grid view when tree is disabled
  const viewMode = disableTreeView ? "grid" : internalViewMode;

  // Edit mode state - supports external control or internal state via useControllableState
  const [isEditing, setIsEditing] = useControllableState({
    value: externalIsEditing,
    defaultValue: false,
    onChange: onEditingChange,
  });
  // Add item dialog state - supports external control or internal state via useControllableState
  const [addItemOpen, setAddItemOpen] = useControllableState({
    value: externalAddItemOpen,
    defaultValue: false,
    onChange: onAddItemOpenChange,
  });
  // Viewport detection for portal-based components (dialogs render to <body>,
  // bypassing CSS hidden wrappers — must use JS to prevent dual portals)
  const isMobile = useIsMobile();

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

  // Settings dialog (extracted hook manages state, open, close, refresh)
  const {
    settingsDialog,
    openSettings: handleOpenSettings,
    closeSettings,
    refreshSettings,
  } = useSettingsDialog({ itemsRef, refetchItems });

  // Handle item click - navigate to item detail
  const handleItemClick = useCallback(
    (id: UniqueIdentifier) => {
      if (currentUser?.username) {
        router.push(`/u/${currentUser.username}/${id}`);
      }
    },
    [router, currentUser?.username]
  );

  // Prefetch on hover for faster navigation (primitive dependency)
  const username = currentUser?.username;
  const handleItemMouseEnter = useCallback(
    (itemId: string) => {
      if (username) {
        router.prefetch(`/u/${username}/${itemId}`);
      }
    },
    [router, username]
  );

  // Handle creating new item at root level
  // Returns itemId on success for AddItemDialog to handle file uploads
  const handleCreateItem = useCallback(
    async (
      name: string,
      description?: string,
      tmdbSelection?: TMDBMetadataSelection,
      visibilityOptions?: ItemVisibilityOptions
    ): Promise<{ itemId?: string; error?: string }> => {
      try {
        // Use createItemWithMetadata if TMDB selection provided, otherwise basic createItem
        const result = tmdbSelection
          ? await createItemWithMetadata(parentId, name, description, {
              tmdbId: tmdbSelection.tmdbId,
              mediaType: tmdbSelection.mediaType,
              options: tmdbSelection.options,
              displayOptions: tmdbSelection.displayOptions,
            })
          : await createItem(parentId, name, description, visibilityOptions);

        if (result.success && result.data) {
          const newItem: ItemWithArtwork = {
            ...result.data,
            artworkId: null,
            fileCounts: { media: 0, artwork: 0, subtitles: 0 },
            childCount: 0,
            primaryMediaName: null,
            mediaIconType: null,
            progress: null,
            primaryDurationMs: null,
            primaryHeight: null,
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
        toast.success("Item deleted");
      } else {
        toast.error(result.error || "Failed to delete");
      }
    },
    [refetchItems, setItems]
  );

  // Handle moving an item to a different parent
  const handleMoveItem = useCallback(
    async (itemId: string, newParentId: string | null) => {
      const result = await moveItem(itemId, newParentId);
      if (result.success) {
        setItems((prev) => prev.filter((i) => i.id !== itemId));
        startTransition(() => refetchItems());
      }
      return result;
    },
    [refetchItems, setItems]
  );

  // Handle adding child item
  // Returns itemId on success for AddItemDialog to handle file uploads
  const handleAddChild = useCallback(
    async (
      parentItemId: string,
      name: string,
      description?: string,
      visibilityOptions?: ItemVisibilityOptions
    ): Promise<{ itemId?: string; error?: string }> => {
      try {
        const result = await createItem(
          parentItemId,
          name,
          description,
          visibilityOptions
        );
        if (result.success && result.data) {
          const newItem: ItemWithArtwork = {
            ...result.data,
            artworkId: null,
            fileCounts: { media: 0, artwork: 0, subtitles: 0 },
            childCount: 0,
            primaryMediaName: null,
            mediaIconType: null,
            progress: null,
            primaryDurationMs: null,
            primaryHeight: null,
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
      // Use itemsRef.current to avoid stale closure and keep this callback stable.
      const currentItems = itemsRef.current;
      const directChildren = parentId
        ? currentItems.filter((i) => i.parentId === parentId)
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
    [setItems, parentId]
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
  // Memoized to avoid recalculating on every render (rerender-memo, rerender-derived-state)
  const sortedItems = useMemo(() => sortItems(items, sortBy), [items, sortBy]);
  const processedItems = useMemo(
    () => filterItems(sortedItems, filters),
    [sortedItems, filters]
  );

  // Apply client-side text search filter (after sort + content filter)
  const searchFilteredItems = useMemo(
    () => filterItemsBySearch(processedItems, searchQuery ?? ""),
    [processedItems, searchQuery]
  );

  // Convert flat items to tree structure for SortableTree (uses processed items)
  // Memoized to avoid rebuilding tree on every render
  const treeItemsProcessed = useMemo(
    () => itemsToTree(searchFilteredItems),
    [searchFilteredItems]
  );

  // Filter items for current level (grid view shows only current level)
  // Memoized to avoid refiltering on every render
  const currentLevelItems = useMemo(
    () => searchFilteredItems.filter((item) => item.parentId === parentId),
    [searchFilteredItems, parentId]
  );

  // Split current level items into pinned and unpinned (for grid view sections)
  // Pinned items shown first with section title, then "All Items" for the rest
  const pinnedGridItems = useMemo(
    () =>
      currentLevelItems
        .filter((item) => item.pinnedOrder !== null)
        .sort((a, b) => (a.pinnedOrder ?? 0) - (b.pinnedOrder ?? 0)),
    [currentLevelItems]
  );

  const unpinnedGridItems = useMemo(
    () => currentLevelItems.filter((item) => item.pinnedOrder === null),
    [currentLevelItems]
  );

  // Bulk selection for edit mode operations
  // In tree view, include all items for cascading selection; in grid view, only current level
  const selectionItems =
    viewMode === "tree" ? searchFilteredItems : currentLevelItems;
  const bulkSelection = useBulkSelection(selectionItems);

  // Clear selection when exiting edit mode
  useEffect(() => {
    if (!isEditing) {
      bulkSelection.deselectAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Only trigger on edit mode change
  }, [isEditing]);

  /**
   * Gets all descendant IDs for a given item (recursive).
   * Used for cascading selection in tree view.
   */
  const getDescendantIds = useCallback(
    (itemId: string): string[] => {
      const descendants: string[] = [];
      const children = searchFilteredItems.filter((i) => i.parentId === itemId);
      for (const child of children) {
        descendants.push(child.id);
        descendants.push(...getDescendantIds(child.id));
      }
      return descendants;
    },
    [searchFilteredItems]
  );

  /**
   * Handles item selection with cascading to descendants in tree view.
   * When selecting a parent, all children are also selected.
   * When deselecting a parent, all children are also deselected.
   */
  const handleItemSelectionChange = useCallback(
    (id: string, selected: boolean) => {
      if (selected !== bulkSelection.isSelected(id)) {
        // Toggle the item itself
        bulkSelection.toggleItem(id);

        // In tree view, also toggle all descendants
        if (viewMode === "tree") {
          const descendantIds = getDescendantIds(id);
          for (const descendantId of descendantIds) {
            // Only toggle if the current state doesn't match desired state
            if (selected !== bulkSelection.isSelected(descendantId)) {
              bulkSelection.toggleItem(descendantId);
            }
          }
        }
      }
    },
    [bulkSelection, viewMode, getDescendantIds]
  );

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
   * Empty state variant based on context (memoized).
   * Priority: filter-empty > no-children > first-time
   */
  const emptyStateVariant: EmptyStateVariant = useMemo(() => {
    if (searchQuery) return "search-empty";
    if (hasActiveFilter) return "filter-empty";
    if (parentId) return "no-children";
    return "first-time";
  }, [searchQuery, hasActiveFilter, parentId]);

  /**
   * Handles empty state action based on variant (memoized callback).
   */
  const handleEmptyStateAction = useCallback(() => {
    if (emptyStateVariant === "search-empty" && onSearchClear) {
      onSearchClear();
    } else if (emptyStateVariant === "filter-empty") {
      clearFilters();
    } else {
      setAddItemOpen(true);
    }
  }, [emptyStateVariant, onSearchClear, clearFilters, setAddItemOpen]);

  return (
    <div
      className={cn(
        "flex flex-col",
        items.length === 0 && "flex-1",
        isPending && "opacity-70"
      )}
    >
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

      {/* Items display — grid/tree toggled via CSS display, SortableTree always mounted with disabled DnD in view mode */}
      {currentLevelItems.length === 0 ? (
        <Section
          className="flex flex-1 flex-col pt-6"
          data-testid="items-empty-state"
        >
          <EmptyState
            variant={emptyStateVariant}
            searchQuery={searchQuery}
            onAction={handleEmptyStateAction}
          />
        </Section>
      ) : (
        <>
          <div style={{ display: viewMode === "grid" ? "contents" : "none" }}>
            <GridViewContent
              isEditing={isEditing}
              currentLevelItems={currentLevelItems}
              pinnedItems={pinnedGridItems}
              unpinnedItems={unpinnedGridItems}
              onItemsChange={handleGridItemsChange}
              onItemClick={handleItemClick}
              onOpenSettings={handleOpenSettings}
              onDeleteItem={handleDeleteItem}
              onMoveItem={handleMoveItem}
              onAddChild={handleAddChild}
              onAddChildComplete={refetchItems}
              onPinItem={handlePinItem}
              onUnpinItem={handleUnpinItem}
              hasDriveConnection={hasDriveConnection}
              isItemSelected={bulkSelection.isSelected}
              onItemSelectChange={handleItemSelectionChange}
              currentUser={currentUser}
              shelves={shelves}
              onItemMouseEnter={handleItemMouseEnter}
            />
          </div>
          <div style={{ display: viewMode === "tree" ? "contents" : "none" }}>
            <Section className="py-8" aria-label="Contents">
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
                onItemSelectChange={handleItemSelectionChange}
                isEditing={isEditing}
              />
            </Section>
          </div>
        </>
      )}

      {/* Item Settings Dialog */}
      {settingsDialog && (
        <ItemSettingsDialog
          open={!!settingsDialog}
          onOpenChange={(open) => !open && closeSettings()}
          item={settingsDialog.item}
          files={settingsDialog.files}
          hasDriveConnection={hasDriveConnection}
          onSettingsChange={refreshSettings}
        />
      )}

      {/* Add Item — only one gets open={true} to prevent dual portals
          (CSS hidden wrappers don't prevent portal-based dialogs rendering to <body>) */}
      <AddItemDialog
        open={addItemOpen && !isMobile}
        onOpenChange={setAddItemOpen}
        onAdd={handleCreateItem}
        onComplete={refetchItems}
        hasDriveConnection={hasDriveConnection}
      />
      <MobileAddItemSheet
        open={addItemOpen && isMobile}
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
              {isBulkDeleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
