/**
 * Sync button component for triggering SFTP synchronization.
 * Features industrial-precision loading animation and clear status feedback.
 */

"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { syncFromSftp, type SyncResult } from "@/lib/sftp-actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { RefreshCw, Check, AlertTriangle } from "lucide-react";

interface SyncButtonProps {
  connectionId: string;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  onSyncComplete?: (result: SyncResult) => void | Promise<void>;
}

/**
 * Button that triggers SFTP synchronization with animated feedback.
 *
 * @param connectionId - SFTP connection to sync
 * @param variant - Button style variant
 * @param size - Button size
 * @param className - Additional CSS classes
 * @param onSyncComplete - Callback after sync completes
 */
export function SyncButton({
  connectionId,
  variant = "outline",
  size = "default",
  className,
  onSyncComplete,
}: SyncButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<
    "idle" | "syncing" | "success" | "error"
  >("idle");

  const handleSync = () => {
    setStatus("syncing");

    startTransition(async () => {
      const result = await syncFromSftp(connectionId);

      if (result.success && result.data) {
        setStatus("success");
        const { created, updated, deleted } = result.data;

        // Build descriptive message
        const parts: string[] = [];
        if (created > 0) parts.push(`${created} added`);
        if (updated > 0) parts.push(`${updated} updated`);
        if (deleted > 0) parts.push(`${deleted} removed`);

        const message = parts.length > 0 ? parts.join(", ") : "Already in sync";

        toast.success(`Sync complete: ${message}`);

        await onSyncComplete?.(result.data);

        // Reset to idle after showing success
        setTimeout(() => setStatus("idle"), 2000);
      } else {
        setStatus("error");
        toast.error("error" in result ? result.error : "Sync failed");
        setTimeout(() => setStatus("idle"), 2000);
      }
    });
  };

  const isDisabled = isPending || status === "syncing";

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleSync}
      disabled={isDisabled}
      className={cn(
        "relative overflow-hidden transition-all duration-300",
        // Success state glow
        status === "success" &&
          "ring-offset-background ring-2 ring-emerald-500/50 ring-offset-2",
        // Error state
        status === "error" &&
          "ring-destructive/50 ring-offset-background ring-2 ring-offset-2",
        className
      )}
    >
      {/* Background sweep animation during sync */}
      {status === "syncing" && (
        <span
          className="via-primary/10 absolute inset-0 animate-[sweep_1.5s_ease-in-out_infinite] bg-gradient-to-r from-transparent to-transparent"
          style={{
            background:
              "linear-gradient(90deg, transparent, hsl(var(--primary) / 0.1), transparent)",
          }}
        />
      )}

      {/* Icon with state-based rendering */}
      <span className="relative flex items-center gap-2">
        {status === "success" ? (
          <Check className="animate-in zoom-in-50 size-4 text-emerald-500 duration-200" />
        ) : status === "error" ? (
          <AlertTriangle className="text-destructive animate-in zoom-in-50 size-4 duration-200" />
        ) : (
          <RefreshCw
            className={cn(
              "size-4 transition-transform duration-300",
              status === "syncing" && "animate-spin"
            )}
          />
        )}

        {/* Text - hide on icon size */}
        {size !== "icon" && (
          <span className="relative">
            {status === "syncing"
              ? "Syncing..."
              : status === "success"
                ? "Synced"
                : "Sync"}
          </span>
        )}
      </span>
    </Button>
  );
}
