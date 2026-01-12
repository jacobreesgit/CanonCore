/**
 * Modal dialog for creating new items with tabbed interface.
 * Provides Details tab (name, description, TMDB search) and Files tab (categorized upload queues).
 * Files are queued by category during creation and uploaded after item is created.
 */

"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Plus,
  Loader2,
  Film,
  ImageIcon,
  FileText,
  Sparkles,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { MediaSearchCombobox } from "./media-search-combobox";
import { ItemDialogTabs } from "./item-dialog-tabs";
import { FileTypeCombobox } from "./file-type-combobox";
import {
  MetadataWizardModal,
  type MetadataWizardResult,
} from "./metadata-wizard-modal";
import { EpisodePicker, type EpisodePickerSelection } from "./episode-picker";
import type {
  CurrentTextValues,
  TextPreviewData,
} from "./title-description-step";
import {
  getMetadataPreviewAction,
  getImagesAction,
  getEpisodePreviewAction,
} from "@/lib/tmdb-actions";
import type { TMDBSearchResult, TMDBImages } from "@/lib/tmdb-client";
import type {
  QueuedFile,
  QueuedFilesByCategory,
  TMDBMetadataSelection,
} from "@/lib/types";
import { toast } from "sonner";

interface AddItemDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog open state changes */
  onOpenChange: (open: boolean) => void;
  /**
   * Callback to create the item.
   * Returns error message or undefined on success.
   *
   * @param name - Item name
   * @param description - Optional description
   * @param queuedFiles - Optional files to upload after creation
   * @param tmdbSelection - Optional TMDB metadata to apply
   */
  onAdd: (
    name: string,
    description?: string,
    queuedFiles?: QueuedFile[],
    tmdbSelection?: TMDBMetadataSelection
  ) => Promise<string | undefined>;
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
 * Sets isPrimary and isHero based on category rules:
 * - Primary Media: first file gets isPrimary
 * - Primary Artwork: first file gets isPrimary
 * - Hero Image: first file gets isHero (NOT isPrimary)
 * - Default Subtitle: first file gets isPrimary
 *
 * @param queuedFiles - Categorized queued files
 * @returns Flat array of QueuedFile with proper flags set
 */
function prepareFilesForUpload(
  queuedFiles: QueuedFilesByCategory
): QueuedFile[] {
  const result: QueuedFile[] = [];

  // Primary Media: first gets isPrimary
  queuedFiles.media.forEach((file, index) => {
    result.push({ ...file, isPrimary: index === 0, isHero: false });
  });

  // Primary Artwork: first gets isPrimary
  queuedFiles.artwork.forEach((file, index) => {
    result.push({ ...file, isPrimary: index === 0, isHero: false });
  });

  // Hero Image: first gets isHero (NOT isPrimary)
  queuedFiles.hero.forEach((file, index) => {
    result.push({ ...file, isPrimary: false, isHero: index === 0 });
  });

  // Default Subtitle: first gets isPrimary
  queuedFiles.subtitle.forEach((file, index) => {
    result.push({ ...file, isPrimary: index === 0, isHero: false });
  });

  return result;
}

