/**
 * Thin, minimal progress bar with Apple TV+ styling.
 * Uses white fill on dark background with subtle blur.
 */

import { cn } from "@/lib/utils";

interface DemoProgressBarProps {
  /** Progress percentage (0-100). */
  progress: number;
  /** Optional label (e.g., "72% watched" or "12/19 episodes"). */
  label?: string;
  /** Additional CSS classes for container. */
  className?: string;
  /** Whether to show as compact (no label, narrower). */
  compact?: boolean;
}

/**
 * Displays progress as a thin horizontal bar.
 * Minimum width of 8px for visibility even at 1%.
 */
export function DemoProgressBar({
  progress,
  label,
  className,
  compact = false,
}: DemoProgressBarProps) {
  // Clamp progress to 0-100
  const clampedProgress = Math.max(0, Math.min(100, progress));

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {/* Track */}
      <div
        className={cn(
          "relative overflow-hidden rounded-full",
          "bg-white/10 backdrop-blur-sm",
          compact ? "h-1 w-24" : "h-1 w-full max-w-[400px]"
        )}
        role="progressbar"
        aria-valuenow={clampedProgress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label || `${clampedProgress}% complete`}
      >
        {/* Fill */}
        <div
          className={cn(
            "absolute inset-y-0 left-0 rounded-full",
            "bg-[var(--atv-progress)]",
            "transition-[width] duration-300 ease-out"
          )}
          style={{
            width: `max(8px, ${clampedProgress}%)`,
          }}
        />
      </div>

      {/* Label */}
      {label && !compact && (
        <span
          className={cn("text-sm tracking-wide tabular-nums", "text-white/50")}
        >
          {label}
        </span>
      )}
    </div>
  );
}
