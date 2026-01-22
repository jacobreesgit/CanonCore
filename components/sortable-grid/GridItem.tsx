/**
 * Grid item card component with Feature222 aesthetic.
 * Full background image with dark overlay, content overlaid at bottom.
 * Displays name, description, and progress.
 */

"use client";

import React, { forwardRef, useCallback, HTMLAttributes } from "react";
import Link from "next/link";
import type { UniqueIdentifier } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import { Folder, GripVertical } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useImageLoaded } from "@/hooks/use-image-loaded";
import { useLazyImage } from "@/hooks/use-lazy-image";
import { SyncIcon } from "@/components/items/sync-badge";
import { UserThumbnail } from "@/components/search/user-thumbnail";
import type { SyncStatus } from "@/lib/types";

export interface GridItemProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "id"
> {
  id: UniqueIdentifier;
  name: string;
  /** Optional item description (TMDB overview, max 200 chars). */
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
  /** Sync status for displaying indicator. */
  syncStatus?: SyncStatus;
  /** Progress percentage (0-100) for item and descendants, null if no media files. */
  progressPercentage?: number | null;
  /** Number of watched (>90% complete) media files. */
  watchedCount?: number;
  /** Total number of media files (item + descendants). */
  totalMediaCount?: number;
  /** Total number of items (item + descendants) for progress label. */
  totalItems?: number;
  /** Load image immediately without waiting for viewport. */
  priority?: boolean;
  /** Whether the item is selected (for bulk operations). */
  isSelected?: boolean;
  /** Callback when selection state changes. */
  onSelectChange?: (selected: boolean) => void;
  /** Owner label to display (e.g., "You" or "@username"). */
  ownerLabel?: string;
  /** Optional URL to make owner label a clickable link. */
  ownerHref?: string;
  /** Owner user ID for displaying profile thumbnail. */
  ownerUserId?: string;
  /** Owner display name for profile thumbnail initials. */
  ownerName?: string | null;
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
      syncStatus,
      progressPercentage,
      watchedCount,
      totalMediaCount,
      totalItems,
      priority = false,
      isSelected,
      onSelectChange,
      ownerLabel,
      ownerHref,
      ownerUserId,
      ownerName,
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
    const shouldShowWatched =
      watchedCount !== undefined &&
      totalMediaCount !== undefined &&
      totalMediaCount > 0 &&
      !handleProps; // Hide in edit mode

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
          "before:transition-colors before:duration-300",
          "hover:before:bg-black/30",
          // Focus styles for accessibility
          "focus-visible:ring-primary focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
          // Drag states - select-none prevents text selection during drag
          isDragging && "scale-[0.98] opacity-40 select-none",
          isOverlay && [
            "ring-primary/50 shadow-2xl ring-2 shadow-black/25",
            "scale-[1.03]",
            "select-none",
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
            loading={priority ? "eager" : "lazy"}
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
              "transition-colors duration-150",
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
              "text-white/60 transition-colors duration-150",
              "hover:bg-black/60 hover:text-white",
              "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
              "cursor-grab active:cursor-grabbing"
            )}
            {...handleProps}
          >
            <GripVertical className="size-5" strokeWidth={2.5} />
          </button>
        )}

        {/* Bottom gradient for text legibility */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-2/3 bg-gradient-to-t from-black/80 via-black/40 to-transparent"
          aria-hidden="true"
        />

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
        <div className="relative z-20 flex h-full flex-col justify-end gap-2.5 p-4">
          {/* Owner info - "You" or profile pic + @username */}
          {ownerLabel &&
            !handleProps &&
            (ownerHref ? (
              <Link
                href={ownerHref}
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1.5 rounded text-xs text-white/70 drop-shadow-sm hover:text-white focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black/50 focus-visible:outline-none"
              >
                {ownerUserId && (
                  <UserThumbnail
                    userId={ownerUserId}
                    name={ownerName ?? null}
                    size="sm"
                    showImage
                    className="ring-1 ring-white/20"
                  />
                )}
                <span className="truncate hover:underline">{ownerLabel}</span>
              </Link>
            ) : (
              <span className="text-xs text-white/70 drop-shadow-sm">
                {ownerLabel}
              </span>
            ))}

          {/* Title and description group */}
          <div className="flex flex-col gap-1">
            {/* Title with sync indicator */}
            <div className="flex items-center gap-1.5">
              <h3 className="min-w-0 truncate text-lg leading-tight font-semibold text-white drop-shadow-md md:text-xl">
                {name}
              </h3>
              {syncStatus && syncStatus !== "SYNCED" && (
                <SyncIcon syncStatus={syncStatus} className="flex-shrink-0" />
              )}
            </div>

            {/* Description - item's TMDB overview */}
            {shouldShowDescription && description && (
              <p className="line-clamp-2 text-sm leading-snug text-white/80 drop-shadow-sm">
                {description}
              </p>
            )}
          </div>

          {/* Progress bar + label */}
          {progressPercentage !== null && !handleProps && (
            <div className="flex flex-col gap-1">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/20 backdrop-blur-sm">
                <div
                  data-testid="grid-item-progress-bar"
                  className="h-full rounded-full bg-white transition-[width] duration-300"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
              {/* Watched count label */}
              {shouldShowWatched && (
                <span className="text-xs text-white/60 tabular-nums">
                  {watchedCount}/{totalMediaCount} watched
                  {totalItems !== undefined && totalItems > totalMediaCount && (
                    <> (of {totalItems})</>
                  )}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }
);
