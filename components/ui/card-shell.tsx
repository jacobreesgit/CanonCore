/**
 * Shared visual shell for card components (GridItem, PlaylistGridItem).
 * Presentational only — consumers handle interaction (Link, role="button", etc.).
 * CSS-only hover effects via Tailwind group-hover (no React state).
 */

"use client";

import { forwardRef, type ReactNode, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface CardShellProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "children"
> {
  /** Artwork area (images, collage, fallback icon). */
  children: ReactNode;
  /** Hover overlay content (aria-hidden, shown on group-hover). */
  overlay?: ReactNode;
  /** Always-visible content area (positioned at bottom). */
  defaultContent?: ReactNode;
  /** Additional CSS classes on the outer container. */
  className?: string;
  /** Test ID for the outer container. */
  "data-testid"?: string;
}

export const CardShell = forwardRef<HTMLDivElement, CardShellProps>(
  function CardShell(
    { children, overlay, defaultContent, className, ...props },
    ref
  ) {
    return (
      <div
        ref={ref}
        className={cn(
          // Base styles — poster aspect ratio
          "group/card relative w-full overflow-hidden rounded-lg",
          "aspect-[2/3]",
          // Background colour (shown until image loads)
          "bg-card",
          // Hover/focus effects
          "transition-all duration-300 ease-out",
          "hover:z-10 hover:scale-105",
          "hover:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)]",
          className
        )}
        {...props}
      >
        {/* Artwork area */}
        {children}

        {/* DEFAULT VIEW: Title area (always visible, hides on hover) */}
        {defaultContent && (
          <div
            className={cn(
              "absolute inset-x-0 bottom-0 z-10",
              "transition-opacity duration-200",
              "group-hover/card:opacity-0"
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
            {/* Content */}
            <div className="absolute inset-x-0 bottom-0 p-2 md:p-3">
              {defaultContent}
            </div>
          </div>
        )}

        {/* HOVER VIEW: Full overlay (shows on hover) */}
        {overlay && (
          <div
            className={cn(
              "absolute inset-0 z-20 flex flex-col justify-end p-2 md:p-3",
              "opacity-0 transition-opacity duration-200",
              "group-hover/card:opacity-100"
            )}
            style={{ background: "var(--gradient-card)" }}
            aria-hidden="true"
          >
            {overlay}
          </div>
        )}
      </div>
    );
  }
);
