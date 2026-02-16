/**
 * Summary/review step for the TMDB metadata wizard.
 * Displays all selections for final review before applying.
 */
"use client";

import { useCallback, useMemo } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Image as ImageIcon,
  Sparkles,
  SkipForward,
  Type,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { DEFAULT_TMDB_DISPLAY } from "@/lib/types";
import { TmdbDisplayOptionsEditor } from "@/components/items/tmdb-display-options";
import { getPosterUrl, getBackdropUrl } from "@/lib/tmdb-client";
import type { TMDBSummaryStepProps } from "./tmdb-wizard-types";

/**
 * Summary/review step for the TMDB wizard.
 * Shows all selections with options to go back and edit.
 *
 * @param data - Wizard data containing all selections
 * @param isLoading - Whether apply operation is in progress
 * @param error - Current error message
 * @param canGoBack - Whether back navigation is possible
 * @param onBack - Navigate to previous step
 * @param onEditStep - Navigate to a specific step for editing
 * @param onApply - Complete the wizard
 */
export function TMDBSummaryStep({
  data,
  isLoading,
  error,
  canGoBack,
  showNavigation = true,
  onBack,
  onEditStep,
  onApply,
  onDataChange,
}: TMDBSummaryStepProps) {
  const preview = data.preview ?? { name: "", description: "" };
  const textOptions = data.textOptions ?? {
    updateName: true,
    updateDescription: true,
  };
  const poster = data.poster ?? { value: null, source: null, skipped: false };
  const backdrop = data.backdrop ?? {
    value: null,
    source: null,
    skipped: false,
  };

  /**
   * Handles Apply button click.
   */
  const handleApply = useCallback(() => {
    onApply();
  }, [onApply]);

  /**
   * Memoized poster preview URL to avoid recreation on each render.
   */
  const posterPreviewUrl = useMemo((): string | null => {
    if (poster.skipped || !poster.value) return null;
    if (poster.source === "tmdb") {
      return getPosterUrl(poster.value, "w185");
    }
    // For existing/queued files, we'd need file ID -> URL mapping
    // For now, return null (handled in UI)
    return null;
  }, [poster.skipped, poster.value, poster.source]);

  /**
   * Memoized backdrop preview URL to avoid recreation on each render.
   */
  const backdropPreviewUrl = useMemo((): string | null => {
    if (backdrop.skipped || !backdrop.value) return null;
    if (backdrop.source === "tmdb") {
      return getBackdropUrl(backdrop.value, "w300");
    }
    return null;
  }, [backdrop.skipped, backdrop.value, backdrop.source]);

  return (
    <div className="space-y-6">
      {/* Step header */}
      <div>
        <h3 className="text-foreground text-lg font-semibold">
          Review Changes
        </h3>
        <p className="text-muted-foreground text-sm">
          Review your selections before applying.
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

      {/* Summary content */}
      <div className="space-y-4">
        {/* Text options summary */}
        <SummarySection
          title="Title & Description"
          icon={Type}
          onClick={() => onEditStep("text")}
        >
          <div className="space-y-2 text-sm">
            <div className="flex items-start gap-2">
              <div className="mt-0.5 shrink-0">
                {textOptions.updateName ? (
                  <Check
                    className="h-3 w-3 text-green-500"
                    aria-hidden="true"
                  />
                ) : (
                  <SkipForward
                    className="text-muted-foreground h-3 w-3"
                    aria-hidden="true"
                  />
                )}
              </div>
              <div
                className={cn(
                  !textOptions.updateName && "text-muted-foreground"
                )}
              >
                <span className="font-medium">Name:</span>{" "}
                {textOptions.updateName ? preview.name : "No change"}
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="mt-0.5 shrink-0">
                {textOptions.updateDescription ? (
                  <Check
                    className="h-3 w-3 text-green-500"
                    aria-hidden="true"
                  />
                ) : (
                  <SkipForward
                    className="text-muted-foreground h-3 w-3"
                    aria-hidden="true"
                  />
                )}
              </div>
              <div
                className={cn(
                  !textOptions.updateDescription && "text-muted-foreground"
                )}
              >
                <span className="font-medium">Description:</span>{" "}
                {textOptions.updateDescription
                  ? preview.description
                  : "No change"}
              </div>
            </div>
          </div>
        </SummarySection>

        <Separator />

        {/* Poster summary */}
        <SummarySection
          title="Poster"
          icon={ImageIcon}
          onClick={() => onEditStep("poster")}
        >
          <div className="flex items-center gap-3">
            {poster.skipped ? (
              <div className="text-muted-foreground flex items-center gap-2 text-sm">
                <SkipForward className="h-4 w-4" aria-hidden="true" />
                <span>Skipped</span>
              </div>
            ) : poster.value ? (
              <>
                {posterPreviewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- external TMDB URLs
                  <img
                    src={posterPreviewUrl}
                    alt="Selected poster"
                    width={48}
                    height={64}
                    className="h-16 w-auto rounded object-cover"
                  />
                ) : (
                  <div className="bg-muted flex h-16 w-12 items-center justify-center rounded">
                    <ImageIcon
                      className="text-muted-foreground h-6 w-6"
                      aria-hidden="true"
                    />
                  </div>
                )}
                <div className="text-sm">
                  <span className="font-medium">Selected</span>
                  <p className="text-muted-foreground text-xs">
                    Source: {poster.source}
                  </p>
                </div>
              </>
            ) : (
              <div className="text-muted-foreground flex items-center gap-2 text-sm">
                <ImageIcon className="h-4 w-4" aria-hidden="true" />
                <span>No poster selected</span>
              </div>
            )}
          </div>
        </SummarySection>

        <Separator />

        {/* Hero summary */}
        <SummarySection
          title="Hero Image"
          icon={Sparkles}
          onClick={() => onEditStep("hero")}
        >
          <div className="flex items-center gap-3">
            {backdrop.skipped ? (
              <div className="text-muted-foreground flex items-center gap-2 text-sm">
                <SkipForward className="h-4 w-4" aria-hidden="true" />
                <span>Skipped</span>
              </div>
            ) : backdrop.value ? (
              <>
                {backdropPreviewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- external TMDB URLs
                  <img
                    src={backdropPreviewUrl}
                    alt="Selected hero"
                    width={80}
                    height={48}
                    className="h-12 w-auto rounded object-cover"
                  />
                ) : (
                  <div className="bg-muted flex h-12 w-20 items-center justify-center rounded">
                    <Sparkles
                      className="text-muted-foreground h-6 w-6"
                      aria-hidden="true"
                    />
                  </div>
                )}
                <div className="text-sm">
                  <span className="font-medium">Selected</span>
                  <p className="text-muted-foreground text-xs">
                    Source: {backdrop.source}
                  </p>
                </div>
              </>
            ) : (
              <div className="text-muted-foreground flex items-center gap-2 text-sm">
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                <span>No hero selected</span>
              </div>
            )}
          </div>
        </SummarySection>

        {/* Display options */}
        {data.tmdbResult && (
          <>
            <Separator />
            <TmdbDisplayOptionsEditor
              displayOptions={data.displayOptions ?? DEFAULT_TMDB_DISPLAY}
              onChange={(updated) => onDataChange({ displayOptions: updated })}
            />
          </>
        )}
      </div>

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

          <Button type="button" onClick={handleApply} disabled={isLoading}>
            {isLoading ? "Applying..." : "Apply"}
            {!isLoading && (
              <Check className="ml-2 h-4 w-4" aria-hidden="true" />
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * Props for summary section component.
 */
interface SummarySectionProps {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  children: React.ReactNode;
}

/**
 * Summary section with edit button.
 */
function SummarySection({
  title,
  icon: Icon,
  onClick,
  children,
}: SummarySectionProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="text-muted-foreground h-4 w-4" aria-hidden="true" />
          <span className="font-medium">{title}</span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClick}
          className="h-7 px-2 text-xs"
          aria-label={`Edit ${title}`}
        >
          Edit
        </Button>
      </div>
      {children}
    </div>
  );
}
