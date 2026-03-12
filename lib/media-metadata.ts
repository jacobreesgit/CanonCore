/**
 * Display utilities for video/image metadata.
 * Pure functions for resolution labels and duration formatting.
 */

export function getResolutionLabel(
  height: number | null | undefined
): string | null {
  if (height == null) return null;
  if (height >= 2160) return "4K";
  if (height >= 1440) return "1440p";
  if (height >= 1080) return "1080p";
  if (height >= 720) return "720p";
  return "SD";
}

export function formatDuration(ms: number | null | undefined): string | null {
  if (!ms) return null;
  const totalMinutes = Math.round(ms / 60000);
  if (totalMinutes < 1) return null;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
