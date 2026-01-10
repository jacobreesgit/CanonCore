# Change Password & Email Modals Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extract password and email change functionality from the Settings dialog into dedicated modals for cleaner UX, better separation of concerns, and consistent security patterns.

**Architecture:** Create `ChangePasswordDialog` and `ChangeEmailDialog` components triggered by buttons in the Settings dialog. Each modal handles its own state, validation, and submission while reusing existing server actions from `lib/user-actions.ts`.

**Tech Stack:** React 19, shadcn/ui Dialog, Zod validation, Sonner toast, existing `changePassword` and `updateProfile` actions

---

## Task 1: Create ChangePasswordDialog Component

**Files:**

- Create: `components/profile/change-password-dialog.tsx`
- Create: `tests/unit/components/change-password-dialog.test.tsx`

**Step 1: Write the failing component test**

Create `tests/unit/components/change-password-dialog.test.tsx`:

```tsx
/**
 * Unit tests for ChangePasswordDialog component.
 * Tests form validation, submission, and error handling.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChangePasswordDialog } from "@/components/profile/change-password-dialog";

// Mock user-actions
const mockChangePassword = vi.fn();
vi.mock("@/lib/user-actions", () => ({
  changePassword: (...args: unknown[]) => mockChangePassword(...args),
}));

// Mock sonner toast
const mockToast = { success: vi.fn(), error: vi.fn() };
vi.mock("sonner", () => ({
  toast: mockToast,
}));

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
    mockChangePassword.mockImplementation(() => new Promise(() => {})); // Never resolves
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
```

**Step 2: Run tests to verify they fail**

Run: `pnpm run test:unit tests/unit/components/change-password-dialog.test.tsx`
Expected: FAIL with "Cannot find module '@/components/profile/change-password-dialog'"

**Step 3: Create the ChangePasswordDialog component**

Create `components/profile/change-password-dialog.tsx`:

```tsx
/**
 * Change password dialog component.
 * Dedicated modal for password changes with form validation.
 */

"use client";

import { useState, useCallback, useEffect } from "react";
import { Loader2, Lock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { changePassword } from "@/lib/user-actions";
import { passwordSchema } from "@/lib/validations";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ChangePasswordDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog open state changes */
  onOpenChange: (open: boolean) => void;
}

/**
 * Modal dialog for changing user password.
 * Validates password strength and confirmation match.
 *
 * @param open - Whether dialog is visible
 * @param onOpenChange - Callback for visibility changes
 */
export function ChangePasswordDialog({
  open,
  onOpenChange,
}: ChangePasswordDialogProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }
  }, [open]);

  /**
   * Validates and submits password change.
   */
  const handleSubmit = useCallback(async () => {
    // Check all fields are filled
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("All fields are required");
      return;
    }

    // Check passwords match
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }

    // Validate password strength
    const validation = passwordSchema.safeParse(newPassword);
    if (!validation.success) {
      toast.error(validation.error.issues[0].message);
      return;
    }

    setIsSaving(true);
    try {
      const result = await changePassword({
        currentPassword,
        newPassword,
      });

      if (result.success) {
        toast.success("Password changed successfully");
        onOpenChange(false);
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Failed to change password");
    } finally {
      setIsSaving(false);
    }
  }, [currentPassword, newPassword, confirmPassword, onOpenChange]);

  /**
   * Handles Enter key to submit form.
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !isSaving) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit, isSaving]
  );

  /**
   * Closes dialog without saving.
   */
  const handleCancel = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-xl",
                "bg-primary/10 ring-primary/20 ring-1"
              )}
            >
              <Lock className="text-primary size-5" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-lg">Change Password</DialogTitle>
              <DialogDescription className="text-sm">
                Enter your current password and choose a new one
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4" onKeyDown={handleKeyDown}>
          <div className="space-y-2">
            <Label htmlFor="change-current-password">Current Password</Label>
            <PasswordInput
              id="change-current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
              className="h-10"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="change-new-password">New Password</Label>
            <PasswordInput
              id="change-new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password"
              className="h-10"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="change-confirm-password">
              Confirm New Password
            </Label>
            <PasswordInput
              id="change-confirm-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat new password"
              className="h-10"
            />
          </div>

          <p className="text-muted-foreground text-xs">
            8+ characters with uppercase, lowercase, and number.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Changing...
              </>
            ) : (
              "Change Password"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 4: Run tests to verify they pass**

Run: `pnpm run test:unit tests/unit/components/change-password-dialog.test.tsx`
Expected: PASS (all 11 tests)

**Step 5: Commit**

```bash
git add components/profile/change-password-dialog.tsx tests/unit/components/change-password-dialog.test.tsx
git commit -m "$(cat <<'EOF'
feat: add ChangePasswordDialog component

