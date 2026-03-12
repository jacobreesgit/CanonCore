/**
 * Email sending utilities using Resend.
 * Handles transactional emails for authentication flows.
 */

import { Resend } from "resend";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

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
    logger.error({ err: error, email }, "Failed to send email");
    throw new Error("Failed to send email");
  }
}

/**
 * Sends an email verification email with a secure token link.
 *
 * @param email - Recipient email address
 * @param token - Unique verification token (expires in 30 minutes)
 * @throws Error if email sending fails
 */
export async function sendVerificationEmail(
  email: string,
  token: string
): Promise<void> {
  const verifyUrl = `${env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/verify-email?token=${token}`;

  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to: email,
    subject: "Verify your email address",
    html: `
      <h1>Verify your email</h1>
      <p>Click the link below to verify your email address. This link expires in 30 minutes.</p>
      <a href="${verifyUrl}">Verify Email</a>
      <p>If you didn't create an account, you can safely ignore this email.</p>
    `,
  });

  if (error) {
    logger.error({ err: error, email }, "Failed to send verification email");
    throw new Error("Failed to send verification email");
  }
}
