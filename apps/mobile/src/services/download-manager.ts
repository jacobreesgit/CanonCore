import * as FileSystem from "expo-file-system";
import { DownloadDAO, type CreateDownloadInput } from "@/db/download-dao";
import type { DownloadRecord, DownloadStatus } from "@/db/schema";
import { getStreamUrl } from "@/lib/image-url";
import { getToken } from "@/lib/auth";

/** Download progress event. "removed" is a transient event-only status (never persisted). */
export interface DownloadProgress {
  fileId: string;
  bytesDownloaded: number;
  totalBytes: number;
  status: DownloadStatus | "removed";
}

type ProgressCallback = (progress: DownloadProgress) => void;

const DOWNLOADS_DIR = `${FileSystem.documentDirectory}downloads/`;

/** Default storage limit: 5GB */
const DEFAULT_STORAGE_LIMIT = 5 * 1024 * 1024 * 1024;

/**
 * Manages the download queue and file I/O.
 * - One active download at a time (FIFO)
 * - Reports progress via callbacks
 * - Stores files in documentDirectory/downloads/
 * - Uses createDownloadResumable for streaming to disk (no OOM)
 * - Handles resume after app restart
 */
export class DownloadManager {
  private dao: DownloadDAO;
  private isProcessing = false;
  private listeners: Set<ProgressCallback> = new Set();
  private currentResumable: FileSystem.DownloadResumable | null = null;
  private cancelledFileIds = new Set<string>();
  private storageLimitBytes = DEFAULT_STORAGE_LIMIT;

  constructor(dao: DownloadDAO) {
    this.dao = dao;
  }

