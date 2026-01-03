/**
 * Email sending utilities using Resend.
 * Handles transactional emails for authentication flows.
 */

import { Resend } from "resend";
import { env } from "@/lib/env";

const resend = new Resend(env.RESEND_API_KEY);

/**
 * Sends a password reset email with a secure token link.
 *
 * @param email - Recipient email address
 * @param token - Unique reset token (expires in 30 minutes)
 * @throws Error if email sending fails
 *
 * @example
 * await sendPasswordResetEmail("user@example.com", "abc123token");
 */
export async function sendPasswordResetEmail(
  email: string,
  token: string
): Promise<void> {
  const resetUrl = `${env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/reset-password?token=${token}`;

  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to: email,
    subject: "Reset your password",
    html: `
      <h1>Reset your password</h1>
      <p>Click the link below to reset your password. This link expires in 30 minutes.</p>
      <a href="${resetUrl}">Reset Password</a>
      <p>If you didn't request this, you can safely ignore this email.</p>
    `,
  });

  if (error) {
    console.error("Failed to send email:", error);
    throw new Error("Failed to send email");
  }
}
