/**
 * Zod validation schemas for authentication and items.
 * Shared between server actions for consistent validation.
 */

import { z } from "zod";

/**
 * Email validation schema.
 */
export const emailSchema = z
  .string()
  .min(1, "Email is required")
  .email("Invalid email format");

/**
 * Password validation with complexity requirements.
 * Requires: 8+ chars, uppercase, lowercase, number.
 */
export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number");

/**
 * Sign-up form validation schema.
 */
export const signUpSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

/**
 * Reset password validation schema.
 */
export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token is required"),
  password: passwordSchema,
});

/**
 * Forgot password validation schema.
 */
export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

/**
 * Item name validation schema.
 * Allows alphanumeric, spaces, hyphens, underscores, and parentheses.
 * Compatible with filesystem naming and TMDB metadata (e.g., "Torchwood (2006)").
 */
export const itemNameSchema = z
  .string()
  .min(1, "Name is required")
  .max(255, "Name too long")
  .regex(
    /^[a-zA-Z0-9\s\-_()]+$/,
    "Name can only contain letters, numbers, spaces, hyphens, underscores, and parentheses"
  );

/**
 * Item description validation schema.
 * Optional field, max 1000 characters (matches TMDB overview limit).
 * Trims whitespace before validation to prevent edge cases.
 * Allows any printable characters for flexibility.
 */
export const itemDescriptionSchema = z
  .string()
  .transform((val) => val.trim())
  .pipe(z.string().max(1000, "Description must be 1000 characters or less"));

// =============================================================================
// Public Profile Validation
// =============================================================================

import {
  RESERVED_USERNAMES as _RESERVED_USERNAMES,
  isUsernameReserved as _isUsernameReserved,
} from "@/lib/config/usernames";

// Re-export from config for backwards compatibility
export const RESERVED_USERNAMES = _RESERVED_USERNAMES;
export const isUsernameReserved = _isUsernameReserved;

/**
 * Username validation schema.
 * Rules:
 * - 3-20 characters
 * - Lowercase letters, numbers, and underscores only [a-z0-9_]
 * - Cannot start or end with underscore
 * - Cannot have consecutive underscores
 * - Not in reserved username list
 *
 * Note: Case-insensitive uniqueness is enforced at the database level
 * via a LOWER() index. This schema normalizes to lowercase.
 */
export const usernameSchema = z
  .string()
  .min(3, "Username must be at least 3 characters")
  .max(20, "Username must be 20 characters or less")
  .regex(
    /^[a-z0-9_]+$/,
    "Username can only contain lowercase letters, numbers, and underscores"
  )
  .regex(/^[a-z0-9]/, "Username cannot start with an underscore")
  .regex(/[a-z0-9]$/, "Username cannot end with an underscore")
  .regex(/^(?!.*__).+$/, "Username cannot contain consecutive underscores")
  .refine((val) => !RESERVED_USERNAMES.has(val.toLowerCase()), {
    message: "This username is reserved",
  });

/**
 * Validates a username string synchronously.
 * Returns validation result with success status and error message.
 *
 * @param username - Username to validate
 * @returns Validation result with success boolean and optional error message
 */
export function validateUsername(username: string): {
  success: boolean;
  error?: string;
} {
  const result = usernameSchema.safeParse(username);
  if (result.success) {
    return { success: true };
  }
  return { success: false, error: result.error.issues[0]?.message };
}
