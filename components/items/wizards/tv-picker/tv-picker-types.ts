/**
 * Types for TV picker wizard.
 * Handles TV show navigation for selecting shows, seasons, or episodes.
 */

import type {
  TMDBSearchResult,
  TMDBSeasonSummary,
  TMDBEpisode,
} from "@/lib/tmdb-client";

/**
 * TV picker navigation levels.
 * Show is the initial level, season is shown after clicking a season card.
 */
export type TVPickerLevel = "show" | "season";

/**
 * Level labels for accessibility and display.
 */
export const TV_PICKER_LEVEL_LABELS: Record<TVPickerLevel, string> = {
  show: "Select Show or Season",
  season: "Select Season or Episode",
};

/**
 * TV picker selection result.
 * Represents what the user selected (show, season, or episode).
 */
export type TVPickerSelection =
  | { type: "show" }
  | { type: "season"; seasonNumber: number }
  | { type: "episode"; seasonNumber: number; episodeNumber: number };

/**
 * Content type derived from selection.
 * Used by wizard to determine which steps to show.
 */
export type TVPickerContentType = "show" | "season" | "episode";

/**
 * Data accumulated during TV picker navigation.
 */
export interface TVPickerData {
  /** Original TMDB search result for the TV show */
  tmdbResult: TMDBSearchResult;
  /** Available seasons from TMDB */
  seasons: TMDBSeasonSummary[];
  /** Currently selected season (null when on show level) */
  selectedSeason: TMDBSeasonSummary | null;
  /** Episodes for the selected season */
  episodes: TMDBEpisode[];
  /** Index of the previously focused season (for focus restoration) */
  previouslyFocusedSeasonIndex: number | null;
}

/**
 * Initial data required to start the TV picker.
 */
export interface TVPickerInitialData {
  /** TMDB search result for the TV show */
  tmdbResult: TMDBSearchResult;
}

/**
 * Result from completing the TV picker.
 * Includes the selection and TMDB data needed for metadata fetching.
 */
export interface TVPickerResult {
  /** What the user selected */
  selection: TVPickerSelection;
  /** Content type for wizard step configuration */
  contentType: TVPickerContentType;
  /** Original TMDB search result */
  tmdbResult: TMDBSearchResult;
  /** Selected season (if applicable) */
  selectedSeason: TMDBSeasonSummary | null;
  /** Selected episode (if applicable) */
  selectedEpisode: TMDBEpisode | null;
}

/**
 * Props shared by TV picker view components.
 */
export interface TVPickerViewProps {
  /** Current picker data */
  data: Partial<TVPickerData>;
  /** Whether the view is loading */
  isLoading: boolean;
  /** Current error message */
  error: string | null;
}

/**
 * Props for the show view component (initial level).
 */
export interface ShowViewProps extends TVPickerViewProps {
  /** Handler when a season card is selected (drill down) */
  onSeasonSelect: (season: TMDBSeasonSummary, index: number) => void;
  /** Index of the focused season card */
  focusedIndex: number;
  /** Handler when focus changes */
  onFocusChange: (index: number) => void;
}

/**
 * Props for the season view component (after selecting a season).
 */
export interface SeasonViewProps extends TVPickerViewProps {
  /** Currently selected season */
  selectedSeason: TMDBSeasonSummary;
  /** Handler when an episode is selected */
  onEpisodeSelect: (episode: TMDBEpisode) => void;
}

/**
 * Props for the selection footer component.
 */
export interface SelectionFooterProps {
  /** Current navigation level */
  level: TVPickerLevel;
  /** Handler for the primary action (Use This X) */
  onUseSelection: () => void;
  /** Handler for cancel action */
  onCancel: () => void;
  /** Handler for back navigation (season → show) */
  onBack: () => void;
  /** Whether the action is disabled */
  isDisabled?: boolean;
}

/**
 * Props for the TVPicker component.
 */
export interface TVPickerProps {
  /** Initial data to start the picker */
  initialData: TVPickerInitialData;
  /** Callback when picker completes with a selection */
  onComplete: (result: TVPickerResult) => void;
  /** Callback when picker is cancelled */
  onCancel: () => void;
  /** Render prop for footer (to lift buttons to dialog footer) */
  renderFooter?: (props: SelectionFooterProps) => React.ReactNode;
  /** Callback when navigation level changes */
  onLevelChange?: (level: TVPickerLevel) => void;
}

/**
 * Gets the button label for the current level.
 *
 * @param level - Current navigation level
 * @returns Button label text
 */
export function getSelectionButtonLabel(level: TVPickerLevel): string {
  return level === "show" ? "Use This Show" : "Use This Season";
}

/**
 * Gets the aria-live announcement for level changes.
 *
 * @param level - New navigation level
 * @param seasonName - Name of the selected season (for season level)
 * @param episodeCount - Number of episodes in the season
 * @returns Announcement text for screen readers
 */
export function getLevelChangeAnnouncement(
  level: TVPickerLevel,
  seasonName?: string,
  episodeCount?: number
): string {
  if (level === "show") {
    return "Back to show view. Use arrow keys to browse seasons.";
  }
  if (seasonName && episodeCount !== undefined) {
    return `Now viewing ${seasonName}, ${episodeCount} episodes. Use arrow keys to browse episodes.`;
  }
  return "Season view loaded.";
}
