/**
 * Compact tree item component with clear visual hierarchy.
 * Features bordered cards for contrast, medium typography, and inline progress displays.
 * Refined micro-interactions without position shifts on hover.
 */

"use client";

import { forwardRef, HTMLAttributes } from "react";
import type { UniqueIdentifier } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import { ChevronRight, GripVertical } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { SyncIcon } from "@/components/items/sync-badge";
import type { FileCounts, SyncStatus } from "@/lib/types";

export interface TreeItemProps extends Omit<
  HTMLAttributes<HTMLLIElement>,
  "id"
> {
  id: UniqueIdentifier;
  value: string;
  /** Optional short description (max 200 chars). */
  description?: string | null;
  depth: number;
  indentationWidth: number;
  collapsed?: boolean;
  clone?: boolean;
  childCount?: number;
  indicator?: boolean;
  ghost?: boolean;
  disableSelection?: boolean;
  disableInteraction?: boolean;
  handleProps?: Record<string, unknown>;
  wrapperRef?(node: HTMLLIElement): void;
  onCollapse?(): void;
  onClick?(): void;
  /** Whether to show the drag handle. Defaults to true. */
  showDragHandle?: boolean;
  /** Whether to show description. Defaults to true. Hidden in edit mode. */
  showDescription?: boolean;
  /** File counts by type for display. */
  fileCounts?: FileCounts;
  /** Whether to show stats (children + files). Defaults to true. Hidden in edit mode. */
  showStats?: boolean;
  /** Sync status for displaying indicator. */
  syncStatus?: SyncStatus;
  /** Media icon type: film (all video), music (all audio), mixed (both). */
  mediaIconType?: "film" | "music" | "mixed" | null;
  /** Progress percentage (0-100) for item and descendants, null if no media files. */
  progressPercentage?: number | null;
  /** Number of watched (>90% complete) media files. */
  watchedCount?: number;
  /** Total number of media files (item + descendants). */
  totalMediaCount?: number;
  /** Total number of items (item + descendants) for progress label. */
  totalItems?: number;
  /** Whether the item is selected (for bulk operations). */
  isSelected?: boolean;
  /** Callback when selection state changes. */
  onSelectChange?: (selected: boolean) => void;
}

