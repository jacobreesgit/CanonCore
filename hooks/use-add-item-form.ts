/**
 * Shared hook for add item form state management.
 * Extracted from AddItemDialog to be reused by both the desktop dialog
 * and mobile sheet. Manages form fields, file queues, upload progress,
 * step navigation, TMDB wizard state, and artwork selection.
 */

"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useReducedMotion } from "motion/react";
import { toast } from "sonner";
import {
  getMetadataPreviewAction,
  getEpisodePreviewAction,
  getSeasonMetadataAction,
} from "@/lib/tmdb-actions";
import {
  getPosterUrl,
  getBackdropUrl,
  type TMDBSearchResult,
  type TMDBImages,
} from "@/lib/tmdb-client";
import type {
  QueuedFile,
  QueuedFilesByCategory,
  TMDBMetadataSelection,
  ArtworkSelectionSource,
} from "@/lib/types";
import { createUploadSessions, confirmUpload } from "@/lib/google-drive-upload";
import {
  BatchUploadManager,
  formatBytes,
  type UploadState,
} from "@/lib/upload-utils";
import type {
  CurrentTextValues,
  TextPreviewData,
  TitleDescriptionOptions,
} from "@/components/items/wizards/tmdb-wizard/title-description-step";
import type {
  TMDBWizardResult,
  TMDBWizardHeaderProps,
  TMDBWizardFooterProps,
} from "@/components/items/wizards/tmdb-wizard";
import type {
  TVPickerResult,
  TVPickerSelection,
  TVPickerLevel,
} from "@/components/items/wizards/tv-picker";

/** Steps for add item dialog navigation. */
export type AddItemStep =
  | "main"
  | "episode-picker"
  | "tmdb-wizard"
  | "wizard-summary"
  | "change-poster"
  | "change-hero";

/**
 * Initial state for categorized queued files.
 */
const initialQueuedFiles: QueuedFilesByCategory = {
  media: [],
  artwork: [],
  hero: [],
  subtitle: [],
};

/**
 * Transforms categorized queued files into a flat array with proper flags.
 *
 * @param queuedFiles - Categorized queued files
 * @returns Flat array of QueuedFile with proper flags set
 */
function prepareFilesForUpload(
  queuedFiles: QueuedFilesByCategory
): QueuedFile[] {
  const result: QueuedFile[] = [];

  queuedFiles.media.forEach((file, index) => {
    result.push({ ...file, isPrimary: index === 0, isHero: false });
  });

  queuedFiles.artwork.forEach((file, index) => {
    result.push({ ...file, isPrimary: index === 0, isHero: false });
  });

  queuedFiles.hero.forEach((file, index) => {
    result.push({ ...file, isPrimary: false, isHero: index === 0 });
  });

  queuedFiles.subtitle.forEach((file, index) => {
    result.push({ ...file, isPrimary: index === 0, isHero: false });
  });

  return result;
}

/** Upload progress stats for display. */
export interface UploadProgressStats {
  currentFileIndex: number;
  overallPercent: number;
  totalLoaded: number;
  totalSize: number;
  fileCount: number;
}

/** Return type for the useAddItemForm hook. */
export interface UseAddItemFormReturn {
  // Reduced motion preference
  prefersReducedMotion: boolean | null;

  // Step navigation
  currentStep: AddItemStep;
  setCurrentStep: (step: AddItemStep) => void;

  // Form state
  name: string;
  setName: (name: string) => void;
  description: string;
  setDescription: (description: string) => void;
  isLoading: boolean;

  // File queues
  queuedFiles: QueuedFilesByCategory;
  updateCategory: (
    category: keyof QueuedFilesByCategory
  ) => (files: QueuedFile[]) => void;
  totalQueuedCount: number;

  // Upload state
  uploadState: UploadState | null;
  failedFiles: QueuedFile[];
  createdItemId: string | null;
  uploadManagerRef: React.RefObject<BatchUploadManager | null>;
  startUpload: (itemId: string, filesToUpload: QueuedFile[]) => Promise<void>;
  handleRetryUpload: () => Promise<void>;
  handleDismissUpload: () => Promise<void>;
  isUploading: boolean;
  hasUploadError: boolean;
  uploadProgress: UploadProgressStats | null;

