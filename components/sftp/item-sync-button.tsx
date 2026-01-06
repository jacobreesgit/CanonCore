/**
 * Sync button for individual items and their descendants.
 * Syncs only the subtree rooted at the specified item.
 */

"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { syncItemTree, type SyncItemResult } from "@/lib/sftp-actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { RefreshCw, Check, AlertTriangle } from "lucide-react";

interface ItemSyncButtonProps {
  /** Item ID to sync */
  itemId: string;
  /** Item name for toast messages */
  itemName: string;
  /** Button style variant */
  variant?: "default" | "outline" | "ghost";
  /** Button size */
  size?: "default" | "sm" | "lg" | "icon";
  /** Additional CSS classes */
  className?: string;
  /** Callback after sync completes */
  onSyncComplete?: (result: SyncItemResult) => void | Promise<void>;
}

/**
 * Button that triggers SFTP sync for a specific item and its children.
 *
 * @param itemId - Item ID to sync
 * @param itemName - Item name for display in toast
 * @param variant - Button style variant
 * @param size - Button size
 * @param className - Additional CSS classes
 * @param onSyncComplete - Callback after sync completes
 */
export function ItemSyncButton({
  itemId,
  itemName,
  variant = "outline",
  size = "default",
  className,
  onSyncComplete,
}: ItemSyncButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<
    "idle" | "syncing" | "success" | "error"
  >("idle");

  const handleSync = () => {
    setStatus("syncing");

    startTransition(async () => {
      const result = await syncItemTree(itemId);

      if (result.success && result.data) {
        setStatus("success");
        const { created, updated, deleted } = result.data;

        const parts: string[] = [];
        if (created > 0) parts.push(`${created} added`);
        if (updated > 0) parts.push(`${updated} updated`);
        if (deleted > 0) parts.push(`${deleted} removed`);

        const message =
          parts.length > 0
            ? `Synced "${itemName}": ${parts.join(", ")}`
            : `"${itemName}" already in sync`;

        toast.success(message);

        await onSyncComplete?.(result.data);
        setTimeout(() => setStatus("idle"), 2000);
      } else {
        setStatus("error");
        toast.error(
          "error" in result ? result.error : `Failed to sync "${itemName}"`
        );
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
                : "Sync"}
          </span>
        )}
      </span>
    </Button>
  );
}
