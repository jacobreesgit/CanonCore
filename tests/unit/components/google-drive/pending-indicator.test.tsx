/**
 * Unit tests for PendingIndicator component.
 * Tests display of pending queue operations count.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { PendingIndicator } from "@/components/google-drive/pending-indicator";

vi.mock("@/lib/sync-queue", () => ({
  getPendingCount: vi.fn(),
  isQueueAvailable: vi.fn(),
}));

import { getPendingCount, isQueueAvailable } from "@/lib/sync-queue";

describe("PendingIndicator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isQueueAvailable).mockResolvedValue(true);
  });

  it("shows count of pending operations", async () => {
    vi.mocked(getPendingCount).mockResolvedValue(3);

    render(<PendingIndicator />);

    await waitFor(() => {
      expect(screen.getByText("3")).toBeInTheDocument();
      expect(screen.getByText(/pending/i)).toBeInTheDocument();
    });
  });

  it("hides when no pending operations", async () => {
    vi.mocked(getPendingCount).mockResolvedValue(0);

    const { container } = render(<PendingIndicator />);

    await waitFor(() => {
      expect(container.querySelector("[data-pending-indicator]")).toBeNull();
    });
  });

  it("shows singular form for single operation", async () => {
    vi.mocked(getPendingCount).mockResolvedValue(1);

    render(<PendingIndicator />);

    await waitFor(() => {
      expect(screen.getByText("1")).toBeInTheDocument();
      expect(screen.getByText(/pending/i)).toBeInTheDocument();
    });
  });

  it("hides when queue is not available", async () => {
    vi.mocked(isQueueAvailable).mockResolvedValue(false);
    vi.mocked(getPendingCount).mockResolvedValue(5);

    const { container } = render(<PendingIndicator />);

    await waitFor(() => {
      expect(container.querySelector("[data-pending-indicator]")).toBeNull();
    });
  });

  it("displays multiple pending operations", async () => {
    vi.mocked(getPendingCount).mockResolvedValue(15);

    render(<PendingIndicator />);

    await waitFor(() => {
      expect(screen.getByText("15")).toBeInTheDocument();
      expect(screen.getByText(/pending/i)).toBeInTheDocument();
    });
  });
});
