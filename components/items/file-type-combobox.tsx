/**
 * FileTypeCombobox - Combines file selection with inline upload capability.
 * Uses Radix Popover for proper portal handling inside dialogs.
 * Used in Item Settings dialog for primary file selection.
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
} from "lucide-react";
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
  createUploadSessions,
  confirmUpload,
} from "@/lib/google-drive-actions";
import { deleteItemFile } from "@/lib/item-file-actions";
import { toast } from "sonner";
import {
  BatchUploadManager,
  type UploadState,
  getAcceptFilter,
  formatBytes,
} from "@/lib/upload-utils";
import type { SerializedItemFile } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface FileTypeComboboxProps {
  /** Label displayed above the combobox */
  label: string;
  /** Description text below the label */
  description: string;
  /** Icon component to display */
  icon: LucideIcon;
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
  /** File type category for filtering */
  fileType: "media" | "artwork" | "subtitle";
  /** Whether uploads are disabled (no Drive connection) */
  disabled?: boolean;
}

/**
 * Combobox component with file selection and upload capability.
 * Shows progress inline during uploads with retry functionality.
 */
export function FileTypeCombobox({
  label,
  description,
  icon: Icon,
  files,
  selectedId,
  onSelect,
  onUploadComplete,
  onFileDeleted,
  itemId,
  fileType,
  disabled = false,
}: FileTypeComboboxProps) {
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
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={`/api/artwork/${selectedFile.id}`}
                    alt=""
                    className="size-5 shrink-0 rounded object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
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
                placeholder="Search files..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8"
              />
            </div>
          )}

          {/* File List */}
          <div className="max-h-48 overflow-y-auto p-1">
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
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={`/api/artwork/${file.id}`}
                      alt=""
                      className="size-6 shrink-0 rounded object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
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
                      <span>Uploading...</span>
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
              {deletingId !== null ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