  // TV picker state
  tvPickerLevel: TVPickerLevel;
  setTvPickerLevel: (level: TVPickerLevel) => void;
  tvPickerBackRef: React.RefObject<(() => void) | null>;

  // TMDB wizard state (for rendering step indicator in header, buttons in footer)
  wizardHeaderProps: TMDBWizardHeaderProps | null;
  setWizardHeaderProps: (props: TMDBWizardHeaderProps | null) => void;
  wizardFooterProps: TMDBWizardFooterProps | null;
  setWizardFooterProps: (props: TMDBWizardFooterProps | null) => void;

  // TMDB metadata state
  pendingTmdbResult: TMDBSearchResult | null;
  tmdbPreview: TextPreviewData | null;
  tmdbImages: TMDBImages | null;
  isLoadingPreview: boolean;
  selectedTmdbOptions: TMDBMetadataSelection | null;

  // Wizard state
  textOptions: TitleDescriptionOptions;
  setTextOptions: (options: TitleDescriptionOptions) => void;
  posterValue: string | null;
  posterSource: ArtworkSelectionSource | null;
  posterSkipped: boolean;
  backdropValue: string | null;
  backdropSource: ArtworkSelectionSource | null;
  backdropSkipped: boolean;
  contentType: "movie" | "show" | "season" | "episode";
  selectedSeasonNumber: number | null;

  // Temp artwork state (for change-poster/hero steps)
  tempPosterValue: string | null;
  tempPosterSource: ArtworkSelectionSource | null;
  tempPosterSkipped: boolean;
  setTempPosterSkipped: (skipped: boolean) => void;
  tempBackdropValue: string | null;
  tempBackdropSource: ArtworkSelectionSource | null;
  tempBackdropSkipped: boolean;
  setTempBackdropSkipped: (skipped: boolean) => void;

  // Handlers
  handleMediaSelect: (result: TMDBSearchResult) => Promise<void>;
  fetchPreviewAndOpenWizard: (
    tmdbId: number,
    mediaType: "movie" | "tv",
    episodeSel?: TVPickerSelection
  ) => Promise<void>;
  handleEpisodePickerCancel: () => void;
  handleEpisodePickerBack: () => void;
  handleTVPickerComplete: (result: TVPickerResult) => Promise<void>;
  handleTMDBWizardComplete: (result: TMDBWizardResult) => void;
  handleWizardCancel: () => void;

  // Change artwork handlers
  handleOpenChangePoster: () => void;
  handleOpenChangeHero: () => void;
  handleTempPosterSelect: (
    value: string | null,
    source: ArtworkSelectionSource
  ) => void;
  handleTempBackdropSelect: (
    value: string | null,
    source: ArtworkSelectionSource
  ) => void;
  handleSavePosterChange: () => void;
  handleSaveHeroChange: () => void;
  handleCancelArtworkChange: () => void;
  handleClearPoster: () => void;
  handleClearBackdrop: () => void;

  // Submit
  handleSubmit: () => Promise<void>;

  // Computed
  displayTitle: string;
  currentValues: CurrentTextValues;
  showArtworkSection: boolean;

  // Reset
  resetForm: () => void;
  resetWizardState: () => void;

  // Utilities re-exported for convenience
  getPosterUrl: typeof getPosterUrl;
  getBackdropUrl: typeof getBackdropUrl;
  formatBytes: typeof formatBytes;
}

/**
 * Manages all add item form state, shared between desktop AddItemDialog
 * and mobile surfaces. Handles form fields, file queues, upload progress,
 * step navigation, TMDB wizard state, and artwork selection.
 *
 * @param onAdd - Async callback to create item, returns itemId or error
 * @param onComplete - Optional callback after item and files are fully created
 * @param onOpenChange - Callback when dialog open state changes
 * @param hasDriveConnection - Whether user has Google Drive connected
 * @param parentName - Optional parent item name for context
 * @returns Form state, handlers, and wizard navigation
 */
