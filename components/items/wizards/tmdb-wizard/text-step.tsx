/**
 * Text selection step for the TMDB metadata wizard.
 * Wraps TitleDescriptionStep with navigation buttons and error handling.
 */
"use client";

import { useCallback } from "react";
import { AlertCircle, ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  TitleDescriptionStep,
  type TitleDescriptionOptions,
} from "./title-description-step";
import type { TMDBStepProps } from "./tmdb-wizard-types";

/**
 * Text selection step for the TMDB wizard.
 * Displays checkboxes for title and description updates with before/after preview.
 *
 * @param data - Wizard data containing preview and text options
 * @param currentValues - Current item values for comparison
 * @param isLoading - Whether a loading operation is in progress
 * @param error - Current error message
 * @param canGoBack - Whether back navigation is possible
 * @param onNext - Navigate to next step
 * @param onBack - Navigate to previous step
 * @param onDataChange - Update wizard data
 */
export function TMDBTextStep({
  data,
  currentValues,
  isLoading,
  error,
  canGoBack,
  showNavigation = true,
  onNext,
  onBack,
  onDataChange,
}: TMDBStepProps) {
  const preview = data.preview ?? { name: "", description: "" };
  const textOptions = data.textOptions ?? {
    updateName: true,
    updateDescription: true,
  };

  /**
   * Handles checkbox changes for title/description options.
   */
  const handleOptionsChange = useCallback(
    (options: TitleDescriptionOptions) => {
      onDataChange({ textOptions: options });
    },
    [onDataChange]
  );

  return (
    <div className="space-y-6">
      {/* Step header */}
      <div>
        <h3 className="text-lg font-semibold">Title & Description</h3>
        <p className="text-muted-foreground text-sm">
          Choose which fields to update from TMDB.
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

      {/* Title/Description step content */}
      <TitleDescriptionStep
        currentValues={currentValues}
        preview={preview}
        options={textOptions}
        onOptionsChange={handleOptionsChange}
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
