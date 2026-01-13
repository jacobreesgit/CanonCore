/**
 * Client component that shows toast notifications for OAuth results.
 * Reads drive/existing/error from URL search params and handles auto-sync.
 */

"use client";

import { useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { syncFromGoogleDrive } from "@/lib/google-drive-sync";

/**
 * Shows toast for OAuth callback results and triggers auto-sync for existing folders.
 * Uses two-phase toast: loading during sync, then success/error with results.
 * Cleans up URL params after handling.
 */
export function OAuthToast() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const hasHandled = useRef(false);

  useEffect(() => {
    // Prevent double-handling in strict mode
    if (hasHandled.current) return;

    const driveStatus = searchParams.get("drive");
    const hasExisting = searchParams.get("existing") === "true";
    const error = searchParams.get("error");

    if (driveStatus === "connected") {
      hasHandled.current = true;

      if (hasExisting) {
        // Two-phase toast for existing folder with auto-sync
        const toastId = toast.loading(
          "Connected to Google Drive. Syncing existing content..."
        );

        syncFromGoogleDrive()
          .then((result) => {
            if (result.success) {
              const total =
                (result.itemsCreated || 0) + (result.itemsUpdated || 0);
              if (total > 0) {
                const itemWord = total === 1 ? "item" : "items";
                toast.success(
                  `Imported ${total} ${itemWord} from existing folder.`,
                  { id: toastId }
                );
              } else {
                toast.success("Connected to Google Drive.", { id: toastId });
              }
            } else {
              // User-friendly messages for root folder errors
              if (result.error === "ROOT_FOLDER_TRASHED") {
                toast.error(
                  "Connected, but CanonCore folder is in Trash. Check settings to restore.",
                  { id: toastId }
                );
              } else if (result.error === "ROOT_FOLDER_DELETED") {
                toast.error(
                  "Connected, but CanonCore folder was deleted. Reconnect in settings.",
                  { id: toastId }
                );
              } else {
                toast.error(`Connected, but sync failed: ${result.error}`, {
                  id: toastId,
                });
              }
            }
          })
          .catch(() => {
            toast.error("Connected, but sync failed unexpectedly.", {
              id: toastId,
            });
          });
      } else {
        // New folder, no sync needed
        toast.success("Connected to Google Drive.");
      }

      // Clean up URL
      router.replace("/my-items", { scroll: false });
    } else if (error) {
      hasHandled.current = true;
      toast.error(`Connection failed: ${error}`);
      // Clean up URL
      router.replace("/my-items", { scroll: false });
    }
  }, [searchParams, router]);

  return null;
}
