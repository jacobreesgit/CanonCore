/**
 * Custom hook for managing TMDB wizard state.
 * Wraps useWizardMachine with TMDB-specific types and convenience methods.
 */
"use client";

import { useCallback, useMemo } from "react";
import { useWizardMachine } from "@/components/wizards";
import type { TMDBImages } from "@/lib/tmdb-client";
import type { ArtworkSelectionSource } from "@/lib/types";
import { DEFAULT_TMDB_DISPLAY } from "@/lib/types";
import type { TitleDescriptionOptions } from "./title-description-step";
import type {
  TMDBWizardStep,
  TMDBWizardData,
  TMDBWizardInitialData,
  TMDBWizardResult,
  ArtworkSelection,
} from "./tmdb-wizard-types";
import { createInitialTMDBWizardData } from "./tmdb-wizard-types";

/** Loading state keys for the TMDB wizard */
const LOADING_KEYS = {
  preview: "preview",
  images: "images",
  apply: "apply",
} as const;

/**
 * Return type for the useTMDBWizard hook.
 */
export interface UseTMDBWizardReturn {
  /** Current wizard step */
  currentStep: TMDBWizardStep;
  /** Accumulated wizard data */
  data: Partial<TMDBWizardData>;
  /** Current error message */
  error: string | null;
  /** Whether back navigation is possible */
  canGoBack: boolean;

  // Loading states
  isLoadingPreview: boolean;
  isLoadingImages: boolean;
  isLoadingApply: boolean;

  // Navigation
  goToStep: (step: TMDBWizardStep, data?: Partial<TMDBWizardData>) => void;
  goBack: () => void;
  reset: () => void;

  // Data setters
  setData: (data: Partial<TMDBWizardData>) => void;
  setTextOptions: (options: TitleDescriptionOptions) => void;
  setPoster: (value: string | null, source: ArtworkSelectionSource) => void;
  skipPoster: () => void;
  setBackdrop: (value: string | null, source: ArtworkSelectionSource) => void;
  skipBackdrop: () => void;
  setLogo: (value: string | null, source: ArtworkSelectionSource) => void;
  skipLogo: () => void;
  setStill: (value: string | null, source: ArtworkSelectionSource) => void;
  skipStill: () => void;
  setImages: (images: TMDBImages) => void;

  // Loading setters
  setLoadingPreview: (loading: boolean) => void;
  setLoadingImages: (loading: boolean) => void;
  setLoadingApply: (loading: boolean) => void;

  // Error handling
  setError: (error: string | null) => void;

  // Result
  getResult: () => TMDBWizardResult;
}

/**
 * Custom hook for managing TMDB wizard state.
 * Provides typed methods for navigating and updating wizard data.
 *
 * @param initialData - Initial data to populate the wizard
 * @returns Wizard state and actions
 *
 * @example
 * const wizard = useTMDBWizard({
 *   tmdbResult: searchResult,
 *   preview: { name: "Movie (2024)", description: "..." },
 * });
 *
 * // Navigate
 * wizard.goToStep("poster");
 * wizard.goBack();
 *
 * // Update data
 * wizard.setPoster("/path.jpg", "tmdb");
 * wizard.skipBackdrop();
 *
 * // Get final result
 * const result = wizard.getResult();
 */
