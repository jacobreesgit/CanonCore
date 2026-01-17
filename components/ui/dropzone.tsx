/**
 * Dropzone component for drag-and-drop file uploads.
 * Based on shadcn/ui dropzone with react-dropzone integration.
 */

"use client";

import { UploadIcon } from "lucide-react";
import type { ReactNode } from "react";
import { createContext, useContext } from "react";
import type { DropEvent, DropzoneOptions, FileRejection } from "react-dropzone";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type DropzoneContextType = {
  src?: File[];
  accept?: DropzoneOptions["accept"];
  maxSize?: DropzoneOptions["maxSize"];
  minSize?: DropzoneOptions["minSize"];
  maxFiles?: DropzoneOptions["maxFiles"];
};

/**
 * Formats bytes into human-readable string.
 */
const renderBytes = (bytes: number) => {
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  // Remove trailing zeros (e.g., "1.00MB" -> "1MB")
  const formatted = size.toFixed(2).replace(/\.?0+$/, "");
  return `${formatted}${units[unitIndex]}`;
};

const DropzoneContext = createContext<DropzoneContextType | undefined>(
  undefined
);

export type DropzoneProps = Omit<DropzoneOptions, "onDrop"> & {
  /** Files currently selected */
  src?: File[];
  /** Additional CSS classes */
  className?: string;
  /** Callback when files are dropped */
  onDrop?: (
    acceptedFiles: File[],
    fileRejections: FileRejection[],
    event: DropEvent
  ) => void;
  /** Custom content to render inside dropzone */
  children?: ReactNode;
  /** Test ID for E2E testing */
  "data-testid"?: string;
};

/**
 * Dropzone component for file uploads with drag-and-drop support.
 *
 * @param accept - MIME types to accept
 * @param maxFiles - Maximum number of files (default: 1)
 * @param maxSize - Maximum file size in bytes
 * @param onDrop - Callback when files are dropped
 * @param onError - Callback when file validation fails
 * @param disabled - Whether dropzone is disabled
 * @param src - Currently selected files
 * @param className - Additional CSS classes
 * @param children - Custom content
 */
export const Dropzone = ({
  accept,
  maxFiles = 1,
  maxSize,
  minSize,
  onDrop,
  onError,
  disabled,
  src,
  className,
  children,
  "data-testid": dataTestId,
  ...props
}: DropzoneProps) => {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept,
    maxFiles,
    maxSize,
    minSize,
    onError,
    disabled,
    onDrop: (acceptedFiles, fileRejections, event) => {
      if (fileRejections.length > 0) {
        let message = fileRejections.at(0)?.errors.at(0)?.message;

        // Format byte sizes in error messages (e.g., "1048576 bytes" -> "1MB")
        if (message) {
          message = message.replace(/(\d+) bytes/g, (_, bytes) =>
            renderBytes(Number(bytes))
          );
        }

        onError?.(new Error(message ?? "File validation failed"));
        return;
      }

      onDrop?.(acceptedFiles, fileRejections, event);
    },
    ...props,
  });

  return (
    <DropzoneContext.Provider
      key={JSON.stringify(src)}
      value={{ src, accept, maxSize, minSize, maxFiles }}
    >
      <Button
        className={cn(
          "relative h-auto w-full flex-col overflow-hidden p-8",
          isDragActive && "ring-ring ring-1 outline-none",
          className
        )}
        disabled={disabled}
        type="button"
        variant="outline"
        data-testid={dataTestId}
        {...getRootProps()}
      >
        <input {...getInputProps()} disabled={disabled} />
        {children}
      </Button>
    </DropzoneContext.Provider>
  );
};

/**
 * Hook to access dropzone context.
 */
const useDropzoneContext = () => {
  const context = useContext(DropzoneContext);

  if (!context) {
    throw new Error("useDropzoneContext must be used within a Dropzone");
  }

  return context;
};

export type DropzoneContentProps = {
  /** Custom content when files are selected */
  children?: ReactNode;
  /** Additional CSS classes */
  className?: string;
};

const maxLabelItems = 3;

/**
 * Content shown when files are selected in the dropzone.
 * Returns null if no files are selected.
 */
export const DropzoneContent = ({
  children,
  className,
}: DropzoneContentProps) => {
  const { src } = useDropzoneContext();

  if (!src) {
    return null;
  }

  if (children) {
    return children;
  }

  return (
    <div className={cn("flex flex-col items-center justify-center", className)}>
      <div className="bg-muted text-muted-foreground flex size-8 items-center justify-center rounded-md">
        <UploadIcon size={16} />
      </div>
      <p className="my-2 w-full truncate text-sm font-medium">
        {src.length > maxLabelItems
          ? `${new Intl.ListFormat("en").format(
              src.slice(0, maxLabelItems).map((file) => file.name)
            )} and ${src.length - maxLabelItems} more`
          : new Intl.ListFormat("en").format(src.map((file) => file.name))}
      </p>
      <p className="text-muted-foreground w-full text-xs text-wrap">
        Drag and drop or click to replace
      </p>
    </div>
  );
};

export type DropzoneEmptyStateProps = {
  /** Custom content for empty state */
  children?: ReactNode;
  /** Additional CSS classes */
  className?: string;
};

/**
 * Empty state shown when no files are selected.
 * Returns null if files are already selected.
 */
export const DropzoneEmptyState = ({
  children,
  className,
}: DropzoneEmptyStateProps) => {
  const { src, accept, maxSize, minSize, maxFiles } = useDropzoneContext();

  if (src) {
    return null;
  }

  if (children) {
    return children;
  }

  let caption = "";

  if (accept) {
    caption += "Accepts ";
    caption += new Intl.ListFormat("en").format(Object.keys(accept));
  }

  if (minSize && maxSize) {
    caption += ` between ${renderBytes(minSize)} and ${renderBytes(maxSize)}`;
  } else if (minSize) {
    caption += ` at least ${renderBytes(minSize)}`;
  } else if (maxSize) {
    caption += ` less than ${renderBytes(maxSize)}`;
  }

  return (
    <div className={cn("flex flex-col items-center justify-center", className)}>
      <div className="bg-muted text-muted-foreground flex size-8 items-center justify-center rounded-md">
        <UploadIcon size={16} />
      </div>
      <p className="my-2 w-full truncate text-sm font-medium text-wrap">
        Upload {maxFiles === 1 ? "a file" : "files"}
      </p>
      <p className="text-muted-foreground w-full truncate text-xs text-wrap">
        Drag and drop or click to upload
      </p>
      {caption && (
        <p className="text-muted-foreground text-xs text-wrap">{caption}.</p>
      )}
    </div>
  );
};
