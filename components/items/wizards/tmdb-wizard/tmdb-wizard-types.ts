/**
 * Type definitions for the TMDB metadata wizard.
 * Defines the wizard steps, accumulated data, and callback interfaces.
 */

import type {
  TMDBSearchResult,
  TMDBImages,
  TMDBSeasonImages,
  TMDBEpisodeImages,
} from "@/lib/tmdb-client";
import type {
  ArtworkSelectionSource,
  QueuedFile,
  SerializedItemFile,
  TmdbDisplayOptions,
} from "@/lib/types";
import { DEFAULT_TMDB_DISPLAY } from "@/lib/types";
import type {
  CurrentTextValues,
  TextPreviewData,
  TitleDescriptionOptions,
} from "./title-description-step";

// Re-export for convenience
export type {
  CurrentTextValues,
  TextPreviewData,
  TitleDescriptionOptions,
} from "./title-description-step";

/**
 * Wizard step identifiers for the TMDB metadata flow.
 * Flow varies by content type:
 * - Movie/Show: text -> poster -> hero -> logo -> summary
 * - Season: text -> poster -> summary (no hero or logo)
 * - Episode: text -> still -> summary (stills instead of poster)
 */
export type TMDBWizardStep =
  | "text"
  | "poster"
  | "hero"
  | "logo"
  | "still"
  | "summary";

/**
 * Content type determines which wizard steps are shown.
 */
export type TMDBWizardContentType = "movie" | "show" | "season" | "episode";

/**
 * All TMDB wizard steps in order (full flow for movies/shows).
 */
export const TMDB_WIZARD_STEPS: readonly TMDBWizardStep[] = [
  "text",
  "poster",
  "hero",
  "logo",
  "summary",
] as const;

/**
 * Human-readable labels for each wizard step.
 */
export const TMDB_WIZARD_STEP_LABELS: Record<TMDBWizardStep, string> = {
  text: "Title & Description",
  poster: "Poster",
  hero: "Hero Image",
  logo: "Logo",
  still: "Still Image",
  summary: "Review",
};

/**
 * Gets the visible steps based on content type.
 * Artwork steps are always shown — TMDB images are served from CDN
 * and don't require a Google Drive connection.
 *
 * @param contentType - Content type (movie, show, season, episode)
 * @returns Array of visible wizard steps
 */
export function getVisibleSteps(
  contentType: TMDBWizardContentType
): TMDBWizardStep[] {
  switch (contentType) {
    case "movie":
    case "show":
      return ["text", "poster", "hero", "logo", "summary"];
    case "season":
      // Seasons have posters but no backdrops/heroes or logos
      return ["text", "poster", "summary"];
    case "episode":
      // Episodes have stills instead of posters, no logos
      return ["text", "still", "summary"];
    default:
      return ["text", "poster", "hero", "logo", "summary"];
  }
}

/**
 * Artwork selection state for poster or hero.
 * Tracks the selected value, its source, and skip state.
 */
export interface ArtworkSelection {
  /** Selected TMDB path, existing file ID, or queued file ID */
  value: string | null;
  /** Source of the selection */
  source: ArtworkSelectionSource | null;
  /** Whether this artwork selection was skipped */
  skipped: boolean;
}

/**
 * Data accumulated across TMDB wizard steps.
 * Built up as user progresses through the wizard.
 */
export interface TMDBWizardData {
  /** The TMDB search result that initiated this wizard */
  tmdbResult: TMDBSearchResult;

  /** Text preview data fetched from TMDB */
  preview: TextPreviewData;

  /** Content type determines which steps are shown */
  contentType: TMDBWizardContentType;

  /** TMDB images for show/movie poster/backdrop selection (null if not fetched yet) */
  images: TMDBImages | null;

  /** TMDB season images for season poster selection */
  seasonImages: TMDBSeasonImages | null;

  /** TMDB episode images for episode still selection */
  episodeImages: TMDBEpisodeImages | null;

  /** Title and description update options */
  textOptions: TitleDescriptionOptions;

  /** Poster selection state */
  poster: ArtworkSelection;

  /** Hero/backdrop selection state */
  backdrop: ArtworkSelection;

  /** Logo selection state (for movies/shows) */
  logo: ArtworkSelection;

  /** Still selection state (for episodes) */
  still: ArtworkSelection;

  /** Per-item TMDB display preferences */
  displayOptions: TmdbDisplayOptions;
}

