/**
 * FilesSection - Collapsible section for queueing media and subtitle files.
 * Used in the Add Item summary view for optional file uploads.
 * Excludes artwork uploads (handled separately by wizard).
 */

"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ChevronDown,
  Film,
  FileText,
  File,
  Plus,
  X,
  CloudOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dropzone,
  DropzoneEmptyState,
  DropzoneContent,
} from "@/components/ui/dropzone";
import { cn } from "@/lib/utils";
import { formatBytes } from "@/lib/upload-utils";
import type { QueuedFile, QueuedFilesByCategory } from "@/lib/types";
import type { FileType } from "@prisma/client";

/**
 * File category configuration.
 */
interface FileCategoryConfig {
  key: keyof Pick<QueuedFilesByCategory, "media" | "subtitle">;
  label: string;
  description: string;
  icon: typeof Film;
  accept: Record<string, string[]>;
}

/**
 * File categories available for upload (excludes artwork).
 */
const FILE_CATEGORIES: FileCategoryConfig[] = [
  {
    key: "media",
    label: "Media Files",
    description: "Video or audio files",
    icon: Film,
    accept: { "video/*": [], "audio/*": [] },
  },
  {
    key: "subtitle",
    label: "Subtitles",
    description: "SRT, VTT, ASS subtitle files",
    icon: FileText,
    accept: { "text/plain": [".srt", ".vtt", ".sub", ".ass"] },
  },
];

/**
 * Maximum file size (500MB).
 */
const MAX_FILE_SIZE = 500 * 1024 * 1024;

/**
 * Maximum files per category.
 */
const MAX_FILES_PER_CATEGORY = 10;

/**
 * Props for the FilesSection component.
 */
export interface FilesSectionProps {
  /** Queued files by category */
  queuedFiles: Pick<QueuedFilesByCategory, "media" | "subtitle">;
  /** Callback when media files change */
  onMediaChange: (files: QueuedFile[]) => void;
  /** Callback when subtitle files change */
  onSubtitleChange: (files: QueuedFile[]) => void;
  /** Whether user has Drive connection */
  hasDriveConnection: boolean;
  /** Whether the section is disabled */
  disabled?: boolean;
}

/**
 * Collapsible section for queueing media and subtitle files.
 * Displays collapsed summary when no files, expands to show dropzones.
 *
 * @param queuedFiles - Current queued files by category
 * @param onMediaChange - Handler for media file changes
 * @param onSubtitleChange - Handler for subtitle file changes
 * @param hasDriveConnection - Whether Drive is connected
 * @param disabled - Disable all interactions
 */
