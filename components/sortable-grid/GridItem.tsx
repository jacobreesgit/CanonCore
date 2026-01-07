/**
 * Grid item card component with Feature222 aesthetic.
 * Full background image with dark overlay, content overlaid at bottom.
 * Displays name, description, file counts, and connection badges.
 */

"use client";

import React, { forwardRef, HTMLAttributes, useState } from "react";
import type { UniqueIdentifier } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import { Folder, GripVertical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ItemStats } from "@/components/items/item-stats";
import type { FileCounts } from "@/lib/types";

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
  /** SFTP path if linked to remote server. */
  sftpPath?: string | null;
  /** Artwork file ID for thumbnail display. */
  artworkId?: string | null;
  /** Whether to show artwork thumbnail. Defaults to true. */
  showArtwork?: boolean;
  /** Whether to show description. Defaults to true. Hidden in edit mode. */
  showDescription?: boolean;
  /** Whether to show file/child counts. Defaults to true. Hidden in edit mode. */
  showCounts?: boolean;
  /** Connection name for badge display. */
  connectionName?: string | null;
  /** Whether to show connection badge. Defaults to true. */
  showConnectionBadge?: boolean;
  /** File counts by type for display. */
  fileCounts?: FileCounts;
  /** Number of child items (subfolders). */
  childCount?: number;
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
      connectionName,
      showConnectionBadge = true,
      fileCounts,
      childCount,
      sftpPath: _sftpPath, // eslint-disable-line @typescript-eslint/no-unused-vars
      ...props
    },
    ref
  ) {
    const [imageError, setImageError] = useState(false);
    const shouldShowArtwork = showArtwork && artworkId && !imageError;
    const shouldShowDescription = showDescription && description;
    const shouldShowCounts = showCounts;

    // Build accessible label
    const ariaLabel = connectionName
      ? `${name}, synced from ${connectionName}`
      : name;

    return (
      <div
        ref={ref}
        data-id={String(id)}
        onClick={onClick}
        role="button"
        tabIndex={0}
        aria-label={ariaLabel}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick?.();
          }
        }}
        className={cn(
          // Base styles - Feature222 sizing
          "group relative w-full cursor-pointer overflow-hidden rounded-lg",
          "aspect-[2/3] sm:aspect-square md:aspect-[2/3]",
          // Background and overlay
          "bg-black/80 bg-cover bg-center bg-no-repeat",
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
        style={{
          ...style,
          backgroundImage: shouldShowArtwork
            ? `url(/api/artwork/${artworkId})`
            : undefined,
        }}
        {...props}
      >
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

        {/* Hidden img for error detection - browser caches so minimal overhead */}
        {showArtwork && artworkId && !imageError && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/artwork/${artworkId}`}
            alt=""
            className="hidden"
            onError={() => setImageError(true)}
          />
        )}

        {/* Bottom gradient for text legibility over artwork */}
        {shouldShowArtwork && (
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

        {/* Connection badge - top left */}
        {connectionName && showConnectionBadge && (
          <Badge
            variant="secondary"
            className="absolute top-3 left-3 z-20 text-xs"
          >
            {connectionName}
          </Badge>
        )}

        {/* Content overlay - bottom */}
        <div className="relative z-20 flex h-full flex-col justify-end p-4">
          {/* Title */}
          <h3 className="text-lg leading-tight font-semibold text-white drop-shadow-md md:text-xl">
            {name}
          </h3>

          {/* Description */}
          {shouldShowDescription && (
            <p className="mt-1 line-clamp-2 text-sm text-white/80 drop-shadow-sm">
              {description}
            </p>
          )}

          {/* Stats row */}
          {shouldShowCounts && (
            <div className="mt-3" data-testid="grid-item-stats">
              <ItemStats
                childCount={childCount}
                fileCounts={fileCounts}
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
