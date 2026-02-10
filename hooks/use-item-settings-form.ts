/**
 * Shared hook for item settings form state management.
 * Extracted from ItemSettingsDialog to be reused by both the desktop dialog
 * and mobile MobileItemSheet. Manages form fields, dirty tracking,
 * save/cancel, wizard navigation, and TMDB display options.
 */

"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import { updateItemSettings } from "@/lib/item-file-actions";
import {
  applyMetadataAction,
  getMetadataPreviewAction,
  getEpisodePreviewAction,
  updateTmdbDisplayOptions,
} from "@/lib/tmdb-actions";
import type { TMDBSearchResult } from "@/lib/tmdb-client";
import type { SerializedItemFile, TmdbDisplayOptions } from "@/lib/types";
import type { CurrentTextValues } from "@/components/items/wizards/tmdb-wizard/title-description-step";
import type { TextPreviewData } from "@/components/items/wizards/tmdb-wizard/title-description-step";
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
import { ITEM_MESSAGES } from "@/lib/constants/messages";

/** Steps for item settings navigation. */
export type ItemSettingsStep = "main" | "episode-picker" | "tmdb-wizard";

/** Item data required by the settings form. */
export interface ItemSettingsFormItem {
  id: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  inheritVisibility: boolean;
  hasParent: boolean;
  hasChildren: boolean;
  tmdbId: number | null;
  tmdbShowTagline: boolean;
  tmdbShowMetadata: boolean;
  tmdbShowGenres: boolean;
  tmdbShowCast: boolean;
  tmdbShowProviders: boolean;
  tmdbShowVideos: boolean;
  tmdbShowRecommendations: boolean;
}

/** Files grouped by type for settings form. */
export interface ItemSettingsFormFiles {
  media: SerializedItemFile[];
  artwork: SerializedItemFile[];
  subtitles: SerializedItemFile[];
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

/** Return type for the useItemSettingsForm hook. */
export interface UseItemSettingsFormReturn {
  // Form fields
  name: string;
  setName: (name: string) => void;
  description: string;
  setDescription: (description: string) => void;
  isPublic: boolean;
  setIsPublic: (isPublic: boolean) => void;
  inheritVisibility: boolean;
  setInheritVisibility: (inherit: boolean) => void;
  primaryMediaId: string | undefined;
  setPrimaryMediaId: (id: string | undefined) => void;
  primaryArtworkId: string | undefined;
  setPrimaryArtworkId: (id: string | undefined) => void;
  heroArtworkId: string | undefined;
  setHeroArtworkId: (id: string | undefined) => void;
  primarySubtitleId: string | undefined;
  setPrimarySubtitleId: (id: string | undefined) => void;

  // Dirty tracking
  isDirty: boolean;

  // Save/Cancel
  save: () => Promise<void>;
  cancel: () => void;
  isSaving: boolean;

  // Upload tracking
  uploadCount: number;
  handleUploadComplete: (successCount: number) => Promise<void>;
  handleFileDeleted: () => Promise<void>;

  // Wizard navigation
  currentStep: ItemSettingsStep;
  setCurrentStep: (step: ItemSettingsStep) => void;

  // TV picker state
  tvPickerLevel: TVPickerLevel;
  setTvPickerLevel: (level: TVPickerLevel) => void;
  tvPickerBackRef: React.RefObject<(() => void) | null>;

  // TMDB wizard state
  wizardHeaderProps: TMDBWizardHeaderProps | null;
  setWizardHeaderProps: (props: TMDBWizardHeaderProps | null) => void;
  wizardFooterProps: TMDBWizardFooterProps | null;
  setWizardFooterProps: (props: TMDBWizardFooterProps | null) => void;

  // TMDB media selection
  pendingTmdbResult: TMDBSearchResult | null;
  tmdbPreview: TextPreviewData | null;
  isLoadingPreview: boolean;
  isApplyingMetadata: boolean;
  contentType: "movie" | "show" | "season" | "episode";
  handleMediaSelect: (result: TMDBSearchResult) => Promise<void>;
  handleEpisodePickerCancel: () => void;
  handleEpisodePickerBack: () => void;
  handleTVPickerComplete: (result: TVPickerResult) => Promise<void>;
  handleTMDBWizardComplete: (result: TMDBWizardResult) => Promise<void>;
  handleWizardCancel: () => void;

