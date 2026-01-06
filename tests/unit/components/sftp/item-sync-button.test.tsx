/**
 * Unit tests for ItemSyncButton component.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ItemSyncButton } from "@/components/sftp/item-sync-button";

vi.mock("@/lib/sftp-actions", () => ({
  syncItemTree: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { syncItemTree } from "@/lib/sftp-actions";
import { toast } from "sonner";

describe("ItemSyncButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders with 'Sync' text", () => {
    render(<ItemSyncButton itemId="item-1" itemName="Movies" />);
    expect(screen.getByRole("button", { name: /sync/i })).toBeInTheDocument();
  });

  it("calls syncItemTree with correct itemId when clicked", async () => {
    vi.mocked(syncItemTree).mockResolvedValue({
      success: true,
      data: {
        itemId: "item-1",
        itemName: "Movies",
        created: 5,
        updated: 2,
        deleted: 1,
      },
    });

    const user = userEvent.setup();
    render(<ItemSyncButton itemId="item-1" itemName="Movies" />);

    await user.click(screen.getByRole("button"));

    expect(syncItemTree).toHaveBeenCalledWith("item-1");
    expect(toast.success).toHaveBeenCalled();
  });

  it("shows syncing state when clicked", async () => {
    vi.mocked(syncItemTree).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    const user = userEvent.setup();
    render(<ItemSyncButton itemId="item-1" itemName="Movies" />);

    await user.click(screen.getByRole("button"));

    expect(screen.getByText(/syncing/i)).toBeInTheDocument();
  });

  it("shows error toast when sync fails", async () => {
    vi.mocked(syncItemTree).mockResolvedValue({
      success: false,
      error: "Item not found",
    });

    const user = userEvent.setup();
    render(<ItemSyncButton itemId="item-1" itemName="Movies" />);

    await user.click(screen.getByRole("button"));

    expect(toast.error).toHaveBeenCalled();
  });

  it("calls onSyncComplete callback when provided", async () => {
    const onSyncComplete = vi.fn();
    vi.mocked(syncItemTree).mockResolvedValue({
      success: true,
      data: {
        itemId: "item-1",
        itemName: "Movies",
        created: 0,
        updated: 0,
        deleted: 0,
      },
    });

    const user = userEvent.setup();
    render(
      <ItemSyncButton
        itemId="item-1"
        itemName="Movies"
        onSyncComplete={onSyncComplete}
      />
    );

    await user.click(screen.getByRole("button"));

    expect(onSyncComplete).toHaveBeenCalled();
  });
});
