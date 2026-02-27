/**
 * Shared logo thumbnail component used by both the TMDB wizard
 * logo selection step and the artwork change dialog logo grid.
 *
 * Renders a transparent PNG logo with object-contain on a dark
 * background, with selection state, loading placeholder, hover
 * overlay, and customisable badge content via children.
 */

"use client";

import type { ReactNode } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck, faImage } from "@fortawesome/free-solid-svg-icons";
import { useImageLoaded } from "@/hooks/use-image-loaded";
import { cn } from "@/lib/utils";

interface LogoThumbnailProps {
  /** Image source URL, or null for error/missing state */
  src: string | null;
  /** Alt text for the image */
  alt: string;
  /** Whether this thumbnail is currently selected */
  isSelected: boolean;
  /** Whether logo selection is skipped (dims the thumbnail) */
  isSkipped?: boolean;
  /** Whether the thumbnail is disabled */
  disabled: boolean;
  /** Click handler for selection toggle */
  onClick: () => void;
  /** Badge content rendered in the bottom overlay area */
  children?: ReactNode;
}

/**
 * Logo thumbnail with selection state, loading placeholder,
 * and customisable badge content.
 *
 * Uses object-contain on a dark `#0a0a0a` background to properly
 * render transparent PNGs. Supports optional `isSkipped` state
 * for wizard flows where logo selection can be bypassed.
 *
 * @param src - Image URL or null
 * @param alt - Alt text
 * @param isSelected - Selection state
 * @param isSkipped - Whether selection is skipped (defaults to false)
 * @param disabled - Disabled state
 * @param onClick - Click handler
 * @param children - Badge content for the bottom overlay
 */
export function LogoThumbnail({
  src,
  alt,
  isSelected,
  isSkipped = false,
  disabled,
  onClick,
  children,
}: LogoThumbnailProps) {
  const {
    ref,
    loaded: isLoaded,
    error: hasError,
    onLoad,
    onError,
  } = useImageLoaded(src ?? undefined);

  if (!src || hasError) {
    return (
      <div className="flex aspect-video items-center justify-center rounded-lg border bg-[#0a0a0a]">
        <FontAwesomeIcon
          icon={faImage}
          className="text-muted-foreground/50 size-6"
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || isSkipped}
      className={cn(
        "group relative aspect-video overflow-hidden rounded-lg transition-[transform,opacity,box-shadow] duration-200",
        "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
        // Dark background for transparency visibility
        "bg-[#0a0a0a]",
        // Selection states
        isSelected &&
          !isSkipped && [
            "ring-offset-background ring-brand ring-2 ring-offset-2",
            "shadow-[0_0_20px_rgba(255,255,255,0.15)]",
          ],
        !isSelected &&
          !isSkipped &&
          !disabled && [
            "hover:ring-muted-foreground/30 hover:ring-offset-background hover:ring-2 hover:ring-offset-2",
            "hover:scale-[1.02]",
          ],
        isSkipped && "opacity-40",
        disabled && "cursor-not-allowed opacity-50"
      )}
    >
      {/* Image icon placeholder while loading */}
      {!isLoaded && (
        <div className="absolute inset-0 z-0 flex items-center justify-center">
          <FontAwesomeIcon
            icon={faImage}
            className="text-muted-foreground/50 size-8"
          />
        </div>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={ref}
        src={src}
        alt={alt}
        loading="lazy"
        className={cn(
          "absolute inset-0 z-10 h-full w-full object-contain p-3 transition-opacity duration-150",
          isLoaded ? "opacity-100" : "opacity-0"
        )}
        onLoad={onLoad}
        onError={onError}
      />

      {/* Selection checkmark overlay */}
      {isSelected && !isSkipped && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/30">
          <div className="bg-brand flex size-8 items-center justify-center rounded-full shadow-lg">
            <FontAwesomeIcon icon={faCheck} className="size-5 text-white" />
          </div>
        </div>
      )}

      {/* Badge area — render children */}
      {children && (
        <div className="absolute right-1 bottom-1 left-1 z-20 flex items-end justify-between">
          {children}
        </div>
      )}

      {/* Hover overlay for non-selected items */}
      {!isSelected && !isSkipped && !disabled && (
        <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/10" />
      )}
    </button>
  );
}