  /** Ensure the downloads directory exists. */
  private async ensureDirectory(): Promise<void> {
    const info = await FileSystem.getInfoAsync(DOWNLOADS_DIR);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(DOWNLOADS_DIR, {
        intermediates: true,
      });
    }
  }

  /** Subscribe to download progress events. Returns unsubscribe function. */
  addProgressListener(callback: ProgressCallback): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notifyListeners(progress: DownloadProgress): void {
    for (const listener of this.listeners) {
      listener(progress);
    }
  }

  /**
   * Queue a file for download.
   * If the file is already downloaded or queued, returns the existing record.
   */
  async enqueue(input: CreateDownloadInput): Promise<DownloadRecord> {
    const existing = await this.dao.getByFileId(input.fileId);
    if (existing) {
      if (existing.status === "failed") {
        await this.dao.updateStatus(input.fileId, "queued");
        this.processQueue();
        return { ...existing, status: "queued" };
      }
      return existing;
    }

    const record = await this.dao.create(input);
    this.processQueue();
    return record;
  }

  /**
   * Cancel and remove a download.
   * Aborts active download if it's the current one, deletes local file.
   */
  async remove(fileId: string): Promise<void> {
    const record = await this.dao.getByFileId(fileId);
    if (!record) return;

    // Abort if currently downloading
    if (record.status === "downloading" && this.currentResumable) {
      this.cancelledFileIds.add(fileId);
      try {
        await this.currentResumable.pauseAsync();
      } catch {
        // May fail if already completed
      }
      this.currentResumable = null;
    }

    // Delete local file if it exists
    if (record.localPath) {
      try {
        const info = await FileSystem.getInfoAsync(record.localPath);
        if (info.exists) {
          await FileSystem.deleteAsync(record.localPath, { idempotent: true });
        }
      } catch {
        // File may already be deleted
      }
    }

    await this.dao.delete(fileId);

    this.notifyListeners({
      fileId,
      bytesDownloaded: 0,
      totalBytes: 0,
      status: "removed",
    });

    // Kick the queue if the removed item was queued (not actively downloading)
    if (record.status === "queued") {
      this.processQueue();
    }
  }

  /** Remove all downloads and delete all local files. */
  async removeAll(): Promise<void> {
    // Abort current download
    if (this.currentResumable) {
      try {
        await this.currentResumable.pauseAsync();
      } catch {
        // Ignore
      }
      this.currentResumable = null;
    }
    this.isProcessing = false;

    // Delete all local files
    try {
      const info = await FileSystem.getInfoAsync(DOWNLOADS_DIR);
      if (info.exists) {
        await FileSystem.deleteAsync(DOWNLOADS_DIR, { idempotent: true });
        await FileSystem.makeDirectoryAsync(DOWNLOADS_DIR, {
          intermediates: true,
        });
      }
    } catch {
      // Best effort
    }

    await this.dao.deleteAll();
  }

  /** Get local file path for a completed download. Returns null if not downloaded. */
  async getLocalPath(fileId: string): Promise<string | null> {
    const record = await this.dao.getByFileId(fileId);
    if (!record || record.status !== "complete" || !record.localPath) {
      return null;
    }

    // Verify file still exists on disk
    const info = await FileSystem.getInfoAsync(record.localPath);
    if (!info.exists) {
      await this.dao.delete(fileId);
      return null;
    }

    return record.localPath;
  }

  /** Mark a download as played (updates LRU timestamp). */
  async markPlayed(fileId: string): Promise<void> {
    await this.dao.touchLastPlayed(fileId);
  }

  /**
   * Evict LRU downloads to make space for a new download.
   * Removes the oldest unwatched completed downloads until
   * enough space is available.
   */
  private async evictIfNeeded(neededBytes: number): Promise<void> {
    const usedBytes = await this.dao.getTotalDownloadedBytes();

    if (usedBytes + neededBytes <= this.storageLimitBytes) {
      return;
    }

    const candidates = await this.dao.getCompletedLRU();
    let freedBytes = 0;
    const bytesToFree = usedBytes + neededBytes - this.storageLimitBytes;

    for (const candidate of candidates) {
      if (freedBytes >= bytesToFree) break;

      // Delete local file
      if (candidate.localPath) {
        try {
          await FileSystem.deleteAsync(candidate.localPath, {
            idempotent: true,
          });
        } catch {
          // Best effort
        }
      }

      await this.dao.delete(candidate.fileId);
      freedBytes += candidate.totalBytes;

      this.notifyListeners({
        fileId: candidate.fileId,
        bytesDownloaded: 0,
        totalBytes: 0,
        status: "removed",
      });
    }
  }

  /**
   * Process the download queue. Picks the next queued item and downloads it.
   * Only one download runs at a time.
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      while (true) {
        const next = await this.dao.getNextQueued();
        if (!next) break;

        await this.downloadFile(next);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Download a single file to local storage.
   *
   * Uses createDownloadResumable from expo-file-system which:
   * - Streams directly to disk (no OOM for large files)
   * - Supports custom headers (Authorization: Bearer)
   * - Reports incremental progress via callback
   * - Can be paused/cancelled
   */
  private async downloadFile(record: DownloadRecord): Promise<void> {
    await this.ensureDirectory();

    // Evict old downloads if needed
    await this.evictIfNeeded(record.totalBytes);

    // Mark as downloading
    await this.dao.updateStatus(record.fileId, "downloading");
    this.notifyListeners({
      fileId: record.fileId,
      bytesDownloaded: 0,
      totalBytes: record.totalBytes,
      status: "downloading",
    });

    try {
      const url = getStreamUrl(record.fileId);
      const token = await getToken();

      // Generate a unique local filename using fileId
      const extension = record.filename.split(".").pop() ?? "bin";
      const localFilename = `${record.fileId}.${extension}`;
      const targetPath = `${DOWNLOADS_DIR}${localFilename}`;

      // Use createDownloadResumable for streaming to disk with progress
      const resumable = FileSystem.createDownloadResumable(
        url,
        targetPath,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        },
        (downloadProgress) => {
          // Report progress to listeners
          this.dao
            .updateProgress(
              record.fileId,
              downloadProgress.totalBytesWritten,
              downloadProgress.totalBytesExpectedToWrite
            )
            .catch(() => {
              // Non-critical — UI will still get the callback
            });

          this.notifyListeners({
            fileId: record.fileId,
            bytesDownloaded: downloadProgress.totalBytesWritten,
            totalBytes: downloadProgress.totalBytesExpectedToWrite,
            status: "downloading",
          });
        }
      );

      this.currentResumable = resumable;

      const result = await resumable.downloadAsync();

      // Check if cancelled via remove()
      if (this.cancelledFileIds.has(record.fileId)) {
        this.cancelledFileIds.delete(record.fileId);
        // Clean up partial file
        try {
          await FileSystem.deleteAsync(targetPath, { idempotent: true });
        } catch {
          // Ignore
        }
        return;
      }

      if (!result || result.status !== 200) {
        throw new Error(
          `Download failed: HTTP ${result?.status ?? "unknown"}`
        );
      }

      // Get actual file size from disk
      const fileInfo = await FileSystem.getInfoAsync(targetPath);
      const fileSize =
        fileInfo.exists && "size" in fileInfo ? fileInfo.size : record.totalBytes;

      // Mark complete in DB
      await this.dao.updateProgress(record.fileId, fileSize, fileSize);
      await this.dao.markComplete(record.fileId, targetPath);

      this.notifyListeners({
        fileId: record.fileId,
        bytesDownloaded: fileSize,
        totalBytes: fileSize,
        status: "complete",
      });
    } catch (error) {
      // Check if cancelled
      if (this.cancelledFileIds.has(record.fileId)) {
        this.cancelledFileIds.delete(record.fileId);
        return;
      }

      // Mark as failed
      await this.dao.updateStatus(record.fileId, "failed");
      this.notifyListeners({
        fileId: record.fileId,
        bytesDownloaded: record.bytesDownloaded,
        totalBytes: record.totalBytes,
        status: "failed",
      });
    } finally {
      this.currentResumable = null;
    }
  }

  /**
   * Resume processing on app start.
   * Resets any "downloading" records back to "queued" (download was interrupted).
   */
  async resumeOnStart(): Promise<void> {
    await this.dao.resetInterrupted();
    this.processQueue();
  }
}
