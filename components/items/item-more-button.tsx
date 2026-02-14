/**
 * More options dropdown button for item actions.
 * Glassmorphism ellipsis button that opens a DropdownMenu,
 * reusing the shared renderMenuItems from item-context-menu.
 */

"use client";

import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { AddItemDialog } from "./add-item-dialog";
import { MoreHorizontal, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { renderMenuItems, type ItemMenuActions } from "./item-context-menu";

interface ItemMoreButtonProps extends ItemMenuActions {
  className?: string;
}

/**
 * Dropdown menu button for item actions.
 * Renders a glassmorphism ellipsis button that opens a menu with
 * settings, delete, add child, pin/unpin, and Drive link options.
 *
 * @param props - Item action callbacks and optional className
 */
export function ItemMoreButton({ className, ...actions }: ItemMoreButtonProps) {
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
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            data-testid="item-more-button"
            aria-label="More options"
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "flex size-7 items-center justify-center",
              "rounded-md",
              "border border-white/[0.08] bg-white/[0.06]",
              "hover:border-white/[0.12] hover:bg-white/[0.12]",
              "hover:text-foreground text-[var(--tertiary-foreground)]",
              "transition-all duration-150",
              "focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none",
              className
            )}
          >
            <MoreHorizontal className="size-4" aria-hidden="true" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className={cn(
            "w-52",
            "bg-[#1a1a1a]/90 backdrop-blur-xl",
            "border border-white/[0.08]",
            "rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.4)]",
            "text-foreground"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {renderMenuItems({
            actions,
            MenuItem: DropdownMenuItem,
            MenuSeparator: DropdownMenuSeparator,
            onDeleteClick: () => setDeleteOpen(true),
            onAddChildClick: () => setAddChildOpen(true),
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Delete Confirmation Dialog */}
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
                  <Loader2 className="mr-2 size-4 animate-spin" />
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
