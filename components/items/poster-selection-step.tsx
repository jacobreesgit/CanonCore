/**
 * Wizard step for selecting poster artwork from TMDB or uploads.
 * Supports two modes:
 * - Default: Uses ImageSelectionGrid for selecting from TMDB/existing files
 * - Upload mode: Shows dropzone for queueing new files (Add Item dialog)
 */

"use client";

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Upload, CloudOff, SkipForward } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dropzone,
  DropzoneEmptyState,
  DropzoneContent,
} from "@/components/ui/dropzone";
import {
  ImageSelectionGrid,
  type ExistingArtworkFile,
} from "./image-selection-grid";
import { QueuedFileThumbnail } from "./queued-file-thumbnail";
import {
  useArtworkUpload,
  MAX_IMAGE_SIZE_BYTES,
  MAX_UPLOAD_FILES,
} from "@/hooks/use-artwork-upload";
import { formatBytes } from "@/lib/upload-utils";
import { cn } from "@/lib/utils";
import type { TMDBImage } from "@/lib/tmdb-client";
import type { QueuedFile, ArtworkSelectionSource } from "@/lib/types";

interface PosterSelectionStepProps {
  /** TMDB poster images sorted by vote average */
  posters: TMDBImage[];
  /** Existing uploaded artwork files (for non-upload mode) */
  existingFiles?: ExistingArtworkFile[];
  /** Currently selected poster path or file ID */
  selectedValue: string | null;
  /** Selection source */
  selectedSource: ArtworkSelectionSource | null;
  /** Callback when selection changes */
  onSelect: (value: string | null, source: ArtworkSelectionSource) => void;
  /** Whether poster selection is skipped */
  isSkipped: boolean;
  /** Callback when skip state changes */
  onSkipChange: (skipped: boolean) => void;
  /** Whether step is disabled */
  disabled?: boolean;
  /** Enable upload mode for new items (no existing files) */
  uploadMode?: boolean;
  /** Queued artwork files (required when uploadMode=true) */
  queuedArtwork?: QueuedFile[];
  /** Callback when queued artwork changes */
  onQueueArtworkChange?: (files: QueuedFile[]) => void;
  /** Whether Drive connection exists */
  hasDriveConnection?: boolean;
}

/**
 * Poster selection step for the metadata wizard.
 * Displays poster images in a 2:3 aspect ratio grid.
 *
 * @param posters - TMDB poster images
 * @param existingFiles - User's uploaded artwork
 * @param selectedValue - Currently selected poster
 * @param selectedSource - Where the selection came from
 * @param onSelect - Selection change callback
 * @param isSkipped - Whether step is skipped
 * @param onSkipChange - Skip state callback
 * @param disabled - Whether step is disabled
 * @param uploadMode - Enable upload mode for new items
 * @param queuedArtwork - Queued files when in upload mode
 * @param onQueueArtworkChange - Callback for queued files changes
 * @param hasDriveConnection - Whether Drive is connected
 */