export const TreeItem = forwardRef<HTMLDivElement, TreeItemProps>(
  function TreeItem(
    {
      id,
      value,
      depth,
      indentationWidth,
      collapsed,
      clone,
      childCount,
      indicator,
      ghost,
      disableSelection,
      disableInteraction,
      handleProps,
      wrapperRef,
      onCollapse,
      onClick,
      style,
      className,
      showDragHandle = true,
      syncStatus,
      progressPercentage,
      watchedCount,
      totalMediaCount,
      totalItems,
      isSelected,
      onSelectChange,
      // Destructure to prevent passing to DOM element via ...props
      description: _description,
      showDescription: _showDescription,
      fileCounts: _fileCounts,
      showStats: _showStats,
      mediaIconType: _mediaIconType,
      ...props
    },
    ref
  ) {
    const shouldShowCheckbox = showDragHandle && onSelectChange;
    const shouldShowWatched =
      watchedCount !== undefined &&
      totalMediaCount !== undefined &&
      totalMediaCount > 0 &&
      !showDragHandle; // Hide in edit mode

    // In select mode, clicking the item toggles selection instead of navigation
    const isSelectMode = !!onSelectChange;
    const handleClick = isSelectMode
      ? () => onSelectChange?.(!isSelected)
      : onClick;

    return (
      <li
        ref={wrapperRef}
        data-id={String(id)}
        className={cn(
          "list-none",
          clone && "pointer-events-none inline-block pt-1",
          ghost && !clone && "opacity-40",
          disableSelection && "select-none",
          disableInteraction && "pointer-events-none",
          className
        )}
        style={{
          paddingLeft: clone ? 10 : `${depth * indentationWidth}px`,
          ...style,
        }}
        {...props}
      >
        <div
          ref={ref}
          onClick={handleClick}
          className={cn(
            "group bg-card relative flex items-center gap-2 rounded-lg border px-3 py-1.5",
            "transition-colors duration-200 ease-out",
            "hover:bg-muted/50 hover:border-muted-foreground/20",
            "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
            clone && [
              "ring-primary/50 shadow-xl ring-2 shadow-black/20",
              "bg-card/95 backdrop-blur-sm",
              "scale-[1.02]",
            ],
            ghost &&
              indicator && [
                "border-primary bg-primary/20 h-1.5 rounded-full px-0 py-0",
                "before:absolute before:top-1/2 before:-left-1.5 before:-translate-y-1/2",
                "before:border-primary before:bg-background before:size-2.5 before:rounded-full before:border-2",
              ],
            (onClick || isSelectMode) && "cursor-pointer"
          )}
        >
          {/* Selection Checkbox - shown in edit mode */}
          {!ghost && shouldShowCheckbox && (
            <Checkbox
              checked={isSelected}
              onCheckedChange={(checked) => {
                onSelectChange?.(checked === true);
              }}
              onClick={(e) => e.stopPropagation()}
              aria-label={`Select ${value}`}
              className="data-[state=checked]:bg-primary data-[state=checked]:border-primary size-4 flex-shrink-0"
            />
          )}

          {/* Drag Handle */}
          {!ghost && showDragHandle && (
            <button
              type="button"
              aria-label="Drag handle"
              className={cn(
                "flex-shrink-0 touch-none rounded",
                "flex size-5 items-center justify-center",
                "text-muted-foreground/50 transition-colors duration-150",
                "hover:text-muted-foreground hover:bg-muted/50",
                "focus-visible:ring-ring focus-visible:ring-1 focus-visible:outline-none",
                "cursor-grab active:cursor-grabbing"
              )}
              {...handleProps}
            >
              <GripVertical className="size-3.5" strokeWidth={2.5} />
            </button>
          )}

          {/* Collapse Toggle */}
          {!ghost && onCollapse && (
            <button
              type="button"
              aria-label={collapsed ? "Expand item" : "Collapse item"}
              onClick={(e) => {
                e.stopPropagation();
                onCollapse();
              }}
              className={cn(
                "flex-shrink-0 cursor-pointer rounded",
                "flex size-5 items-center justify-center",
                "text-muted-foreground transition-colors duration-200",
                "hover:text-foreground hover:bg-muted/50",
                "focus-visible:ring-ring focus-visible:ring-1 focus-visible:outline-none"
              )}
            >
              <ChevronRight
                className={cn(
                  "size-3.5 transition-transform duration-200 ease-out",
                  !collapsed && "rotate-90"
                )}
                strokeWidth={2.5}
              />
            </button>
          )}

          {/* Item Name and Progress */}
          {!ghost && (
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span
                  className={cn(
                    "truncate text-sm font-medium",
                    "text-foreground/90 group-hover:text-foreground",
                    "transition-colors duration-150"
                  )}
                >
                  {value}
                </span>
                {syncStatus && syncStatus !== "SYNCED" && (
                  <SyncIcon syncStatus={syncStatus} className="flex-shrink-0" />
                )}
                {/* Watched count indicator - inline with title */}
                {!showDragHandle && shouldShowWatched && (
                  <>
                    <span className="text-muted-foreground text-xs">•</span>
                    <span className="text-muted-foreground text-xs whitespace-nowrap">
                      {watchedCount}/{totalMediaCount} watched
                      {totalItems !== undefined &&
                        totalItems > totalMediaCount && (
                          <>
                            {" "}
                            (of {totalItems}{" "}
                            {totalItems === 1 ? "item" : "items"})
                          </>
                        )}
                    </span>
                  </>
                )}
              </div>
              {/* Progress bar - only in view mode */}
              {!showDragHandle && progressPercentage !== null && (
                <div className="mt-1.5">
                  <div className="bg-muted-foreground/20 h-1.5 w-full overflow-hidden rounded-full">
                    <div
                      data-testid="tree-item-progress-bar"
                      className="bg-primary h-full rounded-full transition-[width] duration-300"
                      style={{ width: `${progressPercentage}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Child Count Badge (for clone/drag overlay) */}
          {clone && childCount !== undefined && childCount > 1 ? (
            <span
              className={cn(
                "absolute -top-2 -right-2 z-10",
                "flex items-center justify-center",
                "size-5 rounded-full",
                "bg-primary text-primary-foreground",
                "text-xs font-semibold",
                "shadow-primary/30 shadow-md",
                "ring-background ring-2"
              )}
            >
              {childCount}
            </span>
          ) : null}
        </div>
      </li>
    );
  }
);
