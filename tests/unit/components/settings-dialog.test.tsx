/**
 * Unit tests for SettingsDialog integration with modals.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Mock child components
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

// Import after mocks
import { SettingsDialog } from "@/components/profile/settings-dialog";

describe("SettingsDialog", () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    user: {
      name: "Test User",
      email: "test@example.com",
      hasImage: false,
      hasHeroImage: false,
    },
    googleDriveConnection: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows Change Password button instead of inline password fields", () => {
    render(<SettingsDialog {...defaultProps} />);

    // Should have button, not inline password fields
    expect(
      screen.getByRole("button", { name: /change password/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText(/current password/i)
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/new password/i)).not.toBeInTheDocument();
  });

  it("shows Change Email button instead of inline email field", () => {
    render(<SettingsDialog {...defaultProps} />);

    // Should have button for email change
    expect(
      screen.getByRole("button", { name: /change email/i })
    ).toBeInTheDocument();
  });

  it("displays current email as read-only text", () => {
    render(<SettingsDialog {...defaultProps} />);

    // Email should be displayed but not editable inline
    expect(screen.getByText("test@example.com")).toBeInTheDocument();
  });

  it("opens ChangePasswordDialog when password button clicked", async () => {
    render(<SettingsDialog {...defaultProps} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /change password/i }));

    // ChangePasswordDialog should open with its own title
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /change password/i })
      ).toBeInTheDocument();
    });
  });

  it("opens ChangeEmailDialog when email button clicked", async () => {
    render(<SettingsDialog {...defaultProps} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /change email/i }));

    // ChangeEmailDialog should open with its own title
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /change email/i })
      ).toBeInTheDocument();
    });
  });
});
