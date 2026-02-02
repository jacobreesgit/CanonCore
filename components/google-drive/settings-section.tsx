/**
 * Google Drive settings section for the Settings dialog.
 * Handles connect, sync, and disconnect actions.
 */

"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Cloud,
  Trash2,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  Link2,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import {
  initiateGoogleDriveOAuth,
  disconnectGoogleDrive,
} from "@/lib/google-drive-actions";
import { syncFromGoogleDrive } from "@/lib/google-drive-sync";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { StorageBar } from "@/components/google-drive/storage-bar";
import type { GoogleDriveConnection } from "@/lib/types";

interface GoogleDriveSettingsSectionProps {
  /** The current Google Drive connection, or null if not connected */
  connection: GoogleDriveConnection | null;
  /** Callback when connection state changes */
  onConnectionChange?: () => void;
}

/**
 * Google Drive settings section component.
 * Displays connection status and provides connect/sync/disconnect actions.
 *
 * @param connection - Current connection or null
 * @param onConnectionChange - Called after connection state changes
 */
export function GoogleDriveSettingsSection({
  connection,
  onConnectionChange,
}: GoogleDriveSettingsSectionProps) {
  const [isConnecting, startConnectTransition] = useTransition();
  const [isDisconnecting, startDisconnectTransition] = useTransition();
  const [isSyncing, startSyncTransition] = useTransition();

  // Track client mount to prevent hydration mismatch with relative time
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // Standard pattern for detecting client-side mount to avoid hydration mismatch
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  /**
   * Initiates the Google Drive OAuth flow.
   */
  const handleConnect = useCallback(() => {
    startConnectTransition(async () => {
      const result = await initiateGoogleDriveOAuth();

      if (result.success && result.url) {
        window.location.href = result.url;
      } else {
        toast.error(result.error || "Failed to start connection");
      }
    });
  }, []);

  /**
   * Disconnects the Google Drive connection.
   */
  const handleDisconnect = useCallback(() => {
    startDisconnectTransition(async () => {
      const result = await disconnectGoogleDrive();

      if (result.success) {
        toast.success("Google Drive disconnected");
        onConnectionChange?.();
      } else {
        toast.error(result.error || "Failed to disconnect");
      }
    });
  }, [onConnectionChange]);

  /**
   * Triggers a sync from Google Drive.
   */
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
        onConnectionChange?.();
      } else {
        // User-friendly messages for root folder errors
        if (result.error === "ROOT_FOLDER_TRASHED") {
          toast.error(
            "Sync paused: CanonCore folder is in Trash. Restore it in Google Drive."
          );
        } else if (result.error === "ROOT_FOLDER_DELETED") {
          toast.error(
            "Sync paused: CanonCore folder was deleted. Disconnect and reconnect."
          );
        } else {
          toast.error(result.error || "Sync failed");
        }
        onConnectionChange?.();
      }
    });
  }, [onConnectionChange]);

  // Determine if sync should be disabled
  // Note: ROOT_FOLDER_TRASHED is NOT disabled - user can retry after restoring folder
  // ROOT_FOLDER_DELETED requires disconnect/reconnect, so stays disabled
  const syncDisabled =
    isSyncing ||
    connection?.needsReauth ||
    connection?.lastError === "ROOT_FOLDER_DELETED";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div
          className={cn(
            "flex size-7 items-center justify-center rounded-lg",
            "bg-primary/10"
          )}
        >
          <Cloud aria-hidden="true" className="text-primary size-3.5" />
        </div>
        <Label className="text-sm font-medium">Google Drive</Label>
      </div>

      {connection ? (
        <div className="space-y-3">
          {/* Connection card */}
          <div className="rounded-lg border">
            {/* Info section */}
            <div className="space-y-1.5 p-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className="min-w-0 truncate text-sm font-medium">
                  {connection.email}
                </span>
                {connection.needsReauth ? (
                  <Badge variant="destructive" className="shrink-0 text-xs">
                    <AlertTriangle aria-hidden="true" className="mr-1 size-3" />
                    Reconnect
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="shrink-0 text-xs">
                    <CheckCircle2 aria-hidden="true" className="mr-1 size-3" />
                    Connected
                  </Badge>
                )}
              </div>
              {connection.lastSyncAt && mounted && (
                <p className="text-muted-foreground text-xs">
                  Last synced{" "}
                  {formatDistanceToNow(connection.lastSyncAt, {
                    addSuffix: true,
                  })}
                </p>
              )}
              {/* Show generic errors (not ROOT_FOLDER_* which have dedicated UI) */}
              {connection.lastError &&
                !connection.lastError.startsWith("ROOT_FOLDER_") && (
                  <p className="text-destructive text-xs">
                    {connection.lastError}
                  </p>
                )}
            </div>

            {/* Storage section - always show, with disabled state when no data */}
            <div className="space-y-2 border-t p-3">
              <Label className="text-muted-foreground text-xs">Storage</Label>
              <StorageBar
                bytesUsed={connection.quotaBytesUsed}
                bytesTotal={connection.quotaBytesTotal}
              />
              <a
                href="https://one.google.com/storage"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary inline-flex items-center gap-1 text-xs hover:underline"
              >
                Manage Storage
                <ExternalLink aria-hidden="true" className="size-3" />
              </a>
            </div>

            {/* Action buttons row */}
            <div className="bg-muted/30 flex items-center gap-1 border-t px-2 py-1.5">
              {/* Sync button */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSync}
                    disabled={syncDisabled}
                    className="h-7 gap-1.5 px-2 text-xs"
                  >
                    {isSyncing ? (
                      <Loader2
                        aria-hidden="true"
                        className="size-3.5 animate-spin"
                      />
                    ) : (
                      <RefreshCw aria-hidden="true" className="size-3.5" />
                    )}
                    Sync
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>Sync with Google Drive</p>
                </TooltipContent>
              </Tooltip>

              {/* Open in Drive button - hide when folder is trashed/deleted */}
              {connection.rootFolderId &&
                connection.lastError !== "ROOT_FOLDER_TRASHED" &&
                connection.lastError !== "ROOT_FOLDER_DELETED" && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        asChild
                        className="h-7 gap-1.5 px-2 text-xs"
                      >
                        <a
                          href={`https://drive.google.com/drive/folders/${connection.rootFolderId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink
                            aria-hidden="true"
                            className="size-3.5"
                          />
                          Drive
                        </a>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <p>Open in Google Drive</p>
                    </TooltipContent>
                  </Tooltip>
                )}

              {/* Spacer */}
              <div className="flex-1" />

              {/* Disconnect button */}
              <AlertDialog>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isDisconnecting}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10 h-7 gap-1.5 px-2 text-xs"
                      >
                        {isDisconnecting ? (
                          <Loader2
                            aria-hidden="true"
                            className="size-3.5 animate-spin"
                          />
                        ) : (
                          <Trash2 aria-hidden="true" className="size-3.5" />
                        )}
                        Disconnect
                      </Button>
                    </AlertDialogTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>Disconnect Google Drive</p>
                  </TooltipContent>
                </Tooltip>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Disconnect Google Drive?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      This will remove access to your Google Drive and delete
                      all synced items. Your files will remain in Google Drive.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDisconnect}>
                      Disconnect
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>

          {/* Warning: Root folder is in Trash */}
          {connection.lastError === "ROOT_FOLDER_TRASHED" && (
            <div className="rounded-md border border-yellow-500/50 bg-yellow-500/10 p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle
                  aria-hidden="true"
                  className="mt-0.5 size-4 text-yellow-600 dark:text-yellow-500"
                />
                <div className="space-y-1.5">
                  <p className="text-sm font-medium">
                    CanonCore folder is in Trash
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Your CanonCore folder was moved to Google Drive&apos;s
                    Trash. Restore it, then click Sync to resume.
                  </p>
                  {connection.rootFolderId && (
                    <a
                      href={`https://drive.google.com/drive/folders/${connection.rootFolderId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:text-primary/80 inline-flex items-center gap-1.5 text-xs transition-colors"
                    >
                      <ExternalLink aria-hidden="true" className="size-3" />
                      Restore in Drive
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Warning: Root folder was permanently deleted */}
          {connection.lastError === "ROOT_FOLDER_DELETED" && (
            <div className="border-destructive/50 bg-destructive/10 rounded-md border p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle
                  aria-hidden="true"
                  className="text-destructive mt-0.5 size-4"
                />
                <div className="space-y-1">
                  <p className="text-sm font-medium">
                    CanonCore folder was deleted
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Your CanonCore folder was permanently deleted from Google
                    Drive. Disconnect and reconnect to create a new folder.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Reconnect button - only when reauth needed */}
          {connection.needsReauth && (
            <Button
              variant="default"
              size="sm"
              onClick={handleConnect}
              disabled={isConnecting}
            >
              {isConnecting ? (
                <Loader2
                  aria-hidden="true"
                  className="mr-1.5 size-3.5 animate-spin"
                />
              ) : (
                <Link2 aria-hidden="true" className="mr-1.5 size-3.5" />
              )}
              Reconnect
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-muted-foreground text-sm">
            Connect your Google Drive to sync your media library.
          </p>
          <Button onClick={handleConnect} disabled={isConnecting} size="sm">
            {isConnecting ? (
              <Loader2
                aria-hidden="true"
                className="mr-1.5 size-3.5 animate-spin"
              />
            ) : (
              <Cloud aria-hidden="true" className="mr-1.5 size-3.5" />
            )}
            Connect Google Drive
          </Button>
        </div>
      )}
    </div>
  );
}
