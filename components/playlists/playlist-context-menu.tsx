/**
 * Context menus for playlist actions.
 * Two variants: playlist card menu (rename, visibility, delete) and
 * item-in-playlist menu (remove, go to item, open in new tab).
 * Follows the polymorphic pattern from item-context-menu.tsx.
 */

"use client";

import { ComponentType, ReactNode, useState, useCallback } from "react";
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
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPencil,
  faEye,
  faEyeSlash,
  faTrashCan,
  faSpinner,
  faXmark,
  faArrowUpRightFromSquare,
  faArrowRight,
} from "@fortawesome/free-solid-svg-icons";
import { cn } from "@/lib/utils";
import {
  MENU_ITEM_CLASSES,
  DELETE_ITEM_CLASSES,
} from "@/components/items/item-context-menu";

/** Action callbacks for playlist card context menus. */
export interface PlaylistMenuActions {
  playlistName: string;
  isPublic: boolean;
  onRename?(): void;
  onToggleVisibility?(): Promise<void>;
  onDelete?(): Promise<void>;
}

/**
 * Renders menu items for playlist card actions.
 * Works with both ContextMenuItem and DropdownMenuItem.
 */
export function renderPlaylistMenuItems({
  actions,
  MenuItem,
  MenuSeparator,
  onDeleteClick,
}: {
  actions: PlaylistMenuActions;
  MenuItem: ComponentType<{
    onClick?: () => void;
    className?: string;
    children: ReactNode;
  }>;
  MenuSeparator: ComponentType<{ className?: string }>;
  onDeleteClick: () => void;
}) {
  const { isPublic, onRename, onToggleVisibility, onDelete } = actions;

  return (
    <>
      {onRename && (
        <MenuItem onClick={onRename} className={MENU_ITEM_CLASSES}>
          <FontAwesomeIcon
            icon={faPencil}
            aria-hidden="true"
            className="size-4"
          />
          <span>Rename</span>
        </MenuItem>
      )}
      {onToggleVisibility && (
        <MenuItem onClick={onToggleVisibility} className={MENU_ITEM_CLASSES}>
          {isPublic ? (
            <>
              <FontAwesomeIcon
                icon={faEyeSlash}
                aria-hidden="true"
                className="size-4"
              />
              <span>Make Private</span>
            </>
          ) : (
            <>
              <FontAwesomeIcon
                icon={faEye}
                aria-hidden="true"
                className="size-4"
              />
              <span>Make Public</span>
            </>
          )}
        </MenuItem>
      )}
      {onDelete && (
        <>
          <MenuSeparator className="bg-white/[0.08]" />
          <MenuItem onClick={onDeleteClick} className={DELETE_ITEM_CLASSES}>
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

interface PlaylistContextMenuProps extends PlaylistMenuActions {
  children: ReactNode;
}

/**
 * Context menu wrapper for playlist card actions.
 * Provides right-click menu with rename, visibility toggle, and delete options.
 */
export function PlaylistContextMenu({
  children,
  ...actions
}: PlaylistContextMenuProps) {
  const { playlistName, onDelete } = actions;
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleDelete = useCallback(async () => {
    if (!onDelete) return;
    setIsLoading(true);
    try {
      await onDelete();
      setDeleteOpen(false);
    } finally {
      setIsLoading(false);
    }
  }, [onDelete]);

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
        <ContextMenuContent
          className={cn(
            "w-52",
            "glass-menu",
            "border border-white/[0.08]",
            "rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.4)]",
            "text-foreground"
          )}
        >
          {renderPlaylistMenuItems({
            actions,
            MenuItem: ContextMenuItem,
            MenuSeparator: ContextMenuSeparator,
            onDeleteClick: () => setDeleteOpen(true),
          })}
        </ContextMenuContent>
      </ContextMenu>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent
          className={cn(
            "glass-dialog",
            "border border-white/[0.08]",
            "shadow-[0_8px_32px_rgba(0,0,0,0.4)]",
            "text-foreground"
          )}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Playlist</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Are you sure you want to delete &ldquo;{playlistName}&rdquo;?
              Items in this playlist will not be deleted. This action cannot be
              undone.
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
                    spin
                    className="mr-2 size-4"
                  />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** Action callbacks for item-in-playlist context menus. */
export interface PlaylistItemMenuActions {
  itemName: string;
  itemHref: string;
  onRemove?(): Promise<void>;
}

/**
 * Renders menu items for item-in-playlist actions.
 * Works with both ContextMenuItem and DropdownMenuItem.
 */
export function renderPlaylistItemMenuItems({
  actions,
  MenuItem,
  MenuSeparator,
}: {
  actions: PlaylistItemMenuActions;
  MenuItem: ComponentType<{
    onClick?: () => void;
    className?: string;
    children: ReactNode;
    asChild?: boolean;
  }>;
  MenuSeparator: ComponentType<{ className?: string }>;
}) {
  const { itemHref, onRemove } = actions;

  return (
    <>
      <MenuItem
        onClick={() => (window.location.href = itemHref)}
        className={MENU_ITEM_CLASSES}
      >
        <FontAwesomeIcon
          icon={faArrowRight}
          aria-hidden="true"
          className="size-4"
        />
        <span>Go to Item</span>
      </MenuItem>
      <MenuItem
        onClick={() => window.open(itemHref, "_blank")}
        className={MENU_ITEM_CLASSES}
      >
        <FontAwesomeIcon
          icon={faArrowUpRightFromSquare}
          aria-hidden="true"
          className="size-4"
        />
        <span>Open in New Tab</span>
      </MenuItem>
      {onRemove && (
        <>
          <MenuSeparator className="bg-white/[0.08]" />
          <MenuItem onClick={onRemove} className={DELETE_ITEM_CLASSES}>
            <FontAwesomeIcon
              icon={faXmark}
              aria-hidden="true"
              className="size-4"
            />
            <span>Remove from Playlist</span>
          </MenuItem>
        </>
      )}
    </>
  );
}

interface PlaylistItemContextMenuProps extends PlaylistItemMenuActions {
  children: ReactNode;
}

/**
 * Context menu wrapper for items within a playlist detail grid.
 * Provides right-click menu with go to item, open in new tab, and remove options.
 * Remove triggers a confirmation dialog before executing.
 */
export function PlaylistItemContextMenu({
  children,
  ...actions
}: PlaylistItemContextMenuProps) {
  const { itemName, onRemove } = actions;
  const [removeOpen, setRemoveOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleRemove = useCallback(async () => {
    if (!onRemove) return;
    setIsLoading(true);
    try {
      await onRemove();
      setRemoveOpen(false);
    } finally {
      setIsLoading(false);
    }
  }, [onRemove]);

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
        <ContextMenuContent
          className={cn(
            "w-52",
            "glass-menu",
            "border border-white/[0.08]",
            "rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.4)]",
            "text-foreground"
          )}
        >
          {renderPlaylistItemMenuItems({
            actions: { ...actions, onRemove: async () => setRemoveOpen(true) },
            MenuItem: ContextMenuItem,
            MenuSeparator: ContextMenuSeparator,
          })}
        </ContextMenuContent>
      </ContextMenu>

      <AlertDialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <AlertDialogContent
          className={cn(
            "glass-dialog",
            "border border-white/[0.08]",
            "shadow-[0_8px_32px_rgba(0,0,0,0.4)]",
            "text-foreground"
          )}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from Playlist</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Remove &ldquo;{itemName}&rdquo; from this playlist? The item
              itself will not be deleted.
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
              onClick={handleRemove}
              disabled={isLoading}
              className="bg-red-500 text-white hover:bg-red-600"
            >
              {isLoading ? (
                <>
                  <FontAwesomeIcon
                    icon={faSpinner}
                    spin
                    className="mr-2 size-4"
                  />
                  Removing...
                </>
              ) : (
                "Remove"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
