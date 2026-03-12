/**
 * Unit tests for useSyncHandler hook.
 * Tests sync operation, toast messages, error handling, and callbacks.
 */

import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock useTransition to execute the callback synchronously
vi.mock("react", async () => {
  const actual = await vi.importActual("react");
  return {
    ...actual,
    useTransition: () => [false, (fn: () => void) => fn()],
  };
});

vi.mock("@/lib/google-drive-sync", () => ({
  syncFromGoogleDrive: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { useSyncHandler } from "@/hooks/use-sync-handler";
import { syncFromGoogleDrive } from "@/lib/google-drive-sync";
import { toast } from "sonner";

const mockSyncFromGoogleDrive = vi.mocked(syncFromGoogleDrive);

describe("useSyncHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns isSyncing and handleSync", () => {
    const { result } = renderHook(() => useSyncHandler());

    expect(result.current).toHaveProperty("isSyncing");
    expect(result.current).toHaveProperty("handleSync");
    expect(typeof result.current.handleSync).toBe("function");
  });

  describe("success", () => {
    it("shows toast with items created count", async () => {
      mockSyncFromGoogleDrive.mockResolvedValue({
        success: true,
        itemsCreated: 3,
        itemsUpdated: 0,
        itemsErrored: 0,
      });

      const { result } = renderHook(() => useSyncHandler());

      await act(async () => {
        result.current.handleSync();
      });

      expect(toast.success).toHaveBeenCalledWith("Sync complete: 3 created");
    });

    it("shows toast with items updated count", async () => {
      mockSyncFromGoogleDrive.mockResolvedValue({
        success: true,
        itemsCreated: 0,
        itemsUpdated: 5,
        itemsErrored: 0,
      });

      const { result } = renderHook(() => useSyncHandler());

      await act(async () => {
        result.current.handleSync();
      });

      expect(toast.success).toHaveBeenCalledWith("Sync complete: 5 updated");
    });

    it("shows toast with combined counts", async () => {
      mockSyncFromGoogleDrive.mockResolvedValue({
        success: true,
        itemsCreated: 2,
        itemsUpdated: 3,
        itemsErrored: 1,
      });

      const { result } = renderHook(() => useSyncHandler());

      await act(async () => {
        result.current.handleSync();
      });

      expect(toast.success).toHaveBeenCalledWith(
        "Sync complete: 2 created, 3 updated, 1 failed"
      );
    });

    it('shows "Already up to date" when no changes', async () => {
      mockSyncFromGoogleDrive.mockResolvedValue({
        success: true,
        itemsCreated: 0,
        itemsUpdated: 0,
        itemsErrored: 0,
      });

      const { result } = renderHook(() => useSyncHandler());

      await act(async () => {
        result.current.handleSync();
      });

      expect(toast.success).toHaveBeenCalledWith(
        "Sync complete: Already up to date"
      );
    });

    it("calls onSuccess callback on success", async () => {
      mockSyncFromGoogleDrive.mockResolvedValue({
        success: true,
        itemsCreated: 0,
        itemsUpdated: 0,
        itemsErrored: 0,
      });

      const onSuccess = vi.fn();
      const { result } = renderHook(() => useSyncHandler({ onSuccess }));

      await act(async () => {
        result.current.handleSync();
      });

      expect(onSuccess).toHaveBeenCalled();
    });
  });

  describe("errors", () => {
    it("shows specific message for ROOT_FOLDER_TRASHED", async () => {
      mockSyncFromGoogleDrive.mockResolvedValue({
        success: false,
        error: "ROOT_FOLDER_TRASHED",
      });

      const { result } = renderHook(() => useSyncHandler());

      await act(async () => {
        result.current.handleSync();
      });

      expect(toast.error).toHaveBeenCalledWith(
        "Sync paused: CanonCore folder is in Trash. Check settings to restore."
      );
    });

    it("shows specific message for ROOT_FOLDER_DELETED", async () => {
      mockSyncFromGoogleDrive.mockResolvedValue({
        success: false,
        error: "ROOT_FOLDER_DELETED",
      });

      const { result } = renderHook(() => useSyncHandler());

      await act(async () => {
        result.current.handleSync();
      });

      expect(toast.error).toHaveBeenCalledWith(
        "Sync paused: CanonCore folder was deleted. Reconnect in settings."
      );
    });

    it("shows generic error with retry action", async () => {
      mockSyncFromGoogleDrive.mockResolvedValue({
        success: false,
        error: "Connection timeout",
      });

      const { result } = renderHook(() => useSyncHandler());

      await act(async () => {
        result.current.handleSync();
      });

      expect(toast.error).toHaveBeenCalledWith("Connection timeout", {
        action: {
          label: "Retry",
          onClick: expect.any(Function),
        },
      });
    });

    it('shows "Sync failed" when error is empty', async () => {
      mockSyncFromGoogleDrive.mockResolvedValue({
        success: false,
        error: "",
      });

      const { result } = renderHook(() => useSyncHandler());

      await act(async () => {
        result.current.handleSync();
      });

      expect(toast.error).toHaveBeenCalledWith("Sync failed", {
        action: {
          label: "Retry",
          onClick: expect.any(Function),
        },
      });
    });

    it("does not call onSuccess on failure", async () => {
      mockSyncFromGoogleDrive.mockResolvedValue({
        success: false,
        error: "Some error",
      });

      const onSuccess = vi.fn();
      const { result } = renderHook(() => useSyncHandler({ onSuccess }));

      await act(async () => {
        result.current.handleSync();
      });

      expect(onSuccess).not.toHaveBeenCalled();
    });
  });
});
