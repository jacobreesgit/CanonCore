/**
 * Wizard step for selecting poster artwork from TMDB or uploads.
 * Thin wrapper around ArtworkSelectionStep with poster-specific configuration.
 */

"use client";

import { ArtworkSelectionStep } from "./artwork-selection-step";
import type { ExistingArtworkFile } from "./image-selection-grid";
import type { TMDBImage } from "@/lib/tmdb-client";
import type { QueuedFile, ArtworkSelectionSource } from "@/lib/types";

interface PosterSelectionStepProps {
  /** TMDB poster images sorted by vote average */
  posters: TMDBImage[];
  /** Existing uploaded artwork files (for non-upload mode) */
  existingFiles?: ExistingArtworkFile[];
  /** Currently selected poster path or file ID */
  selectedValue: string | null;
  /** Selection source */
  selectedSource: ArtworkSelectionSource | null;
  /** Callback when selection changes */
  onSelect: (value: string | null, source: ArtworkSelectionSource) => void;
  /** Whether poster selection is skipped */
  isSkipped: boolean;
  /** Callback when skip state changes */
  onSkipChange: (skipped: boolean) => void;
  /** Whether step is disabled */
  disabled?: boolean;
  /** Enable upload mode for new items (no existing files) */
  uploadMode?: boolean;
  /** Queued artwork files (required when uploadMode=true) */
  queuedArtwork?: QueuedFile[];
  /** Callback when queued artwork changes */
  onQueueArtworkChange?: (files: QueuedFile[]) => void;
  /** Whether Drive connection exists */
  hasDriveConnection?: boolean;
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
 * @param uploadMode - Enable upload mode for new items
 * @param queuedArtwork - Queued files when in upload mode
 * @param onQueueArtworkChange - Callback for queued files changes
 * @param hasDriveConnection - Whether Drive is connected
 */
export function PosterSelectionStep({
  posters,
  existingFiles,
  selectedValue,
  selectedSource,
  onSelect,
  isSkipped,
  onSkipChange,
  disabled,
  uploadMode,
  queuedArtwork,
  onQueueArtworkChange,
  hasDriveConnection,
}: PosterSelectionStepProps) {
  return (
    <ArtworkSelectionStep
      type="poster"
      images={posters}
      existingFiles={existingFiles}
      selectedValue={selectedValue}
      selectedSource={selectedSource}
      onSelect={onSelect}
      isSkipped={isSkipped}
      onSkipChange={onSkipChange}
      disabled={disabled}
      uploadMode={uploadMode}
      queuedFiles={queuedArtwork}
      onQueueFilesChange={onQueueArtworkChange}
      hasDriveConnection={hasDriveConnection}
    />
  );
}
