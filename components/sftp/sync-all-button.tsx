/**
 * Sync All button component for triggering sync across all SFTP connections.
 * Features loading state animation and comprehensive result feedback.
 */

"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { syncAllConnections, type SyncAllResult } from "@/lib/sftp-actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { RefreshCw, Check, AlertTriangle } from "lucide-react";

interface SyncAllButtonProps {
  /** Number of active connections */
  connectionCount: number;
  /** Button style variant */
  variant?: "default" | "outline" | "ghost";
  /** Button size */
  size?: "default" | "sm" | "lg" | "icon";
  /** Additional CSS classes */
  className?: string;
  /** Callback after sync completes */
  onSyncComplete?: (result: SyncAllResult) => void | Promise<void>;
}

/**
 * Button that triggers SFTP sync for all connections.
 * Displays animated states during sync and shows aggregated results.
 *
 * @param connectionCount - Number of connections (0 disables the button)
 * @param variant - Button style variant
 * @param size - Button size
 * @param className - Additional CSS classes
 * @param onSyncComplete - Callback after all syncs complete
 */
export function SyncAllButton({
  connectionCount,
  variant = "outline",
  size = "default",
  className,
  onSyncComplete,
}: SyncAllButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<
    "idle" | "syncing" | "success" | "error"
  >("idle");

  const handleSync = () => {
    setStatus("syncing");

    startTransition(async () => {
      const result = await syncAllConnections();

      if (result.success && result.data) {
        const { successfulSyncs, failedSyncs, results } = result.data;

        if (failedSyncs === 0) {
          setStatus("success");

          const totalCreated = results.reduce((sum, r) => sum + r.created, 0);
          const totalUpdated = results.reduce((sum, r) => sum + r.updated, 0);
          const totalDeleted = results.reduce((sum, r) => sum + r.deleted, 0);

          const parts: string[] = [];
          if (totalCreated > 0) parts.push(`${totalCreated} added`);
          if (totalUpdated > 0) parts.push(`${totalUpdated} updated`);
          if (totalDeleted > 0) parts.push(`${totalDeleted} removed`);

          const message =
            parts.length > 0
              ? `Synced ${successfulSyncs} connection(s): ${parts.join(", ")}`
              : `${successfulSyncs} connection(s) already in sync`;

          toast.success(message);
        } else {
          setStatus("error");
          toast.error(
            `Sync completed with errors: ${successfulSyncs} succeeded, ${failedSyncs} failed`
          );
        }

        await onSyncComplete?.(result.data);
        setTimeout(() => setStatus("idle"), 2000);
      } else {
        setStatus("error");
        toast.error("error" in result ? result.error : "Sync failed");
        setTimeout(() => setStatus("idle"), 2000);
      }
    });
  };

  const isDisabled = isPending || status === "syncing" || connectionCount === 0;

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleSync}
      disabled={isDisabled}
      className={cn(
        "relative transition-all duration-300",
        status === "success" && "text-emerald-600 dark:text-emerald-400",
        status === "error" && "text-destructive",
        className
      )}
    >
      <span className="flex items-center gap-2">
        {status === "success" ? (
          <Check className="animate-in zoom-in-50 size-4 duration-200" />
        ) : status === "error" ? (
          <AlertTriangle className="animate-in zoom-in-50 size-4 duration-200" />
        ) : (
          <RefreshCw
            className={cn(
              "size-4 transition-transform",
              status === "syncing" && "animate-spin"
            )}
          />
        )}

        {size !== "icon" && (
          <span>
            {status === "syncing"
              ? "Syncing..."
              : status === "success"
                ? "Synced"
                : connectionCount === 1
                  ? "Sync"
                  : "Sync All"}
          </span>
        )}
      </span>
    </Button>
  );
}
