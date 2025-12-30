/**
 * Grid item card component for sortable grid view.
 * Displays folder with refined hover states and smooth transitions.
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
          "group relative flex cursor-pointer flex-col items-center justify-center gap-3",
          "bg-card rounded-xl border p-5",
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
        {/* Folder Icon with subtle gradient effect */}
        <div
          className={cn(
            "relative flex items-center justify-center",
            "size-14 rounded-lg",
            "from-muted/80 to-muted bg-gradient-to-br",
            "transition-all duration-200",
            "group-hover:from-primary/10 group-hover:to-primary/5",
            "group-hover:shadow-sm"
          )}
        >
          <Folder
            className={cn(
              "size-8 transition-colors duration-200",
              "text-muted-foreground/70",
              "group-hover:text-primary/80"
            )}
            strokeWidth={1.5}
          />
        </div>

        {/* Folder Name */}
        <span
          className={cn(
            "w-full truncate px-1 text-center text-sm font-medium",
            "text-foreground/85 transition-colors duration-150",
            "group-hover:text-foreground"
          )}
        >
          {name}
        </span>

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
