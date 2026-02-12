/**
 * Still image selection step for the TMDB metadata wizard.
 * Used for episode content to select a still (scene shot) image.
 */
"use client";

import { useCallback } from "react";
import { AlertCircle, ArrowLeft, ArrowRight, ImageOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { ImageSelectionGrid } from "./image-selection-grid";
import type { ArtworkSelectionSource } from "@/lib/types";
import type { TMDBArtworkStepProps } from "./tmdb-wizard-types";
import { toExistingArtworkFile } from "./tmdb-wizard-types";

/**
 * Still image selection step for the TMDB wizard.
 * Displays episode stills in a 16:9 aspect ratio grid with skip option.
 * Used for episode content type.
 *
 * @param data - Wizard data containing episode images and still selection
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
export function TMDBStillStep({
  data,
  isLoading,
  error,
  canGoBack,
  showNavigation = true,
  existingFiles = [],
  onNext,
  onBack,
  onDataChange,
  onSkip,
}: TMDBArtworkStepProps) {
  const episodeImages = data.episodeImages;
  const still = data.still ?? { value: null, source: null, skipped: false };
  const stills = episodeImages?.stills ?? [];

  /**
   * Handles still selection change.
   */
  const handleSelect = useCallback(
    (value: string | null, source: "tmdb" | "existing") => {
      onDataChange({
        still: {
          value,
          source: value ? (source as ArtworkSelectionSource) : null,
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
          still: {
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

  // Check if there are no stills available
  const noStillsAvailable = !isLoading && stills.length === 0;

  return (
    <div className="space-y-6">
      {/* Step header */}
      <div>
        <h3 className="text-foreground text-lg font-semibold">
          Select Still Image
        </h3>
        <p className="text-muted-foreground text-sm">
          Choose a still image from the episode.
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
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {/* No stills available state */}
      {noStillsAvailable && (
        <div className="bg-muted/30 flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-12">
          <ImageOff className="text-muted-foreground/50 size-10" />
          <div className="text-center">
            <p className="text-muted-foreground text-sm font-medium">
              No still images available
            </p>
            <p className="text-muted-foreground/75 mt-1 text-xs">
              This episode doesn&apos;t have still images on TMDB.
            </p>
          </div>
        </div>
      )}

      {/* Still image selection content */}
      {!noStillsAvailable ? (
        <ImageSelectionGrid
          type="backdrop"
          tmdbImages={stills}
          existingFiles={existingArtworkFiles}
          selectedValue={still.value}
          onSelect={handleSelect}
          isSkipped={still.skipped}
          onSkipChange={handleSkipChange}
          disabled={isLoading}
          showTabs={existingArtworkFiles.length > 0}
        />
      ) : null}

      {/* Skip checkbox (when stills are available) */}
      {!noStillsAvailable ? (
        <div className="flex items-center gap-2">
          <Checkbox
            id="skip-still-selection"
            checked={still.skipped}
            onCheckedChange={(checked) => handleSkipChange(checked === true)}
            disabled={isLoading}
          />
          <Label
            htmlFor="skip-still-selection"
            className={cn(
              "flex cursor-pointer items-center gap-1.5 text-sm",
              isLoading && "cursor-not-allowed opacity-50"
            )}
          >
            Skip still image selection
          </Label>
        </div>
      ) : null}

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
              <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
              Back
            </Button>
          ) : (
            <div /> /* Spacer for layout */
          )}

          <Button type="button" onClick={() => onNext()} disabled={isLoading}>
            Next
            <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      )}
    </div>
  );
}