export function PosterSelectionStep({
  posters,
  existingFiles = [],
  selectedValue,
  selectedSource,
  onSelect,
  isSkipped,
  onSkipChange,
  disabled = false,
  uploadMode = false,
  queuedArtwork = [],
  onQueueArtworkChange,
  hasDriveConnection = false,
}: PosterSelectionStepProps) {
  const [activeTab, setActiveTab] = useState<"tmdb" | "uploads">("tmdb");

  const { handleFileDrop, handleRemoveFile, handleQueuedSelect, totalSize } =
    useArtworkUpload({
      queuedFiles: queuedArtwork,
      onQueueChange: onQueueArtworkChange,
      selectedValue,
      onSelect,
      isSkipped,
      disabled,
    });

  // Auto-select first queued file when on uploads tab with no selection.
  // Only triggers when:
  // 1. In upload mode with queued files
  // 2. Not currently using a queued selection (preserves TMDB selections)
  // 3. On the uploads tab with no value selected
  // This preserves existing selections when switching tabs.
  useEffect(() => {
    if (
      uploadMode &&
      queuedArtwork.length > 0 &&
      selectedSource !== "queued" &&
      !isSkipped
    ) {
      if (activeTab === "uploads" && selectedValue === null) {
        onSelect(queuedArtwork[0].id, "queued");
      }
    }
  }, [
    uploadMode,
    queuedArtwork,
    selectedSource,
    selectedValue,
    activeTab,
    isSkipped,
    onSelect,
  ]);

  /**
   * Handles selection from ImageSelectionGrid (TMDB or existing).
   */
  const handleGridSelect = useCallback(
    (value: string | null, source: "tmdb" | "existing") => {
      onSelect(value, source);
    },
    [onSelect]
  );

  // For upload mode, render tabs with TMDB and My Uploads (dropzone)
  if (uploadMode) {
    return (
      <div className="space-y-4">
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as "tmdb" | "uploads")}
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="tmdb" disabled={disabled}>
              From TMDB
              {posters.length > 0 && (
                <span className="bg-muted ml-1.5 rounded px-1.5 py-0.5 text-xs tabular-nums">
                  {posters.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="uploads" disabled={disabled}>
              My Uploads
              {queuedArtwork.length > 0 && (
                <span className="bg-muted ml-1.5 rounded px-1.5 py-0.5 text-xs tabular-nums">
                  {queuedArtwork.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* TMDB Images Tab */}
          <TabsContent value="tmdb" className="mt-4">
            <ImageSelectionGrid
              type="poster"
              tmdbImages={posters}
              existingFiles={[]}
              selectedValue={selectedSource === "tmdb" ? selectedValue : null}
              onSelect={handleGridSelect}
              isSkipped={isSkipped}
              disabled={disabled}
              initialLimit={8}
              showTabs={false}
            />
          </TabsContent>

          {/* My Uploads Tab (Dropzone + Thumbnails) */}
          <TabsContent value="uploads" className="mt-4">
            {!hasDriveConnection ? (
              <div className="bg-muted/30 flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-12">
                <CloudOff className="text-muted-foreground/50 size-8" />
                <p className="text-muted-foreground text-sm">
                  Connect Google Drive in Settings to enable uploads
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Dropzone */}
                <Dropzone
                  onDrop={handleFileDrop}
                  maxFiles={MAX_UPLOAD_FILES}
                  maxSize={MAX_IMAGE_SIZE_BYTES}
                  accept={{ "image/*": [] }}
                  disabled={disabled || isSkipped}
                  className="min-h-[100px]"
                >
                  <DropzoneEmptyState>
                    <div className="flex flex-col items-center justify-center gap-1.5 px-4 py-3 text-center">
                      <Upload className="text-muted-foreground size-6" />
                      <p className="text-muted-foreground text-sm">
                        {queuedArtwork.length === 0
                          ? "No files uploaded yet. Drop poster images or click to browse."
                          : "Drop poster images or click to browse"}
                      </p>
                    </div>
                  </DropzoneEmptyState>
                  <DropzoneContent>
                    <div className="flex flex-col items-center justify-center gap-1.5 px-4 py-3 text-center">
                      <Upload className="text-primary size-6" />
                      <p className="text-sm font-medium">Drop to add</p>
                    </div>
                  </DropzoneContent>
                </Dropzone>

                {/* Queued Files Thumbnails */}
                <AnimatePresence mode="popLayout">
                  {queuedArtwork.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground text-xs">
                          {queuedArtwork.length} file
                          {queuedArtwork.length !== 1 && "s"} queued (click to
                          select)
                        </span>
                        <span className="text-muted-foreground text-xs">
                          {formatBytes(totalSize)}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                        {queuedArtwork.map((qf, index) => (
                          <QueuedFileThumbnail
                            key={qf.id}
                            file={qf}
                            index={index}
                            isSelected={selectedValue === qf.id}
                            isSkipped={isSkipped}
                            disabled={disabled}
                            onClick={() => handleQueuedSelect(qf.id)}
                            onRemove={() => handleRemoveFile(qf.id)}
                            aspectRatio="poster"
                          />
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Skip checkbox */}
        <div className="flex items-center gap-2 pt-2">
          <Checkbox
            id="skip-poster-selection"
            checked={isSkipped}
            onCheckedChange={(checked) => onSkipChange(checked === true)}
            disabled={disabled}
          />
          <Label
            htmlFor="skip-poster-selection"
            className={cn(
              "flex cursor-pointer items-center gap-1.5 text-sm",
              disabled && "cursor-not-allowed opacity-50"
            )}
          >
            <SkipForward className="size-3.5" />
            Skip poster selection
          </Label>
        </div>
      </div>
    );
  }

  // Default mode: Use ImageSelectionGrid
  return (
    <div className="space-y-4">
      <ImageSelectionGrid
        type="poster"
        tmdbImages={posters}
        existingFiles={existingFiles}
        selectedValue={selectedValue}
        onSelect={handleGridSelect}
        isSkipped={isSkipped}
        onSkipChange={onSkipChange}
        disabled={disabled}
        initialLimit={8}
      />
    </div>
  );
}
