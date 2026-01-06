/**
 * Unified item settings dialog.
 * Consolidates name editing, primary media, artwork, and subtitle selection.
 * Features progressive disclosure - only shows sections with actionable choices.
 */

"use client";

import { useState, useCallback, useEffect } from "react";
import { Loader2, ImageIcon, FileText, Film, Settings2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
import { setPrimaryFile } from "@/lib/item-file-actions";
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
  /** Callback to rename the item */
  onRename: (newName: string) => Promise<void>;
  /** Callback to update the description */
  onDescriptionChange: (description: string) => Promise<void>;
  /** Optional callback when settings change (for refreshing data). Awaited to ensure sync. */
  onSettingsChange?: () => Promise<void>;
}

/**
 * Formats bytes to human-readable file size.
 */
function formatSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

/**
 * Formats duration in seconds to human-readable time.
 */
function formatDuration(seconds: number | null): string {
  if (!seconds) return "";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
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
 * Item settings dialog with progressive disclosure.
 * Only shows file selection sections when there are 2+ files of a type.
 *
 * @param open - Whether dialog is visible
 * @param onOpenChange - Callback for visibility changes
 * @param item - Item metadata
 * @param files - Files grouped by type
 * @param onRename - Callback to rename item
 * @param onSettingsChange - Optional callback when primary file changes
 */
export function ItemSettingsDialog({
  open,
  onOpenChange,
  item,
  files,
  childCount,
  onRename,
  onDescriptionChange,
  onSettingsChange,
}: ItemSettingsDialogProps) {
  const [name, setName] = useState(item.name);
  const [description, setDescription] = useState(item.description ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingDescription, setIsSavingDescription] = useState(false);
  const [loadingFileId, setLoadingFileId] = useState<string | null>(null);

  // Sync state when item prop changes (prevents stale state on dialog reopen)
  useEffect(() => {
    setName(item.name);
    setDescription(item.description ?? "");
  }, [item.name, item.description]);

  const hasMedia = files.media.length > 0;
  const hasArtwork = files.artwork.length > 0;
  const hasSubtitles = files.subtitles.length > 0;
  const hasMultipleMedia = files.media.length > 1;
  const hasMultipleArtwork = files.artwork.length > 1;
  const hasMultipleSubtitles = files.subtitles.length > 1;
  const hasMediaSettings = hasMedia || hasArtwork || hasSubtitles;

  const handleSaveName = useCallback(async () => {
    if (!name.trim() || name === item.name) return;
    setIsSaving(true);
    try {
      await onRename(name.trim());
      // Note: Toast is shown by parent component (items-view) via handleRenameItem
    } catch {
      toast.error("Failed to update name");
    } finally {
      setIsSaving(false);
    }
  }, [name, item.name, onRename]);

  const handleSaveDescription = useCallback(async () => {
    if (description === (item.description ?? "")) return;
    setIsSavingDescription(true);
    try {
      await onDescriptionChange(description);
      // Refetch is best-effort - save already succeeded, so don't show error if refetch fails
      await onSettingsChange?.().catch(() => {});
    } catch {
      toast.error("Failed to update description");
    } finally {
      setIsSavingDescription(false);
    }
  }, [description, item.description, onDescriptionChange, onSettingsChange]);

  const handleSetPrimary = useCallback(
    async (fileId: string, label: string) => {
      setLoadingFileId(fileId);
      try {
        const result = await setPrimaryFile(fileId);
        if (result.success) {
          toast.success(`Primary ${label} updated`);
          // Refetch is best-effort - save already succeeded
          await onSettingsChange?.().catch(() => {});
        } else {
          toast.error(result.error || "Failed to update");
        }
      } finally {
        setLoadingFileId(null);
      }
    },
    [onSettingsChange]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
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
            <div>
              <DialogTitle className="text-lg">Item Settings</DialogTitle>
              <DialogDescription className="text-sm">
                Configure display preferences
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Name Section */}
          <div className="space-y-3">
            <Label htmlFor="item-name" className="text-sm font-medium">
              Name
            </Label>
            <div className="flex gap-2">
              <Input
                id="item-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSaveName()}
                className="h-10"
              />
              <Button
                onClick={handleSaveName}
                disabled={!name.trim() || name === item.name || isSaving}
                size="default"
                className="shrink-0 px-4"
              >
                {isSaving ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  "Save"
                )}
              </Button>
            </div>
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
            <div className="flex items-center justify-between">
              <p className="text-muted-foreground text-xs tabular-nums">
                {description.length}/200 characters
              </p>
              <Button
                onClick={handleSaveDescription}
                disabled={
                  description === (item.description ?? "") ||
                  isSavingDescription
                }
                size="sm"
              >
                {isSavingDescription ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  "Save"
                )}
              </Button>
            </div>
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
                    value={findPrimaryFile(files.media)?.id}
                    onValueChange={(id) => handleSetPrimary(id, "media")}
                    disabled={!hasMultipleMedia || !!loadingFileId}
                  >
                    <SelectTrigger id="primary-media" className="w-full">
                      {loadingFileId &&
                      files.media.some((f) => f.id === loadingFileId) ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <SelectValue placeholder="Select media file" />
                      )}
                    </SelectTrigger>
                    <SelectContent>
                      {files.media.map((file) => (
                        <SelectItem key={file.id} value={file.id}>
                          <span className="flex items-center gap-2">
                            <span className="truncate">{file.filename}</span>
                            {(file.size || file.playbackDuration) && (
                              <span className="text-muted-foreground text-xs">
                                (
                                {[
                                  formatSize(file.size),
                                  formatDuration(file.playbackDuration),
                                ]
                                  .filter(Boolean)
                                  .join(", ")}
                                )
                              </span>
                            )}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Primary Artwork */}
              {hasArtwork &&
                (() => {
                  const primaryArtwork = findPrimaryFile(files.artwork);
                  return (
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
                        value={primaryArtwork?.id}
                        onValueChange={(id) => handleSetPrimary(id, "artwork")}
                        disabled={!hasMultipleArtwork || !!loadingFileId}
                      >
                        <SelectTrigger id="primary-artwork" className="w-full">
                          {loadingFileId &&
                          files.artwork.some((f) => f.id === loadingFileId) ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <SelectValue placeholder="Select artwork">
                              {primaryArtwork && (
                                <span className="flex items-center gap-2">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={`/api/artwork/${primaryArtwork.id}`}
                                    alt=""
                                    className="size-5 rounded object-cover"
                                    onError={(e) => {
                                      e.currentTarget.style.display = "none";
                                    }}
                                  />
                                  <span className="truncate">
                                    {primaryArtwork.filename}
                                  </span>
                                </span>
                              )}
                            </SelectValue>
                          )}
                        </SelectTrigger>
                        <SelectContent>
                          {files.artwork.map((file) => (
                            <SelectItem key={file.id} value={file.id}>
                              <span className="flex items-center gap-2">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={`/api/artwork/${file.id}`}
                                  alt=""
                                  className="size-6 rounded object-cover"
                                  onError={(e) => {
                                    e.currentTarget.style.display = "none";
                                  }}
                                />
                                <span className="truncate">
                                  {file.filename}
                                </span>
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })()}

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
                    value={findPrimaryFile(files.subtitles)?.id}
                    onValueChange={(id) => handleSetPrimary(id, "subtitle")}
                    disabled={!hasMultipleSubtitles || !!loadingFileId}
                  >
                    <SelectTrigger id="default-subtitle" className="w-full">
                      {loadingFileId &&
                      files.subtitles.some((f) => f.id === loadingFileId) ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <SelectValue placeholder="Select subtitle" />
                      )}
                    </SelectTrigger>
                    <SelectContent>
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
      </DialogContent>
    </Dialog>
  );
}
