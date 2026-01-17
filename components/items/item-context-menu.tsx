/**
 * Context menu for item actions (settings, delete, add child).
 * Clean dialog interactions with refined styling.
 */

"use client";

import { ReactNode, useState } from "react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AddItemDialog, type CreateItemResult } from "./add-item-dialog";
import { Plus, Settings, Trash2, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

interface ItemContextMenuProps {
  children: ReactNode;
  itemName: string;
  /** Google Drive folder ID for this item (if synced) */
  driveFileId?: string | null;
  showAddChild?: boolean;
  /** Whether user has Google Drive connected (for file uploads in Add Child dialog) */
  hasDriveConnection?: boolean;
  /** Opens the unified settings dialog */
  onSettings?(): void;
  onDelete?(): Promise<void>;
  onAddChild?(name: string, description?: string): Promise<CreateItemResult>;
  /** Callback to refresh data after child item is created (for AddItemDialog) */
  onAddChildComplete?(): Promise<void>;
}

/**
 * Context menu wrapper for item actions.
 * Provides right-click menu with settings, delete, add child, and Drive link options.
 *
 * @param children - The element to wrap with context menu
 * @param itemName - Name of the item for delete confirmation
 * @param driveFileId - Google Drive folder ID (shows "Open in Drive" if set)
 * @param showAddChild - Whether to show "Add Child Item" option
 * @param hasDriveConnection - Whether Google Drive is connected (for file uploads)
 * @param onSettings - Callback to open settings dialog
 * @param onDelete - Callback to delete the item
 * @param onAddChild - Callback to create a child item
 */
export function ItemContextMenu({
  children,
  itemName,
  driveFileId,
  showAddChild = true,
  hasDriveConnection = false,
  onSettings,
  onDelete,
  onAddChild,
  onAddChildComplete,
}: ItemContextMenuProps) {
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
        <ContextMenuContent className="w-52">
          {showAddChild && onAddChild && (
            <ContextMenuItem
              onClick={() => setAddChildOpen(true)}
              className="gap-2"
            >
              <Plus className="size-4" strokeWidth={2} />
              <span>Add Child Item</span>
            </ContextMenuItem>
          )}
          {onSettings && (
            <ContextMenuItem onClick={onSettings} className="gap-2">
              <Settings className="size-4" strokeWidth={2} />
              <span>Settings</span>
            </ContextMenuItem>
          )}
          {driveFileId && (
            <ContextMenuItem asChild className="gap-2">
              <a
                href={`https://drive.google.com/drive/folders/${driveFileId}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="size-4" strokeWidth={2} />
                <span>Open in Drive</span>
              </a>
            </ContextMenuItem>
          )}
          {onDelete && (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem
                onClick={() => setDeleteOpen(true)}
                className={cn(
                  "gap-2",
                  "text-destructive focus:text-destructive focus:bg-destructive/10"
                )}
              >
                <Trash2 className="size-4" strokeWidth={2} />
                <span>Delete</span>
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>

      {/* Delete Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Item</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{itemName}&rdquo;? This
              will also delete all child items. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isLoading}
            >
              {isLoading ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
