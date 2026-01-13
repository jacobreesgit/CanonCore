/**
 * Hook for managing hero collapse state with localStorage persistence.
 * Used by ItemHero to toggle between full cinematic view and compact bar.
 */

"use client";

import { useState, useCallback, useEffect } from "react";

const STORAGE_KEY = "canon-hero-collapsed";

/**
 * Manages hero collapse state with localStorage persistence.
 * Defaults to expanded (false) on first visit.
 *
 * Uses useEffect for localStorage read to prevent SSR hydration mismatch.
 * Server always renders with isCollapsed=false, then client updates from localStorage.
 *
 * @returns Collapse state and control functions
 */
export function useHeroCollapse() {
  // Always start with false to prevent hydration mismatch
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Read from localStorage on mount (client-side only)
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "true") {
      setIsCollapsed(true); // eslint-disable-line react-hooks/set-state-in-effect -- Intentional: one-time hydration from localStorage
    }
  }, []);

  // Sync to localStorage when state changes (skip initial false)
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(isCollapsed));
  }, [isCollapsed]);

  const toggleCollapse = useCallback(() => {
    setIsCollapsed((prev) => !prev);
  }, []);

  const setCollapsed = useCallback((value: boolean) => {
    setIsCollapsed(value);
  }, []);

  return {
    isCollapsed,
    toggleCollapse,
    setCollapsed,
  };
}
