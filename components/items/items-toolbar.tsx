/**
 * Unified toolbar for items views.
 * Handles connection filter, sync buttons, content actions, and view controls.
 * Used on both root /my-items and item detail pages for consistent UX.
 */

"use client";

import { Loader2, Plus, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConnectionFilter } from "./connection-filter";
import { EditModeToggle } from "./edit-mode-toggle";
import { ViewToggle } from "./view-toggle";
import { ItemSettingsDialog } from "./item-settings-dialog";
import { SyncButton, SyncAllButton, ItemSyncButton } from "@/components/sftp";
import type { SerializedItemFile } from "@/lib/types";
import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getItemFiles } from "@/lib/item-file-actions";

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

  // --- Connection filter props (root page) ---
  /** Available SFTP connections for filter dropdown. */
  connections?: Array<{ id: string; name: string }>;
  /** Currently selected connection ID. */
  selectedConnectionId?: string | null;
  /** Callback when connection filter changes. */
  onConnectionChange?: (connectionId: string | null) => void;
  /** Whether connection filter change is pending. */
  isFilterPending?: boolean;

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
  /** Number of child items for settings dialog stats. */
  childCount?: number;
  /** Whether item is SFTP connected (shows Sync button). */
  isSftpConnected?: boolean;
}

/**
 * Unified toolbar component for items views.
 *
 * Layout:
 * - Left: Connection filter + Sync button(s)
 * - Right: Add Item, Edit, View toggle, Settings (detail page only)
 */
export function ItemsToolbar({
  hasItems,
  isEditing = false,
  onEditToggle,
  onAddItem,
  connections = [],
  selectedConnectionId,
  onConnectionChange,
  isFilterPending = false,
  onSyncComplete,
  item,
  childCount = 0,
  isSftpConnected = false,
}: ItemsToolbarProps) {
  const router = useRouter();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [files, setFiles] = useState(emptyFiles);

  // Derive sync button context
  const hasConnectionFilter = connections.length > 0 && onConnectionChange;
  const effectiveSelectedConnection =
    connections.length === 1
      ? connections[0].id
      : (selectedConnectionId ?? null);
  const isFilteredToConnection = effectiveSelectedConnection !== null;

  // Item detail page context
  const isItemDetailPage = Boolean(item);

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

  /**
   * Refreshes page after sync completes.
   */
  const handleSyncComplete = useCallback(async () => {
    router.refresh();
    onSyncComplete?.();
  }, [router, onSyncComplete]);

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        {/* Left side: Connection filter + Sync buttons */}
        <div className="flex items-center gap-3">
          {/* Connection filter - root page only */}
          {hasConnectionFilter && (
            <>
              <ConnectionFilter
                connections={connections}
                selectedConnectionId={selectedConnectionId ?? null}
                onConnectionChange={onConnectionChange}
              />
              {isFilterPending && (
                <Loader2 className="text-muted-foreground size-4 animate-spin" />
              )}
            </>
          )}

          {/* Sync All button - root page, viewing All Items */}
          {hasConnectionFilter && !isFilteredToConnection && (
            <SyncAllButton
              connectionCount={connections.length}
              size="sm"
              onSyncComplete={handleSyncComplete}
            />
          )}

          {/* Sync Connection button - root page, filtered to connection */}
          {hasConnectionFilter &&
            isFilteredToConnection &&
            effectiveSelectedConnection && (
              <SyncButton
                connectionId={effectiveSelectedConnection}
                label="Sync Connection"
                size="sm"
                onSyncComplete={handleSyncComplete}
              />
            )}

          {/* Item Sync button - item detail page */}
          {isItemDetailPage && isSftpConnected && item && (
            <ItemSyncButton
              itemId={item.id}
              itemName={item.name}
              size="sm"
              onSyncComplete={handleSyncComplete}
            />
          )}
        </div>

        {/* Right side: Add Item + Edit + View toggle + Settings */}
        <div className="flex items-center gap-3">
          {hasItems && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={onAddItem}
                className="gap-1.5"
              >
                <Plus className="size-4" strokeWidth={2} />
                <span>Add Item</span>
              </Button>
              <EditModeToggle
                isEditing={isEditing}
                onToggle={onEditToggle ?? (() => {})}
              />
              <ViewToggle />
            </>
          )}

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
          childCount={childCount}
          onSettingsChange={handleSettingsChange}
        />
      )}
    </>
  );
}
