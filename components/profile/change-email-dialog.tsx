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
