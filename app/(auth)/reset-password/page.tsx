/**
 * Reset password page for setting a new password.
 * Server component wrapper that exports metadata.
 */

import type { Metadata } from "next";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = {
  title: "Reset Password - CanonCore",
  description: "Set a new password for your CanonCore account.",
};

/**
 * Renders the reset password page with metadata.
 */
export default function ResetPasswordPage() {
  return <ResetPasswordForm />;
}
