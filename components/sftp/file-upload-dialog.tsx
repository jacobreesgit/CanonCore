/**
 * File upload dialog for SFTP uploads.
 * Features drag-and-drop zone with industrial precision animations.
 */

"use client";

import { useState, useCallback, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { uploadToSftp } from "@/lib/sftp-actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Upload,
  File,
  X,
  CheckCircle2,
  AlertCircle,
  CloudUpload,
} from "lucide-react";

/** Maximum file size in bytes (50MB) */
const MAX_FILE_SIZE = 50 * 1024 * 1024;

interface FileUploadDialogProps {
  connectionId: string;
  parentItemId: string | null;
  children?: React.ReactNode;
  onUploadComplete?: () => void;
}

interface SelectedFile {
  file: File;
  status: "pending" | "uploading" | "success" | "error";
  error?: string;
}

/**
 * Dialog for uploading files to SFTP with drag-and-drop support.
 *
 * @param connectionId - SFTP connection to upload to
 * @param parentItemId - Parent folder ID (null for root)
 * @param children - Trigger element
 * @param onUploadComplete - Callback after upload completes
 */
export function FileUploadDialog({
  connectionId,
  parentItemId,
  children,
  onUploadComplete,
}: FileUploadDialogProps) {
  const [open, setOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<SelectedFile[]>([]);
  const [isPending, startTransition] = useTransition();

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const validateFile = (file: File): string | null => {
    if (file.size > MAX_FILE_SIZE) {
      return `File too large (max 50MB)`;
    }
    if (file.size === 0) {
      return "File is empty";
    }
    return null;
  };

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const fileArray = Array.from(newFiles);
    const selectedFiles: SelectedFile[] = fileArray.map((file) => {
      const error = validateFile(file);
      return {
        file,
        status: error ? "error" : "pending",
        error: error ?? undefined,
      } as SelectedFile;
    });
    setFiles((prev) => [...prev, ...selectedFiles]);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) {
        addFiles(e.dataTransfer.files);
      }
    },
    [addFiles]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        addFiles(e.target.files);
      }
    },
    [addFiles]
  );

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const uploadFiles = async () => {
    const pendingFiles = files.filter((f) => f.status === "pending");
    if (pendingFiles.length === 0) return;

    startTransition(async () => {
      let successCount = 0;
      let errorCount = 0;

      for (let i = 0; i < files.length; i++) {
        const selectedFile = files[i];
        if (selectedFile.status !== "pending") continue;

        // Update status to uploading
        setFiles((prev) =>
          prev.map((f, idx) =>
            idx === i ? { ...f, status: "uploading" as const } : f
          )
        );

        try {
          // Read file as buffer
          const arrayBuffer = await selectedFile.file.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);

          const result = await uploadToSftp(connectionId, parentItemId, {
            name: selectedFile.file.name,
            buffer,
            mimeType: selectedFile.file.type || "application/octet-stream",
          });

          if (result.success) {
            setFiles((prev) =>
              prev.map((f, idx) =>
                idx === i ? { ...f, status: "success" as const } : f
              )
            );
            successCount++;
          } else {
            setFiles((prev) =>
              prev.map((f, idx) =>
                idx === i
                  ? { ...f, status: "error" as const, error: result.error }
                  : f
              )
            );
            errorCount++;
          }
        } catch {
          setFiles((prev) =>
            prev.map((f, idx) =>
              idx === i
                ? { ...f, status: "error" as const, error: "Upload failed" }
                : f
            )
          );
          errorCount++;
        }
      }

      // Show summary toast
      if (successCount > 0 && errorCount === 0) {
        toast.success(
          `${successCount} file${successCount > 1 ? "s" : ""} uploaded`
        );
        onUploadComplete?.();
        // Close dialog after short delay
        setTimeout(() => {
          setOpen(false);
          setFiles([]);
        }, 1000);
      } else if (successCount > 0) {
        toast.warning(`${successCount} uploaded, ${errorCount} failed`);
        onUploadComplete?.();
      } else {
        toast.error("Upload failed");
      }
    });
  };

  const pendingCount = files.filter((f) => f.status === "pending").length;
  const uploadingCount = files.filter((f) => f.status === "uploading").length;
  const progress =
    files.length > 0
      ? Math.round(
          (files.filter((f) => f.status === "success").length / files.length) *
            100
        )
      : 0;

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children ?? (
          <Button variant="outline" size="sm">
            <Upload className="mr-2 size-4" />
            Upload
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CloudUpload className="text-primary size-5" />
            Upload Files
          </DialogTitle>
          <DialogDescription>
            Drag and drop files or click to select. Max 50MB per file.
          </DialogDescription>
        </DialogHeader>

        {/* Drop zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            "relative flex min-h-[180px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-all duration-200",
            isDragging
              ? "border-primary bg-primary/5 scale-[1.02]"
              : "border-muted-foreground/25 hover:border-muted-foreground/50 hover:bg-muted/50",
            isPending && "pointer-events-none opacity-60"
          )}
        >
          {/* Animated corner accents when dragging */}
          {isDragging && (
            <>
              <span className="border-primary animate-in fade-in absolute top-2 left-2 size-4 border-t-2 border-l-2 duration-150" />
              <span className="border-primary animate-in fade-in absolute top-2 right-2 size-4 border-t-2 border-r-2 duration-150" />
              <span className="border-primary animate-in fade-in absolute bottom-2 left-2 size-4 border-b-2 border-l-2 duration-150" />
              <span className="border-primary animate-in fade-in absolute right-2 bottom-2 size-4 border-r-2 border-b-2 duration-150" />
            </>
          )}

          <input
            type="file"
            multiple
            onChange={handleFileSelect}
            className="absolute inset-0 cursor-pointer opacity-0"
            disabled={isPending}
          />

          <div className="flex flex-col items-center gap-3 p-6 text-center">
            <div
              className={cn(
                "flex size-14 items-center justify-center rounded-full transition-all duration-300",
                isDragging
                  ? "bg-primary/10 text-primary scale-110"
                  : "bg-muted text-muted-foreground"
              )}
            >
              <Upload
                className={cn(
                  "size-6 transition-transform duration-300",
                  isDragging && "-translate-y-1"
                )}
              />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">
                {isDragging
                  ? "Drop files here"
                  : "Drop files or click to upload"}
              </p>
              <p className="text-muted-foreground text-xs">
                Supports any file type up to 50MB
              </p>
            </div>
          </div>
        </div>

        {/* File list */}
        {files.length > 0 && (
          <div className="space-y-3">
            {/* Progress bar when uploading */}
            {uploadingCount > 0 && (
              <div className="space-y-1">
                <Progress value={progress} className="h-1.5" />
                <p className="text-muted-foreground text-center text-xs">
                  Uploading {uploadingCount} of {files.length}...
                </p>
              </div>
            )}

            {/* File items */}
            <div className="max-h-[200px] space-y-2 overflow-y-auto pr-1">
              {files.map((selectedFile, index) => (
                <div
                  key={`${selectedFile.file.name}-${index}`}
                  className={cn(
                    "flex items-center gap-3 rounded-md border p-2.5 transition-all duration-200",
                    selectedFile.status === "success" &&
                      "border-emerald-500/30 bg-emerald-500/5",
                    selectedFile.status === "error" &&
                      "border-destructive/30 bg-destructive/5",
                    selectedFile.status === "uploading" &&
                      "border-primary/30 bg-primary/5"
                  )}
                >
                  {/* Status icon */}
                  <div className="bg-muted flex size-8 shrink-0 items-center justify-center rounded">
                    {selectedFile.status === "success" ? (
                      <CheckCircle2 className="size-4 text-emerald-500" />
                    ) : selectedFile.status === "error" ? (
                      <AlertCircle className="text-destructive size-4" />
                    ) : selectedFile.status === "uploading" ? (
                      <div className="border-primary size-4 animate-spin rounded-full border-2 border-t-transparent" />
                    ) : (
                      <File className="text-muted-foreground size-4" />
                    )}
                  </div>

                  {/* File info */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {selectedFile.file.name}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {selectedFile.error ??
                        formatFileSize(selectedFile.file.size)}
                    </p>
                  </div>

                  {/* Remove button */}
                  {selectedFile.status === "pending" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 shrink-0"
                      onClick={() => removeFile(index)}
                    >
                      <X className="size-4" />
                      <span className="sr-only">Remove file</span>
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setOpen(false);
              setFiles([]);
            }}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={uploadFiles}
            disabled={pendingCount === 0 || isPending}
          >
            {isPending ? (
              <>
                <div className="mr-2 size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="mr-2 size-4" />
                Upload {pendingCount > 0 ? `(${pendingCount})` : ""}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
