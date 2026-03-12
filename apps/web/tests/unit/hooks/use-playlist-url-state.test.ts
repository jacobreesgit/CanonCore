/**
 * Unit tests for usePlaylistUrlState hook.
 * Tests sort and tab URL state management for playlist detail pages
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

// Mock nuqs/server to prevent import errors from playlist-search-params
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

import { usePlaylistUrlState } from "@/hooks/use-playlist-url-state";

describe("usePlaylistUrlState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState = {
      sort: "custom",
      tab: null,
    };
  });

  describe("initial state", () => {
    it("returns correct initial sortBy", () => {
      const { result } = renderHook(() => usePlaylistUrlState());
      expect(result.current.sortBy).toBe("custom");
    });

    it("returns null tab initially", () => {
      const { result } = renderHook(() => usePlaylistUrlState());
      expect(result.current.tab).toBeNull();
    });

    it("returns isCustomSort as true for default sort", () => {
      const { result } = renderHook(() => usePlaylistUrlState());
      expect(result.current.isCustomSort).toBe(true);
    });
  });

  describe("setSortBy", () => {
    it("calls setState with the new sort value", () => {
      const { result } = renderHook(() => usePlaylistUrlState());

      act(() => {
        result.current.setSortBy("name-asc");
      });

      expect(mockSetState).toHaveBeenCalledWith({ sort: "name-asc" });
    });

    it("calls setState with 'updated-desc'", () => {
      const { result } = renderHook(() => usePlaylistUrlState());

      act(() => {
        result.current.setSortBy("updated-desc");
      });

      expect(mockSetState).toHaveBeenCalledWith({ sort: "updated-desc" });
    });

    it("calls setState with 'custom'", () => {
      mockState = { sort: "name-asc", tab: null };
      const { result } = renderHook(() => usePlaylistUrlState());

      act(() => {
        result.current.setSortBy("custom");
      });

      expect(mockSetState).toHaveBeenCalledWith({ sort: "custom" });
    });
  });

  describe("setTab", () => {
    it("calls setState with 'contents'", () => {
      const { result } = renderHook(() => usePlaylistUrlState());

      act(() => {
        result.current.setTab("contents");
      });

      expect(mockSetState).toHaveBeenCalledWith({ tab: "contents" });
    });

    it("calls setState with 'about'", () => {
      const { result } = renderHook(() => usePlaylistUrlState());

      act(() => {
        result.current.setTab("about");
      });

      expect(mockSetState).toHaveBeenCalledWith({ tab: "about" });
    });
  });

  describe("isCustomSort", () => {
    it("is true when sort is 'custom'", () => {
      mockState = { sort: "custom", tab: null };
      const { result } = renderHook(() => usePlaylistUrlState());

      expect(result.current.isCustomSort).toBe(true);
    });

    it("is false when sort is 'name-asc'", () => {
      mockState = { sort: "name-asc", tab: null };
      const { result } = renderHook(() => usePlaylistUrlState());

      expect(result.current.isCustomSort).toBe(false);
    });

    it("is false when sort is 'updated-desc'", () => {
      mockState = { sort: "updated-desc", tab: null };
      const { result } = renderHook(() => usePlaylistUrlState());

      expect(result.current.isCustomSort).toBe(false);
    });
  });

  describe("state reflection", () => {
    it("reflects updated sort value from state", () => {
      mockState = { sort: "name-asc", tab: null };
      const { result } = renderHook(() => usePlaylistUrlState());

      expect(result.current.sortBy).toBe("name-asc");
    });

    it("reflects updated tab from state", () => {
      mockState = { sort: "custom", tab: "about" };
      const { result } = renderHook(() => usePlaylistUrlState());

      expect(result.current.tab).toBe("about");
    });
  });
});
