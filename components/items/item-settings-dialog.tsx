/**
 * Unified item settings dialog with single atomic save.
 * Consolidates name, description, and file selections into one save action.
 * Features FileTypeCombobox for file selection with inline upload capability.
 */

"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import {
  Loader2,
  ImageIcon,
  FileText,
  Film,
  Settings2,
  Sparkles,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { FileTypeCombobox } from "@/components/items/file-type-combobox";
import { MediaSearchCombobox } from "@/components/items/media-search-combobox";
import { updateItemSettings } from "@/lib/item-file-actions";
import { applyMetadataAction } from "@/lib/tmdb-actions";
import type { TMDBSearchResult } from "@/lib/tmdb-client";
import { toast } from "sonner";
import type { SerializedItemFile } from "@/lib/types";
import { cn } from "@/lib/utils";

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
 * Item settings dialog with single atomic save.
 * Always shows file type comboboxes with upload capability.
 * Tracks dirty state and saves all changes in one transaction.
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

  // Original values for dirty checking - captured once when dialog opens
  // Uses open state to reset when dialog reopens, but NOT when files change after upload
  const [originalValues, setOriginalValues] = useState(() => ({
    name: item.name,
    description: item.description ?? "",
    primaryMediaId: findPrimaryFile(files.media)?.id,
    primaryArtworkId: findPrimaryFile(files.artwork)?.id,
    heroArtworkId:
      findHeroFile(files.artwork)?.id ?? findPrimaryFile(files.artwork)?.id,
    primarySubtitleId: findPrimaryFile(files.subtitles)?.id,
  }));

  // Reset original values and upload count when dialog opens
  useEffect(() => {
    if (open) {
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
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Sync name/description when item changes (separate from files to prevent race condition)
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

  // Computed flags
  const hasMultipleArtwork = files.artwork.length > 1;

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
      // Build changes object - only include changed values
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
        // Include upload count in success message if files were uploaded
        if (uploadCount > 0) {
          const fileWord = uploadCount === 1 ? "file" : "files";
          toast.success(`Settings saved. ${uploadCount} ${fileWord} uploaded.`);
        } else {
          toast.success("Settings saved");
        }
        // Refetch is best-effort - save already succeeded, log errors for debugging
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
   * Handles upload completion - accumulates success count and refreshes file list.
   *
   * @param successCount - Number of files successfully uploaded
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
   * Handles file deletion - refreshes file list.
   */
  const handleFileDeleted = useCallback(async () => {
    await onSettingsChange?.().catch((err) => {
      console.warn("[ItemSettingsDialog] Refetch failed after delete:", err);
    });
  }, [onSettingsChange]);

  /**
   * Handles TMDB metadata lookup and application.
   * Updates item name, description, and uploads poster if available.
   */
  const handleApplyMetadata = useCallback(
    async (result: TMDBSearchResult) => {
      setIsApplyingMetadata(true);
      try {
        const response = await applyMetadataAction(
          item.id,
          result.id,
          result.mediaType
        );

        if (response.success) {
          toast.success("Metadata applied successfully");
          // Refresh to get updated name, description, and artwork
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
      }
    },
    [item.id, onSettingsChange]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-xl",
                "bg-primary/10 ring-primary/20 ring-1"
              )}
            >
              <Settings2 className="text-primary size-5" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-lg">Item Settings</DialogTitle>
              <DialogDescription className="text-sm">
                Configure display preferences and upload files
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="min-w-0 space-y-6 py-2">
          {/* Name Section */}
          <div className="space-y-3">
            <Label htmlFor="item-name" className="text-sm font-medium">
              Name
            </Label>
            <Input
              id="item-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-10"
            />
          </div>

          {/* Description Section */}
          <div className="space-y-3">
            <Label htmlFor="item-description" className="text-sm font-medium">
              Description
            </Label>
            <Textarea
              id="item-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short description (optional)"
              maxLength={1000}
              className="min-h-[80px] resize-none"
            />
            <p className="text-muted-foreground text-xs tabular-nums">
              {description.length}/1000 characters
            </p>
          </div>

          {/* Lookup Metadata Section */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Lookup Metadata</Label>
            <p className="text-muted-foreground text-xs">
              Search TMDB to auto-fill name, description, and poster artwork.
            </p>
            <div className="relative">
              <MediaSearchCombobox
                onSelect={handleApplyMetadata}
                placeholder="Search movies & TV shows..."
              />
              {isApplyingMetadata && (
                <div className="bg-background/80 absolute inset-0 flex items-center justify-center rounded-md">
                  <div className="flex items-center gap-2">
                    <Loader2 className="text-muted-foreground size-4 animate-spin" />
                    <span className="text-muted-foreground text-sm">
                      Applying metadata...
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Primary Media */}
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

          {/* Primary Artwork */}
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

          {/* Hero Image (only when 2+ artwork) */}
          {hasMultipleArtwork && (
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
          )}

          {/* Default Subtitle */}
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

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!isDirty || isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
