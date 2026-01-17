/**
 * Base tree item component with drag handle, collapse toggle, and actions.
 * Features refined micro-interactions and subtle visual feedback.
 */

"use client";

import React, { forwardRef, HTMLAttributes } from "react";
import type { UniqueIdentifier } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import { ChevronRight, GripVertical, Play } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { ItemStats } from "@/components/items/item-stats";
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
  /** Primary media filename for "now playing" display. */
  primaryMediaName?: string | null;
  /** Media icon type: film (all video), music (all audio), mixed (both). */
  mediaIconType?: "film" | "music" | "mixed" | null;
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
      description,
      showDescription = true,
      fileCounts,
      showStats = true,
      syncStatus,
      primaryMediaName,
      mediaIconType,
      isSelected,
      onSelectChange,
      ...props
    },
    ref
  ) {
    const shouldShowDescription = showDescription && description;
    const shouldShowCheckbox = showDragHandle && onSelectChange;
    const shouldShowStats = showStats && !showDragHandle;
    const shouldShowPrimaryMedia = primaryMediaName && !showDragHandle; // Hide in edit mode

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
            "group bg-card relative flex items-center gap-2 rounded-lg border px-2 py-1.5",
            "transition-all duration-200 ease-out",
            "hover:bg-accent/50 hover:border-accent-foreground/20",
            "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
            clone && [
              "ring-primary/50 shadow-xl ring-2 shadow-black/20",
              "bg-card/95 backdrop-blur-sm",
              "scale-[1.02]",
            ],
            ghost &&
              indicator && [
                "border-primary bg-primary/20 h-1.5 px-0 py-0",
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
              className="data-[state=checked]:bg-primary data-[state=checked]:border-primary flex-shrink-0"
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
                "flex-shrink-0 cursor-pointer rounded p-0.5",
                "text-muted-foreground transition-all duration-200",
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

          {/* Item Name and Description */}
          {!ghost && (
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1">
                <span
                  className={cn(
                    "block truncate text-sm font-medium",
                    "text-foreground/90 group-hover:text-foreground",
                    "transition-colors duration-150"
                  )}
                >
                  {value}
                </span>
                {syncStatus && syncStatus !== "SYNCED" && (
                  <SyncIcon syncStatus={syncStatus} className="flex-shrink-0" />
                )}
              </div>
              {/* Description, primary media, and stats - only in view mode */}
              {!showDragHandle && (
                <>
                  {shouldShowDescription && (
                    <span className="text-muted-foreground block truncate text-xs">
                      {description}
                    </span>
                  )}
                  {/* Primary media indicator */}
                  {shouldShowPrimaryMedia && (
                    <span className="text-muted-foreground mt-0.5 flex items-center gap-1 text-xs">
                      <Play className="size-2.5 shrink-0 fill-current opacity-60" />
                      <span className="truncate opacity-80">
                        {primaryMediaName}
                      </span>
                    </span>
                  )}
                  {shouldShowStats && (
                    <ItemStats
                      childCount={childCount}
                      fileCounts={fileCounts}
                      mediaIconType={mediaIconType}
                      variant="muted"
                      format="text"
                      className="mt-0.5 text-xs"
                    />
                  )}
                </>
              )}
            </div>
          )}

          {/* Child Count Badge (for clone/drag overlay) */}
          {clone && childCount && childCount > 1 && (
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
          )}
        </div>
      </li>
    );
  }
);
