/**
 * Pending operations indicator for the sync queue.
 * Shows count of operations waiting to be synced.
 */

"use client";

import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCloudArrowDown, faSpinner } from "@fortawesome/free-solid-svg-icons";
import { getPendingCount, isQueueAvailable } from "@/lib/sync-queue";
import { cn } from "@/lib/utils";

/**
 * Displays the number of pending sync operations.
 * Hides when there are no pending operations or queue is unavailable.
 * Pauses polling when tab is hidden to conserve resources.
 */
export function PendingIndicator() {
  const [count, setCount] = useState(0);
  const [available, setAvailable] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    async function refreshCount() {
      const queueAvailable = await isQueueAvailable();
      if (!mounted) return;
      setAvailable(queueAvailable);

      if (queueAvailable) {
        const pendingCount = await getPendingCount();
        if (!mounted) return;
        setCount(pendingCount);
      }

      setIsLoading(false);
    }

    function startPolling() {
      if (intervalId) return;
      intervalId = setInterval(refreshCount, 5000);
    }

    function stopPolling() {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        // Refresh immediately when tab becomes visible
        refreshCount();
        startPolling();
      } else {
        stopPolling();
      }
    }

    // Initial load
    refreshCount();

    // Start polling only if tab is visible
    if (document.visibilityState === "visible") {
      startPolling();
    }

    // Listen for visibility changes to pause/resume polling
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Also refresh when coming online
    window.addEventListener("online", refreshCount);

    return () => {
      mounted = false;
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("online", refreshCount);
    };
  }, []);

  // Don't render during initial load
  if (isLoading) {
    return null;
  }

  // Don't render if queue unavailable or no pending operations
  if (!available || count === 0) {
    return null;
  }

  return (
    <div
      data-pending-indicator
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1",
        "bg-amber-500/10 text-amber-600 dark:text-amber-400",
        "text-xs font-medium",
        "border border-amber-500/20",
        "animate-in fade-in duration-300"
      )}
    >
      <div className="relative flex size-3 items-center justify-center">
        <FontAwesomeIcon
          icon={faCloudArrowDown}
          className="size-3"
          aria-hidden="true"
        />
        <FontAwesomeIcon
          icon={faSpinner}
          spin
          className="absolute size-3 opacity-50"
          aria-hidden="true"
        />
      </div>
      <span className="tabular-nums">{count}</span>
      <span className="text-amber-600/70 dark:text-amber-400/70">pending</span>
    </div>
  );
}
