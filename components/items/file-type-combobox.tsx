/**
 * FileTypeCombobox - Combines file selection with inline upload capability.
 * Supports two modes via discriminated union:
 * - Select mode: Dropdown to select from existing files with upload option
 * - Upload-only mode: Dropzone for queueing files before item creation
 */

"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Check,
  ChevronDown,
  ExternalLink,
  Upload,
  X,
  AlertCircle,
  RefreshCw,
  Trash2,
  Loader2,
  CloudOff,
  ImageIcon,
} from "lucide-react";
import { useImageLoaded } from "@/hooks/use-image-loaded";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Dropzone,
  DropzoneEmptyState,
  DropzoneContent,
} from "@/components/ui/dropzone";
import { createUploadSessions, confirmUpload } from "@/lib/google-drive-upload";
import { deleteItemFile } from "@/lib/item-file-actions";
import { toast } from "sonner";
import {
  BatchUploadManager,
  type UploadState,
  getAcceptFilter,
  formatBytes,
} from "@/lib/upload-utils";
import type { SerializedItemFile, QueuedFile } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import type { Accept } from "react-dropzone";

/**
 * Artwork thumbnail with load state tracking for smooth fade-in.
 * Uses useImageLoaded hook for cached image detection.
 */
function ArtworkThumbnail({
  fileId,
  size = "md",
}: {
  fileId: string;
  size?: "sm" | "md";
}) {
  const artworkSrc = `/api/artwork/${fileId}`;
  const { ref, loaded, onLoad, onError } = useImageLoaded(artworkSrc);
  const sizeClass = size === "sm" ? "size-5" : "size-6";
  const iconSize = size === "sm" ? "size-3" : "size-3.5";

  return (
    <div
      className={cn(
        sizeClass,
        "bg-muted relative shrink-0 overflow-hidden rounded"
      )}
    >
      {/* Image icon placeholder while loading */}
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center">
          <ImageIcon className={cn(iconSize, "text-muted-foreground/50")} />
        </div>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={ref}
        src={artworkSrc}
        alt=""
        loading="lazy"
        className={cn(
          "absolute inset-0 h-full w-full object-cover transition-opacity duration-150",
          loaded ? "opacity-100" : "opacity-0"
        )}
        onLoad={onLoad}
        onError={onError}
      />
    </div>
  );
}

/**
 * Converts file type to react-dropzone Accept format.
 *
 * @param fileType - The file type category
 * @returns Accept object for react-dropzone
 */
function getAcceptForDropzone(
  fileType: "media" | "artwork" | "subtitle"
): Accept {
  switch (fileType) {
    case "media":
      return { "video/*": [], "audio/*": [] };
    case "artwork":
      return { "image/*": [] };
    case "subtitle":
      return { "text/plain": [".srt", ".vtt", ".sub", ".ass"] };
  }
}

/**
 * Base props shared by both select and upload-only modes.
 */
interface FileTypeComboboxBaseProps {
  /** Label displayed above the combobox */
  label: string;
  /** Description text below the label */
  description: string;
  /** Icon component to display */
  icon: LucideIcon;
  /** File type category for filtering */
  fileType: "media" | "artwork" | "subtitle";
  /** Whether the component is disabled (no Drive connection) */
  disabled?: boolean;
}

/**
 * Props for select mode (existing file selection with dropdown).
 */
interface FileTypeComboboxSelectModeProps extends FileTypeComboboxBaseProps {
  /** Whether to use upload-only mode (false or undefined for select mode) */
  uploadOnly?: false;
  /** Available files to select from */
  files: SerializedItemFile[];
  /** Currently selected file ID */
  selectedId?: string;
  /** Callback when selection changes */
  onSelect: (id: string) => void;
  /** Callback when upload completes with success count (for refreshing file list) */
  onUploadComplete: (successCount: number) => void;
  /** Callback when a file is deleted (for refreshing file list) */
  onFileDeleted?: () => void;
  /** Item ID for uploads */
  itemId: string;
}

