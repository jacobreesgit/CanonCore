/**
 * Context menu for item actions (settings, delete, add child).
 * Glassmorphism styling with AlertDialog confirmation.
 * Exports reusable ItemMenuActions and renderMenuItems for use in both
 * ContextMenu and DropdownMenu contexts.
 */

"use client";

import { ComponentType, ReactNode, useState } from "react";
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
} from "@fortawesome/free-solid-svg-icons";
import { cn } from "@/lib/utils";

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
  onAddChild?(name: string, description?: string): Promise<CreateItemResult>;
  /** Callback to refresh data after child item is created (for AddItemDialog) */
  onAddChildComplete?(): Promise<void>;
  /** Callback to pin the item to the sidebar */
  onPin?(): Promise<void>;
  /** Callback to unpin the item from the sidebar */
  onUnpin?(): Promise<void>;
}

/** Glassmorphism menu item styling shared by context menu and dropdown menu. */
export const MENU_ITEM_CLASSES = cn(
  "gap-2 rounded-lg px-3 py-2",
  "text-sm",
  "text-muted-foreground",
  "hover:bg-white/10 hover:text-foreground",
  "focus:bg-white/10 focus:text-foreground",
  "cursor-pointer"
);

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
}: {
  actions: ItemMenuActions;
  MenuItem: ComponentType<{
    onClick?: () => void;
    className?: string;
    children: ReactNode;
    asChild?: boolean;
  }>;
  MenuSeparator: ComponentType<{ className?: string }>;
  onDeleteClick: () => void;
  onAddChildClick: () => void;
}) {
  const {
    showAddChild = true,
    driveFileId,
    isPinned = false,
    onSettings,
    onDelete,
    onAddChild,
    onPin,
    onUnpin,
  } = actions;

  return (
    <>
      {showAddChild && onAddChild && (
        <MenuItem onClick={onAddChildClick} className={MENU_ITEM_CLASSES}>
          <FontAwesomeIcon
            icon={faPlus}
            aria-hidden="true"
            className="size-4"
          />
          <span>Add Child Item</span>
        </MenuItem>
      )}
      {onSettings && (
        <MenuItem onClick={onSettings} className={MENU_ITEM_CLASSES}>
          <FontAwesomeIcon
            icon={faGear}
            aria-hidden="true"
            className="size-4"
          />
          <span>Settings</span>
        </MenuItem>
      )}
      {isPinned && onUnpin && (
        <MenuItem onClick={onUnpin} className={MENU_ITEM_CLASSES}>
          <FontAwesomeIcon
            icon={faThumbtackSlash}
            aria-hidden="true"
            className="size-4"
          />
          <span>Unpin from Sidebar</span>
        </MenuItem>
      )}
      {!isPinned && onPin && (
        <MenuItem onClick={onPin} className={MENU_ITEM_CLASSES}>
          <FontAwesomeIcon
            icon={faThumbtack}
            aria-hidden="true"
            className="size-4"
          />
          <span>Pin to Sidebar</span>
        </MenuItem>
      )}
      {driveFileId && (
        <MenuItem asChild className={MENU_ITEM_CLASSES}>
          <a
            href={`https://drive.google.com/drive/folders/${driveFileId}`}
            target="_blank"
            rel="noopener noreferrer"
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
    onDelete,
    onAddChild,
    onAddChildComplete,
    hasDriveConnection = false,
  } = actions;
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [addChildOpen, setAddChildOpen] = useState(false);
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
        onAdd={async (name, description) => {
          if (!onAddChild) return { error: "No handler" };
          return onAddChild(name, description);
        }}
        onComplete={onAddChildComplete}
        parentName={itemName}
        hasDriveConnection={hasDriveConnection}
      />
    </>
  );
}
