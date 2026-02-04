/**
 * Context menu for demo items with Apple TV+ styling.
 * All actions are no-op with toast notifications.
 */

"use client";

import { ReactNode, useState } from "react";
import { toast } from "sonner";
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
import { Plus, Settings, Trash2, Pin, PinOff, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { CONTEXT_MENU_TOASTS } from "./demo-mock-data";

interface DemoContextMenuProps {
  /** Element to wrap with context menu. */
  children: ReactNode;
  /** Item name for display in delete confirmation. */
  itemName: string;
  /** Whether the item is currently pinned. */
  isPinned?: boolean;
  /** Whether to show "Add Child Item" option. */
  showAddChild?: boolean;
  /** Whether to show "Fork" option (for public items). */
  showFork?: boolean;
  /** Additional CSS classes. */
  className?: string;
}

/**
 * Context menu wrapper for demo items.
 * Shows Settings, Pin/Unpin, Delete, and Add Child options.
 * All actions trigger toast notifications instead of real functionality.
 */
export function DemoContextMenu({
  children,
  itemName,
  isPinned = false,
  showAddChild = true,
  showFork = false,
  className,
}: DemoContextMenuProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const handleSettings = () => {
    toast.info(CONTEXT_MENU_TOASTS.settings);
  };

  const handlePin = () => {
    toast.success(
      isPinned ? CONTEXT_MENU_TOASTS.unpin : CONTEXT_MENU_TOASTS.pin
    );
  };

  const handleDelete = () => {
    setDeleteDialogOpen(false);
    toast.success(CONTEXT_MENU_TOASTS.delete);
  };

  const handleAddChild = () => {
    toast.info(CONTEXT_MENU_TOASTS["add-child"]);
  };

  const handleFork = () => {
    toast.info(`Fork dialog would open for "${itemName}"`);
  };

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild className={className}>
          {children}
        </ContextMenuTrigger>
        <ContextMenuContent
          className={cn(
            "w-52",
            "border border-[var(--atv-border)] bg-[var(--atv-surface)]",
            "rounded-xl shadow-2xl backdrop-blur-xl",
            "text-[var(--atv-text-primary)]"
          )}
        >
          {showFork && (
            <ContextMenuItem
              onClick={handleFork}
              className={cn(
                "gap-2 rounded-lg px-3 py-2",
                "text-sm",
                "text-[var(--atv-text-secondary)]",
                "hover:bg-white/10 hover:text-[var(--atv-text-primary)]",
                "focus:bg-white/10 focus:text-[var(--atv-text-primary)]",
                "cursor-pointer"
              )}
            >
              <Share2 aria-hidden="true" className="size-4" strokeWidth={2} />
              <span>Fork</span>
            </ContextMenuItem>
          )}
          {showAddChild && (
            <ContextMenuItem
              onClick={handleAddChild}
              className={cn(
                "gap-2 rounded-lg px-3 py-2",
                "text-sm",
                "text-[var(--atv-text-secondary)]",
                "hover:bg-white/10 hover:text-[var(--atv-text-primary)]",
                "focus:bg-white/10 focus:text-[var(--atv-text-primary)]",
                "cursor-pointer"
              )}
            >
              <Plus aria-hidden="true" className="size-4" strokeWidth={2} />
              <span>Add Child Item</span>
            </ContextMenuItem>
          )}
          <ContextMenuItem
            onClick={handleSettings}
            className={cn(
              "gap-2 rounded-lg px-3 py-2",
              "text-sm",
              "text-[var(--atv-text-secondary)]",
              "hover:bg-white/10 hover:text-[var(--atv-text-primary)]",
              "focus:bg-white/10 focus:text-[var(--atv-text-primary)]",
              "cursor-pointer"
            )}
          >
            <Settings aria-hidden="true" className="size-4" strokeWidth={2} />
            <span>Settings</span>
          </ContextMenuItem>
          <ContextMenuItem
            onClick={handlePin}
            className={cn(
              "gap-2 rounded-lg px-3 py-2",
              "text-sm",
              "text-[var(--atv-text-secondary)]",
              "hover:bg-white/10 hover:text-[var(--atv-text-primary)]",
              "focus:bg-white/10 focus:text-[var(--atv-text-primary)]",
              "cursor-pointer"
            )}
          >
            {isPinned ? (
              <>
                <PinOff aria-hidden="true" className="size-4" strokeWidth={2} />
                <span>Unpin from Sidebar</span>
              </>
            ) : (
              <>
                <Pin aria-hidden="true" className="size-4" strokeWidth={2} />
                <span>Pin to Sidebar</span>
              </>
            )}
          </ContextMenuItem>
          <ContextMenuSeparator className="bg-[var(--atv-border)]" />
          <ContextMenuItem
            onClick={() => setDeleteDialogOpen(true)}
            className={cn(
              "gap-2 rounded-lg px-3 py-2",
              "text-sm",
              "text-red-400",
              "hover:bg-red-500/10 hover:text-red-300",
              "focus:bg-red-500/10 focus:text-red-300",
              "cursor-pointer"
            )}
          >
            <Trash2 aria-hidden="true" className="size-4" strokeWidth={2} />
            <span>Delete</span>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent
          className={cn(
            "border border-[var(--atv-border)] bg-[var(--atv-surface)]",
            "text-[var(--atv-text-primary)]"
          )}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Item</AlertDialogTitle>
            <AlertDialogDescription className="text-[var(--atv-text-secondary)]">
              Are you sure you want to delete &ldquo;{itemName}&rdquo;? This
              will also delete all child items. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className={cn(
                "border-white/20 bg-white/10 text-[var(--atv-text-primary)]",
                "hover:bg-white/20"
              )}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-500 text-white hover:bg-red-600"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
