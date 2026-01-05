/**
 * Toggle between tree and grid view modes.
 * Refined segmented control with smooth transitions.
 * Persists preference in localStorage.
 */

"use client";

import { useSyncExternalStore, useCallback } from "react";
import { LayoutGrid, List } from "lucide-react";
import { cn } from "@/lib/utils";

export type ViewMode = "tree" | "grid";

interface ViewToggleProps {
  value?: ViewMode;
  onChange?(value: ViewMode): void;
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
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "grid" ? "grid" : "tree";
  }, []);

  const getServerSnapshot = useCallback((): ViewMode => "tree", []);

  const storedValue = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );

  const setValue = useCallback((mode: ViewMode) => {
    localStorage.setItem(STORAGE_KEY, mode);
    window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
  }, []);

  return [storedValue, setValue];
}

export function ViewToggle({ value, onChange }: ViewToggleProps) {
  const [storedView, setStoredView] = useStoredViewMode();

  // Use controlled value if provided, otherwise use stored value
  const view = value ?? storedView;

  function handleChange(newView: ViewMode) {
    setStoredView(newView);
    onChange?.(newView);
  }

  return (
    <div
      className={cn(
        "relative inline-flex h-8 items-center rounded-md p-0.5",
        "bg-muted/60 border-border/50 border",
        "shadow-sm"
      )}
    >
      {/* Sliding background indicator */}
      <div
        className={cn(
          "absolute top-0.5 bottom-0.5 w-[calc(50%-1px)] rounded-sm",
          "bg-background border-border/40 border shadow-sm",
          "transition-transform duration-200 ease-out",
          view === "grid" && "translate-x-[calc(100%+1px)]"
        )}
      />

      <button
        type="button"
        aria-label="Tree view"
        aria-pressed={view === "tree"}
        onClick={() => handleChange("tree")}
        className={cn(
          "relative z-10 inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-sm px-3",
          "text-sm font-medium transition-colors duration-150",
          view === "tree"
            ? "text-foreground"
            : "text-muted-foreground hover:text-foreground/80"
        )}
      >
        <List className="size-4" strokeWidth={2} />
        <span className="hidden sm:inline">Tree</span>
      </button>

      <button
        type="button"
        aria-label="Grid view"
        aria-pressed={view === "grid"}
        onClick={() => handleChange("grid")}
        className={cn(
          "relative z-10 inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-sm px-3",
          "text-sm font-medium transition-colors duration-150",
          view === "grid"
            ? "text-foreground"
            : "text-muted-foreground hover:text-foreground/80"
        )}
      >
        <LayoutGrid className="size-4" strokeWidth={2} />
        <span className="hidden sm:inline">Grid</span>
      </button>
    </div>
  );
}
