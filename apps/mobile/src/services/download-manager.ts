import { File, Directory, Paths } from "expo-file-system";
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

const DOWNLOADS_DIR_NAME = "downloads";

/** Default storage limit: 5GB */
const DEFAULT_STORAGE_LIMIT = 5 * 1024 * 1024 * 1024;

/**
 * Manages the download queue and file I/O.
 * - One active download at a time (FIFO)
 * - Reports progress via callbacks
 * - Stores files in documentDirectory/downloads/
 * - Uses File.downloadFileAsync for streaming to disk (no OOM)
 * - Handles resume after app restart
 */
export class DownloadManager {
  private dao: DownloadDAO;
  private isProcessing = false;
  private listeners: Set<ProgressCallback> = new Set();
  private cancelledFileIds = new Set<string>();
  private storageLimitBytes = DEFAULT_STORAGE_LIMIT;
  private downloadsDir: Directory;

  constructor(dao: DownloadDAO) {
    this.dao = dao;
    this.downloadsDir = new Directory(Paths.document, DOWNLOADS_DIR_NAME);
  }

  /** Ensure the downloads directory exists. */
  private ensureDirectory(): void {
    if (!this.downloadsDir.exists) {
      this.downloadsDir.create({ intermediates: true });
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
   * Marks active download as cancelled; deletes local file.
   */
  async remove(fileId: string): Promise<void> {
    const record = await this.dao.getByFileId(fileId);
    if (!record) return;

    // Mark as cancelled if currently downloading
    if (record.status === "downloading") {
      this.cancelledFileIds.add(fileId);
    }

    // Delete local file if it exists
    if (record.localPath) {
      try {
        const file = new File(record.localPath);
        if (file.exists) {
          file.delete();
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
    this.isProcessing = false;

    // Delete the entire downloads directory and recreate it
    try {
      if (this.downloadsDir.exists) {
        this.downloadsDir.delete();
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
    const file = new File(record.localPath);
    if (!file.exists) {
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
          const file = new File(candidate.localPath);
          if (file.exists) {
            file.delete();
          }
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
   * Uses File.downloadFileAsync from expo-file-system v19 which:
   * - Streams directly to disk (no OOM for large files)
   * - Supports custom headers (Authorization: Bearer)
   * - On iOS: atomic (temp file moved on success)
   * - On Android: streams directly to target
   */
  private async downloadFile(record: DownloadRecord): Promise<void> {
    this.ensureDirectory();

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
      const targetFile = new File(this.downloadsDir, localFilename);

      // Download using File.downloadFileAsync (streams to disk, no OOM)
      const downloaded = await File.downloadFileAsync(url, targetFile, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        idempotent: true,
      });

      // Check if cancelled via remove() during download
      if (this.cancelledFileIds.has(record.fileId)) {
        this.cancelledFileIds.delete(record.fileId);
        // Clean up downloaded file
        try {
          if (downloaded.exists) {
            downloaded.delete();
          }
        } catch {
          // Ignore
        }
        return;
      }

      // Get actual file size from disk
      const fileSize = downloaded.size || record.totalBytes;

      // Mark complete in DB
      await this.dao.updateProgress(record.fileId, fileSize, fileSize);
      await this.dao.markComplete(record.fileId, downloaded.uri);

      this.notifyListeners({
        fileId: record.fileId,
        bytesDownloaded: fileSize,
        totalBytes: fileSize,
        status: "complete",
      });
    } catch {
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
