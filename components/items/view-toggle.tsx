/**
 * Toggle between tree and grid view modes.
 * Glassmorphism styling with sliding indicator.
 * Persists preference in localStorage.
 */

"use client";

import { useSyncExternalStore, useCallback } from "react";
import { LayoutGrid, List } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ViewMode } from "@/lib/types";

interface ViewToggleProps {
  value?: ViewMode;
  onChange?(value: ViewMode): void;
  /** If true, the toggle is disabled. */
  disabled?: boolean;
  /** Additional CSS classes. */
  className?: string;
}

const STORAGE_KEY = "items-view-mode";

/**
 * Custom hook to sync view mode with localStorage.
 * Uses useSyncExternalStore for hydration-safe access.
 * Exported for use in parent components that need to know the view mode.
 */
export function useStoredViewMode(): [ViewMode, (mode: ViewMode) => void] {
  const subscribe = useCallback((callback: () => void) => {
    window.addEventListener("storage", callback);
    return () => window.removeEventListener("storage", callback);
  }, []);

  const getSnapshot = useCallback((): ViewMode => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored === "tree" ? "tree" : "grid";
    } catch {
      // localStorage unavailable (private browsing, disabled, quota exceeded)
      return "grid";
    }
  }, []);

  const getServerSnapshot = useCallback((): ViewMode => "grid", []);

  const storedValue = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );

  const setValue = useCallback((mode: ViewMode) => {
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // localStorage unavailable (private browsing, disabled, quota exceeded)
    }
    window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
  }, []);

  return [storedValue, setValue];
}

/**
 * Segmented control for switching between tree and grid view modes.
 * Persists preference in localStorage with hydration-safe access.
 */
export function ViewToggle({
  value,
  onChange,
  disabled = false,
  className,
}: ViewToggleProps) {
  const [storedView, setStoredView] = useStoredViewMode();

  // Use controlled value if provided, otherwise use stored value
  const view = value ?? storedView;

  function handleChange(newView: ViewMode) {
    if (disabled) return;
    setStoredView(newView);
    onChange?.(newView);
  }

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
          view === "tree" ? "translate-x-[calc(100%+2px)]" : "translate-x-0"
        )}
        style={{ left: "2px" }}
      />

      <button
        type="button"
        aria-label="Grid view"
        aria-pressed={view === "grid"}
        onClick={() => handleChange("grid")}
        disabled={disabled}
        className={cn(
          "relative z-10 inline-flex h-7 items-center gap-1.5 rounded px-2.5",
          "text-sm transition-colors duration-150",
          view === "grid"
            ? "text-foreground"
            : "hover:text-muted-foreground text-[var(--tertiary-foreground)]",
          "focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
        )}
      >
        <LayoutGrid aria-hidden="true" className="size-4" strokeWidth={2} />
        <span className="hidden sm:inline">Grid</span>
      </button>

      <button
        type="button"
        aria-label="Tree view"
        aria-pressed={view === "tree"}
        onClick={() => handleChange("tree")}
        disabled={disabled}
        className={cn(
          "relative z-10 inline-flex h-7 items-center gap-1.5 rounded px-2.5",
          "text-sm transition-colors duration-150",
          view === "tree"
            ? "text-foreground"
            : "hover:text-muted-foreground text-[var(--tertiary-foreground)]",
          "focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
        )}
      >
        <List aria-hidden="true" className="size-4" strokeWidth={2} />
        <span className="hidden sm:inline">Tree</span>
      </button>
    </div>
  );
}
