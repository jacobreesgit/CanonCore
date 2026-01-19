/**
 * Unified item settings dialog with tabbed interface and single atomic save.
 * Uses step-based navigation for TV episode picker and TMDB metadata wizard.
 * Consolidates name, description (Details tab) and file selections (Files tab).
 */

"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Loader2,
  ImageIcon,
  FileText,
  Film,
  Settings2,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Tv,
} from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { AnimatedDialogContent } from "@/components/ui/animated-dialog-content";
import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileTypeCombobox } from "@/components/items/file-type-combobox";
import { MediaSearchCombobox } from "@/components/items/media-search-combobox";
import { ItemDialogTabs } from "@/components/items/item-dialog-tabs";
import {
  TitleDescriptionStep,
  type CurrentTextValues,
  type TextPreviewData,
  type TitleDescriptionOptions,
} from "@/components/items/title-description-step";
import { PosterSelectionStep } from "@/components/items/poster-selection-step";
import { HeroSelectionStep } from "@/components/items/hero-selection-step";
import type { ExistingArtworkFile } from "@/components/items/image-selection-grid";
import {
  SeasonItem,
  EpisodeItem,
  LoadingState,
  ErrorState,
} from "@/components/items/episode-picker-helpers";
import { updateItemSettings } from "@/lib/item-file-actions";
import {
  applyMetadataAction,
  getMetadataPreviewAction,
  getImagesAction,
  getEpisodePreviewAction,
  getSeasonsAction,
  getEpisodesAction,
} from "@/lib/tmdb-actions";
import type {
  TMDBSearchResult,
  TMDBImages,
  TMDBSeasonSummary,
  TMDBEpisode,
} from "@/lib/tmdb-client";
import { toast } from "sonner";
import type { SerializedItemFile, ArtworkSelectionSource } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Steps for item settings dialog navigation. */
type ItemSettingsStep =
  | "main"
  | "episode-picker"
  | "wizard-text"
  | "wizard-poster"
  | "wizard-hero";

/** Episode picker selection type. */
type EpisodePickerSelection =
  | { type: "show" }
  | { type: "season"; seasonNumber: number }
  | { type: "episode"; seasonNumber: number; episodeNumber: number };

interface ItemSettingsDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog open state changes */
  onOpenChange: (open: boolean) => void;
  /** The item being configured */
  item: { id: string; name: string; description: string | null };
  /** Files attached to this item, grouped by type (serialized for client) */
  files: {
    media: SerializedItemFile[];
    artwork: SerializedItemFile[];
    subtitles: SerializedItemFile[];
  };
  /** Whether user has Google Drive connected (enables uploads) */
  hasDriveConnection?: boolean;
  /** Optional callback when settings change (for refreshing data). Awaited to ensure sync. */
  onSettingsChange?: () => Promise<void>;
}

/**
 * Finds the primary file in an array, or returns the first file.
 */
function findPrimaryFile(
  files: SerializedItemFile[]
): SerializedItemFile | undefined {
  return files.find((f) => f.isPrimary) ?? files[0];
}

/**
 * Finds the hero file in an array, or returns undefined.
 */
function findHeroFile(
  files: SerializedItemFile[]
): SerializedItemFile | undefined {
  return files.find((f) => f.isHero);
}

/**
 * Item settings dialog with tabbed interface and single atomic save.
 * Uses step-based navigation for TV shows and TMDB metadata wizard.
 *
 * @param open - Whether dialog is visible
 * @param onOpenChange - Callback for visibility changes
 * @param item - Item metadata
 * @param files - Files grouped by type
 * @param hasDriveConnection - Whether uploads are enabled
 * @param onSettingsChange - Optional callback when settings are saved
 */
