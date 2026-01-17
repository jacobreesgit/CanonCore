/**
 * Grid item card component with Feature222 aesthetic.
 * Full background image with dark overlay, content overlaid at bottom.
 * Displays name, description, and file counts.
 */

"use client";

import React, { forwardRef, useCallback, HTMLAttributes } from "react";
import type { UniqueIdentifier } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import { Folder, GripVertical, Play } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useImageLoaded } from "@/hooks/use-image-loaded";
import { useLazyImage } from "@/hooks/use-lazy-image";
import { ItemStats } from "@/components/items/item-stats";
import { SyncIcon } from "@/components/items/sync-badge";
import type { FileCounts, SyncStatus } from "@/lib/types";

export interface GridItemProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "id"
> {
  id: UniqueIdentifier;
  name: string;
  /** Optional short description (max 200 chars). */
  description?: string | null;
  isDragging?: boolean;
  isOverlay?: boolean;
  handleProps?: Record<string, unknown>;
  onClick?(): void;
  /** Artwork file ID for thumbnail display. */
  artworkId?: string | null;
  /** Whether to show artwork thumbnail. Defaults to true. */
  showArtwork?: boolean;
  /** Whether to show description. Defaults to true. Hidden in edit mode. */
  showDescription?: boolean;
  /** Whether to show file/child counts. Defaults to true. Hidden in edit mode. */
  showCounts?: boolean;
  /** File counts by type for display. */
  fileCounts?: FileCounts;
  /** Number of child items (subfolders). */
  childCount?: number;
  /** Sync status for displaying indicator. */
  syncStatus?: SyncStatus;
  /** Primary media filename for "now playing" display. */
  primaryMediaName?: string | null;
  /** Media icon type: film (all video), music (all audio), mixed (both). */
  mediaIconType?: "film" | "music" | "mixed" | null;
  /** Load image immediately without waiting for viewport. */
  priority?: boolean;
  /** Whether the item is selected (for bulk operations). */
  isSelected?: boolean;
  /** Callback when selection state changes. */
  onSelectChange?: (selected: boolean) => void;
}

