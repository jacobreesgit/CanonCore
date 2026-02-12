/**
 * Storage usage bar component for Google Drive quota display.
 * Shows usage percentage with warning states for low storage.
 */

"use client";

import { Progress } from "@/components/ui/progress";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface StorageBarProps {
  /** Bytes currently used */
  bytesUsed: bigint | null;
  /** Total bytes available */
  bytesTotal: bigint | null;
  /** Display variant */
  variant?: "default" | "compact";
  /** Additional class names */
  className?: string;
}

/** Cached number formatter for locale-aware formatting */
const numberFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 1,
});

const wholeNumberFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 0,
});

/**
 * Formats bytes to human-readable string (e.g., "14.2 GB").
 * Uses Intl.NumberFormat for locale-aware number formatting.
 *
 * @param bytes - Number of bytes to format
 * @returns Human-readable string with appropriate unit
 */
export function formatBytes(bytes: bigint): string {
  const gb = Number(bytes) / (1024 * 1024 * 1024);
  if (gb >= 1) {
    return `${numberFormatter.format(gb)} GB`;
  }
  const mb = Number(bytes) / (1024 * 1024);
  if (mb >= 1) {
    return `${wholeNumberFormatter.format(mb)} MB`;
  }
  const kb = Number(bytes) / 1024;
  return `${wholeNumberFormatter.format(kb)} KB`;
}

/**
 * Storage bar with usage percentage and warning states.
 * Shows disabled state when quota data is not yet available.
 *
 * @param bytesUsed - Current storage usage
 * @param bytesTotal - Total storage quota
 * @param variant - "default" shows text, "compact" shows only bar
 * @param className - Additional styling
 */
export function StorageBar({
  bytesUsed,
  bytesTotal,
  variant = "default",
  className,
}: StorageBarProps) {
  const hasData =
    bytesUsed !== null && bytesTotal !== null && bytesTotal !== BigInt(0);

  const percentage = hasData
    ? Math.round((Number(bytesUsed) / Number(bytesTotal)) * 100)
    : 0;
  const isWarning = hasData && percentage >= 80;
  const isCritical = hasData && percentage >= 95;

  const ariaLabel = hasData
    ? `Storage usage: ${percentage}% full`
    : "Storage usage: not available";

  if (variant === "compact") {
    return (
      <Progress
        value={percentage}
        className={cn(
          "h-1.5",
          !hasData && "opacity-40",
          isCritical && "[&_[data-slot=progress-indicator]]:bg-destructive",
          isWarning &&
            !isCritical &&
            "[&_[data-slot=progress-indicator]]:bg-yellow-500",
          className
        )}
        aria-label={ariaLabel}
        aria-valuenow={percentage}
      />
    );
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      <Progress
        value={percentage}
        className={cn(
          "h-2",
          !hasData && "opacity-40",
          isCritical && "[&_[data-slot=progress-indicator]]:bg-destructive",
          isWarning &&
            !isCritical &&
            "[&_[data-slot=progress-indicator]]:bg-yellow-500"
        )}
        aria-label={ariaLabel}
        aria-valuenow={percentage}
      />
      <div className="flex items-center justify-between text-xs">
        {hasData ? (
          <span className="text-muted-foreground">
            {formatBytes(bytesUsed)} / {formatBytes(bytesTotal)}
          </span>
        ) : (
          <span className="text-muted-foreground">
            Sync to see storage usage
          </span>
        )}
        {isCritical && (
          <span className="text-destructive flex items-center gap-1">
            <AlertTriangle className="size-3" aria-hidden="true" />
            Storage critical
          </span>
        )}
        {isWarning && !isCritical && (
          <span className="flex items-center gap-1 text-yellow-600 dark:text-yellow-500">
            <AlertTriangle className="size-3" aria-hidden="true" />
            Storage almost full
          </span>
        )}
      </div>
    </div>
  );
}