Separate modal for password changes with:
- Form validation (required fields, strength, match)
- Loading state during submission
- Form reset on close
- Enter key submission
- Error/success toast feedback

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Create ChangeEmailDialog Component

**Files:**

- Create: `components/profile/change-email-dialog.tsx`
- Create: `tests/unit/components/change-email-dialog.test.tsx`

**Step 1: Write the failing component test**

Create `tests/unit/components/change-email-dialog.test.tsx`:

```tsx
/**
 * Unit tests for ChangeEmailDialog component.
 * Tests form validation, submission, and error handling.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChangeEmailDialog } from "@/components/profile/change-email-dialog";

// Mock user-actions
const mockUpdateProfile = vi.fn();
vi.mock("@/lib/user-actions", () => ({
  updateProfile: (...args: unknown[]) => mockUpdateProfile(...args),
}));

// Mock sonner toast
const mockToast = { success: vi.fn(), error: vi.fn() };
vi.mock("sonner", () => ({
  toast: mockToast,
}));

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
    mockUpdateProfile.mockImplementation(() => new Promise(() => {})); // Never resolves
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
```

**Step 2: Run tests to verify they fail**

Run: `pnpm run test:unit tests/unit/components/change-email-dialog.test.tsx`
Expected: FAIL with "Cannot find module '@/components/profile/change-email-dialog'"

**Step 3: Create the ChangeEmailDialog component**

Create `components/profile/change-email-dialog.tsx`:

```tsx
/**
 * Change email dialog component.
 * Dedicated modal for email changes with password verification.
 */

"use client";

import { useState, useCallback, useEffect } from "react";
import { Loader2, Mail } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { updateProfile } from "@/lib/user-actions";
import { emailSchema } from "@/lib/validations";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ChangeEmailDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog open state changes */
  onOpenChange: (open: boolean) => void;
  /** Current user email */
  currentEmail: string;
  /** Callback when email is successfully changed */
  onEmailChange?: () => void;
}

/**
 * Modal dialog for changing user email.
 * Requires password verification for security.
 *
 * @param open - Whether dialog is visible
 * @param onOpenChange - Callback for visibility changes
 * @param currentEmail - Current user email address
 * @param onEmailChange - Callback after successful email change
 */
export function ChangeEmailDialog({
  open,
  onOpenChange,
  currentEmail,
  onEmailChange,
}: ChangeEmailDialogProps) {
  const [newEmail, setNewEmail] = useState(currentEmail);
  const [password, setPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Reset form when dialog opens/closes or currentEmail changes
  useEffect(() => {
    if (open) {
      setNewEmail(currentEmail);
      setPassword("");
    }
  }, [open, currentEmail]);

  /**
   * Validates and submits email change.
   */
  const handleSubmit = useCallback(async () => {
    // Check all fields are filled
    if (!newEmail || !password) {
      toast.error("All fields are required");
      return;
    }

    // Validate email format
    const validation = emailSchema.safeParse(newEmail);
    if (!validation.success) {
      toast.error("Invalid email format");
      return;
    }

    // Check email is different
    if (newEmail === currentEmail) {
      toast.error("New email must be different from current email");
      return;
    }

    setIsSaving(true);
    try {
      const result = await updateProfile({
        email: newEmail,
        currentPassword: password,
      });

      if (result.success) {
        toast.success("Email changed successfully");
        onEmailChange?.();
        onOpenChange(false);
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Failed to change email");
    } finally {
      setIsSaving(false);
    }
  }, [newEmail, password, currentEmail, onOpenChange, onEmailChange]);

  /**
   * Handles Enter key to submit form.
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !isSaving) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit, isSaving]
  );

  /**
   * Closes dialog without saving.
   */
  const handleCancel = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-xl",
                "bg-primary/10 ring-primary/20 ring-1"
              )}
            >
              <Mail className="text-primary size-5" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-lg">Change Email</DialogTitle>
              <DialogDescription className="text-sm">
                Enter your new email and verify with your password
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4" onKeyDown={handleKeyDown}>
          <div className="space-y-2">
            <Label htmlFor="change-new-email">New Email</Label>
            <Input
              id="change-new-email"
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="Enter new email address"
              className="h-10"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="change-email-password">Current Password</Label>
            <PasswordInput
              id="change-email-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Verify with your password"
              className="h-10"
            />
            <p className="text-muted-foreground text-xs">
              Password required to confirm this change.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Changing...
              </>
            ) : (
              "Change Email"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 4: Run tests to verify they pass**

Run: `pnpm run test:unit tests/unit/components/change-email-dialog.test.tsx`
Expected: PASS (all 13 tests)

**Step 5: Commit**

```bash
git add components/profile/change-email-dialog.tsx tests/unit/components/change-email-dialog.test.tsx
git commit -m "$(cat <<'EOF'
feat: add ChangeEmailDialog component

