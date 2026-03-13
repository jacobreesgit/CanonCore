import { useState, useEffect, useCallback } from "react";
import { useDownloadDAO } from "@/components/providers/database-provider";
import { useDownloadManager } from "@/components/providers/download-manager-provider";
import type { DownloadRecord, DownloadStatus } from "@/db/schema";

interface UseDownloadsResult {
  /** All downloads, sorted by status (active first) then date */
  downloads: DownloadRecord[];
  /** Whether we're loading the initial list */
  isLoading: boolean;
  /** Refresh the list from database */
  refresh: () => Promise<void>;
  /** Remove all downloads */
  removeAll: () => Promise<void>;
}

/**
 * Hook for the downloads list screen.
 * Provides the full download list with live progress updates.
 */
export function useDownloads(): UseDownloadsResult {
  const dao = useDownloadDAO();
  const manager = useDownloadManager();
  const [downloads, setDownloads] = useState<DownloadRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    const all = await dao.getAll();
    setDownloads(all);
    setIsLoading(false);
  }, [dao]);

  // Load on mount
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Subscribe to progress events — update the matching item in the list
  useEffect(() => {
    const unsubscribe = manager.addProgressListener((progress) => {
      if (progress.status === "removed") {
        setDownloads((prev) =>
          prev.filter((d) => d.fileId !== progress.fileId)
        );
        return;
      }

      setDownloads((prev) =>
        prev.map((d) =>
          d.fileId === progress.fileId
            ? {
                ...d,
                bytesDownloaded: progress.bytesDownloaded,
                totalBytes: progress.totalBytes,
                status: progress.status as DownloadStatus,
              }
            : d
        )
      );

      // Refresh full list on completion/failure for accurate ordering
      if (progress.status === "complete" || progress.status === "failed") {
        refresh();
      }
    });

    return unsubscribe;
  }, [manager, refresh]);

  const removeAll = useCallback(async () => {
    await manager.removeAll();
    setDownloads([]);
  }, [manager]);

  return { downloads, isLoading, refresh, removeAll };
}
