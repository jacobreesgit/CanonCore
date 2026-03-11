/**
 * Hook for managing artwork file uploads in wizard steps.
 * Provides shared logic for file dropping, removal, and selection.
 */

import { useCallback, useMemo } from "react";
import type { QueuedFile, ArtworkSelectionSource } from "@/lib/types";

/** Maximum file size for uploaded images (50MB). */
export const MAX_IMAGE_SIZE_BYTES = 50 * 1024 * 1024;

/** Maximum number of files that can be uploaded at once. */
export const MAX_UPLOAD_FILES = 10;

interface UseArtworkUploadOptions {
  /** Current queued files */
  queuedFiles: QueuedFile[];
  /** Callback when queued files change */
  onQueueChange?: (files: QueuedFile[]) => void;
  /** Currently selected value (file ID or TMDB path) */
  selectedValue: string | null;
  /** Callback when selection changes */
  onSelect: (value: string | null, source: ArtworkSelectionSource) => void;
  /** Whether the step is skipped */
  isSkipped: boolean;
  /** Whether interactions are disabled */
  disabled: boolean;
}

interface UseArtworkUploadReturn {
  /** Handle files dropped into the dropzone */
  handleFileDrop: (acceptedFiles: File[]) => void;
  /** Remove a file from the queue by ID */
  handleRemoveFile: (fileId: string) => void;
  /** Handle selecting a queued file thumbnail */
  handleQueuedSelect: (fileId: string) => void;
  /** Total size of all queued files in bytes */
  totalSize: number;
}

/**
 * Hook for managing artwork file uploads in wizard steps.
 * Extracts shared logic used by both PosterSelectionStep and HeroSelectionStep.
 *
 * @param options - Configuration options
 * @returns Handlers and computed values for upload management
 *
 * @example
 * const { handleFileDrop, handleRemoveFile, handleQueuedSelect, totalSize } =
 *   useArtworkUpload({
 *     queuedFiles: queuedArtwork,
 *     onQueueChange: onQueueArtworkChange,
 *     selectedValue,
 *     onSelect,
 *     isSkipped,
 *     disabled,
 *   });
 */
export function useArtworkUpload({
  queuedFiles,
  onQueueChange,
  selectedValue,
  onSelect,
  isSkipped,
  disabled,
}: UseArtworkUploadOptions): UseArtworkUploadReturn {
  /**
   * Handles files dropped into the dropzone.
   * Creates QueuedFile objects and auto-selects the first file if nothing selected.
   */
  const handleFileDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (!onQueueChange) return;

      const newQueuedFiles: QueuedFile[] = acceptedFiles.map((file) => ({
        id: crypto.randomUUID(),
        file,
        fileType: "ARTWORK" as const,
        size: file.size,
        status: "pending" as const,
      }));

      const updatedFiles = [...queuedFiles, ...newQueuedFiles];
      onQueueChange(updatedFiles);

      // Auto-select first file if nothing selected
      if (selectedValue === null && updatedFiles.length > 0 && !isSkipped) {
        onSelect(updatedFiles[0].id, "queued");
      }
    },
    [queuedFiles, onQueueChange, selectedValue, isSkipped, onSelect]
  );

  /**
   * Removes a file from the queue.
   * If the removed file was selected, selects the next available file.
   */
  const handleRemoveFile = useCallback(
    (fileId: string) => {
      if (!onQueueChange) return;

      const updatedFiles = queuedFiles.filter((f) => f.id !== fileId);
      onQueueChange(updatedFiles);

      // If removed file was selected, select next file or clear
      if (selectedValue === fileId) {
        if (updatedFiles.length > 0) {
          onSelect(updatedFiles[0].id, "queued");
        } else {
          onSelect(null, "queued");
        }
      }
    },
    [queuedFiles, onQueueChange, selectedValue, onSelect]
  );

  /**
   * Handles selecting a queued file thumbnail.
   * Toggles selection off if already selected.
   */
  const handleQueuedSelect = useCallback(
    (fileId: string) => {
      if (disabled || isSkipped) return;

      // Toggle off if already selected
      if (selectedValue === fileId) {
        onSelect(null, "queued");
      } else {
        onSelect(fileId, "queued");
      }
    },
    [disabled, isSkipped, selectedValue, onSelect]
  );

  // Calculate total size for display
  const totalSize = useMemo(() => {
    return queuedFiles.reduce((sum, f) => sum + f.size, 0);
  }, [queuedFiles]);

  return {
    handleFileDrop,
    handleRemoveFile,
    handleQueuedSelect,
    totalSize,
  };
}
