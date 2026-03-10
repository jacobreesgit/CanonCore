/**
 * Compact badges for video duration and resolution.
 * Used on grid cards and other compact displays.
 */

import { cn } from "@/lib/utils";
import { getResolutionLabel, formatDuration } from "@/lib/media-metadata";

interface MediaBadgesProps {
  durationMs?: number | null;
  height?: number | null;
  className?: string;
}

export function MediaBadges({
  durationMs,
  height,
  className,
}: MediaBadgesProps) {
  const duration = formatDuration(durationMs);
  const resolution = getResolutionLabel(height);

  if (!duration && !resolution) return null;

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      {duration && (
        <span className="rounded bg-black/70 px-1.5 py-0.5 text-xs font-medium text-white">
          {duration}
        </span>
      )}
      {resolution && (
        <span className="rounded bg-black/70 px-1.5 py-0.5 text-xs font-medium text-white">
          {resolution}
        </span>
      )}
    </div>
  );
}
