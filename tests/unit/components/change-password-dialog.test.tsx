/**
 * Unit tests for ChangePasswordDialog component.
 * Tests form validation, submission, and error handling.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Mock user-actions
vi.mock("@/lib/user-actions", () => ({
  changePassword: vi.fn(),
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Import after mocks are set up
import { ChangePasswordDialog } from "@/components/profile/change-password-dialog";
import { changePassword } from "@/lib/user-actions";
import { toast } from "sonner";

const mockChangePassword = changePassword as ReturnType<typeof vi.fn>;
const mockToast = toast as unknown as {
  success: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
};

describe("ChangePasswordDialog", () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders all password fields when open", () => {
    render(<ChangePasswordDialog {...defaultProps} />);

    expect(screen.getByLabelText(/current password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^new password$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm new password/i)).toBeInTheDocument();
  });

  it("shows validation error when fields are empty", async () => {
    render(<ChangePasswordDialog {...defaultProps} />);
    const user = userEvent.setup();

    await user.click(
      screen.getByRole("button", { name: /^change password$/i })
    );

    expect(mockToast.error).toHaveBeenCalledWith("All fields are required");
    expect(mockChangePassword).not.toHaveBeenCalled();
  });

  it("shows validation error when passwords do not match", async () => {
    render(<ChangePasswordDialog {...defaultProps} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/current password/i), "CurrentPass1");
    await user.type(screen.getByLabelText(/^new password$/i), "NewPassword1");
    await user.type(
      screen.getByLabelText(/confirm new password/i),
      "DifferentPass1"
    );
    await user.click(
      screen.getByRole("button", { name: /^change password$/i })
    );

    expect(mockToast.error).toHaveBeenCalledWith("New passwords do not match");
    expect(mockChangePassword).not.toHaveBeenCalled();
  });

  it("shows validation error for weak password", async () => {
    render(<ChangePasswordDialog {...defaultProps} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/current password/i), "CurrentPass1");
    await user.type(screen.getByLabelText(/^new password$/i), "weak");
    await user.type(screen.getByLabelText(/confirm new password/i), "weak");
    await user.click(
      screen.getByRole("button", { name: /^change password$/i })
    );

    expect(mockToast.error).toHaveBeenCalled();
    expect(mockChangePassword).not.toHaveBeenCalled();
  });

  it("calls changePassword with correct data on valid submission", async () => {
    mockChangePassword.mockResolvedValue({ success: true });
    render(<ChangePasswordDialog {...defaultProps} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/current password/i), "CurrentPass1");
    await user.type(screen.getByLabelText(/^new password$/i), "NewPassword1");
    await user.type(
      screen.getByLabelText(/confirm new password/i),
      "NewPassword1"
    );
    await user.click(
      screen.getByRole("button", { name: /^change password$/i })
    );

    await waitFor(() => {
      expect(mockChangePassword).toHaveBeenCalledWith({
        currentPassword: "CurrentPass1",
        newPassword: "NewPassword1",
      });
    });
  });

  it("shows success toast and closes dialog on success", async () => {
    mockChangePassword.mockResolvedValue({ success: true });
    render(<ChangePasswordDialog {...defaultProps} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/current password/i), "CurrentPass1");
    await user.type(screen.getByLabelText(/^new password$/i), "NewPassword1");
    await user.type(
      screen.getByLabelText(/confirm new password/i),
      "NewPassword1"
    );
    await user.click(
      screen.getByRole("button", { name: /^change password$/i })
    );

    await waitFor(() => {
      expect(mockToast.success).toHaveBeenCalledWith(
        "Password changed successfully"
      );
      expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it("shows error toast on failure", async () => {
    mockChangePassword.mockResolvedValue({
      success: false,
      error: "Incorrect current password",
    });
    render(<ChangePasswordDialog {...defaultProps} />);
    const user = userEvent.setup();

    await user.type(
      screen.getByLabelText(/current password/i),
      "WrongPassword1"
    );
    await user.type(screen.getByLabelText(/^new password$/i), "NewPassword1");
    await user.type(
      screen.getByLabelText(/confirm new password/i),
      "NewPassword1"
    );
    await user.click(
      screen.getByRole("button", { name: /^change password$/i })
    );

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith(
        "Incorrect current password"
      );
    });
  });

  it("resets form when dialog closes", async () => {
    const { rerender } = render(<ChangePasswordDialog {...defaultProps} />);
    const user = userEvent.setup();

    await user.type(
      screen.getByLabelText(/current password/i),
      "SomePassword1"
    );

    // Close and reopen dialog
    rerender(<ChangePasswordDialog {...defaultProps} open={false} />);
    rerender(<ChangePasswordDialog {...defaultProps} open={true} />);

    expect(screen.getByLabelText(/current password/i)).toHaveValue("");
  });

  it("disables submit button while saving", async () => {
    let resolvePromise: (value: { success: boolean }) => void;
    mockChangePassword.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePromise = resolve;
        })
    );
    render(<ChangePasswordDialog {...defaultProps} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/current password/i), "CurrentPass1");
    await user.type(screen.getByLabelText(/^new password$/i), "NewPassword1");
    await user.type(
      screen.getByLabelText(/confirm new password/i),
      "NewPassword1"
    );
    await user.click(
      screen.getByRole("button", { name: /^change password$/i })
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /changing/i })).toBeDisabled();
    });

    // Resolve the promise to clean up
    resolvePromise!({ success: true });
  });

  it("cancel button closes dialog", async () => {
    render(<ChangePasswordDialog {...defaultProps} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /cancel/i }));

    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("submits form on Enter key in confirm password field", async () => {
    mockChangePassword.mockResolvedValue({ success: true });
    render(<ChangePasswordDialog {...defaultProps} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/current password/i), "CurrentPass1");
    await user.type(screen.getByLabelText(/^new password$/i), "NewPassword1");
    await user.type(
      screen.getByLabelText(/confirm new password/i),
      "NewPassword1"
    );
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(mockChangePassword).toHaveBeenCalled();
    });
  });
});
