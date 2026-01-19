/**
 * Client-side utilities for direct browser-to-Google-Drive uploads.
 * Uses XMLHttpRequest for progress tracking and resumable upload protocol.
 */

/**
 * Upload state for tracking batch upload progress.
 */
export interface UploadState {
  status: "idle" | "uploading" | "error";
  files: UploadFileState[];
  successCount: number;
  errorCount: number;
}

/**
 * Individual file upload state.
 */
export interface UploadFileState {
  name: string;
  progress: number; // 0-100
  status: "pending" | "uploading" | "success" | "error";
  error?: string;
  /** Bytes uploaded so far */
  loaded?: number;
  /** Total file size in bytes */
  total?: number;
}

/**
 * Creates an initial upload state for a batch of files.
 *
 * @param fileNames - Names of files to upload
 * @returns Initial upload state
 */
export function createInitialUploadState(fileNames: string[]): UploadState {
  return {
    status: "idle",
    files: fileNames.map((name) => ({
      name,
      progress: 0,
      status: "pending",
    })),
    successCount: 0,
    errorCount: 0,
  };
}

/**
 * Result of a single file upload.
 */
export interface UploadResult {
  success: boolean;
  driveFileId?: string;
  error?: string;
}

/**
 * Progress info passed to upload callback.
 * Contains upload metrics for tracking transfer progress.
 */
export interface UploadProgress {
  /** Upload completion percentage (0-100) */
  percent: number;
  /** Bytes uploaded so far */
  loaded: number;
  /** Total file size in bytes */
  total: number;
}

/**
 * Uploads a file directly to Google Drive using a resumable upload URL.
 * Uses XMLHttpRequest for progress tracking.
 *
 * @param url - Resumable upload URL from Google Drive
 * @param file - File to upload
 * @param onProgress - Progress callback with percent, loaded, and total bytes
 * @param abortSignal - Optional signal for cancellation
 * @returns Upload result with Drive file ID
 */
export function uploadWithProgress(
  url: string,
  file: File,
  onProgress: (progress: UploadProgress) => void,
  abortSignal?: AbortSignal
): Promise<UploadResult> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();

    // Handle abort signal for cancellation
    if (abortSignal) {
      abortSignal.addEventListener("abort", () => {
        xhr.abort();
        resolve({ success: false, error: "Upload cancelled" });
      });
    }

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress({
          percent: Math.round((e.loaded / e.total) * 100),
          loaded: e.loaded,
          total: e.total,
        });
      }
    };

    xhr.onload = () => {
      // Google returns 200 or 201 for successful uploads
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText);
          resolve({ success: true, driveFileId: response.id });
        } catch {
          resolve({
            success: false,
            error:
              "Upload completed but verification failed. Please check your Drive.",
          });
        }
      } else if (xhr.status === 401 || xhr.status === 403) {
        resolve({
          success: false,
          error: "Permission denied. Please reconnect your Google Drive.",
        });
      } else if (xhr.status === 404) {
        resolve({
          success: false,
          error: "Upload destination not found. Please try again.",
        });
      } else if (xhr.status >= 500) {
        resolve({
          success: false,
          error:
            "Google Drive is temporarily unavailable. Please try again later.",
        });
      } else {
        resolve({
          success: false,
          error: `Upload failed (${xhr.status}). Please try again.`,
        });
      }
    };

    xhr.onerror = () => {
      resolve({
        success: false,
        error: "Network error. Please check your connection and try again.",
      });
    };

    xhr.onabort = () => {
      resolve({ success: false, error: "Upload cancelled" });
    };

    xhr.open("PUT", url);
    xhr.setRequestHeader(
      "Content-Type",
      file.type || "application/octet-stream"
    );
    xhr.send(file);
  });
}

/**
 * Session info for a single file upload.
 */
export interface UploadSession {
  fileName: string;
  uploadUrl: string;
  sessionToken: string;
}

/**
 * Batch upload manager for concurrent uploads with progress tracking.
 * Uploads files in parallel with configurable concurrency.
 */
export class BatchUploadManager {
  private maxConcurrent: number;
  private sessions: UploadSession[];
  private files: File[];
  private onStateChange: (state: UploadState) => void;
  private confirmUpload: (
    sessionToken: string,
    driveFileId: string
  ) => Promise<{ success: boolean; error?: string }>;
  private state: UploadState;
  private abortController: AbortController | null = null;

  /**
   * Creates a batch upload manager.
   *
   * @param sessions - Upload sessions from server
   * @param files - Files to upload (must match sessions order)
   * @param onStateChange - Callback when state changes
   * @param confirmUpload - Server action to confirm upload
   * @param maxConcurrent - Max concurrent uploads (default 3)
   */
  constructor(
    sessions: UploadSession[],
    files: File[],
    onStateChange: (state: UploadState) => void,
    confirmUpload: (
      sessionToken: string,
      driveFileId: string
    ) => Promise<{ success: boolean; error?: string }>,
    maxConcurrent = 3
  ) {
    this.sessions = sessions;
    this.files = files;
    this.onStateChange = onStateChange;
    this.confirmUpload = confirmUpload;
    this.maxConcurrent = maxConcurrent;
    this.state = createInitialUploadState(files.map((f) => f.name));
  }

