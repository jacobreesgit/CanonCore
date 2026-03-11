/**
 * Unit tests for SyncHistory component.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { SyncHistory } from "@/components/google-drive/sync-history";
import { SyncLogAction, SyncLogStatus } from "@prisma/client";

vi.mock("@/lib/sync-log", () => ({
  getSyncHistoryAction: vi.fn(),
  SyncLogAction: {
    CREATE: "CREATE",
    RENAME: "RENAME",
    DELETE: "DELETE",
    MOVE: "MOVE",
    UPLOAD: "UPLOAD",
    DOWNLOAD: "DOWNLOAD",
    SYNC: "SYNC",
  },
  SyncLogStatus: {
    SUCCESS: "SUCCESS",
    FAILED: "FAILED",
    PENDING: "PENDING",
  },
}));

import { getSyncHistoryAction } from "@/lib/sync-log";

describe("SyncHistory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("displays sync log entries", async () => {
    vi.mocked(getSyncHistoryAction).mockResolvedValue([
      {
        id: "log-1",
        action: SyncLogAction.CREATE,
        status: SyncLogStatus.SUCCESS,
        itemName: "Test Folder",
        fileName: null,
        error: null,
        duration: 150,
        createdAt: new Date("2026-01-13T10:00:00"),
      },
      {
        id: "log-2",
        action: SyncLogAction.UPLOAD,
        status: SyncLogStatus.FAILED,
        itemName: null,
        fileName: "video.mp4",
        error: "Network error",
        duration: 30000,
        createdAt: new Date("2026-01-13T09:55:00"),
      },
    ]);

    render(<SyncHistory />);

    await waitFor(() => {
      expect(screen.getByText("Test Folder")).toBeInTheDocument();
      expect(screen.getByText("Created")).toBeInTheDocument();
      expect(screen.getByText("video.mp4")).toBeInTheDocument();
      expect(screen.getByText("Failed")).toBeInTheDocument();
    });
  });

  it("shows empty state when no history", async () => {
    vi.mocked(getSyncHistoryAction).mockResolvedValue([]);

    render(<SyncHistory />);

    await waitFor(() => {
      expect(screen.getByText(/no sync activity/i)).toBeInTheDocument();
    });
  });

  it("shows error state when not authenticated", async () => {
    vi.mocked(getSyncHistoryAction).mockResolvedValue(null);

    render(<SyncHistory />);

    await waitFor(() => {
      expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
    });
  });

  it("displays error message for failed operations", async () => {
    vi.mocked(getSyncHistoryAction).mockResolvedValue([
      {
        id: "log-1",
        action: SyncLogAction.SYNC,
        status: SyncLogStatus.FAILED,
        itemName: null,
        fileName: null,
        error: "Connection timeout",
        duration: 5000,
        createdAt: new Date("2026-01-13T10:00:00"),
      },
    ]);

    render(<SyncHistory />);

    await waitFor(() => {
      expect(screen.getByText("Connection timeout")).toBeInTheDocument();
    });
  });
});
