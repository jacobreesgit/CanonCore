"use client";

import { useTransition, useCallback } from "react";
import { toast } from "sonner";
import { initiateGoogleDriveOAuth } from "@/lib/google-drive-actions";

/**
 * Shared hook for initiating Google Drive OAuth reconnection.
 * Used by SiteHeader (desktop) and MobileNavProvider (mobile).
 */
export function useGoogleDriveReconnect() {
  const [isReconnecting, startReconnectTransition] = useTransition();

  const handleReconnect = useCallback(() => {
    startReconnectTransition(async () => {
      const result = await initiateGoogleDriveOAuth();
      if (result.success && result.url) {
        window.location.href = result.url;
      } else {
        toast.error(result.error || "Failed to start reconnection");
      }
    });
  }, []);

  return { isReconnecting, handleReconnect };
}