export function ItemSettingsDialog({
  open,
  onOpenChange,
  item,
  files,
  hasDriveConnection = false,
  onSettingsChange,
}: ItemSettingsDialogProps) {
  // Current step
  const [currentStep, setCurrentStep] = useState<ItemSettingsStep>("main");

  // Form state
  const [name, setName] = useState(item.name);
  const [description, setDescription] = useState(item.description ?? "");
  const [primaryMediaId, setPrimaryMediaId] = useState<string | undefined>(
    findPrimaryFile(files.media)?.id
  );
  const [primaryArtworkId, setPrimaryArtworkId] = useState<string | undefined>(
    findPrimaryFile(files.artwork)?.id
  );
  const [heroArtworkId, setHeroArtworkId] = useState<string | undefined>(
    findHeroFile(files.artwork)?.id ?? findPrimaryFile(files.artwork)?.id
  );
  const [primarySubtitleId, setPrimarySubtitleId] = useState<
    string | undefined
  >(findPrimaryFile(files.subtitles)?.id);

  const [isSaving, setIsSaving] = useState(false);
  const [isApplyingMetadata, setIsApplyingMetadata] = useState(false);

  // Track successful uploads during this dialog session
  const [uploadCount, setUploadCount] = useState(0);

  // TMDB state
  const [pendingTmdbResult, setPendingTmdbResult] =
    useState<TMDBSearchResult | null>(null);
  const [tmdbPreview, setTmdbPreview] = useState<TextPreviewData | null>(null);
  const [tmdbImages, setTmdbImages] = useState<TMDBImages | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isLoadingImages, setIsLoadingImages] = useState(false);

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

  // Original values for dirty checking
  const [originalValues, setOriginalValues] = useState(() => ({
    name: item.name,
    description: item.description ?? "",
    primaryMediaId: findPrimaryFile(files.media)?.id,
    primaryArtworkId: findPrimaryFile(files.artwork)?.id,
    heroArtworkId:
      findHeroFile(files.artwork)?.id ?? findPrimaryFile(files.artwork)?.id,
    primarySubtitleId: findPrimaryFile(files.subtitles)?.id,
  }));

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setCurrentStep("main");
      setUploadCount(0);
      setOriginalValues({
        name: item.name,
        description: item.description ?? "",
        primaryMediaId: findPrimaryFile(files.media)?.id,
        primaryArtworkId: findPrimaryFile(files.artwork)?.id,
        heroArtworkId:
          findHeroFile(files.artwork)?.id ?? findPrimaryFile(files.artwork)?.id,
        primarySubtitleId: findPrimaryFile(files.subtitles)?.id,
      });
      // Reset TMDB state
      setPendingTmdbResult(null);
      setTmdbPreview(null);
      setTmdbImages(null);
      setSeasons([]);
      setEpisodes([]);
      setSelectedSeason(null);
      setEpisodeError(null);
      resetWizardState();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

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
  }, []);

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

  // Sync name/description when item changes
  useEffect(() => {
    setName(item.name);
    setDescription(item.description ?? "");
  }, [item.name, item.description]);

  // Sync file selections when files change
  useEffect(() => {
    setPrimaryMediaId(findPrimaryFile(files.media)?.id);
    setPrimaryArtworkId(findPrimaryFile(files.artwork)?.id);
    setHeroArtworkId(
      findHeroFile(files.artwork)?.id ?? findPrimaryFile(files.artwork)?.id
    );
    setPrimarySubtitleId(findPrimaryFile(files.subtitles)?.id);
  }, [files]);

  // Dirty state detection
  const isDirty = useMemo(() => {
    return (
      name !== originalValues.name ||
      description !== originalValues.description ||
      primaryMediaId !== originalValues.primaryMediaId ||
      primaryArtworkId !== originalValues.primaryArtworkId ||
      heroArtworkId !== originalValues.heroArtworkId ||
      primarySubtitleId !== originalValues.primarySubtitleId
    );
  }, [
    name,
    description,
    primaryMediaId,
    primaryArtworkId,
    heroArtworkId,
    primarySubtitleId,
    originalValues,
  ]);

  // Current values for wizard
  const currentValues: CurrentTextValues = useMemo(
    () => ({
      name: item.name,
      description: item.description,
    }),
    [item.name, item.description]
  );

  // Convert artwork files to ExistingArtworkFile format for wizard
  const existingArtwork: ExistingArtworkFile[] = useMemo(
    () =>
      files.artwork.map((f) => ({
        id: f.id,
        filename: f.filename,
        driveFileId: f.driveFileId,
      })),
    [files.artwork]
  );

  /**
   * Resets form to original values.
   */
  const handleCancel = useCallback(() => {
    setName(originalValues.name);
    setDescription(originalValues.description);
    setPrimaryMediaId(originalValues.primaryMediaId);
    setPrimaryArtworkId(originalValues.primaryArtworkId);
    setHeroArtworkId(originalValues.heroArtworkId);
    setPrimarySubtitleId(originalValues.primarySubtitleId);
    onOpenChange(false);
  }, [originalValues, onOpenChange]);

  /**
   * Saves all changes atomically.
   */
  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }

    setIsSaving(true);
    try {
      const changes: {
        name?: string;
        description?: string;
        primaryMediaId?: string;
        primaryArtworkId?: string;
        heroArtworkId?: string;
        primarySubtitleId?: string;
      } = {};

      if (name !== originalValues.name) {
        changes.name = name.trim();
      }
      if (description !== originalValues.description) {
        changes.description = description;
      }
      if (primaryMediaId !== originalValues.primaryMediaId && primaryMediaId) {
        changes.primaryMediaId = primaryMediaId;
      }
      if (
        primaryArtworkId !== originalValues.primaryArtworkId &&
        primaryArtworkId
      ) {
        changes.primaryArtworkId = primaryArtworkId;
      }
      if (heroArtworkId !== originalValues.heroArtworkId && heroArtworkId) {
        changes.heroArtworkId = heroArtworkId;
      }
      if (
        primarySubtitleId !== originalValues.primarySubtitleId &&
        primarySubtitleId
      ) {
        changes.primarySubtitleId = primarySubtitleId;
      }

      const result = await updateItemSettings(item.id, changes);

      if (result.success) {
        if (uploadCount > 0) {
          const fileWord = uploadCount === 1 ? "file" : "files";
          toast.success(`Settings saved. ${uploadCount} ${fileWord} uploaded.`);
        } else {
          toast.success("Settings saved");
        }
        await onSettingsChange?.().catch((err) => {
          console.warn("[ItemSettingsDialog] Refetch failed after save:", err);
        });
        onOpenChange(false);
      } else {
        toast.error(result.error || "Failed to save settings");
      }
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  }, [
    name,
    description,
    primaryMediaId,
    primaryArtworkId,
    heroArtworkId,
    primarySubtitleId,
    originalValues,
    uploadCount,
    item.id,
    onSettingsChange,
    onOpenChange,
  ]);

  /**
   * Handles upload completion.
   */
  const handleUploadComplete = useCallback(
    async (successCount: number) => {
      setUploadCount((prev) => prev + successCount);
      await onSettingsChange?.().catch((err) => {
        console.warn("[ItemSettingsDialog] Refetch failed after upload:", err);
      });
    },
    [onSettingsChange]
  );

  /**
   * Handles file deletion.
   */
  const handleFileDeleted = useCallback(async () => {
    await onSettingsChange?.().catch((err) => {
      console.warn("[ItemSettingsDialog] Refetch failed after delete:", err);
    });
  }, [onSettingsChange]);

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
            setTmdbImages({ posters: [], backdrops: [] });
            setCurrentStep("wizard-text");
          } else if (!response.success) {
            toast.error(response.error);
            setCurrentStep("main");
          } else {
            toast.error("Could not fetch episode preview");
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
          } else if (!response.success) {
            toast.error(response.error);
            setCurrentStep("main");
          } else {
            toast.error("Could not fetch preview");
            setCurrentStep("main");
          }
        }
      } catch {
        toast.error("Failed to fetch metadata preview");
        setCurrentStep("main");
      } finally {
        setIsLoadingPreview(false);
      }
    },
    [resetWizardState]
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
   * Handles wizard completion - applies metadata immediately.
   */
  const handleWizardComplete = useCallback(async () => {
    if (!pendingTmdbResult) return;

    setIsApplyingMetadata(true);

    try {
      const posterPath = posterSkipped ? null : posterValue;
      const backdropPath = backdropSkipped ? null : backdropValue;

      const response = await applyMetadataAction(
        item.id,
        pendingTmdbResult.id,
        pendingTmdbResult.mediaType,
        {
          updateName: textOptions.updateName,
          updateDescription: textOptions.updateDescription,
          updatePoster:
            !posterSkipped && posterSource === "tmdb" && !!posterPath,
          updateBackdrop:
            !backdropSkipped && backdropSource === "tmdb" && !!backdropPath,
        }
      );

      if (response.success) {
        toast.success("Metadata applied successfully");
        await onSettingsChange?.().catch((err) => {
          console.warn(
            "[ItemSettingsDialog] Refetch failed after metadata apply:",
            err
          );
        });
      } else {
        toast.error(response.error || "Failed to apply metadata");
      }
    } catch {
      toast.error("Failed to apply metadata");
    } finally {
      setIsApplyingMetadata(false);
      setPendingTmdbResult(null);
      setTmdbPreview(null);
      setTmdbImages(null);
      setCurrentStep("main");
    }
  }, [
    pendingTmdbResult,
    item.id,
    textOptions,
    posterValue,
    posterSource,
    posterSkipped,
    backdropValue,
    backdropSource,
    backdropSkipped,
    onSettingsChange,
  ]);

  /**
   * Handles wizard back navigation.
   */
  const handleWizardBack = useCallback(() => {
    if (currentStep === "wizard-text") {
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
    }
  }, [currentStep, pendingTmdbResult]);

  /**
   * Handles wizard next navigation.
   * Skips poster/hero steps when no Drive connection (images require Drive).
   */
  const handleWizardNext = useCallback(() => {
    if (currentStep === "wizard-text") {
      // Skip image steps if no Drive connection
      if (!hasDriveConnection) {
        handleWizardComplete();
      } else {
        setCurrentStep("wizard-poster");
      }
    } else if (currentStep === "wizard-poster") {
      setCurrentStep("wizard-hero");
    } else if (currentStep === "wizard-hero") {
      handleWizardComplete();
    }
  }, [currentStep, hasDriveConnection, handleWizardComplete]);

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
    handleWizardComplete();
  }, [currentStep, handleWizardComplete]);

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

  // Details tab content
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
          {(isLoadingPreview || isApplyingMetadata) && (
            <div className="bg-background/80 absolute inset-0 flex items-center justify-center rounded-md">
              <div className="flex items-center gap-2">
                <Loader2
                  aria-hidden="true"
                  className="text-muted-foreground size-4 animate-spin"
                />
                <span className="text-muted-foreground text-sm">
                  {isLoadingPreview ? "Loading preview…" : "Applying…"}
                </span>
              </div>
            </div>
          )}
        </div>
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
          maxLength={1000}
          className="min-h-[80px] resize-none"
        />
        <p className="text-muted-foreground text-xs tabular-nums">
          {description.length}/1000 characters
        </p>
      </div>
    </div>
  );

  // Files tab content
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
        label="Primary Media"
        description="The file that plays when clicking on this item."
        icon={Film}
        files={files.media}
        selectedId={primaryMediaId}
        onSelect={setPrimaryMediaId}
        onUploadComplete={handleUploadComplete}
        onFileDeleted={handleFileDeleted}
        itemId={item.id}
        fileType="media"
        disabled={!hasDriveConnection}
      />

      <FileTypeCombobox
        label="Primary Artwork"
        description="The image used as the thumbnail."
        icon={ImageIcon}
        files={files.artwork}
        selectedId={primaryArtworkId}
        onSelect={setPrimaryArtworkId}
        onUploadComplete={handleUploadComplete}
        onFileDeleted={handleFileDeleted}
        itemId={item.id}
        fileType="artwork"
        disabled={!hasDriveConnection}
      />

      <FileTypeCombobox
        label="Hero Image"
        description="The image used as the banner background."
        icon={Sparkles}
        files={files.artwork}
        selectedId={heroArtworkId}
        onSelect={setHeroArtworkId}
        onUploadComplete={handleUploadComplete}
        onFileDeleted={handleFileDeleted}
        itemId={item.id}
        fileType="artwork"
        disabled={!hasDriveConnection}
      />

      <FileTypeCombobox
        label="Default Subtitle"
        description="The subtitle track that loads by default."
        icon={FileText}
        files={files.subtitles}
        selectedId={primarySubtitleId}
        onSelect={setPrimarySubtitleId}
        onUploadComplete={handleUploadComplete}
        onFileDeleted={handleFileDeleted}
        itemId={item.id}
        fileType="subtitle"
        disabled={!hasDriveConnection}
      />
    </div>
  );

  // Wizard step number for display
  const wizardStepNumber =
    currentStep === "wizard-text" ? 1 : currentStep === "wizard-poster" ? 2 : 3;

  // Episode picker display
  const displayTitle = pendingTmdbResult
    ? pendingTmdbResult.year
      ? `${pendingTmdbResult.title} (${pendingTmdbResult.year})`
      : pendingTmdbResult.title
    : "";

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
                <Settings2 aria-hidden="true" className="text-primary size-5" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-lg">Item Settings</DialogTitle>
                <DialogDescription className="text-sm">
                  {hasDriveConnection
                    ? "Configure display preferences and upload files"
                    : "Configure display preferences"}
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
                <Sparkles
                  aria-hidden="true"
                  className="size-5 text-amber-500"
                />
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-lg">Apply Metadata</DialogTitle>
                <DialogDescription className="text-sm">
                  Step {hasDriveConnection ? wizardStepNumber : 1} of{" "}
                  {hasDriveConnection ? 3 : 1}:{" "}
                  {currentStep === "wizard-text"
                    ? "Title & Description"
                    : currentStep === "wizard-poster"
                      ? "Select Poster"
                      : "Select Hero"}
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
   * Gets the footer content for the current step.
   * Footers are rendered outside the animated area via slot-based API.
   */
  const getStepFooter = () => {
    switch (currentStep) {
      case "main":
        return (
          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!isDirty || isSaving}>
              {isSaving ? (
                <>
                  <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
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
            <Button
              variant="outline"
              onClick={handleWizardCancel}
              disabled={isApplyingMetadata}
            >
              Cancel
            </Button>
            {/* Hide Skip All when no Drive - there are no image steps to skip */}
            {hasDriveConnection && (
              <Button
                variant="destructive"
                onClick={handleWizardSkipAll}
                disabled={isApplyingMetadata}
              >
                Skip All
              </Button>
            )}
            <Button onClick={handleWizardNext} disabled={isApplyingMetadata}>
              {isApplyingMetadata ? (
                <>
                  <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                  Applying...
                </>
              ) : hasDriveConnection ? (
                "Next"
              ) : (
                "Apply"
              )}
            </Button>
          </DialogFooter>
        );
      case "wizard-poster":
        return (
          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleWizardCancel}
              disabled={isApplyingMetadata}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleWizardSkipAll}
              disabled={isApplyingMetadata}
            >
              Skip All
            </Button>
            <Button onClick={handleWizardNext} disabled={isApplyingMetadata}>
              Next
            </Button>
          </DialogFooter>
        );
      case "wizard-hero":
        return (
          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleWizardCancel}
              disabled={isApplyingMetadata}
            >
              Cancel
            </Button>
            <Button onClick={handleWizardNext} disabled={isApplyingMetadata}>
              {isApplyingMetadata ? (
                <>
                  <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                  Applying...
                </>
              ) : (
                "Apply"
              )}
            </Button>
          </DialogFooter>
        );
      default:
        return null;
    }
  };

  /**
   * Gets the body content for the current step.
   * Bodies are rendered inside the animated area.
   */
  const getStepBody = () => {
    switch (currentStep) {
      case "main":
        return (
          <div className="min-w-0 py-2">
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
                <ChevronRight
                  aria-hidden="true"
                  className="text-muted-foreground/50 size-4"
                />
                <span className="text-foreground font-medium">
                  {selectedSeason.name}
                </span>
              </div>
            )}

            <div className="min-h-[280px]">
              {!selectedSeason ? (
                isLoadingSeasons ? (
                  <LoadingState message="Loading seasons..." />
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
              ) : isLoadingEpisodes ? (
                <LoadingState message="Loading episodes..." />
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
            {/* Step indicator - 1 step without Drive, 3 with Drive */}
            <div className="flex gap-1.5 py-2">
              {(hasDriveConnection ? [1, 2, 3] : [1]).map((step) => (
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
            <div className="flex gap-1.5 py-2">
              {[1, 2, 3].map((step) => (
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
                existingFiles={existingArtwork}
                uploadMode={false}
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
            <div className="flex gap-1.5 py-2">
              {[1, 2, 3].map((step) => (
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
                existingFiles={existingArtwork}
                uploadMode={false}
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
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <AnimatedDialogContent
        stepKey={currentStep}
        className="max-h-[90vh]"
        header={getStepHeader()}
        footer={getStepFooter()}
      >
        {getStepBody()}
      </AnimatedDialogContent>
    </Dialog>
  );
}
