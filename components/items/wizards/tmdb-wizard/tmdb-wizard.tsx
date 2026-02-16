/**
 * TMDB metadata wizard orchestrator component.
 * Coordinates wizard steps and handles state transitions.
 */
"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  getImagesAction,
  getSeasonImagesAction,
  getEpisodeImagesAction,
} from "@/lib/tmdb-actions";
import { WizardStepIndicator } from "@/components/wizards/wizard-step-indicator";
import { useTMDBWizard } from "./use-tmdb-wizard";
import { TMDBTextStep } from "./text-step";
import { TMDBPosterStep } from "./poster-step";
import { TMDBHeroStep } from "./hero-step";
import { TMDBStillStep } from "./still-step";
import { TMDBSummaryStep } from "./summary-step";
import type {
  TMDBWizardProps,
  TMDBWizardStep,
  TMDBWizardData,
  TMDBWizardContentType,
  TMDBWizardInitialData,
  TMDBWizardFooterProps,
} from "./tmdb-wizard-types";
import { TMDB_WIZARD_STEP_LABELS, getVisibleSteps } from "./tmdb-wizard-types";

/**
 * TMDB metadata wizard component.
 * Guides users through selecting title, description, poster, and hero images.
 *
 * @param initialData - Initial TMDB data to start the wizard
 * @param currentValues - Current item values for comparison
 * @param uploadMode - Whether upload mode is enabled (AddItemDialog)
 * @param hasDriveConnection - Whether user has Google Drive connected
 * @param queuedArtwork - Queued artwork files for upload mode
 * @param queuedHero - Queued hero files for upload mode
 * @param onArtworkQueue - Callback when artwork files are queued
 * @param onHeroQueue - Callback when hero files are queued
 * @param existingArtwork - Existing artwork files (settings mode)
 * @param existingHero - Existing hero files (settings mode)
 * @param onComplete - Callback when wizard completes
 */