/**
 * Modal dialog for creating items with tabbed interface.
 * Details tab: Name input with TMDB search, description textarea.
 * Files tab: Categorized dropzones for each file type (media, artwork, hero, subtitle).
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
  parentName,
  hasDriveConnection = false,
}: AddItemDialogProps) {
  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);

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
  const [showWizard, setShowWizard] = useState(false);
  const [selectedTmdbOptions, setSelectedTmdbOptions] =
    useState<TMDBMetadataSelection | null>(null);

  // Episode picker state (for TV shows)
  const [showEpisodePicker, setShowEpisodePicker] = useState(false);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setName("");
      setDescription("");
      setIsLoading(false);
      setQueuedFiles(initialQueuedFiles);
      setPendingTmdbResult(null);
      setTmdbPreview(null);
      setTmdbImages(null);
      setShowWizard(false);
      setSelectedTmdbOptions(null);
      setShowEpisodePicker(false);
    }
  }, [open]);

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
   * Fetches preview data and opens the wizard.
   * Used for movies directly and for TV shows after episode picker selection.
   */
  const fetchPreviewAndOpenWizard = useCallback(
    async (
      tmdbId: number,
      mediaType: "movie" | "tv",
      episodeSel?: EpisodePickerSelection
    ) => {
      setIsLoadingPreview(true);
      setTmdbImages(null);

      try {
        // For episode selection, fetch episode-specific preview
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
            setShowWizard(true);

            // Episodes don't have poster/backdrop selection - use still image
            // The wizard will handle this via the episode metadata
            setTmdbImages({ posters: [], backdrops: [] });
          } else {
            toast.error("Could not fetch episode preview");
            applyBasicInfo();
          }
        } else {
          // For show/season/movie, use standard preview
          const response = await getMetadataPreviewAction(tmdbId, mediaType);

          if (response.success && response.data) {
            setTmdbPreview({
              name: response.data.name,
              description: response.data.description,
            });
            setShowWizard(true);

            // Fetch images in the background for the wizard
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
          }
        }
      } catch {
        applyBasicInfo();
      } finally {
        setIsLoadingPreview(false);
      }
    },
    [applyBasicInfo]
  );

  /**
   * Handles TMDB media selection.
   * For movies: fetches preview and opens wizard directly.
   * For TV shows: opens episode picker for drill-down selection.
   */
  const handleMediaSelect = useCallback(
    async (result: TMDBSearchResult) => {
      setPendingTmdbResult(result);

      // For TV shows, show episode picker first
      if (result.mediaType === "tv") {
        setShowEpisodePicker(true);
        return;
      }

      // For movies, proceed directly to wizard
      await fetchPreviewAndOpenWizard(result.id, result.mediaType);
    },
    [fetchPreviewAndOpenWizard]
  );

  /**
   * Handles episode picker selection.
   * Fetches appropriate preview based on selection type.
   */
  const handleEpisodePickerSelect = useCallback(
    async (selection: EpisodePickerSelection) => {
      if (!pendingTmdbResult) return;

      setShowEpisodePicker(false);
      await fetchPreviewAndOpenWizard(
        pendingTmdbResult.id,
        pendingTmdbResult.mediaType,
        selection
      );
    },
    [pendingTmdbResult, fetchPreviewAndOpenWizard]
  );

  /**
   * Handles episode picker cancellation.
   */
  const handleEpisodePickerCancel = useCallback(() => {
    setPendingTmdbResult(null);
    setShowEpisodePicker(false);
  }, []);

  /**
   * Handles wizard completion with selected metadata options.
   * Applies text fields immediately and stores selection for item creation.
   */
  const handleWizardComplete = useCallback(
    (result: MetadataWizardResult) => {
      if (!pendingTmdbResult || !tmdbPreview) return;

      // Apply text fields immediately for preview
      if (result.textOptions.updateName) {
        setName(tmdbPreview.name);
      }
      if (result.textOptions.updateDescription) {
        setDescription(tmdbPreview.description);
      }

      // Determine poster and backdrop paths from wizard result
      const posterPath = result.posterSkipped ? null : result.posterPath;
      const backdropPath = result.backdropSkipped ? null : result.backdropPath;

      // Store selection for item creation
      setSelectedTmdbOptions({
        tmdbId: pendingTmdbResult.id,
        mediaType: pendingTmdbResult.mediaType,
        options: {
          updateName: result.textOptions.updateName,
          updateDescription: result.textOptions.updateDescription,
          updatePoster: !result.posterSkipped && !!posterPath,
          updateBackdrop: !result.backdropSkipped && !!backdropPath,
        },
        preview: {
          name: tmdbPreview.name,
          description: tmdbPreview.description,
          posterPath,
          backdropPath,
        },
      });

      setShowWizard(false);
    },
    [pendingTmdbResult, tmdbPreview]
  );

  /**
   * Handles cancellation of wizard.
   */
  const handleWizardCancel = useCallback(() => {
    setPendingTmdbResult(null);
    setTmdbPreview(null);
    setTmdbImages(null);
    setShowWizard(false);
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
   * Submits the form to create the item.
   */
  async function handleSubmit() {
    if (!name.trim() || isLoading) return;

    setIsLoading(true);
    try {
      const desc = description.trim() || undefined;
      // Transform categorized files to flat array with proper flags
      const filesToUpload =
        totalQueuedCount > 0 ? prepareFilesForUpload(queuedFiles) : undefined;
      const error = await onAdd(
        name.trim(),
        desc,
        filesToUpload,
        selectedTmdbOptions || undefined
      );
      if (!error) {
        onOpenChange(false);
      }
    } finally {
      setIsLoading(false);
    }
  }

  const descriptionId = "item-dialog-description";
  const dialogHint = parentName
    ? `Create a new item inside "${parentName}".`
    : "Create a new item to organize your content.";

  // Current values for wizard (empty for new items)
  const currentValues: CurrentTextValues = useMemo(
    () => ({
      name: name || "(new item)",
      description: description || null,
    }),
    [name, description]
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
            placeholder="Search movies & TV shows..."
          />
          {isLoadingPreview && (
            <div className="bg-background/80 absolute inset-0 flex items-center justify-center rounded-md">
              <Loader2 className="text-muted-foreground size-4 animate-spin" />
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
          placeholder="Add a short description..."
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

  // Files tab content with categorized FileTypeCombobox components
  const filesContent = (
    <div className="space-y-4">
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

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="max-h-[90vh] max-w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-lg"
          aria-describedby={descriptionId}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            // Focus the combobox input inside MediaSearchCombobox
            const combobox = document.querySelector('[role="combobox"]');
            if (combobox instanceof HTMLElement) {
              combobox.focus();
            }
          }}
        >
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-xl",
                  "bg-primary/10 ring-primary/20 ring-1"
                )}
              >
                <Plus className="text-primary size-5" />
              </div>
              <div>
                <DialogTitle className="text-lg">Create Item</DialogTitle>
                <DialogDescription id={descriptionId} className="text-sm">
                  {dialogHint}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="py-2">
            <ItemDialogTabs
              detailsContent={detailsContent}
              filesContent={filesContent}
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={!name.trim() || isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Episode Picker for TV shows */}
      {pendingTmdbResult && pendingTmdbResult.mediaType === "tv" && (
        <EpisodePicker
          open={showEpisodePicker}
          onOpenChange={setShowEpisodePicker}
          tvId={pendingTmdbResult.id}
          showTitle={pendingTmdbResult.title}
          showYear={pendingTmdbResult.year}
          onSelect={handleEpisodePickerSelect}
          onCancel={handleEpisodePickerCancel}
        />
      )}

      {/* TMDB Metadata Wizard */}
      {tmdbPreview && (
        <MetadataWizardModal
          open={showWizard}
          onOpenChange={setShowWizard}
          currentValues={currentValues}
          textPreview={tmdbPreview}
          images={tmdbImages}
          isLoadingImages={isLoadingImages}
          onComplete={handleWizardComplete}
          onCancel={handleWizardCancel}
        />
      )}
    </>
  );
}