Separate modal for email changes with:
- Password verification for security
- Email format validation
- Same-email detection
- Loading state during submission
- Form reset on close
- Enter key submission
- Error/success toast feedback

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Update SettingsDialog to Use Both Modals

**Files:**

- Modify: `components/profile/settings-dialog.tsx`
- Create: `tests/unit/components/settings-dialog.test.tsx`

**Step 1: Write the test for Settings dialog integration**

Create `tests/unit/components/settings-dialog.test.tsx`:

```tsx
/**
 * Unit tests for SettingsDialog integration with modals.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SettingsDialog } from "@/components/profile/settings-dialog";

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
```

**Step 2: Run tests to verify they fail**

Run: `pnpm run test:unit tests/unit/components/settings-dialog.test.tsx`
Expected: FAIL (inline fields still present, buttons not found)

**Step 3: Update SettingsDialog**

Modify `components/profile/settings-dialog.tsx`:

**3a. Update imports (at top of file):**

```tsx
import { ChangePasswordDialog } from "@/components/profile/change-password-dialog";
import { ChangeEmailDialog } from "@/components/profile/change-email-dialog";
```

Remove `PasswordInput` from imports if no longer used.

**3b. Add state for modals (after line ~113):**

```tsx
const [changePasswordOpen, setChangePasswordOpen] = useState(false);
const [changeEmailOpen, setChangeEmailOpen] = useState(false);
```

**3c. Remove password state variables (delete these lines ~95-97):**

```tsx
// DELETE:
// const [currentPassword, setCurrentPassword] = useState("");
// const [newPassword, setNewPassword] = useState("");
// const [confirmPassword, setConfirmPassword] = useState("");
```

**3d. Update isDirty useMemo (remove password logic):**

```tsx
const isDirty = useMemo(() => {
  const nameChanged = name !== originalValues.name;
  const profileImageChanging = profileImage !== null || removeProfile;
  const heroImageChanging = heroImage !== null || removeHero;

  return nameChanged || profileImageChanging || heroImageChanging;
}, [name, profileImage, heroImage, removeProfile, removeHero, originalValues]);
```

**3e. Remove isPasswordRequired useMemo entirely**

**3f. Update useEffect reset (remove password fields):**

```tsx
useEffect(() => {
  setName(user.name ?? "");
  setEmail(user.email);
  setProfileImage(null);
  setHeroImage(null);
  setProfileImagePreview(null);
  setHeroImagePreview(null);
  setRemoveProfile(false);
  setRemoveHero(false);
}, [user.name, user.email]);
```

**3g. Update handleCancel (remove password reset):**

