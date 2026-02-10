/**
 * Hook to sync view mode (grid/tree) with localStorage.
 * Uses useSyncExternalStore for hydration-safe access.
 */

"use client";

import { useSyncExternalStore, useCallback } from "react";
import type { ViewMode } from "@/lib/types";

const STORAGE_KEY = "items-view-mode";

/**
 * Custom hook to sync view mode with localStorage.
 * Uses useSyncExternalStore for hydration-safe access.
 *
 * @returns Tuple of [currentViewMode, setViewMode]
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
