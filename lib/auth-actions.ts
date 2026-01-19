/**
 * Server actions for authentication flows.
 * Handles sign-up, password reset requests, and password updates.
 * Includes rate limiting, validation, and security logging.
 */

"use server";

import { hash } from "bcryptjs";
import { randomBytes } from "crypto";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/email";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  signUpSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "@/lib/validations";
import { logger } from "@/lib/logger";
import { handlePrismaError } from "@/lib/errors";

/**
 * Result type for auth actions.
 * Either success or error, never both.
 */
type AuthResult =
  | { success: true; error?: never }
  | { success?: never; error: string };

/**
 * Logs security-related events for monitoring.
 *
 * @param event - Type of security event
 * @param details - Additional event details
 */
async function logSecurityEvent(
  event: string,
  details: Record<string, unknown>
): Promise<void> {
  const headersList = await headers();
  const ip = headersList.get("x-forwarded-for") ?? "127.0.0.1";

  logger.warn({ event, ip, ...details }, `[SECURITY] ${event}`);
}

/**
 * Creates a new user account with hashed password.
 * Includes rate limiting and input validation.
 *
 * @param email - User's email address
 * @param password - Plain text password (will be hashed with bcrypt)
 * @param username - Optional username for public profile
 * @returns Success object or error message
 *
 * @example
 * const result = await signUp("user@example.com", "Password123!", "johndoe");
 * if (result.error) console.error(result.error);
 */
export async function signUp(
  email: string,
  password: string,
  username?: string
): Promise<AuthResult> {
  // Rate limiting
  const rateLimitResult = await checkRateLimit("signUp");
  if (rateLimitResult) {
    await logSecurityEvent("RATE_LIMIT_EXCEEDED", { action: "signUp", email });
    return rateLimitResult;
  }

  // Validation
  const validation = signUpSchema.safeParse({ email, password });
  if (!validation.success) {
    return { error: validation.error.issues[0].message };
  }

  // Validate username if provided
  if (username) {
    const { usernameSchema } = await import("@/lib/validations");
    const usernameValidation = usernameSchema.safeParse(username);
    if (!usernameValidation.success) {
      return { error: usernameValidation.error.issues[0].message };
    }
  }

  try {
    // Run uniqueness checks in parallel (async-parallel pattern)
    const [existingUser, existingUsername] = await Promise.all([
      prisma.user.findUnique({
        where: { email },
      }),
      username
        ? prisma.user.findFirst({
            where: {
              username: {
                equals: username,
                mode: "insensitive",
              },
            },
          })
        : Promise.resolve(null),
    ]);

    if (existingUser) {
      await logSecurityEvent("SIGNUP_DUPLICATE_EMAIL", { email });
      return { error: "An account with this email already exists" };
    }

    if (existingUsername) {
      return { error: "This username is already taken" };
    }

    const passwordHash = await hash(password, 10);

    await prisma.user.create({
      data: {
        email,
        passwordHash,
        username: username ?? null,
      },
    });

    await logSecurityEvent("SIGNUP_SUCCESS", { email, username });
    return { success: true };
  } catch (error) {
    // Check for foreign key constraint (shouldn't happen for user create, but for safety)
    const prismaError = handlePrismaError(error);
    if (prismaError) return prismaError;

    logger.error({ err: error, email }, "Sign up error");
    throw error;
  }
}

/**
 * Initiates password reset flow by sending a reset email.
 * Always returns success to prevent email enumeration attacks.
 * Token expires in 30 minutes.
 *
 * @param email - Email address to send reset link to
 * @returns Success object (always, for security)
 *
 * @example
 * const result = await forgotPassword("user@example.com");
 * // Always shows success message to user
 */
export async function forgotPassword(email: string): Promise<AuthResult> {
  // Rate limiting
  const rateLimitResult = await checkRateLimit("forgotPassword");
  if (rateLimitResult) {
    await logSecurityEvent("RATE_LIMIT_EXCEEDED", {
      action: "forgotPassword",
      email,
    });
    return rateLimitResult;
  }

  // Validation
  const validation = forgotPasswordSchema.safeParse({ email });
  if (!validation.success) {
    return { error: validation.error.issues[0].message };
  }

  const user = await prisma.user.findUnique({
    where: { email },
  });

  // Always return success to prevent email enumeration
  if (!user) {
    await logSecurityEvent("FORGOT_PASSWORD_UNKNOWN_EMAIL", { email });
    return { success: true };
  }

  // Delete any existing password reset tokens for this user
  await prisma.passwordReset.deleteMany({
    where: { userId: user.id },
  });

  // Create new reset token (expires in 30 minutes)
  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 30 * 60 * 1000);

  try {
    await prisma.passwordReset.create({
      data: {
        token,
        userId: user.id,
        expires,
      },
    });
  } catch (error) {
    // Check for user deleted between lookup and create
    const prismaError = handlePrismaError(error);
    if (prismaError) return prismaError;
    throw error;
  }

  try {
    await sendPasswordResetEmail(email, token);
  } catch (error) {
    // Clean up orphaned token if email fails
    await prisma.passwordReset.delete({ where: { token } });
    throw error;
  }

  await logSecurityEvent("PASSWORD_RESET_REQUESTED", { email });

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
export async function resetPassword(
  token: string,
  newPassword: string
): Promise<AuthResult> {
  // Validation
  const validation = resetPasswordSchema.safeParse({
    token,
    password: newPassword,
  });
  if (!validation.success) {
    return { error: validation.error.issues[0].message };
  }

  const passwordReset = await prisma.passwordReset.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!passwordReset) {
    await logSecurityEvent("RESET_PASSWORD_INVALID_TOKEN", {
      tokenPrefix: token.substring(0, 8),
    });
    return { error: "Invalid or expired reset link" };
  }

  if (passwordReset.expires < new Date()) {
    // Clean up expired token
    await prisma.passwordReset.delete({
      where: { id: passwordReset.id },
    });
    await logSecurityEvent("RESET_PASSWORD_EXPIRED_TOKEN", {
      email: passwordReset.user.email,
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

  await logSecurityEvent("PASSWORD_RESET_SUCCESS", {
    email: passwordReset.user.email,
  });

  return { success: true };
}