/**
 * Initial data required to start the TMDB wizard.
 */
export interface TMDBWizardInitialData {
  /** The TMDB search result to start with */
  tmdbResult: TMDBSearchResult;
  /** Text preview data from TMDB */
  preview: TextPreviewData;
  /** Content type for step configuration */
  contentType?: TMDBWizardContentType;
}

/**
 * Props passed to the renderHeader callback.
 * Allows parent dialogs to render wizard step indicator in their header.
 */
export interface TMDBWizardHeaderProps {
  /** Array of visible steps for the step indicator */
  steps: TMDBWizardStep[];
  /** Current wizard step */
  currentStep: TMDBWizardStep;
  /** Human-readable labels for each step */
  stepLabels: Record<TMDBWizardStep, string>;
}

/**
 * Props passed to the renderFooter callback.
 * Allows parent dialogs to render wizard navigation in their footer.
 */
export interface TMDBWizardFooterProps {
  /** Navigate to previous step */
  onBack: () => void;
  /** Navigate to next step or complete wizard */
  onNext: () => void;
  /** Skip all remaining artwork steps */
  onSkipAll?: () => void;
  /** Retry on error */
  onRetry?: () => void;
  /** Whether a loading operation is in progress */
  isLoading: boolean;
  /** Whether buttons should be disabled during transitions */
  isDisabled: boolean;
  /** Whether back navigation is available */
  canGoBack: boolean;
  /** Whether this is the last step */
  isLastStep: boolean;
  /** Current wizard step */
  currentStep: TMDBWizardStep;
  /** Current error message if any */
  error?: string | null;
}

/**
 * Props for the TMDB wizard orchestrator component.
 */
export interface TMDBWizardProps {
  /** Initial data to start the wizard */
  initialData: TMDBWizardInitialData;

  /** Current item text values (for comparison in text step) */
  currentValues: CurrentTextValues;

  /** Whether upload mode is enabled (AddItemDialog) */
  uploadMode: boolean;

  /** Whether user has Google Drive connected */
  hasDriveConnection: boolean;

  /** Queued artwork files for upload mode */
  queuedArtwork?: QueuedFile[];

  /** Queued hero files for upload mode */
  queuedHero?: QueuedFile[];

  /** Callback when artwork files are queued */
  onArtworkQueue?: (files: QueuedFile[]) => void;

  /** Callback when hero files are queued */
  onHeroQueue?: (files: QueuedFile[]) => void;

  /** Existing artwork files for settings dialog mode */
  existingArtwork?: SerializedItemFile[];

  /** Existing hero files for settings dialog mode */
  existingHero?: SerializedItemFile[];

  /** Callback when wizard completes with selections */
  onComplete: (data: TMDBWizardResult) => void;

  /** Render prop for footer (to lift buttons to dialog footer) */
  renderFooter?: (props: TMDBWizardFooterProps) => React.ReactNode;

  /** Render prop for header (to lift step indicator to dialog header) */
  renderHeader?: (props: TMDBWizardHeaderProps) => React.ReactNode;

  /** Callback when header props change (for syncing state to parent via useEffect) */
  onHeaderChange?: (props: TMDBWizardHeaderProps) => void;

  /** Callback when footer props change (for syncing state to parent via useEffect) */
  onFooterChange?: (props: TMDBWizardFooterProps) => void;

  /** Callback when back is pressed on first step (return to search) */
  onCancel?: () => void;
}

/**
 * Result returned when the TMDB wizard completes.
 * Contains all user selections for applying to the item.
 */
export interface TMDBWizardResult {
  /** Original TMDB search result */
  tmdbResult: TMDBSearchResult;

  /** Title and description options */
  textOptions: TitleDescriptionOptions;

  /** Text preview data */
  preview: TextPreviewData;

  /** Content type used for this wizard */
  contentType: TMDBWizardContentType;

  /** Poster selection (null if skipped or not applicable) */
  poster: {
    value: string | null;
    source: ArtworkSelectionSource | null;
  } | null;

  /** Backdrop selection (null if skipped or not applicable) */
  backdrop: {
    value: string | null;
    source: ArtworkSelectionSource | null;
  } | null;

  /** Logo selection (null if skipped or not applicable) */
  logo: {
    value: string | null;
    source: ArtworkSelectionSource | null;
  } | null;

  /** Still selection for episodes (null if skipped or not applicable) */
  still: {
    value: string | null;
    source: ArtworkSelectionSource | null;
  } | null;

