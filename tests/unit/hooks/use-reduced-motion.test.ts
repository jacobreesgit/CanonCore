/**
 * Unit tests for useReducedMotion and usePrefersReducedMotion hooks.
 * Tests system preference detection, user override via localStorage,
 * and reactive updates on media query changes.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import {
  usePrefersReducedMotion,
  useReducedMotion,
} from "@/hooks/use-reduced-motion";

// --- matchMedia mock helper ---

function createMatchMedia(matches: boolean) {
  const listeners: Array<(e: { matches: boolean }) => void> = [];
  return {
    matches,
    addEventListener: (_: string, fn: (e: { matches: boolean }) => void) => {
      listeners.push(fn);
    },
    removeEventListener: (_: string, fn: (e: { matches: boolean }) => void) => {
      const i = listeners.indexOf(fn);
      if (i >= 0) listeners.splice(i, 1);
    },
    _listeners: listeners,
    _setMatches(value: boolean) {
      this.matches = value;
      listeners.forEach((fn) => fn({ matches: value }));
    },
  };
}

describe("usePrefersReducedMotion", () => {
  const originalMatchMedia = window.matchMedia;

  afterEach(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: originalMatchMedia,
    });
  });

  it("returns false by default (matchMedia returns false)", () => {
    const mql = createMatchMedia(false);
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn(() => mql),
    });

    const { result } = renderHook(() => usePrefersReducedMotion());

    expect(result.current).toBe(false);
  });

  it("returns true when system prefers reduced motion", () => {
    const mql = createMatchMedia(true);
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn(() => mql),
    });

    const { result } = renderHook(() => usePrefersReducedMotion());

    expect(result.current).toBe(true);
  });

  it("updates when media query changes", async () => {
    const mql = createMatchMedia(false);
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn(() => mql),
    });

    const { result } = renderHook(() => usePrefersReducedMotion());

    expect(result.current).toBe(false);

    // Simulate system preference changing to reduced motion
    act(() => {
      mql._setMatches(true);
    });

    await waitFor(() => {
      expect(result.current).toBe(true);
    });

    // Simulate system preference changing back
    act(() => {
      mql._setMatches(false);
    });

    await waitFor(() => {
      expect(result.current).toBe(false);
    });
  });
});

describe("useReducedMotion", () => {
  const originalMatchMedia = window.matchMedia;
  const STORAGE_KEY = "canoncore-reduced-motion:v1";

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: originalMatchMedia,
    });
  });

  function setupMatchMedia(matches: boolean) {
    const mql = createMatchMedia(matches);
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn(() => mql),
    });
    return mql;
  }

  it("falls back to system preference when no user override", () => {
    setupMatchMedia(true);

    const { result } = renderHook(() => useReducedMotion());

    expect(result.current.reducedMotion).toBe(true);
  });

  it("loads user preference from localStorage on mount", async () => {
    setupMatchMedia(false);
    localStorage.setItem(STORAGE_KEY, "true");

    const { result } = renderHook(() => useReducedMotion());

    await waitFor(() => {
      expect(result.current.reducedMotion).toBe(true);
    });
  });

  it("setReducedMotion updates state and saves to localStorage", async () => {
    setupMatchMedia(false);

    const { result } = renderHook(() => useReducedMotion());

    expect(result.current.reducedMotion).toBe(false);

    act(() => {
      result.current.setReducedMotion(true);
    });

    await waitFor(() => {
      expect(result.current.reducedMotion).toBe(true);
    });

    expect(localStorage.getItem(STORAGE_KEY)).toBe("true");
  });

  it("user preference overrides system preference", async () => {
    setupMatchMedia(false);
    localStorage.setItem(STORAGE_KEY, "true");

    const { result } = renderHook(() => useReducedMotion());

    // System says false, but user stored "true"
    await waitFor(() => {
      expect(result.current.reducedMotion).toBe(true);
    });
  });

  it("works when localStorage throws (graceful fallback)", () => {
    setupMatchMedia(true);

    // Make localStorage throw on getItem
    const getItemSpy = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("localStorage disabled");
      });

    const { result } = renderHook(() => useReducedMotion());

    // Should fall back to system preference without crashing
    expect(result.current.reducedMotion).toBe(true);

    getItemSpy.mockRestore();
  });

  it("setReducedMotion(false) overrides system reduced motion preference", async () => {
    setupMatchMedia(true);

    const { result } = renderHook(() => useReducedMotion());

    // Initially follows system (true)
    expect(result.current.reducedMotion).toBe(true);

    act(() => {
      result.current.setReducedMotion(false);
    });

    await waitFor(() => {
      expect(result.current.reducedMotion).toBe(false);
    });

    expect(localStorage.getItem(STORAGE_KEY)).toBe("false");
  });
});
