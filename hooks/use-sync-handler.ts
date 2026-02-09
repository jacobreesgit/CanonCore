/**
 * Hook for Google Drive sync with standardised toast feedback.
 * Encapsulates sync state, error handling, and success/failure messages.
 */

"use client";

import { useCallback, useTransition } from "react";
import { syncFromGoogleDrive } from "@/lib/google-drive-sync";
import { toast } from "sonner";

interface UseSyncHandlerOptions {
  /** Called after a successful sync (e.g., to refresh data). */
  onSuccess?: () => void;
}

/**
 * Provides a sync handler with transition state and toast messages.
 *
 * @param options.onSuccess - Callback after successful sync
 * @returns isSyncing state and handleSync trigger
 */
export function useSyncHandler({ onSuccess }: UseSyncHandlerOptions = {}) {
  const [isSyncing, startSyncTransition] = useTransition();

  const handleSync = useCallback(() => {
    startSyncTransition(async () => {
      const result = await syncFromGoogleDrive();

      if (result.success) {
        const parts = [];
        if (result.itemsCreated) parts.push(`${result.itemsCreated} created`);
        if (result.itemsUpdated) parts.push(`${result.itemsUpdated} updated`);
        if (result.itemsErrored) parts.push(`${result.itemsErrored} failed`);

        const message =
          parts.length > 0 ? parts.join(", ") : "Already up to date";
        toast.success(`Sync complete: ${message}`);
        onSuccess?.();
      } else {
        if (result.error === "ROOT_FOLDER_TRASHED") {
          toast.error(
            "Sync paused: CanonCore folder is in Trash. Check settings to restore."
          );
        } else if (result.error === "ROOT_FOLDER_DELETED") {
          toast.error(
            "Sync paused: CanonCore folder was deleted. Reconnect in settings."
          );
        } else {
          toast.error(result.error || "Sync failed");
        }
      }
    });
  }, [onSuccess]);

  return { isSyncing, handleSync };
}
