/**
 * Google Drive upload operations.
 * Handles browser-to-Drive uploads with resumable protocol.
 */

"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import {
  getDriveClient,
  createResumableUploadUrl,
  uploadFile,
} from "@/lib/google-drive-client";
import { decryptCredential } from "@/lib/crypto";
import { FileType, SyncStatus } from "@prisma/client";
import { logger } from "@/lib/logger";
import { categorizeFileType } from "@/lib/file-type-utils";
import crypto from "crypto";

/** Upload session token payload for JWT-like signing. */
interface UploadSessionPayload {
  itemId: string;
  userId: string;
  fileName: string;
  mimeType: string;
  parentDriveId: string;
  fileType: FileType;
  exp: number; // Expiry timestamp (ms)
}

/** Input for creating upload sessions. */
export interface UploadFileInput {
  name: string;
  mimeType: string;
}

/** Single upload session response. */
export interface UploadSession {
  fileName: string;
  uploadUrl: string;
  sessionToken: string;
}

/**
 * Gets the signing key for upload session tokens.
 * Derives from AUTH_SECRET for consistency with NextAuth.
 */
function getUploadSigningKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET not configured");
  const buffer = crypto.createHash("sha256").update(secret, "utf8").digest();
  return new Uint8Array(buffer);
}

/**
 * Creates a signed upload session token.
 * Uses HMAC-SHA256 for tamper-proof tokens.
 *
 * @param payload - Session data to encode
 * @returns Base64url-encoded signed token
 */
function signUploadSessionToken(payload: UploadSessionPayload): string {
  const data = JSON.stringify(payload);
  const signature = crypto
    .createHmac("sha256", getUploadSigningKey())
    .update(data, "utf8")
    .digest("hex");

  return Buffer.from(`${data}.${signature}`).toString("base64url");
}

/**
 * Verifies and decodes an upload session token.
 * Returns null if token is invalid, tampered, or expired.
 *
 * @param token - The signed token to verify
 * @returns Decoded payload or null if invalid
 */
function verifyUploadSessionToken(token: string): UploadSessionPayload | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString();
    const lastDot = decoded.lastIndexOf(".");
    if (lastDot === -1) return null;

    const data = decoded.slice(0, lastDot);
    const signature = decoded.slice(lastDot + 1);

    // Verify signature
    const expectedSignature = crypto
      .createHmac("sha256", getUploadSigningKey())
      .update(data, "utf8")
      .digest("hex");

    if (
      !crypto.timingSafeEqual(
        new Uint8Array(Buffer.from(signature)),
        new Uint8Array(Buffer.from(expectedSignature))
      )
    ) {
      return null;
    }

    const payload = JSON.parse(data) as UploadSessionPayload;

    // Check expiry
    if (Date.now() > payload.exp) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Sanitizes a filename to prevent path traversal attacks.
 *
 * @param filename - The filename to sanitize
 * @returns Sanitized filename
 */
function sanitizeFileName(filename: string): string {
  // Remove path components and dangerous characters
  return filename.replace(/\.\./g, "").replace(/[/\\]/g, "").trim();
}

/**
 * Creates upload sessions for multiple files.
 * Returns resumable upload URLs from Google Drive with CORS enabled.
 *
 * IMPORTANT: Origin is required for CORS - Google Drive resumable uploads
 * only allow browser requests from the origin specified at session creation.
 *
 * @param itemId - The item to attach files to
 * @param files - Array of file metadata (name, mimeType)
 * @param origin - Client origin for CORS (e.g., "https://canoncore.com")
 * @returns Upload sessions with URLs and signed tokens
 */
export async function createUploadSessions(
  itemId: string,
  files: UploadFileInput[],
  origin: string
): Promise<{
  success: boolean;
  sessions?: UploadSession[];
  error?: string;
}> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Not authenticated" };
    }

    // Validate input
    if (!files.length) {
      return { success: false, error: "No files provided" };
    }

    if (files.length > 10) {
      return { success: false, error: "Maximum 10 files per batch" };
    }

    // Get connection and item
    const [connection, item] = await Promise.all([
      prisma.googleDriveConnection.findUnique({
        where: { userId: session.user.id },
      }),
      prisma.item.findFirst({
        where: { id: itemId, userId: session.user.id },
        select: { id: true, driveFileId: true },
      }),
    ]);

    if (!connection) {
      return { success: false, error: "No Google Drive connected" };
    }

    if (connection.needsReauth) {
      return { success: false, error: "Please reconnect your Google Drive" };
    }

    // Pre-upload quota check
    const QUOTA_CRITICAL_THRESHOLD = 0.95;
    if (
      connection.quotaBytesUsed !== null &&
      connection.quotaBytesTotal !== null &&
      connection.quotaBytesTotal > BigInt(0)
    ) {
      const usageRatio =
        Number(connection.quotaBytesUsed) / Number(connection.quotaBytesTotal);
      if (usageRatio >= QUOTA_CRITICAL_THRESHOLD) {
        return {
          success: false,
          error:
            "Google Drive storage is almost full. Free up space or upgrade your plan before uploading.",
        };
      }
    }

    if (!item) {
      return { success: false, error: "Item not found" };
    }

    // Determine parent folder in Drive
    const parentDriveId = item.driveFileId || connection.rootFolderId;
    if (!parentDriveId) {
      return { success: false, error: "No Drive folder for this item" };
    }

    // Get access token (refresh if needed)
    let accessToken: string;
    const needsRefresh =
      !connection.accessTokenExpiry ||
      new Date(connection.accessTokenExpiry) < new Date(Date.now() + 60000);

    if (needsRefresh) {
      const { refreshAccessToken } = await import("@/lib/google-drive-client");
      accessToken = await refreshAccessToken(
        connection.id,
        connection.encryptedRefreshToken
      );
    } else {
      accessToken = decryptCredential(connection.encryptedAccessToken!);
    }

    // Create upload sessions for each file
    const sessions: UploadSession[] = [];
    const expiry = Date.now() + 60 * 60 * 1000; // 1 hour

    for (const file of files) {
      const sanitizedName = sanitizeFileName(file.name);
      if (!sanitizedName) {
        return { success: false, error: `Invalid filename: ${file.name}` };
      }

      const fileType = categorizeFileType(file.mimeType, sanitizedName);

      // Create resumable upload URL with CORS support
      const uploadUrl = await createResumableUploadUrl(
        accessToken,
        sanitizedName,
        file.mimeType,
        parentDriveId,
        origin
      );

      // Create signed session token
      const payload: UploadSessionPayload = {
        itemId,
        userId: session.user.id,
        fileName: sanitizedName,
        mimeType: file.mimeType,
        parentDriveId,
        fileType,
        exp: expiry,
      };

      const sessionToken = signUploadSessionToken(payload);

      sessions.push({
        fileName: sanitizedName,
        uploadUrl,
        sessionToken,
      });
    }

    return { success: true, sessions };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to create upload session";
    logger.error({ err: error }, "[GoogleDrive] Create upload sessions error");
    return { success: false, error: message };
  }
}