```tsx
const handleCancel = useCallback(() => {
  setName(originalValues.name);
  setEmail(originalValues.email);
  setProfileImage(null);
  setHeroImage(null);
  setProfileImagePreview(null);
  setHeroImagePreview(null);
  setRemoveProfile(false);
  setRemoveHero(false);
  onOpenChange(false);
}, [originalValues, onOpenChange]);
```

**3h. Update handleSave (remove password change logic, remove email change logic):**

```tsx
const handleSave = useCallback(async () => {
  setIsSaving(true);
  try {
    let hasError = false;

    // Update profile (name only - email handled by modal)
    const nameChanged = name !== originalValues.name;

    if (nameChanged) {
      const result = await updateProfile({
        name: name,
      });

      if (!result.success) {
        toast.error(result.error);
        hasError = true;
      }
    }

    // Upload profile image
    if (profileImage && !hasError) {
      const formData = new FormData();
      formData.append("file", profileImage);
      const result = await uploadProfileImage(formData);

      if (!result.success) {
        toast.error(result.error);
        hasError = true;
      }
    } else if (removeProfile && !hasError) {
      const result = await removeProfileImage();
      if (!result.success) {
        toast.error(result.error);
        hasError = true;
      }
    }

    // Upload hero image
    if (heroImage && !hasError) {
      const formData = new FormData();
      formData.append("file", heroImage);
      const result = await uploadHeroImage(formData);

      if (!result.success) {
        toast.error(result.error);
        hasError = true;
      }
    } else if (removeHero && !hasError) {
      const result = await removeHeroImage();
      if (!result.success) {
        toast.error(result.error);
        hasError = true;
      }
    }

    if (!hasError) {
      toast.success("Settings updated");
      await onProfileChange?.().catch(() => {});
      onOpenChange(false);
    }
  } catch {
    toast.error("Failed to update settings");
  } finally {
    setIsSaving(false);
  }
}, [
  name,
  profileImage,
  heroImage,
  removeProfile,
  removeHero,
  originalValues,
  onProfileChange,
  onOpenChange,
]);
```

**3i. Replace Email Section JSX (~lines 486-510) with read-only display + button:**

```tsx
{
  /* Email Section */
}
<div className="space-y-3">
  <div className="flex items-center gap-2">
    <div
      className={cn(
        "flex size-7 items-center justify-center rounded-lg",
        "bg-primary/10"
      )}
    >
      <Mail className="text-primary size-3.5" />
    </div>
    <Label className="text-sm font-medium">Email</Label>
  </div>
  <div className="flex items-center justify-between gap-4">
    <span className="text-muted-foreground truncate text-sm">{email}</span>
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => setChangeEmailOpen(true)}
    >
      Change Email
    </Button>
  </div>
</div>;
```

**3j. Replace Password Section JSX (~lines 588-658) with button:**

```tsx
{
  /* Password Section */
}
<div className="space-y-3">
  <div className="flex items-center gap-2">
    <div
      className={cn(
        "flex size-7 items-center justify-center rounded-lg",
        "bg-primary/10"
      )}
    >
      <Lock className="text-primary size-3.5" />
    </div>
    <Label className="text-sm font-medium">Password</Label>
  </div>
  <Button
    type="button"
    variant="outline"
    onClick={() => setChangePasswordOpen(true)}
    className="w-full"
  >
    <Lock className="mr-2 size-4" />
    Change Password
  </Button>
  <p className="text-muted-foreground text-xs">
    Update your password to keep your account secure.
  </p>
</div>;
```

**3k. Add modals before closing Dialog tag:**

```tsx
{
  /* Change Password Modal */
}
<ChangePasswordDialog
  open={changePasswordOpen}
  onOpenChange={setChangePasswordOpen}
/>;

{
  /* Change Email Modal */
}
<ChangeEmailDialog
  open={changeEmailOpen}
  onOpenChange={setChangeEmailOpen}
  currentEmail={email}
  onEmailChange={async () => {
    await onProfileChange?.();
    // Update local email state after successful change
    const updatedEmail = email; // Will be refreshed by onProfileChange
  }}
/>;
```

**Step 4: Run tests to verify they pass**

