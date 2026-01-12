/**
 * Metadata wizard modal for applying TMDB metadata with image selection.
 * Three-step wizard: Title/Description → Poster Selection → Hero Selection.
 */

"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import {
  Loader2,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  SkipForward,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  TitleDescriptionStep,
  type CurrentTextValues,
  type TextPreviewData,
  type TitleDescriptionOptions,
} from "./title-description-step";
import { PosterSelectionStep } from "./poster-selection-step";
import { HeroSelectionStep } from "./hero-selection-step";
import type { ExistingArtworkFile } from "./image-selection-grid";
import type { TMDBImages } from "@/lib/tmdb-client";

/** Wizard step identifiers */
type WizardStep = "text" | "poster" | "hero";

/** Step configuration */
interface StepConfig {
  id: WizardStep;
  title: string;
  number: number;
}

const STEPS: StepConfig[] = [
  { id: "text", title: "Title & Description", number: 1 },
  { id: "poster", title: "Select Poster", number: 2 },
  { id: "hero", title: "Select Hero", number: 3 },
];

/**
 * Complete wizard result with all selections.
 */
export interface MetadataWizardResult {
  /** Text field options */
  textOptions: TitleDescriptionOptions;
  /** Selected poster path (TMDB) */
  posterPath: string | null;
  /** Selected poster file ID (existing) */
  posterFileId: string | null;
  /** Whether poster selection was skipped */
  posterSkipped: boolean;
  /** Selected backdrop path (TMDB) */
  backdropPath: string | null;
  /** Selected backdrop file ID (existing) */
  backdropFileId: string | null;
  /** Whether backdrop selection was skipped */
  backdropSkipped: boolean;
}

interface MetadataWizardModalProps {
  /** Whether the wizard is open */
  open: boolean;
  /** Callback when wizard open state changes */
  onOpenChange: (open: boolean) => void;
  /** Current item text values */
  currentValues: CurrentTextValues;
  /** TMDB text preview data */
  textPreview: TextPreviewData;
  /** TMDB images (fetched separately) */
  images: TMDBImages | null;
  /** Whether images are loading */
  isLoadingImages?: boolean;
  /** Existing artwork files for "My Uploads" tabs */
  existingArtwork?: ExistingArtworkFile[];
  /** Whether the apply operation is in progress */
  isApplying?: boolean;
  /** Callback when wizard completes with selections */
  onComplete: (result: MetadataWizardResult) => void;
  /** Callback when wizard is cancelled */
  onCancel: () => void;
}

/**
 * Three-step metadata wizard modal.
 * Guides users through text fields, poster selection, and hero selection.
 *
 * @param open - Whether wizard is visible
 * @param onOpenChange - Callback for visibility changes
 * @param currentValues - Current item text values
 * @param textPreview - TMDB text preview
 * @param images - TMDB images collection
 * @param isLoadingImages - Whether images are loading
 * @param existingArtwork - User's existing artwork files
 * @param isApplying - Whether apply is in progress
 * @param onComplete - Callback with final selections
 * @param onCancel - Callback when cancelled
 */
