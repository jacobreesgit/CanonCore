/**
 * Verification and lockout message constants.
 * Centralised for consistency across banner, toasts, and email templates.
 */

export const VERIFICATION_MESSAGES = {
  BANNER_NUDGE: "Please verify your email address to secure your account.",
  RESEND_SUCCESS: "Verification email sent",
  RESEND_FAIL: "Failed to send verification email",
  emailChangePending: (email: string) =>
    `Verification email sent to ${email}. Your email won't change until you verify the new address.`,
} as const;

export const LOCKOUT_MESSAGES = {
  lockedOut: (minutes: number) =>
    `Account temporarily locked. Try again in ${minutes} minutes.`,
  INVALID_CREDENTIALS: "Invalid email or password",
} as const;
