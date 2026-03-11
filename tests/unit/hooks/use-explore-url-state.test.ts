/**
 * Unit tests for useExploreUrlState hook.
 * Tests sort, excludeMine, autoplay, and tab URL state management
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
    // inferParserType is a type-only export, no runtime value needed
  };
});

import { useExploreUrlState } from "@/hooks/use-explore-url-state";

describe("useExploreUrlState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState = {
      sort: "updated-desc",
      excludeMine: false,
      autoplay: true,
      tab: null,
    };
  });

  describe("initial state", () => {
    it("returns correct initial sortBy", () => {
      const { result } = renderHook(() => useExploreUrlState());
      expect(result.current.sortBy).toBe("updated-desc");
    });

    it("returns correct initial excludeMine", () => {
      const { result } = renderHook(() => useExploreUrlState());
      expect(result.current.excludeMine).toBe(false);
    });

    it("returns correct initial autoplay", () => {
      const { result } = renderHook(() => useExploreUrlState());
      expect(result.current.autoplay).toBe(true);
    });

    it("returns null tab initially", () => {
      const { result } = renderHook(() => useExploreUrlState());
      expect(result.current.tab).toBeNull();
    });
  });

  describe("setSortBy", () => {
    it("calls setState with the new sort value", () => {
      const { result } = renderHook(() => useExploreUrlState());

      act(() => {
        result.current.setSortBy("name-asc");
      });

      expect(mockSetState).toHaveBeenCalledWith({ sort: "name-asc" });
    });

    it("calls setState with 'created-desc'", () => {
      const { result } = renderHook(() => useExploreUrlState());

      act(() => {
        result.current.setSortBy("created-desc");
      });

      expect(mockSetState).toHaveBeenCalledWith({ sort: "created-desc" });
    });
  });

  describe("setExcludeMine", () => {
    it("calls setState with true", () => {
      const { result } = renderHook(() => useExploreUrlState());

      act(() => {
        result.current.setExcludeMine(true);
      });

      expect(mockSetState).toHaveBeenCalledWith({ excludeMine: true });
    });

    it("calls setState with false", () => {
      mockState = { ...mockState, excludeMine: true };
      const { result } = renderHook(() => useExploreUrlState());

      act(() => {
        result.current.setExcludeMine(false);
      });

      expect(mockSetState).toHaveBeenCalledWith({ excludeMine: false });
    });
  });

  describe("setTab", () => {
    it("calls setState with 'items'", () => {
      const { result } = renderHook(() => useExploreUrlState());

      act(() => {
        result.current.setTab("items");
      });

      expect(mockSetState).toHaveBeenCalledWith({ tab: "items" });
    });

    it("calls setState with 'playlists'", () => {
      const { result } = renderHook(() => useExploreUrlState());

      act(() => {
        result.current.setTab("playlists");
      });

      expect(mockSetState).toHaveBeenCalledWith({ tab: "playlists" });
    });

    it("calls setState with null to clear tab", () => {
      mockState = { ...mockState, tab: "items" };
      const { result } = renderHook(() => useExploreUrlState());

      act(() => {
        result.current.setTab(null);
      });

      expect(mockSetState).toHaveBeenCalledWith({ tab: null });
    });
  });

  describe("state reflection", () => {
    it("reflects updated sort value from state", () => {
      mockState = { ...mockState, sort: "name-desc" };
      const { result } = renderHook(() => useExploreUrlState());

      expect(result.current.sortBy).toBe("name-desc");
    });

    it("reflects updated excludeMine from state", () => {
      mockState = { ...mockState, excludeMine: true };
      const { result } = renderHook(() => useExploreUrlState());

      expect(result.current.excludeMine).toBe(true);
    });

    it("reflects updated autoplay from state", () => {
      mockState = { ...mockState, autoplay: false };
      const { result } = renderHook(() => useExploreUrlState());

      expect(result.current.autoplay).toBe(false);
    });

    it("reflects updated tab from state", () => {
      mockState = { ...mockState, tab: "playlists" };
      const { result } = renderHook(() => useExploreUrlState());

      expect(result.current.tab).toBe("playlists");
    });
  });
});
