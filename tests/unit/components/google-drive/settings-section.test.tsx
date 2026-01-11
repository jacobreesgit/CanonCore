/**
 * Unit tests for GoogleDriveSettingsSection component.
 * Tests Drive link display and connection status.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { GoogleDriveSettingsSection } from "@/components/google-drive/settings-section";

vi.mock("@/lib/google-drive-actions", () => ({
  initiateGoogleDriveOAuth: vi.fn(),
  disconnectGoogleDrive: vi.fn(),
  syncFromGoogleDrive: vi.fn(),
}));

describe("GoogleDriveSettingsSection", () => {
  const mockConnection = {
    email: "test@gmail.com",
    rootFolderId: "folder-abc123",
    isActive: true,
    needsReauth: false,
    lastSyncAt: new Date("2026-01-10T12:00:00Z"),
    lastError: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Drive Folder Link", () => {
    it("should display Drive link when connected with rootFolderId", () => {
      render(
        <GoogleDriveSettingsSection
          connection={mockConnection}
          onConnectionChange={vi.fn()}
        />
      );

      const driveLink = screen.getByRole("link", { name: /^drive$/i });
      expect(driveLink).toBeInTheDocument();
      expect(driveLink).toHaveAttribute(
        "href",
        "https://drive.google.com/drive/folders/folder-abc123"
      );
      expect(driveLink).toHaveAttribute("target", "_blank");
      expect(driveLink).toHaveAttribute("rel", "noopener noreferrer");
    });

    it("should not display Drive link when not connected", () => {
      render(
        <GoogleDriveSettingsSection
          connection={null}
          onConnectionChange={vi.fn()}
        />
      );

      expect(
        screen.queryByRole("link", { name: /^drive$/i })
      ).not.toBeInTheDocument();
    });

    it("should not display Drive link when connected but no rootFolderId", () => {
      render(
        <GoogleDriveSettingsSection
          connection={{ ...mockConnection, rootFolderId: null }}
          onConnectionChange={vi.fn()}
        />
      );

      expect(
        screen.queryByRole("link", { name: /^drive$/i })
      ).not.toBeInTheDocument();
    });

    it("should not display Drive link when folder is trashed", () => {
      render(
        <GoogleDriveSettingsSection
          connection={{ ...mockConnection, lastError: "ROOT_FOLDER_TRASHED" }}
          onConnectionChange={vi.fn()}
        />
      );

      expect(
        screen.queryByRole("link", { name: /^drive$/i })
      ).not.toBeInTheDocument();
    });

    it("should not display Drive link when folder is deleted", () => {
      render(
        <GoogleDriveSettingsSection
          connection={{ ...mockConnection, lastError: "ROOT_FOLDER_DELETED" }}
          onConnectionChange={vi.fn()}
        />
      );

      expect(
        screen.queryByRole("link", { name: /^drive$/i })
      ).not.toBeInTheDocument();
    });
  });

  describe("Root Folder Trashed Warning", () => {
    it("should display trashed warning banner when lastError is ROOT_FOLDER_TRASHED", () => {
      render(
        <GoogleDriveSettingsSection
          connection={{ ...mockConnection, lastError: "ROOT_FOLDER_TRASHED" }}
          onConnectionChange={vi.fn()}
        />
      );

      expect(
        screen.getByText("CanonCore folder is in Trash")
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Restore it, then click Sync to resume/i)
      ).toBeInTheDocument();
    });

    it("should display Restore in Drive link when folder is trashed", () => {
      render(
        <GoogleDriveSettingsSection
          connection={{ ...mockConnection, lastError: "ROOT_FOLDER_TRASHED" }}
          onConnectionChange={vi.fn()}
        />
      );

      const restoreLink = screen.getByRole("link", {
        name: /restore in drive/i,
      });
      expect(restoreLink).toBeInTheDocument();
      expect(restoreLink).toHaveAttribute(
        "href",
        "https://drive.google.com/drive/folders/folder-abc123"
      );
    });

    it("should not display trashed warning when no error", () => {
      render(
        <GoogleDriveSettingsSection
          connection={mockConnection}
          onConnectionChange={vi.fn()}
        />
      );

      expect(
        screen.queryByText("CanonCore folder is in Trash")
      ).not.toBeInTheDocument();
    });
  });

  describe("Root Folder Deleted Warning", () => {
    it("should display deleted warning banner when lastError is ROOT_FOLDER_DELETED", () => {
      render(
        <GoogleDriveSettingsSection
          connection={{ ...mockConnection, lastError: "ROOT_FOLDER_DELETED" }}
          onConnectionChange={vi.fn()}
        />
      );

      expect(
        screen.getByText("CanonCore folder was deleted")
      ).toBeInTheDocument();
      expect(
        screen.getByText(/permanently deleted from Google Drive/i)
      ).toBeInTheDocument();
    });

    it("should not display deleted warning when no error", () => {
      render(
        <GoogleDriveSettingsSection
          connection={mockConnection}
          onConnectionChange={vi.fn()}
        />
      );

      expect(
        screen.queryByText("CanonCore folder was deleted")
      ).not.toBeInTheDocument();
    });

    it("should not show Restore link when folder is permanently deleted", () => {
      render(
        <GoogleDriveSettingsSection
          connection={{ ...mockConnection, lastError: "ROOT_FOLDER_DELETED" }}
          onConnectionChange={vi.fn()}
        />
      );

      expect(
        screen.queryByRole("link", { name: /restore in drive/i })
      ).not.toBeInTheDocument();
    });
  });

  describe("Sync Button Disabled States", () => {
    it("should NOT disable sync button when folder is trashed (allows retry after restore)", () => {
      render(
        <GoogleDriveSettingsSection
          connection={{ ...mockConnection, lastError: "ROOT_FOLDER_TRASHED" }}
          onConnectionChange={vi.fn()}
        />
      );

      const syncButton = screen.getByRole("button", { name: /sync/i });
      expect(syncButton).not.toBeDisabled();
    });

    it("should disable sync button when folder is permanently deleted", () => {
      render(
        <GoogleDriveSettingsSection
          connection={{ ...mockConnection, lastError: "ROOT_FOLDER_DELETED" }}
          onConnectionChange={vi.fn()}
        />
      );

      const syncButton = screen.getByRole("button", { name: /sync/i });
      expect(syncButton).toBeDisabled();
    });

    it("should disable sync button when reauth is needed", () => {
      render(
        <GoogleDriveSettingsSection
          connection={{ ...mockConnection, needsReauth: true }}
          onConnectionChange={vi.fn()}
        />
      );

      const syncButton = screen.getByRole("button", { name: /sync/i });
      expect(syncButton).toBeDisabled();
    });

    it("should enable sync button when connection is healthy", () => {
      render(
        <GoogleDriveSettingsSection
          connection={mockConnection}
          onConnectionChange={vi.fn()}
        />
      );

      const syncButton = screen.getByRole("button", { name: /sync/i });
      expect(syncButton).not.toBeDisabled();
    });
  });

  describe("Generic Error Display", () => {
    it("should display generic errors in error text", () => {
      render(
        <GoogleDriveSettingsSection
          connection={{ ...mockConnection, lastError: "Token expired" }}
          onConnectionChange={vi.fn()}
        />
      );

      expect(screen.getByText("Token expired")).toBeInTheDocument();
    });

    it("should not display ROOT_FOLDER_TRASHED in generic error area", () => {
      render(
        <GoogleDriveSettingsSection
          connection={{ ...mockConnection, lastError: "ROOT_FOLDER_TRASHED" }}
          onConnectionChange={vi.fn()}
        />
      );

      // The error should be shown in the dedicated warning banner, not as plain text
      const errorTexts = screen.queryAllByText("ROOT_FOLDER_TRASHED");
      expect(errorTexts).toHaveLength(0);
    });

    it("should not display ROOT_FOLDER_DELETED in generic error area", () => {
      render(
        <GoogleDriveSettingsSection
          connection={{ ...mockConnection, lastError: "ROOT_FOLDER_DELETED" }}
          onConnectionChange={vi.fn()}
        />
      );

      // The error should be shown in the dedicated warning banner, not as plain text
      const errorTexts = screen.queryAllByText("ROOT_FOLDER_DELETED");
      expect(errorTexts).toHaveLength(0);
    });
  });
});
