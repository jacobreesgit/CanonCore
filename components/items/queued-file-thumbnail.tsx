/**
 * Thumbnail component for queued files with selection state.
 * Used by PosterSelectionStep and HeroSelectionStep in upload mode.
 */

"use client";

import { useState, useEffect, useMemo } from "react";
import { motion } from "motion/react";
import Image from "next/image";
import { Check, X, ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";
import type { QueuedFile } from "@/lib/types";

/**
 * Props for queued file thumbnail.
 */
export interface QueuedFileThumbnailProps {
  /** The queued file to display */
  file: QueuedFile;
  /** Index for staggered animation delay */
  index: number;
  /** Whether this thumbnail is currently selected */
  isSelected: boolean;
  /** Whether the parent step is skipped */
  isSkipped: boolean;
  /** Whether interactions are disabled */
  disabled: boolean;
  /** Callback when thumbnail is clicked */
  onClick: () => void;
  /** Callback when remove button is clicked */
  onRemove: () => void;
  /** Aspect ratio variant - poster (2:3) or backdrop (16:9) */
  aspectRatio: "poster" | "backdrop";
}

/**
 * Thumbnail component for queued files with selection state.
 * Displays image preview with selection highlight and remove button.
 *
 * @param file - The queued file to display
 * @param index - Index for staggered animation delay
 * @param isSelected - Whether this thumbnail is selected
 * @param isSkipped - Whether the step is skipped
 * @param disabled - Whether interactions are disabled
 * @param onClick - Click handler for selection
 * @param onRemove - Click handler for removal
 * @param aspectRatio - Aspect ratio variant (poster or backdrop)
 */
export function QueuedFileThumbnail({
  file,
  index,
  isSelected,
  isSkipped,
  disabled,
  onClick,
  onRemove,
  aspectRatio,
}: QueuedFileThumbnailProps) {
  const [hasError, setHasError] = useState(false);

  // Create object URL for preview - memoized to avoid recreating on every render
  const objectUrl = useMemo(() => URL.createObjectURL(file.file), [file.file]);

  // Clean up object URL when component unmounts or file changes
  useEffect(() => {
    return () => URL.revokeObjectURL(objectUrl);
  }, [objectUrl]);

  const aspectClass =
    aspectRatio === "poster" ? "aspect-[2/3]" : "aspect-video";
  const imageSizes = aspectRatio === "poster" ? "150px" : "200px";

  if (hasError) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.15, delay: index * 0.03 }}
        className={cn(
          "bg-muted relative flex flex-col items-center justify-center gap-1 rounded-lg border p-2",
          aspectClass
        )}
      >
        <ImageOff className="text-muted-foreground/50 size-5" />
        <span className="text-muted-foreground max-w-full truncate text-xs">
          {file.file.name}
        </span>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.15, delay: index * 0.03 }}
      className="group relative"
    >
      <button
        type="button"
        onClick={onClick}
        disabled={disabled || isSkipped}
        className={cn(
          "relative w-full overflow-hidden rounded-lg transition-[transform,opacity,box-shadow] duration-200",
          aspectClass,
          "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
          isSelected &&
            !isSkipped && [
              "ring-offset-background ring-2 ring-amber-500 ring-offset-2",
              "shadow-[0_0_20px_rgba(245,158,11,0.3)]",
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
        <Image
          src={objectUrl}
          alt={file.file.name}
          fill
          className="object-cover"
          sizes={imageSizes}
          onError={() => setHasError(true)}
        />

        {/* Selection checkmark overlay */}
        {isSelected && !isSkipped && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <div className="flex size-8 items-center justify-center rounded-full bg-amber-500 shadow-lg">
              <Check className="size-5 text-white" />
            </div>
          </div>
        )}

        {/* Filename badge */}
        <div className="absolute right-1 bottom-1 left-1">
          <span className="block truncate rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white/90">
            {file.file.name}
          </span>
        </div>

        {/* Hover overlay */}
        {!isSelected && !isSkipped && !disabled && (
          <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/10" />
        )}
      </button>

      {/* Remove button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        disabled={disabled}
        className={cn(
          "absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full",
          "bg-destructive text-destructive-foreground opacity-0 shadow-md transition-opacity",
          "hover:bg-destructive/90",
          "group-hover:opacity-100",
          disabled && "pointer-events-none"
        )}
        aria-label={`Remove ${file.file.name}`}
      >
        <X className="size-3" />
      </button>
    </motion.div>
  );
}