export function FilesSection({
  queuedFiles,
  onMediaChange,
  onSubtitleChange,
  hasDriveConnection,
  disabled = false,
}: FilesSectionProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Calculate total file count and size
  const { totalCount, totalSize } = useMemo(() => {
    const allFiles = [...queuedFiles.media, ...queuedFiles.subtitle];
    return {
      totalCount: allFiles.length,
      totalSize: allFiles.reduce((sum, f) => sum + f.file.size, 0),
    };
  }, [queuedFiles]);

  /**
   * Maps category to FileType.
   */
  const categoryToFileType = (category: "media" | "subtitle"): FileType => {
    return category === "media" ? "MEDIA" : "SUBTITLE";
  };

  /**
   * Handles file drop for a category.
   */
  const handleDrop = (
    category: "media" | "subtitle",
    acceptedFiles: File[]
  ) => {
    const currentFiles =
      category === "media" ? queuedFiles.media : queuedFiles.subtitle;
    const onChange = category === "media" ? onMediaChange : onSubtitleChange;
    const fileType = categoryToFileType(category);

    const newFiles: QueuedFile[] = acceptedFiles.map((file) => ({
      id: crypto.randomUUID(),
      file,
      fileType,
      size: file.size,
      status: "pending" as const,
      isPrimary: currentFiles.length === 0,
      isHero: false,
    }));

    onChange([...currentFiles, ...newFiles].slice(0, MAX_FILES_PER_CATEGORY));
  };

  /**
   * Removes a file from a category.
   */
  const handleRemove = (category: "media" | "subtitle", fileId: string) => {
    const currentFiles =
      category === "media" ? queuedFiles.media : queuedFiles.subtitle;
    const onChange = category === "media" ? onMediaChange : onSubtitleChange;

    const updated = currentFiles.filter((f) => f.id !== fileId);
    // Ensure first file is marked as primary
    if (updated.length > 0 && !updated.some((f) => f.isPrimary)) {
      updated[0].isPrimary = true;
    }
    onChange(updated);
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, delay: 0.1 }}
        className={cn(
          "rounded-xl border transition-colors",
          isOpen
            ? "border-border bg-card"
            : "border-muted-foreground/30 bg-muted/20 border-dashed"
        )}
      >
        {/* Header / Trigger */}
        <CollapsibleTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className={cn(
              "flex w-full items-center justify-between px-4 py-3 text-left transition-colors",
              "hover:bg-accent/50 focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset",
              "rounded-xl",
              disabled && "cursor-not-allowed opacity-50"
            )}
          >
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "flex size-9 items-center justify-center rounded-lg transition-colors",
                  isOpen
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground"
                )}
              >
                <File className="size-4" />
              </div>
              <div>
                <span className="text-sm font-medium">Files</span>
                <p className="text-muted-foreground text-xs">
                  {totalCount === 0
                    ? "No files queued"
                    : `${totalCount} file${totalCount !== 1 ? "s" : ""} queued (${formatBytes(totalSize)})`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {!isOpen && totalCount === 0 && (
                <span className="text-muted-foreground text-xs">Optional</span>
              )}
              <ChevronDown
                className={cn(
                  "text-muted-foreground size-4 transition-transform duration-200",
                  isOpen && "rotate-180"
                )}
              />
            </div>
          </button>
        </CollapsibleTrigger>

        {/* Collapsible Content */}
        <CollapsibleContent>
          <AnimatePresence>
            {isOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="space-y-4 border-t px-4 py-4">
                  {!hasDriveConnection ? (
                    <div className="bg-muted/30 flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-8">
                      <CloudOff className="text-muted-foreground/50 size-8" />
                      <p className="text-muted-foreground text-sm">
                        Connect Google Drive in Settings to upload files
                      </p>
                    </div>
                  ) : (
                    FILE_CATEGORIES.map((category) => (
                      <FileCategoryDropzone
                        key={category.key}
                        config={category}
                        files={queuedFiles[category.key]}
                        onDrop={(files) => handleDrop(category.key, files)}
                        onRemove={(id) => handleRemove(category.key, id)}
                        disabled={disabled}
                      />
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CollapsibleContent>
      </motion.div>
    </Collapsible>
  );
}

/**
 * Props for FileCategoryDropzone.
 */
interface FileCategoryDropzoneProps {
  config: FileCategoryConfig;
  files: QueuedFile[];
  onDrop: (files: File[]) => void;
  onRemove: (id: string) => void;
  disabled: boolean;
}

/**
 * Dropzone for a single file category with queued file list.
 */
function FileCategoryDropzone({
  config,
  files,
  onDrop,
  onRemove,
  disabled,
}: FileCategoryDropzoneProps) {
  const Icon = config.icon;

  return (
    <div className="space-y-2">
      {/* Category header */}
      <div className="flex items-center gap-2">
        <Icon className="text-muted-foreground size-4" />
        <span className="text-sm font-medium">{config.label}</span>
        {files.length > 0 && (
          <span className="bg-muted rounded-full px-2 py-0.5 text-xs tabular-nums">
            {files.length}
          </span>
        )}
      </div>

      {/* Dropzone */}
      <Dropzone
        onDrop={(accepted) => onDrop(accepted)}
        maxFiles={MAX_FILES_PER_CATEGORY}
        maxSize={MAX_FILE_SIZE}
        accept={config.accept}
        disabled={disabled}
        className="min-h-[80px]"
      >
        <DropzoneEmptyState>
          <div className="flex flex-col items-center justify-center gap-1 py-2">
            <Plus className="text-muted-foreground size-5" />
            <p className="text-muted-foreground text-xs">
              {config.description}
            </p>
          </div>
        </DropzoneEmptyState>
        <DropzoneContent>
          <div className="flex flex-col items-center justify-center gap-1 py-2">
            <Plus className="text-primary size-5" />
            <p className="text-xs font-medium">Drop to add</p>
          </div>
        </DropzoneContent>
      </Dropzone>

      {/* Queued files list */}
      <AnimatePresence mode="popLayout">
        {files.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-1"
          >
            {files.map((qf, index) => (
              <motion.div
                key={qf.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ delay: index * 0.03 }}
                className="group bg-muted/50 flex items-center justify-between rounded-lg px-3 py-2"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <Icon className="text-muted-foreground size-3.5 shrink-0" />
                  <span className="truncate text-xs">{qf.file.name}</span>
                  <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                    {formatBytes(qf.file.size)}
                  </span>
                  {qf.isPrimary && (
                    <span className="bg-brand/20 text-brand shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium">
                      Primary
                    </span>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => onRemove(qf.id)}
                  disabled={disabled}
                  className="size-6 opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <X className="size-3" />
                  <span className="sr-only">Remove {qf.file.name}</span>
                </Button>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
