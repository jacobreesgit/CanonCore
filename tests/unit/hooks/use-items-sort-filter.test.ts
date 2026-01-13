/**
 * Unit tests for useItemsSortFilter hook.
 * @vitest-environment jsdom
 */

import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { useItemsSortFilter } from "@/hooks/use-items-sort-filter";

describe("useItemsSortFilter", () => {
  let store: Record<string, string> = {};
  let storageListeners: Set<() => void> = new Set();
  let originalLocalStorage: Storage;

  // Setup mocks before each test
  beforeEach(() => {
    store = {};
    storageListeners = new Set();

    // Save original localStorage
    originalLocalStorage = window.localStorage;

    // Create mock localStorage
    const mockLocalStorage = {
      getItem: vi.fn((key: string) => store[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        store[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete store[key];
      }),
      clear: vi.fn(() => {
        store = {};
      }),
      key: vi.fn(() => null),
      length: 0,
    };

    // Replace localStorage
    Object.defineProperty(window, "localStorage", {
      value: mockLocalStorage,
      writable: true,
      configurable: true,
    });

    // Mock addEventListener to track storage listeners
    vi.spyOn(window, "addEventListener").mockImplementation(
      (type: string, listener: EventListenerOrEventListenerObject) => {
        if (type === "storage" && typeof listener === "function") {
          storageListeners.add(listener as () => void);
        }
      }
    );

    // Mock removeEventListener
    vi.spyOn(window, "removeEventListener").mockImplementation(
      (type: string, listener: EventListenerOrEventListenerObject) => {
        if (type === "storage" && typeof listener === "function") {
          storageListeners.delete(listener as () => void);
        }
      }
    );

    // Mock dispatchEvent to trigger storage listeners
    vi.spyOn(window, "dispatchEvent").mockImplementation((event: Event) => {
      if (event.type === "storage") {
        storageListeners.forEach((listener) => listener());
      }
      return true;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // Restore original localStorage
    Object.defineProperty(window, "localStorage", {
      value: originalLocalStorage,
      writable: true,
      configurable: true,
    });
  });

  it("returns default sort and filter values on initial render", () => {
    const { result } = renderHook(() => useItemsSortFilter());

    expect(result.current.sortBy).toBe("custom");
    expect(result.current.filterBy).toBe("all");
  });

  it("updates sort option and persists to localStorage", () => {
    const { result } = renderHook(() => useItemsSortFilter());

    act(() => {
      result.current.setSortBy("name-asc");
    });

    expect(result.current.sortBy).toBe("name-asc");
    expect(window.localStorage.setItem).toHaveBeenCalledWith(
      "canoncore-items-sort",
      "name-asc"
    );
  });

  it("updates filter option and persists to localStorage", () => {
    const { result } = renderHook(() => useItemsSortFilter());

    act(() => {
      result.current.setFilterBy("has-files");
    });

    expect(result.current.filterBy).toBe("has-files");
    expect(window.localStorage.setItem).toHaveBeenCalledWith(
      "canoncore-items-filter",
      "has-files"
    );
  });

  it("loads persisted values from localStorage", () => {
    // Set up localStorage before hook renders
    store["canoncore-items-sort"] = "name-desc";
    store["canoncore-items-filter"] = "synced";

    const { result } = renderHook(() => useItemsSortFilter());

    expect(result.current.sortBy).toBe("name-desc");
    expect(result.current.filterBy).toBe("synced");
  });

  it("ignores invalid localStorage values and uses defaults", () => {
    store["canoncore-items-sort"] = "invalid-sort";
    store["canoncore-items-filter"] = "invalid-filter";

    const { result } = renderHook(() => useItemsSortFilter());

    expect(result.current.sortBy).toBe("custom");
    expect(result.current.filterBy).toBe("all");
  });

  it("returns isCustomSort helper", () => {
    const { result } = renderHook(() => useItemsSortFilter());

    expect(result.current.isCustomSort).toBe(true);

    act(() => {
      result.current.setSortBy("name-asc");
    });

    expect(result.current.isCustomSort).toBe(false);
  });

  it("returns hasActiveFilter helper", () => {
    const { result } = renderHook(() => useItemsSortFilter());

    expect(result.current.hasActiveFilter).toBe(false);

    act(() => {
      result.current.setFilterBy("has-files");
    });

    expect(result.current.hasActiveFilter).toBe(true);
  });

  it("provides reset function", () => {
    const { result } = renderHook(() => useItemsSortFilter());

    act(() => {
      result.current.setSortBy("name-asc");
      result.current.setFilterBy("has-files");
    });

    expect(result.current.sortBy).toBe("name-asc");
    expect(result.current.filterBy).toBe("has-files");

    act(() => {
      result.current.reset();
    });

    expect(result.current.sortBy).toBe("custom");
    expect(result.current.filterBy).toBe("all");
  });

  it("dispatches storage event when updating sort", () => {
    const { result } = renderHook(() => useItemsSortFilter());

    act(() => {
      result.current.setSortBy("name-asc");
    });

    expect(window.dispatchEvent).toHaveBeenCalled();
  });

  it("dispatches storage event when updating filter", () => {
    const { result } = renderHook(() => useItemsSortFilter());

    act(() => {
      result.current.setFilterBy("has-files");
    });

    expect(window.dispatchEvent).toHaveBeenCalled();
  });
});
