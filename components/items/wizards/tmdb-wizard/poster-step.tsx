/**
 * Poster selection step for the TMDB metadata wizard.
 * Wraps PosterSelectionStep with navigation and state management.
 */
"use client";

import { useCallback } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCircleExclamation,
  faArrowLeft,
  faArrowRight,
} from "@fortawesome/free-solid-svg-icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PosterSelectionStep } from "./poster-selection-step";
import type { ArtworkSelectionSource } from "@/lib/types";
import type { TMDBArtworkStepProps } from "./tmdb-wizard-types";
import { toExistingArtworkFile } from "./tmdb-wizard-types";

/**
 * Poster selection step for the TMDB wizard.
 * Displays poster images in a 2:3 aspect ratio grid with skip option.
 *
 * @param data - Wizard data containing images and poster selection
 * @param isLoading - Whether a loading operation is in progress
 * @param error - Current error message
 * @param canGoBack - Whether back navigation is possible
 * @param uploadMode - Whether upload mode is enabled
 * @param hasDriveConnection - Whether user has Google Drive connected
 * @param queuedFiles - Queued artwork files (upload mode)
 * @param onFilesQueue - Callback to queue files
 * @param existingFiles - Existing artwork files (settings mode)
 * @param onNext - Navigate to next step
 * @param onBack - Navigate to previous step
 * @param onDataChange - Update wizard data
 * @param onSkip - Mark step as skipped
 */
export function TMDBPosterStep({
  data,
  isLoading,
  error,
  canGoBack,
  showNavigation = true,
  uploadMode,
  hasDriveConnection,
  queuedFiles = [],
  onFilesQueue,
  existingFiles = [],
  onNext,
  onBack,
  onDataChange,
  onSkip: _onSkip,
}: TMDBArtworkStepProps) {
  // Use seasonImages for seasons, otherwise use regular images
  const posters =
    data.contentType === "season"
      ? (data.seasonImages?.posters ?? [])
      : (data.images?.posters ?? []);
  const poster = data.poster ?? { value: null, source: null, skipped: false };

  /**
   * Handles poster selection change.
   */
  const handleSelect = useCallback(
    (value: string | null, source: ArtworkSelectionSource) => {
      onDataChange({
        poster: {
          value,
          source: value ? source : null,
          skipped: false,
        },
      });
    },
    [onDataChange]
  );

  // Convert SerializedItemFile to ExistingArtworkFile format
  const existingArtworkFiles = existingFiles.map(toExistingArtworkFile);

  return (
    <div className="space-y-6">
      {/* Step header */}
      <div>
        <h3 className="text-foreground text-lg font-semibold">Select Poster</h3>
        <p className="text-muted-foreground text-sm">
          Choose a poster image for this item.
        </p>
      </div>

      {/* Error display */}
      {error && (
        <div
          role="alert"
          aria-live="polite"
          className={cn(
            "border-destructive/50 bg-destructive/10 text-destructive flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
          )}
        >
          <FontAwesomeIcon
            icon={faCircleExclamation}
            className="h-4 w-4 shrink-0"
            aria-hidden="true"
          />
          <span>{error}</span>
        </div>
      )}

      {/* Poster selection content */}
      <PosterSelectionStep
        posters={posters}
        existingFiles={existingArtworkFiles}
        selectedValue={poster.value}
        selectedSource={poster.source}
        onSelect={handleSelect}
        isSkipped={poster.skipped}
        onSkipChange={(skipped) =>
          onDataChange({
            poster: { ...poster, skipped },
          })
        }
        disabled={isLoading}
        uploadMode={uploadMode}
        queuedArtwork={queuedFiles}
        onQueueArtworkChange={onFilesQueue}
        hasDriveConnection={hasDriveConnection}
      />

      {/* Navigation buttons (hidden when parent handles footer) */}
      {showNavigation && (
        <div className="flex justify-between gap-3 pt-2">
          {canGoBack ? (
            <Button
              type="button"
              variant="outline"
              onClick={onBack}
              disabled={isLoading}
            >
              <FontAwesomeIcon
                icon={faArrowLeft}
                className="mr-2 h-4 w-4"
                aria-hidden="true"
              />
              Back
            </Button>
          ) : (
            <div /> /* Spacer for layout */
          )}

          <Button type="button" onClick={() => onNext()} disabled={isLoading}>
            Next
            <FontAwesomeIcon
              icon={faArrowRight}
              className="ml-2 h-4 w-4"
              aria-hidden="true"
            />
          </Button>
        </div>
      )}
    </div>
  );
}
