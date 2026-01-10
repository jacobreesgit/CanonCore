/**
 * Unit tests for ChangeEmailDialog component.
 * Tests form validation, submission, and error handling.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Mock user-actions
vi.mock("@/lib/user-actions", () => ({
  updateProfile: vi.fn(),
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Import after mocks are set up
import { ChangeEmailDialog } from "@/components/profile/change-email-dialog";
import { updateProfile } from "@/lib/user-actions";
import { toast } from "sonner";

const mockUpdateProfile = updateProfile as ReturnType<typeof vi.fn>;
const mockToast = toast as unknown as {
  success: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
};

describe("ChangeEmailDialog", () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    currentEmail: "test@example.com",
    onEmailChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders email and password fields when open", () => {
    render(<ChangeEmailDialog {...defaultProps} />);

    expect(screen.getByLabelText(/new email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/current password/i)).toBeInTheDocument();
  });

  it("pre-fills current email in the field", () => {
    render(<ChangeEmailDialog {...defaultProps} />);

    expect(screen.getByLabelText(/new email/i)).toHaveValue("test@example.com");
  });

  it("shows validation error when fields are empty", async () => {
    render(<ChangeEmailDialog {...defaultProps} />);
    const user = userEvent.setup();

    // Clear the pre-filled email
    await user.clear(screen.getByLabelText(/new email/i));
    await user.click(screen.getByRole("button", { name: /^change email$/i }));

    expect(mockToast.error).toHaveBeenCalledWith("All fields are required");
    expect(mockUpdateProfile).not.toHaveBeenCalled();
  });

  it("shows validation error for invalid email format", async () => {
    render(<ChangeEmailDialog {...defaultProps} />);
    const user = userEvent.setup();

    await user.clear(screen.getByLabelText(/new email/i));
    await user.type(screen.getByLabelText(/new email/i), "invalid-email");
    await user.type(screen.getByLabelText(/current password/i), "Password1");
    await user.click(screen.getByRole("button", { name: /^change email$/i }));

    expect(mockToast.error).toHaveBeenCalledWith("Invalid email format");
    expect(mockUpdateProfile).not.toHaveBeenCalled();
  });

  it("shows error when email unchanged", async () => {
    render(<ChangeEmailDialog {...defaultProps} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/current password/i), "Password1");
    await user.click(screen.getByRole("button", { name: /^change email$/i }));

    expect(mockToast.error).toHaveBeenCalledWith(
      "New email must be different from current email"
    );
    expect(mockUpdateProfile).not.toHaveBeenCalled();
  });

  it("calls updateProfile with correct data on valid submission", async () => {
    mockUpdateProfile.mockResolvedValue({ success: true });
    render(<ChangeEmailDialog {...defaultProps} />);
    const user = userEvent.setup();

    await user.clear(screen.getByLabelText(/new email/i));
    await user.type(
      screen.getByLabelText(/new email/i),
      "newemail@example.com"
    );
    await user.type(screen.getByLabelText(/current password/i), "Password1");
    await user.click(screen.getByRole("button", { name: /^change email$/i }));

    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalledWith({
        email: "newemail@example.com",
        currentPassword: "Password1",
      });
    });
  });

  it("shows success toast and closes dialog on success", async () => {
    mockUpdateProfile.mockResolvedValue({ success: true });
    render(<ChangeEmailDialog {...defaultProps} />);
    const user = userEvent.setup();

    await user.clear(screen.getByLabelText(/new email/i));
    await user.type(
      screen.getByLabelText(/new email/i),
      "newemail@example.com"
    );
    await user.type(screen.getByLabelText(/current password/i), "Password1");
    await user.click(screen.getByRole("button", { name: /^change email$/i }));

    await waitFor(() => {
      expect(mockToast.success).toHaveBeenCalledWith(
        "Email changed successfully"
      );
      expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
      expect(defaultProps.onEmailChange).toHaveBeenCalled();
    });
  });

  it("shows error toast on failure", async () => {
    mockUpdateProfile.mockResolvedValue({
      success: false,
      error: "Email already in use",
    });
    render(<ChangeEmailDialog {...defaultProps} />);
    const user = userEvent.setup();

    await user.clear(screen.getByLabelText(/new email/i));
    await user.type(screen.getByLabelText(/new email/i), "taken@example.com");
    await user.type(screen.getByLabelText(/current password/i), "Password1");
    await user.click(screen.getByRole("button", { name: /^change email$/i }));

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Email already in use");
    });
  });

  it("shows error for incorrect password", async () => {
    mockUpdateProfile.mockResolvedValue({
      success: false,
      error: "Incorrect password",
    });
    render(<ChangeEmailDialog {...defaultProps} />);
    const user = userEvent.setup();

    await user.clear(screen.getByLabelText(/new email/i));
    await user.type(
      screen.getByLabelText(/new email/i),
      "newemail@example.com"
    );
    await user.type(
      screen.getByLabelText(/current password/i),
      "WrongPassword1"
    );
    await user.click(screen.getByRole("button", { name: /^change email$/i }));

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Incorrect password");
    });
  });

  it("resets form when dialog closes and reopens", async () => {
    const { rerender } = render(<ChangeEmailDialog {...defaultProps} />);
    const user = userEvent.setup();

    await user.clear(screen.getByLabelText(/new email/i));
    await user.type(screen.getByLabelText(/new email/i), "changed@example.com");
    await user.type(screen.getByLabelText(/current password/i), "Password1");

    // Close and reopen dialog
    rerender(<ChangeEmailDialog {...defaultProps} open={false} />);
    rerender(<ChangeEmailDialog {...defaultProps} open={true} />);

    expect(screen.getByLabelText(/new email/i)).toHaveValue("test@example.com");
    expect(screen.getByLabelText(/current password/i)).toHaveValue("");
  });

  it("disables submit button while saving", async () => {
    let resolvePromise: (value: { success: boolean }) => void;
    mockUpdateProfile.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePromise = resolve;
        })
    );
    render(<ChangeEmailDialog {...defaultProps} />);
    const user = userEvent.setup();

    await user.clear(screen.getByLabelText(/new email/i));
    await user.type(
      screen.getByLabelText(/new email/i),
      "newemail@example.com"
    );
    await user.type(screen.getByLabelText(/current password/i), "Password1");
    await user.click(screen.getByRole("button", { name: /^change email$/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /changing/i })).toBeDisabled();
    });

    // Resolve the promise to clean up
    resolvePromise!({ success: true });
  });

  it("cancel button closes dialog", async () => {
    render(<ChangeEmailDialog {...defaultProps} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /cancel/i }));

    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("submits form on Enter key", async () => {
    mockUpdateProfile.mockResolvedValue({ success: true });
    render(<ChangeEmailDialog {...defaultProps} />);
    const user = userEvent.setup();

    await user.clear(screen.getByLabelText(/new email/i));
    await user.type(
      screen.getByLabelText(/new email/i),
      "newemail@example.com"
    );
    await user.type(screen.getByLabelText(/current password/i), "Password1");
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalled();
    });
  });
});
