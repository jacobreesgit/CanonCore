import { useState, useEffect, useCallback } from "react";
import { useDownloadDAO } from "@/components/providers/database-provider";
import { useDownloadManager } from "@/components/providers/download-manager-provider";
import type { DownloadRecord, DownloadStatus } from "@/db/schema";
import type { CreateDownloadInput } from "@/db/download-dao";

interface UseDownloadResult {
  /** Current download record, or null if not downloaded/queued */
  download: DownloadRecord | null;
  /** Current status shorthand */
  status: DownloadStatus | "none";
  /** Whether the file is fully downloaded */
  isDownloaded: boolean;
  /** Whether a download is active or queued */
  isActive: boolean;
  /** Download progress as 0-1 fraction */
  progress: number;
  /** Start downloading this file */
  startDownload: (input: CreateDownloadInput) => Promise<void>;
  /** Cancel and remove this download */
  removeDownload: () => Promise<void>;
}

/**
 * Hook for managing a single file's download state.
 * Subscribes to progress events for real-time updates.
 */
export function useDownload(fileId: string): UseDownloadResult {
  const dao = useDownloadDAO();
  const manager = useDownloadManager();
  const [download, setDownload] = useState<DownloadRecord | null>(null);

  // Load initial state
  useEffect(() => {
    dao.getByFileId(fileId).then(setDownload);
  }, [fileId, dao]);

  // Subscribe to progress events
  useEffect(() => {
    const unsubscribe = manager.addProgressListener((progress) => {
      if (progress.fileId !== fileId) return;

      if (progress.status === "removed") {
        setDownload(null);
        return;
      }

      setDownload((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          bytesDownloaded: progress.bytesDownloaded,
          totalBytes: progress.totalBytes,
          status: progress.status as DownloadStatus,
        };
      });

      // Reload from DB on completion or failure for accurate data
      if (progress.status === "complete" || progress.status === "failed") {
        dao.getByFileId(fileId).then(setDownload);
      }
    });

    return unsubscribe;
  }, [fileId, manager, dao]);

  const startDownload = useCallback(
    async (input: CreateDownloadInput) => {
      const record = await manager.enqueue(input);
      setDownload(record);
    },
    [manager],
  );

  const removeDownload = useCallback(async () => {
    await manager.remove(fileId);
    setDownload(null);
  }, [fileId, manager]);

  const status: DownloadStatus | "none" = download?.status ?? "none";
  const isDownloaded = status === "complete";
  const isActive = status === "queued" || status === "downloading";
  const progress =
    download && download.totalBytes > 0
      ? download.bytesDownloaded / download.totalBytes
      : 0;

  return {
    download,
    status,
    isDownloaded,
    isActive,
    progress,
    startDownload,
    removeDownload,
  };
}
