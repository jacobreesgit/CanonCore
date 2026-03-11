/**
 * React hook for detecting and managing reduced motion preference.
 * Supports both system preference detection and user override via localStorage.
 */

import * as React from "react";

/** Storage key for user's reduced motion preference override. */
const STORAGE_KEY = "canoncore-reduced-motion:v1";

/**
 * Detects if the user prefers reduced motion (system preference only).
 * Updates reactively when system preference changes.
 *
 * @returns true if user prefers reduced motion
 */
export function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = React.useState(false);

  React.useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => {
      setPrefersReducedMotion(mql.matches);
    };

    // Set initial value
    setPrefersReducedMotion(mql.matches);

    // Listen for changes
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return prefersReducedMotion;
}

interface UseReducedMotionReturn {
  /** Whether reduced motion is enabled (user override or system preference). */
  reducedMotion: boolean;
  /** Set user's reduced motion preference (stored in localStorage). */
  setReducedMotion: (value: boolean) => void;
}

/**
 * Manages reduced motion preference with localStorage override.
 * Falls back to system preference if no user override is set.
 *
 * @returns Current reduced motion state and setter
 */
export function useReducedMotion(): UseReducedMotionReturn {
  const systemPreference = usePrefersReducedMotion();
  const [userPreference, setUserPreference] = React.useState<boolean | null>(
    null
  );

  // Load user preference from localStorage on mount
  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== null) {
        setUserPreference(stored === "true");
      }
    } catch {
      // localStorage unavailable
    }
  }, []);

  const setReducedMotion = React.useCallback((value: boolean) => {
    setUserPreference(value);
    try {
      localStorage.setItem(STORAGE_KEY, String(value));
    } catch {
      // localStorage unavailable
    }
  }, []);

  // User preference takes precedence over system preference
  const reducedMotion = userPreference ?? systemPreference;

  return { reducedMotion, setReducedMotion };
}
