/**
 * Unit tests for SyncAllButton component.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SyncAllButton } from "@/components/sftp/sync-all-button";

vi.mock("@/lib/sftp-actions", () => ({
  syncAllConnections: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { syncAllConnections } from "@/lib/sftp-actions";
import { toast } from "sonner";

describe("SyncAllButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders with 'Sync All' text when multiple connections", () => {
    render(<SyncAllButton connectionCount={2} />);
    expect(
      screen.getByRole("button", { name: /sync all/i })
    ).toBeInTheDocument();
  });

  it("renders with 'Sync' text when single connection", () => {
    render(<SyncAllButton connectionCount={1} />);
    const button = screen.getByRole("button");
    expect(button).toHaveTextContent("Sync");
    expect(button).not.toHaveTextContent("Sync All");
  });

  it("is disabled when connectionCount is 0", () => {
    render(<SyncAllButton connectionCount={0} />);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("shows syncing state when clicked", async () => {
    vi.mocked(syncAllConnections).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    const user = userEvent.setup();
    render(<SyncAllButton connectionCount={2} />);

    await user.click(screen.getByRole("button"));

    expect(screen.getByText(/syncing/i)).toBeInTheDocument();
  });

  it("shows success toast on completion", async () => {
    vi.mocked(syncAllConnections).mockResolvedValue({
      success: true,
      data: {
        totalConnections: 2,
        successfulSyncs: 2,
        failedSyncs: 0,
        results: [
          {
            connectionId: "1",
            connectionName: "A",
            success: true,
            created: 1,
            updated: 0,
            deleted: 0,
          },
          {
            connectionId: "2",
            connectionName: "B",
            success: true,
            created: 0,
            updated: 1,
            deleted: 0,
          },
        ],
      },
    });

    const user = userEvent.setup();
    render(<SyncAllButton connectionCount={2} />);

    await user.click(screen.getByRole("button"));

    expect(toast.success).toHaveBeenCalled();
  });

  it("shows error toast when sync fails", async () => {
    vi.mocked(syncAllConnections).mockResolvedValue({
      success: false,
      error: "Connection failed",
    });

    const user = userEvent.setup();
    render(<SyncAllButton connectionCount={2} />);

    await user.click(screen.getByRole("button"));

    expect(toast.error).toHaveBeenCalled();
  });

  it("calls onSyncComplete callback when provided", async () => {
    const onSyncComplete = vi.fn();
    vi.mocked(syncAllConnections).mockResolvedValue({
      success: true,
      data: {
        totalConnections: 1,
        successfulSyncs: 1,
        failedSyncs: 0,
        results: [],
      },
    });

    const user = userEvent.setup();
    render(
      <SyncAllButton connectionCount={1} onSyncComplete={onSyncComplete} />
    );

    await user.click(screen.getByRole("button"));

    expect(onSyncComplete).toHaveBeenCalled();
  });
});
