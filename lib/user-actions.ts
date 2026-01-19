/**
 * Server actions for user profile management.
 * Handles profile updates, password changes, and image uploads.
 * Includes validation, security logging, and rate limiting.
 */

"use server";

import { compare, hash } from "bcryptjs";
import { headers } from "next/headers";
import sharp from "sharp";
import { fileTypeFromBuffer } from "file-type";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { emailSchema, passwordSchema, usernameSchema } from "@/lib/validations";
import { logger } from "@/lib/logger";
import type { ViewMode, SortOption } from "@/lib/types";
import {
  VALID_VIEW_MODES,
  VALID_SORT_OPTIONS,
  isValidViewMode,
  isValidSortOption,
} from "@/lib/types";

/** Result type for user actions. */
type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

/** Allowed image MIME types. */
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Max profile image size: 1MB. */
const MAX_PROFILE_IMAGE_SIZE = 1 * 1024 * 1024;

/** Max hero image size: 2MB. */
const MAX_HERO_IMAGE_SIZE = 2 * 1024 * 1024;

/**
 * Gets the current authenticated user ID.
 *
 * @returns User ID or null if not authenticated
 */
async function getAuthUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

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
 * Validates image buffer using magic bytes (not just MIME header).
 * Also checks file size.
 *
 * @param buffer - Image data as Uint8Array
 * @param maxSize - Maximum allowed size in bytes
 * @returns Validated MIME type
 * @throws Error if validation fails
 */
async function validateImageBuffer(
  buffer: Uint8Array,
  maxSize: number
): Promise<string> {
  // Check size
  if (buffer.length > maxSize) {
    throw new Error(
      `File too large. Maximum size is ${Math.round(maxSize / 1024 / 1024)}MB`
    );
  }

  // Validate actual content via magic bytes
  const type = await fileTypeFromBuffer(buffer);
  if (!type || !ALLOWED_IMAGE_TYPES.includes(type.mime)) {
    throw new Error("Invalid image format. Allowed: JPEG, PNG, WebP");
  }

  return type.mime;
}

/**
 * Strips EXIF metadata from image for privacy.
 * Removes GPS coordinates, device info, timestamps.
 *
 * @param buffer - Original image data
 * @returns Processed image without EXIF data
 */
async function stripExifMetadata(buffer: Uint8Array): Promise<Uint8Array> {
  const processed = await sharp(buffer).rotate().toBuffer();
  return new Uint8Array(processed);
}

/**
 * Update user profile (name and/or email).
 * Email changes require current password for security.
 *
 * @param data - Profile update data
 * @returns Success or error result
 */
export async function updateProfile(data: {
  name?: string;
  email?: string;
  username?: string | null;
  isPublic?: boolean;
  currentPassword?: string;
}): Promise<ActionResult<void>> {
  const userId = await getAuthUserId();
  if (!userId) {
    return { success: false, error: "Not authenticated" };
  }

  try {
    // Validate username if provided
    if (data.username !== undefined && data.username !== null) {
      const usernameValidation = usernameSchema.safeParse(data.username);
      if (!usernameValidation.success) {
        return {
          success: false,
          error: usernameValidation.error.issues[0].message,
        };
      }

      // Check username uniqueness (case-insensitive)
      const existingUsername = await prisma.user.findFirst({
        where: {
          username: {
            equals: data.username,
            mode: "insensitive",
          },
          id: { not: userId },
        },
      });

      if (existingUsername) {
        return { success: false, error: "Username already taken" };
      }
    }

    // Validate email if provided
    if (data.email !== undefined) {
      const emailValidation = emailSchema.safeParse(data.email);
      if (!emailValidation.success) {
        return {
          success: false,
          error: emailValidation.error.issues[0].message,
        };
      }

      // Email change requires password verification
      if (!data.currentPassword) {
        return {
          success: false,
          error: "Current password required to change email",
        };
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { passwordHash: true, email: true },
      });

      if (!user) {
        return { success: false, error: "User not found" };
      }

      const passwordValid = await compare(
        data.currentPassword,
        user.passwordHash
      );
      if (!passwordValid) {
        await logSecurityEvent("EMAIL_CHANGE_WRONG_PASSWORD", { userId });
        return { success: false, error: "Incorrect password" };
      }

      // Check email uniqueness
      if (data.email !== user.email) {
        const existingUser = await prisma.user.findUnique({
          where: { email: data.email },
        });
        if (existingUser) {
          return { success: false, error: "Email already in use" };
        }
      }

      await logSecurityEvent("EMAIL_CHANGE", {
        userId,
        oldEmail: user.email,
        newEmail: data.email,
      });
    }

    // Update profile
    await prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.email !== undefined && { email: data.email }),
        ...(data.username !== undefined && { username: data.username }),
        ...(data.isPublic !== undefined && { isPublic: data.isPublic }),
      },
    });

    return { success: true };
  } catch (error) {
    logger.error({ err: error }, "Update profile error");
    return { success: false, error: "Failed to update profile" };
  }
}

