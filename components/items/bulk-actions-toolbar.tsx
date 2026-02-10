/**
 * Floating toolbar for bulk actions on selected items.
 * Fixed at bottom of screen with glass morphism and smooth animations.
 * Respects user's reduced motion preference for accessibility.
 */

"use client";

import { memo } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface BulkActionsToolbarProps {
  /** Number of selected items */
  selectionCount: number;
  /** Whether all items are selected */
  isAllSelected: boolean;
  /** Callback to select all items */
  onSelectAll: () => void;
  /** Callback to deselect all items */
  onDeselectAll: () => void;
  /** Callback to delete selected items */
  onDelete: () => void;
  /** Whether delete is in progress */
  isDeleting: boolean;
  /** Optional additional class names */
  className?: string;
}

/**
 * Floating toolbar at bottom of screen with glass morphism effect.
 * Slides up when items are selected, providing quick access to bulk actions.
 * Memoized to prevent unnecessary re-renders when parent state changes.
 *
 * @param selectionCount - Number of currently selected items
 * @param isAllSelected - True when all items are selected
 * @param onSelectAll - Called when Select All button is clicked
 * @param onDeselectAll - Called when Deselect All button is clicked
 * @param onDelete - Called when delete button is clicked
 * @param isDeleting - Shows loading state when true
 * @param className - Additional CSS classes
 */
export const BulkActionsToolbar = memo(function BulkActionsToolbar({
  selectionCount,
  isAllSelected,
  onSelectAll,
  onDeselectAll,
  onDelete,
  isDeleting,
  className,
}: BulkActionsToolbarProps) {
  // Respect user's reduced motion preference
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
      transition={
        prefersReducedMotion
          ? { duration: 0 }
          : {
              type: "spring",
              stiffness: 400,
              damping: 30,
            }
      }
      className={cn(
        "fixed right-0 bottom-0 left-0 z-50",
        "pointer-events-none flex justify-center",
        "pb-safe px-4 pb-4 lg:pb-6",
        className
      )}
    >
      <div
        className={cn(
          "bg-background pointer-events-auto relative w-full max-w-2xl",
          "rounded-2xl border shadow-2xl",
          "transition-colors duration-200",
          selectionCount > 0 && "border-primary/20"
        )}
      >
        <div className="relative flex h-16 items-center gap-3 px-4 lg:gap-4 lg:px-6">
          {/* Selection count with animated number */}
          <motion.div
            key={selectionCount}
            initial={prefersReducedMotion ? false : { scale: 1.2, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={prefersReducedMotion ? { duration: 0 } : undefined}
            className="flex items-center gap-2"
          >
            <div
              className={cn(
                "flex h-8 min-w-[2rem] items-center justify-center rounded-full px-2.5 font-bold tabular-nums transition-colors",
                selectionCount > 0
                  ? "bg-primary/10 text-primary"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {selectionCount}
            </div>
            <span
              className={cn(
                "hidden text-sm font-medium transition-colors xl:inline",
                selectionCount > 0 ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {selectionCount === 1
                ? "item selected"
                : selectionCount > 0
                  ? "items selected"
                  : "Select items"}
            </span>
          </motion.div>

          {/* Actions */}
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={isAllSelected ? onDeselectAll : onSelectAll}
            >
              {isAllSelected ? "Deselect All" : "Select All"}
            </Button>

            <Button
              variant="destructive"
              size="sm"
              onClick={onDelete}
              disabled={isDeleting || selectionCount === 0}
              className={cn(
                "gap-2 shadow-sm transition-all",
                "hover:shadow-md"
              )}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  <span className="hidden xl:inline">Deleting…</span>
                </>
              ) : (
                <>
                  <Trash2 className="size-4" aria-hidden="true" />
                  <span className="hidden xl:inline">Delete</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
});
