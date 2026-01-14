/**
 * Toolbar for bulk actions on selected items.
 * Shows selection count and actions like delete.
 */

"use client";

import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

interface BulkActionsToolbarProps {
  /** Number of selected items */
  selectionCount: number;
  /** Whether all items are selected */
  isAllSelected: boolean;
  /** Whether some but not all items are selected */
  isPartiallySelected: boolean;
  /** Callback to toggle all selection */
  onToggleAll: () => void;
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
 * @param isPartiallySelected - True when some but not all items are selected
 * @param onToggleAll - Called when select-all checkbox is toggled
 * @param onDelete - Called when delete button is clicked
 * @param isDeleting - Shows loading state when true
 * @param className - Additional CSS classes
 *
 * @example
 * <BulkActionsToolbar
 *   selectionCount={selectedIds.size}
 *   isAllSelected={isAllSelected}
 *   isPartiallySelected={isPartiallySelected}
 *   onToggleAll={toggleAll}
 *   onDelete={handleBulkDelete}
 *   isDeleting={isDeleting}
 * />
 */
export function BulkActionsToolbar({
  selectionCount,
  isAllSelected,
  isPartiallySelected,
  onToggleAll,
  onDelete,
  isDeleting,
  className,
}: BulkActionsToolbarProps) {
  return (
    <div
      className={cn(
        "bg-muted/50 flex items-center gap-4 rounded-lg border px-4 py-2",
        "backdrop-blur-sm transition-all duration-200",
        selectionCount > 0 && "border-primary/20 bg-primary/5",
        className
      )}
    >
      <Checkbox
        checked={
          isAllSelected ? true : isPartiallySelected ? "indeterminate" : false
        }
        onCheckedChange={onToggleAll}
        aria-label="Select all items"
        className="data-[state=checked]:bg-primary data-[state=indeterminate]:bg-primary"
      />

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

      {selectionCount > 0 && (
        <Button
          variant="destructive"
          size="sm"
          onClick={onDelete}
          disabled={isDeleting}
          className="ml-auto gap-2 shadow-sm transition-all hover:shadow-md"
        >
          {isDeleting ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              <span>Deleting...</span>
            </>
          ) : (
            <>
              <Trash2 className="size-4" />
              <span>Delete {selectionCount}</span>
            </>
          )}
        </Button>
      )}
    </div>
  );
}
