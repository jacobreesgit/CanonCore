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
