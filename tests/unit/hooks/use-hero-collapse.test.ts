/**
 * Unit tests for useHeroCollapse hook.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useHeroCollapse } from "@/hooks/use-hero-collapse";

// Mock localStorage with proper store management
let store: Record<string, string> = {};

const localStorageMock = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    store[key] = value;
  }),
};

Object.defineProperty(window, "localStorage", { value: localStorageMock });

describe("useHeroCollapse", () => {
  beforeEach(() => {
    // Clear the store and restore mock implementations
    store = {};
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();
    // Restore default implementation that reads from store
    localStorageMock.getItem.mockImplementation(
      (key: string) => store[key] ?? null
    );
  });

  it("should default to expanded (false) for SSR safety", () => {
    const { result } = renderHook(() => useHeroCollapse());
    // Initial render is always false to prevent hydration mismatch
    expect(result.current.isCollapsed).toBe(false);
  });

  it("should toggle collapsed state", () => {
    const { result } = renderHook(() => useHeroCollapse());

    act(() => {
      result.current.toggleCollapse();
    });

    expect(result.current.isCollapsed).toBe(true);

    act(() => {
      result.current.toggleCollapse();
    });

    expect(result.current.isCollapsed).toBe(false);
  });

  it("should persist state to localStorage", () => {
    const { result } = renderHook(() => useHeroCollapse());

    act(() => {
      result.current.toggleCollapse();
    });

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      "canon-hero-collapsed",
      "true"
    );
  });

  it("should read initial state from localStorage on mount", async () => {
    localStorageMock.getItem.mockReturnValue("true");

    const { result } = renderHook(() => useHeroCollapse());

    // useEffect reads localStorage after initial render
    await waitFor(() => {
      expect(result.current.isCollapsed).toBe(true);
    });
  });

  it("should provide setCollapsed for direct control", () => {
    const { result } = renderHook(() => useHeroCollapse());

    act(() => {
      result.current.setCollapsed(true);
    });

    expect(result.current.isCollapsed).toBe(true);
  });

  it("should use localStorage read via useEffect (SSR-safe pattern)", async () => {
    // Pre-populate localStorage before hook mounts
    store["canon-hero-collapsed"] = "true";

    const { result } = renderHook(() => useHeroCollapse());

    // The hook should have read from localStorage via useEffect
    // This verifies the hook uses client-side-only localStorage read
    await waitFor(() => {
      expect(result.current.isCollapsed).toBe(true);
    });

    // Verify getItem was called (proving useEffect ran)
    expect(localStorageMock.getItem).toHaveBeenCalledWith(
      "canon-hero-collapsed"
    );
  });
});
