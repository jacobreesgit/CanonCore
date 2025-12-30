/**
 * Context menu for item actions (rename, delete, add child).
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
import { Input } from "@/components/ui/input";
import { IconEdit, IconTrash, IconFolderPlus } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

interface ItemContextMenuProps {
  children: ReactNode;
  itemName: string;
  showAddChild?: boolean;
  onRename?(newName: string): Promise<void>;
  onDelete?(): Promise<void>;
  onAddChild?(name: string): Promise<string | undefined>;
}

export function ItemContextMenu({
  children,
  itemName,
  showAddChild = true,
  onRename,
  onDelete,
  onAddChild,
}: ItemContextMenuProps) {
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [addChildOpen, setAddChildOpen] = useState(false);
  const [newName, setNewName] = useState(itemName);
  const [childName, setChildName] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleRename() {
    if (!newName.trim() || !onRename) return;
    setIsLoading(true);
    try {
      await onRename(newName.trim());
      setRenameOpen(false);
    } finally {
      setIsLoading(false);
    }
  }

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

  async function handleAddChild() {
    if (!childName.trim() || !onAddChild) return;
    setIsLoading(true);
    try {
      await onAddChild(childName.trim());
      setAddChildOpen(false);
      setChildName("");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
        <ContextMenuContent className="w-52">
          {onRename && (
            <ContextMenuItem
              onClick={() => {
                setNewName(itemName);
                setRenameOpen(true);
              }}
              className="gap-2"
            >
              <IconEdit className="size-4" strokeWidth={2} />
              <span>Rename</span>
            </ContextMenuItem>
          )}
          {showAddChild && onAddChild && (
            <ContextMenuItem
              onClick={() => setAddChildOpen(true)}
              className="gap-2"
            >
              <IconFolderPlus className="size-4" strokeWidth={2} />
              <span>Add Subfolder</span>
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
                <IconTrash className="size-4" strokeWidth={2} />
                <span>Delete</span>
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>

      {/* Rename Dialog */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename Folder</DialogTitle>
            <DialogDescription>
              Enter a new name for &ldquo;{itemName}&rdquo;.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Folder name"
            onKeyDown={(e) => e.key === "Enter" && handleRename()}
            autoFocus
          />
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setRenameOpen(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRename}
              disabled={!newName.trim() || isLoading}
            >
              {isLoading ? "Renaming..." : "Rename"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      {/* Add Child Dialog */}
      <Dialog open={addChildOpen} onOpenChange={setAddChildOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Subfolder</DialogTitle>
            <DialogDescription>
              Create a new folder inside &ldquo;{itemName}&rdquo;.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={childName}
            onChange={(e) => setChildName(e.target.value)}
            placeholder="Folder name"
            onKeyDown={(e) => e.key === "Enter" && handleAddChild()}
            autoFocus
          />
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setAddChildOpen(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddChild}
              disabled={!childName.trim() || isLoading}
            >
              {isLoading ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
