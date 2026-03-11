/**
 * Unit tests for useGoToItem hook.
 */

import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useGoToItem } from "@/hooks/use-go-to-item";
import { getFirstIncompleteItem } from "@/lib/item-actions";
import type { NextItem } from "@/lib/types";

// Mock next/navigation
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock item-actions
vi.mock("@/lib/item-actions", () => ({
  getFirstIncompleteItem: vi.fn(),
}));

describe("useGoToItem", () => {
  const mockNextItem: NextItem = {
    id: "item-1",
    name: "Episode 1",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("initial state", () => {
    it("starts with undefined nextItem while fetch is pending", () => {
      vi.mocked(getFirstIncompleteItem).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      const { result } = renderHook(() => useGoToItem());

      // After effect starts, nextItem is still undefined (not resolved yet)
      // and isLoading is true
      expect(result.current.nextItem).toBeUndefined();
      expect(result.current.isLoading).toBe(true);
    });
  });

  describe("fetching", () => {
    it("sets isLoading while fetching", async () => {
      let resolvePromise!: (value: {
        success: true;
        data: NextItem | null;
      }) => void;
      vi.mocked(getFirstIncompleteItem).mockImplementation(
        () =>
          new Promise((resolve) => {
            resolvePromise = resolve;
          })
      );

      const { result } = renderHook(() => useGoToItem());

      // Wait for effect to start loading
      await waitFor(() => {
        expect(result.current.isLoading).toBe(true);
      });

      // Resolve the promise
      await act(async () => {
        resolvePromise!({ success: true, data: mockNextItem });
      });

      expect(result.current.isLoading).toBe(false);
    });

    it("fetches on mount when enabled", async () => {
      vi.mocked(getFirstIncompleteItem).mockResolvedValue({
        success: true,
        data: mockNextItem,
      });

      renderHook(() => useGoToItem());

      await waitFor(() => {
        expect(getFirstIncompleteItem).toHaveBeenCalledWith(undefined);
      });
    });

    it("passes parentId to getFirstIncompleteItem", async () => {
      vi.mocked(getFirstIncompleteItem).mockResolvedValue({
        success: true,
        data: mockNextItem,
      });

      renderHook(() => useGoToItem({ parentId: "parent-1" }));

      await waitFor(() => {
        expect(getFirstIncompleteItem).toHaveBeenCalledWith("parent-1");
      });
    });

    it("sets nextItem on successful fetch", async () => {
      vi.mocked(getFirstIncompleteItem).mockResolvedValue({
        success: true,
        data: mockNextItem,
      });

      const { result } = renderHook(() => useGoToItem());

      await waitFor(() => {
        expect(result.current.nextItem).toEqual(mockNextItem);
      });
    });

    it("sets nextItem to null when all items complete", async () => {
      vi.mocked(getFirstIncompleteItem).mockResolvedValue({
        success: true,
        data: null,
      });

      const { result } = renderHook(() => useGoToItem());

      await waitFor(() => {
        expect(result.current.nextItem).toBeNull();
      });
    });

    it("sets nextItem to null on error response", async () => {
      vi.mocked(getFirstIncompleteItem).mockResolvedValue({
        error: "Unauthorized",
      });

      const { result } = renderHook(() => useGoToItem());

      await waitFor(() => {
        expect(result.current.nextItem).toBeNull();
      });
    });

    it("sets nextItem to null on fetch exception", async () => {
      vi.mocked(getFirstIncompleteItem).mockRejectedValue(
        new Error("Network error")
      );

      const { result } = renderHook(() => useGoToItem());

      await waitFor(() => {
        expect(result.current.nextItem).toBeNull();
      });
    });
  });

  describe("enabled option", () => {
    it("does not fetch when enabled is false", async () => {
      vi.mocked(getFirstIncompleteItem).mockResolvedValue({
        success: true,
        data: mockNextItem,
      });

      const { result } = renderHook(() => useGoToItem({ enabled: false }));

      // Give time for any potential fetch
      await new Promise((r) => setTimeout(r, 50));

      expect(getFirstIncompleteItem).not.toHaveBeenCalled();
      expect(result.current.nextItem).toBeUndefined();
      expect(result.current.isLoading).toBe(false);
    });

    it("fetches when enabled changes from false to true", async () => {
      vi.mocked(getFirstIncompleteItem).mockResolvedValue({
        success: true,
        data: mockNextItem,
      });

      const { result, rerender } = renderHook(
        ({ enabled }) => useGoToItem({ enabled }),
        { initialProps: { enabled: false } }
      );

      // Initially should not fetch
      await new Promise((r) => setTimeout(r, 50));
      expect(getFirstIncompleteItem).not.toHaveBeenCalled();

      // Enable fetching
      rerender({ enabled: true });

      await waitFor(() => {
        expect(getFirstIncompleteItem).toHaveBeenCalled();
        expect(result.current.nextItem).toEqual(mockNextItem);
      });
    });
  });

  describe("parentId changes", () => {
    it("refetches when parentId changes", async () => {
      vi.mocked(getFirstIncompleteItem).mockResolvedValue({
        success: true,
        data: mockNextItem,
      });

      const { rerender } = renderHook(
        ({ parentId }) => useGoToItem({ parentId }),
        { initialProps: { parentId: "parent-1" } }
      );

      await waitFor(() => {
        expect(getFirstIncompleteItem).toHaveBeenCalledWith("parent-1");
      });

      // Change parentId
      rerender({ parentId: "parent-2" });

      await waitFor(() => {
        expect(getFirstIncompleteItem).toHaveBeenCalledWith("parent-2");
      });
    });
  });

  describe("goToNext", () => {
    it("navigates to the item page when username provided", async () => {
      vi.mocked(getFirstIncompleteItem).mockResolvedValue({
        success: true,
        data: mockNextItem,
      });

      const { result } = renderHook(() =>
        useGoToItem({ username: "testuser" })
      );

      await waitFor(() => {
        expect(result.current.nextItem).toEqual(mockNextItem);
      });

      act(() => {
        result.current.goToNext(mockNextItem);
      });

      expect(mockPush).toHaveBeenCalledWith("/u/testuser/item-1");
    });

    it("navigates to different items", () => {
      vi.mocked(getFirstIncompleteItem).mockResolvedValue({
        success: true,
        data: null,
      });

      const { result } = renderHook(() =>
        useGoToItem({ username: "testuser" })
      );

      act(() => {
        result.current.goToNext({ id: "other-item", name: "Other" });
      });

      expect(mockPush).toHaveBeenCalledWith("/u/testuser/other-item");
    });

    it("does not navigate when username not provided", async () => {
      vi.mocked(getFirstIncompleteItem).mockResolvedValue({
        success: true,
        data: mockNextItem,
      });

      const { result } = renderHook(() => useGoToItem());

      await waitFor(() => {
        expect(result.current.nextItem).toEqual(mockNextItem);
      });

      act(() => {
        result.current.goToNext(mockNextItem);
      });

      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  describe("refetch", () => {
    it("refetches the first incomplete item", async () => {
      vi.mocked(getFirstIncompleteItem)
        .mockResolvedValueOnce({
          success: true,
          data: null,
        })
        .mockResolvedValueOnce({
          success: true,
          data: mockNextItem,
        });

      const { result } = renderHook(() => useGoToItem());

      // First fetch returns null
      await waitFor(() => {
        expect(result.current.nextItem).toBeNull();
      });

      // Refetch returns item
      await act(async () => {
        await result.current.refetch();
      });

      expect(result.current.nextItem).toEqual(mockNextItem);
      expect(getFirstIncompleteItem).toHaveBeenCalledTimes(2);
    });

    it("does not refetch when enabled is false", async () => {
      vi.mocked(getFirstIncompleteItem).mockResolvedValue({
        success: true,
        data: mockNextItem,
      });

      const { result } = renderHook(() => useGoToItem({ enabled: false }));

      // Give time for any potential initial fetch
      await new Promise((r) => setTimeout(r, 50));

      await act(async () => {
        await result.current.refetch();
      });

      // Should still not have been called
      expect(getFirstIncompleteItem).not.toHaveBeenCalled();
    });
  });
});