/**
 * Change user password.
 * Requires current password for verification.
 *
 * @param data - Password change data
 * @returns Success or error result
 */
export async function changePassword(data: {
  currentPassword: string;
  newPassword: string;
}): Promise<ActionResult<void>> {
  const userId = await getAuthUserId();
  if (!userId) {
    return { success: false, error: "Not authenticated" };
  }

  // Rate limiting
  const rateLimitResult = await checkRateLimit("passwordChange");
  if (rateLimitResult) {
    await logSecurityEvent("PASSWORD_CHANGE_RATE_LIMITED", { userId });
    return { success: false, ...rateLimitResult };
  }

  try {
    // Validate new password strength
    const passwordValidation = passwordSchema.safeParse(data.newPassword);
    if (!passwordValidation.success) {
      return {
        success: false,
        error: passwordValidation.error.issues[0].message,
      };
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });

    if (!user) {
      return { success: false, error: "User not found" };
    }

    // Verify current password
    const passwordValid = await compare(
      data.currentPassword,
      user.passwordHash
    );
    if (!passwordValid) {
      await logSecurityEvent("PASSWORD_CHANGE_WRONG_PASSWORD", { userId });
      return { success: false, error: "Incorrect current password" };
    }

    // Hash new password
    const newPasswordHash = await hash(data.newPassword, 12);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash },
    });

    await logSecurityEvent("PASSWORD_CHANGE_SUCCESS", { userId });

    return { success: true };
  } catch (error) {
    logger.error({ err: error }, "Change password error");
    return { success: false, error: "Failed to change password" };
  }
}

/**
 * Upload profile image.
 * Validates file content (magic bytes), type, and size.
 * Strips EXIF metadata for privacy.
 *
 * @param formData - FormData containing 'file' field
 * @returns Success or error result
 */
export async function uploadProfileImage(
  formData: FormData
): Promise<ActionResult<void>> {
  const userId = await getAuthUserId();
  if (!userId) {
    return { success: false, error: "Not authenticated" };
  }

  try {
    const file = formData.get("file") as File | null;
    if (!file) {
      return { success: false, error: "No file provided" };
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    // Validate and get MIME type
    const mimeType = await validateImageBuffer(buffer, MAX_PROFILE_IMAGE_SIZE);

    // Strip EXIF metadata
    const processedBuffer = await stripExifMetadata(buffer);

    await prisma.user.update({
      where: { id: userId },
      data: {
        image: processedBuffer as Uint8Array<ArrayBuffer>,
        imageMime: mimeType,
      },
    });

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    return { success: false, error: message };
  }
}

/**
 * Upload hero banner image.
 * Validates file content (magic bytes), type, and size.
 * Strips EXIF metadata for privacy.
 *
 * @param formData - FormData containing 'file' field
 * @returns Success or error result
 */
export async function uploadHeroImage(
  formData: FormData
): Promise<ActionResult<void>> {
  const userId = await getAuthUserId();
  if (!userId) {
    return { success: false, error: "Not authenticated" };
  }

  try {
    const file = formData.get("file") as File | null;
    if (!file) {
      return { success: false, error: "No file provided" };
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    // Validate and get MIME type
    const mimeType = await validateImageBuffer(buffer, MAX_HERO_IMAGE_SIZE);

    // Strip EXIF metadata
    const processedBuffer = await stripExifMetadata(buffer);

    await prisma.user.update({
      where: { id: userId },
      data: {
        heroImage: processedBuffer as Uint8Array<ArrayBuffer>,
        heroImageMime: mimeType,
      },
    });

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    return { success: false, error: message };
  }
}

/**
 * Remove profile image.
 *
 * @returns Success or error result
 */
export async function removeProfileImage(): Promise<ActionResult<void>> {
  const userId = await getAuthUserId();
  if (!userId) {
    return { success: false, error: "Not authenticated" };
  }

  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        image: null,
        imageMime: null,
      },
    });

    return { success: true };
  } catch (error) {
    logger.error({ err: error }, "Remove profile image error");
    return { success: false, error: "Failed to remove image" };
  }
}