/**
 * Props for upload-only mode (queue files for deferred upload).
 */
interface FileTypeComboboxUploadModeProps extends FileTypeComboboxBaseProps {
  /** Enable upload-only mode */
  uploadOnly: true;
  /** Currently queued files */
  queuedFiles: QueuedFile[];
  /** Callback when queued files change */
  onQueueFilesChange: (files: QueuedFile[]) => void;
}

/**
 * Discriminated union type for FileTypeCombobox props.
 * Enforces type safety at compile time and prevents incompatible prop combinations.
 */
export type FileTypeComboboxProps =
  | FileTypeComboboxSelectModeProps
  | FileTypeComboboxUploadModeProps;

/**
 * Generates a unique ID for queued files.
 */
function generateFileId(): string {
  return `file-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * FileTypeCombobox component with file selection and upload capability.
 * Supports two modes:
 * - Select mode: Popover dropdown for selecting existing files with inline upload
 * - Upload-only mode: Dropzone for queueing files before item creation
 */
export function FileTypeCombobox(props: FileTypeComboboxProps) {
  const { label, description, icon: Icon, fileType, disabled = false } = props;

  // Render upload-only mode if specified
  if (props.uploadOnly) {
    return (
      <FileTypeComboboxUploadMode
        label={label}
        description={description}
        icon={Icon}
        fileType={fileType}
        disabled={disabled}
        queuedFiles={props.queuedFiles}
        onQueueFilesChange={props.onQueueFilesChange}
      />
    );
  }

  // Render select mode (default)
  return (
    <FileTypeComboboxSelectMode
      label={label}
      description={description}
      icon={Icon}
      fileType={fileType}
      disabled={disabled}
      files={props.files}
      selectedId={props.selectedId}
      onSelect={props.onSelect}
      onUploadComplete={props.onUploadComplete}
      onFileDeleted={props.onFileDeleted}
      itemId={props.itemId}
    />
  );
}

/**
 * Upload-only mode component.
 * Shows a dropzone for queueing files with inline file list.
 */
function FileTypeComboboxUploadMode({
  label,
  description,
  icon: Icon,
  fileType,
  disabled,
  queuedFiles,
  onQueueFilesChange,
}: {
  label: string;
  description: string;
  icon: LucideIcon;
  fileType: "media" | "artwork" | "subtitle";
  disabled?: boolean;
  queuedFiles: QueuedFile[];
  onQueueFilesChange: (files: QueuedFile[]) => void;
}) {
  /**
   * Handles files dropped into the dropzone.
   */
  const handleFileDrop = useCallback(
    (acceptedFiles: File[]) => {
      const newQueuedFiles: QueuedFile[] = acceptedFiles.map((file) => {
        // Use the expected fileType for the category, not detection from extension
        // This ensures files go into the correct category as intended
        return {
          id: generateFileId(),
          file,
          fileType: fileType.toUpperCase() as "MEDIA" | "ARTWORK" | "SUBTITLE",
          size: file.size,
          status: "pending" as const,
        };
      });

      onQueueFilesChange([...queuedFiles, ...newQueuedFiles]);
    },
    [fileType, queuedFiles, onQueueFilesChange]
  );

  /**
   * Removes a file from the queue.
   */
  const handleRemoveFile = useCallback(
    (fileId: string) => {
      onQueueFilesChange(queuedFiles.filter((f) => f.id !== fileId));
    },
    [queuedFiles, onQueueFilesChange]
  );

  // Calculate total size for display
  const totalSize = useMemo(() => {
    return queuedFiles.reduce((sum, f) => sum + f.size, 0);
  }, [queuedFiles]);

  return (
    <div className="space-y-3">
      {/* Label and Description */}
      <div className="flex items-center gap-2">
        <div
          className={cn(
            "flex size-7 items-center justify-center rounded-lg",
            "bg-primary/10"
          )}
        >
          <Icon className="text-primary size-3.5" />
        </div>
        <label className="text-sm font-medium">{label}</label>
      </div>
      <p className="text-muted-foreground text-xs">{description}</p>

      {/* Disabled state - no Drive connection */}
      {disabled ? (
        <div className="bg-muted/50 rounded-lg border border-dashed p-4 text-center">
          <CloudOff className="text-muted-foreground/50 mx-auto mb-2 size-8" />
          <p className="text-muted-foreground text-sm">
            Connect Google Drive in Settings to enable file uploads.
          </p>
        </div>
      ) : (
        <>
          {/* Dropzone for queueing files */}
          <Dropzone
            onDrop={handleFileDrop}
            maxFiles={10}
            maxSize={10 * 1024 * 1024 * 1024} // 10GB
            accept={getAcceptForDropzone(fileType)}
            className="min-h-[80px]"
          >
            <DropzoneEmptyState>
              <div className="flex flex-col items-center justify-center gap-1.5 py-2">
                <Upload className="text-muted-foreground size-5" />
                <p className="text-muted-foreground text-xs">
                  Drop {fileType} files or click to browse
                </p>
              </div>
            </DropzoneEmptyState>
            <DropzoneContent>
              <div className="flex flex-col items-center justify-center gap-1.5 py-2">
                <Upload className="text-primary size-5" />
                <p className="text-sm font-medium">Drop to add</p>
              </div>
            </DropzoneContent>
          </Dropzone>

          {/* Queued files list */}
          <AnimatePresence mode="popLayout">
            {queuedFiles.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-xs">
                    {queuedFiles.length} file{queuedFiles.length !== 1 && "s"}{" "}
                    queued
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {formatBytes(totalSize)}
                  </span>
                </div>
                <div className="max-h-[120px] space-y-1 overflow-y-auto">
                  {queuedFiles.map((qf, index) => (
                    <motion.div
                      key={qf.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      transition={{ duration: 0.15, delay: index * 0.03 }}
                      className={cn(
                        "flex items-center gap-2 rounded-md border px-2 py-1.5",
                        "bg-muted/30"
                      )}
                    >
                      <Icon className="text-muted-foreground size-3.5 shrink-0" />
                      <span className="min-w-0 flex-1 truncate text-xs">
                        {qf.file.name}
                      </span>
                      <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                        {formatBytes(qf.size)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveFile(qf.id)}
                        className={cn(
                          "shrink-0 rounded p-0.5 transition-colors",
                          "hover:bg-destructive/10 hover:text-destructive"
                        )}
                        aria-label={`Remove ${qf.file.name}`}
                      >
                        <X className="size-3.5" />
                      </button>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}

/**
 * Select mode component (original implementation).
 * Shows a combobox dropdown for selecting existing files with upload option.
 */
function FileTypeComboboxSelectMode({
  label,
  description,
  icon: Icon,
  fileType,
  disabled,
  files,
  selectedId,
  onSelect,
  onUploadComplete,
  onFileDeleted,
  itemId,
}: {
  label: string;
  description: string;
  icon: LucideIcon;
  fileType: "media" | "artwork" | "subtitle";
  disabled?: boolean;
  files: SerializedItemFile[];
  selectedId?: string;
  onSelect: (id: string) => void;
  onUploadComplete: (successCount: number) => void;
  onFileDeleted?: () => void;
  itemId: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [uploadState, setUploadState] = useState<UploadState | null>(null);
  const [failedFiles, setFailedFiles] = useState<File[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<SerializedItemFile | null>(
    null
  );

  /**
   * Opens the delete confirmation dialog.
   */
  const handleDeleteClick = useCallback(
    (e: React.MouseEvent, file: SerializedItemFile) => {
      e.stopPropagation(); // Prevent selecting the file
      setDeleteConfirm(file);
    },
    []
  );

  /**
   * Confirms and executes file deletion with loading state and toast feedback.
   */
  const handleConfirmDelete = useCallback(async () => {
    if (!deleteConfirm) return;

    setDeletingId(deleteConfirm.id);

    try {
      const result = await deleteItemFile(deleteConfirm.id);
      if (result.success) {
        toast.success("File deleted");
        onFileDeleted?.();
        setDeleteConfirm(null);
      } else {
        toast.error(result.error || "Failed to delete file");
      }
    } catch {
      toast.error("Failed to delete file");
    } finally {
      setDeletingId(null);
    }
  }, [deleteConfirm, onFileDeleted]);

  /**
   * Handles popover open/close state changes.
   * Clears search when closing.
   */
  const handleOpenChange = useCallback((open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setSearch("");
    }
  }, []);

  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadManagerRef = useRef<BatchUploadManager | null>(null);

  // Filter files by search
  const filteredFiles = files.filter((f) =>
    f.filename.toLowerCase().includes(search.toLowerCase())
  );

  // Get selected file for display
  const selectedFile = files.find((f) => f.id === selectedId);

  // Calculate upload progress stats for display
  const uploadProgress = useMemo(() => {
    if (!uploadState || uploadState.status !== "uploading") return null;

    const currentFileIndex = uploadState.files.findIndex(
      (f) => f.status === "uploading"
    );
    const overallPercent = Math.round(
      uploadState.files.reduce((sum, f) => sum + f.progress, 0) /
        uploadState.files.length
    );
    const totalLoaded = uploadState.files.reduce(
      (sum, f) => sum + (f.loaded || 0),
      0
    );
    const totalSize = uploadState.files.reduce(
      (sum, f) => sum + (f.total || 0),
      0
    );

    return {
      currentFileIndex,
      overallPercent,
      totalLoaded,
      totalSize,
      fileCount: uploadState.files.length,
    };
  }, [uploadState]);

  // Focus search input when opening
  useEffect(() => {
    if (isOpen && inputRef.current) {
      // Small delay to let popover render
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isOpen]);

  /**
   * Handles file selection from the list.
   */
  const handleSelect = useCallback(
    (id: string) => {
      onSelect(id);
      handleOpenChange(false);
    },
    [onSelect, handleOpenChange]
  );

  /**
   * Opens file picker for upload.
   */
  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  /**
   * Handles file selection from file picker.
   */
  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = Array.from(e.target.files || []);
      if (!selectedFiles.length) return;

      // Close dropdown to show upload progress
      handleOpenChange(false);

      // Reset file input
      e.target.value = "";

      // Create upload sessions
      const fileMetadata = selectedFiles.map((f) => ({
        name: f.name,
        mimeType: f.type || "application/octet-stream",
      }));

      const result = await createUploadSessions(
        itemId,
        fileMetadata,
        window.location.origin
      );

      if (!result.success || !result.sessions) {
        setUploadState({
          status: "error",
          files: selectedFiles.map((f) => ({
            name: f.name,
            progress: 0,
            status: "error",
            error: result.error || "Failed to create upload session",
          })),
          successCount: 0,
          errorCount: selectedFiles.length,
        });
        setFailedFiles(selectedFiles);
        return;
      }

      // Start batch upload
      const manager = new BatchUploadManager(
        result.sessions,
        selectedFiles,
        setUploadState,
        confirmUpload,
        3 // Max 3 concurrent
      );

      uploadManagerRef.current = manager;
      const finalState = await manager.start();

      // Track failed files for retry
      const failed = selectedFiles.filter(
        (_, i) => finalState.files[i]?.status === "error"
      );
      setFailedFiles(failed);

      // Refresh file list if any succeeded
      if (finalState.successCount > 0) {
        onUploadComplete(finalState.successCount);
      }

      // Auto-dismiss on complete success
      if (failed.length === 0) {
        setUploadState(null);
        uploadManagerRef.current = null;
      }
    },
    [itemId, onUploadComplete, handleOpenChange]
  );

  /**
   * Retries failed uploads.
   */
  const handleRetry = useCallback(async () => {
    if (!failedFiles.length) return;

    // Create new sessions for failed files
    const fileMetadata = failedFiles.map((f) => ({
      name: f.name,
      mimeType: f.type || "application/octet-stream",
    }));

    const result = await createUploadSessions(
      itemId,
      fileMetadata,
      window.location.origin
    );

    if (!result.success || !result.sessions) {
      return;
    }

    const manager = new BatchUploadManager(
      result.sessions,
      failedFiles,
      setUploadState,
      confirmUpload,
      3
    );

    uploadManagerRef.current = manager;
    const finalState = await manager.start();

    const stillFailed = failedFiles.filter(
      (_, i) => finalState.files[i]?.status === "error"
    );
    setFailedFiles(stillFailed);

    if (finalState.successCount > 0) {
      onUploadComplete(finalState.successCount);
    }

    // Auto-dismiss on complete success
    if (stillFailed.length === 0) {
      setUploadState(null);
      uploadManagerRef.current = null;
    }
  }, [failedFiles, itemId, onUploadComplete]);

  /**
   * Dismisses upload state.
   */
  const handleDismiss = useCallback(() => {
    setUploadState(null);
    setFailedFiles([]);
    uploadManagerRef.current?.cancel();
    uploadManagerRef.current = null;
  }, []);

  const isUploading = uploadState?.status === "uploading";
  const hasError = uploadState?.status === "error" && failedFiles.length > 0;

  return (
    <div className="space-y-3">
      {/* Label and Description */}
      <div className="flex items-center gap-2">
        <div
          className={cn(
            "flex size-7 items-center justify-center rounded-lg",
            "bg-primary/10"
          )}
        >
          <Icon className="text-primary size-3.5" />
        </div>
        <label className="text-sm font-medium">{label}</label>
      </div>
      <p className="text-muted-foreground text-xs">{description}</p>

      {/* Combobox with Popover */}
      <Popover open={isOpen} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={isOpen}
            disabled={disabled || isUploading}
            className={cn(
              "h-10 w-full justify-between font-normal",
              !selectedFile && "text-muted-foreground"
            )}
          >
            {selectedFile ? (
              <span className="flex min-w-0 items-center gap-2">
                {fileType === "artwork" && (
                  <ArtworkThumbnail fileId={selectedFile.id} size="sm" />
                )}
                <span className="truncate">{selectedFile.filename}</span>
              </span>
            ) : (
              <span>Select {fileType} file...</span>
            )}
            <ChevronDown
              className={cn(
                "text-muted-foreground size-4 shrink-0 transition-transform duration-200",
                isOpen && "rotate-180"
              )}
            />
          </Button>
        </PopoverTrigger>

        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] p-0"
          align="start"
        >
          {/* Search Input */}
          {files.length > 3 && (
            <div className="border-b p-2">
              <Input
                ref={inputRef}
                placeholder="Search files…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8"
              />
            </div>
          )}

          {/* File List */}
          <div
            className="max-h-48 overflow-y-auto p-1"
            onWheel={(e) => {
              e.stopPropagation();
              e.currentTarget.scrollTop += e.deltaY;
            }}
          >
            {filteredFiles.length === 0 && files.length > 0 && (
              <div className="text-muted-foreground py-4 text-center text-sm">
                No files match &quot;{search}&quot;
              </div>
            )}

            {filteredFiles.length === 0 && files.length === 0 && (
              <div className="text-muted-foreground py-4 text-center text-sm">
                No files yet
              </div>
            )}

            {filteredFiles.map((file) => (
              <div
                key={file.id}
                data-file-row="true"
                className="group flex items-center"
              >
                <button
                  type="button"
                  onClick={() => handleSelect(file.id)}
                  className={cn(
                    "flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                    "hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  {fileType === "artwork" && (
                    <ArtworkThumbnail fileId={file.id} size="md" />
                  )}
                  <span className="min-w-0 flex-1 truncate">
                    {file.filename}
                  </span>
                </button>
                {/* Drive link - show for files with driveFileId */}
                {file.driveFileId && (
                  <a
                    href={`https://drive.google.com/file/d/${file.driveFileId}/view`}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid={`drive-link-${file.id}`}
                    className="hover:bg-accent rounded p-1"
                    onClick={(e) => e.stopPropagation()}
                    title="Open in Google Drive"
                  >
                    <ExternalLink className="text-muted-foreground size-3.5" />
                  </a>
                )}
                {/* Checkmark for selected, delete button for non-selected */}
                {selectedId === file.id ? (
                  <div className="mr-1 rounded p-1">
                    <Check className="text-primary size-3.5" />
                  </div>
                ) : (
                  <button
                    type="button"
                    data-testid={`delete-file-${file.id}`}
                    onClick={(e) => handleDeleteClick(e, file)}
                    disabled={deletingId === file.id}
                    className={cn(
                      "mr-1 rounded p-1 opacity-0 transition-opacity",
                      "hover:bg-destructive/10 hover:text-destructive",
                      "group-hover:opacity-100",
                      deletingId === file.id && "opacity-100"
                    )}
                    aria-label={`Delete ${file.filename}`}
                  >
                    {deletingId === file.id ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="size-3.5" />
                    )}
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Upload Action */}
          {!disabled && (
            <>
              <div className="border-t" />
              <button
                type="button"
                onClick={handleUploadClick}
                className={cn(
                  "flex w-full cursor-pointer items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors",
                  "text-primary hover:bg-primary/5"
                )}
              >
                <Upload className="size-4" />
                <span>Upload {fileType} files...</span>
              </button>
            </>
          )}
        </PopoverContent>
      </Popover>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={getAcceptFilter(fileType)}
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Upload Progress / Error State */}
      <AnimatePresence>
        {uploadState && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className={cn(
              "overflow-hidden rounded-lg border",
              hasError
                ? "border-destructive/30 bg-destructive/5"
                : "bg-muted/30"
            )}
          >
            {/* Progress Header */}
            <div className="flex items-center justify-between px-3 py-2">
              <div className="flex items-center gap-2 text-sm">
                {isUploading && uploadProgress && (
                  <>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{
                        duration: 1,
                        repeat: Infinity,
                        ease: "linear",
                      }}
                      className="border-primary size-4 rounded-full border-2 border-t-transparent"
                    />
                    <span className="flex items-center gap-2">
                      <span>Uploading…</span>
                      <motion.span
                        key={uploadProgress.overallPercent}
                        initial={{ scale: 1.1 }}
                        animate={{ scale: 1 }}
                        className="bg-primary/15 text-primary inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 font-mono text-xs font-medium tracking-tight tabular-nums"
                      >
                        <span>{uploadProgress.overallPercent}%</span>
                        {uploadProgress.totalSize > 0 && (
                          <>
                            <span className="text-primary/50">·</span>
                            <span>
                              {formatBytes(uploadProgress.totalLoaded)}/
                              {formatBytes(uploadProgress.totalSize)}
                            </span>
                          </>
                        )}
                      </motion.span>
                      {uploadProgress.fileCount > 1 && (
                        <span className="text-muted-foreground text-xs">
                          ({uploadProgress.currentFileIndex + 1}/
                          {uploadProgress.fileCount})
                        </span>
                      )}
                    </span>
                  </>
                )}

                {hasError && (
                  <motion.div
                    initial={{ x: -10, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    className="flex items-center gap-2"
                  >
                    <AlertCircle className="text-destructive size-4" />
                    <span>
                      {uploadState.successCount} uploaded, {failedFiles.length}{" "}
                      failed
                    </span>
                  </motion.div>
                )}
              </div>

              {hasError && (
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleRetry}
                    className="h-7 gap-1 px-2 text-xs"
                  >
                    <RefreshCw className="size-3" />
                    Retry
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleDismiss}
                    className="text-muted-foreground hover:text-foreground size-7 p-0"
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirm !== null}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete File</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{deleteConfirm?.filename}
              &rdquo;? This will remove it from Google Drive. This action cannot
              be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteConfirm(null)}
              disabled={deletingId !== null}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={deletingId !== null}
            >
              {deletingId !== null ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
