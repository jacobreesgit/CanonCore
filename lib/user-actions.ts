/**
 * Server actions for user profile management.
 * Handles profile updates, password changes, and image uploads.
 * Includes validation, security logging, and rate limiting.
 */

"use server";

import { compare, hash } from "bcryptjs";
import { headers } from "next/headers";
import sharp from "sharp";
import { z } from "zod";
import { fileTypeFromBuffer } from "file-type";

import { after } from "next/server";

import { auth } from "@/lib/auth";
import { extractDominantColour } from "@/lib/colour-extract";
import { getDriveClient, withRateLimit } from "@/lib/google-drive-client";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  emailSchema,
  passwordSchema,
  usernameSchema,
  deleteAccountSchema,
} from "@/lib/validations";
import { logger } from "@/lib/logger";

/** Standardised bcrypt cost factor for all password hashing. */
const BCRYPT_ROUNDS = 12;

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
  bio?: string;
}): Promise<ActionResult<{ pendingEmail?: string }>> {
  // Run auth and rate limit in parallel (async-parallel pattern)
  const [userId, rateLimitResult] = await Promise.all([
    getAuthUserId(),
    checkRateLimit("profileUpdate"),
  ]);

  if (!userId) {
    return { success: false, error: "Not authenticated" };
  }

  if (rateLimitResult) {
    await logSecurityEvent("PROFILE_UPDATE_RATE_LIMITED", { userId });
    return { success: false, ...rateLimitResult };
  }

  try {
    // Validate name if provided
    if (data.name !== undefined) {
      const nameSchema = z.string().max(100).optional();
      const nameValidation = nameSchema.safeParse(data.name);
      if (!nameValidation.success) {
        return {
          success: false,
          error: nameValidation.error.issues[0].message,
        };
      }
    }

    // Validate bio if provided
    if (data.bio !== undefined) {
      const { bioSchema } = await import("@/lib/validations");
      const bioValidation = bioSchema.safeParse(data.bio);
      if (!bioValidation.success) {
        return {
          success: false,
          error: bioValidation.error.issues[0].message,
        };
      }
    }

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

        // Don't update email directly — send verification to new address
        const { randomBytes } = await import("crypto");
        const { sendVerificationEmail } = await import("@/lib/email");
        const verificationToken = randomBytes(32).toString("hex");
        const expires = new Date(Date.now() + 30 * 60 * 1000);

        // Delete existing verification tokens
        await prisma.emailVerificationToken.deleteMany({
          where: { userId },
        });

        await prisma.emailVerificationToken.create({
          data: {
            token: verificationToken,
            userId,
            email: data.email,
            expires,
          },
        });

        await sendVerificationEmail(data.email, verificationToken);

        await logSecurityEvent("EMAIL_CHANGE_REQUESTED", {
          userId,
          oldEmail: user.email,
          newEmail: data.email,
        });

        // Return success with pendingEmail info so the UI can show feedback
        return {
          success: true,
          data: { pendingEmail: data.email },
        };
      }
    }

    // Fetch current values for change detection before updating
    const currentUser =
      data.username !== undefined || data.isPublic !== undefined
        ? await prisma.user.findUnique({
            where: { id: userId },
            select: { username: true, isPublic: true },
          })
        : null;

    // Update profile (email changes go through verification flow above)
    await prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.username !== undefined && { username: data.username }),
        ...(data.isPublic !== undefined && { isPublic: data.isPublic }),
        ...(data.bio !== undefined && { bio: data.bio }),
      },
    });

    // Log security events for username and visibility changes
    if (
      data.username !== undefined &&
      currentUser &&
      data.username !== currentUser.username
    ) {
      await logSecurityEvent("USERNAME_CHANGE", {
        userId,
        oldUsername: currentUser.username,
        newUsername: data.username,
      });
    }

    if (
      data.isPublic !== undefined &&
      currentUser &&
      data.isPublic !== currentUser.isPublic
    ) {
      await logSecurityEvent("PROFILE_VISIBILITY_CHANGE", {
        userId,
        isPublic: data.isPublic,
      });
    }

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
  // Run auth and rate limit in parallel (async-parallel pattern)
  const [userId, rateLimitResult] = await Promise.all([
    getAuthUserId(),
    checkRateLimit("passwordChange"),
  ]);

  if (!userId) {
    return { success: false, error: "Not authenticated" };
  }

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
    const newPasswordHash = await hash(data.newPassword, BCRYPT_ROUNDS);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash, tokenVersion: { increment: 1 } },
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
  // Run auth and rate limit in parallel (async-parallel pattern)
  const [userId, rateLimitResult] = await Promise.all([
    getAuthUserId(),
    checkRateLimit("imageUpload"),
  ]);

  if (!userId) {
    return { success: false, error: "Not authenticated" };
  }

  if (rateLimitResult) {
    await logSecurityEvent("IMAGE_UPLOAD_RATE_LIMITED", {
      userId,
      type: "profile",
    });
    return { success: false, ...rateLimitResult };
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
  // Run auth and rate limit in parallel (async-parallel pattern)
  const [userId, rateLimitResult] = await Promise.all([
    getAuthUserId(),
    checkRateLimit("imageUpload"),
  ]);

  if (!userId) {
    return { success: false, error: "Not authenticated" };
  }

  if (rateLimitResult) {
    await logSecurityEvent("IMAGE_UPLOAD_RATE_LIMITED", {
      userId,
      type: "hero",
    });
    return { success: false, ...rateLimitResult };
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

    // Extract dominant colour — non-blocking, failure must not prevent upload
    let dominantColour: string | null = null;
    try {
      dominantColour = await extractDominantColour(
        Buffer.from(processedBuffer)
      );
    } catch {
      // Non-blocking: colour extraction failure shouldn't prevent upload
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        heroImage: processedBuffer as Uint8Array<ArrayBuffer>,
        heroImageMime: mimeType,
        dominantColour,
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
        dominantColour: null,
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
    id: string;
    name: string | null;
    email: string;
    username: string | null;
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
        id: true,
        name: true,
        email: true,
        username: true,
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
        id: user.id,
        name: user.name,
        email: user.email,
        username: user.username,
        hasImage: user.image !== null,
        hasHeroImage: user.heroImage !== null,
      },
    };
  } catch (error) {
    logger.error({ err: error }, "Get profile error");
    return { success: false, error: "Failed to get profile" };
  }
}