  /**
   * Starts the batch upload process.
   * Uploads files in parallel with max concurrency.
   *
   * @returns Final upload state
   */
  async start(): Promise<UploadState> {
    this.abortController = new AbortController();
    this.updateState({ status: "uploading" });

    // Create upload tasks
    const tasks = this.sessions.map((session, index) => ({
      session,
      file: this.files[index],
      index,
    }));

    // Process with concurrency limit
    const results = await this.processWithConcurrency(
      tasks,
      this.maxConcurrent,
      async (task) => {
        return this.uploadFile(task.session, task.file, task.index);
      }
    );

    // Calculate final state
    const successCount = results.filter((r) => r).length;
    const errorCount = results.length - successCount;

    this.updateState({
      status: errorCount > 0 ? "error" : "idle",
      successCount,
      errorCount,
    });

    return this.state;
  }

  /**
   * Cancels all pending uploads.
   */
  cancel(): void {
    this.abortController?.abort();
  }

  /**
   * Uploads a single file and confirms with server.
   */
  private async uploadFile(
    session: UploadSession,
    file: File,
    index: number
  ): Promise<boolean> {
    this.updateFileState(index, {
      status: "uploading",
      progress: 0,
      loaded: 0,
      total: file.size,
    });

    const result = await uploadWithProgress(
      session.uploadUrl,
      file,
      (progress) =>
        this.updateFileState(index, {
          progress: progress.percent,
          loaded: progress.loaded,
          total: progress.total,
        }),
      this.abortController?.signal
    );

    if (!result.success || !result.driveFileId) {
      this.updateFileState(index, {
        status: "error",
        error: result.error || "Upload failed",
      });
      return false;
    }

    // Confirm upload with server
    const confirmResult = await this.confirmUpload(
      session.sessionToken,
      result.driveFileId
    );

    if (!confirmResult.success) {
      this.updateFileState(index, {
        status: "error",
        error: confirmResult.error || "Failed to confirm upload",
      });
      return false;
    }

    this.updateFileState(index, { status: "success", progress: 100 });
    return true;
  }

  /**
   * Processes tasks with concurrency limit using sliding window pattern.
   * Maintains exactly `concurrency` active tasks at any time.
   */
  private async processWithConcurrency<T, R>(
    items: T[],
    concurrency: number,
    processor: (item: T) => Promise<R>
  ): Promise<R[]> {
    const results: R[] = new Array(items.length);
    const executing = new Set<Promise<void>>();

    for (let i = 0; i < items.length; i++) {
      const index = i;
      const promise = processor(items[index]).then((result) => {
        results[index] = result;
        executing.delete(promise);
      });

      executing.add(promise);

      // When at capacity, wait for one to complete before starting next
      if (executing.size >= concurrency) {
        await Promise.race(executing);
      }
    }

    // Wait for remaining tasks to complete
    await Promise.all(executing);
    return results;
  }

  /**
   * Updates overall state and notifies listener.
   */
  private updateState(partial: Partial<UploadState>): void {
    this.state = { ...this.state, ...partial };
    this.onStateChange(this.state);
  }

  /**
   * Updates a single file's state and notifies listener.
   */
  private updateFileState(
    index: number,
    partial: Partial<UploadFileState>
  ): void {
    this.state = {
      ...this.state,
      files: this.state.files.map((f, i) =>
        i === index ? { ...f, ...partial } : f
      ),
    };
    this.onStateChange(this.state);
  }
}

/** Cached number formatters for locale-aware byte formatting */
const byteDecimalFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 1,
});

const byteWholeFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 0,
});

/**
 * Formats bytes into human-readable string (e.g., "1.5 MB").
 * Uses Intl.NumberFormat for locale-aware number formatting.
 * Shows one decimal place for non-whole numbers, none for whole numbers.
 *
 * @param bytes - Number of bytes (must be non-negative)
 * @returns Formatted string with appropriate unit
 *
 * @example
 * formatBytes(1024) // "1 KB"
 * formatBytes(1536) // "1.5 KB"
 * formatBytes(1048576) // "1 MB"
 */
export function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  );
  const value = bytes / Math.pow(1024, i);
  // Show decimal only for non-whole numbers (KB+), none for bytes or whole values
  const isWholeNumber = value % 1 === 0;
  const formatted =
    i >= 1 && !isWholeNumber
      ? byteDecimalFormatter.format(value)
      : byteWholeFormatter.format(Math.round(value));
  return `${formatted} ${units[i]}`;
}

/**
 * File type accept filters for file picker.
 */
export const FILE_ACCEPT_FILTERS = {
  media: "video/*,audio/*",
  artwork: "image/*",
  subtitle: ".srt,.vtt,.sub,.ass",
} as const;

/**
 * Gets the accept filter for a file type.
 *
 * @param fileType - The file type category
 * @returns Accept attribute value for file input
 */
export function getAcceptFilter(
  fileType: "media" | "artwork" | "subtitle"
): string {
  return FILE_ACCEPT_FILTERS[fileType];
}
