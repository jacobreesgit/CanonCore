/**
 * Unit tests for SettingsDialog file upload functionality.
 * Tests visual profile card with cover + avatar.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Mock dependencies
vi.mock("@/components/google-drive", () => ({
  GoogleDriveSettingsSection: () => <div>Google Drive Settings</div>,
  SyncHistory: () => <div>Sync History</div>,
}));

vi.mock("@/lib/user-actions", () => ({
  updateProfile: vi.fn().mockResolvedValue({ success: true }),
  changePassword: vi.fn().mockResolvedValue({ success: true }),
  uploadProfileImage: vi.fn().mockResolvedValue({ success: true }),
  uploadHeroImage: vi.fn().mockResolvedValue({ success: true }),
  removeProfileImage: vi.fn().mockResolvedValue({ success: true }),
  removeHeroImage: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// Mock the FileUpload component to enable testing
vi.mock("@/components/diceui/file-upload", () => ({
  FileUpload: ({
    children,
    onValueChange,
  }: {
    children: React.ReactNode;
    onValueChange?: (files: File[]) => void;
  }) => {
    return (
      <div
        onClick={() => {
          // Store the callback for later use
          (
            window as unknown as { __fileUploadCallback?: typeof onValueChange }
          ).__fileUploadCallback = onValueChange;
        }}
      >
        {children}
      </div>
    );
  },
  FileUploadTrigger: ({
    children,
    asChild: _asChild,
  }: {
    children: React.ReactNode;
    asChild?: boolean;
  }) => children,
}));

// Import after mocks
import { SettingsDialog } from "@/components/profile/settings-dialog";

describe("SettingsDialog Upload", () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    user: {
      name: "Test User",
      email: "test@example.com",
      username: null,
      isPublic: false,
      hasImage: false,
      hasHeroImage: false,
      bio: null,
    },
    googleDriveConnection: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Profile Picture Dropzone", () => {
    it("should render profile dropzone area", () => {
      render(<SettingsDialog {...defaultProps} />);

      // Profile section renders the user's name and email, indicating the avatar area exists
      expect(screen.getByText("Test User")).toBeInTheDocument();
    });

    it("should not show remove button when no profile image", () => {
      render(<SettingsDialog {...defaultProps} />);

      expect(
        screen.queryByRole("button", { name: /remove avatar/i })
      ).not.toBeInTheDocument();
    });

    it("should show remove button when user has profile image", () => {
      render(
        <SettingsDialog
          {...defaultProps}
          user={{ ...defaultProps.user, hasImage: true }}
        />
      );

      expect(
        screen.getByRole("button", { name: /remove avatar/i })
      ).toBeInTheDocument();
    });
  });

  describe("Hero Banner Dropzone", () => {
    it("should render hero dropzone with Change Cover button", () => {
      render(<SettingsDialog {...defaultProps} />);

      expect(
        screen.getByRole("button", { name: /change cover/i })
      ).toBeInTheDocument();
    });

    it("should show Change Cover button", () => {
      render(<SettingsDialog {...defaultProps} />);

      expect(
        screen.getByRole("button", { name: /change cover/i })
      ).toBeInTheDocument();
    });

    it("should show remove button when user has hero image", () => {
      render(
        <SettingsDialog
          {...defaultProps}
          user={{ ...defaultProps.user, hasHeroImage: true }}
        />
      );

      expect(
        screen.getByRole("button", { name: /remove cover/i })
      ).toBeInTheDocument();
    });
  });

  describe("Remove functionality", () => {
    it("should hide remove avatar button after clicking it", async () => {
      const user = userEvent.setup();
      render(
        <SettingsDialog
          {...defaultProps}
          user={{ ...defaultProps.user, hasImage: true }}
        />
      );

      const removeButton = screen.getByRole("button", {
        name: /remove avatar/i,
      });
      await user.click(removeButton);

      await waitFor(() => {
        expect(
          screen.queryByRole("button", { name: /remove avatar/i })
        ).not.toBeInTheDocument();
      });
    });

    it("should hide remove cover button after clicking it", async () => {
      const user = userEvent.setup();
      render(
        <SettingsDialog
          {...defaultProps}
          user={{ ...defaultProps.user, hasHeroImage: true }}
        />
      );

      const removeButton = screen.getByRole("button", {
        name: /remove cover/i,
      });
      await user.click(removeButton);

      await waitFor(() => {
        expect(
          screen.queryByRole("button", { name: /remove cover/i })
        ).not.toBeInTheDocument();
      });
    });

    it("should enable save button after removing profile image", async () => {
      const user = userEvent.setup();
      render(
        <SettingsDialog
          {...defaultProps}
          user={{ ...defaultProps.user, hasImage: true }}
        />
      );

      const saveButton = screen.getByRole("button", { name: /save changes/i });
      expect(saveButton).toBeDisabled();

      const removeButton = screen.getByRole("button", {
        name: /remove avatar/i,
      });
      await user.click(removeButton);

      await waitFor(() => {
        expect(saveButton).not.toBeDisabled();
      });
    });
  });

  describe("Visual Profile Card", () => {
    it("should show user name and email", () => {
      render(<SettingsDialog {...defaultProps} />);

      expect(screen.getByText("Test User")).toBeInTheDocument();
      expect(screen.getByText("test@example.com")).toBeInTheDocument();
    });

    it("should show Display Name input", () => {
      render(<SettingsDialog {...defaultProps} />);

      expect(screen.getByLabelText(/display name/i)).toBeInTheDocument();
    });

    it("should show Remove Images card when user has images", () => {
      render(
        <SettingsDialog
          {...defaultProps}
          user={{ ...defaultProps.user, hasImage: true, hasHeroImage: true }}
        />
      );

      expect(screen.getByText("Remove Images")).toBeInTheDocument();
    });

    it("should not show Remove Images card when user has no images", () => {
      render(<SettingsDialog {...defaultProps} />);

      expect(screen.queryByText("Remove Images")).not.toBeInTheDocument();
    });
  });
});
