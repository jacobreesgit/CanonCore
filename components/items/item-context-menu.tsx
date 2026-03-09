/**
 * Context menu for item actions (settings, delete, add child).
 * Glassmorphism styling with AlertDialog confirmation.
 * Exports reusable ItemMenuActions and renderMenuItems for use in both
 * ContextMenu and DropdownMenu contexts.
 */

"use client";

import { ComponentType, ReactNode, useState } from "react";
import dynamic from "next/dynamic";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AddItemDialog, type CreateItemResult } from "./add-item-dialog";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPlus,
  faGear,
  faTrashCan,
  faArrowUpRightFromSquare,
  faThumbtack,
  faThumbtackSlash,
  faSpinner,
  faEye,
  faEyeSlash,
  faCheckDouble,
  faForwardStep,
  faListOl,
} from "@fortawesome/free-solid-svg-icons";
import { toast } from "sonner";
import type { ItemVisibilityOptions } from "@/lib/types";
import type { QueueTrack } from "@/lib/store/types";
import { cn } from "@/lib/utils";
import { MENU_ITEM_CLASSES } from "./menu-styles";

export { MENU_ITEM_CLASSES };

const AddToPlaylistDialog = dynamic(
  () =>
    import("@/components/playlists/add-to-playlist-dialog").then((mod) => ({
      default: mod.AddToPlaylistDialog,
    })),
  { ssr: false }
);

/** Shared action props for item menus (context menu and dropdown menu). */
export interface ItemMenuActions {
  itemName: string;
  /** Google Drive folder ID for this item (if synced) */
  driveFileId?: string | null;
  showAddChild?: boolean;
  /** Whether user has Google Drive connected (for file uploads in Add Child dialog) */
  hasDriveConnection?: boolean;
  /** Whether this item is currently pinned to the sidebar */
  isPinned?: boolean;
  /** Opens the unified settings dialog */
  onSettings?(): void;
  onDelete?(): Promise<void>;
  onAddChild?(
    name: string,
    description?: string,
    visibilityOptions?: ItemVisibilityOptions
  ): Promise<CreateItemResult>;
  /** Callback to refresh data after child item is created (for AddItemDialog) */
  onAddChildComplete?(): Promise<void>;
  /** Callback to pin the item to the sidebar */
  onPin?(): Promise<void>;
  /** Callback to unpin the item from the sidebar */
  onUnpin?(): Promise<void>;
  /** Whether this leaf item is watched (controls watched/unwatched toggle) */
  isWatched?: boolean;
  /** Callback to mark the item as watched (leaf items) */
  onMarkWatched?(): Promise<void>;
  /** Callback to mark the item as unwatched (leaf items) */
  onMarkUnwatched?(): Promise<void>;
  /** Whether all descendants are watched (controls all-watched/all-unwatched toggle) */
  isAllWatched?: boolean;
  /** Callback to mark all descendants as watched (parent items) */
  onMarkAllWatched?(): Promise<void>;
  /** Callback to mark all descendants as unwatched (parent items) */
  onMarkAllUnwatched?(): Promise<void>;
  /** Whether to show the "Add to Playlist" option. */
  showAddToPlaylist?: boolean;
  /** Item ID — needed for Add to Playlist dialog. */
  itemId?: string;
  /** Whether this item has media files (enables queue actions). */
  hasMedia?: boolean;
  /** Callback to fetch files and return QueueTracks. */
  onGetTracks?: () => Promise<QueueTrack[] | null>;
  /** Callback dispatched when user clicks "Play Next". */
  onPlayNext?: (track: QueueTrack) => void;
  /** Callback dispatched when user clicks "Add to Queue". */
  onAddToQueue?: (track: QueueTrack) => void;
}

/** Destructive (delete) menu item styling. */
const DELETE_ITEM_CLASSES = cn(
  "gap-2 rounded-lg px-3 py-2",
  "text-sm",
  "text-red-400",
  "hover:bg-red-500/10 hover:text-red-300",
  "focus:bg-red-500/10 focus:text-red-300",
  "cursor-pointer"
);

/**
 * Renders menu items for item actions.
 * Works with both ContextMenuItem and DropdownMenuItem.
 *
 * @param actions - Item action callbacks
 * @param MenuItem - The menu item component (ContextMenuItem or DropdownMenuItem)
 * @param MenuSeparator - The separator component (ContextMenuSeparator or DropdownMenuSeparator)
 * @param onDeleteClick - Callback to open delete confirmation
 * @param onAddChildClick - Callback to open add child dialog
 */