export const GridItem = forwardRef<HTMLDivElement, GridItemProps>(
  function GridItem(
    {
      id,
      name,
      description,
      isDragging,
      isOverlay,
      handleProps,
      onClick,
      className,
      style,
      artworkId,
      showArtwork = true,
      showDescription = true,
      showCounts = true,
      fileCounts,
      childCount,
      syncStatus,
      primaryMediaName,
      mediaIconType,
      priority = false,
      isSelected,
      onSelectChange,
      ...props
    },
    ref
  ) {
    const artworkSrc = artworkId ? `/api/artwork/${artworkId}` : undefined;
    const shouldShowCheckbox = handleProps && onSelectChange;

    // Lazy loading - priority items load immediately, others wait for viewport
    const { ref: lazyRef, shouldLoad } = useLazyImage({
      priority,
      rootMargin: "200px",
    });

    // Combine forwarded ref with lazy loading ref
    const combinedRef = useCallback(
      (node: HTMLDivElement | null) => {
        if (typeof ref === "function") {
          ref(node);
        } else if (ref) {
          ref.current = node;
        }
        lazyRef(node);
      },
      [ref, lazyRef]
    );

    const {
      ref: imgRef,
      loaded: imageLoaded,
      error: imageError,
      onLoad,
      onError,
    } = useImageLoaded(artworkSrc);
    const shouldShowArtwork = showArtwork && artworkId && !imageError;
    const shouldShowDescription = showDescription && description;
    const shouldShowCounts = showCounts;
    const shouldShowPrimaryMedia = primaryMediaName && !handleProps; // Hide in edit mode

    // In select mode, clicking the item toggles selection instead of navigation
    const isSelectMode = !!onSelectChange;
    const handleClick = isSelectMode
      ? () => onSelectChange?.(!isSelected)
      : onClick;
    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleClick?.();
      }
    };

    return (
      <div
        ref={combinedRef}
        data-id={String(id)}
        onClick={handleClick}
        role="button"
        tabIndex={0}
        aria-label={name}
        onKeyDown={handleKeyDown}
        className={cn(
          // Base styles - Feature222 sizing
          "group relative w-full cursor-pointer overflow-hidden rounded-lg",
          "aspect-[2/3] sm:aspect-square md:aspect-[2/3]",
          // Background color (shown until image loads)
          "bg-muted",
          // Overlay pseudo-element
          "before:absolute before:inset-0 before:z-10 before:bg-black/50",
          "before:transition-all before:duration-300",
          "hover:before:bg-black/30",
          // Focus styles for accessibility
          "focus-visible:ring-primary focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
          // Drag states
          isDragging && "scale-[0.98] opacity-40",
          isOverlay && [
            "ring-primary/50 shadow-2xl ring-2 shadow-black/25",
            "scale-[1.03]",
          ],
          className
        )}
        style={style}
        {...props}
      >
        {/* Artwork image - lazy loaded, uses img element for reliable load tracking */}
        {shouldShowArtwork && shouldLoad && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            ref={imgRef}
            src={artworkSrc}
            alt=""
            className={cn(
              "absolute inset-0 z-0 h-full w-full object-cover",
              "transition-opacity duration-200",
              imageLoaded ? "opacity-100" : "opacity-0"
            )}
            onLoad={onLoad}
            onError={onError}
          />
        )}

        {/* Selection Checkbox - top left, only in edit mode */}
        {shouldShowCheckbox && (
          <div
            className={cn(
              "absolute top-3 left-3 z-30",
              "flex size-8 items-center justify-center",
              "rounded-md",
              "bg-black/40 backdrop-blur-sm",
              "transition-all duration-150",
              "hover:bg-black/60"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <Checkbox
              checked={isSelected}
              onCheckedChange={(checked) => {
                onSelectChange?.(checked === true);
              }}
              aria-label={`Select ${name}`}
              className={cn(
                "data-[state=checked]:bg-primary data-[state=checked]:border-primary border-white/60",
                "data-[state=unchecked]:bg-transparent"
              )}
            />
          </div>
        )}

        {/* Drag Handle - top right, only in edit mode */}
        {handleProps && (
          <button
            type="button"
            aria-label="Drag handle"
            className={cn(
              "absolute top-3 right-3 z-30",
              "flex size-8 items-center justify-center",
              "touch-none rounded-md",
              "bg-black/40 backdrop-blur-sm",
              "text-white/60 transition-all duration-150",
              "hover:bg-black/60 hover:text-white",
              "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
              "cursor-grab active:cursor-grabbing"
            )}
            {...handleProps}
          >
            <GripVertical className="size-5" strokeWidth={2.5} />
          </button>
        )}

        {/* Bottom gradient for text legibility over artwork */}
        {shouldShowArtwork && imageLoaded && (
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-2/3 bg-gradient-to-t from-black/80 via-black/40 to-transparent"
            aria-hidden="true"
          />
        )}

        {/* Fallback gradient when no artwork */}
        {!shouldShowArtwork && (
          <div
            className={cn(
              "absolute inset-0 z-0",
              "flex items-center justify-center",
              "from-muted/80 to-muted bg-gradient-to-br"
            )}
          >
            <Folder
              className="text-muted-foreground/50 size-16"
              strokeWidth={1.5}
            />
          </div>
        )}

        {/* Content overlay - bottom */}
        <div className="relative z-20 flex h-full flex-col justify-end p-4">
          {/* Title with sync indicator */}
          <div className="flex items-center gap-1.5">
            <h3 className="truncate text-lg leading-tight font-semibold text-white drop-shadow-md md:text-xl">
              {name}
            </h3>
            {syncStatus && syncStatus !== "SYNCED" && (
              <SyncIcon syncStatus={syncStatus} className="flex-shrink-0" />
            )}
          </div>

          {/* Description */}
          {shouldShowDescription && (
            <p className="mt-1 line-clamp-2 text-sm text-white/80 drop-shadow-sm">
              {description}
            </p>
          )}

          {/* Primary media indicator - subtle inline display */}
          {shouldShowPrimaryMedia && (
            <span className="mt-1.5 flex items-center gap-1.5 text-sm text-white/60">
              <Play className="size-3 shrink-0 fill-current opacity-70" />
              <span className="truncate">{primaryMediaName}</span>
            </span>
          )}

          {/* Stats row */}
          {shouldShowCounts && (
            <div className="mt-3" data-testid="grid-item-stats">
              <ItemStats
                childCount={childCount}
                fileCounts={fileCounts}
                mediaIconType={mediaIconType}
                variant="overlay"
                showEmpty
              />
            </div>
          )}
        </div>
      </div>
    );
  }
);