export function useTMDBWizard(
  initialData: TMDBWizardInitialData
): UseTMDBWizardReturn {
  const initialWizardData = useMemo(
    () => createInitialTMDBWizardData(initialData),
    [initialData]
  );

  const { state, actions, isLoading, canGoBack } = useWizardMachine<
    TMDBWizardStep,
    TMDBWizardData
  >("text", initialWizardData);

  // Navigation
  const goToStep = useCallback(
    (step: TMDBWizardStep, data?: Partial<TMDBWizardData>) => {
      actions.next(step, data);
    },
    [actions]
  );

  const goBack = useCallback(() => {
    actions.back();
  }, [actions]);

  const reset = useCallback(() => {
    actions.reset();
  }, [actions]);

  // Data setters
  const setData = useCallback(
    (data: Partial<TMDBWizardData>) => {
      actions.setData(data);
    },
    [actions]
  );

  const setTextOptions = useCallback(
    (options: TitleDescriptionOptions) => {
      actions.setData({ textOptions: options });
    },
    [actions]
  );

  const setPoster = useCallback(
    (value: string | null, source: ArtworkSelectionSource) => {
      const poster: ArtworkSelection = {
        value,
        source: value ? source : null,
        skipped: false,
      };
      actions.setData({ poster });
    },
    [actions]
  );

  const skipPoster = useCallback(() => {
    const poster: ArtworkSelection = {
      value: null,
      source: null,
      skipped: true,
    };
    actions.setData({ poster });
  }, [actions]);

  const setBackdrop = useCallback(
    (value: string | null, source: ArtworkSelectionSource) => {
      const backdrop: ArtworkSelection = {
        value,
        source: value ? source : null,
        skipped: false,
      };
      actions.setData({ backdrop });
    },
    [actions]
  );

  const skipBackdrop = useCallback(() => {
    const backdrop: ArtworkSelection = {
      value: null,
      source: null,
      skipped: true,
    };
    actions.setData({ backdrop });
  }, [actions]);

  const setLogo = useCallback(
    (value: string | null, source: ArtworkSelectionSource) => {
      const logo: ArtworkSelection = {
        value,
        source: value ? source : null,
        skipped: false,
      };
      actions.setData({ logo });
    },
    [actions]
  );

  const skipLogo = useCallback(() => {
    const logo: ArtworkSelection = {
      value: null,
      source: null,
      skipped: true,
    };
    actions.setData({ logo });
  }, [actions]);

  const setStill = useCallback(
    (value: string | null, source: ArtworkSelectionSource) => {
      const still: ArtworkSelection = {
        value,
        source: value ? source : null,
        skipped: false,
      };
      actions.setData({ still });
    },
    [actions]
  );

  const skipStill = useCallback(() => {
    const still: ArtworkSelection = {
      value: null,
      source: null,
      skipped: true,
    };
    actions.setData({ still });
  }, [actions]);

  const setImages = useCallback(
    (images: TMDBImages) => {
      actions.setData({ images });
    },
    [actions]
  );

  // Loading setters
  const setLoadingPreview = useCallback(
    (loading: boolean) => {
      actions.setLoading(LOADING_KEYS.preview, loading);
    },
    [actions]
  );

  const setLoadingImages = useCallback(
    (loading: boolean) => {
      actions.setLoading(LOADING_KEYS.images, loading);
    },
    [actions]
  );

  const setLoadingApply = useCallback(
    (loading: boolean) => {
      actions.setLoading(LOADING_KEYS.apply, loading);
    },
    [actions]
  );

  // Error handling
  const setError = useCallback(
    (error: string | null) => {
      actions.setError(error);
    },
    [actions]
  );

  // Build final result
  const getResult = useCallback((): TMDBWizardResult => {
    const data = state.data;
    const poster = data.poster;
    const backdrop = data.backdrop;
    const logo = data.logo;
    const still = data.still;
    const contentType = data.contentType ?? "movie";

    // These should always be set from initialData, but provide safe defaults
    if (!data.tmdbResult) {
      throw new Error("TMDB result is required but was not set");
    }
    if (!data.preview) {
      throw new Error("Preview data is required but was not set");
    }

    return {
      tmdbResult: data.tmdbResult,
      textOptions: data.textOptions ?? {
        updateName: true,
        updateDescription: true,
      },
      preview: data.preview,
      contentType,
      poster: poster?.skipped
        ? null
        : poster?.value
          ? { value: poster.value, source: poster.source }
          : null,
      backdrop: backdrop?.skipped
        ? null
        : backdrop?.value
          ? { value: backdrop.value, source: backdrop.source }
          : null,
      logo: logo?.skipped
        ? null
        : logo?.value
          ? { value: logo.value, source: logo.source }
          : null,
      still: still?.skipped
        ? null
        : still?.value
          ? { value: still.value, source: still.source }
          : null,
      displayOptions: data.displayOptions ?? DEFAULT_TMDB_DISPLAY,
    };
  }, [state.data]);

  return {
    currentStep: state.currentStep,
    data: state.data,
    error: state.error,
    canGoBack,

    // Loading states
    isLoadingPreview: isLoading(LOADING_KEYS.preview),
    isLoadingImages: isLoading(LOADING_KEYS.images),
    isLoadingApply: isLoading(LOADING_KEYS.apply),

    // Navigation
    goToStep,
    goBack,
    reset,

    // Data setters
    setData,
    setTextOptions,
    setPoster,
    skipPoster,
    setBackdrop,
    skipBackdrop,
    setLogo,
    skipLogo,
    setStill,
    skipStill,
    setImages,

    // Loading setters
    setLoadingPreview,
    setLoadingImages,
    setLoadingApply,

    // Error handling
    setError,

    // Result
    getResult,
  };
}
