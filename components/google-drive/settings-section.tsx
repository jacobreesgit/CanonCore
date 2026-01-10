/**
 * Google Drive settings section for the Settings dialog.
 * Handles connect, sync, and disconnect actions.
 */

"use client";

import { useTransition } from "react";
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
  Cloud,
  Trash2,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  Link2,
} from "lucide-react";
import {
  initiateGoogleDriveOAuth,
  disconnectGoogleDrive,
} from "@/lib/google-drive-actions";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

/**
 * Google Drive connection data structure.
 */
interface GoogleDriveConnection {
  email: string;
  isActive: boolean;
  needsReauth: boolean;
  lastSyncAt: Date | null;
  lastError: string | null;
}

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

  /**
   * Initiates the Google Drive OAuth flow.
   */
  function handleConnect() {
    startConnectTransition(async () => {
      const result = await initiateGoogleDriveOAuth();

      if (result.success && result.url) {
        window.location.href = result.url;
      } else {
        toast.error(result.error || "Failed to start connection");
      }
    });
  }

  /**
   * Disconnects the Google Drive connection.
   */
  function handleDisconnect() {
    startDisconnectTransition(async () => {
      const result = await disconnectGoogleDrive();

      if (result.success) {
        toast.success("Google Drive disconnected");
        onConnectionChange?.();
      } else {
        toast.error(result.error || "Failed to disconnect");
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div
          className={cn(
            "flex size-7 items-center justify-center rounded-lg",
            "bg-primary/10"
          )}
        >
          <Cloud className="text-primary size-3.5" />
        </div>
        <Label className="text-sm font-medium">Google Drive</Label>
      </div>

      {connection ? (
        <div className="space-y-3">
          {/* Connection status with disconnect button */}
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{connection.email}</span>
                {connection.needsReauth ? (
                  <Badge variant="destructive" className="text-xs">
                    <AlertTriangle className="mr-1 size-3" />
                    Reconnect
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs">
                    <CheckCircle2 className="mr-1 size-3" />
                    Connected
                  </Badge>
                )}
              </div>
              {connection.lastSyncAt && (
                <p className="text-muted-foreground text-xs">
                  Last synced{" "}
                  {formatDistanceToNow(connection.lastSyncAt, {
                    addSuffix: true,
                  })}
                </p>
              )}
              {connection.lastError && (
                <p className="text-destructive text-xs">
                  {connection.lastError}
                </p>
              )}
            </div>

            {/* Disconnect button */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  size="icon"
                  disabled={isDisconnecting}
                  className="size-8"
                >
                  {isDisconnecting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Trash2 className="size-4" />
                  )}
                  <span className="sr-only">Disconnect</span>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Disconnect Google Drive?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will remove access to your Google Drive and delete all
                    synced items. Your files will remain in Google Drive.
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

          {/* Reconnect button - only when reauth needed */}
          {connection.needsReauth && (
            <Button
              variant="default"
              size="sm"
              onClick={handleConnect}
              disabled={isConnecting}
            >
              {isConnecting ? (
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
              ) : (
                <Link2 className="mr-1.5 size-3.5" />
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
              <Loader2 className="mr-1.5 size-3.5 animate-spin" />
            ) : (
              <Cloud className="mr-1.5 size-3.5" />
            )}
            Connect Google Drive
          </Button>
        </div>
      )}
    </div>
  );
}
