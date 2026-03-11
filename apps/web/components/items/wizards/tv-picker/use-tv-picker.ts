/**
 * Hook for managing TV picker wizard state.
 * Wraps useWizardMachine with TV picker-specific logic.
 */

import { useCallback, useMemo, useState } from "react";
import { useWizardMachine } from "@/components/wizards/use-wizard-machine";
import type {
  TVPickerLevel,
  TVPickerData,
  TVPickerInitialData,
  TVPickerResult,
  TVPickerSelection,
  TVPickerContentType,
} from "./tv-picker-types";
import type { TMDBSeasonSummary, TMDBEpisode } from "@/lib/tmdb-client";

/**
 * Loading state keys for TV picker.
 */
const LOADING_KEYS = {
  SEASONS: "seasons",
  EPISODES: "episodes",
} as const;

/**
 * Hook for managing TV picker state.
 * Provides level navigation, data management, and result extraction.
 *
 * @param initialData - Initial TMDB result for the TV show
 * @returns Picker state and actions
 */
export function useTVPicker(initialData: TVPickerInitialData) {
  const machine = useWizardMachine<TVPickerLevel, TVPickerData>("show", {
    tmdbResult: initialData.tmdbResult,
    seasons: [],
    selectedSeason: null,
    episodes: [],
    previouslyFocusedSeasonIndex: null,
  });

  // Track focused season index for keyboard navigation
  const [focusedSeasonIndex, setFocusedSeasonIndex] = useState(0);

  /**
   * Whether currently loading seasons.
   */
  const isLoadingSeasons = machine.isLoading(LOADING_KEYS.SEASONS);

  /**
   * Whether currently loading episodes.
   */
  const isLoadingEpisodes = machine.isLoading(LOADING_KEYS.EPISODES);

  /**
   * Sets loading state for seasons.
   */
  const setLoadingSeasons = useCallback(
    (loading: boolean) => {
      machine.actions.setLoading(LOADING_KEYS.SEASONS, loading);
    },
    [machine.actions]
  );

  /**
   * Sets loading state for episodes.
   */
  const setLoadingEpisodes = useCallback(
    (loading: boolean) => {
      machine.actions.setLoading(LOADING_KEYS.EPISODES, loading);
    },
    [machine.actions]
  );

  /**
   * Updates picker data.
   */
  const setData = useCallback(
    (data: Partial<TVPickerData>) => {
      machine.actions.setData(data);
    },
    [machine.actions]
  );

  /**
   * Sets seasons data.
   */
  const setSeasons = useCallback(
    (seasons: TMDBSeasonSummary[]) => {
      setData({ seasons });
    },
    [setData]
  );

  /**
   * Sets episodes data.
   */
  const setEpisodes = useCallback(
    (episodes: TMDBEpisode[]) => {
      setData({ episodes });
    },
    [setData]
  );

  /**
   * Navigates to a season (drill down from show to season level).
   * Stores the focused index for focus restoration on back.
   */
  const navigateToSeason = useCallback(
    (season: TMDBSeasonSummary, index: number) => {
      machine.actions.next("season", {
        selectedSeason: season,
        episodes: [],
        previouslyFocusedSeasonIndex: index,
      });
    },
    [machine.actions]
  );

  /**
   * Goes back to show level from season.
   * Restores focus to the previously selected season card.
   */
  const goBack = useCallback(() => {
    if (machine.state.currentStep === "season") {
      // Store the index to restore focus
      const previousIndex =
        machine.state.data.previouslyFocusedSeasonIndex ?? 0;
      machine.actions.back();
      setData({ selectedSeason: null, episodes: [] });
      // Restore focus index
      setFocusedSeasonIndex(previousIndex);
    }
  }, [machine.state.currentStep, machine.state.data, machine.actions, setData]);

  /**
   * Sets error state.
   */
  const setError = useCallback(
    (error: string | null) => {
      machine.actions.setError(error);
    },
    [machine.actions]
  );

  /**
   * Gets the content type from a selection.
   */
  const getContentType = useCallback(
    (selection: TVPickerSelection): TVPickerContentType => {
      return selection.type;
    },
    []
  );

  /**
   * Gets the result for a specific selection.
   */
  const getResult = useCallback(
    (
      selection: TVPickerSelection,
      selectedEpisode?: TMDBEpisode
    ): TVPickerResult => {
      return {
        selection,
        contentType: getContentType(selection),
        tmdbResult: machine.state.data.tmdbResult!,
        selectedSeason: machine.state.data.selectedSeason || null,
        selectedEpisode: selectedEpisode || null,
      };
    },
    [machine.state.data, getContentType]
  );

  /**
   * Current picker data with defaults.
   */
  const data = useMemo(
    (): TVPickerData => ({
      tmdbResult: machine.state.data.tmdbResult || initialData.tmdbResult,
      seasons: machine.state.data.seasons || [],
      selectedSeason: machine.state.data.selectedSeason || null,
      episodes: machine.state.data.episodes || [],
      previouslyFocusedSeasonIndex:
        machine.state.data.previouslyFocusedSeasonIndex ?? null,
    }),
    [machine.state.data, initialData.tmdbResult]
  );

  /**
   * Current navigation level.
   */
  const currentLevel = machine.state.currentStep;

  return {
    // Current state
    currentLevel,
    data,
    error: machine.state.error,
    canGoBack: machine.canGoBack,

    // Loading states
    isLoadingSeasons,
    isLoadingEpisodes,
    setLoadingSeasons,
    setLoadingEpisodes,

    // Data management
    setData,
    setSeasons,
    setEpisodes,
    setError,

    // Navigation
    navigateToSeason,
    goBack,

    // Focus management
    focusedSeasonIndex,
    setFocusedSeasonIndex,

    // Result
    getResult,
  };
}
