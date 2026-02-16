/**
 * Grid item card component with glassmorphism aesthetic.
 * Hover-reveal pattern: title visible by default, full overlay appears on hover.
 * Matches demo-interactive-poster-card.tsx design.
 */

"use client";

import React, { forwardRef, useCallback, HTMLAttributes } from "react";
import Link from "next/link";
import type { UniqueIdentifier } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import { slugify } from "@/lib/slugify";
import { GripVertical, User, Check } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useImageLoaded } from "@/hooks/use-image-loaded";
import { useLazyImage } from "@/hooks/use-lazy-image";
import { SyncIcon } from "@/components/items/sync-badge";
import { UserThumbnail } from "@/components/search/user-thumbnail";
import { ProgressBar } from "@/components/ui/progress-bar";
import { getTmdbPosterUrl } from "@/lib/tmdb-image-utils";
import type { SyncStatus } from "@/lib/types";
import type { ItemMenuActions } from "@/components/items/item-context-menu";
import { ItemMoreButton } from "@/components/items/item-more-button";

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
  /** TMDB poster path for CDN display (takes precedence over artworkId). */
  tmdbPosterPath?: string | null;
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
  /** Whether this item belongs to the current user. Shows badge in non-edit mode. */
  isOwn?: boolean;
  /** Whether the current user has forked this item. Shows badge in non-edit mode. */
  isForked?: boolean;
  /** Props for the more options dropdown menu (view mode only). */
  moreMenuProps?: ItemMenuActions;
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
      tmdbPosterPath,
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
      isOwn,
      isForked,
      moreMenuProps,
      ...props
    },
    ref
  ) {
    const artworkSrc = tmdbPosterPath
      ? (getTmdbPosterUrl(tmdbPosterPath) ?? undefined)
      : artworkId
        ? `/api/artwork/${artworkId}`
        : undefined;
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
    const shouldShowArtwork =
      showArtwork && (tmdbPosterPath || artworkId) && !imageError;
    const shouldShowDescription =
      showDescription && description && !handleProps;
    const shouldShowWatched =
      watchedCount !== undefined &&
      totalMediaCount !== undefined &&
      totalMediaCount > 0 &&
      !handleProps; // Hide in edit mode
    const showProgress = progressPercentage !== null && !handleProps;
    const showOwner = ownerLabel && !handleProps;

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

    // In edit mode (handleProps), don't use role="button" to avoid nested interactive
    // elements (checkbox and drag handle are inside). The card is still clickable
    // for selection, but keyboard users use Tab to reach the checkbox directly.
    const isEditMode = !!handleProps;
    const hasNestedInteractive = isEditMode || !!ownerHref;

    // Build accessibility props conditionally
    // When there are nested interactive elements, don't use role="button" to avoid a11y violations
    const a11yProps = hasNestedInteractive
      ? {}
      : {
          role: "button" as const,
          tabIndex: 0,
          "aria-label": name,
          onKeyDown: handleKeyDown,
        };

    return (
      <div
        ref={combinedRef}
        data-id={String(id)}
        data-testid={`item-card-${slugify(name)}`}
        onClick={handleClick}
        {...a11yProps}
        className={cn(
          // Base styles - poster aspect ratio
          "group relative w-full cursor-pointer overflow-hidden rounded-lg",
          "aspect-[2/3]",
          // Background color (shown until image loads)
          "bg-card",
          // Hover/focus effects - disabled during drag
          !isDragging &&
            !isOverlay && [
              "transition-all duration-300 ease-out",
              "hover:z-10 hover:scale-105",
              "hover:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)]",
              "active:scale-[0.98] active:transition-transform active:duration-100",
            ],
          // Focus styles for accessibility
          "focus-visible:z-10 focus-visible:scale-105",
          "focus-visible:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)]",
          "focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black focus-visible:outline-none",
          // Drag states - select-none prevents text selection during drag
          isDragging && "scale-[0.98] opacity-40 select-none",
          isOverlay && [
            "shadow-2xl ring-2 shadow-black/25 ring-white/50",
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
            width={200}
            height={300}
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

        {/* Fallback gradient when no artwork - shows first letter */}
        {!shouldShowArtwork && (
          <div
            className={cn(
              "absolute inset-0 z-0",
              "flex items-center justify-center",
              "from-card to-background bg-gradient-to-br"
            )}
          >
            <span className="text-4xl font-bold text-white/20">
              {name.charAt(0).toUpperCase()}
            </span>
          </div>
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
            <GripVertical
              className="size-5"
              strokeWidth={2.5}
              aria-hidden="true"
            />
          </button>
        )}

        {/* Ownership/fork badge - top left, non-edit mode only */}
        {!isEditMode && (isOwn || isForked) && (
          <div
            className={cn(
              "absolute top-2 left-2 z-30",
              "flex items-center gap-1",
              "rounded-full px-1.5 py-0.5",
              "bg-black/50 backdrop-blur-sm",
              "text-[10px] font-medium text-white/70"
            )}
            aria-label={isOwn ? "Your item" : "In your library"}
          >
            {isOwn ? (
              <User className="size-2.5" aria-hidden="true" />
            ) : (
              <Check className="size-2.5 text-green-400" aria-hidden="true" />
            )}
            <span>{isOwn ? "Yours" : "In Library"}</span>
          </div>
        )}

        {/* DEFAULT VIEW: Small gradient + title (HIDES on hover) */}
        <div
          className={cn(
            "absolute inset-x-0 bottom-0 z-10",
            "transition-opacity duration-200",
            !isEditMode && "group-hover:opacity-0 group-focus-visible:opacity-0"
          )}
        >
          {/* Small gradient */}
          <div
            className="h-16"
            style={{
              background:
                "linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 100%)",
            }}
            aria-hidden="true"
          />
          {/* Title only */}
          <div className="absolute inset-x-0 bottom-0 p-2 md:p-3">
            <div className="flex items-center gap-1.5">
              <h3
                className={cn(
                  "min-w-0 truncate text-xs font-semibold tracking-tight",
                  "text-white drop-shadow-lg",
                  "md:text-sm"
                )}
              >
                {name}
              </h3>
              {syncStatus && syncStatus !== "SYNCED" && (
                <SyncIcon syncStatus={syncStatus} className="flex-shrink-0" />
              )}
            </div>
          </div>
        </div>

        {/* HOVER VIEW: Full overlay with all info (SHOWS on hover) */}
        {!isEditMode && (
          <div
            className={cn(
              "absolute inset-0 z-20 flex flex-col justify-end p-2 md:p-3",
              "opacity-0 transition-opacity duration-200",
              "group-hover:opacity-100 group-focus-visible:opacity-100"
            )}
            style={{ background: "var(--gradient-card)" }}
            aria-hidden="true"
          >
            {/* Owner info */}
            {showOwner &&
              (ownerHref ? (
                <Link
                  href={ownerHref}
                  tabIndex={-1}
                  onClick={(e) => e.stopPropagation()}
                  className="mb-1 flex items-center gap-1.5 text-xs text-white/50 hover:text-white/70"
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
                  <span className="truncate">{ownerLabel}</span>
                </Link>
              ) : (
                <p className="mb-1 text-xs text-white/50">{ownerLabel}</p>
              ))}

            {/* Title */}
            <div className="flex items-center gap-1.5">
              <h3
                className={cn(
                  "min-w-0 truncate text-xs font-semibold tracking-tight",
                  "text-white",
                  "md:text-sm"
                )}
              >
                {name}
              </h3>
              {syncStatus && syncStatus !== "SYNCED" && (
                <SyncIcon syncStatus={syncStatus} className="flex-shrink-0" />
              )}
            </div>

            {/* Description */}
            {shouldShowDescription && (
              <p className="mt-1 line-clamp-2 text-xs text-white/60">
                {description}
              </p>
            )}

            {/* Progress bar */}
            {showProgress && (
              <div className="mt-2">
                <ProgressBar progress={progressPercentage ?? 0} compact />
                {/* Watched count label */}
                {shouldShowWatched && (
                  <span className="mt-1 block text-xs text-white/40 tabular-nums">
                    {watchedCount}/{totalMediaCount} watched
                    {totalItems !== undefined &&
                      totalItems > totalMediaCount && <> (of {totalItems})</>}
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* More Options Button - view mode only, top right, above hover overlay */}
        {!isEditMode && moreMenuProps && (
          <div
            className={cn(
              "absolute top-2 right-2 z-30",
              "opacity-0 group-focus-within:opacity-100 group-hover:opacity-100",
              "transition-opacity duration-150"
            )}
          >
            <ItemMoreButton {...moreMenuProps} />
          </div>
        )}
      </div>
    );
  }
);