  /** Per-item TMDB display preferences */
  displayOptions: TmdbDisplayOptions;
}

/**
 * Loading state keys for the TMDB wizard.
 */
export type TMDBWizardLoadingKey = "preview" | "images" | "apply";

/**
 * Props for individual step components.
 * Provides access to wizard state and navigation actions.
 */
export interface TMDBStepProps {
  /** Full wizard data state */
  data: Partial<TMDBWizardData>;

  /** Current item text values for comparison */
  currentValues: CurrentTextValues;

  /** Whether a loading operation is in progress */
  isLoading: boolean;

  /** Current error message */
  error: string | null;

  /** Whether back navigation is possible */
  canGoBack: boolean;

  /** Whether to show inline navigation buttons (false when parent handles footer) */
  showNavigation?: boolean;

  /** Navigate to next step with optional data */
  onNext: (data?: Partial<TMDBWizardData>) => void;

  /** Navigate to previous step */
  onBack: () => void;

  /** Update wizard data without navigation */
  onDataChange: (data: Partial<TMDBWizardData>) => void;

  /** Set loading state */
  onLoadingChange: (loading: boolean) => void;

  /** Set error state */
  onError: (error: string | null) => void;
}

/**
 * Extended props for poster/hero step components.
 * Includes file upload functionality.
 */
export interface TMDBArtworkStepProps extends TMDBStepProps {
  /** Whether upload mode is enabled */
  uploadMode: boolean;

  /** Whether user has Google Drive connected */
  hasDriveConnection: boolean;

  /** Queued files (upload mode) */
  queuedFiles?: QueuedFile[];

  /** Callback to queue files */
  onFilesQueue?: (files: QueuedFile[]) => void;

  /** Existing files (settings mode) */
  existingFiles?: SerializedItemFile[];

  /** Callback when step is skipped */
  onSkip: () => void;
}

/**
 * Props for the summary step component.
 */
export interface TMDBSummaryStepProps extends TMDBStepProps {
  /** Navigate to a specific step for editing */
  onEditStep: (step: TMDBWizardStep) => void;

  /** Complete the wizard with current selections */
  onApply: () => void;

  /** Queued artwork files for preview */
  queuedArtwork?: QueuedFile[];

  /** Queued hero files for preview */
  queuedHero?: QueuedFile[];
}

/**
 * Converts ExistingArtworkFile from ImageSelectionGrid to SerializedItemFile subset.
 * Used for compatibility with existing components.
 */
export interface ExistingArtworkFile {
  id: string;
  filename: string;
  driveFileId: string | null;
}

/**
 * Converts SerializedItemFile to ExistingArtworkFile for ImageSelectionGrid.
 *
 * @param file - Serialized item file
 * @returns ExistingArtworkFile compatible object
 */
export function toExistingArtworkFile(
  file: SerializedItemFile
): ExistingArtworkFile {
  return {
    id: file.id,
    filename: file.filename,
    driveFileId: file.driveFileId,
  };
}

/**
 * Derives content type from initial data.
 *
 * @param initialData - Initial data to check
 * @returns Content type for the wizard
 */
function deriveContentType(
  initialData: TMDBWizardInitialData
): TMDBWizardContentType {
  if (initialData.contentType) {
    return initialData.contentType;
  }
  // Default based on media type
  return initialData.tmdbResult.mediaType === "tv" ? "show" : "movie";
}

/**
 * Creates initial TMDB wizard data from initial props.
 *
 * @param initialData - Initial data to populate wizard
 * @returns Partial wizard data ready for reducer
 */
export function createInitialTMDBWizardData(
  initialData: TMDBWizardInitialData
): Partial<TMDBWizardData> {
  const contentType = deriveContentType(initialData);

  return {
    tmdbResult: initialData.tmdbResult,
    preview: initialData.preview,
    contentType,
    images: null,
    seasonImages: null,
    episodeImages: null,
    textOptions: {
      updateName: true,
      updateDescription: true,
    },
    poster: {
      value: null,
      source: null,
      skipped: false,
    },
    backdrop: {
      value: null,
      source: null,
      skipped: false,
    },
    logo: {
      value: null,
      source: null,
      skipped: false,
    },
    still: {
      value: null,
      source: null,
      skipped: false,
    },
    displayOptions: { ...DEFAULT_TMDB_DISPLAY },
  };
}