/**
 * Confirms upload completed and creates ItemFile record.
 * Validates JWT signature and creates database record.
 *
 * @param sessionToken - JWT from createUploadSessions
 * @param driveFileId - The Google Drive file ID returned after upload
 * @returns Created ItemFile info
 */
export async function confirmUpload(
  sessionToken: string,
  driveFileId: string
): Promise<{
  success: boolean;
  itemFile?: { id: string; filename: string; fileType: string };
  error?: string;
}> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Not authenticated" };
    }

    // Verify and decode token
    const payload = verifyUploadSessionToken(sessionToken);
    if (!payload) {
      return { success: false, error: "Invalid or expired session token" };
    }

    // Verify user matches
    if (payload.userId !== session.user.id) {
      logger.warn(
        { tokenUserId: payload.userId, sessionUserId: session.user.id },
        "[GoogleDrive] User mismatch in upload confirmation"
      );
      return { success: false, error: "Unauthorized" };
    }

    // Check if this driveFileId was already used (prevent replay)
    const existingFile = await prisma.itemFile.findFirst({
      where: { driveFileId },
    });

    if (existingFile) {
      return { success: false, error: "File already registered" };
    }

    // Verify item still exists and belongs to user
    const item = await prisma.item.findFirst({
      where: { id: payload.itemId, userId: session.user.id },
    });

    if (!item) {
      return { success: false, error: "Item not found" };
    }

    // Check if there's already a primary file of this type
    // If not, make this file primary (only for CanonCore uploads, not Drive sync)
    const existingPrimary = await prisma.itemFile.findFirst({
      where: {
        itemId: payload.itemId,
        fileType: payload.fileType,
        isPrimary: true,
      },
    });

    // Create ItemFile record
    const itemFile = await prisma.itemFile.create({
      data: {
        itemId: payload.itemId,
        filename: payload.fileName,
        driveFileId,
        fileType: payload.fileType,
        mimeType: payload.mimeType,
        syncStatus: SyncStatus.SYNCED,
        isPrimary: !existingPrimary, // Auto-set primary if first of this type
      },
    });

    revalidatePath("/u", "layout");

    return {
      success: true,
      itemFile: {
        id: itemFile.id,
        filename: itemFile.filename,
        fileType: itemFile.fileType,
      },
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to confirm upload";
    logger.error({ err: error }, "[GoogleDrive] Confirm upload error");
    return { success: false, error: message };
  }
}

/**
 * Uploads a buffer directly to Google Drive for a given item.
 * Used for server-side uploads (e.g., TMDB poster downloads).
 *
 * @param itemId - The item to attach the file to
 * @param buffer - File content as Buffer
 * @param filename - Name for the file
 * @param mimeType - MIME type of the file
 * @returns Upload result with driveFileId
 */
export async function uploadBuffer(
  itemId: string,
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<{
  success: boolean;
  data?: { driveFileId: string };
  error?: string;
}> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Not authenticated" };
    }

    // Get item and verify ownership
    const item = await prisma.item.findFirst({
      where: { id: itemId, userId: session.user.id },
      select: { id: true, driveFileId: true, driveConnectionId: true },
    });

    if (!item) {
      return { success: false, error: "Item not found" };
    }

    if (!item.driveConnectionId) {
      return { success: false, error: "Item has no Drive connection" };
    }

    // Get connection
    const connection = await prisma.googleDriveConnection.findUnique({
      where: { id: item.driveConnectionId },
    });

    if (!connection) {
      return { success: false, error: "No Google Drive connected" };
    }

    if (connection.needsReauth) {
      return { success: false, error: "Please reconnect your Google Drive" };
    }

    // Determine parent folder
    const parentDriveId = item.driveFileId || connection.rootFolderId;
    if (!parentDriveId) {
      return { success: false, error: "No Drive folder for this item" };
    }

    // Get Drive client and upload
    const drive = await getDriveClient(connection);
    const result = await uploadFile(
      drive,
      filename,
      buffer,
      mimeType,
      parentDriveId
    );

    logger.info(
      { itemId, filename, driveFileId: result.id },
      "[GoogleDrive] Buffer uploaded successfully"
    );

    return { success: true, data: { driveFileId: result.id } };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to upload buffer";
    logger.error(
      { err: error, itemId, filename },
      "[GoogleDrive] Buffer upload error"
    );
    return { success: false, error: message };
  }
}
