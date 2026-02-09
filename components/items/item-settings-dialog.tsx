/**
 * Unified item settings dialog with tabbed interface and single atomic save.
 * Uses step-based navigation for TV episode picker and TMDB metadata wizard.
 * Consolidates name, description (Details tab) and file selections (Files tab).
 */

"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
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
import { FileTypeCombobox } from "@/components/items/file-type-combobox";
import { MediaSearchCombobox } from "@/components/items/media-search-combobox";
import { ItemDialogTabs } from "@/components/items/item-dialog-tabs";
import type { CurrentTextValues } from "@/components/items/wizards/tmdb-wizard/title-description-step";
import {
  TMDBWizard,
  type TMDBWizardResult,
  type TMDBWizardHeaderProps,
  type TMDBWizardFooterProps,
} from "./wizards/tmdb-wizard";
import { WizardStepIndicator } from "@/components/wizards/wizard-step-indicator";
import {
  TVPicker,
  type TVPickerResult,
  type TVPickerSelection,
  type TVPickerLevel,
} from "./wizards/tv-picker";
import { updateItemSettings } from "@/lib/item-file-actions";
import {
  applyMetadataAction,
  getMetadataPreviewAction,
  getEpisodePreviewAction,
} from "@/lib/tmdb-actions";
import type { TMDBSearchResult } from "@/lib/tmdb-client";
import type { TextPreviewData } from "@/components/items/wizards/tmdb-wizard/title-description-step";
import { toast } from "sonner";
import type { SerializedItemFile } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ITEM_MESSAGES } from "@/lib/constants/messages";
import { VisibilityToggle } from "@/components/items/visibility-toggle";

/** Steps for item settings dialog navigation. */
type ItemSettingsStep = "main" | "episode-picker" | "tmdb-wizard";

