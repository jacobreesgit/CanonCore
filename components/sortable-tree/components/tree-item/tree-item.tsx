/**
 * Tree item component with glassmorphism styling.
 * Features subtle glass effect, refined typography, and inline progress displays.
 * Refined micro-interactions without position shifts on hover.
 * Optional poster thumbnail support for enhanced visual presentation.
 */

"use client";

import { forwardRef, HTMLAttributes } from "react";
import type { UniqueIdentifier } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import { slugify } from "@/lib/slugify";
import { ProgressBar } from "@/components/ui/progress-bar";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChevronRight,
  faGripVertical,
  faFolder,
} from "@fortawesome/free-solid-svg-icons";
import { Checkbox } from "@/components/ui/checkbox";
import { SyncIcon } from "@/components/items/sync-badge";
import { getTmdbPosterUrl } from "@/lib/tmdb-image-utils";
import type { FileCounts, SyncStatus } from "@/lib/types";
import type { ItemMenuActions } from "@/components/items/item-context-menu";
import { ItemMoreButton } from "@/components/items/item-more-button";

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
  /** TMDB poster path for CDN thumbnail (takes precedence over artworkId). */
  tmdbPosterPath?: string | null;
  /** Artwork file ID for optional poster thumbnail display. */
  artworkId?: string | null;
  /** Whether to show thumbnail. Defaults to false for backward compatibility. */
  showThumbnail?: boolean;
  /** Google Drive folder ID — shows cloud icon when linked. */
  driveFileId?: string | null;
  /** Props for the more options dropdown menu (view mode only). */
  moreMenuProps?: ItemMenuActions;
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
      tmdbPosterPath,
      artworkId,
      showThumbnail = false,
      driveFileId,
      // Destructure to prevent passing to DOM element via ...props
      description,
      showDescription: _showDescription,
      fileCounts: _fileCounts,
      showStats: _showStats,
      mediaIconType: _mediaIconType,
      moreMenuProps,
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
        data-testid={`item-tree-${slugify(value)}`}
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
          role={handleClick && !ghost ? "button" : undefined}
          tabIndex={handleClick && !ghost ? 0 : undefined}
          onKeyDown={
            handleClick && !ghost
              ? (e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleClick();
                  }
                }
              : undefined
          }
          className={cn(
            // Glassmorphism base styling
            "group relative flex items-center gap-2 rounded-lg px-3 py-2",
            "bg-white/[0.03] backdrop-blur-sm",
            "border border-white/[0.04]",
            "transition-[color,background-color,border-color,opacity] duration-200 ease-out",
            "hover:border-white/[0.08] hover:bg-white/[0.06]",
            "focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none",
            clone && [
              "shadow-xl ring-2 shadow-black/20 ring-white/50",
              "bg-white/[0.06] backdrop-blur-md",
              "scale-[1.02]",
            ],
            ghost &&
              indicator && [
                "h-1.5 rounded-full border-white/30 bg-white/20 px-0 py-0",
                "before:absolute before:top-1/2 before:-left-1.5 before:-translate-y-1/2",
                "before:bg-background before:size-2.5 before:rounded-full before:border-2 before:border-white/50",
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
              className="data-[state=checked]:border-primary data-[state=checked]:bg-primary size-4 flex-shrink-0 border-white/30"
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
                "text-[var(--tertiary-foreground)] transition-colors duration-150",
                "hover:text-muted-foreground hover:bg-white/10",
                "focus-visible:ring-1 focus-visible:ring-white focus-visible:outline-none",
                "cursor-grab active:cursor-grabbing"
              )}
              {...handleProps}
            >
              <FontAwesomeIcon
                icon={faGripVertical}
                className="size-3.5"
                aria-hidden="true"
              />
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
                "flex-shrink-0 cursor-pointer rounded-md",
                "flex size-6 items-center justify-center",
                "text-[var(--tertiary-foreground)] transition-colors duration-150",
                "hover:text-muted-foreground hover:bg-white/10",
                "focus-visible:ring-1 focus-visible:ring-white focus-visible:outline-none"
              )}
            >
              <FontAwesomeIcon
                icon={faChevronRight}
                className={cn(
                  "size-4 transition-transform duration-200 ease-out",
                  !collapsed && "rotate-90"
                )}
                aria-hidden="true"
              />
            </button>
          )}

          {/* Optional Thumbnail */}
          {!ghost &&
            showThumbnail &&
            (() => {
              const thumbnailSrc = tmdbPosterPath
                ? getTmdbPosterUrl(tmdbPosterPath, "w500")
                : artworkId
                  ? `/api/artwork/${artworkId}`
                  : null;
              return (
                <div
                  className={cn(
                    "relative flex-shrink-0 overflow-hidden rounded-md",
                    "h-12 w-8 md:h-14 md:w-10",
                    "bg-white/[0.05]"
                  )}
                >
                  {thumbnailSrc ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thumbnailSrc}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <FontAwesomeIcon
                        icon={faFolder}
                        className="size-4 text-[var(--tertiary-foreground)]"
                        aria-hidden="true"
                      />
                    </div>
                  )}
                </div>
              );
            })()}

          {/* Item Name and Progress */}
          {!ghost && (
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span
                  className={cn(
                    "truncate text-sm font-semibold tracking-tight",
                    "text-foreground",
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
                    <span className="text-xs text-[var(--tertiary-foreground)]">
                      •
                    </span>
                    <span className="text-xs whitespace-nowrap text-[var(--tertiary-foreground)]">
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
              {/* Description - only in view mode */}
              {description && !showDragHandle && (
                <p className="mt-1 line-clamp-1 text-xs text-[var(--tertiary-foreground)]">
                  {description}
                </p>
              )}
              {/* Progress bar - only in view mode */}
              {!showDragHandle && progressPercentage !== null && (
                <div className="mt-2">
                  <ProgressBar progress={progressPercentage ?? 0} compact />
                </div>
              )}
            </div>
          )}

          {/* More Options Button - visually hidden, kept in DOM for Playwright */}
          {!ghost && !showDragHandle && moreMenuProps && (
            <div className="pointer-events-none absolute size-0 opacity-0">
              <ItemMoreButton {...moreMenuProps} />
            </div>
          )}

          {/* Drive sync indicator — visible when item is linked to Google Drive */}
          {!ghost &&
            !showDragHandle &&
            driveFileId &&
            (!syncStatus || syncStatus === "SYNCED") && (
              <div className="flex size-7 flex-shrink-0 items-center justify-center">
                <SyncIcon driveFileId={driveFileId} syncStatus={syncStatus} />
              </div>
            )}

          {/* Child Count Badge (for clone/drag overlay) */}
          {clone && childCount !== undefined && childCount > 1 ? (
            <span
              className={cn(
                "absolute -top-2 -right-2 z-10",
                "flex items-center justify-center",
                "size-5 rounded-full",
                "bg-primary text-background",
                "text-xs font-semibold",
                "shadow-md shadow-black/30",
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