export function useAddItemForm(
  onAdd: (
    name: string,
    description?: string,
    tmdbSelection?: TMDBMetadataSelection
  ) => Promise<{ itemId?: string; error?: string }>,
  onComplete?: () => Promise<void>,
  onOpenChange?: (open: boolean) => void,
  hasDriveConnection: boolean = false,
  _parentName?: string
): UseAddItemFormReturn {
  // Respect user's reduced motion preference
  const prefersReducedMotion = useReducedMotion();

  // Current step
  const [currentStep, setCurrentStep] = useState<AddItemStep>("main");

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Upload state
  const [uploadState, setUploadState] = useState<UploadState | null>(null);
  const [failedFiles, setFailedFiles] = useState<QueuedFile[]>([]);
  const [createdItemId, setCreatedItemId] = useState<string | null>(null);
  const uploadManagerRef = useRef<BatchUploadManager | null>(null);

  // Categorized file queue state
  const [queuedFiles, setQueuedFiles] =
    useState<QueuedFilesByCategory>(initialQueuedFiles);

  // TV picker level state (for level-aware back navigation)
  const [tvPickerLevel, setTvPickerLevel] = useState<TVPickerLevel>("show");
  const tvPickerBackRef = useRef<(() => void) | null>(null);

  // TMDB wizard state (for rendering step indicator in header, buttons in footer)
  const [wizardHeaderProps, setWizardHeaderProps] =
    useState<TMDBWizardHeaderProps | null>(null);
  const [wizardFooterProps, setWizardFooterProps] =
    useState<TMDBWizardFooterProps | null>(null);

  // TMDB metadata state
  const [pendingTmdbResult, setPendingTmdbResult] =
    useState<TMDBSearchResult | null>(null);
  const [tmdbPreview, setTmdbPreview] = useState<TextPreviewData | null>(null);
  const [tmdbImages, setTmdbImages] = useState<TMDBImages | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [selectedTmdbOptions, setSelectedTmdbOptions] =
    useState<TMDBMetadataSelection | null>(null);

  // Wizard state
  const [textOptions, setTextOptions] = useState<TitleDescriptionOptions>({
    updateName: true,
    updateDescription: true,
  });
  const [posterValue, setPosterValue] = useState<string | null>(null);
  const [posterSource, setPosterSource] =
    useState<ArtworkSelectionSource | null>(null);
  const [posterSkipped, setPosterSkipped] = useState(false);
  const [backdropValue, setBackdropValue] = useState<string | null>(null);
  const [backdropSource, setBackdropSource] =
    useState<ArtworkSelectionSource | null>(null);
  const [backdropSkipped, setBackdropSkipped] = useState(false);
  // Wizard context: content type and season number (set together)
  const [wizardContext, setWizardContext] = useState({
    contentType: "movie" as "movie" | "show" | "season" | "episode",
    selectedSeasonNumber: null as number | null,
  });
  const { contentType, selectedSeasonNumber } = wizardContext;

  // Temporary artwork state for change-poster/hero steps (allows cancel without losing original)
  const [tempArtwork, setTempArtwork] = useState({
    posterValue: null as string | null,
    posterSource: null as ArtworkSelectionSource | null,
    posterSkipped: false,
    backdropValue: null as string | null,
    backdropSource: null as ArtworkSelectionSource | null,
    backdropSkipped: false,
  });
  const {
    posterValue: tempPosterValue,
    posterSource: tempPosterSource,
    posterSkipped: tempPosterSkipped,
    backdropValue: tempBackdropValue,
    backdropSource: tempBackdropSource,
    backdropSkipped: tempBackdropSkipped,
  } = tempArtwork;

  /**
   * Resets wizard-specific state.
   */
  const resetWizardState = useCallback(() => {
    setTextOptions({ updateName: true, updateDescription: true });
    setPosterValue(null);
    setPosterSource(null);
    setPosterSkipped(false);
    setBackdropValue(null);
    setBackdropSource(null);
    setBackdropSkipped(false);
    setWizardContext({
      contentType: "movie",
      selectedSeasonNumber: null,
    });
  }, []);

  /**
   * Resets all form state. Called when dialog opens.
   */
  const resetForm = useCallback(() => {
    setCurrentStep("main");
    setName("");
    setDescription("");
    setIsLoading(false);
    setQueuedFiles(initialQueuedFiles);
    setPendingTmdbResult(null);
    setTmdbPreview(null);
    setTmdbImages(null);
    setSelectedTmdbOptions(null);
    // Reset upload state
    setUploadState(null);
    setFailedFiles([]);
    setCreatedItemId(null);
    uploadManagerRef.current?.cancel();
    uploadManagerRef.current = null;
    resetWizardState();
  }, [resetWizardState]);

  // Pre-select first poster and backdrop when images load
  // Extract primitive values to avoid object reference changes triggering effect
  const firstPosterPath = tmdbImages?.posters?.[0]?.file_path ?? null;
  const firstBackdropPath = tmdbImages?.backdrops?.[0]?.file_path ?? null;

  useEffect(() => {
    if (firstPosterPath && posterValue === null && !posterSkipped) {
      setPosterValue(firstPosterPath);
      setPosterSource("tmdb");
    }
    if (firstBackdropPath && backdropValue === null && !backdropSkipped) {
      setBackdropValue(firstBackdropPath);
      setBackdropSource("tmdb");
    }
  }, [
    firstPosterPath,
    firstBackdropPath,
    posterValue,
    backdropValue,
    posterSkipped,
    backdropSkipped,
  ]);

  // Clear poster selection when skip is toggled on
  useEffect(() => {
    if (posterSkipped) {
      setPosterValue(null);
      setPosterSource(null);
    }
  }, [posterSkipped]);

  // Clear backdrop selection when skip is toggled on
  useEffect(() => {
    if (backdropSkipped) {
      setBackdropValue(null);
      setBackdropSource(null);
    }
  }, [backdropSkipped]);

  /**
   * Helper to update a specific category in the queued files state.
   */
  const updateCategory = useCallback(
    (category: keyof QueuedFilesByCategory) => (files: QueuedFile[]) => {
      setQueuedFiles((prev) => ({ ...prev, [category]: files }));
    },
    []
  );

  /**
   * Applies basic info from pending result as fallback.
   */
  const applyBasicInfo = useCallback(() => {
    if (!pendingTmdbResult) return;
    const year = pendingTmdbResult.year;
    const displayName = year
      ? `${pendingTmdbResult.title} (${year})`
      : pendingTmdbResult.title;
    setName(displayName);
    setDescription(pendingTmdbResult.overview?.slice(0, 1000) || "");
  }, [pendingTmdbResult]);

  /**
   * Fetches preview data and navigates to wizard.
   */
  const fetchPreviewAndOpenWizard = useCallback(
    async (
      tmdbId: number,
      mediaType: "movie" | "tv",
      episodeSel?: TVPickerSelection
    ) => {
      setIsLoadingPreview(true);
      setTmdbImages(null);
      resetWizardState();

      try {
        if (episodeSel?.type === "episode") {
          // Episode: fetch episode-specific metadata
          const response = await getEpisodePreviewAction(
            tmdbId,
            episodeSel.seasonNumber,
            episodeSel.episodeNumber
          );

          if (response.success && response.data) {
            setTmdbPreview({
              name: response.data.name,
              description: response.data.description,
            });
            // Episodes have no poster/backdrop images
            setTmdbImages({ posters: [], backdrops: [] });
            setWizardContext({
              contentType: "episode",
              selectedSeasonNumber: episodeSel.seasonNumber,
            });
            setCurrentStep("tmdb-wizard");
          } else {
            toast.error("Could not fetch episode preview");
            applyBasicInfo();
            setCurrentStep("main");
          }
        } else if (episodeSel?.type === "season") {
          // Season: fetch season-specific metadata
          const response = await getSeasonMetadataAction(
            tmdbId,
            episodeSel.seasonNumber
          );

          if (response.success && response.data) {
            setTmdbPreview({
              name: response.data.name,
              description: response.data.description,
            });
            setWizardContext({
              contentType: "season",
              selectedSeasonNumber: episodeSel.seasonNumber,
            });
            setCurrentStep("tmdb-wizard");
            // Note: TMDBWizard handles image fetching internally
          } else {
            toast.error("Could not fetch season preview");
            applyBasicInfo();
            setCurrentStep("main");
          }
        } else {
          // Show or Movie: fetch show/movie metadata
          const response = await getMetadataPreviewAction(tmdbId, mediaType);

          if (response.success && response.data) {
            setTmdbPreview({
              name: response.data.name,
              description: response.data.description,
            });
            setWizardContext({
              contentType: mediaType === "tv" ? "show" : "movie",
              selectedSeasonNumber: null,
            });
            setCurrentStep("tmdb-wizard");
            // Note: TMDBWizard handles image fetching internally
          } else {
            toast.error("Could not fetch full preview, basic info applied");
            applyBasicInfo();
            setCurrentStep("main");
          }
        }
      } catch {
        applyBasicInfo();
        setCurrentStep("main");
      } finally {
        setIsLoadingPreview(false);
      }
    },
    [applyBasicInfo, resetWizardState]
  );

  /**
   * Handles TMDB media selection.
   */
  const handleMediaSelect = useCallback(
    async (result: TMDBSearchResult) => {
      setPendingTmdbResult(result);

      if (result.mediaType === "tv") {
        // For TV shows, navigate to episode picker
        setCurrentStep("episode-picker");
        return;
      }

      // For movies, proceed directly to wizard
      await fetchPreviewAndOpenWizard(result.id, result.mediaType);
    },
    [fetchPreviewAndOpenWizard]
  );

  /**
   * Handles episode picker cancellation (back to main).
   */
  const handleEpisodePickerCancel = useCallback(() => {
    setPendingTmdbResult(null);
    setTvPickerLevel("show");
    setCurrentStep("main");
  }, []);

  /**
   * Handles level-aware back navigation for episode picker.
   * At show level: cancels picker and returns to main step.
   * At season level: navigates back to show view within picker.
   */
  const handleEpisodePickerBack = useCallback(() => {
    if (tvPickerLevel === "season" && tvPickerBackRef.current) {
      tvPickerBackRef.current();
    } else {
      handleEpisodePickerCancel();
    }
  }, [tvPickerLevel, handleEpisodePickerCancel]);

  /**
   * Handles TV picker completion.
   */
  const handleTVPickerComplete = useCallback(
    async (result: TVPickerResult) => {
      await fetchPreviewAndOpenWizard(
        result.tmdbResult.id,
        result.tmdbResult.mediaType,
        result.selection
      );
    },
    [fetchPreviewAndOpenWizard]
  );

  /**
   * Handles TMDB wizard completion.
   * Applies the wizard result to the form state and transitions to summary step.
   */
  const handleTMDBWizardComplete = useCallback((result: TMDBWizardResult) => {
    // Apply text fields
    if (result.textOptions.updateName) {
      setName(result.preview.name);
    }
    if (result.textOptions.updateDescription) {
      setDescription(result.preview.description);
    }

    // Apply artwork selections (null means skipped)
    if (result.poster) {
      setPosterValue(result.poster.value);
      setPosterSource(result.poster.source);
      setPosterSkipped(false);
    } else {
      setPosterValue(null);
      setPosterSource(null);
      setPosterSkipped(true);
    }

    if (result.backdrop) {
      setBackdropValue(result.backdrop.value);
      setBackdropSource(result.backdrop.source);
      setBackdropSkipped(false);
    } else {
      setBackdropValue(null);
      setBackdropSource(null);
      setBackdropSkipped(true);
    }

    // Store TMDB selection for item creation
    setSelectedTmdbOptions({
      tmdbId: result.tmdbResult.id,
      mediaType: result.tmdbResult.mediaType,
      options: {
        updateName: result.textOptions.updateName,
        updateDescription: result.textOptions.updateDescription,
        updatePoster:
          result.poster !== null &&
          result.poster.source === "tmdb" &&
          !!result.poster.value,
        updateBackdrop:
          result.backdrop !== null &&
          result.backdrop.source === "tmdb" &&
          !!result.backdrop.value,
      },
      preview: {
        name: result.preview.name,
        description: result.preview.description,
        posterPath:
          result.poster?.source === "tmdb" ? result.poster.value : null,
        backdropPath:
          result.backdrop?.source === "tmdb" ? result.backdrop.value : null,
      },
      displayOptions: result.displayOptions,
    });

    setCurrentStep("wizard-summary");
  }, []);

  /**
   * Handles wizard cancel.
   */
  const handleWizardCancel = useCallback(() => {
    setPendingTmdbResult(null);
    setTmdbPreview(null);
    setTmdbImages(null);
    setCurrentStep("main");
  }, []);

  /**
   * Opens the change-poster step with current values.
   */
  const handleOpenChangePoster = useCallback(() => {
    setTempArtwork((prev) => ({
      ...prev,
      posterValue,
      posterSource,
      posterSkipped,
    }));
    setCurrentStep("change-poster");
  }, [posterValue, posterSource, posterSkipped]);

  /**
   * Opens the change-hero step with current values.
   */
  const handleOpenChangeHero = useCallback(() => {
    setTempArtwork((prev) => ({
      ...prev,
      backdropValue,
      backdropSource,
      backdropSkipped,
    }));
    setCurrentStep("change-hero");
  }, [backdropValue, backdropSource, backdropSkipped]);

  /**
   * Handles temporary poster selection in change mode.
   */
  const handleTempPosterSelect = useCallback(
    (value: string | null, source: ArtworkSelectionSource) => {
      setTempArtwork((prev) => ({
        ...prev,
        posterValue: value,
        posterSource: value ? source : null,
      }));
    },
    []
  );

  /**
   * Handles temporary backdrop selection in change mode.
   */
  const handleTempBackdropSelect = useCallback(
    (value: string | null, source: ArtworkSelectionSource) => {
      setTempArtwork((prev) => ({
        ...prev,
        backdropValue: value,
        backdropSource: value ? source : null,
      }));
    },
    []
  );

  /**
   * Saves the poster change and returns to wizard-summary.
   */
  const handleSavePosterChange = useCallback(() => {
    setPosterValue(tempPosterSkipped ? null : tempPosterValue);
    setPosterSource(tempPosterSkipped ? null : tempPosterSource);
    setPosterSkipped(tempPosterSkipped);
    setCurrentStep("wizard-summary");
  }, [tempPosterValue, tempPosterSource, tempPosterSkipped]);

  /**
   * Saves the hero change and returns to wizard-summary.
   */
  const handleSaveHeroChange = useCallback(() => {
    setBackdropValue(tempBackdropSkipped ? null : tempBackdropValue);
    setBackdropSource(tempBackdropSkipped ? null : tempBackdropSource);
    setBackdropSkipped(tempBackdropSkipped);
    setCurrentStep("wizard-summary");
  }, [tempBackdropValue, tempBackdropSource, tempBackdropSkipped]);

  /**
   * Cancels the artwork change and returns to wizard-summary.
   */
  const handleCancelArtworkChange = useCallback(() => {
    setCurrentStep("wizard-summary");
  }, []);

  /**
   * Clears the poster selection.
   */
  const handleClearPoster = useCallback(() => {
    setPosterValue(null);
    setPosterSource(null);
    setPosterSkipped(true);
  }, []);

  /**
   * Clears the backdrop/hero selection.
   */
  const handleClearBackdrop = useCallback(() => {
    setBackdropValue(null);
    setBackdropSource(null);
    setBackdropSkipped(true);
  }, []);

  /**
   * Total count of all queued files across categories.
   */
  const totalQueuedCount = useMemo(() => {
    return (
      queuedFiles.media.length +
      queuedFiles.artwork.length +
      queuedFiles.hero.length +
      queuedFiles.subtitle.length
    );
  }, [queuedFiles]);

  /**
   * Starts file upload for the created item.
   * Shows progress UI and handles errors.
   */
  const startUpload = useCallback(
    async (itemId: string, filesToUpload: QueuedFile[]) => {
      const fileMetadata = filesToUpload.map((f) => ({
        name: f.file.name,
        mimeType: f.file.type || "application/octet-stream",
        fileType: f.fileType,
        isPrimary: f.isPrimary,
        isHero: f.isHero,
      }));

      const uploadResult = await createUploadSessions(
        itemId,
        fileMetadata,
        window.location.origin
      );

      if (!uploadResult.success || !uploadResult.sessions) {
        setUploadState({
          status: "error",
          files: filesToUpload.map((f) => ({
            name: f.file.name,
            progress: 0,
            status: "error",
            error: uploadResult.error || "Failed to create upload session",
          })),
          successCount: 0,
          errorCount: filesToUpload.length,
        });
        setFailedFiles(filesToUpload);
        return;
      }

      const files = filesToUpload.map((f) => f.file);
      const manager = new BatchUploadManager(
        uploadResult.sessions,
        files,
        setUploadState,
        confirmUpload,
        3
      );

      uploadManagerRef.current = manager;
      const finalState = await manager.start();

      // Track failed files for retry
      const failed = filesToUpload.filter(
        (_, i) => finalState.files[i]?.status === "error"
      );
      setFailedFiles(failed);

      // If all succeeded, close dialog
      if (failed.length === 0) {
        await onComplete?.().catch((err) => {
          console.warn("[useAddItemForm] Refetch failed after upload:", err);
        });
        toast.success(`Created "${name}"`);
        onOpenChange?.(false);
      }
    },
    [name, onComplete, onOpenChange]
  );

  /**
   * Retries failed uploads.
   */
  const handleRetryUpload = useCallback(async () => {
    if (!failedFiles.length || !createdItemId) return;
    await startUpload(createdItemId, failedFiles);
  }, [failedFiles, createdItemId, startUpload]);

  /**
   * Dismisses upload errors and closes dialog.
   * Item was created successfully, just files failed.
   */
  const handleDismissUpload = useCallback(async () => {
    uploadManagerRef.current?.cancel();
    uploadManagerRef.current = null;
    setUploadState(null);
    setFailedFiles([]);
    await onComplete?.().catch((err) => {
      console.warn("[useAddItemForm] Refetch failed after dismiss:", err);
    });
    toast.success(`Created "${name}" (some files failed to upload)`);
    onOpenChange?.(false);
  }, [name, onComplete, onOpenChange]);

  /**
   * Submits the form to create the item.
   * Computes TMDB options at submit time to ensure current artwork values are used.
   * Handles file uploads with progress tracking.
   */
  const handleSubmit = useCallback(async () => {
    if (!name.trim() || isLoading || uploadState?.status === "uploading")
      return;

    setIsLoading(true);
    try {
      const desc = description.trim() || undefined;
      const filesToUpload =
        totalQueuedCount > 0 ? prepareFilesForUpload(queuedFiles) : undefined;

      // Compute TMDB options at submit time using current state values
      // This ensures artwork changes made in summary step are included
      let tmdbOptions: TMDBMetadataSelection | undefined;
      if (pendingTmdbResult && tmdbPreview) {
        tmdbOptions = {
          tmdbId: pendingTmdbResult.id,
          mediaType: pendingTmdbResult.mediaType,
          options: {
            updateName: textOptions.updateName,
            updateDescription: textOptions.updateDescription,
            updatePoster:
              !posterSkipped && posterSource === "tmdb" && !!posterValue,
            updateBackdrop:
              !backdropSkipped && backdropSource === "tmdb" && !!backdropValue,
          },
          preview: {
            name: tmdbPreview.name,
            description: tmdbPreview.description,
            posterPath:
              posterSource === "tmdb" && !posterSkipped ? posterValue : null,
            backdropPath:
              backdropSource === "tmdb" && !backdropSkipped
                ? backdropValue
                : null,
          },
        };
      }

      // Create the item (without files)
      const result = await onAdd(name.trim(), desc, tmdbOptions);

      if (result.error || !result.itemId) {
        toast.error(result.error || "Failed to create item");
        return;
      }

      // If no files to upload, we're done
      if (!filesToUpload || filesToUpload.length === 0 || !hasDriveConnection) {
        await onComplete?.().catch((err) => {
          console.warn("[useAddItemForm] Refetch failed after create:", err);
        });
        toast.success(`Created "${name}"`);
        onOpenChange?.(false);
        return;
      }

      // Start file uploads with progress tracking
      setCreatedItemId(result.itemId);
      setIsLoading(false); // Switch from "Creating" to upload progress
      await startUpload(result.itemId, filesToUpload);
    } finally {
      setIsLoading(false);
    }
  }, [
    name,
    description,
    isLoading,
    uploadState,
    totalQueuedCount,
    queuedFiles,
    pendingTmdbResult,
    tmdbPreview,
    textOptions,
    posterSkipped,
    posterSource,
    posterValue,
    backdropSkipped,
    backdropSource,
    backdropValue,
    onAdd,
    hasDriveConnection,
    onComplete,
    onOpenChange,
    startUpload,
  ]);

  // Upload progress stats for display
  const uploadProgress = useMemo<UploadProgressStats | null>(() => {
    if (!uploadState || uploadState.status !== "uploading") return null;

    const currentFileIndex = uploadState.files.findIndex(
      (f) => f.status === "uploading"
    );
    const overallPercent = Math.round(
      uploadState.files.reduce((sum, f) => sum + f.progress, 0) /
        uploadState.files.length
    );
    const totalLoaded = uploadState.files.reduce(
      (sum, f) => sum + (f.loaded || 0),
      0
    );
    const totalSize = uploadState.files.reduce(
      (sum, f) => sum + (f.total || 0),
      0
    );

    return {
      currentFileIndex,
      overallPercent,
      totalLoaded,
      totalSize,
      fileCount: uploadState.files.length,
    };
  }, [uploadState]);

  const isUploading = uploadState?.status === "uploading";
  const hasUploadError =
    uploadState?.status === "error" && failedFiles.length > 0;

  const currentValues: CurrentTextValues = useMemo(
    () => ({
      name: name || "(new item)",
      description: description || null,
    }),
    [name, description]
  );

  // Determine if artwork section should be visible
  // Hide for episodes (no poster/backdrop) and when no TMDB selection in manual mode
  const showArtworkSection = contentType !== "episode";

  // Episode picker display title
  const displayTitle = pendingTmdbResult
    ? pendingTmdbResult.year
      ? `${pendingTmdbResult.title} (${pendingTmdbResult.year})`
      : pendingTmdbResult.title
    : "";

  return {
    // Reduced motion preference
    prefersReducedMotion,

    // Step navigation
    currentStep,
    setCurrentStep,

    // Form state
    name,
    setName,
    description,
    setDescription,
    isLoading,

    // File queues
    queuedFiles,
    updateCategory,
    totalQueuedCount,

    // Upload state
    uploadState,
    failedFiles,
    createdItemId,
    uploadManagerRef,
    startUpload,
    handleRetryUpload,
    handleDismissUpload,
    isUploading,
    hasUploadError,
    uploadProgress,

    // TV picker state
    tvPickerLevel,
    setTvPickerLevel,
    tvPickerBackRef,

    // TMDB wizard state
    wizardHeaderProps,
    setWizardHeaderProps,
    wizardFooterProps,
    setWizardFooterProps,

    // TMDB metadata state
    pendingTmdbResult,
    tmdbPreview,
    tmdbImages,
    isLoadingPreview,
    selectedTmdbOptions,

    // Wizard state
    textOptions,
    setTextOptions,
    posterValue,
    posterSource,
    posterSkipped,
    backdropValue,
    backdropSource,
    backdropSkipped,
    contentType,
    selectedSeasonNumber,

    // Temp artwork state
    tempPosterValue,
    tempPosterSource,
    tempPosterSkipped,
    setTempPosterSkipped: (skipped: boolean) =>
      setTempArtwork((prev) => ({ ...prev, posterSkipped: skipped })),
    tempBackdropValue,
    tempBackdropSource,
    tempBackdropSkipped,
    setTempBackdropSkipped: (skipped: boolean) =>
      setTempArtwork((prev) => ({ ...prev, backdropSkipped: skipped })),

    // Handlers
    handleMediaSelect,
    fetchPreviewAndOpenWizard,
    handleEpisodePickerCancel,
    handleEpisodePickerBack,
    handleTVPickerComplete,
    handleTMDBWizardComplete,
    handleWizardCancel,

    // Change artwork handlers
    handleOpenChangePoster,
    handleOpenChangeHero,
    handleTempPosterSelect,
    handleTempBackdropSelect,
    handleSavePosterChange,
    handleSaveHeroChange,
    handleCancelArtworkChange,
    handleClearPoster,
    handleClearBackdrop,

    // Submit
    handleSubmit,

    // Computed
    displayTitle,
    currentValues,
    showArtworkSection,

    // Reset
    resetForm,
    resetWizardState,

    // Utilities re-exported for convenience
    getPosterUrl,
    getBackdropUrl,
    formatBytes,
  };
}