export function TMDBWizard({
  initialData,
  currentValues,
  uploadMode,
  hasDriveConnection,
  queuedArtwork,
  queuedHero,
  onArtworkQueue,
  onHeroQueue,
  existingArtwork,
  existingHero,
  onComplete,
  renderFooter,
  renderHeader,
  onHeaderChange,
  onFooterChange,
  onCancel,
}: TMDBWizardProps) {
  const wizard = useTMDBWizard(initialData);
  const fetchedImagesRef = useRef(false);
  const prefersReducedMotion = useReducedMotion();

  // Extract stable values from wizard to avoid object reference in dependency arrays
  const currentStep = wizard.currentStep;
  const wizardImages = wizard.data.images;
  const wizardSeasonImages = wizard.data.seasonImages;
  const wizardPoster = wizard.data.poster;
  const wizardBackdrop = wizard.data.backdrop;
  const { setLoadingImages, setImages, setError, setData } = wizard;

  // Derive content type from initial data
  const contentType: TMDBWizardContentType = useMemo(() => {
    if (initialData.contentType) return initialData.contentType;
    return initialData.tmdbResult.mediaType === "tv" ? "show" : "movie";
  }, [initialData.contentType, initialData.tmdbResult.mediaType]);

  // Determine visible steps based on content type
  const visibleSteps = useMemo<TMDBWizardStep[]>(
    () => getVisibleSteps(contentType),
    [contentType]
  );

  /**
   * Notifies parent when header props change (for dialog header sync).
   * Uses useEffect to avoid setState-during-render anti-pattern.
   */
  useEffect(() => {
    if (onHeaderChange) {
      onHeaderChange({
        steps: visibleSteps,
        currentStep: wizard.currentStep,
        stepLabels: TMDB_WIZARD_STEP_LABELS,
      });
    }
  }, [visibleSteps, wizard.currentStep, onHeaderChange]);

  /**
   * Fetches TMDB images when entering artwork step (poster or still).
   * Fetches appropriate images based on content type.
   */
  useEffect(() => {
    const shouldFetchImages =
      (currentStep === "poster" || currentStep === "still") &&
      !fetchedImagesRef.current;

    if (!shouldFetchImages) return;

    fetchedImagesRef.current = true;
    const fetchImages = async () => {
      setLoadingImages(true);
      try {
        // Fetch images based on content type
        if (contentType === "movie" || contentType === "show") {
          // Movie/Show: fetch posters and backdrops
          const result = await getImagesAction(
            initialData.tmdbResult.id,
            initialData.tmdbResult.mediaType
          );
          if (result.success && result.data) {
            setImages(result.data);
          } else if (!result.success) {
            setError(result.error);
          } else {
            setError("Failed to load images");
          }
        } else if (contentType === "season") {
          // Season: fetch season posters (no backdrops)
          // Note: seasonNumber should be passed in initialData for this to work
          const seasonNumber = (
            initialData as TMDBWizardInitialData & { seasonNumber?: number }
          ).seasonNumber;
          if (seasonNumber !== undefined) {
            const result = await getSeasonImagesAction(
              initialData.tmdbResult.id,
              seasonNumber
            );
            if (result.success && result.data) {
              setData({ seasonImages: result.data });
            } else if (!result.success) {
              setError(result.error);
            } else {
              setError("Failed to load season images");
            }
          }
        } else if (contentType === "episode") {
          // Episode: fetch episode stills
          // Note: seasonNumber and episodeNumber should be passed in initialData
          const extendedData = initialData as TMDBWizardInitialData & {
            seasonNumber?: number;
            episodeNumber?: number;
          };
          if (
            extendedData.seasonNumber !== undefined &&
            extendedData.episodeNumber !== undefined
          ) {
            const result = await getEpisodeImagesAction(
              initialData.tmdbResult.id,
              extendedData.seasonNumber,
              extendedData.episodeNumber
            );
            if (result.success && result.data) {
              setData({ episodeImages: result.data });
            } else if (!result.success) {
              setError(result.error);
            } else {
              setError("Failed to load episode stills");
            }
          }
        }
      } catch {
        setError("Failed to load images");
      } finally {
        setLoadingImages(false);
      }
    };
    fetchImages();
  }, [
    currentStep,
    contentType,
    initialData,
    setLoadingImages,
    setImages,
    setData,
    setError,
  ]);

  /**
   * Auto-selects first poster and backdrop when images become available.
   * Matches add-item-dialog behavior for consistent UX.
   */
  // Extract primitive values to avoid object reference changes triggering effect
  // For seasons, use seasonImages; otherwise use regular images
  const firstPosterPath =
    contentType === "season"
      ? (wizardSeasonImages?.posters?.[0]?.file_path ?? null)
      : (wizardImages?.posters?.[0]?.file_path ?? null);
  const firstBackdropPath = wizardImages?.backdrops?.[0]?.file_path ?? null;
  const posterValue = wizardPoster?.value ?? null;
  const posterSkipped = wizardPoster?.skipped ?? false;
  const backdropValue = wizardBackdrop?.value ?? null;
  const backdropSkipped = wizardBackdrop?.skipped ?? false;

  useEffect(() => {
    // Auto-select first poster if none selected and not skipped
    if (
      firstPosterPath &&
      (posterValue === null || posterValue === undefined) &&
      !posterSkipped
    ) {
      setData({
        poster: {
          value: firstPosterPath,
          source: "tmdb",
          skipped: false,
        },
      });
    }

    // Auto-select first backdrop if none selected and not skipped
    if (
      firstBackdropPath &&
      (backdropValue === null || backdropValue === undefined) &&
      !backdropSkipped
    ) {
      setData({
        backdrop: {
          value: firstBackdropPath,
          source: "tmdb",
          skipped: false,
        },
      });
    }
  }, [
    firstPosterPath,
    firstBackdropPath,
    posterValue,
    posterSkipped,
    backdropValue,
    backdropSkipped,
    setData,
  ]);

  /**
   * Handles navigation to next step.
   */
  const handleNext = useCallback(
    (data?: Partial<TMDBWizardData>) => {
      const currentIndex = visibleSteps.indexOf(wizard.currentStep);
      if (currentIndex < visibleSteps.length - 1) {
        const nextStep = visibleSteps[currentIndex + 1];
        wizard.goToStep(nextStep, data);
      }
    },
    [wizard, visibleSteps]
  );

  /**
   * Handles back navigation.
   */
  const handleBack = useCallback(() => {
    wizard.goBack();
  }, [wizard]);

  /**
   * Handles data update without navigation.
   */
  const handleDataChange = useCallback(
    (data: Partial<TMDBWizardData>) => {
      wizard.setData(data);
    },
    [wizard]
  );

  /**
   * Handles loading state change.
   */
  const handleLoadingChange = useCallback(
    (loading: boolean) => {
      wizard.setLoadingApply(loading);
    },
    [wizard]
  );

  /**
   * Handles error state change.
   */
  const handleError = useCallback(
    (error: string | null) => {
      wizard.setError(error);
    },
    [wizard]
  );

  /**
   * Handles skipping poster step.
   */
  const handleSkipPoster = useCallback(() => {
    wizard.skipPoster();
  }, [wizard]);

  /**
   * Handles skipping backdrop step.
   */
  const handleSkipBackdrop = useCallback(() => {
    wizard.skipBackdrop();
  }, [wizard]);

  /**
   * Handles skipping still step (for episodes).
   */
  const handleSkipStill = useCallback(() => {
    wizard.skipStill();
  }, [wizard]);

  /**
   * Handles skipping all remaining artwork steps.
   * Marks remaining artwork as skipped and jumps to summary.
   */
  const handleSkipAll = useCallback(() => {
    const currentIndex = visibleSteps.indexOf(wizard.currentStep);

    // Skip all remaining artwork steps
    for (let i = currentIndex; i < visibleSteps.length - 1; i++) {
      const step = visibleSteps[i];
      if (step === "poster") wizard.skipPoster();
      else if (step === "hero") wizard.skipBackdrop();
      else if (step === "still") wizard.skipStill();
    }

    // Navigate to summary
    wizard.goToStep("summary");
  }, [wizard, visibleSteps]);

  /**
   * Handles retry after error.
   * Clears error and re-fetches images if on artwork step.
   */
  const handleRetry = useCallback(() => {
    wizard.setError(null);
    if (wizard.currentStep === "poster" || wizard.currentStep === "still") {
      // Reset fetched flag to allow refetch
      fetchedImagesRef.current = false;
      wizard.setLoadingImages(true);
    }
  }, [wizard]);

  /**
   * Handles navigation to a specific step for editing.
   */
  const handleEditStep = useCallback(
    (step: TMDBWizardStep) => {
      wizard.goToStep(step);
    },
    [wizard]
  );

  /**
   * Handles wizard completion.
   */
  const handleApply = useCallback(() => {
    const result = wizard.getResult();
    onComplete(result);
  }, [wizard, onComplete]);

  // Determine if we're loading
  const isLoading = wizard.isLoadingImages || wizard.isLoadingApply;

  // Check if current step is the last step
  const currentIndex = visibleSteps.indexOf(wizard.currentStep);
  const isLastStep = currentIndex === visibleSteps.length - 1;

  // Check if skip all should be available (on an artwork step with more steps after)
  const isArtworkStep =
    wizard.currentStep === "poster" ||
    wizard.currentStep === "hero" ||
    wizard.currentStep === "still";
  const hasMoreSteps = currentIndex < visibleSteps.length - 1;
  const showSkipAll = isArtworkStep && hasMoreSteps;

  // Build footer props for render prop pattern
  const footerProps: TMDBWizardFooterProps = {
    onBack: onCancel && !wizard.canGoBack ? onCancel : handleBack,
    onNext: isLastStep ? handleApply : handleNext,
    onSkipAll: showSkipAll ? handleSkipAll : undefined,
    onRetry: wizard.error ? handleRetry : undefined,
    isLoading,
    isDisabled: isLoading,
    canGoBack: wizard.canGoBack || !!onCancel,
    isLastStep,
    currentStep: wizard.currentStep,
    error: wizard.error,
  };

  /**
   * Notifies parent when footer props change (for dialog footer sync).
   * Uses useEffect to avoid setState-during-render anti-pattern.
   * Only depends on primitive values to prevent infinite loops.
   */
  useEffect(() => {
    if (onFooterChange) {
      // Reconstruct footerProps inside effect with current stable references
      onFooterChange({
        onBack: onCancel && !wizard.canGoBack ? onCancel : handleBack,
        onNext: isLastStep ? handleApply : handleNext,
        onSkipAll: showSkipAll ? handleSkipAll : undefined,
        onRetry: wizard.error ? handleRetry : undefined,
        isLoading,
        isDisabled: isLoading,
        canGoBack: wizard.canGoBack || !!onCancel,
        isLastStep,
        currentStep: wizard.currentStep,
        error: wizard.error,
      });
    }
    // Intentionally omit callback functions from dependencies.
    // The callbacks (handleBack, handleApply, etc.) are stable via useCallback
    // and are reconstructed inside this effect with current values.
    // Including them would cause infinite loops as they reference wizard state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    onFooterChange,
    isLoading,
    isLastStep,
    showSkipAll,
    wizard.currentStep,
    wizard.canGoBack,
    wizard.error,
    onCancel,
  ]);

  // Whether parent is handling the footer (hide inline navigation in steps)
  const parentHandlesFooter = !!renderFooter || !!onFooterChange;

  // Render current step
  const renderStep = () => {
    const commonProps = {
      data: wizard.data,
      currentValues,
      isLoading,
      error: wizard.error,
      canGoBack: wizard.canGoBack,
      showNavigation: !parentHandlesFooter,
      onNext: handleNext,
      onBack: handleBack,
      onDataChange: handleDataChange,
      onLoadingChange: handleLoadingChange,
      onError: handleError,
    };

    switch (wizard.currentStep) {
      case "text":
        return <TMDBTextStep {...commonProps} />;

      case "poster":
        return (
          <TMDBPosterStep
            {...commonProps}
            uploadMode={uploadMode}
            hasDriveConnection={hasDriveConnection}
            queuedFiles={queuedArtwork}
            onFilesQueue={onArtworkQueue}
            existingFiles={existingArtwork}
            onSkip={handleSkipPoster}
          />
        );

      case "hero":
        return (
          <TMDBHeroStep
            {...commonProps}
            uploadMode={uploadMode}
            hasDriveConnection={hasDriveConnection}
            queuedFiles={queuedHero}
            onFilesQueue={onHeroQueue}
            existingFiles={existingHero}
            onSkip={handleSkipBackdrop}
          />
        );

      case "still":
        return (
          <TMDBStillStep
            {...commonProps}
            uploadMode={uploadMode}
            hasDriveConnection={hasDriveConnection}
            existingFiles={existingArtwork}
            onSkip={handleSkipStill}
          />
        );

      case "summary":
        return (
          <TMDBSummaryStep
            {...commonProps}
            onEditStep={handleEditStep}
            onApply={handleApply}
          />
        );

      default:
        return null;
    }
  };

  // Header props for render prop pattern
  const headerProps = {
    steps: visibleSteps,
    currentStep: wizard.currentStep,
    stepLabels: TMDB_WIZARD_STEP_LABELS,
  };

  return (
    <div className="space-y-4">
      {/* Step indicator - render via prop, or inline if parent doesn't handle it */}
      {renderHeader ? (
        renderHeader(headerProps)
      ) : !onHeaderChange ? (
        <WizardStepIndicator
          steps={visibleSteps}
          currentStep={wizard.currentStep}
          stepLabels={TMDB_WIZARD_STEP_LABELS}
        />
      ) : null}

      {/* Animated step content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={wizard.currentStep}
          initial={prefersReducedMotion ? false : { opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: -10 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.15 }}
          data-testid={`tmdb-wizard-step-${wizard.currentStep}`}
        >
          {renderStep()}
        </motion.div>
      </AnimatePresence>

      {/* Footer - rendered via render prop if provided */}
      {renderFooter && renderFooter(footerProps)}
    </div>
  );
}