/**
 * Permanently deletes the authenticated user's account and all associated data.
 * Requires password verification and typing "DELETE" to confirm.
 * Attempts to trash Google Drive folder if connected (best-effort).
 * Prisma cascades handle: Items, ItemFiles, Playlists, PlaylistItems, Forks, SyncLogs, PasswordResets, GoogleDriveConnection.
 *
 * @param password - Current password for verification
 * @param confirmText - Must be exactly "DELETE"
 * @returns Success or error result
 */
export async function deleteAccount(
  password: string,
  confirmText: string
): Promise<ActionResult> {
  const [userId, rateLimitResult] = await Promise.all([
    getAuthUserId(),
    checkRateLimit("accountDeletion"),
  ]);

  if (!userId) {
    return { success: false, error: "Not authenticated" };
  }

  if (rateLimitResult) {
    await logSecurityEvent("ACCOUNT_DELETION_RATE_LIMITED", { userId });
    return { success: false, ...rateLimitResult };
  }

  // Validate input
  const parsed = deleteAccountSchema.safeParse({ password, confirmText });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  // Fetch user with password hash and Drive connection
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      passwordHash: true,
      googleDriveConnection: {
        select: {
          id: true,
          rootFolderId: true,
          encryptedRefreshToken: true,
          encryptedAccessToken: true,
          accessTokenExpiry: true,
        },
      },
    },
  });

  if (!user) {
    return { success: false, error: "User not found" };
  }

  // Verify password
  const passwordValid = await compare(password, user.passwordHash);
  if (!passwordValid) {
    await logSecurityEvent("ACCOUNT_DELETION_WRONG_PASSWORD", { userId });
    return { success: false, error: "Incorrect password" };
  }

  await logSecurityEvent("ACCOUNT_DELETION_CONFIRMED", { userId });

  // Best-effort: trash Drive folder if connected
  if (user.googleDriveConnection) {
    try {
      const drive = await getDriveClient(user.googleDriveConnection);
      await withRateLimit(() =>
        drive.files.update({
          fileId: user.googleDriveConnection!.rootFolderId,
          requestBody: { trashed: true },
        })
      );
    } catch (err) {
      logger.warn(
        { err, userId },
        "[deleteAccount] Failed to trash Drive folder, proceeding with deletion"
      );
    }
  }

  // Delete user — Prisma cascades handle all related records
  try {
    await prisma.user.delete({ where: { id: userId } });
  } catch (error) {
    logger.error({ error, userId }, "[deleteAccount] Failed to delete user");
    return { success: false, error: "Failed to delete account" };
  }

  // Log completion after response (non-blocking)
  after(() => {
    logSecurityEvent("ACCOUNT_DELETION_COMPLETED", { userId });
  });

  return { success: true };
}

