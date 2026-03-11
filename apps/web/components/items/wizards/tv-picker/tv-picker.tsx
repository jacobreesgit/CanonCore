/**
 * TV picker wizard orchestrator component.
 * Coordinates navigation between show and season views.
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { getSeasonsAction, getEpisodesAction } from "@/lib/tmdb-actions";
import { useTVPicker } from "./use-tv-picker";
import { ShowView } from "./show-view";
import { SeasonView } from "./season-view";
import { SelectionFooter } from "./selection-footer";
import { getLevelChangeAnnouncement } from "./tv-picker-types";
import type { TVPickerProps } from "./tv-picker-types";
import type { TMDBSeasonSummary, TMDBEpisode } from "@/lib/tmdb-client";

/**
 * TV picker wizard component.
 * Guides users through selecting a show, season, or episode.
 *
 * @param initialData - Initial TMDB result for the TV show
 * @param onComplete - Callback when picker completes with a selection
 * @param onCancel - Callback when picker is cancelled
 * @param renderFooter - Optional render prop for footer (to lift to dialog level)
 * @param onLevelChange - Optional callback when navigation level changes
 */
export function TVPicker({
  initialData,
  onComplete,
  onCancel,
  renderFooter,
  onLevelChange,
}: TVPickerProps) {
  const picker = useTVPicker(initialData);
  const fetchedSeasonsRef = useRef(false);
  const prefersReducedMotion = useReducedMotion();

  // Announcement state for screen readers
  const [announcement, setAnnouncement] = useState("");

  // Extract stable functions from picker to avoid object reference in dependency array
  const {
    setLoadingSeasons,
    setError,
    setSeasons,
    setLoadingEpisodes,
    setEpisodes,
  } = picker;

  /**
   * Fetches seasons when component mounts.
   */
  useEffect(() => {
    if (fetchedSeasonsRef.current) return;
    fetchedSeasonsRef.current = true;

    const fetchSeasons = async () => {
      setLoadingSeasons(true);
      setError(null);

      try {
        const result = await getSeasonsAction(initialData.tmdbResult.id);
        if (result.success && result.data) {
          setSeasons(result.data);
        } else if (!result.success) {
          setError(result.error);
        } else {
          setError("Failed to load seasons");
        }
      } catch {
        setError("Failed to load seasons");
      } finally {
        setLoadingSeasons(false);
      }
    };

    fetchSeasons();
  }, [initialData.tmdbResult.id, setLoadingSeasons, setError, setSeasons]);

  /**
   * Handles season selection - fetches episodes and navigates.
   */
  const handleSeasonSelect = useCallback(
    async (season: TMDBSeasonSummary, index: number) => {
      picker.navigateToSeason(season, index);
      setLoadingEpisodes(true);
      setError(null);

      // Notify parent of level change
      onLevelChange?.("season");

      // Announce level change
      setAnnouncement(
        getLevelChangeAnnouncement("season", season.name, season.episode_count)
      );

      try {
        const result = await getEpisodesAction(
          initialData.tmdbResult.id,
          season.season_number
        );
        if (result.success && result.data) {
          setEpisodes(result.data);
        } else if (!result.success) {
          setError(result.error);
        } else {
          setError("Failed to load episodes");
        }
      } catch {
        setError("Failed to load episodes");
      } finally {
        setLoadingEpisodes(false);
      }
    },
    [
      initialData.tmdbResult.id,
      picker,
      setLoadingEpisodes,
      setError,
      setEpisodes,
      onLevelChange,
    ]
  );

  /**
   * Handles using the entire show.
   */
  const handleUseShow = useCallback(() => {
    const result = picker.getResult({ type: "show" });
    onComplete(result);
  }, [picker, onComplete]);

  /**
   * Handles using the selected season.
   */
  const handleUseSeason = useCallback(() => {
    if (!picker.data.selectedSeason) return;
    const result = picker.getResult({
      type: "season",
      seasonNumber: picker.data.selectedSeason.season_number,
    });
    onComplete(result);
  }, [picker, onComplete]);

  /**
   * Handles selection based on current level.
   */
  const handleUseSelection = useCallback(() => {
    if (picker.currentLevel === "show") {
      handleUseShow();
    } else {
      handleUseSeason();
    }
  }, [picker.currentLevel, handleUseShow, handleUseSeason]);

  /**
   * Handles episode selection.
   */
  const handleEpisodeSelect = useCallback(
    (episode: TMDBEpisode) => {
      if (!picker.data.selectedSeason) return;
      const result = picker.getResult(
        {
          type: "episode",
          seasonNumber: picker.data.selectedSeason.season_number,
          episodeNumber: episode.episode_number,
        },
        episode
      );
      onComplete(result);
    },
    [picker, onComplete]
  );

  /**
   * Handles back navigation.
   */
  const handleBack = useCallback(() => {
    picker.goBack();
    // Notify parent of level change
    onLevelChange?.("show");
    // Announce level change
    setAnnouncement(getLevelChangeAnnouncement("show"));
  }, [picker, onLevelChange]);

  // Determine loading state
  const isLoading =
    picker.currentLevel === "show"
      ? picker.isLoadingSeasons
      : picker.isLoadingEpisodes;

  // Footer props for render prop pattern
  const footerProps = {
    level: picker.currentLevel,
    onUseSelection: handleUseSelection,
    onCancel,
    onBack: handleBack,
    isDisabled: isLoading,
  };

  return (
    <div className="space-y-4">
      {/* Screen reader announcements */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {announcement}
      </div>

      {/* Animated view content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={picker.currentLevel}
          initial={prefersReducedMotion ? false : { opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: -10 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.15 }}
        >
          {picker.currentLevel === "season" && picker.data.selectedSeason ? (
            <SeasonView
              data={picker.data}
              selectedSeason={picker.data.selectedSeason}
              isLoading={picker.isLoadingEpisodes}
              error={picker.error}
              onEpisodeSelect={handleEpisodeSelect}
            />
          ) : (
            <ShowView
              data={picker.data}
              isLoading={picker.isLoadingSeasons}
              error={picker.error}
              onSeasonSelect={handleSeasonSelect}
              focusedIndex={picker.focusedSeasonIndex}
              onFocusChange={picker.setFocusedSeasonIndex}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Footer - either via render prop or inline */}
      {renderFooter ? (
        renderFooter(footerProps)
      ) : (
        <div className="border-t pt-4">
          <SelectionFooter {...footerProps} />
        </div>
      )}
    </div>
  );
}
