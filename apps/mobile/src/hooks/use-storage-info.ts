import { useState, useEffect, useCallback } from "react";
import { useDownloadDAO } from "@/components/providers/database-provider";
import { formatBytes } from "@/lib/format-bytes";

/** Default storage limit: 5GB in bytes */
const DEFAULT_STORAGE_LIMIT = 5 * 1024 * 1024 * 1024;

interface UseStorageInfoResult {
  /** Total bytes used by completed downloads */
  usedBytes: number;
  /** User-configured storage limit in bytes */
  limitBytes: number;
  /** Usage as 0-1 fraction */
  usageRatio: number;
  /** Human-readable used string (e.g. "2.3 GB") */
  usedFormatted: string;
  /** Human-readable limit string (e.g. "5.0 GB") */
  limitFormatted: string;
  /** Refresh storage info from database */
  refresh: () => Promise<void>;
}

/**
 * Hook for storage usage information.
 * Reads total downloaded bytes from the database.
 */
export function useStorageInfo(): UseStorageInfoResult {
  const dao = useDownloadDAO();
  const [usedBytes, setUsedBytes] = useState(0);
  const limitBytes = DEFAULT_STORAGE_LIMIT;

  const refresh = useCallback(async () => {
    const total = await dao.getTotalDownloadedBytes();
    setUsedBytes(total);
  }, [dao]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    usedBytes,
    limitBytes,
    usageRatio: limitBytes > 0 ? usedBytes / limitBytes : 0,
    usedFormatted: formatBytes(usedBytes),
    limitFormatted: formatBytes(limitBytes),
    refresh,
  };
}