Run: `pnpm run test:unit tests/unit/components/settings-dialog.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add components/profile/settings-dialog.tsx tests/unit/components/settings-dialog.test.tsx
git commit -m "$(cat <<'EOF'
refactor: extract password and email change to separate modals

Replace inline password/email fields in SettingsDialog with:
- "Change Password" button → ChangePasswordDialog
- "Change Email" button → ChangeEmailDialog
- Read-only email display in main settings
- Simpler SettingsDialog focused on profile settings

Security improvement: Email changes now require explicit
password verification in dedicated modal.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Update E2E Tests for New Modal Flow

**Files:**

- Modify: `e2e/journeys/profile/settings.spec.ts`

**Step 1: Update existing tests and add new ones**

Replace `e2e/journeys/profile/settings.spec.ts`:

```ts
/**
 * E2E tests for profile settings functionality.
 * Tests opening dialog, updating name, and verifying changes.
 */

import { test, expect } from "../../fixtures";
import { generateUniqueEmail, TEST_PASSWORD } from "../../helpers/test-user";

// Helper to get the profile dialog (excludes mobile sidebar which is also a dialog)
const getProfileDialog = (page: import("@playwright/test").Page) =>
  page.locator('[data-slot="dialog-content"]').first();

// Helper to get nested modal (change password/email dialogs)
const getNestedDialog = (page: import("@playwright/test").Page) =>
  page.locator('[data-slot="dialog-content"]').nth(1);

test.describe("Profile Settings Journey", () => {
  test.beforeEach(async ({ page, signUpPage }) => {
    // Create a fresh user for each test
    const email = generateUniqueEmail("profile");
    await signUpPage.goto();
    await signUpPage.signUp(email, TEST_PASSWORD, TEST_PASSWORD);
    await expect(page).toHaveURL("/my-items", { timeout: 10000 });
  });

  test("can open profile settings from user dropdown", async ({
    page,
    myItemsPage,
  }) => {
    await myItemsPage.openProfileSettings();

    // Dialog should be visible with correct title
    await expect(getProfileDialog(page)).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
    await expect(
      page.getByText("Manage your account and connections")
    ).toBeVisible();
  });

  test("shows profile sections in dialog", async ({ page, myItemsPage }) => {
    await myItemsPage.openProfileSettings();
    await expect(getProfileDialog(page)).toBeVisible({ timeout: 10000 });

    // Check all sections are visible
    await expect(page.getByText("Profile Picture")).toBeVisible();
    await expect(page.getByLabel("Display Name")).toBeVisible();
    await expect(page.getByText("Hero Banner")).toBeVisible();
    // Password and Email should be buttons now, not form fields
    await expect(
      page.getByRole("button", { name: /change password/i })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /change email/i })
    ).toBeVisible();
  });

  test("update display name and verify in sidebar", async ({
    page,
    myItemsPage,
  }) => {
    await myItemsPage.openProfileSettings();
    await expect(getProfileDialog(page)).toBeVisible({ timeout: 10000 });

    // Update name
    const nameInput = page.getByLabel("Display Name");
    await nameInput.clear();
    await nameInput.fill("Updated Name");

    // Save changes
    await page.getByRole("button", { name: "Save Changes" }).click();

    // Wait for dialog to close
    await expect(getProfileDialog(page)).not.toBeVisible({ timeout: 5000 });

    // Verify success toast
    await expect(page.getByText("Settings updated")).toBeVisible();
  });

  test("cancel closes dialog without saving", async ({ page, myItemsPage }) => {
    await myItemsPage.openProfileSettings();
    await expect(getProfileDialog(page)).toBeVisible({ timeout: 10000 });

    // Make a change
    const nameInput = page.getByLabel("Display Name");
    const originalName = await nameInput.inputValue();
    await nameInput.clear();
    await nameInput.fill("Changed Name");

    // Click cancel
    await page.getByRole("button", { name: "Cancel" }).click();

    // Dialog should close
    await expect(getProfileDialog(page)).not.toBeVisible();

    // Re-open and check name is unchanged
    await myItemsPage.openProfileSettings();
    await expect(getProfileDialog(page)).toBeVisible({ timeout: 10000 });
    await expect(page.getByLabel("Display Name")).toHaveValue(originalName);
  });

  test("save button disabled when no changes", async ({
    page,
    myItemsPage,
  }) => {
    await myItemsPage.openProfileSettings();

    // Wait for dialog to be visible
    await expect(getProfileDialog(page)).toBeVisible({ timeout: 10000 });

    const saveButton = page.getByRole("button", { name: "Save Changes" });

    // Initially disabled when no changes made
    await expect(saveButton).toBeDisabled();

    // Make a change
    const nameInput = page.getByLabel("Display Name");
    await nameInput.fill("New Name");

    // Now save should be enabled
    await expect(saveButton).toBeEnabled();
  });

  test("my items page shows shader fallback when no hero image", async ({
    page,
    myItemsPage,
  }) => {
    // Navigate to my-items page
    await myItemsPage.goto();

    // Should see the hero section (with shader fallback since no hero image)
    await expect(page.getByTestId("item-hero")).toBeVisible();

    // For new user without hero image, fallback should be present
    await expect(page.getByTestId("hero-fallback")).toBeVisible();
  });
});

