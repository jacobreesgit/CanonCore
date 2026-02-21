/**
 * Shared wizard step for selecting artwork (poster or hero/backdrop) from TMDB or uploads.
 * Supports two modes:
 * - Default: Uses ImageSelectionGrid for selecting from TMDB/existing files
 * - Upload mode: Shows dropzone for queueing new files (Add Item dialog)
 *
 * Used by PosterSelectionStep and HeroSelectionStep to avoid code duplication.
 */

"use client";

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faUpload,
  faCloudArrowDown,
  faForwardStep,
} from "@fortawesome/free-solid-svg-icons";
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
import { QueuedFileThumbnail } from "@/components/items/queued-file-thumbnail";
import {
  useArtworkUpload,
  MAX_IMAGE_SIZE_BYTES,
  MAX_UPLOAD_FILES,
} from "@/hooks/use-artwork-upload";
import { formatBytes } from "@/lib/upload-utils";
import { cn } from "@/lib/utils";
import type { TMDBImage } from "@/lib/tmdb-client";
import type { QueuedFile, ArtworkSelectionSource } from "@/lib/types";

/** Artwork type determines aspect ratio and grid configuration */
export type ArtworkType = "poster" | "backdrop";

interface ArtworkSelectionStepProps {
  /** Type of artwork being selected */
  type: ArtworkType;
  /** TMDB images sorted by vote average */
  images: TMDBImage[];
  /** Existing uploaded artwork files (for non-upload mode) */
  existingFiles?: ExistingArtworkFile[];
  /** Currently selected image path or file ID */
  selectedValue: string | null;
  /** Selection source */
  selectedSource: ArtworkSelectionSource | null;
  /** Callback when selection changes */
  onSelect: (value: string | null, source: ArtworkSelectionSource) => void;
  /** Whether selection is skipped */
  isSkipped: boolean;
  /** Callback when skip state changes */
  onSkipChange: (skipped: boolean) => void;
  /** Whether step is disabled */
  disabled?: boolean;
  /** Enable upload mode for new items (no existing files) */
  uploadMode?: boolean;
  /** Queued files (required when uploadMode=true) */
  queuedFiles?: QueuedFile[];
  /** Callback when queued files change */
  onQueueFilesChange?: (files: QueuedFile[]) => void;
  /** Whether Drive connection exists */
  hasDriveConnection?: boolean;
}

/**
 * Configuration derived from artwork type.
 */
function getTypeConfig(type: ArtworkType) {
  return {
    label: type === "poster" ? "poster" : "hero",
    skipLabel:
      type === "poster" ? "Skip poster selection" : "Skip hero selection",
    skipId: type === "poster" ? "skip-poster-selection" : "skip-hero-selection",
    gridCols:
      type === "poster"
        ? "grid-cols-3 sm:grid-cols-4"
        : "grid-cols-2 sm:grid-cols-3",
    aspectRatio: type as "poster" | "backdrop",
    emptyText:
      type === "poster"
        ? "No files uploaded yet. Drop poster images or click to browse."
        : "No files uploaded yet. Drop hero images or click to browse.",
    dropText:
      type === "poster"
        ? "Drop poster images or click to browse"
        : "Drop hero images or click to browse",
  };
}

/**
 * Artwork selection step for the metadata wizard.
 * Shared component used by PosterSelectionStep and HeroSelectionStep.
 *
 * @param type - "poster" for 2:3 aspect ratio, "backdrop" for 16:9
 * @param images - TMDB images
 * @param existingFiles - User's uploaded artwork
 * @param selectedValue - Currently selected image
 * @param selectedSource - Where the selection came from
 * @param onSelect - Selection change callback
 * @param isSkipped - Whether step is skipped
 * @param onSkipChange - Skip state callback
 * @param disabled - Whether step is disabled
 * @param uploadMode - Enable upload mode for new items
 * @param queuedFiles - Queued files when in upload mode
 * @param onQueueFilesChange - Callback for queued files changes
 * @param hasDriveConnection - Whether Drive is connected
 */