export function MetadataWizardModal({
  open,
  onOpenChange,
  currentValues,
  textPreview,
  images,
  isLoadingImages = false,
  existingArtwork = [],
  isApplying = false,
  onComplete,
  onCancel,
}: MetadataWizardModalProps) {
  /**
   * Handles cancel action.
   */
  const handleCancel = useCallback(() => {
    onCancel();
    onOpenChange(false);
  }, [onCancel, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-xl">
        {/* Render form only when open to reset state */}
        {open && (
          <MetadataWizardForm
            currentValues={currentValues}
            textPreview={textPreview}
            images={images}
            isLoadingImages={isLoadingImages}
            existingArtwork={existingArtwork}
            isApplying={isApplying}
            onComplete={onComplete}
            onCancel={handleCancel}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Internal form component that manages wizard state.
 * Separated to enable remounting for state reset.
 */
function MetadataWizardForm({
  currentValues,
  textPreview,
  images,
  isLoadingImages,
  existingArtwork,
  isApplying,
  onComplete,
  onCancel,
}: {
  currentValues: CurrentTextValues;
  textPreview: TextPreviewData;
  images: TMDBImages | null;
  isLoadingImages: boolean;
  existingArtwork: ExistingArtworkFile[];
  isApplying: boolean;
  onComplete: (result: MetadataWizardResult) => void;
  onCancel: () => void;
}) {
  // Current step
  const [currentStep, setCurrentStep] = useState<WizardStep>("text");

  // Text options state
  const [textOptions, setTextOptions] = useState<TitleDescriptionOptions>({
    updateName: true,
    updateDescription: true,
  });

  // Poster selection state
  const [posterValue, setPosterValue] = useState<string | null>(null);
  const [posterSource, setPosterSource] = useState<"tmdb" | "existing" | null>(
    null
  );
  const [posterSkipped, setPosterSkipped] = useState(false);

  // Hero selection state
  const [backdropValue, setBackdropValue] = useState<string | null>(null);
  const [backdropSource, setBackdropSource] = useState<
    "tmdb" | "existing" | null
  >(null);
  const [backdropSkipped, setBackdropSkipped] = useState(false);

  // Pre-select first poster and backdrop when images load.
  // This is a valid pattern for syncing state with async props per React docs:
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  useEffect(() => {
    if (images?.posters?.[0] && posterValue === null && !posterSkipped) {
      setPosterValue(images.posters[0].file_path); // eslint-disable-line react-hooks/set-state-in-effect -- legitimate prop sync
      setPosterSource("tmdb");
    }
    if (images?.backdrops?.[0] && backdropValue === null && !backdropSkipped) {
      setBackdropValue(images.backdrops[0].file_path);
      setBackdropSource("tmdb");
    }
  }, [images, posterValue, backdropValue, posterSkipped, backdropSkipped]);

  /**
   * Gets current step index.
   */
  const currentStepIndex = useMemo(
    () => STEPS.findIndex((s) => s.id === currentStep),
    [currentStep]
  );

  /**
   * Gets current step config.
   */
  const currentStepConfig = useMemo(
    () => STEPS[currentStepIndex],
    [currentStepIndex]
  );

  /**
   * Handles poster selection.
   */
  const handlePosterSelect = useCallback(
    (value: string | null, source: "tmdb" | "existing") => {
      setPosterValue(value);
      setPosterSource(value ? source : null);
    },
    []
  );

  /**
   * Handles backdrop selection.
   */
  const handleBackdropSelect = useCallback(
    (value: string | null, source: "tmdb" | "existing") => {
      setBackdropValue(value);
      setBackdropSource(value ? source : null);
    },
    []
  );

  /**
   * Goes to next step or completes wizard.
   */
  const handleNext = useCallback(() => {
    if (currentStepIndex < STEPS.length - 1) {
      setCurrentStep(STEPS[currentStepIndex + 1].id);
    } else {
      // Complete wizard
      onComplete({
        textOptions,
        posterPath: posterSource === "tmdb" ? posterValue : null,
        posterFileId: posterSource === "existing" ? posterValue : null,
        posterSkipped,
        backdropPath: backdropSource === "tmdb" ? backdropValue : null,
        backdropFileId: backdropSource === "existing" ? backdropValue : null,
        backdropSkipped,
      });
    }
  }, [
    currentStepIndex,
    textOptions,
    posterValue,
    posterSource,
    posterSkipped,
    backdropValue,
    backdropSource,
    backdropSkipped,
    onComplete,
  ]);

  /**
   * Goes to previous step.
   */
  const handleBack = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStep(STEPS[currentStepIndex - 1].id);
    }
  }, [currentStepIndex]);

  /**
   * Skips remaining steps and completes wizard.
   */
  const handleSkipAll = useCallback(() => {
    onComplete({
      textOptions,
      posterPath: posterSource === "tmdb" ? posterValue : null,
      posterFileId: posterSource === "existing" ? posterValue : null,
      posterSkipped: currentStep === "text" ? true : posterSkipped,
      backdropPath: backdropSource === "tmdb" ? backdropValue : null,
      backdropFileId: backdropSource === "existing" ? backdropValue : null,
      backdropSkipped:
        currentStep === "text" || currentStep === "poster"
          ? true
          : backdropSkipped,
    });
  }, [
    textOptions,
    posterValue,
    posterSource,
    posterSkipped,
    backdropValue,
    backdropSource,
    backdropSkipped,
    currentStep,
    onComplete,
  ]);

  const isLastStep = currentStepIndex === STEPS.length - 1;
  const isFirstStep = currentStepIndex === 0;

  return (
    <>
      <DialogHeader>
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-xl",
              "bg-amber-500/10 ring-1 ring-amber-500/20"
            )}
          >
            <Sparkles className="size-5 text-amber-500" />
          </div>
          <div className="min-w-0 flex-1">
            <DialogTitle className="text-lg">Apply Metadata</DialogTitle>
            <DialogDescription className="text-sm">
              Step {currentStepConfig.number} of {STEPS.length}:{" "}
              {currentStepConfig.title}
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      {/* Step indicator */}
      <div className="flex gap-1.5 py-2">
        {STEPS.map((step, index) => (
          <div
            key={step.id}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors",
              index <= currentStepIndex ? "bg-amber-500" : "bg-muted"
            )}
          />
        ))}
      </div>

      {/* Step content */}
      <div className="min-h-[300px] py-2">
        {currentStep === "text" && (
          <TitleDescriptionStep
            currentValues={currentValues}
            preview={textPreview}
            options={textOptions}
            onOptionsChange={setTextOptions}
            disabled={isApplying}
          />
        )}

        {currentStep === "poster" && (
          <>
            {isLoadingImages ? (
              <LoadingState message="Loading poster options..." />
            ) : (
              <PosterSelectionStep
                posters={images?.posters || []}
                existingFiles={existingArtwork}
                selectedValue={posterValue}
                selectedSource={posterSource}
                onSelect={handlePosterSelect}
                isSkipped={posterSkipped}
                onSkipChange={setPosterSkipped}
                disabled={isApplying}
              />
            )}
          </>
        )}

        {currentStep === "hero" && (
          <>
            {isLoadingImages ? (
              <LoadingState message="Loading backdrop options..." />
            ) : (
              <HeroSelectionStep
                backdrops={images?.backdrops || []}
                existingFiles={existingArtwork}
                selectedValue={backdropValue}
                selectedSource={backdropSource}
                onSelect={handleBackdropSelect}
                isSkipped={backdropSkipped}
                onSkipChange={setBackdropSkipped}
                disabled={isApplying}
              />
            )}
          </>
        )}
      </div>

      <DialogFooter className="flex-col gap-2 sm:flex-row">
        <div className="flex w-full gap-2 sm:w-auto">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isApplying}
            className="flex-1 sm:flex-none"
          >
            Cancel
          </Button>

          {!isFirstStep && (
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={isApplying}
              className="flex-1 sm:flex-none"
            >
              <ChevronLeft className="mr-1 size-4" />
              Back
            </Button>
          )}
        </div>

        <div className="flex w-full gap-2 sm:ml-auto sm:w-auto">
          {!isLastStep && (
            <Button
              variant="ghost"
              onClick={handleSkipAll}
              disabled={isApplying}
              className="flex-1 sm:flex-none"
            >
              <SkipForward className="mr-1 size-4" />
              Skip All
            </Button>
          )}

          <Button
            onClick={handleNext}
            disabled={isApplying}
            className="flex-1 gap-2 sm:flex-none"
          >
            {isApplying ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Applying...
              </>
            ) : isLastStep ? (
              "Apply"
            ) : (
              <>
                Next
                <ChevronRight className="size-4" />
              </>
            )}
          </Button>
        </div>
      </DialogFooter>
    </>
  );
}

/**
 * Loading state for image steps.
 */
function LoadingState({ message }: { message: string }) {
  return (
    <div className="flex min-h-[200px] flex-col items-center justify-center gap-3">
      <Loader2 className="text-muted-foreground size-8 animate-spin" />
      <p className="text-muted-foreground text-sm">{message}</p>
    </div>
  );
}
