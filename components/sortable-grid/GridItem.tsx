/**
 * Grid item card component for sortable grid view.
 * Displays item container with refined hover states and smooth transitions.
 */

"use client";

import React, { forwardRef, HTMLAttributes } from "react";
import type { UniqueIdentifier } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import { Folder } from "lucide-react";

export interface GridItemProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "id"
> {
  id: UniqueIdentifier;
  name: string;
  isDragging?: boolean;
  isOverlay?: boolean;
  handleProps?: Record<string, unknown>;
  onClick?(): void;
  /** SFTP path if linked to remote server. */
  sftpPath?: string | null;
  /** Artwork file ID for thumbnail display. */
  artworkId?: string | null;
}

export const GridItem = forwardRef<HTMLDivElement, GridItemProps>(
  function GridItem(
    {
      id,
      name,
      isDragging,
      isOverlay,
      handleProps,
      onClick,
      className,
      style,
      artworkId,
      ...props
    },
    ref
  ) {
    return (
      <div
        ref={ref}
        data-id={String(id)}
        onClick={onClick}
        className={cn(
          "group relative flex cursor-pointer flex-col overflow-hidden",
          "bg-card rounded-xl border",
          "transition-all duration-200 ease-out",
          "hover:bg-accent/40 hover:border-accent-foreground/20 hover:shadow-md",
          "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
          isDragging && "scale-[0.98] opacity-40",
          isOverlay && [
            "ring-primary/50 shadow-2xl ring-2 shadow-black/25",
            "bg-card/95 backdrop-blur-sm",
            "scale-[1.03]",
            "border-primary/30",
          ],
          className
        )}
        style={style}
        {...handleProps}
        {...props}
      >
        {/* Artwork Thumbnail */}
        {artworkId ? (
          <div className="relative h-24 w-full overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/stream/${artworkId}`}
              alt=""
              className={cn(
                "h-full w-full object-cover",
                "transition-transform duration-300",
                "group-hover:scale-105"
              )}
            />
            <div
              className={cn(
                "absolute inset-0",
                "from-card/60 bg-gradient-to-t via-transparent to-transparent"
              )}
            />
          </div>
        ) : (
          <div
            className={cn(
              "flex h-24 w-full items-center justify-center",
              "from-muted/80 to-muted bg-gradient-to-br"
            )}
          >
            <Folder
              className={cn(
                "size-10 transition-colors duration-200",
                "text-muted-foreground/50",
                "group-hover:text-primary/60"
              )}
              strokeWidth={1.5}
            />
          </div>
        )}

        {/* Item Name */}
        <div className="flex items-center gap-2 p-3">
          <Folder
            className={cn(
              "size-4 shrink-0 transition-colors duration-200",
              "text-muted-foreground/70",
              "group-hover:text-primary/80"
            )}
            strokeWidth={1.75}
          />
          <span
            className={cn(
              "truncate text-sm font-medium",
              "text-foreground/85 transition-colors duration-150",
              "group-hover:text-foreground"
            )}
          >
            {name}
          </span>
        </div>

        {/* Subtle drag indicator on hover */}
        <div
          className={cn(
            "absolute inset-x-0 top-0 h-1 rounded-t-xl",
            "via-primary/0 bg-gradient-to-r from-transparent to-transparent",
            "transition-all duration-200",
            "group-hover:via-primary/30"
          )}
        />
      </div>
    );
  }
);
