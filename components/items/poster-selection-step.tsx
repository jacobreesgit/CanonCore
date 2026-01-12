/**
 * Wizard step for selecting poster artwork from TMDB or uploads.
 * Uses ImageSelectionGrid for the gallery interface.
 */

"use client";

import {
  ImageSelectionGrid,
  type ExistingArtworkFile,
} from "./image-selection-grid";
import type { TMDBImage } from "@/lib/tmdb-client";

interface PosterSelectionStepProps {
  /** TMDB poster images sorted by vote average */
  posters: TMDBImage[];
  /** Existing uploaded artwork files */
  existingFiles?: ExistingArtworkFile[];
  /** Currently selected poster path or file ID */
  selectedValue: string | null;
  /** Selection source */
  selectedSource: "tmdb" | "existing" | null;
  /** Callback when selection changes */
  onSelect: (value: string | null, source: "tmdb" | "existing") => void;
  /** Whether poster selection is skipped */
  isSkipped: boolean;
  /** Callback when skip state changes */
  onSkipChange: (skipped: boolean) => void;
  /** Whether step is disabled */
  disabled?: boolean;
}

/**
 * Poster selection step for the metadata wizard.
 * Displays poster images in a 2:3 aspect ratio grid.
 *
 * @param posters - TMDB poster images
 * @param existingFiles - User's uploaded artwork
 * @param selectedValue - Currently selected poster
 * @param selectedSource - Where the selection came from
 * @param onSelect - Selection change callback
 * @param isSkipped - Whether step is skipped
 * @param onSkipChange - Skip state callback
 * @param disabled - Whether step is disabled
 */
export function PosterSelectionStep({
  posters,
  existingFiles = [],
  selectedValue,
  onSelect,
  isSkipped,
  onSkipChange,
  disabled = false,
}: PosterSelectionStepProps) {
  return (
    <div className="space-y-4">
      <div className="mb-4">
        <h3 className="text-base font-semibold">Select Poster</h3>
        <p className="text-muted-foreground text-sm">
          Choose primary artwork for this item (2:3 portrait)
        </p>
      </div>

      <ImageSelectionGrid
        type="poster"
        tmdbImages={posters}
        existingFiles={existingFiles}
        selectedValue={selectedValue}
        onSelect={onSelect}
        isSkipped={isSkipped}
        onSkipChange={onSkipChange}
        disabled={disabled}
        initialLimit={12}
      />
    </div>
  );
}