export function ArtworkSelectionStep({
  type,
  images,
  existingFiles = [],
  selectedValue,
  selectedSource,
  onSelect,
  isSkipped,
  onSkipChange,
  disabled = false,
  uploadMode = false,
  queuedFiles = [],
  onQueueFilesChange,
  hasDriveConnection = false,
}: ArtworkSelectionStepProps) {
  const config = getTypeConfig(type);

  const [activeTab, setActiveTab] = useState<"tmdb" | "uploads">("tmdb");

  const { handleFileDrop, handleRemoveFile, handleQueuedSelect, totalSize } =
    useArtworkUpload({
      queuedFiles,
      onQueueChange: onQueueFilesChange,
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
      queuedFiles.length > 0 &&
      selectedSource !== "queued" &&
      !isSkipped
    ) {
      if (activeTab === "uploads" && selectedValue === null) {
        onSelect(queuedFiles[0].id, "queued");
      }
    }
  }, [
    uploadMode,
    queuedFiles,
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
              {images.length > 0 && (
                <span className="bg-muted ml-1.5 rounded px-1.5 py-0.5 text-xs tabular-nums">
                  {images.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="uploads" disabled={disabled}>
              My Uploads
              {queuedFiles.length > 0 && (
                <span className="bg-muted ml-1.5 rounded px-1.5 py-0.5 text-xs tabular-nums">
                  {queuedFiles.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* TMDB Images Tab */}
          <TabsContent value="tmdb" className="mt-4">
            <ImageSelectionGrid
              type={config.aspectRatio}
              tmdbImages={images}
              existingFiles={[]}
              selectedValue={selectedSource === "tmdb" ? selectedValue : null}
              onSelect={handleGridSelect}
              isSkipped={isSkipped}
              disabled={disabled}
              showTabs={false}
            />
          </TabsContent>

          {/* My Uploads Tab (Dropzone + Thumbnails) */}
          <TabsContent value="uploads" className="mt-4">
            {!hasDriveConnection ? (
              <div className="bg-muted/30 flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-12">
                <FontAwesomeIcon
                  icon={faCloudArrowDown}
                  className="text-muted-foreground/50 size-8"
                />
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
                      <FontAwesomeIcon
                        icon={faUpload}
                        className="text-muted-foreground size-6"
                      />
                      <p className="text-muted-foreground text-sm">
                        {queuedFiles.length === 0
                          ? config.emptyText
                          : config.dropText}
                      </p>
                    </div>
                  </DropzoneEmptyState>
                  <DropzoneContent>
                    <div className="flex flex-col items-center justify-center gap-1.5 px-4 py-3 text-center">
                      <FontAwesomeIcon
                        icon={faUpload}
                        className="text-primary size-6"
                      />
                      <p className="text-sm font-medium">Drop to add</p>
                    </div>
                  </DropzoneContent>
                </Dropzone>

                {/* Queued Files Thumbnails */}
                <AnimatePresence mode="popLayout">
                  {queuedFiles.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground text-xs">
                          {queuedFiles.length} file
                          {queuedFiles.length !== 1 && "s"} queued (click to
                          select)
                        </span>
                        <span className="text-muted-foreground text-xs">
                          {formatBytes(totalSize)}
                        </span>
                      </div>

                      <div className={cn("grid gap-2", config.gridCols)}>
                        {queuedFiles.map((qf, index) => (
                          <QueuedFileThumbnail
                            key={qf.id}
                            file={qf}
                            index={index}
                            isSelected={selectedValue === qf.id}
                            isSkipped={isSkipped}
                            disabled={disabled}
                            onClick={() => handleQueuedSelect(qf.id)}
                            onRemove={() => handleRemoveFile(qf.id)}
                            aspectRatio={config.aspectRatio}
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
            id={config.skipId}
            checked={isSkipped}
            onCheckedChange={(checked) => onSkipChange(checked === true)}
            disabled={disabled}
          />
          <Label
            htmlFor={config.skipId}
            className={cn(
              "flex cursor-pointer items-center gap-1.5 text-sm",
              disabled && "cursor-not-allowed opacity-50"
            )}
          >
            <FontAwesomeIcon icon={faForwardStep} className="size-3.5" />
            {config.skipLabel}
          </Label>
        </div>
      </div>
    );
  }

  // Default mode: Use ImageSelectionGrid
  return (
    <div className="space-y-4">
      <ImageSelectionGrid
        type={config.aspectRatio}
        tmdbImages={images}
        existingFiles={existingFiles}
        selectedValue={selectedValue}
        onSelect={handleGridSelect}
        isSkipped={isSkipped}
        onSkipChange={onSkipChange}
        disabled={disabled}
      />
    </div>
  );
}