/** Shape of the exported account data. */
export interface AccountExportData {
  exportedAt: string;
  user: {
    name: string | null;
    email: string;
    username: string | null;
    isPublic: boolean;
    createdAt: string;
  };
  items: AccountExportItem[];
  playlists: AccountExportPlaylist[];
  forks: AccountExportFork[];
}

interface AccountExportItem {
  name: string;
  description: string | null;
  isPublic: boolean;
  inheritVisibility: boolean;
  tmdbId: number | null;
  tmdbType: string | null;
  tmdbPosterPath: string | null;
  tmdbBackdropPath: string | null;
  createdAt: string;
  files: {
    filename: string;
    mimeType: string | null;
    size: number | null;
    fileType: string;
    isPrimary: boolean;
    isHero: boolean;
  }[];
}

interface AccountExportPlaylist {
  name: string;
  description: string | null;
  isPublic: boolean;
  createdAt: string;
  items: {
    itemName: string;
    addedAt: string;
    order: number;
  }[];
}

interface AccountExportFork {
  sourceItemName: string;
  targetItemName: string;
  createdAt: string;
}

/**
 * Exports all account data as a JSON object for download.
 * Includes user profile, items (with files metadata and TMDB fields),
 * playlists (with item memberships), and fork records.
 * Excludes binary data (artwork, uploaded files).
 *
 * @returns JSON export data or error
 */
export async function exportAccountData(): Promise<
  ActionResult<AccountExportData>
> {
  const [userId, rateLimitResult] = await Promise.all([
    getAuthUserId(),
    checkRateLimit("dataExport"),
  ]);

  if (!userId) {
    return { success: false, error: "Not authenticated" };
  }

  if (rateLimitResult) {
    return { success: false, ...rateLimitResult };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      email: true,
      username: true,
      isPublic: true,
      createdAt: true,
      items: {
        select: {
          id: true,
          name: true,
          description: true,
          isPublic: true,
          inheritVisibility: true,
          tmdbId: true,
          tmdbType: true,
          tmdbPosterPath: true,
          tmdbBackdropPath: true,
          createdAt: true,
          files: {
            select: {
              filename: true,
              mimeType: true,
              size: true,
              fileType: true,
              isPrimary: true,
              isHero: true,
            },
          },
        },
      },
      playlists: {
        select: {
          name: true,
          description: true,
          isPublic: true,
          createdAt: true,
          playlistItems: {
            select: {
              order: true,
              addedAt: true,
              item: { select: { name: true } },
            },
            orderBy: { order: "asc" },
          },
        },
      },
      forks: {
        select: {
          sourceItem: { select: { name: true } },
          targetItem: { select: { name: true } },
          createdAt: true,
        },
      },
    },
  });

  if (!user) {
    return { success: false, error: "User not found" };
  }

  const exportData: AccountExportData = {
    exportedAt: new Date().toISOString(),
    user: {
      name: user.name,
      email: user.email,
      username: user.username,
      isPublic: user.isPublic,
      createdAt: user.createdAt.toISOString(),
    },
    items: user.items.map((item) => ({
      name: item.name,
      description: item.description,
      isPublic: item.isPublic,
      inheritVisibility: item.inheritVisibility,
      tmdbId: item.tmdbId,
      tmdbType: item.tmdbType,
      tmdbPosterPath: item.tmdbPosterPath,
      tmdbBackdropPath: item.tmdbBackdropPath,
      createdAt: item.createdAt.toISOString(),
      files: item.files.map((f) => ({
        filename: f.filename,
        mimeType: f.mimeType,
        size: f.size ? Number(f.size) : null,
        fileType: f.fileType,
        isPrimary: f.isPrimary,
        isHero: f.isHero,
      })),
    })),
    playlists: user.playlists.map((pl) => ({
      name: pl.name,
      description: pl.description,
      isPublic: pl.isPublic,
      createdAt: pl.createdAt.toISOString(),
      items: pl.playlistItems.map((pi) => ({
        itemName: pi.item.name,
        addedAt: pi.addedAt.toISOString(),
        order: pi.order,
      })),
    })),
    forks: user.forks.map((f) => ({
      sourceItemName: f.sourceItem.name,
      targetItemName: f.targetItem.name,
      createdAt: f.createdAt.toISOString(),
    })),
  };

  return { success: true, data: exportData };
}
