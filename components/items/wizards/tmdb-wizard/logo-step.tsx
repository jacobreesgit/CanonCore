/**
 * Logo selection step for the TMDB metadata wizard.
 * Wraps LogoSelectionStep with navigation and state management.
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
import { LogoSelectionStep } from "./logo-selection-step";
import type { ArtworkSelectionSource } from "@/lib/types";
import type { TMDBArtworkStepProps } from "./tmdb-wizard-types";

/**
 * Logo selection step for the TMDB wizard.
 * Displays logo images with object-contain on a dark background with skip option.
 * Only shown for movies and shows (not seasons or episodes).
 *
 * @param data - Wizard data containing images and logo selection
 * @param isLoading - Whether a loading operation is in progress
 * @param error - Current error message
 * @param canGoBack - Whether back navigation is possible
 * @param onNext - Navigate to next step
 * @param onBack - Navigate to previous step
 * @param onDataChange - Update wizard data
 * @param onSkip - Mark step as skipped
 */
export function TMDBLogoStep({
  data,
  isLoading,
  error,
  canGoBack,
  showNavigation = true,
  onNext,
  onBack,
  onDataChange,
  onSkip: _onSkip,
}: TMDBArtworkStepProps) {
  const images = data.images;
  const logo = data.logo ?? {
    value: null,
    source: null,
    skipped: false,
  };

  /**
   * Handles logo selection change.
   */
  const handleSelect = useCallback(
    (value: string | null, source: ArtworkSelectionSource) => {
      onDataChange({
        logo: {
          value,
          source: value ? source : null,
          skipped: false,
        },
      });
    },
    [onDataChange]
  );

  return (
    <div className="space-y-6">
      {/* Step header */}
      <div>
        <h3 className="text-foreground text-lg font-semibold">Select Logo</h3>
        <p className="text-muted-foreground text-sm">
          Choose a title treatment logo for the hero banner overlay.
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

      {/* Logo selection content */}
      <LogoSelectionStep
        logos={images?.logos ?? []}
        selectedValue={logo.value}
        selectedSource={logo.source}
        onSelect={handleSelect}
        isSkipped={logo.skipped}
        disabled={isLoading}
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
