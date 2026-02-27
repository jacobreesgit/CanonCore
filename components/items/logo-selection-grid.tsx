/**
 * Simplified logo selection grid for the artwork change dialog.
 * Renders TMDB logo images with object-contain on a dark background
 * to properly display transparent PNGs. No tabs or skip controls.
 */

"use client";

import { useState, useCallback, useMemo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faImage } from "@fortawesome/free-solid-svg-icons";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { getLogoUrl } from "@/lib/tmdb-client";
import { LogoThumbnail } from "@/components/items/logo-thumbnail";
import type { TMDBImage } from "@/lib/tmdb-client";

interface LogoSelectionGridProps {
  /** TMDB logo images sorted by vote average */
  logos: TMDBImage[];
  /** Currently selected logo path */
  selectedValue: string | null;
  /** Callback when selection changes */
  onSelect: (value: string | null) => void;
  /** Whether the grid is disabled */
  disabled?: boolean;
}

/**
 * Logo image selection grid for the change dialog.
 * Uses object-contain on a dark background for transparent PNGs.
 *
 * @param logos - TMDB logo images
 * @param selectedValue - Currently selected path
 * @param onSelect - Selection change callback
 * @param disabled - Whether grid is disabled
 */
export function LogoSelectionGrid({
  logos,
  selectedValue,
  onSelect,
  disabled = false,
}: LogoSelectionGridProps) {
  const isMobile = useIsMobile();
  const baseLimit = isMobile ? 9 : 8;

  const [displayCount, setDisplayCount] = useState<number | null>(null);
  const effectiveDisplayCount = displayCount ?? baseLimit;

  const displayedLogos = useMemo(() => {
    return logos.slice(0, effectiveDisplayCount);
  }, [logos, effectiveDisplayCount]);

  const hasMoreLogos = logos.length > effectiveDisplayCount;
  const remainingCount = logos.length - effectiveDisplayCount;

  const handleSelect = useCallback(
    (value: string) => {
      if (disabled) return;
      // Toggle off if already selected
      if (selectedValue === value) {
        onSelect(null);
      } else {
        onSelect(value);
      }
    },
    [disabled, selectedValue, onSelect]
  );

  if (logos.length === 0) {
    return (
      <div className="bg-muted/30 flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-12">
        <FontAwesomeIcon
          icon={faImage}
          className="text-muted-foreground/50 size-8"
        />
        <p className="text-muted-foreground text-sm">
          No logos available from TMDB
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {displayedLogos.map((image, index) => (
          <LogoThumbnail
            key={image.file_path}
            src={getLogoUrl(image.file_path, "w300")}
            alt={`Logo option ${index + 1}`}
            isSelected={selectedValue === image.file_path}
            disabled={disabled}
            onClick={() => handleSelect(image.file_path)}
          >
            <span className="rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white/90 tabular-nums">
              {image.width}x{image.height}
            </span>
            {image.iso_639_1 === "en" && (
              <span className="rounded bg-emerald-600/90 px-1.5 py-0.5 text-[10px] font-medium text-white">
                English
              </span>
            )}
          </LogoThumbnail>
        ))}
      </div>

      {hasMoreLogos && (
        <button
          type="button"
          onClick={() =>
            setDisplayCount((prev) => (prev ?? baseLimit) + baseLimit)
          }
          disabled={disabled}
          className={cn(
            "text-muted-foreground hover:text-foreground mt-3 w-full text-center text-sm transition-colors",
            "focus-visible:ring-ring focus-visible:rounded-md focus-visible:ring-2 focus-visible:outline-none",
            "disabled:pointer-events-none disabled:opacity-50"
          )}
        >
          Show {Math.min(baseLimit, remainingCount)} more logos
        </button>
      )}
    </div>
  );
}
