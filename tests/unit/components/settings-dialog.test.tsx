/**
 * Unit tests for SettingsDialog with inline step navigation.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Mock motion/react for animations
vi.mock("motion/react", () => ({
  motion: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  useReducedMotion: () => false,
}));

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
      username: null,
      isPublic: false,
      hasImage: false,
      hasHeroImage: false,
    },
    googleDriveConnection: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Main Settings View", () => {
    it("shows Change Password button instead of inline password fields", () => {
      render(<SettingsDialog {...defaultProps} />);

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

      expect(
        screen.getByRole("button", { name: /change email/i })
      ).toBeInTheDocument();
    });

    it("displays current email as read-only text", () => {
      render(<SettingsDialog {...defaultProps} />);

      expect(screen.getByText("test@example.com")).toBeInTheDocument();
    });

    it("shows Google Drive section", () => {
      render(<SettingsDialog {...defaultProps} />);

      expect(screen.getByTestId("google-drive-section")).toBeInTheDocument();
    });
  });

  describe("Password Change Step", () => {
    it("navigates to password form when clicking Change Password", async () => {
      render(<SettingsDialog {...defaultProps} />);
      const user = userEvent.setup();

      await user.click(
        screen.getByRole("button", { name: /change password/i })
      );

      // Should show password form inline with back button
      await waitFor(() => {
        expect(
          screen.getByRole("heading", { name: /change password/i })
        ).toBeInTheDocument();
      });
      expect(screen.getByLabelText(/current password/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^new password$/i)).toBeInTheDocument();
      expect(
        screen.getByLabelText(/confirm new password/i)
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /back/i })).toBeInTheDocument();
    });

    it("returns to main view when clicking Back from password step", async () => {
      render(<SettingsDialog {...defaultProps} />);
      const user = userEvent.setup();

      await user.click(
        screen.getByRole("button", { name: /change password/i })
      );
      await user.click(screen.getByRole("button", { name: /back/i }));

      // Should return to main view
      await waitFor(() => {
        expect(screen.getByTestId("google-drive-section")).toBeInTheDocument();
      });
    });
  });

  describe("Email Change Step", () => {
    it("navigates to email form when clicking Change Email", async () => {
      render(<SettingsDialog {...defaultProps} />);
      const user = userEvent.setup();

      await user.click(screen.getByRole("button", { name: /change email/i }));

      // Should show email form inline with back button
      await waitFor(() => {
        expect(
          screen.getByRole("heading", { name: /change email/i })
        ).toBeInTheDocument();
      });
      expect(screen.getByLabelText(/new email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/current password/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /back/i })).toBeInTheDocument();
    });

    it("returns to main view when clicking Back from email step", async () => {
      render(<SettingsDialog {...defaultProps} />);
      const user = userEvent.setup();

      await user.click(screen.getByRole("button", { name: /change email/i }));
      await user.click(screen.getByRole("button", { name: /back/i }));

      // Should return to main view
      await waitFor(() => {
        expect(screen.getByTestId("google-drive-section")).toBeInTheDocument();
      });
    });
  });

  describe("Step Reset on Close", () => {
    it("resets to main step when dialog closes and reopens", async () => {
      const { rerender } = render(<SettingsDialog {...defaultProps} />);
      const user = userEvent.setup();

      // Navigate to password step
      await user.click(
        screen.getByRole("button", { name: /change password/i })
      );
      await waitFor(() => {
        expect(
          screen.getByRole("heading", { name: /change password/i })
        ).toBeInTheDocument();
      });

      // Close and reopen dialog
      rerender(<SettingsDialog {...defaultProps} open={false} />);
      rerender(<SettingsDialog {...defaultProps} open={true} />);

      // Should be back on main step
      await waitFor(() => {
        expect(screen.getByTestId("google-drive-section")).toBeInTheDocument();
      });
    });
  });
});
