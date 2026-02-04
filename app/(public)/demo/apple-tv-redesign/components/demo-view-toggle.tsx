/**
 * View toggle between grid and tree modes with Apple TV+ styling.
 * Features sliding background indicator.
 */

"use client";

import { LayoutGrid, List } from "lucide-react";
import { cn } from "@/lib/utils";

type ViewMode = "grid" | "tree";

interface DemoViewToggleProps {
  /** Current view mode. */
  value: ViewMode;
  /** Callback when view mode changes. */
  onChange: (value: ViewMode) => void;
  /** Whether the toggle is disabled. */
  disabled?: boolean;
  /** Additional CSS classes. */
  className?: string;
}

/**
 * Segmented control for switching between grid and tree views.
 * Uses Apple TV+ glassmorphism with sliding indicator.
 */
export function DemoViewToggle({
  value,
  onChange,
  disabled = false,
  className,
}: DemoViewToggleProps) {
  return (
    <div
      className={cn(
        "relative inline-flex h-8 items-center rounded-md p-0.5",
        "bg-white/5",
        disabled && "pointer-events-none opacity-50",
        className
      )}
    >
      {/* Sliding background indicator */}
      <div
        className={cn(
          "absolute inset-y-0.5 w-[calc(50%-2px)] rounded",
          "bg-white/10",
          "transition-transform duration-200 ease-out",
          value === "tree" ? "translate-x-[calc(100%+2px)]" : "translate-x-0"
        )}
        style={{ left: "2px" }}
      />

      <button
        type="button"
        aria-label="Grid view"
        aria-pressed={value === "grid"}
        onClick={() => onChange("grid")}
        disabled={disabled}
        className={cn(
          "relative z-10 inline-flex h-7 items-center gap-1.5 rounded px-2.5",
          "text-sm transition-colors duration-150",
          value === "grid"
            ? "text-[var(--atv-text-primary)]"
            : "text-[var(--atv-text-tertiary)] hover:text-[var(--atv-text-secondary)]",
          "focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
        )}
      >
        <LayoutGrid aria-hidden="true" className="size-4" strokeWidth={2} />
        <span className="hidden sm:inline">Grid</span>
      </button>

      <button
        type="button"
        aria-label="Tree view"
        aria-pressed={value === "tree"}
        onClick={() => onChange("tree")}
        disabled={disabled}
        className={cn(
          "relative z-10 inline-flex h-7 items-center gap-1.5 rounded px-2.5",
          "text-sm transition-colors duration-150",
          value === "tree"
            ? "text-[var(--atv-text-primary)]"
            : "text-[var(--atv-text-tertiary)] hover:text-[var(--atv-text-secondary)]",
          "focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
        )}
      >
        <List aria-hidden="true" className="size-4" strokeWidth={2} />
        <span className="hidden sm:inline">Tree</span>
      </button>
    </div>
  );
}