interface ItemSettingsDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog open state changes */
  onOpenChange: (open: boolean) => void;
  /** The item being configured */
  item: {
    id: string;
    name: string;
    description: string | null;
    isPublic: boolean;
    inheritVisibility: boolean;
    hasParent: boolean;
    hasChildren: boolean;
  };
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

  // TV picker level state (for level-aware back navigation)
  const [tvPickerLevel, setTvPickerLevel] = useState<TVPickerLevel>("show");
  const tvPickerBackRef = useRef<(() => void) | null>(null);

  // TMDB wizard state (for rendering step indicator in header, buttons in footer)
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

  // Track successful uploads during this dialog session
  const [uploadCount, setUploadCount] = useState(0);

  // TMDB state
  const [pendingTmdbResult, setPendingTmdbResult] =
    useState<TMDBSearchResult | null>(null);
  const [tmdbPreview, setTmdbPreview] = useState<TextPreviewData | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  // Track if wizard is applying metadata
  const [isEpisodeMode, setIsEpisodeMode] = useState(false);

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
      setIsEpisodeMode(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Sync form state when item changes
  useEffect(() => {
    setName(item.name);
    setDescription(item.description ?? "");
    setIsPublic(item.isPublic);
    setInheritVisibility(item.inheritVisibility);
  }, [item.name, item.description, item.isPublic, item.inheritVisibility]);

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
        onOpenChange(false);
        onSettingsChange?.().catch((err) => {
          console.warn("[ItemSettingsDialog] Refetch failed after save:", err);
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
            setIsEpisodeMode(true);
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
            setIsEpisodeMode(false);
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
   * Handles episode picker cancel.
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
   * Applies the wizard result using applyMetadataAction.
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
              "[ItemSettingsDialog] Refetch failed after metadata apply:",
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
        setIsEpisodeMode(false);
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
    setIsEpisodeMode(false);
    setCurrentStep("main");
  }, []);

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

      {/* Visibility settings */}
      <div className="space-y-2 pt-2">
        <Label>Visibility</Label>
        <VisibilityToggle
          itemId={item.id}
          itemName={name}
          isPublic={isPublic}
          inheritVisibility={inheritVisibility}
          hasParent={item.hasParent}
          hasChildren={item.hasChildren}
          onVisibilityChange={(newIsPublic) => {
            setIsPublic(newIsPublic);
            onSettingsChange?.().catch((err) => {
              console.warn(
                "[ItemSettingsDialog] Refetch failed after visibility change:",
                err
              );
            });
          }}
          onInheritChange={(newInherit) => {
            setInheritVisibility(newInherit);
            onSettingsChange?.().catch((err) => {
              console.warn(
                "[ItemSettingsDialog] Refetch failed after inherit change:",
                err
              );
            });
          }}
        />
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
                <Tv aria-hidden="true" className="size-5 text-blue-500" />
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-lg">Select Season</DialogTitle>
                <DialogDescription className="truncate text-sm">
                  {displayTitle}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        );
      case "tmdb-wizard":
        return (
          <DialogHeader>
            {wizardHeaderProps && (
              <div className="pb-4">
                <WizardStepIndicator
                  steps={wizardHeaderProps.steps}
                  currentStep={wizardHeaderProps.currentStep}
                  stepLabels={wizardHeaderProps.stepLabels}
                />
              </div>
            )}
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleWizardCancel}
                disabled={isApplyingMetadata}
                className="hover:bg-muted/50 size-10 transition-all active:scale-95"
                aria-label="Cancel"
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
                  {tmdbPreview?.name || "Select metadata to apply"}
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
        // EpisodePicker component handles its own action buttons
        return null;
      case "tmdb-wizard":
        // Render footer from wizard state (synced via onFooterChange)
        if (!wizardFooterProps) return null;
        return (
          <DialogFooter>
            <div className="flex w-full justify-between gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={wizardFooterProps.onBack}
                disabled={wizardFooterProps.isDisabled}
              >
                <ChevronLeft className="mr-2 h-4 w-4" aria-hidden="true" />
                Back
              </Button>
              <div className="flex gap-2">
                {wizardFooterProps.onSkipAll && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={wizardFooterProps.onSkipAll}
                    disabled={wizardFooterProps.isDisabled}
                  >
                    Skip All
                  </Button>
                )}
                <Button
                  type="button"
                  onClick={wizardFooterProps.onNext}
                  disabled={wizardFooterProps.isDisabled}
                >
                  {wizardFooterProps.isLastStep ? "Apply" : "Next"}
                  {!wizardFooterProps.isLastStep && (
                    <ChevronRight className="ml-2 h-4 w-4" aria-hidden="true" />
                  )}
                </Button>
              </div>
            </div>
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
        if (!pendingTmdbResult) return null;
        return (
          <TVPicker
            initialData={{
              tmdbResult: pendingTmdbResult,
            }}
            onComplete={handleTVPickerComplete}
            onCancel={handleEpisodePickerCancel}
            onLevelChange={setTvPickerLevel}
            renderFooter={(props) => {
              // Store the onBack ref for header back button
              tvPickerBackRef.current = props.onBack;
              return (
                <DialogFooter>
                  <Button
                    onClick={props.onUseSelection}
                    disabled={props.isDisabled}
                  >
                    {props.level === "show"
                      ? "Use This Show"
                      : "Use This Season"}
                  </Button>
                </DialogFooter>
              );
            }}
          />
        );
      case "tmdb-wizard":
        if (!tmdbPreview || !pendingTmdbResult) return null;
        return (
          <TMDBWizard
            initialData={{
              tmdbResult: pendingTmdbResult,
              preview: tmdbPreview,
              isEpisodeMode: isEpisodeMode,
            }}
            currentValues={currentValues}
            uploadMode={false}
            hasDriveConnection={hasDriveConnection}
            existingArtwork={files.artwork}
            existingHero={files.artwork}
            onComplete={handleTMDBWizardComplete}
            onHeaderChange={setWizardHeaderProps}
            onFooterChange={setWizardFooterProps}
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
        className="max-h-[90vh] sm:max-w-2xl"
        header={getStepHeader()}
        footer={getStepFooter()}
      >
        {getStepBody()}
      </AnimatedDialogContent>
    </Dialog>
  );
}
