/**
 * Modal dialog for creating new items with tabbed interface.
 * Initially shows Details + Files tabs. After TMDB wizard completes,
 * shows Summary view with artwork previews and files section.
 * Uses step-based navigation for TV episode picker and TMDB metadata wizard.
 * Files are queued by category during creation and uploaded after item is created.
 */

"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import {
  Plus,
  Loader2,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Tv,
  Film,
  ImageIcon,
  FileText,
  Trash2,
  AlertCircle,
  RefreshCw,
  X,
} from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { AnimatedDialogContent } from "@/components/ui/animated-dialog-content";
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { MediaSearchCombobox } from "./media-search-combobox";
import { ItemDialogTabs } from "./item-dialog-tabs";
import { FileTypeCombobox } from "./file-type-combobox";
import {
  TitleDescriptionStep,
  type CurrentTextValues,
  type TextPreviewData,
  type TitleDescriptionOptions,
} from "./title-description-step";
import { PosterSelectionStep } from "./poster-selection-step";
import { HeroSelectionStep } from "./hero-selection-step";
import {
  SeasonItem,
  EpisodeItem,
  LoadingState,
  ErrorState,
} from "./episode-picker-helpers";
import {
  getMetadataPreviewAction,
  getImagesAction,
  getEpisodePreviewAction,
  getSeasonsAction,
  getEpisodesAction,
} from "@/lib/tmdb-actions";
import {
  getPosterUrl,
  getBackdropUrl,
  type TMDBSearchResult,
  type TMDBImages,
  type TMDBSeasonSummary,
  type TMDBEpisode,
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
import { toast } from "sonner";

/** Steps for add item dialog navigation. */
type AddItemStep =
  | "main"
  | "episode-picker"
  | "wizard-text"
  | "wizard-poster"
  | "wizard-hero"
  | "wizard-summary"
  | "change-poster"
  | "change-hero";

/** Episode picker selection type. */
type EpisodePickerSelection =
  | { type: "show" }
  | { type: "season"; seasonNumber: number }
  | { type: "episode"; seasonNumber: number; episodeNumber: number };

/** Result from item creation. */
export interface CreateItemResult {
  /** Created item ID on success */
  itemId?: string;
  /** Error message on failure */
  error?: string;
}

interface AddItemDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog open state changes */
  onOpenChange: (open: boolean) => void;
  /**
   * Callback to create the item (without file uploads).
   * Returns item ID on success, error message on failure.
   * File uploads are handled by the dialog after item creation.
   *
   * @param name - Item name
   * @param description - Optional description
   * @param tmdbSelection - Optional TMDB metadata to apply
   */
  onAdd: (
    name: string,
    description?: string,
    tmdbSelection?: TMDBMetadataSelection
  ) => Promise<CreateItemResult>;
  /** Callback after item and files are fully created (for refreshing data) */
  onComplete?: () => Promise<void>;
  /** Parent item name for context (optional) */
  parentName?: string;
  /** Whether user has Google Drive connected (enables uploads) */
  hasDriveConnection?: boolean;
}

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

/**
 * Modal dialog for creating items with tabbed interface.
 * Uses step-based navigation for TV shows and TMDB metadata wizard.
 *
 * @param open - Whether dialog is visible
 * @param onOpenChange - Callback for visibility changes
 * @param onAdd - Async callback to create item with optional files
 * @param parentName - Optional parent item name for context
 * @param hasDriveConnection - Whether uploads are enabled
 */
