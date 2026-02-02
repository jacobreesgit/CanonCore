/**
 * Wizard step for selecting hero/backdrop artwork from TMDB or uploads.
 * Thin wrapper around ArtworkSelectionStep with hero-specific configuration.
 */

"use client";

import { ArtworkSelectionStep } from "./artwork-selection-step";
import type { ExistingArtworkFile } from "./image-selection-grid";
import type { TMDBImage } from "@/lib/tmdb-client";
import type { QueuedFile, ArtworkSelectionSource } from "@/lib/types";

interface HeroSelectionStepProps {
  /** TMDB backdrop images sorted by vote average */
  backdrops: TMDBImage[];
  /** Existing uploaded artwork files (for non-upload mode) */
  existingFiles?: ExistingArtworkFile[];
  /** Currently selected backdrop path or file ID */
  selectedValue: string | null;
  /** Selection source */
  selectedSource: ArtworkSelectionSource | null;
  /** Callback when selection changes */
  onSelect: (value: string | null, source: ArtworkSelectionSource) => void;
  /** Whether hero selection is skipped */
  isSkipped: boolean;
  /** Callback when skip state changes */
  onSkipChange: (skipped: boolean) => void;
  /** Whether step is disabled */
  disabled?: boolean;
  /** Enable upload mode for new items (no existing files) */
  uploadMode?: boolean;
  /** Queued hero files (required when uploadMode=true) */
  queuedHero?: QueuedFile[];
  /** Callback when queued hero changes */
  onQueueHeroChange?: (files: QueuedFile[]) => void;
  /** Whether Drive connection exists */
  hasDriveConnection?: boolean;
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
 * @param uploadMode - Enable upload mode for new items
 * @param queuedHero - Queued files when in upload mode
 * @param onQueueHeroChange - Callback for queued files changes
 * @param hasDriveConnection - Whether Drive is connected
 */
export function HeroSelectionStep({
  backdrops,
  existingFiles,
  selectedValue,
  selectedSource,
  onSelect,
  isSkipped,
  onSkipChange,
  disabled,
  uploadMode,
  queuedHero,
  onQueueHeroChange,
  hasDriveConnection,
}: HeroSelectionStepProps) {
  return (
    <ArtworkSelectionStep
      type="backdrop"
      images={backdrops}
      existingFiles={existingFiles}
      selectedValue={selectedValue}
      selectedSource={selectedSource}
      onSelect={onSelect}
      isSkipped={isSkipped}
      onSkipChange={onSkipChange}
      disabled={disabled}
      uploadMode={uploadMode}
      queuedFiles={queuedHero}
      onQueueFilesChange={onQueueHeroChange}
      hasDriveConnection={hasDriveConnection}
    />
  );
}