export function renderMenuItems({
  actions,
  MenuItem,
  MenuSeparator,
  onDeleteClick,
  onAddChildClick,
  onPlaylistClick,
}: {
  actions: ItemMenuActions;
  MenuItem: ComponentType<{
    onClick?: () => void;
    className?: string;
    children: ReactNode;
    asChild?: boolean;
    "data-testid"?: string;
  }>;
  MenuSeparator: ComponentType<{ className?: string }>;
  onDeleteClick: () => void;
  onAddChildClick: () => void;
  onPlaylistClick?: () => void;
}) {
  const {
    showAddChild = true,
    showAddToPlaylist = false,
    driveFileId,
    isPinned = false,
    isWatched = false,
    isAllWatched = false,
    hasMedia = false,
    onSettings,
    onDelete,
    onAddChild,
    onPin,
    onUnpin,
    onMarkWatched,
    onMarkUnwatched,
    onMarkAllWatched,
    onMarkAllUnwatched,
    onGetTracks,
    onPlayNext,
    onAddToQueue,
  } = actions;

  return (
    <>
      {showAddChild && onAddChild && (
        <MenuItem
          onClick={onAddChildClick}
          className={MENU_ITEM_CLASSES}
          data-testid="menu-add-child"
        >
          <FontAwesomeIcon
            icon={faPlus}
            aria-hidden="true"
            className="size-4"
          />
          <span>Add Child Item</span>
        </MenuItem>
      )}
      {onSettings && (
        <MenuItem
          onClick={onSettings}
          className={MENU_ITEM_CLASSES}
          data-testid="menu-edit-item"
        >
          <FontAwesomeIcon
            icon={faGear}
            aria-hidden="true"
            className="size-4"
          />
          <span>Edit Item</span>
        </MenuItem>
      )}
      {showAddToPlaylist && onPlaylistClick && (
        <MenuItem
          onClick={onPlaylistClick}
          className={MENU_ITEM_CLASSES}
          data-testid="menu-add-to-playlist"
        >
          <FontAwesomeIcon
            icon={faPlus}
            aria-hidden="true"
            className="size-4"
          />
          <span>Add to Playlist</span>
        </MenuItem>
      )}
      {hasMedia && onGetTracks && (
        <>
          <MenuSeparator className="bg-white/[0.08]" />
          <MenuItem
            onClick={async () => {
              try {
                const tracks = await onGetTracks();
                if (tracks?.[0]) onPlayNext?.(tracks[0]);
              } catch {
                toast.error("Couldn't load track");
              }
            }}
            className={MENU_ITEM_CLASSES}
            data-testid="menu-play-next"
          >
            <FontAwesomeIcon
              icon={faForwardStep}
              aria-hidden="true"
              className="size-4"
            />
            <span>Play Next</span>
          </MenuItem>
          <MenuItem
            onClick={async () => {
              try {
                const tracks = await onGetTracks();
                tracks?.forEach((t) => onAddToQueue?.(t));
              } catch {
                toast.error("Couldn't load tracks");
              }
            }}
            className={MENU_ITEM_CLASSES}
            data-testid="menu-add-to-queue"
          >
            <FontAwesomeIcon
              icon={faListOl}
              aria-hidden="true"
              className="size-4"
            />
            <span>Add to Queue</span>
          </MenuItem>
        </>
      )}
      {isPinned && onUnpin && (
        <MenuItem
          onClick={onUnpin}
          className={MENU_ITEM_CLASSES}
          data-testid="menu-unpin"
        >
          <FontAwesomeIcon
            icon={faThumbtackSlash}
            aria-hidden="true"
            className="size-4"
          />
          <span>Unpin from Sidebar</span>
        </MenuItem>
      )}
      {!isPinned && onPin && (
        <MenuItem
          onClick={onPin}
          className={MENU_ITEM_CLASSES}
          data-testid="menu-pin"
        >
          <FontAwesomeIcon
            icon={faThumbtack}
            aria-hidden="true"
            className="size-4"
          />
          <span>Pin to Sidebar</span>
        </MenuItem>
      )}
      {/* Leaf items: toggle watched/unwatched */}
      {isWatched && onMarkUnwatched && (
        <MenuItem
          onClick={onMarkUnwatched}
          className={MENU_ITEM_CLASSES}
          data-testid="menu-mark-unwatched"
        >
          <FontAwesomeIcon
            icon={faEyeSlash}
            aria-hidden="true"
            className="size-4"
          />
          <span>Mark as Unwatched</span>
        </MenuItem>
      )}
      {!isWatched && onMarkWatched && (
        <MenuItem
          onClick={onMarkWatched}
          className={MENU_ITEM_CLASSES}
          data-testid="menu-mark-watched"
        >
          <FontAwesomeIcon icon={faEye} aria-hidden="true" className="size-4" />
          <span>Mark as Watched</span>
        </MenuItem>
      )}
      {/* Parent items: toggle all watched/unwatched */}
      {isAllWatched && onMarkAllUnwatched && (
        <MenuItem
          onClick={onMarkAllUnwatched}
          className={MENU_ITEM_CLASSES}
          data-testid="menu-mark-all-unwatched"
        >
          <FontAwesomeIcon
            icon={faEyeSlash}
            aria-hidden="true"
            className="size-4"
          />
          <span>Mark All as Unwatched</span>
        </MenuItem>
      )}
      {!isAllWatched && onMarkAllWatched && (
        <MenuItem
          onClick={onMarkAllWatched}
          className={MENU_ITEM_CLASSES}
          data-testid="menu-mark-all-watched"
        >
          <FontAwesomeIcon
            icon={faCheckDouble}
            aria-hidden="true"
            className="size-4"
          />
          <span>Mark All as Watched</span>
        </MenuItem>
      )}
      {driveFileId && (
        <MenuItem asChild className={MENU_ITEM_CLASSES}>
          <a
            href={`https://drive.google.com/drive/folders/${driveFileId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2"
            data-testid="menu-open-in-drive"
          >
            <FontAwesomeIcon
              icon={faArrowUpRightFromSquare}
              aria-hidden="true"
              className="size-4"
            />
            <span>Open in Drive</span>
          </a>
        </MenuItem>
      )}
      {onDelete && (
        <>
          <MenuSeparator className="bg-white/[0.08]" />
          <MenuItem
            onClick={onDeleteClick}
            className={DELETE_ITEM_CLASSES}
            data-testid="menu-delete"
          >
            <FontAwesomeIcon
              icon={faTrashCan}
              aria-hidden="true"
              className="size-4"
            />
            <span>Delete</span>
          </MenuItem>
        </>
      )}
    </>
  );
}

interface ItemContextMenuProps extends ItemMenuActions {
  children: ReactNode;
}

/**
 * Context menu wrapper for item actions.
 * Provides right-click menu with settings, delete, add child, pin/unpin, and Drive link options.
 *
 * @param children - The element to wrap with context menu
 * @param itemName - Name of the item for delete confirmation
 * @param driveFileId - Google Drive folder ID (shows "Open in Drive" if set)
 * @param showAddChild - Whether to show "Add Child Item" option
 * @param hasDriveConnection - Whether Google Drive is connected (for file uploads)
 * @param isPinned - Whether this item is pinned to the sidebar
 * @param onSettings - Callback to open settings dialog
 * @param onDelete - Callback to delete the item
 * @param onAddChild - Callback to create a child item
 * @param onPin - Callback to pin the item to the sidebar
 * @param onUnpin - Callback to unpin the item from the sidebar
 */
export function ItemContextMenu({
  children,
  ...actions
}: ItemContextMenuProps) {
  const {
    itemName,
    itemId,
    showAddToPlaylist = false,
    onDelete,
    onAddChild,
    onAddChildComplete,
    hasDriveConnection = false,
  } = actions;
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [addChildOpen, setAddChildOpen] = useState(false);
  const [playlistOpen, setPlaylistOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  async function handleDelete() {
    if (!onDelete) return;
    setIsLoading(true);
    try {
      await onDelete();
      setDeleteOpen(false);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
        <ContextMenuContent
          className={cn(
            "w-52",
            "bg-[#1a1a1a]/90 backdrop-blur-xl",
            "border border-white/[0.08]",
            "rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.4)]",
            "text-foreground"
          )}
        >
          {renderMenuItems({
            actions,
            MenuItem: ContextMenuItem,
            MenuSeparator: ContextMenuSeparator,
            onDeleteClick: () => setDeleteOpen(true),
            onAddChildClick: () => setAddChildOpen(true),
            onPlaylistClick: showAddToPlaylist
              ? () => setPlaylistOpen(true)
              : undefined,
          })}
        </ContextMenuContent>
      </ContextMenu>

      {/* Delete Confirmation Dialog - glassmorphism styling */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent
          className={cn(
            "bg-[#1a1a1a]/95 backdrop-blur-xl",
            "border border-white/[0.08]",
            "shadow-[0_8px_32px_rgba(0,0,0,0.4)]",
            "text-foreground"
          )}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Item</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Are you sure you want to delete &ldquo;{itemName}&rdquo;? This
              will also delete all child items. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={isLoading}
              className={cn(
                "text-foreground border-white/20 bg-white/10",
                "hover:bg-white/20"
              )}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isLoading}
              className="bg-red-500 text-white hover:bg-red-600"
            >
              {isLoading ? (
                <>
                  <FontAwesomeIcon
                    icon={faSpinner}
                    className="mr-2 size-4"
                    spin
                  />
                  Deleting…
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Child Item Dialog */}
      <AddItemDialog
        open={addChildOpen}
        onOpenChange={setAddChildOpen}
        onAdd={async (name, description, _tmdbSelection, visibilityOptions) => {
          if (!onAddChild) return { error: "No handler" };
          return onAddChild(name, description, visibilityOptions);
        }}
        onComplete={onAddChildComplete}
        parentName={itemName}
        hasDriveConnection={hasDriveConnection}
      />

      {/* Add to Playlist Dialog */}
      {playlistOpen && itemId && (
        <AddToPlaylistDialog
          open={playlistOpen}
          onOpenChange={setPlaylistOpen}
          itemId={itemId}
        />
      )}
    </>
  );
}
