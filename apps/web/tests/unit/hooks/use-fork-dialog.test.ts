/**
 * Unit tests for useForkDialog hook.
 * Tests dialog state, fork operation, toast feedback, and callbacks.
 */

import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useForkDialog } from "@/hooks/use-fork-dialog";

vi.mock("@/lib/fork-actions", () => ({
  forkItem: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { forkItem } from "@/lib/fork-actions";
import { toast } from "sonner";

const mockForkItem = vi.mocked(forkItem);

describe("useForkDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("initial state", () => {
    it("starts with dialog closed, not forking, and empty item name", () => {
      const { result } = renderHook(() => useForkDialog());

      expect(result.current.open).toBe(false);
      expect(result.current.isForking).toBe(false);
      expect(result.current.itemName).toBe("");
    });
  });

  describe("openDialog", () => {
    it("sets item id, name, and opens dialog", () => {
      const { result } = renderHook(() => useForkDialog());

      act(() => {
        result.current.openDialog("item-1", "My Movie");
      });

      expect(result.current.open).toBe(true);
      expect(result.current.itemName).toBe("My Movie");
    });
  });

  describe("handleConfirm", () => {
    it("does nothing when itemId is null", async () => {
      const { result } = renderHook(() => useForkDialog());

      await act(async () => {
        await result.current.handleConfirm("parent-1");
      });

      expect(mockForkItem).not.toHaveBeenCalled();
    });

    it("calls forkItem with correct arguments", async () => {
      mockForkItem.mockResolvedValue({
        success: true,
        data: { itemId: "forked-1", name: "My Movie" },
      });

      const { result } = renderHook(() => useForkDialog());

      act(() => {
        result.current.openDialog("item-1", "My Movie");
      });

      await act(async () => {
        await result.current.handleConfirm("parent-1");
      });

      expect(mockForkItem).toHaveBeenCalledWith("item-1", "parent-1");
    });

    it("calls forkItem with null parentId", async () => {
      mockForkItem.mockResolvedValue({
        success: true,
        data: { itemId: "forked-1", name: "My Movie" },
      });

      const { result } = renderHook(() => useForkDialog());

      act(() => {
        result.current.openDialog("item-1", "My Movie");
      });

      await act(async () => {
        await result.current.handleConfirm(null);
      });

      expect(mockForkItem).toHaveBeenCalledWith("item-1", null);
    });

    it("shows success toast on successful fork", async () => {
      mockForkItem.mockResolvedValue({
        success: true,
        data: { itemId: "forked-1", name: "My Movie" },
      });

      const { result } = renderHook(() => useForkDialog());

      act(() => {
        result.current.openDialog("item-1", "My Movie");
      });

      await act(async () => {
        await result.current.handleConfirm(null);
      });

      expect(toast.success).toHaveBeenCalledWith(
        'Forked "My Movie" to your library'
      );
    });

    it("suppresses toast when suppressToast is true", async () => {
      mockForkItem.mockResolvedValue({
        success: true,
        data: { itemId: "forked-1", name: "My Movie" },
      });

      const { result } = renderHook(() =>
        useForkDialog({ suppressToast: true })
      );

      act(() => {
        result.current.openDialog("item-1", "My Movie");
      });

      await act(async () => {
        await result.current.handleConfirm(null);
      });

      expect(toast.success).not.toHaveBeenCalled();
    });

    it("calls onSuccess with result data", async () => {
      mockForkItem.mockResolvedValue({
        success: true,
        data: { itemId: "forked-1", name: "My Movie" },
      });

      const onSuccess = vi.fn();
      const { result } = renderHook(() => useForkDialog({ onSuccess }));

      act(() => {
        result.current.openDialog("item-1", "My Movie");
      });

      await act(async () => {
        await result.current.handleConfirm(null);
      });

      expect(onSuccess).toHaveBeenCalledWith({
        itemId: "forked-1",
        name: "My Movie",
      });
    });

    it("closes dialog on success", async () => {
      mockForkItem.mockResolvedValue({
        success: true,
        data: { itemId: "forked-1", name: "My Movie" },
      });

      const { result } = renderHook(() => useForkDialog());

      act(() => {
        result.current.openDialog("item-1", "My Movie");
      });

      expect(result.current.open).toBe(true);

      await act(async () => {
        await result.current.handleConfirm(null);
      });

      expect(result.current.open).toBe(false);
    });

    it("shows error toast on failure response", async () => {
      mockForkItem.mockResolvedValue({
        error: "Item already forked",
      });

      const { result } = renderHook(() => useForkDialog());

      act(() => {
        result.current.openDialog("item-1", "My Movie");
      });

      await act(async () => {
        await result.current.handleConfirm(null);
      });

      expect(toast.error).toHaveBeenCalledWith("Item already forked");
    });

    it("shows default error toast when no error message", async () => {
      mockForkItem.mockResolvedValue({
        error: undefined as unknown as string,
      });

      const { result } = renderHook(() => useForkDialog());

      act(() => {
        result.current.openDialog("item-1", "My Movie");
      });

      await act(async () => {
        await result.current.handleConfirm(null);
      });

      expect(toast.error).toHaveBeenCalledWith("Failed to fork item");
    });

    it("shows error toast on exception", async () => {
      mockForkItem.mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() => useForkDialog());

      act(() => {
        result.current.openDialog("item-1", "My Movie");
      });

      await act(async () => {
        await result.current.handleConfirm(null);
      });

      expect(toast.error).toHaveBeenCalledWith("Failed to fork item");
    });

    it("sets isForking during operation", async () => {
      let resolvePromise!: (value: {
        success: true;
        data: { itemId: string; name: string };
      }) => void;
      mockForkItem.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolvePromise = resolve;
          })
      );

      const { result } = renderHook(() => useForkDialog());

      act(() => {
        result.current.openDialog("item-1", "My Movie");
      });

      // Start the confirm without awaiting
      let confirmPromise: Promise<void>;
      act(() => {
        confirmPromise = result.current.handleConfirm(null);
      });

      expect(result.current.isForking).toBe(true);

      // Resolve the fork
      await act(async () => {
        resolvePromise({
          success: true,
          data: { itemId: "forked-1", name: "My Movie" },
        });
        await confirmPromise!;
      });

      expect(result.current.isForking).toBe(false);
    });

    it("does not call onSuccess when result has no data", async () => {
      mockForkItem.mockResolvedValue({
        success: true,
      });

      const onSuccess = vi.fn();
      const { result } = renderHook(() => useForkDialog({ onSuccess }));

      act(() => {
        result.current.openDialog("item-1", "My Movie");
      });

      await act(async () => {
        await result.current.handleConfirm(null);
      });

      expect(onSuccess).not.toHaveBeenCalled();
    });
  });
});
