/**
 * Wizard step for selecting hero/backdrop artwork from TMDB or uploads.
 * Uses ImageSelectionGrid for the gallery interface.
 */

"use client";

import {
  ImageSelectionGrid,
  type ExistingArtworkFile,
} from "./image-selection-grid";
import type { TMDBImage } from "@/lib/tmdb-client";

interface HeroSelectionStepProps {
  /** TMDB backdrop images sorted by vote average */
  backdrops: TMDBImage[];
  /** Existing uploaded artwork files */
  existingFiles?: ExistingArtworkFile[];
  /** Currently selected backdrop path or file ID */
  selectedValue: string | null;
  /** Selection source */
  selectedSource: "tmdb" | "existing" | null;
  /** Callback when selection changes */
  onSelect: (value: string | null, source: "tmdb" | "existing") => void;
  /** Whether hero selection is skipped */
  isSkipped: boolean;
  /** Callback when skip state changes */
  onSkipChange: (skipped: boolean) => void;
  /** Whether step is disabled */
  disabled?: boolean;
}

/**
 * Hero/backdrop selection step for the metadata wizard.
 * Displays backdrop images in a 16:9 aspect ratio grid.
 *
 * @param backdrops - TMDB backdrop images
 * @param existingFiles - User's uploaded artwork
 * @param selectedValue - Currently selected backdrop
 * @param selectedSource - Where the selection came from
 * @param onSelect - Selection change callback
 * @param isSkipped - Whether step is skipped
 * @param onSkipChange - Skip state callback
 * @param disabled - Whether step is disabled
 */
export function HeroSelectionStep({
  backdrops,
  existingFiles = [],
  selectedValue,
  onSelect,
  isSkipped,
  onSkipChange,
  disabled = false,
}: HeroSelectionStepProps) {
  return (
    <div className="space-y-4">
      <div className="mb-4">
        <h3 className="text-base font-semibold">Select Hero Image</h3>
        <p className="text-muted-foreground text-sm">
          Choose a backdrop for the hero banner (16:9 landscape)
        </p>
      </div>

      <ImageSelectionGrid
        type="backdrop"
        tmdbImages={backdrops}
        existingFiles={existingFiles}
        selectedValue={selectedValue}
        onSelect={onSelect}
        isSkipped={isSkipped}
        onSkipChange={onSkipChange}
        disabled={disabled}
        initialLimit={9}
      />
    </div>
  );
}
