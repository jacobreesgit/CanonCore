/**
 * Unit tests for SyncButton component.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SyncButton } from "@/components/sftp/sync-button";

vi.mock("@/lib/sftp-actions", () => ({
  syncFromSftp: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { syncFromSftp } from "@/lib/sftp-actions";
import { toast } from "sonner";

describe("SyncButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("label prop", () => {
    it("should show default label 'Sync' when no label provided", () => {
      render(<SyncButton connectionId="123" />);
      expect(screen.getByRole("button")).toHaveTextContent("Sync");
    });

    it("should show custom label when provided", () => {
      render(<SyncButton connectionId="123" label="Sync Connection" />);
      expect(screen.getByRole("button")).toHaveTextContent("Sync Connection");
    });

    it("should show 'Syncing...' during sync regardless of custom label", async () => {
      vi.mocked(syncFromSftp).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      const user = userEvent.setup();
      render(<SyncButton connectionId="123" label="Sync Connection" />);

      await user.click(screen.getByRole("button"));

      expect(screen.getByText("Syncing...")).toBeInTheDocument();
    });
  });

  describe("sync behavior", () => {
    it("shows success toast on completion", async () => {
      vi.mocked(syncFromSftp).mockResolvedValue({
        success: true,
        data: {
          created: 1,
          updated: 0,
          deleted: 0,
        },
      });

      const user = userEvent.setup();
      render(<SyncButton connectionId="123" />);

      await user.click(screen.getByRole("button"));

      expect(toast.success).toHaveBeenCalled();
    });

    it("shows error toast when sync fails", async () => {
      vi.mocked(syncFromSftp).mockResolvedValue({
        success: false,
        error: "Connection failed",
      });

      const user = userEvent.setup();
      render(<SyncButton connectionId="123" />);

      await user.click(screen.getByRole("button"));

      expect(toast.error).toHaveBeenCalled();
    });

    it("calls onSyncComplete callback when provided", async () => {
      const onSyncComplete = vi.fn();
      vi.mocked(syncFromSftp).mockResolvedValue({
        success: true,
        data: {
          created: 0,
          updated: 0,
          deleted: 0,
        },
      });

      const user = userEvent.setup();
      render(<SyncButton connectionId="123" onSyncComplete={onSyncComplete} />);

      await user.click(screen.getByRole("button"));

      expect(onSyncComplete).toHaveBeenCalled();
    });

    it("disables button while syncing", async () => {
      vi.mocked(syncFromSftp).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      const user = userEvent.setup();
      render(<SyncButton connectionId="123" />);

      await user.click(screen.getByRole("button"));

      expect(screen.getByRole("button")).toBeDisabled();
    });
  });
});
