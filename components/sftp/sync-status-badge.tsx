/**
 * Sync status badge component for SFTP items.
 * Displays visual indicator of sync state with icon and label.
 */

"use client";

import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  CloudUpload,
  CloudDownload,
  AlertTriangle,
  XCircle,
  Loader2,
} from "lucide-react";

/** Sync status values matching Prisma enum. */
type SyncStatus =
  | "SYNCED"
  | "PENDING_UPLOAD"
  | "PENDING_DOWNLOAD"
  | "CONFLICT"
  | "ERROR";

interface SyncStatusBadgeProps {
  status: SyncStatus;
  className?: string;
  showLabel?: boolean;
}

/** Status configuration with colors, icons, and labels. */
const statusConfig: Record<
  SyncStatus,
  {
    icon: typeof CheckCircle2;
    label: string;
    className: string;
    animate?: boolean;
  }
> = {
  SYNCED: {
    icon: CheckCircle2,
    label: "Synced",
    className:
      "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 border-emerald-500/20",
  },
  PENDING_UPLOAD: {
    icon: CloudUpload,
    label: "Uploading",
    className:
      "bg-sky-500/10 text-sky-600 dark:bg-sky-500/20 dark:text-sky-400 border-sky-500/20",
    animate: true,
  },
  PENDING_DOWNLOAD: {
    icon: CloudDownload,
    label: "Downloading",
    className:
      "bg-violet-500/10 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400 border-violet-500/20",
    animate: true,
  },
  CONFLICT: {
    icon: AlertTriangle,
    label: "Conflict",
    className:
      "bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 border-amber-500/20",
  },
  ERROR: {
    icon: XCircle,
    label: "Error",
    className:
      "bg-red-500/10 text-red-600 dark:bg-red-500/20 dark:text-red-400 border-red-500/20",
  },
};

/**
 * Displays sync status with icon and optional label.
 *
 * @param status - Current sync status
 * @param showLabel - Whether to show text label
 * @param className - Additional CSS classes
 */
export function SyncStatusBadge({
  status,
  className,
  showLabel = true,
}: SyncStatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.animate ? Loader2 : config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
        config.className,
        className
      )}
    >
      <Icon
        className={cn("size-3.5", config.animate && "animate-spin")}
        aria-hidden="true"
      />
      {showLabel && <span>{config.label}</span>}
    </span>
  );
}
