/**
 * Badge showing sync status for items.
 * Provides visual feedback for synced, syncing, pending, and error states.
 */

import { SyncStatus } from "@prisma/client";
import { Loader2, Circle, AlertTriangle } from "lucide-react";
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
      <Loader2
        className={cn("text-muted-foreground size-3 animate-spin", className)}
      />
    );
  }

  if (syncStatus === "PENDING") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Circle
              className={cn(
                "text-muted-foreground size-2 fill-current",
                className
              )}
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
            <AlertTriangle
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
  /** Current sync status of the item */
  syncStatus: SyncStatus;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Icon-only version for compact display.
 * No tooltips, just the visual indicator.
 *
 * @param syncStatus - The current sync state
 * @param className - Additional CSS classes
 */
export function SyncIcon({ syncStatus, className }: SyncIconProps) {
  if (syncStatus === "SYNCED") return null;

  if (syncStatus === "SYNCING") {
    return (
      <Loader2
        className={cn("text-muted-foreground size-3 animate-spin", className)}
      />
    );
  }

  if (syncStatus === "PENDING") {
    return (
      <Circle
        className={cn("text-muted-foreground size-2 fill-current", className)}
      />
    );
  }

  if (syncStatus === "ERROR") {
    return (
      <AlertTriangle className={cn("text-destructive size-3", className)} />
    );
  }

  return null;
}
