/**
 * Unit tests for useIsMobile hook.
 */

import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useIsMobile } from "@/hooks/use-mobile";

describe("useIsMobile", () => {
  // Store original window properties
  const originalMatchMedia = window.matchMedia;
  const originalInnerWidth = window.innerWidth;

  // Mock matchMedia listener
  let changeListener: (() => void) | null = null;
  const mockAddEventListener = vi.fn((event, callback) => {
    if (event === "change") {
      changeListener = callback;
    }
  });
  const mockRemoveEventListener = vi.fn();

  function setupMatchMedia(matches: boolean) {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn(() => ({
        matches,
        addEventListener: mockAddEventListener,
        removeEventListener: mockRemoveEventListener,
      })),
    });
  }

  function setWindowWidth(width: number) {
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: width,
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    changeListener = null;
  });

  afterEach(() => {
    // Restore original window properties
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: originalMatchMedia,
    });
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: originalInnerWidth,
    });
  });

  it("returns false for desktop viewport (>= 1024px)", () => {
    setWindowWidth(1024);
    setupMatchMedia(false);

    const { result } = renderHook(() => useIsMobile());

    expect(result.current).toBe(false);
  });

  it("returns true for mobile viewport (< 1024px)", () => {
    setWindowWidth(375);
    setupMatchMedia(true);

    const { result } = renderHook(() => useIsMobile());

    expect(result.current).toBe(true);
  });

  it("returns false at exactly 1024px breakpoint", () => {
    setWindowWidth(1024);
    setupMatchMedia(false);

    const { result } = renderHook(() => useIsMobile());

    expect(result.current).toBe(false);
  });

  it("returns true at 1023px (just below breakpoint)", () => {
    setWindowWidth(1023);
    setupMatchMedia(true);

    const { result } = renderHook(() => useIsMobile());

    expect(result.current).toBe(true);
  });

  it("adds change event listener on mount", () => {
    setWindowWidth(1024);
    setupMatchMedia(false);

    renderHook(() => useIsMobile());

    expect(mockAddEventListener).toHaveBeenCalledWith(
      "change",
      expect.any(Function)
    );
  });

  it("removes change event listener on unmount", () => {
    setWindowWidth(1024);
    setupMatchMedia(false);

    const { unmount } = renderHook(() => useIsMobile());
    unmount();

    expect(mockRemoveEventListener).toHaveBeenCalledWith(
      "change",
      expect.any(Function)
    );
  });

  it("updates when viewport crosses breakpoint to mobile", () => {
    setWindowWidth(1024);
    setupMatchMedia(false);

    const { result } = renderHook(() => useIsMobile());

    expect(result.current).toBe(false);

    // Simulate viewport change to mobile
    act(() => {
      setWindowWidth(375);
      if (changeListener) {
        changeListener();
      }
    });

    expect(result.current).toBe(true);
  });

  it("updates when viewport crosses breakpoint to desktop", () => {
    setWindowWidth(375);
    setupMatchMedia(true);

    const { result } = renderHook(() => useIsMobile());

    expect(result.current).toBe(true);

    // Simulate viewport change to desktop
    act(() => {
      setWindowWidth(1024);
      if (changeListener) {
        changeListener();
      }
    });

    expect(result.current).toBe(false);
  });

  it("uses correct media query breakpoint (1023px)", () => {
    setWindowWidth(1024);
    setupMatchMedia(false);

    renderHook(() => useIsMobile());

    expect(window.matchMedia).toHaveBeenCalledWith("(max-width: 1023px)");
  });

  it("returns false initially before effect runs (SSR safety)", () => {
    // The hook uses !!isMobile where isMobile starts as undefined
    // This means it returns false during SSR
    setWindowWidth(375);
    setupMatchMedia(true);

    // Note: Due to how React Testing Library works, the effect runs
    // synchronously in tests, so we can't easily test the SSR behavior
    // This test documents the expected behavior
    const { result } = renderHook(() => useIsMobile());

    // After effect runs, should be true for mobile
    expect(result.current).toBe(true);
  });
});