export function AddItemDialog({
  open,
  onOpenChange,
  onAdd,
  onComplete,
  parentName,
  hasDriveConnection = false,
}: AddItemDialogProps) {
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

  // TMDB metadata state
  const [pendingTmdbResult, setPendingTmdbResult] =
    useState<TMDBSearchResult | null>(null);
  const [tmdbPreview, setTmdbPreview] = useState<TextPreviewData | null>(null);
  const [tmdbImages, setTmdbImages] = useState<TMDBImages | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isLoadingImages, setIsLoadingImages] = useState(false);
  const [selectedTmdbOptions, setSelectedTmdbOptions] =
    useState<TMDBMetadataSelection | null>(null);

  // Episode picker state
  const [seasons, setSeasons] = useState<TMDBSeasonSummary[]>([]);
  const [episodes, setEpisodes] = useState<TMDBEpisode[]>([]);
  const [selectedSeason, setSelectedSeason] =
    useState<TMDBSeasonSummary | null>(null);
  const [isLoadingSeasons, setIsLoadingSeasons] = useState(false);
  const [isLoadingEpisodes, setIsLoadingEpisodes] = useState(false);
  const [episodeError, setEpisodeError] = useState<string | null>(null);

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
  // Track if this is an episode selection (no artwork available)
  const [isEpisodeMode, setIsEpisodeMode] = useState(false);

  // Temporary state for change-artwork steps (allows cancel without losing original)
  const [tempPosterValue, setTempPosterValue] = useState<string | null>(null);
  const [tempPosterSource, setTempPosterSource] =
    useState<ArtworkSelectionSource | null>(null);
  const [tempPosterSkipped, setTempPosterSkipped] = useState(false);
  const [tempBackdropValue, setTempBackdropValue] = useState<string | null>(
    null
  );
  const [tempBackdropSource, setTempBackdropSource] =
    useState<ArtworkSelectionSource | null>(null);
  const [tempBackdropSkipped, setTempBackdropSkipped] = useState(false);

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
    setIsEpisodeMode(false);
  }, []);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setCurrentStep("main");
      setName("");
      setDescription("");
      setIsLoading(false);
      setQueuedFiles(initialQueuedFiles);
      setPendingTmdbResult(null);
      setTmdbPreview(null);
      setTmdbImages(null);
      setSelectedTmdbOptions(null);
      setSeasons([]);
      setEpisodes([]);
      setSelectedSeason(null);
      setEpisodeError(null);
      // Reset upload state
      setUploadState(null);
      setFailedFiles([]);
      setCreatedItemId(null);
      uploadManagerRef.current?.cancel();
      uploadManagerRef.current = null;
      resetWizardState();
    }
  }, [open, resetWizardState]);

  // Pre-select first poster and backdrop when images load
  useEffect(() => {
    if (tmdbImages?.posters?.[0] && posterValue === null && !posterSkipped) {
      setPosterValue(tmdbImages.posters[0].file_path);
      setPosterSource("tmdb");
    }
    if (
      tmdbImages?.backdrops?.[0] &&
      backdropValue === null &&
      !backdropSkipped
    ) {
      setBackdropValue(tmdbImages.backdrops[0].file_path);
      setBackdropSource("tmdb");
    }
  }, [tmdbImages, posterValue, backdropValue, posterSkipped, backdropSkipped]);

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
      episodeSel?: EpisodePickerSelection
    ) => {
      setIsLoadingPreview(true);
      setTmdbImages(null);
      resetWizardState();

      try {
        if (episodeSel?.type === "episode") {
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
            setIsEpisodeMode(true);
            setCurrentStep("wizard-text");
          } else {
            toast.error("Could not fetch episode preview");
            applyBasicInfo();
            setCurrentStep("main");
          }
        } else {
          const response = await getMetadataPreviewAction(tmdbId, mediaType);

          if (response.success && response.data) {
            setTmdbPreview({
              name: response.data.name,
              description: response.data.description,
            });
            setCurrentStep("wizard-text");

            // Fetch images in the background
            setIsLoadingImages(true);
            getImagesAction(tmdbId, mediaType)
              .then((imagesResponse) => {
                if (imagesResponse.success && imagesResponse.data) {
                  setTmdbImages(imagesResponse.data);
                }
              })
              .finally(() => {
                setIsLoadingImages(false);
              });
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
        setSeasons([]);
        setEpisodes([]);
        setSelectedSeason(null);
        setEpisodeError(null);
        setCurrentStep("episode-picker");

        // Fetch seasons
        setIsLoadingSeasons(true);
        try {
          const seasonsResult = await getSeasonsAction(result.id);
          if (seasonsResult.success && seasonsResult.data) {
            setSeasons(seasonsResult.data);
          } else if (!seasonsResult.success) {
            setEpisodeError(seasonsResult.error);
          } else {
            setEpisodeError("Failed to load seasons");
          }
        } catch {
          setEpisodeError("Failed to load seasons");
        } finally {
          setIsLoadingSeasons(false);
        }
        return;
      }

      // For movies, proceed directly to wizard
      await fetchPreviewAndOpenWizard(result.id, result.mediaType);
    },
    [fetchPreviewAndOpenWizard]
  );

  /**
   * Handles season selection in episode picker.
   */
  const handleSeasonSelect = useCallback(
    async (season: TMDBSeasonSummary) => {
      if (!pendingTmdbResult) return;

      setSelectedSeason(season);
      setIsLoadingEpisodes(true);
      setEpisodeError(null);
      setEpisodes([]);

      try {
        const result = await getEpisodesAction(
          pendingTmdbResult.id,
          season.season_number
        );
        if (result.success && result.data) {
          setEpisodes(result.data);
        } else if (!result.success) {
          setEpisodeError(result.error);
        } else {
          setEpisodeError("Failed to load episodes");
        }
      } catch {
        setEpisodeError("Failed to load episodes");
      } finally {
        setIsLoadingEpisodes(false);
      }
    },
    [pendingTmdbResult]
  );

  /**
   * Handles episode picker back navigation.
   */
  const handleEpisodePickerBack = useCallback(() => {
    if (selectedSeason) {
      setSelectedSeason(null);
      setEpisodes([]);
      setEpisodeError(null);
    } else {
      setPendingTmdbResult(null);
      setCurrentStep("main");
    }
  }, [selectedSeason]);

  /**
   * Handles episode picker selection.
   */
  const handleEpisodePickerSelect = useCallback(
    async (selection: EpisodePickerSelection) => {
      if (!pendingTmdbResult) return;
      await fetchPreviewAndOpenWizard(
        pendingTmdbResult.id,
        pendingTmdbResult.mediaType,
        selection
      );
    },
    [pendingTmdbResult, fetchPreviewAndOpenWizard]
  );

  /**
   * Applies wizard selections (text fields, TMDB options) without navigation.
   * Called when entering the wizard-summary step.
   */
  const applyWizardSelections = useCallback(() => {
    if (!pendingTmdbResult || !tmdbPreview) return;

    // Apply text fields immediately
    if (textOptions.updateName) {
      setName(tmdbPreview.name);
    }
    if (textOptions.updateDescription) {
      setDescription(tmdbPreview.description);
    }

    const finalPosterPath = posterSkipped ? null : posterValue;
    const finalBackdropPath = backdropSkipped ? null : backdropValue;

    // Store selection for item creation
    setSelectedTmdbOptions({
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
        posterPath: posterSource === "tmdb" ? finalPosterPath : null,
        backdropPath: backdropSource === "tmdb" ? finalBackdropPath : null,
      },
    });
  }, [
    pendingTmdbResult,
    tmdbPreview,
    textOptions,
    posterValue,
    posterSource,
    posterSkipped,
    backdropValue,
    backdropSource,
    backdropSkipped,
  ]);

  /**
   * Handles wizard back navigation.
   * Skips poster/hero steps when no Drive connection (images require Drive).
   */
  const handleWizardBack = useCallback(() => {
    if (currentStep === "wizard-text") {
      // Go back to episode picker for TV shows, or main for movies
      if (pendingTmdbResult?.mediaType === "tv") {
        setCurrentStep("episode-picker");
      } else {
        setPendingTmdbResult(null);
        setTmdbPreview(null);
        setCurrentStep("main");
      }
    } else if (currentStep === "wizard-poster") {
      setCurrentStep("wizard-text");
    } else if (currentStep === "wizard-hero") {
      setCurrentStep("wizard-poster");
    } else if (currentStep === "wizard-summary") {
      // Skip image steps when no Drive connection
      if (!hasDriveConnection) {
        setCurrentStep("wizard-text");
      } else {
        setCurrentStep("wizard-hero");
      }
    }
  }, [currentStep, pendingTmdbResult, hasDriveConnection]);

  /**
   * Handles wizard next navigation.
   * Skips poster/hero steps when no Drive connection (images require Drive).
   */
  const handleWizardNext = useCallback(() => {
    if (currentStep === "wizard-text") {
      // Skip image steps if no Drive connection
      if (!hasDriveConnection) {
        applyWizardSelections();
        setCurrentStep("wizard-summary");
      } else {
        setCurrentStep("wizard-poster");
      }
    } else if (currentStep === "wizard-poster") {
      setCurrentStep("wizard-hero");
    } else if (currentStep === "wizard-hero") {
      applyWizardSelections();
      setCurrentStep("wizard-summary");
    }
  }, [currentStep, hasDriveConnection, applyWizardSelections]);

  /**
   * Handles wizard skip all.
   */
  const handleWizardSkipAll = useCallback(() => {
    if (currentStep === "wizard-text") {
      setPosterSkipped(true);
      setBackdropSkipped(true);
    } else if (currentStep === "wizard-poster") {
      setBackdropSkipped(true);
    }
    applyWizardSelections();
    setCurrentStep("wizard-summary");
  }, [currentStep, applyWizardSelections]);

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
   * Handles poster selection.
   */
  const handlePosterSelect = useCallback(
    (value: string | null, source: ArtworkSelectionSource) => {
      setPosterValue(value);
      setPosterSource(value ? source : null);
    },
    []
  );

  /**
   * Handles backdrop selection.
   */
  const handleBackdropSelect = useCallback(
    (value: string | null, source: ArtworkSelectionSource) => {
      setBackdropValue(value);
      setBackdropSource(value ? source : null);
    },
    []
  );

  /**
   * Opens the change-poster step with current values.
   */
  const handleOpenChangePoster = useCallback(() => {
    setTempPosterValue(posterValue);
    setTempPosterSource(posterSource);
    setTempPosterSkipped(posterSkipped);
    setCurrentStep("change-poster");
  }, [posterValue, posterSource, posterSkipped]);

  /**
   * Opens the change-hero step with current values.
   */
  const handleOpenChangeHero = useCallback(() => {
    setTempBackdropValue(backdropValue);
    setTempBackdropSource(backdropSource);
    setTempBackdropSkipped(backdropSkipped);
    setCurrentStep("change-hero");
  }, [backdropValue, backdropSource, backdropSkipped]);

  /**
   * Handles temporary poster selection in change mode.
   */
  const handleTempPosterSelect = useCallback(
    (value: string | null, source: ArtworkSelectionSource) => {
      setTempPosterValue(value);
      setTempPosterSource(value ? source : null);
    },
    []
  );

  /**
   * Handles temporary backdrop selection in change mode.
   */
  const handleTempBackdropSelect = useCallback(
    (value: string | null, source: ArtworkSelectionSource) => {
      setTempBackdropValue(value);
      setTempBackdropSource(value ? source : null);
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
          console.warn("[AddItemDialog] Refetch failed after upload:", err);
        });
        toast.success(`Created "${name}"`);
        onOpenChange(false);
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
      console.warn("[AddItemDialog] Refetch failed after dismiss:", err);
    });
    toast.success(`Created "${name}" (some files failed to upload)`);
    onOpenChange(false);
  }, [name, onComplete, onOpenChange]);

  /**
   * Submits the form to create the item.
   * Computes TMDB options at submit time to ensure current artwork values are used.
   * Handles file uploads with progress tracking.
   */
  async function handleSubmit() {
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
          console.warn("[AddItemDialog] Refetch failed after create:", err);
        });
        toast.success(`Created "${name}"`);
        onOpenChange(false);
        return;
      }

      // Start file uploads with progress tracking
      setCreatedItemId(result.itemId);
      setIsLoading(false); // Switch from "Creating" to upload progress
      await startUpload(result.itemId, filesToUpload);
    } finally {
      setIsLoading(false);
    }
  }

  // Upload progress stats for display
  const uploadProgress = useMemo(() => {
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

  const descriptionId = "item-dialog-description";
  const dialogHint = parentName
    ? `Create a new item inside "${parentName}".`
    : "Create a new item to organize your content.";

  const currentValues: CurrentTextValues = useMemo(
    () => ({
      name: name || "(new item)",
      description: description || null,
    }),
    [name, description]
  );

  // Determine if artwork section should be visible
  // Hide for episodes (no poster/backdrop) and when no TMDB selection in manual mode
  const showArtworkSection = !isEpisodeMode;

  /**
   * Gets the header content for the current step.
   * Headers are rendered outside the animated area via slot-based API.
   */
  const getStepHeader = () => {
    switch (currentStep) {
      case "main":
        return (
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-xl",
                  "bg-primary/10 ring-primary/20 ring-1"
                )}
              >
                <Plus aria-hidden="true" className="text-primary size-5" />
              </div>
              <div>
                <DialogTitle className="text-lg">Create Item</DialogTitle>
                <DialogDescription id={descriptionId} className="text-sm">
                  {dialogHint}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        );
      case "episode-picker":
        return (
          <DialogHeader>
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleEpisodePickerBack}
                className="hover:bg-muted/50 size-10 transition-all active:scale-95"
                aria-label="Back"
              >
                <ChevronLeft aria-hidden="true" className="size-5" />
              </Button>
              <div
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-xl",
                  "bg-blue-500/10 ring-1 ring-blue-500/20"
                )}
              >
                {selectedSeason ? (
                  <Film aria-hidden="true" className="size-5 text-blue-500" />
                ) : (
                  <Tv aria-hidden="true" className="size-5 text-blue-500" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-lg">
                  {selectedSeason ? "Select Episode" : "Select Season"}
                </DialogTitle>
                <DialogDescription className="truncate text-sm">
                  {selectedSeason ? selectedSeason.name : displayTitle}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        );
      case "wizard-text":
      case "wizard-poster":
      case "wizard-hero":
      case "wizard-summary":
        return (
          <DialogHeader>
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleWizardBack}
                className="hover:bg-muted/50 size-10 transition-all active:scale-95"
                aria-label="Back"
              >
                <ChevronLeft aria-hidden="true" className="size-5" />
              </Button>
              <div
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-xl",
                  "bg-amber-500/10 ring-1 ring-amber-500/20"
                )}
              >
                <Sparkles aria-hidden="true" className="size-5 text-amber-500" />
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-lg">Apply Metadata</DialogTitle>
                <DialogDescription className="text-sm">
                  Step{" "}
                  {hasDriveConnection
                    ? wizardStepNumber
                    : wizardStepNumber === 1
                      ? 1
                      : 2}{" "}
                  of {hasDriveConnection ? 4 : 2}:{" "}
                  {currentStep === "wizard-text"
                    ? "Title & Description"
                    : currentStep === "wizard-poster"
                      ? "Select Poster"
                      : currentStep === "wizard-hero"
                        ? "Select Hero"
                        : "Review & Create"}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        );
      case "change-poster":
        return (
          <DialogHeader>
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleCancelArtworkChange}
                className="hover:bg-muted/50 size-10 transition-all active:scale-95"
                aria-label="Back"
              >
                <ChevronLeft aria-hidden="true" className="size-5" />
              </Button>
              <div
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-xl",
                  "bg-violet-500/10 ring-1 ring-violet-500/20"
                )}
              >
                <ImageIcon aria-hidden="true" className="size-5 text-violet-500" />
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-lg">Change Poster</DialogTitle>
                <DialogDescription className="text-sm">
                  Select a different poster image
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        );
      case "change-hero":
        return (
          <DialogHeader>
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleCancelArtworkChange}
                className="hover:bg-muted/50 size-10 transition-all active:scale-95"
                aria-label="Back"
              >
                <ChevronLeft aria-hidden="true" className="size-5" />
              </Button>
              <div
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-xl",
                  "bg-violet-500/10 ring-1 ring-violet-500/20"
                )}
              >
                <ImageIcon aria-hidden="true" className="size-5 text-violet-500" />
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-lg">Change Hero</DialogTitle>
                <DialogDescription className="text-sm">
                  Select a different hero/backdrop image
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        );
      default:
        return null;
    }
  };

  /**
   * Renders upload progress/error UI for footer.
   */
  const renderUploadProgress = () => {
    if (!uploadState) return null;

    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className={cn(
            "mb-4 overflow-hidden rounded-lg border",
            hasUploadError
              ? "border-destructive/30 bg-destructive/5"
              : "bg-muted/30"
          )}
        >
          <div className="flex items-center justify-between px-3 py-2">
            <div className="flex items-center gap-2 text-sm">
              {isUploading && uploadProgress && (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{
                      duration: 1,
                      repeat: Infinity,
                      ease: "linear",
                    }}
                    className="border-primary size-4 rounded-full border-2 border-t-transparent"
                  />
                  <span className="flex items-center gap-2">
                    <span>Uploading…</span>
                    <span className="bg-primary/15 text-primary inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 font-mono text-xs font-medium tracking-tight tabular-nums">
                      <span>{uploadProgress.overallPercent}%</span>
                      {uploadProgress.totalSize > 0 && (
                        <>
                          <span className="text-primary/50">·</span>
                          <span>
                            {formatBytes(uploadProgress.totalLoaded)}/
                            {formatBytes(uploadProgress.totalSize)}
                          </span>
                        </>
                      )}
                    </span>
                    {uploadProgress.fileCount > 1 && (
                      <span className="text-muted-foreground text-xs">
                        ({uploadProgress.currentFileIndex + 1}/
                        {uploadProgress.fileCount})
                      </span>
                    )}
                  </span>
                </>
              )}

              {hasUploadError && (
                <motion.div
                  initial={{ x: -10, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  className="flex items-center gap-2"
                >
                  <AlertCircle aria-hidden="true" className="text-destructive size-4" />
                  <span>
                    {uploadState.successCount} uploaded, {failedFiles.length}{" "}
                    failed
                  </span>
                </motion.div>
              )}
            </div>

            {hasUploadError && (
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleRetryUpload}
                  className="h-7 gap-1 px-2 text-xs"
                >
                  <RefreshCw aria-hidden="true" className="size-3" />
                  Retry
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleDismissUpload}
                  className="text-muted-foreground hover:text-foreground size-7 p-0"
                  aria-label="Dismiss upload errors"
                >
                  <X aria-hidden="true" className="size-4" />
                </Button>
              </div>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    );
  };

  /**
   * Gets the footer content for the current step.
   * Footers are rendered outside the animated area via slot-based API.
   */
  const getStepFooter = () => {
    switch (currentStep) {
      case "main":
        return (
          <DialogFooter className="flex-col items-stretch gap-0 sm:flex-col">
            {renderUploadProgress()}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading || isUploading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!name.trim() || isLoading || isUploading}
              >
                {isLoading ? (
                  <>
                    <Loader2 aria-hidden="true" className="mr-2 size-4 animate-spin" />
                    Creating…
                  </>
                ) : isUploading ? (
                  <>
                    <Loader2 aria-hidden="true" className="mr-2 size-4 animate-spin" />
                    Uploading…
                  </>
                ) : (
                  "Create"
                )}
              </Button>
            </div>
          </DialogFooter>
        );
      case "episode-picker":
        return (
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setPendingTmdbResult(null);
                setCurrentStep("main");
              }}
            >
              Cancel
            </Button>
            {selectedSeason && (
              <Button
                variant="ghost"
                onClick={() =>
                  handleEpisodePickerSelect({
                    type: "season",
                    seasonNumber: selectedSeason.season_number,
                  })
                }
              >
                Use Season
              </Button>
            )}
            <Button onClick={() => handleEpisodePickerSelect({ type: "show" })}>
              Use Show
            </Button>
          </DialogFooter>
        );
      case "wizard-text":
        return (
          <DialogFooter>
            <Button variant="outline" onClick={handleWizardCancel}>
              Cancel
            </Button>
            {/* Hide Skip All when no Drive - there are no image steps to skip */}
            {hasDriveConnection && (
              <Button variant="destructive" onClick={handleWizardSkipAll}>
                Skip All
              </Button>
            )}
            <Button onClick={handleWizardNext}>
              {hasDriveConnection ? "Next" : "Continue"}
            </Button>
          </DialogFooter>
        );
      case "wizard-poster":
        return (
          <DialogFooter>
            <Button variant="outline" onClick={handleWizardCancel}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleWizardSkipAll}>
              Skip All
            </Button>
            <Button onClick={handleWizardNext}>Next</Button>
          </DialogFooter>
        );
      case "wizard-hero":
        return (
          <DialogFooter>
            <Button variant="outline" onClick={handleWizardCancel}>
              Cancel
            </Button>
            <Button onClick={handleWizardNext}>Apply</Button>
          </DialogFooter>
        );
      case "wizard-summary":
        return (
          <DialogFooter className="flex-col items-stretch gap-0 sm:flex-col">
            {renderUploadProgress()}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                variant="outline"
                onClick={handleWizardCancel}
                disabled={isLoading || isUploading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!name.trim() || isLoading || isUploading}
              >
                {isLoading ? (
                  <>
                    <Loader2 aria-hidden="true" className="mr-2 size-4 animate-spin" />
                    Creating…
                  </>
                ) : isUploading ? (
                  <>
                    <Loader2 aria-hidden="true" className="mr-2 size-4 animate-spin" />
                    Uploading…
                  </>
                ) : (
                  "Create"
                )}
              </Button>
            </div>
          </DialogFooter>
        );
      case "change-poster":
        return (
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelArtworkChange}>
              Cancel
            </Button>
            <Button onClick={handleSavePosterChange}>Save</Button>
          </DialogFooter>
        );
      case "change-hero":
        return (
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelArtworkChange}>
              Cancel
            </Button>
            <Button onClick={handleSaveHeroChange}>Save</Button>
          </DialogFooter>
        );
      default:
        return null;
    }
  };

  // Details tab content (shown before wizard completion)
  const detailsContent = (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="item-name">Item name</Label>
        <div className="relative">
          <MediaSearchCombobox
            id="item-name"
            onSelect={handleMediaSelect}
            onChange={setName}
            value={name}
            placeholder="Search movies & TV shows…"
          />
          {isLoadingPreview && (
            <div className="bg-background/80 absolute inset-0 flex items-center justify-center gap-2 rounded-md">
              <Loader2 aria-hidden="true" className="text-muted-foreground size-4 animate-spin" />
              <span className="text-muted-foreground text-sm">Loading…</span>
            </div>
          )}
        </div>
        {selectedTmdbOptions && (
          <p className="text-muted-foreground flex items-center gap-1 text-xs">
            <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
              TMDB
            </span>
            Metadata will be applied on create
          </p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="item-description">
          Description{" "}
          <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <Textarea
          id="item-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Add a short description…"
          disabled={isLoading}
          className="min-h-[80px] resize-none"
          maxLength={1000}
        />
        <p className="text-muted-foreground text-xs tabular-nums">
          {description.length}/1000 characters
        </p>
      </div>
    </div>
  );

  // Files tab content (shown before wizard completion)
  const filesContent = (
    <div className="space-y-4">
      {!hasDriveConnection && (
        <p className="text-muted-foreground border-muted rounded-lg border border-dashed p-3 text-center text-xs">
          Connect Google Drive to upload files.{" "}
          <Link
            href="/docs/google-drive/connect-drive"
            className="text-primary hover:underline"
          >
            Learn more
          </Link>
        </p>
      )}

      <FileTypeCombobox
        uploadOnly
        label="Primary Media"
        description="The file that plays when clicking on this item."
        icon={Film}
        fileType="media"
        queuedFiles={queuedFiles.media}
        onQueueFilesChange={updateCategory("media")}
        disabled={!hasDriveConnection}
      />

      <FileTypeCombobox
        uploadOnly
        label="Primary Artwork"
        description="The image used as the thumbnail."
        icon={ImageIcon}
        fileType="artwork"
        queuedFiles={queuedFiles.artwork}
        onQueueFilesChange={updateCategory("artwork")}
        disabled={!hasDriveConnection}
      />

      <FileTypeCombobox
        uploadOnly
        label="Hero Image"
        description="The image used as the banner background."
        icon={Sparkles}
        fileType="artwork"
        queuedFiles={queuedFiles.hero}
        onQueueFilesChange={updateCategory("hero")}
        disabled={!hasDriveConnection}
      />

      <FileTypeCombobox
        uploadOnly
        label="Default Subtitle"
        description="The subtitle track that loads by default."
        icon={FileText}
        fileType="subtitle"
        queuedFiles={queuedFiles.subtitle}
        onQueueFilesChange={updateCategory("subtitle")}
        disabled={!hasDriveConnection}
      />
    </div>
  );

  // Wizard step number for display (1-4)
  const wizardStepNumber =
    currentStep === "wizard-text"
      ? 1
      : currentStep === "wizard-poster"
        ? 2
        : currentStep === "wizard-hero"
          ? 3
          : 4;

  // Episode picker display
  const displayTitle = pendingTmdbResult
    ? pendingTmdbResult.year
      ? `${pendingTmdbResult.title} (${pendingTmdbResult.year})`
      : pendingTmdbResult.title
    : "";

  /**
   * Gets the body content for the current step.
   * Bodies are rendered inside the animated area.
   */
  const getStepBody = () => {
    switch (currentStep) {
      case "main":
        return (
          <div className="py-2">
            {hasDriveConnection ? (
              <ItemDialogTabs
                detailsContent={detailsContent}
                filesContent={filesContent}
              />
            ) : (
              <div className="space-y-4">{detailsContent}</div>
            )}
          </div>
        );
      case "episode-picker":
        return (
          <>
            {/* Breadcrumb for episodes view */}
            {selectedSeason && (
              <div className="flex items-center gap-1 text-sm">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSeason(null);
                    setEpisodes([]);
                  }}
                  className="text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                >
                  <ChevronLeft aria-hidden="true" className="size-4" />
                  <span className="max-w-[150px] truncate">{displayTitle}</span>
                </button>
                <ChevronRight aria-hidden="true" className="text-muted-foreground/50 size-4" />
                <span className="text-foreground font-medium">
                  {selectedSeason.name}
                </span>
              </div>
            )}

            {/* Content area */}
            <div className="min-h-[280px]">
              {!selectedSeason ? (
                // Seasons view
                isLoadingSeasons ? (
                  <LoadingState message="Loading seasons…" />
                ) : episodeError ? (
                  <ErrorState message={episodeError} />
                ) : (
                  <ScrollArea className="h-[280px] pr-3">
                    <div className="space-y-1">
                      {seasons.map((season) => (
                        <SeasonItem
                          key={season.id}
                          season={season}
                          onClick={() => handleSeasonSelect(season)}
                        />
                      ))}
                    </div>
                  </ScrollArea>
                )
              ) : // Episodes view
              isLoadingEpisodes ? (
                <LoadingState message="Loading episodes…" />
              ) : episodeError ? (
                <ErrorState message={episodeError} />
              ) : (
                <ScrollArea className="h-[280px] pr-3">
                  <div className="space-y-1">
                    {episodes.map((episode) => (
                      <EpisodeItem
                        key={episode.id}
                        episode={episode}
                        onClick={() =>
                          handleEpisodePickerSelect({
                            type: "episode",
                            seasonNumber: selectedSeason.season_number,
                            episodeNumber: episode.episode_number,
                          })
                        }
                      />
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          </>
        );
      case "wizard-text":
        if (!tmdbPreview) return null;
        return (
          <>
            {/* Step indicator - 2 steps without Drive, 4 with Drive */}
            <div className="flex gap-1.5 py-2">
              {(hasDriveConnection ? [1, 2, 3, 4] : [1, 2]).map((step) => (
                <div
                  key={step}
                  className={cn(
                    "h-1 flex-1 rounded-full transition-colors",
                    step <= wizardStepNumber ? "bg-amber-500" : "bg-muted"
                  )}
                />
              ))}
            </div>

            <TitleDescriptionStep
              currentValues={currentValues}
              preview={tmdbPreview}
              options={textOptions}
              onOptionsChange={setTextOptions}
              disabled={false}
            />

            {/* Note when images are skipped */}
            {!hasDriveConnection && (
              <p className="text-muted-foreground mt-4 text-center text-xs">
                Connect Google Drive to add poster and hero images.
              </p>
            )}
          </>
        );
      case "wizard-poster":
        return (
          <>
            {/* Step indicator */}
            <div className="flex gap-1.5 py-2">
              {[1, 2, 3, 4].map((step) => (
                <div
                  key={step}
                  className={cn(
                    "h-1 flex-1 rounded-full transition-colors",
                    step <= wizardStepNumber ? "bg-amber-500" : "bg-muted"
                  )}
                />
              ))}
            </div>

            {isLoadingImages ? (
              <LoadingState message="Loading poster options..." />
            ) : (
              <PosterSelectionStep
                posters={tmdbImages?.posters || []}
                uploadMode={true}
                queuedArtwork={queuedFiles.artwork}
                onQueueArtworkChange={updateCategory("artwork")}
                hasDriveConnection={hasDriveConnection}
                selectedValue={posterValue}
                selectedSource={posterSource}
                onSelect={handlePosterSelect}
                isSkipped={posterSkipped}
                onSkipChange={setPosterSkipped}
                disabled={false}
              />
            )}
          </>
        );
      case "wizard-hero":
        return (
          <>
            {/* Step indicator */}
            <div className="flex gap-1.5 py-2">
              {[1, 2, 3, 4].map((step) => (
                <div
                  key={step}
                  className={cn(
                    "h-1 flex-1 rounded-full transition-colors",
                    step <= wizardStepNumber ? "bg-amber-500" : "bg-muted"
                  )}
                />
              ))}
            </div>

            {isLoadingImages ? (
              <LoadingState message="Loading backdrop options..." />
            ) : (
              <HeroSelectionStep
                backdrops={tmdbImages?.backdrops || []}
                uploadMode={true}
                queuedHero={queuedFiles.hero}
                onQueueHeroChange={updateCategory("hero")}
                hasDriveConnection={hasDriveConnection}
                selectedValue={backdropValue}
                selectedSource={backdropSource}
                onSelect={handleBackdropSelect}
                isSkipped={backdropSkipped}
                onSkipChange={setBackdropSkipped}
                disabled={false}
              />
            )}
          </>
        );
      case "wizard-summary":
        return (
          <>
            {/* Step indicator - 2 steps without Drive, 4 with Drive */}
            <div className="flex gap-1.5 py-2">
              {(hasDriveConnection ? [1, 2, 3, 4] : [1, 2]).map((step) => (
                <div
                  key={step}
                  className={cn(
                    "h-1 flex-1 rounded-full transition-colors",
                    step <= (hasDriveConnection ? wizardStepNumber : 2)
                      ? "bg-amber-500"
                      : "bg-muted"
                  )}
                />
              ))}
            </div>

            {/* Content - Show tabs only with Drive connection */}
            <div className="py-2">
              {hasDriveConnection ? (
                <ItemDialogTabs
                  detailsContent={
                    <div className="space-y-4">
                      {/* Name Field */}
                      <div className="space-y-2">
                        <Label htmlFor="summary-item-name">Name</Label>
                        <MediaSearchCombobox
                          id="summary-item-name"
                          value={name}
                          onChange={setName}
                          onSelect={handleMediaSelect}
                        />
                      </div>

                      {/* Description Field */}
                      <div className="space-y-2">
                        <Label htmlFor="summary-item-description">
                          Description{" "}
                          <span className="text-muted-foreground font-normal">
                            (optional)
                          </span>
                        </Label>
                        <Textarea
                          id="summary-item-description"
                          value={description}
                          onChange={(e) =>
                            setDescription(e.target.value.slice(0, 1000))
                          }
                          placeholder="Optional description or notes..."
                          rows={3}
                          disabled={isLoading}
                          className="resize-none"
                        />
                        <p className="text-muted-foreground text-xs tabular-nums">
                          {description.length} / 1000
                        </p>
                      </div>

                      {/* Artwork Section - Hidden for episodes */}
                      {showArtworkSection && (
                        <>
                          <SummaryArtworkDropzone
                            label="Poster"
                            icon={ImageIcon}
                            value={posterValue}
                            source={posterSource}
                            queuedFiles={queuedFiles.artwork}
                            type="poster"
                            onClick={handleOpenChangePoster}
                            onClear={handleClearPoster}
                            disabled={isLoading}
                            helpText="Used as the thumbnail in grid and tree views."
                          />
                          <SummaryArtworkDropzone
                            label="Hero Banner"
                            icon={Sparkles}
                            value={backdropValue}
                            source={backdropSource}
                            queuedFiles={queuedFiles.hero}
                            type="hero"
                            onClick={handleOpenChangeHero}
                            onClear={handleClearBackdrop}
                            disabled={isLoading}
                            helpText="Displayed at the top of the item detail page."
                          />
                        </>
                      )}
                    </div>
                  }
                  filesContent={filesContent}
                />
              ) : (
                <div className="space-y-4">
                  {/* Name Field */}
                  <div className="space-y-2">
                    <Label htmlFor="summary-item-name">Name</Label>
                    <MediaSearchCombobox
                      id="summary-item-name"
                      value={name}
                      onChange={setName}
                      onSelect={handleMediaSelect}
                    />
                  </div>

                  {/* Description Field */}
                  <div className="space-y-2">
                    <Label htmlFor="summary-item-description">
                      Description{" "}
                      <span className="text-muted-foreground font-normal">
                        (optional)
                      </span>
                    </Label>
                    <Textarea
                      id="summary-item-description"
                      value={description}
                      onChange={(e) =>
                        setDescription(e.target.value.slice(0, 1000))
                      }
                      placeholder="Optional description or notes..."
                      rows={3}
                      disabled={isLoading}
                      className="resize-none"
                    />
                    <p className="text-muted-foreground text-xs tabular-nums">
                      {description.length} / 1000
                    </p>
                  </div>
                </div>
              )}
            </div>
          </>
        );
      case "change-poster":
        return (
          <PosterSelectionStep
            posters={tmdbImages?.posters || []}
            uploadMode={true}
            queuedArtwork={queuedFiles.artwork}
            onQueueArtworkChange={updateCategory("artwork")}
            hasDriveConnection={hasDriveConnection}
            selectedValue={tempPosterValue}
            selectedSource={tempPosterSource}
            onSelect={handleTempPosterSelect}
            isSkipped={tempPosterSkipped}
            onSkipChange={setTempPosterSkipped}
            disabled={false}
          />
        );
      case "change-hero":
        return (
          <HeroSelectionStep
            backdrops={tmdbImages?.backdrops || []}
            uploadMode={true}
            queuedHero={queuedFiles.hero}
            onQueueHeroChange={updateCategory("hero")}
            hasDriveConnection={hasDriveConnection}
            selectedValue={tempBackdropValue}
            selectedSource={tempBackdropSource}
            onSelect={handleTempBackdropSelect}
            isSkipped={tempBackdropSkipped}
            onSkipChange={setTempBackdropSkipped}
            disabled={false}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <AnimatedDialogContent
        stepKey={currentStep}
        className="max-h-[90vh]"
        aria-describedby={descriptionId}
        header={getStepHeader()}
        footer={getStepFooter()}
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          const combobox = document.querySelector('[role="combobox"]');
          if (combobox instanceof HTMLElement) {
            combobox.focus();
          }
        }}
      >
        {getStepBody()}
      </AnimatedDialogContent>
    </Dialog>
  );
}

// ============================================================================
// Helper Components
// ============================================================================

/**
 * Summary artwork dropzone for selecting poster or hero images.
 * Follows the dropzone pattern from profile settings for consistency.
 * Click navigates to the selection wizard step instead of opening file picker.
 *
 * @param label - Display label (e.g., "Poster", "Hero")
 * @param icon - Icon component to display in header
 * @param value - Selected image value (TMDB path or queued file ID)
 * @param source - Source of the selection (tmdb, queued, or null)
 * @param queuedFiles - Array of queued files for preview
 * @param type - Type of artwork for URL generation
 * @param onClick - Handler to navigate to selection step
 * @param onClear - Handler to clear the selection
 * @param disabled - Whether interaction is disabled
 * @param helpText - Help text shown below the dropzone
 */
function SummaryArtworkDropzone({
  label,
  icon: Icon,
  value,
  source,
  queuedFiles,
  type,
  onClick,
  onClear,
  disabled,
  helpText,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  value: string | null;
  source: ArtworkSelectionSource | null;
  queuedFiles: QueuedFile[];
  type: "poster" | "hero";
  onClick: () => void;
  onClear: () => void;
  disabled: boolean;
  helpText: string;
}) {
  const [hasError, setHasError] = useState(false);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  // Find queued file if source is "queued"
  const queuedFile = useMemo(() => {
    if (source !== "queued" || !value) return null;
    return queuedFiles.find((f) => f.id === value) ?? null;
  }, [source, value, queuedFiles]);

  // Create object URL for queued file - requires effect for cleanup
  useEffect(() => {
    if (queuedFile) {
      const url = URL.createObjectURL(queuedFile.file);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setObjectUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setObjectUrl(null);
  }, [queuedFile]);

  // Reset error when value/source changes - necessary for image reload
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHasError(false);
  }, [value, source]);

  // Get image URL
  const imageUrl = useMemo(() => {
    if (!value || hasError) return null;
    if (source === "tmdb") {
      return type === "poster"
        ? getPosterUrl(value, "w342")
        : getBackdropUrl(value, "w780");
    }
    if (source === "queued" && objectUrl) {
      return objectUrl;
    }
    return null;
  }, [value, source, type, objectUrl, hasError]);

  const hasSelection = value !== null && source !== null;

  return (
    <div className="space-y-3">
      {/* Header with icon and label */}
      <div className="flex items-center gap-2">
        <div
          className={cn(
            "flex size-7 items-center justify-center rounded-lg",
            "bg-primary/10"
          )}
        >
          <Icon aria-hidden="true" className="text-primary size-3.5" />
        </div>
        <span className="text-sm font-medium">{label}</span>
      </div>

      {/* Dropzone-style button */}
      <Button
        type="button"
        variant="outline"
        onClick={onClick}
        disabled={disabled}
        className={cn(
          "relative h-24 w-full overflow-hidden p-0",
          disabled && "cursor-not-allowed opacity-50"
        )}
      >
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={`${label} preview`}
            loading="lazy"
            className="size-full object-cover"
            onError={() => setHasError(true)}
          />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-1">
            <Icon aria-hidden="true" className="text-muted-foreground/50 size-6" />
            <p className="text-muted-foreground text-xs">
              Click to choose {label.toLowerCase()}
            </p>
          </div>
        )}
      </Button>

      {/* Clear button - only shown when there's a selection */}
      {hasSelection && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onClear}
          disabled={disabled}
        >
          <Trash2 aria-hidden="true" className="mr-1.5 size-3.5" />
          Clear
        </Button>
      )}

      {/* Help text */}
      <p className="text-muted-foreground text-xs">{helpText}</p>
    </div>
  );
}
