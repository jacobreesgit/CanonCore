/**
 * Unit tests for useItemsUrlState hook.
 * Tests sort, filter, view mode, and tab URL state management
 * with nuqs integration mocked at the module level.
 */

import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock nuqs - the hook uses useQueryStates which returns [state, setState]
const mockSetState = vi.fn();
let mockState: Record<string, unknown> = {};

vi.mock("nuqs", () => ({
  useQueryStates: () => [mockState, mockSetState],
}));

vi.mock("@/lib/item-utils", () => ({
  toggleContentFilter: vi.fn((filters: string[], filter: string) => {
    if (filters.includes(filter))
      return filters.filter((f: string) => f !== filter);
    return [...filters, filter];
  }),
}));

// Mock nuqs/server to prevent import errors from search-params
vi.mock("nuqs/server", () => {
  const createParser = (defaultVal?: unknown) => ({
    parse: vi.fn(),
    defaultValue: defaultVal,
    withDefault: (val: unknown) => createParser(val),
  });
  return {
    parseAsStringLiteral: () => createParser(),
    parseAsArrayOf: () => createParser(),
    parseAsBoolean: createParser(),
  };
});

import { useItemsUrlState } from "@/hooks/use-items-url-state";

describe("useItemsUrlState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState = {
      sort: "custom",
      filter: [],
      view: "grid",
      tab: null,
    };
    // Mock localStorage to prevent side effects
    vi.spyOn(Storage.prototype, "getItem").mockReturnValue(null);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {});
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {});
  });

  describe("initial state", () => {
    it("returns correct initial sortBy", () => {
      const { result } = renderHook(() => useItemsUrlState());
      expect(result.current.sortBy).toBe("custom");
    });

    it("returns correct initial filters", () => {
      const { result } = renderHook(() => useItemsUrlState());
      expect(result.current.filters).toEqual([]);
    });

    it("returns correct initial viewMode", () => {
      const { result } = renderHook(() => useItemsUrlState());
      expect(result.current.viewMode).toBe("grid");
    });

    it("returns null tab initially", () => {
      const { result } = renderHook(() => useItemsUrlState());
      expect(result.current.tab).toBeNull();
    });
  });

  describe("setSortBy", () => {
    it("calls setState with the new sort value", () => {
      const { result } = renderHook(() => useItemsUrlState());

      act(() => {
        result.current.setSortBy("name-asc");
      });

      expect(mockSetState).toHaveBeenCalledWith({ sort: "name-asc" });
    });
  });

  describe("toggleFilter", () => {
    it("calls setState with a functional update", () => {
      const { result } = renderHook(() => useItemsUrlState());

      act(() => {
        result.current.toggleFilter("has-files");
      });

      expect(mockSetState).toHaveBeenCalledWith(expect.any(Function));
    });

    it("adds filter when not present", () => {
      const { result } = renderHook(() => useItemsUrlState());

      act(() => {
        result.current.toggleFilter("has-files");
      });

      // Get the functional updater and call it with current state
      const updater = mockSetState.mock.calls[0][0];
      const newState = updater({
        sort: "custom",
        filter: [],
        view: "grid",
        tab: null,
      });

      expect(newState.filter).toEqual(["has-files"]);
    });

    it("removes filter when already present", () => {
      mockState = {
        sort: "custom",
        filter: ["has-files"],
        view: "grid",
        tab: null,
      };
      const { result } = renderHook(() => useItemsUrlState());

      act(() => {
        result.current.toggleFilter("has-files");
      });

      const updater = mockSetState.mock.calls[0][0];
      const newState = updater({
        sort: "custom",
        filter: ["has-files"],
        view: "grid",
        tab: null,
      });

      expect(newState.filter).toEqual([]);
    });
  });

  describe("clearFilters", () => {
    it("calls setState with a functional update that clears filters", () => {
      mockState = {
        sort: "custom",
        filter: ["has-files", "synced"],
        view: "grid",
        tab: null,
      };
      const { result } = renderHook(() => useItemsUrlState());

      act(() => {
        result.current.clearFilters();
      });

      expect(mockSetState).toHaveBeenCalledWith(expect.any(Function));

      const updater = mockSetState.mock.calls[0][0];
      const newState = updater({
        sort: "custom",
        filter: ["has-files", "synced"],
        view: "grid",
        tab: null,
      });

      expect(newState.filter).toEqual([]);
    });
  });

  describe("setViewMode", () => {
    it("calls setState with the new view value", () => {
      const { result } = renderHook(() => useItemsUrlState());

      act(() => {
        result.current.setViewMode("tree");
      });

      expect(mockSetState).toHaveBeenCalledWith({ view: "tree" });
    });
  });

  describe("setTab", () => {
    it("calls setState with the new tab value", () => {
      const { result } = renderHook(() => useItemsUrlState());

      act(() => {
        result.current.setTab("about");
      });

      expect(mockSetState).toHaveBeenCalledWith({ tab: "about" });
    });

    it("calls setState with null to clear tab", () => {
      mockState = { sort: "custom", filter: [], view: "grid", tab: "about" };
      const { result } = renderHook(() => useItemsUrlState());

      act(() => {
        result.current.setTab(null);
      });

      expect(mockSetState).toHaveBeenCalledWith({ tab: null });
    });
  });

  describe("hasActiveFilters", () => {
    it("is false when no filters are active", () => {
      mockState = { sort: "custom", filter: [], view: "grid", tab: null };
      const { result } = renderHook(() => useItemsUrlState());

      expect(result.current.hasActiveFilters).toBe(false);
    });

    it("is true when filters are active", () => {
      mockState = {
        sort: "custom",
        filter: ["has-files"],
        view: "grid",
        tab: null,
      };
      const { result } = renderHook(() => useItemsUrlState());

      expect(result.current.hasActiveFilters).toBe(true);
    });

    it("is true when multiple filters are active", () => {
      mockState = {
        sort: "custom",
        filter: ["has-files", "synced"],
        view: "grid",
        tab: null,
      };
      const { result } = renderHook(() => useItemsUrlState());

      expect(result.current.hasActiveFilters).toBe(true);
    });
  });

  describe("isCustomSort", () => {
    it("is true when sort is 'custom'", () => {
      mockState = { sort: "custom", filter: [], view: "grid", tab: null };
      const { result } = renderHook(() => useItemsUrlState());

      expect(result.current.isCustomSort).toBe(true);
    });

    it("is false when sort is not 'custom'", () => {
      mockState = { sort: "name-asc", filter: [], view: "grid", tab: null };
      const { result } = renderHook(() => useItemsUrlState());

      expect(result.current.isCustomSort).toBe(false);
    });

    it("is false when sort is 'updated-desc'", () => {
      mockState = { sort: "updated-desc", filter: [], view: "grid", tab: null };
      const { result } = renderHook(() => useItemsUrlState());

      expect(result.current.isCustomSort).toBe(false);
    });
  });
});
