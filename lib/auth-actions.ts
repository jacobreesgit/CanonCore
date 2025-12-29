/**
 * Server actions for authentication flows.
 * Handles sign-up, password reset requests, and password updates.
 */

"use server";

import { hash } from "bcryptjs";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/email";

/**
 * Creates a new user account with hashed password.
 *
 * @param email - User's email address
 * @param password - Plain text password (will be hashed with bcrypt)
 * @returns Success object or error message
 *
 * @example
 * const result = await signUp("user@example.com", "Password123!");
 * if (result.error) console.error(result.error);
 */
export async function signUp(email: string, password: string) {
  try {
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return { error: "An account with this email already exists" };
    }

    const passwordHash = await hash(password, 10);

    await prisma.user.create({
      data: {
        email,
        passwordHash,
      },
    });

    return { success: true };
  } catch (error) {
    console.error("Sign up error:", error);
    throw error;
  }
}

/**
 * Initiates password reset flow by sending a reset email.
 * Always returns success to prevent email enumeration attacks.
 *
 * @param email - Email address to send reset link to
 * @returns Success object (always, for security)
 *
 * @example
 * const result = await forgotPassword("user@example.com");
 * // Always shows success message to user
 */
export async function forgotPassword(email: string) {
  const user = await prisma.user.findUnique({
    where: { email },
  });

  // Always return success to prevent email enumeration
  if (!user) {
    return { success: true };
  }

  // Delete any existing password reset tokens for this user
  await prisma.passwordReset.deleteMany({
    where: { userId: user.id },
  });

  // Create new reset token (expires in 1 hour)
  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 60 * 60 * 1000);

  await prisma.passwordReset.create({
    data: {
      token,
      userId: user.id,
      expires,
    },
  });

  await sendPasswordResetEmail(email, token);

  return { success: true };
}

/**
 * Resets user password using a valid reset token.
 * Validates token, updates password, and cleans up used token.
 *
 * @param token - Password reset token from email link
 * @param newPassword - New password to set (will be hashed)
 * @returns Success object or error message
 *
 * @example
 * const result = await resetPassword("abc123token", "NewPassword123!");
 * if (result.success) redirect("/sign-in");
 */
export async function resetPassword(token: string, newPassword: string) {
  const passwordReset = await prisma.passwordReset.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!passwordReset) {
    return { error: "Invalid or expired reset link" };
  }

  if (passwordReset.expires < new Date()) {
    // Clean up expired token
    await prisma.passwordReset.delete({
      where: { id: passwordReset.id },
    });
    return { error: "Reset link has expired" };
  }

  const passwordHash = await hash(newPassword, 10);

  await prisma.user.update({
    where: { id: passwordReset.userId },
    data: { passwordHash },
  });

  // Delete the used token
  await prisma.passwordReset.delete({
    where: { id: passwordReset.id },
  });

  return { success: true };
}
