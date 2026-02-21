/**
 * Hero/backdrop selection step for the TMDB metadata wizard.
 * Wraps HeroSelectionStep with navigation and state management.
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
import { HeroSelectionStep } from "./hero-selection-step";
import type { ArtworkSelectionSource } from "@/lib/types";
import type { TMDBArtworkStepProps } from "./tmdb-wizard-types";
import { toExistingArtworkFile } from "./tmdb-wizard-types";

/**
 * Hero/backdrop selection step for the TMDB wizard.
 * Displays backdrop images in a 16:9 aspect ratio grid with skip option.
 *
 * @param data - Wizard data containing images and backdrop selection
 * @param isLoading - Whether a loading operation is in progress
 * @param error - Current error message
 * @param canGoBack - Whether back navigation is possible
 * @param uploadMode - Whether upload mode is enabled
 * @param hasDriveConnection - Whether user has Google Drive connected
 * @param queuedFiles - Queued hero files (upload mode)
 * @param onFilesQueue - Callback to queue files
 * @param existingFiles - Existing hero files (settings mode)
 * @param onNext - Navigate to next step
 * @param onBack - Navigate to previous step
 * @param onDataChange - Update wizard data
 * @param onSkip - Mark step as skipped
 */
export function TMDBHeroStep({
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
  onSkip,
}: TMDBArtworkStepProps) {
  const images = data.images;
  const backdrop = data.backdrop ?? {
    value: null,
    source: null,
    skipped: false,
  };

  /**
   * Handles backdrop selection change.
   */
  const handleSelect = useCallback(
    (value: string | null, source: ArtworkSelectionSource) => {
      onDataChange({
        backdrop: {
          value,
          source: value ? source : null,
          skipped: false,
        },
      });
    },
    [onDataChange]
  );

  /**
   * Handles skip checkbox toggle.
   */
  const handleSkipChange = useCallback(
    (skipped: boolean) => {
      if (skipped) {
        onSkip();
      } else {
        onDataChange({
          backdrop: {
            value: null,
            source: null,
            skipped: false,
          },
        });
      }
    },
    [onSkip, onDataChange]
  );

  // Convert SerializedItemFile to ExistingArtworkFile format
  const existingArtworkFiles = existingFiles.map(toExistingArtworkFile);

  return (
    <div className="space-y-6">
      {/* Step header */}
      <div>
        <h3 className="text-foreground text-lg font-semibold">
          Select Hero Image
        </h3>
        <p className="text-muted-foreground text-sm">
          Choose a backdrop image for the hero banner.
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

      {/* Hero selection content */}
      <HeroSelectionStep
        backdrops={images?.backdrops ?? []}
        existingFiles={existingArtworkFiles}
        selectedValue={backdrop.value}
        selectedSource={backdrop.source}
        onSelect={handleSelect}
        isSkipped={backdrop.skipped}
        onSkipChange={handleSkipChange}
        disabled={isLoading}
        uploadMode={uploadMode}
        queuedHero={queuedFiles}
        onQueueHeroChange={onFilesQueue}
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
