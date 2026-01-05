/**
 * Unified item settings dialog.
 * Consolidates name editing, primary media, artwork, and subtitle selection.
 * Features progressive disclosure - only shows sections with actionable choices.
 */

"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Check,
  Loader2,
  ImageIcon,
  FileText,
  Film,
  HardDrive,
  Clock,
  Settings2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { setPrimaryFile } from "@/lib/item-file-actions";
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

  const hasMultipleMedia = files.media.length > 1;
  const hasMultipleArtwork = files.artwork.length > 1;
  const hasMultipleSubtitles = files.subtitles.length > 1;
  const hasMediaSettings =
    hasMultipleMedia || hasMultipleArtwork || hasMultipleSubtitles;

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
            <div className="flex gap-2">
              <Input
                id="item-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSaveDescription()}
                placeholder="Short description (optional)"
                maxLength={200}
                className="h-10"
              />
              <Button
                onClick={handleSaveDescription}
                disabled={
                  description === (item.description ?? "") ||
                  isSavingDescription
                }
                size="default"
                className="shrink-0 px-4"
              >
                {isSavingDescription ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  "Save"
                )}
              </Button>
            </div>
            <p className="text-muted-foreground text-xs">
              {description.length}/200 characters
            </p>
          </div>

          {/* File Summary */}
          <div
            className={cn(
              "flex items-center gap-4 rounded-lg px-4 py-3",
              "bg-muted/50 text-muted-foreground text-sm"
            )}
          >
            <span className="flex items-center gap-1.5">
              <Film className="size-4" />
              {files.media.length}
            </span>
            <span className="flex items-center gap-1.5">
              <ImageIcon className="size-4" />
              {files.artwork.length}
            </span>
            <span className="flex items-center gap-1.5">
              <FileText className="size-4" />
              {files.subtitles.length}
            </span>
          </div>

          {/* Media Settings (conditional) */}
          {hasMediaSettings && (
            <>
              <Separator />

              {/* Primary Media */}
              {hasMultipleMedia && (
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
                    <span className="text-sm font-medium">Primary Media</span>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    Select which file plays when clicking on this item.
                  </p>
                  <div
                    className="space-y-1.5"
                    data-testid="primary-media"
                    role="radiogroup"
                    aria-label="Select primary media"
                  >
                    {files.media.map((file) => (
                      <button
                        key={file.id}
                        onClick={() => handleSetPrimary(file.id, "media")}
                        disabled={loadingFileId === file.id}
                        role="radio"
                        aria-checked={file.isPrimary}
                        aria-label={`Select ${file.filename} as primary media`}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg px-3 py-2.5",
                          "text-left text-sm transition-all",
                          file.isPrimary
                            ? "bg-primary/10 ring-primary/30 ring-1"
                            : "bg-muted/30 hover:bg-muted/60"
                        )}
                      >
                        <div
                          className={cn(
                            "flex size-5 shrink-0 items-center justify-center rounded-full",
                            file.isPrimary
                              ? "bg-primary text-primary-foreground"
                              : "ring-border ring-1"
                          )}
                        >
                          {loadingFileId === file.id ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : file.isPrimary ? (
                            <Check className="size-3" />
                          ) : null}
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="block truncate font-medium">
                            {file.filename}
                          </span>
                          <span className="text-muted-foreground flex items-center gap-3 text-xs">
                            {file.size && (
                              <span className="flex items-center gap-1">
                                <HardDrive className="size-3" />
                                {formatSize(file.size)}
                              </span>
                            )}
                            {file.playbackDuration && (
                              <span className="flex items-center gap-1">
                                <Clock className="size-3" />
                                {formatDuration(file.playbackDuration)}
                              </span>
                            )}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Primary Artwork */}
              {hasMultipleArtwork && (
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
                    <span className="text-sm font-medium">Primary Artwork</span>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    Select which image to use as the thumbnail.
                  </p>
                  <div
                    className="grid grid-cols-4 gap-2"
                    role="radiogroup"
                    aria-label="Select primary artwork"
                  >
                    {files.artwork.map((file) => (
                      <button
                        key={file.id}
                        onClick={() => handleSetPrimary(file.id, "artwork")}
                        disabled={loadingFileId === file.id}
                        role="radio"
                        aria-checked={file.isPrimary}
                        aria-label={`Select ${file.filename} as primary artwork`}
                        className={cn(
                          "relative aspect-square overflow-hidden rounded-lg",
                          "ring-2 transition-all",
                          file.isPrimary
                            ? "ring-primary shadow-lg"
                            : "ring-border/50 hover:ring-primary/50"
                        )}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`/api/stream/${file.id}`}
                          alt={file.filename}
                          className="h-full w-full object-cover"
                        />
                        {file.isPrimary && (
                          <div
                            className={cn(
                              "absolute top-1 right-1 rounded-full p-1",
                              "bg-primary text-primary-foreground shadow-md"
                            )}
                          >
                            <Check className="size-2.5" />
                          </div>
                        )}
                        {loadingFileId === file.id && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                            <Loader2 className="size-5 animate-spin text-white" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Default Subtitle */}
              {hasMultipleSubtitles && (
                <div className="space-y-3" data-testid="default-subtitle">
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        "flex size-7 items-center justify-center rounded-lg",
                        "bg-primary/10"
                      )}
                    >
                      <FileText className="text-primary size-3.5" />
                    </div>
                    <span className="text-sm font-medium">
                      Default Subtitle
                    </span>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    Select which subtitle track loads by default.
                  </p>
                  <div
                    className="space-y-1.5"
                    role="radiogroup"
                    aria-label="Select default subtitle"
                  >
                    {files.subtitles.map((file) => (
                      <button
                        key={file.id}
                        onClick={() => handleSetPrimary(file.id, "subtitle")}
                        disabled={loadingFileId === file.id}
                        role="radio"
                        aria-checked={file.isPrimary}
                        aria-label={`Select ${file.filename} as default subtitle`}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg px-3 py-2.5",
                          "text-left text-sm transition-all",
                          file.isPrimary
                            ? "bg-primary/10 ring-primary/30 ring-1"
                            : "bg-muted/30 hover:bg-muted/60"
                        )}
                      >
                        <div
                          className={cn(
                            "flex size-5 shrink-0 items-center justify-center rounded-full",
                            file.isPrimary
                              ? "bg-primary text-primary-foreground"
                              : "ring-border ring-1"
                          )}
                        >
                          {loadingFileId === file.id ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : file.isPrimary ? (
                            <Check className="size-3" />
                          ) : null}
                        </div>
                        <span className="truncate font-medium">
                          {file.filename}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
