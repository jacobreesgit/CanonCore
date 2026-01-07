/**
 * Unified item settings dialog with single atomic save.
 * Consolidates name, description, and file selections into one save action.
 * Features progressive disclosure and dirty state tracking.
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { updateItemSettings } from "@/lib/item-file-actions";
import { toast } from "sonner";
import type { SerializedItemFile } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ItemStats } from "@/components/items/item-stats";

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
  /** Number of child items for stats display */
  childCount?: number;
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
 * Only shows file selection sections when there are 2+ files of a type.
 * Tracks dirty state and saves all changes in one transaction.
 *
 * @param open - Whether dialog is visible
 * @param onOpenChange - Callback for visibility changes
 * @param item - Item metadata
 * @param files - Files grouped by type
 * @param childCount - Number of child items
 * @param onSettingsChange - Optional callback when settings are saved
 */
export function ItemSettingsDialog({
  open,
  onOpenChange,
  item,
  files,
  childCount,
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

  // Original values for dirty checking
  const originalValues = useMemo(
    () => ({
      name: item.name,
      description: item.description ?? "",
      primaryMediaId: findPrimaryFile(files.media)?.id,
      primaryArtworkId: findPrimaryFile(files.artwork)?.id,
      heroArtworkId:
        findHeroFile(files.artwork)?.id ?? findPrimaryFile(files.artwork)?.id,
      primarySubtitleId: findPrimaryFile(files.subtitles)?.id,
    }),
    [item.name, item.description, files]
  );

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
  const hasMedia = files.media.length > 0;
  const hasArtwork = files.artwork.length > 0;
  const hasSubtitles = files.subtitles.length > 0;
  const hasMultipleMedia = files.media.length > 1;
  const hasMultipleArtwork = files.artwork.length > 1;
  const hasMultipleSubtitles = files.subtitles.length > 1;
  const hasMediaSettings = hasMedia || hasArtwork || hasSubtitles;

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
        toast.success("Settings saved");
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
    item.id,
    onSettingsChange,
    onOpenChange,
  ]);

  // Get current artwork for preview
  const currentPrimaryArtwork = files.artwork.find(
    (f) => f.id === primaryArtworkId
  );
  const currentHeroArtwork = files.artwork.find((f) => f.id === heroArtworkId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg">
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
                Configure display preferences
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
              maxLength={200}
              className="min-h-[80px] resize-none"
            />
            <p className="text-muted-foreground text-xs tabular-nums">
              {description.length}/200 characters
            </p>
          </div>

          {/* File Summary */}
          <div className={cn("rounded-lg px-4 py-3", "bg-muted/50")}>
            <ItemStats
              childCount={childCount}
              fileCounts={{
                media: files.media.length,
                artwork: files.artwork.length,
                subtitles: files.subtitles.length,
              }}
              variant="muted"
            />
          </div>

          {/* Media Settings (conditional) */}
          {hasMediaSettings && (
            <>
              <Separator />

              {/* Primary Media */}
              {hasMedia && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        "flex size-7 items-center justify-center rounded-lg",
                        "bg-primary/10"
                      )}
                    >
                      <Film className="text-primary size-3.5" />
                    </div>
                    <Label
                      htmlFor="primary-media"
                      className="text-sm font-medium"
                    >
                      Primary Media
                    </Label>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {hasMultipleMedia
                      ? "Select which file plays when clicking on this item."
                      : "The file that plays when clicking on this item."}
                  </p>
                  <Select
                    value={primaryMediaId}
                    onValueChange={setPrimaryMediaId}
                    disabled={!hasMultipleMedia}
                  >
                    <SelectTrigger id="primary-media" className="w-full">
                      <SelectValue placeholder="Select media file" />
                    </SelectTrigger>
                    <SelectContent className="w-[var(--radix-select-trigger-width)]">
                      {files.media.map((file) => (
                        <SelectItem key={file.id} value={file.id}>
                          {file.filename}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Primary Artwork */}
              {hasArtwork && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        "flex size-7 items-center justify-center rounded-lg",
                        "bg-primary/10"
                      )}
                    >
                      <ImageIcon className="text-primary size-3.5" />
                    </div>
                    <Label
                      htmlFor="primary-artwork"
                      className="text-sm font-medium"
                    >
                      Primary Artwork
                    </Label>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {hasMultipleArtwork
                      ? "Select which image to use as the thumbnail."
                      : "The image used as the thumbnail."}
                  </p>
                  <Select
                    value={primaryArtworkId}
                    onValueChange={setPrimaryArtworkId}
                    disabled={!hasMultipleArtwork}
                  >
                    <SelectTrigger id="primary-artwork" className="w-full">
                      <SelectValue placeholder="Select artwork">
                        {currentPrimaryArtwork && (
                          <span className="flex min-w-0 items-center gap-2">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={`/api/artwork/${currentPrimaryArtwork.id}`}
                              alt=""
                              className="size-5 shrink-0 rounded object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                              }}
                            />
                            <span className="truncate">
                              {currentPrimaryArtwork.filename}
                            </span>
                          </span>
                        )}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="w-[var(--radix-select-trigger-width)]">
                      {files.artwork.map((file) => (
                        <SelectItem key={file.id} value={file.id}>
                          <span className="flex min-w-0 items-center gap-2">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={`/api/artwork/${file.id}`}
                              alt=""
                              className="size-5 shrink-0 rounded object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                              }}
                            />
                            <span className="truncate">{file.filename}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Hero Image (only when 2+ artwork) */}
              {hasMultipleArtwork && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        "flex size-7 items-center justify-center rounded-lg",
                        "bg-primary/10"
                      )}
                    >
                      <Sparkles className="text-primary size-3.5" />
                    </div>
                    <Label
                      htmlFor="hero-artwork"
                      className="text-sm font-medium"
                    >
                      Hero Image
                    </Label>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    Select which image to use as the banner background.
                  </p>
                  <Select
                    value={heroArtworkId}
                    onValueChange={setHeroArtworkId}
                  >
                    <SelectTrigger id="hero-artwork" className="w-full">
                      <SelectValue placeholder="Select hero image">
                        {currentHeroArtwork && (
                          <span className="flex min-w-0 items-center gap-2">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={`/api/artwork/${currentHeroArtwork.id}`}
                              alt=""
                              className="size-5 shrink-0 rounded object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                              }}
                            />
                            <span className="truncate">
                              {currentHeroArtwork.filename}
                            </span>
                          </span>
                        )}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="w-[var(--radix-select-trigger-width)]">
                      {files.artwork.map((file) => (
                        <SelectItem key={file.id} value={file.id}>
                          <span className="flex min-w-0 items-center gap-2">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={`/api/artwork/${file.id}`}
                              alt=""
                              className="size-5 shrink-0 rounded object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                              }}
                            />
                            <span className="truncate">{file.filename}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Default Subtitle */}
              {hasSubtitles && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        "flex size-7 items-center justify-center rounded-lg",
                        "bg-primary/10"
                      )}
                    >
                      <FileText className="text-primary size-3.5" />
                    </div>
                    <Label
                      htmlFor="default-subtitle"
                      className="text-sm font-medium"
                    >
                      Default Subtitle
                    </Label>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {hasMultipleSubtitles
                      ? "Select which subtitle track loads by default."
                      : "The subtitle track that loads by default."}
                  </p>
                  <Select
                    value={primarySubtitleId}
                    onValueChange={setPrimarySubtitleId}
                    disabled={!hasMultipleSubtitles}
                  >
                    <SelectTrigger id="default-subtitle" className="w-full">
                      <SelectValue placeholder="Select subtitle" />
                    </SelectTrigger>
                    <SelectContent className="w-[var(--radix-select-trigger-width)]">
                      {files.subtitles.map((file) => (
                        <SelectItem key={file.id} value={file.id}>
                          {file.filename}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
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
