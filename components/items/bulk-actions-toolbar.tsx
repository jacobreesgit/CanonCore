/**
 * Toolbar for bulk actions on selected items.
 * Shows selection count and actions like select all and delete.
 */

"use client";

import { Loader2, Trash2 } from "lucide-react";
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
 * Toolbar displaying selection state and bulk actions.
 * Appears in edit mode to enable multi-item operations.
 *
 * @param selectionCount - Number of currently selected items
 * @param isAllSelected - True when all items are selected
 * @param onSelectAll - Called when Select All button is clicked
 * @param onDeselectAll - Called when Deselect All button is clicked
 * @param onDelete - Called when delete button is clicked
 * @param isDeleting - Shows loading state when true
 * @param className - Additional CSS classes
 */
export function BulkActionsToolbar({
  selectionCount,
  isAllSelected,
  onSelectAll,
  onDeselectAll,
  onDelete,
  isDeleting,
  className,
}: BulkActionsToolbarProps) {
  return (
    <div
      className={cn(
        "bg-muted/50 flex h-12 items-center gap-4 rounded-lg border px-4",
        "backdrop-blur-sm transition-all duration-200",
        selectionCount > 0 && "border-primary/20 bg-primary/5",
        className
      )}
    >
      <span
        className={cn(
          "text-sm transition-colors",
          selectionCount > 0
            ? "text-foreground font-medium"
            : "text-muted-foreground"
        )}
      >
        {selectionCount > 0 ? `${selectionCount} selected` : "Select items"}
      </span>

      <div className="ml-auto flex items-center gap-2">
        <Button
          variant="outline"
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
          className="gap-2 shadow-sm transition-all hover:shadow-md"
        >
          {isDeleting ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              <span>Deleting...</span>
            </>
          ) : (
            <>
              <Trash2 className="size-4" />
              <span>
                Delete{selectionCount > 0 ? ` ${selectionCount}` : ""}
              </span>
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
