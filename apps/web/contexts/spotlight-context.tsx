/**
 * Context for the global Spotlight search dialog.
 * Manages dialog state and keyboard shortcut ("/").
 */

"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from "react";

interface SpotlightContextValue {
  isOpen: boolean;
  openSpotlight: () => void;
  closeSpotlight: () => void;
}

const SpotlightContext = createContext<SpotlightContextValue | null>(null);

/**
 * Provider for Spotlight search dialog state.
 * Registers global keyboard shortcut for "/" key.
 */
export function SpotlightProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const openSpotlight = useCallback(() => setIsOpen(true), []);
  const closeSpotlight = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore if typing in an input, textarea, or contenteditable
      // Check document.activeElement for more reliable detection
      const activeElement = document.activeElement as HTMLElement | null;
      const isInput =
        activeElement?.tagName === "INPUT" ||
        activeElement?.tagName === "TEXTAREA" ||
        activeElement?.isContentEditable;

      if (event.key === "/" && !isInput) {
        event.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <SpotlightContext.Provider
      value={{
        isOpen,
        openSpotlight,
        closeSpotlight,
      }}
    >
      {children}
    </SpotlightContext.Provider>
  );
}

/**
 * Hook to access Spotlight dialog controls.
 * Throws if used outside SpotlightProvider.
 */
export function useSpotlight() {
  const context = useContext(SpotlightContext);
  if (!context) {
    throw new Error("useSpotlight must be used within SpotlightProvider");
  }
  return context;
}

/**
 * Optional hook that returns null if outside provider.
 * Use when component may render outside protected routes.
 */
export function useSpotlightOptional() {
  return useContext(SpotlightContext);
}