test.describe("Change Password Modal", () => {
  test.beforeEach(async ({ page, signUpPage }) => {
    const email = generateUniqueEmail("password");
    await signUpPage.goto();
    await signUpPage.signUp(email, TEST_PASSWORD, TEST_PASSWORD);
    await expect(page).toHaveURL("/my-items", { timeout: 10000 });
  });

  test("opens change password modal from settings", async ({
    page,
    myItemsPage,
  }) => {
    await myItemsPage.openProfileSettings();
    await expect(getProfileDialog(page)).toBeVisible({ timeout: 10000 });

    // Click Change Password button
    await page.getByRole("button", { name: /change password/i }).click();

    // Modal should open
    await expect(
      page.getByRole("heading", { name: /change password/i })
    ).toBeVisible();
    await expect(page.getByLabel("Current Password")).toBeVisible();
    await expect(page.getByLabel(/^new password$/i)).toBeVisible();
    await expect(page.getByLabel(/confirm new password/i)).toBeVisible();
  });

  test("password mismatch shows error", async ({ page, myItemsPage }) => {
    await myItemsPage.openProfileSettings();
    await expect(getProfileDialog(page)).toBeVisible({ timeout: 10000 });

    // Open change password modal
    await page.getByRole("button", { name: /change password/i }).click();
    await expect(
      page.getByRole("heading", { name: /change password/i })
    ).toBeVisible();

    // Fill password fields with mismatched values
    await page.getByLabel("Current Password").fill(TEST_PASSWORD);
    await page.getByLabel(/^new password$/i).fill("NewPassword1");
    await page.getByLabel(/confirm new password/i).fill("DifferentPassword1");

    // Try to submit
    await page.getByRole("button", { name: /^change password$/i }).click();

    // Should show mismatch error
    await expect(page.getByText("New passwords do not match")).toBeVisible();
  });

  test("shows error for wrong current password", async ({
    page,
    myItemsPage,
  }) => {
    await myItemsPage.openProfileSettings();
    await expect(getProfileDialog(page)).toBeVisible({ timeout: 10000 });

    // Open change password modal
    await page.getByRole("button", { name: /change password/i }).click();
    await expect(
      page.getByRole("heading", { name: /change password/i })
    ).toBeVisible();

    // Fill with wrong current password
    await page.getByLabel("Current Password").fill("WrongPassword1");
    await page.getByLabel(/^new password$/i).fill("NewPassword1");
    await page.getByLabel(/confirm new password/i).fill("NewPassword1");

    // Submit
    await page.getByRole("button", { name: /^change password$/i }).click();

    // Should show error
    await expect(page.getByText("Incorrect current password")).toBeVisible();
  });

  test("can change password successfully", async ({ page, myItemsPage }) => {
    await myItemsPage.openProfileSettings();
    await expect(getProfileDialog(page)).toBeVisible({ timeout: 10000 });

    // Open change password modal
    await page.getByRole("button", { name: /change password/i }).click();
    await expect(
      page.getByRole("heading", { name: /change password/i })
    ).toBeVisible();

    // Fill correct values
    await page.getByLabel("Current Password").fill(TEST_PASSWORD);
    await page.getByLabel(/^new password$/i).fill("NewPassword1");
    await page.getByLabel(/confirm new password/i).fill("NewPassword1");

    // Submit
    await page.getByRole("button", { name: /^change password$/i }).click();

    // Should show success toast and close modal
    await expect(page.getByText("Password changed successfully")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /change password/i })
    ).not.toBeVisible();
  });

  test("cancel closes change password modal", async ({ page, myItemsPage }) => {
    await myItemsPage.openProfileSettings();
    await expect(getProfileDialog(page)).toBeVisible({ timeout: 10000 });

    // Open change password modal
    await page.getByRole("button", { name: /change password/i }).click();
    await expect(
      page.getByRole("heading", { name: /change password/i })
    ).toBeVisible();

    // Click cancel
    await page.getByRole("button", { name: /cancel/i }).click();

    // Modal should close, settings should still be open
    await expect(
      page.getByRole("heading", { name: /change password/i })
    ).not.toBeVisible();
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  });
});

