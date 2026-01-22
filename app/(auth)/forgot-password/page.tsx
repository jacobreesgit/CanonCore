/**
 * Forgot password page for initiating password reset.
 * Server component wrapper that exports metadata.
 */

import type { Metadata } from "next";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = {
  title: "Forgot Password - CanonCore",
  description: "Reset your CanonCore account password.",
};

/**
 * Renders the forgot password page with metadata.
 */
export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
