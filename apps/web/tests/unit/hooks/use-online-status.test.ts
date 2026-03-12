/**
 * Unit tests for useOnlineStatus hook.
 * Tests online/offline detection and event handling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useOnlineStatus } from "@/hooks/use-online-status";

describe("useOnlineStatus", () => {
  let originalOnLine: boolean;

  beforeEach(() => {
    // Store original value
    originalOnLine = navigator.onLine;
    // Mock navigator.onLine
    Object.defineProperty(navigator, "onLine", {
      value: true,
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    // Restore original value
    Object.defineProperty(navigator, "onLine", {
      value: originalOnLine,
      configurable: true,
      writable: true,
    });
  });

  it("returns true when online", () => {
    Object.defineProperty(navigator, "onLine", {
      value: true,
      configurable: true,
    });

    const { result } = renderHook(() => useOnlineStatus());

    expect(result.current).toBe(true);
  });

  it("returns false when offline", () => {
    Object.defineProperty(navigator, "onLine", {
      value: false,
      configurable: true,
    });

    const { result } = renderHook(() => useOnlineStatus());

    expect(result.current).toBe(false);
  });

  it("updates when going offline", async () => {
    Object.defineProperty(navigator, "onLine", {
      value: true,
      configurable: true,
    });

    const { result } = renderHook(() => useOnlineStatus());

    expect(result.current).toBe(true);

    // Simulate going offline
    act(() => {
      Object.defineProperty(navigator, "onLine", {
        value: false,
        configurable: true,
      });
      window.dispatchEvent(new Event("offline"));
    });

    await waitFor(() => {
      expect(result.current).toBe(false);
    });
  });

  it("updates when coming online", async () => {
    Object.defineProperty(navigator, "onLine", {
      value: false,
      configurable: true,
    });

    const { result } = renderHook(() => useOnlineStatus());

    expect(result.current).toBe(false);

    // Simulate coming online
    act(() => {
      Object.defineProperty(navigator, "onLine", {
        value: true,
        configurable: true,
      });
      window.dispatchEvent(new Event("online"));
    });

    await waitFor(() => {
      expect(result.current).toBe(true);
    });
  });

  it("cleans up event listeners on unmount", () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    const removeSpy = vi.spyOn(window, "removeEventListener");

    const { unmount } = renderHook(() => useOnlineStatus());

    expect(addSpy).toHaveBeenCalledWith("online", expect.any(Function));
    expect(addSpy).toHaveBeenCalledWith("offline", expect.any(Function));

    unmount();

    expect(removeSpy).toHaveBeenCalledWith("online", expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith("offline", expect.any(Function));

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });
});
