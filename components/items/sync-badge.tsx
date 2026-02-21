/**
 * Badge showing sync status for items.
 * Provides visual feedback for synced, syncing, pending, and error states.
 */

import { SyncStatus } from "@prisma/client";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSpinner,
  faCircle,
  faTriangleExclamation,
  faCircleCheck,
} from "@fortawesome/free-solid-svg-icons";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface SyncBadgeProps {
  /** Current sync status of the item */
  syncStatus: SyncStatus;
  /** Error message if sync failed */
  syncError?: string | null;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Displays a badge with tooltip showing sync status.
 * Returns null for SYNCED status (no visual indicator needed).
 *
 * @param syncStatus - The current sync state
 * @param syncError - Optional error message for failed syncs
 * @param className - Additional CSS classes
 */
export function SyncBadge({
  syncStatus,
  syncError,
  className,
}: SyncBadgeProps) {
  if (syncStatus === "SYNCED") return null;

  if (syncStatus === "SYNCING") {
    return (
      <FontAwesomeIcon
        icon={faSpinner}
        spin
        className={cn("text-muted-foreground size-3", className)}
      />
    );
  }

  if (syncStatus === "PENDING") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <FontAwesomeIcon
              icon={faCircle}
              className={cn("text-muted-foreground size-2", className)}
            />
          </TooltipTrigger>
          <TooltipContent>Waiting to sync</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (syncStatus === "ERROR") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <FontAwesomeIcon
              icon={faTriangleExclamation}
              className={cn("text-destructive size-3", className)}
            />
          </TooltipTrigger>
          <TooltipContent>
            {syncError || "Sync failed. Click to retry."}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return null;
}

interface SyncIconProps {
  /** Current sync status of the item. */
  syncStatus?: SyncStatus;
  /** Google Drive folder ID — shows synced icon when linked. */
  driveFileId?: string | null;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Icon-only version for compact display.
 * Shows sync state for SYNCING/PENDING/ERROR, and a white check
 * when the item is linked to Google Drive and fully synced.
 *
 * @param syncStatus - The current sync state
 * @param driveFileId - Google Drive folder ID (shows synced icon when present)
 * @param className - Additional CSS classes
 */
export function SyncIcon({
  syncStatus,
  driveFileId,
  className,
}: SyncIconProps) {
  if (syncStatus === "SYNCING") {
    return (
      <FontAwesomeIcon
        icon={faSpinner}
        spin
        className={cn("text-muted-foreground size-3", className)}
      />
    );
  }

  if (syncStatus === "PENDING") {
    return (
      <FontAwesomeIcon
        icon={faCircle}
        className={cn("text-muted-foreground size-2", className)}
      />
    );
  }

  if (syncStatus === "ERROR") {
    return (
      <FontAwesomeIcon
        icon={faTriangleExclamation}
        className={cn("text-destructive size-3", className)}
      />
    );
  }

  if (driveFileId && (!syncStatus || syncStatus === "SYNCED")) {
    return (
      <FontAwesomeIcon
        icon={faCircleCheck}
        className={cn("size-3.5 text-white/70", className)}
        aria-hidden="true"
      />
    );
  }

  return null;
}
