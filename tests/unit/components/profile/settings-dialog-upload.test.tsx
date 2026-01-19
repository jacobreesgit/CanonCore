/**
 * Unit tests for SettingsDialog file upload functionality.
 * Tests dropzone integration for profile picture and hero banner.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Mock dependencies
vi.mock("@/components/google-drive", () => ({
  GoogleDriveSettingsSection: () => <div data-testid="google-drive-section" />,
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

// Mock react-dropzone to enable file upload simulation
let mockOnDrop: ((files: File[]) => void) | null = null;
let mockOnError: ((error: Error) => void) | null = null;

vi.mock("react-dropzone", () => ({
  useDropzone: vi.fn(({ onDrop, onError }) => {
    // Capture the callbacks for testing
    mockOnDrop = (files: File[]) => onDrop?.(files, [], {} as DragEvent);
    mockOnError = onError;
    return {
      getRootProps: () => ({
        onClick: vi.fn(),
        role: "button",
      }),
      getInputProps: () => ({
        type: "file",
        "data-testid": "dropzone-input",
      }),
      isDragActive: false,
    };
  }),
}));

// Import after mocks
import { SettingsDialog } from "@/components/profile/settings-dialog";
import { toast } from "sonner";

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
    },
    googleDriveConnection: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnDrop = null;
    mockOnError = null;
  });

  describe("Profile Picture Dropzone", () => {
    it("should render profile dropzone", () => {
      render(<SettingsDialog {...defaultProps} />);

      expect(screen.getByTestId("profile-dropzone")).toBeInTheDocument();
    });

    it("should show empty state when no profile image", () => {
      render(<SettingsDialog {...defaultProps} />);

      expect(screen.getByText("Profile Picture")).toBeInTheDocument();
      // Multiple dropzones show this text, just verify at least one exists
      expect(
        screen.getAllByText(/Drag and drop or click to upload/i).length
      ).toBeGreaterThan(0);
    });

    it("should not show remove button when no profile image", () => {
      render(<SettingsDialog {...defaultProps} />);

      // Only hero remove button might exist, but profile remove should not
      const removeButtons = screen.queryAllByRole("button", {
        name: /remove/i,
      });
      // Filter to only profile-related remove (first one if exists)
      expect(removeButtons.length).toBe(0);
    });

    it("should show remove button when user has profile image", () => {
      render(
        <SettingsDialog
          {...defaultProps}
          user={{ ...defaultProps.user, hasImage: true }}
        />
      );

      expect(
        screen.getByRole("button", { name: /remove/i })
      ).toBeInTheDocument();
    });

    it("should enable save button after file selection", async () => {
      render(<SettingsDialog {...defaultProps} />);

      const saveButton = screen.getByRole("button", { name: /save changes/i });
      expect(saveButton).toBeDisabled();

      // Simulate file drop via the captured callback
      const testFile = new File(["test"], "avatar.jpg", { type: "image/jpeg" });
      mockOnDrop?.([testFile]);

      await waitFor(() => {
        expect(saveButton).not.toBeDisabled();
      });
    });
  });

  describe("Hero Banner Dropzone", () => {
    it("should render hero dropzone", () => {
      render(<SettingsDialog {...defaultProps} />);

      expect(screen.getByTestId("hero-dropzone")).toBeInTheDocument();
    });

    it("should show empty state when no hero image", () => {
      render(<SettingsDialog {...defaultProps} />);

      expect(screen.getByText("Hero Banner")).toBeInTheDocument();
    });

    it("should show remove button when user has hero image", () => {
      render(
        <SettingsDialog
          {...defaultProps}
          user={{ ...defaultProps.user, hasHeroImage: true }}
        />
      );

      expect(
        screen.getByRole("button", { name: /remove banner/i })
      ).toBeInTheDocument();
    });
  });

  describe("Remove functionality", () => {
    it("should hide remove button after clicking remove for profile", async () => {
      const user = userEvent.setup();
      render(
        <SettingsDialog
          {...defaultProps}
          user={{ ...defaultProps.user, hasImage: true }}
        />
      );

      const removeButton = screen.getByRole("button", { name: /^remove$/i });
      await user.click(removeButton);

      await waitFor(() => {
        expect(
          screen.queryByRole("button", { name: /^remove$/i })
        ).not.toBeInTheDocument();
      });
    });

    it("should hide remove button after clicking remove for hero", async () => {
      const user = userEvent.setup();
      render(
        <SettingsDialog
          {...defaultProps}
          user={{ ...defaultProps.user, hasHeroImage: true }}
        />
      );

      const removeButton = screen.getByRole("button", {
        name: /remove banner/i,
      });
      await user.click(removeButton);

      await waitFor(() => {
        expect(
          screen.queryByRole("button", { name: /remove banner/i })
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

      const removeButton = screen.getByRole("button", { name: /^remove$/i });
      await user.click(removeButton);

      await waitFor(() => {
        expect(saveButton).not.toBeDisabled();
      });
    });
  });

  describe("Error handling", () => {
    it("should show toast error when file validation fails", async () => {
      render(<SettingsDialog {...defaultProps} />);

      // Simulate error via the captured callback
      mockOnError?.(new Error("File is larger than 1048576 bytes"));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          "File is larger than 1048576 bytes"
        );
      });
    });
  });

  describe("Constraints display", () => {
    it("should show profile picture constraints", () => {
      render(<SettingsDialog {...defaultProps} />);

      expect(
        screen.getByText(/JPEG, PNG, or WebP\. Max 1MB/i)
      ).toBeInTheDocument();
    });

    it("should show hero banner constraints", () => {
      render(<SettingsDialog {...defaultProps} />);

      expect(
        screen.getByText(/Wide format recommended\. Max 2MB/i)
      ).toBeInTheDocument();
    });
  });
});