test.describe("Change Email Modal", () => {
  let testEmail: string;

  test.beforeEach(async ({ page, signUpPage }) => {
    testEmail = generateUniqueEmail("email");
    await signUpPage.goto();
    await signUpPage.signUp(testEmail, TEST_PASSWORD, TEST_PASSWORD);
    await expect(page).toHaveURL("/my-items", { timeout: 10000 });
  });

  test("opens change email modal from settings", async ({
    page,
    myItemsPage,
  }) => {
    await myItemsPage.openProfileSettings();
    await expect(getProfileDialog(page)).toBeVisible({ timeout: 10000 });

    // Click Change Email button
    await page.getByRole("button", { name: /change email/i }).click();

    // Modal should open with current email pre-filled
    await expect(
      page.getByRole("heading", { name: /change email/i })
    ).toBeVisible();
    await expect(page.getByLabel(/new email/i)).toHaveValue(testEmail);
    await expect(page.getByLabel("Current Password")).toBeVisible();
  });

  test("shows error when email unchanged", async ({ page, myItemsPage }) => {
    await myItemsPage.openProfileSettings();
    await expect(getProfileDialog(page)).toBeVisible({ timeout: 10000 });

    // Open change email modal
    await page.getByRole("button", { name: /change email/i }).click();
    await expect(
      page.getByRole("heading", { name: /change email/i })
    ).toBeVisible();

    // Don't change email, just enter password
    await page.getByLabel("Current Password").fill(TEST_PASSWORD);

    // Submit
    await page.getByRole("button", { name: /^change email$/i }).click();

    // Should show error
    await expect(
      page.getByText("New email must be different from current email")
    ).toBeVisible();
  });

  test("shows error for wrong password", async ({ page, myItemsPage }) => {
    await myItemsPage.openProfileSettings();
    await expect(getProfileDialog(page)).toBeVisible({ timeout: 10000 });

    // Open change email modal
    await page.getByRole("button", { name: /change email/i }).click();
    await expect(
      page.getByRole("heading", { name: /change email/i })
    ).toBeVisible();

    // Change email with wrong password
    await page.getByLabel(/new email/i).clear();
    await page.getByLabel(/new email/i).fill("newemail@example.com");
    await page.getByLabel("Current Password").fill("WrongPassword1");

    // Submit
    await page.getByRole("button", { name: /^change email$/i }).click();

    // Should show error
    await expect(page.getByText("Incorrect password")).toBeVisible();
  });

  test("can change email successfully", async ({ page, myItemsPage }) => {
    await myItemsPage.openProfileSettings();
    await expect(getProfileDialog(page)).toBeVisible({ timeout: 10000 });

    // Open change email modal
    await page.getByRole("button", { name: /change email/i }).click();
    await expect(
      page.getByRole("heading", { name: /change email/i })
    ).toBeVisible();

    const newEmail = generateUniqueEmail("changed");

    // Fill correct values
    await page.getByLabel(/new email/i).clear();
    await page.getByLabel(/new email/i).fill(newEmail);
    await page.getByLabel("Current Password").fill(TEST_PASSWORD);

    // Submit
    await page.getByRole("button", { name: /^change email$/i }).click();

    // Should show success toast and close modal
    await expect(page.getByText("Email changed successfully")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /change email/i })
    ).not.toBeVisible();
  });

  test("cancel closes change email modal", async ({ page, myItemsPage }) => {
    await myItemsPage.openProfileSettings();
    await expect(getProfileDialog(page)).toBeVisible({ timeout: 10000 });

    // Open change email modal
    await page.getByRole("button", { name: /change email/i }).click();
    await expect(
      page.getByRole("heading", { name: /change email/i })
    ).toBeVisible();

    // Click cancel
    await page.getByRole("button", { name: /cancel/i }).click();

    // Modal should close, settings should still be open
    await expect(
      page.getByRole("heading", { name: /change email/i })
    ).not.toBeVisible();
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  });
});
```

**Step 2: Run E2E tests**

Run: `pnpm run test:e2e e2e/journeys/profile/settings.spec.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add e2e/journeys/profile/settings.spec.ts
git commit -m "$(cat <<'EOF'
test(e2e): comprehensive tests for password and email modals

