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
import { AddFolderDialog } from "./add-folder-dialog";
import { FolderPlus, Settings, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ItemContextMenuProps {
  children: ReactNode;
  itemName: string;
  showAddChild?: boolean;
  /** Opens the unified settings dialog */
  onSettings?(): void;
  onDelete?(): Promise<void>;
  onAddChild?(name: string, description?: string): Promise<string | undefined>;
}

export function ItemContextMenu({
  children,
  itemName,
  showAddChild = true,
  onSettings,
  onDelete,
  onAddChild,
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
              <FolderPlus className="size-4" strokeWidth={2} />
              <span>Add Subfolder</span>
            </ContextMenuItem>
          )}
          {onSettings && (
            <ContextMenuItem onClick={onSettings} className="gap-2">
              <Settings className="size-4" strokeWidth={2} />
              <span>Settings</span>
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
            <DialogTitle>Delete Folder</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{itemName}&rdquo;? This
              will also delete all subfolders. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
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

      {/* Add Subfolder Dialog */}
      <AddFolderDialog
        open={addChildOpen}
        onOpenChange={setAddChildOpen}
        onAdd={async (name, description) => {
          if (!onAddChild) return "No handler";
          return onAddChild(name, description);
        }}
        parentName={itemName}
      />
    </>
  );
}
