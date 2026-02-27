/**
 * Zod validation schemas for authentication, items, and playlists.
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
// Playlist Validation
// =============================================================================

/**
 * Playlist name: 1-255 characters, trimmed.
 * More permissive than item names — allows any printable characters.
 */
export const playlistNameSchema = z
  .string()
  .transform((val) => val.trim())
  .pipe(
    z
      .string()
      .min(1, "Playlist name is required")
      .max(255, "Playlist name must be 255 characters or less")
  );

/**
 * Playlist description: max 1000 characters, trimmed.
 * Matches item description schema (same DB column limit).
 */
export const playlistDescriptionSchema = z
  .string()
  .transform((val) => val.trim())
  .pipe(z.string().max(1000, "Description must be 1000 characters or less"));

/** Allowed MIME types for playlist artwork. */
const ALLOWED_ARTWORK_MIMES = ["image/jpeg", "image/png", "image/webp"];

/** Max file size for playlist artwork (2MB). */
const MAX_ARTWORK_SIZE = 2 * 1024 * 1024;

/** Validation schema for playlist artwork file. */
export const playlistArtworkSchema = z.object({
  size: z.number().max(MAX_ARTWORK_SIZE, "Image must be under 2MB"),
  type: z.string().refine((t) => ALLOWED_ARTWORK_MIMES.includes(t), {
    message: "Only JPEG, PNG, and WebP images are allowed",
  }),
});

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

// =============================================================================
// Account Management Validation
// =============================================================================

/** Schema for account deletion confirmation. */
export const deleteAccountSchema = z.object({
  password: z.string().min(1, "Password is required"),
  confirmText: z.string().refine((val) => val === "DELETE", {
    message: 'You must type "DELETE" to confirm',
  }),
});

// =============================================================================
// TMDB Response Validation
// =============================================================================

/**
 * TMDB image metadata schema.
 * Validates image data from TMDB images API responses.
 */
export const tmdbImageSchema = z.object({
  file_path: z.string(),
  width: z.number(),
  height: z.number(),
  vote_average: z.number(),
  aspect_ratio: z.number().optional(),
  iso_639_1: z.string().nullable().optional(),
});

/**
 * TMDB season metadata schema.
 * Validates season data from /tv/{id}/season/{num} endpoint.
 */
export const seasonMetadataSchema = z.object({
  id: z.number(),
  name: z.string(),
  overview: z.string(),
  poster_path: z.string().nullable(),
  air_date: z.string().nullable(),
  season_number: z.number(),
});

/**
 * TMDB season images schema.
 * Validates images from /tv/{id}/season/{num}/images endpoint.
 * Seasons only have posters (no backdrops).
 */
export const tmdbSeasonImagesSchema = z.object({
  posters: z.array(tmdbImageSchema),
});

/**
 * TMDB episode images schema.
 * Validates images from /tv/{id}/season/{num}/episode/{num}/images endpoint.
 * Episodes only have stills (no posters or backdrops).
 */
export const tmdbEpisodeImagesSchema = z.object({
  stills: z.array(tmdbImageSchema),
});

/**
 * Schema for clearing TMDB fields on an item.
 * Supports clearing individual artwork paths or full TMDB detach.
 */
export const clearTmdbFieldSchema = z.object({
  itemId: z.string().min(1),
  field: z.enum(["poster", "backdrop", "logo", "all"]),
});

/**
 * Schema for TMDB display options.
 * Validates the 7 boolean display preference fields.
 */
export const tmdbDisplayOptionsSchema = z.object({
  showTagline: z.boolean(),
  showMetadata: z.boolean(),
  showGenres: z.boolean(),
  showCast: z.boolean(),
  showProviders: z.boolean(),
  showVideos: z.boolean(),
  showRecommendations: z.boolean(),
});

// =============================================================================
// Watch Record Validation
// =============================================================================

/** Validates a single item ID (non-empty string). */
export const itemIdSchema = z.string().min(1, "Item ID is required");

/** Validates a single playlist ID (non-empty string). */
export const playlistIdSchema = z.string().min(1, "Playlist ID is required");

/** Ordered list of playlist IDs for shelf reordering. Max 20 shelves. */
export const shelfOrderSchema = z.array(z.string()).min(1).max(20);