- Add test suite for Change Password Modal (5 tests)
- Add test suite for Change Email Modal (5 tests)
- Update Profile Settings tests for new structure
- Test success, error, and cancel flows

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Export Components from Index

**Files:**

- Modify or create: `components/profile/index.ts`

**Step 1: Update barrel export**

Create or update `components/profile/index.ts`:

```ts
/**
 * Profile components barrel export.
 */

export { SettingsDialog } from "./settings-dialog";
export { ChangePasswordDialog } from "./change-password-dialog";
export { ChangeEmailDialog } from "./change-email-dialog";
```

**Step 2: Run type check**

Run: `pnpm run type-check`
Expected: PASS

**Step 3: Commit**

```bash
git add components/profile/index.ts
git commit -m "$(cat <<'EOF'
chore: export password and email dialogs from profile index

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Run Full Test Suite

**Step 1: Run all checks**

Run: `pnpm run check`
Expected: PASS (format, lint, type-check, knip, build)

**Step 2: Run unit tests**

Run: `pnpm run test:unit`
Expected: PASS

**Step 3: Run E2E tests**

Run: `pnpm run test:e2e --project=chromium`
Expected: PASS

**Step 4: Final commit (if any formatting/lint fixes)**

```bash
git add -A
git commit -m "$(cat <<'EOF'
chore: formatting and lint fixes

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Summary of Changes

### New Files

- `components/profile/change-password-dialog.tsx` - Password change modal
- `components/profile/change-email-dialog.tsx` - Email change modal
- `tests/unit/components/change-password-dialog.test.tsx` - Password modal tests (11 tests)
- `tests/unit/components/change-email-dialog.test.tsx` - Email modal tests (13 tests)
- `tests/unit/components/settings-dialog.test.tsx` - Settings integration tests (5 tests)

### Modified Files

- `components/profile/settings-dialog.tsx` - Removed inline fields, added modal buttons
- `components/profile/index.ts` - Added exports
- `e2e/journeys/profile/settings.spec.ts` - Comprehensive modal tests (17 total tests)

### Test Coverage

- **Unit tests (29 new tests)**:
  - ChangePasswordDialog: validation, submission, errors, reset, keyboard, cancel
  - ChangeEmailDialog: validation, submission, errors, reset, keyboard, cancel
  - SettingsDialog: modal integration
- **E2E tests (17 tests)**:
  - Profile settings: 6 tests
  - Change password modal: 5 tests
  - Change email modal: 6 tests

### No Changes Needed

- `lib/user-actions.ts` - Server actions unchanged
- `lib/validations.ts` - Schemas unchanged
- `lib/rate-limit.ts` - Rate limiting unchanged
- Integration tests - Server actions already tested

### Security Improvements

- Email changes now require explicit password verification in dedicated modal
- Password changes isolated to focused modal with clear UX
- Consistent security patterns across both sensitive operations
