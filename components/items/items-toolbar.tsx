/**
 * Unified toolbar for items views.
 * Handles content actions and view controls.
 * Used on both root /my-items and item detail pages for consistent UX.
 * Responsive: collapses secondary options into sheet on mobile.
 */

"use client";

import { Loader2, Plus, RefreshCw, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EditModeToggle } from "./edit-mode-toggle";
import { ViewToggle } from "./view-toggle";
import { SortDropdown } from "./sort-dropdown";
import { FilterDropdown } from "./filter-dropdown";
import { MobileOptionsSheet } from "./mobile-options-sheet";
import { ItemSettingsDialog } from "./item-settings-dialog";
import type { SerializedItemFile, SortOption, FilterOption } from "@/lib/types";
import { useState, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { getItemFiles } from "@/lib/item-file-actions";
import { syncFromGoogleDrive } from "@/lib/google-drive-sync";
import { toast } from "sonner";

/** Empty files state for initial dialog load */
const emptyFiles = {
  media: [] as SerializedItemFile[],
  artwork: [] as SerializedItemFile[],
  subtitles: [] as SerializedItemFile[],
};

interface ItemsToolbarProps {
  /** Whether there are items to show (hides some controls when empty). */
  hasItems: boolean;
  /** Whether edit mode is active (only needed when hasItems=true). */
  isEditing?: boolean;
  /** Callback to toggle edit mode (only needed when hasItems=true). */
  onEditToggle?: () => void;
  /** Callback to open add item dialog (only needed when hasItems=true). */
  onAddItem?: () => void;

  // --- Sort/Filter props ---
  /** Current sort option. */
  sortBy?: SortOption;
  /** Callback when sort option changes. */
  onSortChange?: (sort: SortOption) => void;
  /** Current filter option. */
  filterBy?: FilterOption;
  /** Callback when filter option changes. */
  onFilterChange?: (filter: FilterOption) => void;

  // --- Sync props ---
  /** Callback after any sync completes. */
  onSyncComplete?: () => void;

  // --- Item detail page props ---
  /** Current item for Settings button (item detail pages only). */
  item?: {
    id: string;
    name: string;
    description: string | null;
  };
  /** Whether user has Google Drive connected (enables uploads in settings). */
  hasDriveConnection?: boolean;
}

/**
 * Unified toolbar component for items views.
 * Responsive layout adapts to mobile with collapsed options.
 *
 * Desktop Layout:
 * - Left: Sync, Sort, Filter
 * - Right: Add Item, Edit, View toggle, Settings (detail page only)
 *
 * Mobile Layout:
 * - Left: Options sheet (Sync + Sort + Filter)
 * - Right: Add Item, Edit, View toggle, Settings
 */
export function ItemsToolbar({
  hasItems,
  isEditing = false,
  onEditToggle,
  onAddItem,
  sortBy,
  onSortChange,
  filterBy,
  onFilterChange,
  onSyncComplete,
  item,
  hasDriveConnection = false,
}: ItemsToolbarProps) {
  // Sort/filter are provided
  const hasSortFilter = sortBy !== undefined && onSortChange !== undefined;
  // Disable edit mode when not using custom sort (can't reorder non-custom sort)
  const isCustomSort = sortBy === "custom" || sortBy === undefined;
  const router = useRouter();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [files, setFiles] = useState(emptyFiles);
  const [isSyncing, startSyncTransition] = useTransition();

  // Item detail page context
  const isItemDetailPage = Boolean(item);

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
        router.refresh();
        onSyncComplete?.();
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
  }, [router, onSyncComplete]);

  /**
   * Opens settings dialog and fetches files.
   */
  const handleOpenSettings = useCallback(async () => {
    if (!item) return;
    setSettingsOpen(true);
    const result = await getItemFiles(item.id);
    if (result.success && result.data) {
      setFiles(result.data);
    }
  }, [item]);

  /**
   * Refreshes files after settings change and refreshes page.
   */
  const handleSettingsChange = useCallback(async () => {
    if (!item) return;
    const result = await getItemFiles(item.id);
    if (result.success && result.data) {
      setFiles(result.data);
    }
    router.refresh();
  }, [item, router]);

  return (
    <>
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
            {hasSortFilter && filterBy !== undefined && onFilterChange && (
              <MobileOptionsSheet
                sortBy={sortBy}
                onSortChange={onSortChange}
                filterBy={filterBy}
                onFilterChange={onFilterChange}
                disabled={!hasItems}
              />
            )}
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
          {hasSortFilter && (
            <div className="hidden items-center gap-3 sm:flex">
              <SortDropdown
                value={sortBy}
                onChange={onSortChange}
                disabled={!hasItems}
              />
              {filterBy !== undefined && onFilterChange && (
                <FilterDropdown
                  value={filterBy}
                  onChange={onFilterChange}
                  disabled={!hasItems}
                />
              )}
            </div>
          )}
        </div>

        {/* Right side: Primary actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Add Item - always show text, it's the primary action */}
          <Button
            variant="outline"
            size="sm"
            onClick={onAddItem}
            disabled={!hasItems && !isItemDetailPage}
            className="gap-1.5"
            aria-label="Add"
          >
            <Plus className="size-4" strokeWidth={2} />
            <span className="hidden sm:inline" aria-hidden="true">
              Add
            </span>
          </Button>

          {/* Edit/Done toggle */}
          <EditModeToggle
            isEditing={isEditing}
            onToggle={onEditToggle ?? (() => {})}
            disabled={!hasItems || !isCustomSort}
            disabledReason={
              !hasItems
                ? "No items to edit"
                : !isCustomSort
                  ? "Set sort to Custom Order to reorder"
                  : undefined
            }
          />

          {/* View toggle - icons only on mobile via component */}
          <ViewToggle disabled={!hasItems} />

          {/* Settings button - item detail page only */}
          {isItemDetailPage && item && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenSettings}
              aria-label="Item Settings"
              className="gap-1.5"
            >
              <Settings2 className="size-4" />
              <span className="hidden sm:inline">Settings</span>
            </Button>
          )}
        </div>
      </div>

      {/* Item Settings Dialog - item detail page only */}
      {isItemDetailPage && item && (
        <ItemSettingsDialog
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          item={item}
          files={files}
          hasDriveConnection={hasDriveConnection}
          onSettingsChange={handleSettingsChange}
        />
      )}
    </>
  );
}
