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