/**
 * Remove hero image.
 *
 * @returns Success or error result
 */
export async function removeHeroImage(): Promise<ActionResult<void>> {
  const userId = await getAuthUserId();
  if (!userId) {
    return { success: false, error: "Not authenticated" };
  }

  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        heroImage: null,
        heroImageMime: null,
      },
    });

    return { success: true };
  } catch (error) {
    logger.error({ err: error }, "Remove hero image error");
    return { success: false, error: "Failed to remove image" };
  }
}

/**
 * Get current user profile data.
 *
 * @returns User profile data or error
 */
export async function getProfile(): Promise<
  ActionResult<{
    name: string | null;
    email: string;
    hasImage: boolean;
    hasHeroImage: boolean;
  }>
> {
  const userId = await getAuthUserId();
  if (!userId) {
    return { success: false, error: "Not authenticated" };
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        email: true,
        image: true,
        heroImage: true,
      },
    });

    if (!user) {
      return { success: false, error: "User not found" };
    }

    return {
      success: true,
      data: {
        name: user.name,
        email: user.email,
        hasImage: user.image !== null,
        hasHeroImage: user.heroImage !== null,
      },
    };
  } catch (error) {
    logger.error({ err: error }, "Get profile error");
    return { success: false, error: "Failed to get profile" };
  }
}

// =============================================================================
// User Preferences
// =============================================================================

/** User preferences data. */
export interface UserPreferences {
  viewMode: ViewMode;
  sortBy: SortOption;
}

/**
 * Get current user's preferences.
 * Returns defaults if no preferences are set.
 *
 * @returns User preferences or error
 *
 * @example
 * const result = await getPreferences();
 * if (result.success) {
 *   console.log(result.data.viewMode); // "grid" | "tree"
 *   console.log(result.data.sortBy);   // "custom" | "name-asc" | ...
 * }
 */
export async function getPreferences(): Promise<ActionResult<UserPreferences>> {
  const userId = await getAuthUserId();
  if (!userId) {
    return { success: false, error: "Not authenticated" };
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        defaultViewMode: true,
        defaultSortBy: true,
      },
    });

    if (!user) {
      return { success: false, error: "User not found" };
    }

    // Validate stored values, fall back to defaults if invalid
    const viewMode =
      user.defaultViewMode && isValidViewMode(user.defaultViewMode)
        ? user.defaultViewMode
        : "grid";
    const sortBy =
      user.defaultSortBy && isValidSortOption(user.defaultSortBy)
        ? user.defaultSortBy
        : "custom";

    return {
      success: true,
      data: { viewMode, sortBy },
    };
  } catch (error) {
    logger.error({ err: error }, "Get preferences error");
    return { success: false, error: "Failed to get preferences" };
  }
}

/**
 * Update user preferences.
 * Only updates provided fields.
 *
 * @param data - Preferences to update
 * @returns Success or error result
 *
 * @example
 * // Update view mode only
 * await updatePreferences({ viewMode: "tree" });
 *
 * @example
 * // Update multiple preferences
 * await updatePreferences({ viewMode: "grid", sortBy: "name-asc" });
 */
export async function updatePreferences(data: {
  viewMode?: ViewMode;
  sortBy?: SortOption;
}): Promise<ActionResult<void>> {
  const userId = await getAuthUserId();
  if (!userId) {
    return { success: false, error: "Not authenticated" };
  }

  // Validate inputs
  if (
    data.viewMode !== undefined &&
    !VALID_VIEW_MODES.includes(data.viewMode)
  ) {
    return { success: false, error: "Invalid view mode" };
  }

  if (data.sortBy !== undefined && !VALID_SORT_OPTIONS.includes(data.sortBy)) {
    return { success: false, error: "Invalid sort option" };
  }

  try {
    const updateData: Record<string, string> = {};

    if (data.viewMode !== undefined) {
      updateData.defaultViewMode = data.viewMode;
    }
    if (data.sortBy !== undefined) {
      updateData.defaultSortBy = data.sortBy;
    }

    await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    return { success: true };
  } catch (error) {
    logger.error({ err: error }, "Update preferences error");
    return { success: false, error: "Failed to update preferences" };
  }
}