  // TMDB display options
  displayOptions: TmdbDisplayOptions;
  handleDisplayOptionsChange: (updated: TmdbDisplayOptions) => void;
  isSavingDisplay: boolean;

  // Current values for wizard
  currentValues: CurrentTextValues;

  // Display title for episode picker
  displayTitle: string;

  // Reset function (called when dialog/sheet opens)
  resetForm: () => void;
}

/**
 * Manages all item settings form state, shared between desktop ItemSettingsDialog
 * and mobile MobileItemSheet.
 *
 * @param item - The item being configured
 * @param files - Files attached to the item, grouped by type
 * @param onSettingsChange - Optional callback when settings are saved
 * @param onClose - Callback to close the dialog/sheet
 * @returns Form state, handlers, and wizard navigation
 */
export function useItemSettingsForm(
  item: ItemSettingsFormItem,
  files: ItemSettingsFormFiles,
  onSettingsChange?: () => Promise<void>,
  onClose?: () => void
): UseItemSettingsFormReturn {
  // Current step
  const [currentStep, setCurrentStep] = useState<ItemSettingsStep>("main");

  // TV picker level state
  const [tvPickerLevel, setTvPickerLevel] = useState<TVPickerLevel>("show");
  const tvPickerBackRef = useRef<(() => void) | null>(null);

  // TMDB wizard state
  const [wizardHeaderProps, setWizardHeaderProps] =
    useState<TMDBWizardHeaderProps | null>(null);
  const [wizardFooterProps, setWizardFooterProps] =
    useState<TMDBWizardFooterProps | null>(null);

  // Form state
  const [name, setName] = useState(item.name);
  const [description, setDescription] = useState(item.description ?? "");
  const [isPublic, setIsPublic] = useState(item.isPublic);
  const [inheritVisibility, setInheritVisibility] = useState(
    item.inheritVisibility
  );
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

  // Track successful uploads during this session
  const [uploadCount, setUploadCount] = useState(0);

  // TMDB state
  const [pendingTmdbResult, setPendingTmdbResult] =
    useState<TMDBSearchResult | null>(null);
  const [tmdbPreview, setTmdbPreview] = useState<TextPreviewData | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [contentType, setContentType] = useState<
    "movie" | "show" | "season" | "episode"
  >("movie");

  // TMDB display options state
  const [displayOptions, setDisplayOptions] = useState<TmdbDisplayOptions>({
    showTagline: item.tmdbShowTagline,
    showMetadata: item.tmdbShowMetadata,
    showGenres: item.tmdbShowGenres,
    showCast: item.tmdbShowCast,
    showProviders: item.tmdbShowProviders,
    showVideos: item.tmdbShowVideos,
    showRecommendations: item.tmdbShowRecommendations,
  });
  const [isSavingDisplay, setIsSavingDisplay] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  // Extract stable primitive file IDs to avoid object reference instability
  const initialMediaId = useMemo(
    () => findPrimaryFile(files.media)?.id,
    [files.media]
  );
  const initialArtworkId = useMemo(
    () => findPrimaryFile(files.artwork)?.id,
    [files.artwork]
  );
  const initialHeroId = useMemo(
    () => findHeroFile(files.artwork)?.id ?? findPrimaryFile(files.artwork)?.id,
    [files.artwork]
  );
  const initialSubtitleId = useMemo(
    () => findPrimaryFile(files.subtitles)?.id,
    [files.subtitles]
  );

  // Original values for dirty checking
  const [originalValues, setOriginalValues] = useState(() => ({
    name: item.name,
    description: item.description ?? "",
    primaryMediaId: initialMediaId,
    primaryArtworkId: initialArtworkId,
    heroArtworkId: initialHeroId,
    primarySubtitleId: initialSubtitleId,
  }));

  /**
   * Resets form to initial state. Called when dialog/sheet opens.
   */
  const resetForm = useCallback(() => {
    setCurrentStep("main");
    setUploadCount(0);
    setOriginalValues({
      name: item.name,
      description: item.description ?? "",
      primaryMediaId: initialMediaId,
      primaryArtworkId: initialArtworkId,
      heroArtworkId: initialHeroId,
      primarySubtitleId: initialSubtitleId,
    });
    setPendingTmdbResult(null);
    setTmdbPreview(null);
    setContentType("movie");
  }, [
    item.name,
    item.description,
    initialMediaId,
    initialArtworkId,
    initialHeroId,
    initialSubtitleId,
  ]);

  // Sync form state when item changes
  useEffect(() => {
    setName(item.name);
    setDescription(item.description ?? "");
    setIsPublic(item.isPublic);
    setInheritVisibility(item.inheritVisibility);
  }, [item.name, item.description, item.isPublic, item.inheritVisibility]);

  // Sync file selections when files change
  useEffect(() => {
    setPrimaryMediaId(initialMediaId);
    setPrimaryArtworkId(initialArtworkId);
    setHeroArtworkId(initialHeroId);
    setPrimarySubtitleId(initialSubtitleId);
  }, [initialMediaId, initialArtworkId, initialHeroId, initialSubtitleId]);

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

  /**
   * Resets form to original values and closes.
   */
  const cancel = useCallback(() => {
    setName(originalValues.name);
    setDescription(originalValues.description);
    setPrimaryMediaId(originalValues.primaryMediaId);
    setPrimaryArtworkId(originalValues.primaryArtworkId);
    setHeroArtworkId(originalValues.heroArtworkId);
    setPrimarySubtitleId(originalValues.primarySubtitleId);
    onClose?.();
  }, [originalValues, onClose]);

  /**
   * Saves all changes atomically.
   */
  const save = useCallback(async () => {
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
        onClose?.();
        onSettingsChange?.().catch((err) => {
          console.warn("[useItemSettingsForm] Refetch failed after save:", err);
        });
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
    onClose,
  ]);

  /**
   * Handles upload completion.
   */
  const handleUploadComplete = useCallback(
    async (successCount: number) => {
      setUploadCount((prev) => prev + successCount);
      await onSettingsChange?.().catch((err) => {
        console.warn("[useItemSettingsForm] Refetch failed after upload:", err);
      });
    },
    [onSettingsChange]
  );

  /**
   * Handles file deletion.
   */
  const handleFileDeleted = useCallback(async () => {
    await onSettingsChange?.().catch((err) => {
      console.warn("[useItemSettingsForm] Refetch failed after delete:", err);
    });
  }, [onSettingsChange]);

  /**
   * Fetches preview data and navigates to TMDBWizard.
   */
  const fetchPreviewAndOpenWizard = useCallback(
    async (
      tmdbId: number,
      mediaType: "movie" | "tv",
      episodeSel?: TVPickerSelection
    ) => {
      setIsLoadingPreview(true);

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
            setContentType("episode");
            setCurrentStep("tmdb-wizard");
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
            setContentType(mediaType === "tv" ? "show" : "movie");
            setCurrentStep("tmdb-wizard");
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
    []
  );

  /**
   * Handles TMDB media selection.
   */
  const handleMediaSelect = useCallback(
    async (result: TMDBSearchResult) => {
      setPendingTmdbResult(result);

      if (result.mediaType === "tv") {
        setCurrentStep("episode-picker");
        return;
      }

      await fetchPreviewAndOpenWizard(result.id, result.mediaType);
    },
    [fetchPreviewAndOpenWizard]
  );

  /**
   * Handles episode picker cancel.
   */
  const handleEpisodePickerCancel = useCallback(() => {
    setPendingTmdbResult(null);
    setTvPickerLevel("show");
    setCurrentStep("main");
  }, []);

  /**
   * Handles level-aware back navigation for episode picker.
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
   */
  const handleTMDBWizardComplete = useCallback(
    async (result: TMDBWizardResult) => {
      setIsApplyingMetadata(true);

      try {
        const response = await applyMetadataAction(
          item.id,
          result.tmdbResult.id,
          result.tmdbResult.mediaType,
          {
            updateName: result.textOptions.updateName,
            updateDescription: result.textOptions.updateDescription,
            updatePoster:
              result.poster !== null &&
              result.poster.source === "tmdb" &&
              result.poster.value !== null,
            updateBackdrop:
              result.backdrop !== null &&
              result.backdrop.source === "tmdb" &&
              result.backdrop.value !== null,
          },
          result.displayOptions
        );

        if (response.success) {
          toast.success(ITEM_MESSAGES.METADATA_APPLIED);
          await onSettingsChange?.().catch((err) => {
            console.warn(
              "[useItemSettingsForm] Refetch failed after metadata apply:",
              err
            );
          });
        } else {
          toast.error(response.error || ITEM_MESSAGES.METADATA_FAILED);
        }
      } catch {
        toast.error(ITEM_MESSAGES.METADATA_FAILED);
      } finally {
        setIsApplyingMetadata(false);
        setPendingTmdbResult(null);
        setTmdbPreview(null);
        setContentType("movie");
        setCurrentStep("main");
      }
    },
    [item.id, onSettingsChange]
  );

  /**
   * Handles wizard cancel.
   */
  const handleWizardCancel = useCallback(() => {
    setPendingTmdbResult(null);
    setTmdbPreview(null);
    setContentType("movie");
    setCurrentStep("main");
  }, []);

  /**
   * Handles display option changes with debounced auto-save.
   */
  const handleDisplayOptionsChange = useCallback(
    (updated: TmdbDisplayOptions) => {
      setDisplayOptions(updated);

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(async () => {
        if (!mountedRef.current) return;
        setIsSavingDisplay(true);
        try {
          const result = await updateTmdbDisplayOptions(item.id, updated);
          if (!mountedRef.current) return;
          if (!result.success) {
            toast.error(result.error);
          } else {
            await onSettingsChange?.();
          }
        } catch {
          if (!mountedRef.current) return;
          toast.error("Failed to update display options");
        } finally {
          if (mountedRef.current) {
            setIsSavingDisplay(false);
          }
        }
      }, 300);
    },
    [item.id, onSettingsChange]
  );

  // Clean up debounce timeout on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Sync display options when item TMDB fields change
  useEffect(() => {
    setDisplayOptions({
      showTagline: item.tmdbShowTagline,
      showMetadata: item.tmdbShowMetadata,
      showGenres: item.tmdbShowGenres,
      showCast: item.tmdbShowCast,
      showProviders: item.tmdbShowProviders,
      showVideos: item.tmdbShowVideos,
      showRecommendations: item.tmdbShowRecommendations,
    });
  }, [
    item.id,
    item.tmdbShowTagline,
    item.tmdbShowMetadata,
    item.tmdbShowGenres,
    item.tmdbShowCast,
    item.tmdbShowProviders,
    item.tmdbShowVideos,
    item.tmdbShowRecommendations,
  ]);

  // Episode picker display title
  const displayTitle = pendingTmdbResult
    ? pendingTmdbResult.year
      ? `${pendingTmdbResult.title} (${pendingTmdbResult.year})`
      : pendingTmdbResult.title
    : "";

  return {
    // Form fields
    name,
    setName,
    description,
    setDescription,
    isPublic,
    setIsPublic,
    inheritVisibility,
    setInheritVisibility,
    primaryMediaId,
    setPrimaryMediaId,
    primaryArtworkId,
    setPrimaryArtworkId,
    heroArtworkId,
    setHeroArtworkId,
    primarySubtitleId,
    setPrimarySubtitleId,

    // Dirty tracking
    isDirty,

    // Save/Cancel
    save,
    cancel,
    isSaving,

    // Upload tracking
    uploadCount,
    handleUploadComplete,
    handleFileDeleted,

    // Wizard navigation
    currentStep,
    setCurrentStep,

    // TV picker state
    tvPickerLevel,
    setTvPickerLevel,
    tvPickerBackRef,

    // TMDB wizard state
    wizardHeaderProps,
    setWizardHeaderProps,
    wizardFooterProps,
    setWizardFooterProps,

    // TMDB media selection
    pendingTmdbResult,
    tmdbPreview,
    isLoadingPreview,
    isApplyingMetadata,
    contentType,
    handleMediaSelect,
    handleEpisodePickerCancel,
    handleEpisodePickerBack,
    handleTVPickerComplete,
    handleTMDBWizardComplete,
    handleWizardCancel,

    // TMDB display options
    displayOptions,
    handleDisplayOptionsChange,
    isSavingDisplay,

    // Current values for wizard
    currentValues,

    // Display title
    displayTitle,

    // Reset
    resetForm,
  };
}
