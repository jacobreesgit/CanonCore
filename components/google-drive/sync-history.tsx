/**
 * Sync history panel showing recent Google Drive operations.
 * Displays action type, item/file name, status, and timestamp.
 */

"use client";

import { useEffect, useState, useTransition } from "react";
import { formatDistanceToNow } from "date-fns";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCircleCheck,
  faCircleXmark,
  faFolderPlus,
  faPencil,
  faTrashCan,
  faUpload,
  faDownload,
  faRotate,
  faArrowRight,
  faClockRotateLeft,
  faSpinner,
} from "@fortawesome/free-solid-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { Button } from "@/components/ui/button";
import { getSyncHistoryAction } from "@/lib/sync-log";
import {
  SyncLogAction,
  SyncLogStatus,
  type SyncLogEntry,
} from "@/lib/sync-utils";
import { cn } from "@/lib/utils";

/** Icon mapping for each action type */
const ACTION_ICONS: Record<SyncLogAction, IconDefinition> = {
  [SyncLogAction.CREATE]: faFolderPlus,
  [SyncLogAction.RENAME]: faPencil,
  [SyncLogAction.DELETE]: faTrashCan,
  [SyncLogAction.MOVE]: faArrowRight,
  [SyncLogAction.UPLOAD]: faUpload,
  [SyncLogAction.DOWNLOAD]: faDownload,
  [SyncLogAction.SYNC]: faRotate,
};

/** Human-readable labels for each action type */
const ACTION_LABELS: Record<SyncLogAction, string> = {
  [SyncLogAction.CREATE]: "Created",
  [SyncLogAction.RENAME]: "Renamed",
  [SyncLogAction.DELETE]: "Deleted",
  [SyncLogAction.MOVE]: "Moved",
  [SyncLogAction.UPLOAD]: "Uploaded",
  [SyncLogAction.DOWNLOAD]: "Downloaded",
  [SyncLogAction.SYNC]: "Synced",
};

/** Cached number formatter for locale-aware duration formatting */
const durationFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 1,
});

const durationWholeFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 0,
});

/**
 * Formats duration in a human-readable way.
 * Uses Intl.NumberFormat for locale-aware number formatting.
 *
 * @param ms - Duration in milliseconds
 * @returns Formatted duration string
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${durationWholeFormatter.format(ms)}ms`;
  if (ms < 60000) return `${durationFormatter.format(ms / 1000)}s`;
  return `${durationFormatter.format(ms / 60000)}m`;
}

/**
 * Displays recent sync history with status indicators.
 * Fetches data on mount and provides refresh capability.
 */
export function SyncHistory() {
  const [logs, setLogs] = useState<SyncLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, startRefresh] = useTransition();

  useEffect(() => {
    let cancelled = false;

    async function loadInitialHistory() {
      const result = await getSyncHistoryAction();
      if (cancelled) return;
      if (result) {
        setLogs(result);
        setError(null);
      } else {
        setError("Failed to load sync history");
      }
      setLoading(false);
    }

    loadInitialHistory();

    return () => {
      cancelled = true;
    };
  }, []);

  function handleRefresh() {
    startRefresh(async () => {
      const result = await getSyncHistoryAction();
      if (result) {
        setLogs(result);
        setError(null);
      }
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-8">
        <FontAwesomeIcon
          icon={faSpinner}
          spin
          className="text-muted-foreground size-4"
          aria-hidden="true"
        />
        <span className="text-muted-foreground text-sm">Loading…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-muted-foreground py-4 text-center text-sm">
        {error}
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="space-y-3 py-4 text-center">
        <div className="bg-muted/50 mx-auto flex size-10 items-center justify-center rounded-full">
          <FontAwesomeIcon
            icon={faClockRotateLeft}
            className="text-muted-foreground size-5"
            aria-hidden="true"
          />
        </div>
        <p className="text-muted-foreground text-sm">No sync activity yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground text-xs">Recent activity</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="h-6 px-2 text-xs"
          aria-label="Refresh sync history"
        >
          {isRefreshing ? (
            <FontAwesomeIcon
              icon={faSpinner}
              spin
              className="size-3"
              aria-hidden="true"
            />
          ) : (
            <FontAwesomeIcon
              icon={faRotate}
              className="size-3"
              aria-hidden="true"
            />
          )}
        </Button>
      </div>

      <div className="space-y-1.5">
        {logs.map((log) => {
          const icon: IconDefinition = ACTION_ICONS[log.action] ?? faRotate;
          const label = ACTION_LABELS[log.action] ?? log.action;
          const name = log.itemName || log.fileName || "Sync operation";
          const isSuccess = log.status === SyncLogStatus.SUCCESS;
          const isFailed = log.status === SyncLogStatus.FAILED;

          return (
            <div
              key={log.id}
              className={cn(
                "flex items-start gap-2.5 rounded-md border p-2.5",
                "transition-colors",
                isFailed
                  ? "border-destructive/50"
                  : "border-border/50 hover:bg-muted/30"
              )}
            >
              {/* Status icon */}
              <div
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-md",
                  isSuccess && "bg-emerald-500/10 text-emerald-400",
                  isFailed && "bg-destructive/10 text-destructive",
                  !isSuccess && !isFailed && "bg-muted text-muted-foreground"
                )}
              >
                <FontAwesomeIcon
                  icon={icon}
                  className="size-3.5"
                  aria-hidden="true"
                />
              </div>

              {/* Content */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-medium">{name}</span>
                  {isSuccess && (
                    <FontAwesomeIcon
                      icon={faCircleCheck}
                      className="size-3 shrink-0 text-emerald-400"
                      aria-hidden="true"
                    />
                  )}
                  {isFailed && (
                    <FontAwesomeIcon
                      icon={faCircleXmark}
                      className="text-destructive size-3 shrink-0"
                      aria-hidden="true"
                    />
                  )}
                </div>

                <div className="text-muted-foreground flex flex-wrap items-center gap-x-1.5 text-xs">
                  <span
                    className={cn(
                      isFailed && "text-destructive",
                      isSuccess && "text-emerald-400"
                    )}
                  >
                    {isFailed ? "Failed" : label}
                  </span>
                  <span className="text-muted-foreground/50">·</span>
                  <span>
                    {formatDistanceToNow(new Date(log.createdAt), {
                      addSuffix: true,
                    })}
                  </span>
                  {log.duration !== null && log.duration > 0 && (
                    <>
                      <span className="text-muted-foreground/50">·</span>
                      <span className="tabular-nums">
                        {formatDuration(log.duration)}
                      </span>
                    </>
                  )}
                </div>

                {/* Error message */}
                {isFailed && log.error && (
                  <p className="text-destructive mt-1 text-xs leading-snug">
                    {log.error}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
