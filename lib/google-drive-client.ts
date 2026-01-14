/**
 * Google Drive API client with OAuth token management and rate limiting.
 * Handles token refresh, CSRF-protected state, rate limiting via Bottleneck,
 * and exponential backoff retry.
 */

import { google, drive_v3 } from "googleapis";
import Bottleneck from "bottleneck";
import crypto from "crypto";
import { Readable } from "stream";
import { prisma } from "@/lib/prisma";
import { encryptCredential, decryptCredential } from "@/lib/crypto";
import { logger } from "@/lib/logger";
import {
  buildBatchRequest,
  parseBatchResponse,
  BatchOperation,
  getBatchTimeout,
} from "@/lib/google-drive-batch";

// Rate limiter: max 10 concurrent, 100ms between requests (10/sec)
const rateLimiter = new Bottleneck({
  maxConcurrent: 10,
  minTime: 100,
});

// 5MB threshold for resumable uploads
const RESUMABLE_THRESHOLD = 5 * 1024 * 1024;

// Retryable HTTP status codes
const RETRYABLE_CODES = new Set([408, 429, 500, 502, 503, 504]);

/**
 * Gets the HMAC signing key derived from ENCRYPTION_KEY.
 *
 * @returns Uint8Array containing the signing key
 */
function getStateSigningKey(): Uint8Array {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) throw new Error("ENCRYPTION_KEY not configured");
  const buffer = crypto.createHash("sha256").update(key, "utf8").digest();
  return new Uint8Array(buffer);
}

/**
 * Generates a CSRF-protected OAuth state parameter.
 * State is signed with HMAC to prevent tampering.
 *
 * @param userId - The user initiating OAuth
 * @returns Signed state string
 */
export function generateOAuthState(userId: string): string {
  const payload = JSON.stringify({
    userId,
    timestamp: Date.now(),
    nonce: crypto.randomBytes(8).toString("hex"),
  });

  const signature = crypto
    .createHmac("sha256", getStateSigningKey())
    .update(payload, "utf8")
    .digest("hex");

  const state = Buffer.from(`${payload}.${signature}`).toString("base64url");
  return state;
}

/**
 * Verifies and decodes an OAuth state parameter.
 * Returns null if state is invalid, tampered, or expired (>10 min).
 *
 * @param state - The state parameter from OAuth callback
 * @returns Decoded payload or null if invalid
 */
export function verifyOAuthState(
  state: string
): { userId: string; timestamp: number } | null {
  try {
    const decoded = Buffer.from(state, "base64url").toString();
    const lastDot = decoded.lastIndexOf(".");
    if (lastDot === -1) return null;

    const payload = decoded.slice(0, lastDot);
    const signature = decoded.slice(lastDot + 1);

    // Verify signature
    const expectedSignature = crypto
      .createHmac("sha256", getStateSigningKey())
      .update(payload, "utf8")
      .digest("hex");

    if (
      !crypto.timingSafeEqual(
        new Uint8Array(Buffer.from(signature)),
        new Uint8Array(Buffer.from(expectedSignature))
      )
    ) {
      return null;
    }

    const data = JSON.parse(payload);

    // Check expiry (10 minutes)
    const age = Date.now() - data.timestamp;
    if (age > 10 * 60 * 1000) {
      return null;
    }

    return { userId: data.userId, timestamp: data.timestamp };
  } catch {
    return null;
  }
}

/**
 * Wraps an API call with rate limiting and exponential backoff retry.
 *
 * @param fn - The async function to execute
 * @returns The result of the function
 */
export async function withRateLimit<T>(fn: () => Promise<T>): Promise<T> {
  return rateLimiter.schedule(async () => {
    const maxRetries = 3;
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error: unknown) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const errWithCode = error as { code?: number; message?: string };

        const isRateLimited =
          errWithCode.code === 403 &&
          errWithCode.message?.includes("rateLimitExceeded");

        if (isRateLimited && attempt < maxRetries) {
          const baseDelay = Math.pow(2, attempt) * 1000;
          const jitter = Math.random() * baseDelay;
          const delay = baseDelay + jitter;
          logger.warn(
            { attempt: attempt + 1, maxRetries, delayMs: Math.round(delay) },
            "[GoogleDrive] Rate limited, retrying"
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        throw lastError;
      }
    }

    throw lastError ?? new Error("Max retries exceeded");
  });
}

/**
 * Refreshes an expired access token using the refresh token.
 *
 * @param connectionId - The GoogleDriveConnection ID
 * @param encryptedRefreshToken - The encrypted refresh token
 * @returns The new access token
 */
export async function refreshAccessToken(
  connectionId: string,
  encryptedRefreshToken: string
): Promise<string> {
  const refreshToken = decryptCredential(encryptedRefreshToken);

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    logger.error(
      { err: errorData, connectionId },
      "[GoogleDrive] Token refresh failed"
    );

    await prisma.googleDriveConnection.update({
      where: { id: connectionId },
      data: {
        needsReauth: true,
        lastError: "Token refresh failed - please reconnect",
      },
    });
    throw new Error("Token refresh failed - user must reconnect");
  }

  const { access_token, expires_in } = await response.json();

  await prisma.googleDriveConnection.update({
    where: { id: connectionId },
    data: {
      encryptedAccessToken: encryptCredential(access_token),
      accessTokenExpiry: new Date(Date.now() + expires_in * 1000),
      needsReauth: false,
    },
  });

  return access_token;
}

/**
 * Gets an authenticated Google Drive client for a connection.
 *
 * @param connection - The GoogleDriveConnection with tokens
 * @returns An authenticated Drive client
 */
export async function getDriveClient(connection: {
  id: string;
  encryptedRefreshToken: string;
  encryptedAccessToken: string | null;
  accessTokenExpiry: Date | null;
}): Promise<drive_v3.Drive> {
  // Refresh if expired or expiring within 60 seconds
  const needsRefresh =
    !connection.accessTokenExpiry ||
    new Date(connection.accessTokenExpiry) < new Date(Date.now() + 60000);

  let accessToken: string;

  if (needsRefresh) {
    accessToken = await refreshAccessToken(
      connection.id,
      connection.encryptedRefreshToken
    );
  } else {
    accessToken = decryptCredential(connection.encryptedAccessToken!);
  }

  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });

  return google.drive({ version: "v3", auth });
}

/**
 * Gets a Drive client using a raw refresh token.
 * For E2E test use only - bypasses encrypted DB token flow.
 *
 * @param refreshToken - Raw (unencrypted) refresh token
 * @returns An authenticated Drive client
 */
export async function getDriveClientFromRefreshToken(
  refreshToken: string
): Promise<drive_v3.Drive> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to refresh token for E2E test");
  }

  const { access_token } = await response.json();

  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token });

  return google.drive({ version: "v3", auth });
}

/**
 * Generates the OAuth authorization URL for connecting Google Drive.
 * Includes both drive.file and userinfo.email scopes.
 *
 * @param state - CSRF protection state parameter (use generateOAuthState)
 * @returns The authorization URL
 */
export function getAuthorizationUrl(state: string): string {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/google-drive`
  );

  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: [
      // Full Drive access needed to sync files created directly in Drive
      // (drive.file scope only sees files created by our app)
      "https://www.googleapis.com/auth/drive",
      "https://www.googleapis.com/auth/userinfo.email",
    ],
    state,
    prompt: "consent",
  });
}

/**
 * Exchanges an authorization code for tokens.
 *
 * @param code - The authorization code from OAuth callback
 * @returns Access token, refresh token, and expiry
 */
export async function exchangeCodeForTokens(code: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}> {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/google-drive`
  );

  const { tokens } = await oauth2Client.getToken(code);

  if (!tokens.access_token) {
    throw new Error("Failed to get access token from Google");
  }

  // refresh_token may not be present on re-authorization
  // In that case, we'll need to use the existing one
  if (!tokens.refresh_token) {
    throw new Error(
      "No refresh token received - try revoking app access at https://myaccount.google.com/permissions and reconnecting"
    );
  }

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresIn: tokens.expiry_date
      ? Math.floor((tokens.expiry_date - Date.now()) / 1000)
      : 3600,
  };
}

/**
 * Gets the user's email from Google using the userinfo endpoint.
 *
 * @param accessToken - A valid access token
 * @returns The user's email
 */
export async function getUserEmail(accessToken: string): Promise<string> {
  const response = await fetch(
    "https://www.googleapis.com/oauth2/v2/userinfo",
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    throw new Error("Failed to get user info from Google");
  }

  const { email } = await response.json();

  if (!email) {
    throw new Error("No email returned from Google - check OAuth scopes");
  }

  return email;
}

/** Result of creating or finding the root folder. */
export interface RootFolderResult {
  id: string;
  wasExisting: boolean;
}

/**
 * Creates or finds the CanonCore root folder in Google Drive.
 *
 * @param drive - An authenticated Drive client
 * @returns Object with folder ID and whether it was existing
 */
export async function createRootFolder(
  drive: drive_v3.Drive
): Promise<RootFolderResult> {
  // First check if folder already exists
  const existingResponse = await withRateLimit(() =>
    drive.files.list({
      q: "name = 'CanonCore' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
      spaces: "drive",
      fields: "files(id, name)",
    })
  );

  if (existingResponse.data.files && existingResponse.data.files.length > 0) {
    return { id: existingResponse.data.files[0].id!, wasExisting: true };
  }

  // Create new folder
  const response = await withRateLimit(() =>
    drive.files.create({
      requestBody: {
        name: "CanonCore",
        mimeType: "application/vnd.google-apps.folder",
      },
      fields: "id",
    })
  );

  if (!response.data.id) {
    throw new Error("Failed to create CanonCore folder");
  }

  return { id: response.data.id, wasExisting: false };
}

/** Result of checking root folder status. */
export type RootFolderStatus =
  | { exists: true; trashed: boolean }
  | { exists: false };

/**
 * Checks if the root folder exists and whether it's trashed.
 * Used before sync to detect if user moved CanonCore folder to Trash.
 *
 * @param drive - Authenticated Drive client
 * @param folderId - The root folder ID to check
 * @returns Status object indicating existence and trashed state
 */
export async function checkRootFolderStatus(
  drive: drive_v3.Drive,
  folderId: string
): Promise<RootFolderStatus> {
  try {
    const response = await withRateLimit(() =>
      drive.files.get({
        fileId: folderId,
        fields: "id, trashed",
      })
    );
    return { exists: true, trashed: response.data.trashed ?? false };
  } catch (error) {
    // googleapis errors use .code, not .status
    if ((error as { code?: number })?.code === 404) {
      return { exists: false };
    }
    throw error;
  }
}

/**
 * Progress callback for file uploads.
 */
export interface UploadProgress {
  bytesUploaded: number;
  totalBytes: number;
  percentage: number;
}

/**
 * Uploads a file to Google Drive with automatic resumable upload for large files.
 * Uses simple upload for files <5MB, resumable upload with retry for larger files.
 *
 * @param drive - An authenticated Drive client
 * @param filename - The name for the file
 * @param content - File content as Buffer
 * @param mimeType - MIME type of the file
 * @param parentFolderId - Parent folder ID in Drive
 * @param onProgress - Optional progress callback for large files
 * @returns The created file metadata
 */
export async function uploadFile(
  drive: drive_v3.Drive,
  filename: string,
  content: Buffer,
  mimeType: string,
  parentFolderId: string,
  onProgress?: (progress: UploadProgress) => void
): Promise<{ id: string; name: string }> {
  const isLargeFile = content.length >= RESUMABLE_THRESHOLD;

  if (isLargeFile) {
    return uploadLargeFile(
      drive,
      filename,
      content,
      mimeType,
      parentFolderId,
      onProgress
    );
  }

  // Simple upload for small files
  const response = await withRateLimit(() =>
    drive.files.create({
      requestBody: {
        name: filename,
        parents: [parentFolderId],
      },
      media: {
        mimeType,
        body: Readable.from(content),
      },
      fields: "id, name",
    })
  );

  if (!response.data.id) {
    throw new Error("Failed to upload file - no ID returned");
  }

  return { id: response.data.id, name: response.data.name || filename };
}

/**
 * Uploads a large file with resumable upload and exponential backoff retry.
 *
 * @param drive - An authenticated Drive client
 * @param filename - The name for the file
 * @param content - File content as Buffer
 * @param mimeType - MIME type of the file
 * @param parentFolderId - Parent folder ID in Drive
 * @param onProgress - Optional progress callback
 * @returns The created file metadata
 */
async function uploadLargeFile(
  drive: drive_v3.Drive,
  filename: string,
  content: Buffer,
  mimeType: string,
  parentFolderId: string,
  onProgress?: (progress: UploadProgress) => void
): Promise<{ id: string; name: string }> {
  const maxRetries = 3;
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Report initial progress
      onProgress?.({
        bytesUploaded: 0,
        totalBytes: content.length,
        percentage: 0,
      });

      const response = await drive.files.create({
        requestBody: {
          name: filename,
          parents: [parentFolderId],
        },
        media: {
          mimeType,
          body: Readable.from(content),
        },
        fields: "id, name",
      });

      // Report completion
      onProgress?.({
        bytesUploaded: content.length,
        totalBytes: content.length,
        percentage: 100,
      });

      if (!response.data.id) {
        throw new Error("Failed to upload file - no ID returned");
      }

      return { id: response.data.id, name: response.data.name || filename };
    } catch (error: unknown) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const errWithCode = error as { code?: number };

      // Only retry on retryable errors
      if (!RETRYABLE_CODES.has(errWithCode.code ?? 0)) {
        throw lastError;
      }

      if (attempt < maxRetries) {
        const baseDelay = Math.pow(2, attempt) * 1000;
        const jitter = Math.random() * baseDelay;
        const delay = baseDelay + jitter;
        logger.warn(
          {
            code: errWithCode.code,
            attempt: attempt + 1,
            maxRetries,
            delayMs: Math.round(delay),
          },
          "[GoogleDrive] Upload failed, retrying"
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError ?? new Error("Max upload retries exceeded");
}

/**
 * Downloads a file from Google Drive.
 *
 * @param drive - An authenticated Drive client
 * @param fileId - The Drive file ID
 * @returns The file content as a Buffer
 */
export async function downloadFile(
  drive: drive_v3.Drive,
  fileId: string
): Promise<Buffer> {
  const response = await withRateLimit(() =>
    drive.files.get({ fileId, alt: "media" }, { responseType: "arraybuffer" })
  );

  return Buffer.from(response.data as ArrayBuffer);
}

/**
 * Lists files in a folder.
 *
 * @param drive - An authenticated Drive client
 * @param folderId - The folder ID to list
 * @param pageToken - Optional page token for pagination
 * @returns Files and next page token
 */
export async function listFiles(
  drive: drive_v3.Drive,
  folderId: string,
  pageToken?: string
): Promise<{
  files: drive_v3.Schema$File[];
  nextPageToken?: string;
}> {
  const response = await withRateLimit(() =>
    drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields:
        "nextPageToken, files(id, name, mimeType, size, modifiedTime, thumbnailLink)",
      pageSize: 100,
      pageToken,
    })
  );

  return {
    files: response.data.files || [],
    nextPageToken: response.data.nextPageToken || undefined,
  };
}

/**
 * Creates a folder in Google Drive.
 *
 * @param drive - An authenticated Drive client
 * @param name - The folder name
 * @param parentFolderId - Parent folder ID
 * @returns The created folder ID
 */
export async function createFolder(
  drive: drive_v3.Drive,
  name: string,
  parentFolderId: string
): Promise<string> {
  const response = await withRateLimit(() =>
    drive.files.create({
      requestBody: {
        name,
        mimeType: "application/vnd.google-apps.folder",
        parents: [parentFolderId],
      },
      fields: "id",
    })
  );

  if (!response.data.id) {
    throw new Error("Failed to create folder");
  }

  return response.data.id;
}

/**
 * Deletes a file or folder from Google Drive (moves to trash).
 *
 * @param drive - An authenticated Drive client
 * @param fileId - The file/folder ID to delete
 */
export async function deleteFile(
  drive: drive_v3.Drive,
  fileId: string
): Promise<void> {
  await withRateLimit(() =>
    drive.files.update({
      fileId,
      requestBody: { trashed: true },
    })
  );
}

/**
 * Permanently deletes a file or folder from Google Drive.
 * WARNING: This cannot be undone. Use only for E2E test cleanup.
 *
 * @param drive - An authenticated Drive client
 * @param fileId - The file/folder ID to permanently delete
 */
export async function permanentlyDeleteFile(
  drive: drive_v3.Drive,
  fileId: string
): Promise<void> {
  await withRateLimit(() =>
    drive.files.delete({
      fileId,
    })
  );
}

/**
 * Empties the user's Google Drive trash.
 *
 * WARNING: This permanently deletes ALL trashed items in the entire Drive account,
 * not just items created by this application. Use only for E2E test cleanup with
 * a dedicated test account (E2E_GOOGLE_REFRESH_TOKEN).
 *
 * @param drive - An authenticated Drive client
 */
export async function emptyTrash(drive: drive_v3.Drive): Promise<void> {
  await withRateLimit(() => drive.files.emptyTrash({}));
}

/**
 * Renames a file or folder in Google Drive.
 *
 * @param drive - An authenticated Drive client
 * @param fileId - The file/folder ID to rename
 * @param newName - The new name
 */
export async function renameFile(
  drive: drive_v3.Drive,
  fileId: string,
  newName: string
): Promise<void> {
  await withRateLimit(() =>
    drive.files.update({
      fileId,
      requestBody: { name: newName },
    })
  );
}

/**
 * Moves a file or folder to a new parent folder.
 *
 * @param drive - An authenticated Drive client
 * @param fileId - The file/folder ID to move
 * @param newParentId - The new parent folder ID
 * @param oldParentId - The old parent folder ID
 */
export async function moveFile(
  drive: drive_v3.Drive,
  fileId: string,
  newParentId: string,
  oldParentId: string
): Promise<void> {
  await withRateLimit(() =>
    drive.files.update({
      fileId,
      addParents: newParentId,
      removeParents: oldParentId,
    })
  );
}

/**
 * Creates a resumable upload URL for direct browser-to-Drive uploads.
 * Uses Google Drive API's resumable upload protocol with CORS support.
 *
 * CRITICAL: The origin parameter enables CORS for browser uploads.
 * Without it, browser XHR requests to the upload URL will be blocked.
 *
 * @param accessToken - Valid OAuth access token
 * @param fileName - Name for the uploaded file
 * @param mimeType - MIME type of the file
 * @param parentFolderId - Parent folder ID in Drive
 * @param origin - Browser origin for CORS headers (e.g., "https://canoncore.com")
 * @returns Resumable upload URL that accepts PUT requests from the browser
 */
export async function createResumableUploadUrl(
  accessToken: string,
  fileName: string,
  mimeType: string,
  parentFolderId: string,
  origin: string
): Promise<string> {
  const metadata = {
    name: fileName,
    parents: [parentFolderId],
  };

  const response = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": mimeType,
        Origin: origin,
      },
      body: JSON.stringify(metadata),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    logger.error(
      { status: response.status, error: errorText },
      "[GoogleDrive] Failed to create resumable upload URL"
    );
    throw new Error(`Failed to create upload session: ${response.status}`);
  }

  const uploadUrl = response.headers.get("Location");

  if (!uploadUrl) {
    throw new Error("No upload URL returned from Google Drive");
  }

  return uploadUrl;
}

/** Result of a batch delete operation */
export interface BatchDeleteResult {
  succeeded: string[];
  failed: Array<{ fileId: string; error: string }>;
}

/**
 * Deletes multiple files in batch.
 * Automatically chunks into multiple requests if > 100 files.
 *
 * @param accessToken - Valid OAuth access token
 * @param fileIds - Array of file IDs to delete (move to trash)
 * @returns Object with succeeded and failed file IDs
 */
export async function batchDelete(
  accessToken: string,
  fileIds: string[]
): Promise<BatchDeleteResult> {
  const result: BatchDeleteResult = { succeeded: [], failed: [] };

  // Handle empty array - return early
  if (fileIds.length === 0) {
    return result;
  }

  const startTime = Date.now();

  // Chunk into batches of 100
  const chunks: string[][] = [];
  for (let i = 0; i < fileIds.length; i += 100) {
    chunks.push(fileIds.slice(i, i + 100));
  }

  for (const chunk of chunks) {
    const operations: BatchOperation[] = chunk.map((fileId) => ({
      method: "PATCH",
      fileId,
      body: { trashed: true },
    }));

    const { body, boundary } = buildBatchRequest(operations);

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), getBatchTimeout());

    try {
      const response = await fetch(
        "https://www.googleapis.com/batch/drive/v3",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": `multipart/mixed; boundary=${boundary}`,
          },
          body,
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        // Entire batch failed
        for (const fileId of chunk) {
          result.failed.push({
            fileId,
            error: `Batch request failed: ${response.status}`,
          });
        }
        continue;
      }

      // Extract boundary from response Content-Type
      const contentType = response.headers.get("content-type") || "";
      const responseBoundary =
        contentType.match(/boundary=([^\s;]+)/)?.[1] || boundary;

      const responseBody = await response.text();
      const batchResults = parseBatchResponse(
        responseBody,
        responseBoundary,
        chunk
      );

      // Collect results
      for (const batchResult of batchResults) {
        if (batchResult.success) {
          result.succeeded.push(batchResult.fileId);
        } else {
          result.failed.push({
            fileId: batchResult.fileId,
            error: batchResult.error || "Unknown error",
          });
        }
      }
    } catch (error) {
      clearTimeout(timeoutId);

      // Handle abort/timeout
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`Batch delete timeout after ${getBatchTimeout()}ms`);
      }

      // Log and fail all items in this chunk
      logger.error({ err: error, chunk }, "[Batch] Request failed");
      for (const fileId of chunk) {
        result.failed.push({
          fileId,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  }

  // Log performance metrics
  const duration = Date.now() - startTime;
  logger.info(
    {
      duration,
      total: fileIds.length,
      succeeded: result.succeeded.length,
      failed: result.failed.length,
    },
    "[Batch] Delete completed"
  );

  return result;
}

/** Result of a batch move operation */
export interface BatchMoveResult {
  succeeded: string[];
  failed: Array<{ fileId: string; error: string }>;
}

/**
 * Moves multiple files to a new parent folder in batch.
 * All files must currently be in the same parent.
 *
 * @param accessToken - Valid OAuth access token
 * @param fileIds - Array of file IDs to move
 * @param newParentId - Destination folder ID
 * @param oldParentId - Current parent folder ID
 * @returns Object with succeeded and failed file IDs
 */
export async function batchMove(
  accessToken: string,
  fileIds: string[],
  newParentId: string,
  oldParentId: string
): Promise<BatchMoveResult> {
  const result: BatchMoveResult = { succeeded: [], failed: [] };

  // Handle empty array - return early
  if (fileIds.length === 0) {
    return result;
  }

  const startTime = Date.now();

  const chunks: string[][] = [];
  for (let i = 0; i < fileIds.length; i += 100) {
    chunks.push(fileIds.slice(i, i + 100));
  }

  for (const chunk of chunks) {
    const operations: BatchOperation[] = chunk.map((fileId) => ({
      method: "PATCH",
      fileId,
      params: {
        addParents: newParentId,
        removeParents: oldParentId,
      },
    }));

    const { body, boundary } = buildBatchRequest(operations);

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), getBatchTimeout());

    try {
      const response = await fetch(
        "https://www.googleapis.com/batch/drive/v3",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": `multipart/mixed; boundary=${boundary}`,
          },
          body,
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        for (const fileId of chunk) {
          result.failed.push({
            fileId,
            error: `Batch request failed: ${response.status}`,
          });
        }
        continue;
      }

      const contentType = response.headers.get("content-type") || "";
      const responseBoundary =
        contentType.match(/boundary=([^\s;]+)/)?.[1] || boundary;
      const responseBody = await response.text();
      const batchResults = parseBatchResponse(
        responseBody,
        responseBoundary,
        chunk
      );

      for (const batchResult of batchResults) {
        if (batchResult.success) {
          result.succeeded.push(batchResult.fileId);
        } else {
          result.failed.push({
            fileId: batchResult.fileId,
            error: batchResult.error || "Unknown error",
          });
        }
      }
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`Batch move timeout after ${getBatchTimeout()}ms`);
      }

      logger.error({ err: error, chunk }, "[Batch] Move request failed");
      for (const fileId of chunk) {
        result.failed.push({
          fileId,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  }

  // Log performance metrics
  const duration = Date.now() - startTime;
  logger.info(
    {
      duration,
      total: fileIds.length,
      succeeded: result.succeeded.length,
      failed: result.failed.length,
    },
    "[Batch] Move completed"
  );

  return result;
}

/** Input for moving files from different parents */
export interface MoveFromDifferentParent {
  fileId: string;
  oldParentId: string;
}

/**
 * Moves files from different parent folders to a single destination.
 *
 * @param accessToken - Valid OAuth access token
 * @param files - Array of file IDs with their current parent IDs
 * @param newParentId - Destination folder ID
 * @returns Object with succeeded and failed file IDs
 */
export async function batchMoveFromDifferentParents(
  accessToken: string,
  files: MoveFromDifferentParent[],
  newParentId: string
): Promise<BatchMoveResult> {
  const result: BatchMoveResult = { succeeded: [], failed: [] };

  // Handle empty array - return early
  if (files.length === 0) {
    return result;
  }

  const startTime = Date.now();

  const chunks: MoveFromDifferentParent[][] = [];
  for (let i = 0; i < files.length; i += 100) {
    chunks.push(files.slice(i, i + 100));
  }

  for (const chunk of chunks) {
    const operations: BatchOperation[] = chunk.map((file) => ({
      method: "PATCH",
      fileId: file.fileId,
      params: {
        addParents: newParentId,
        removeParents: file.oldParentId,
      },
    }));

    const { body, boundary } = buildBatchRequest(operations);

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), getBatchTimeout());

    try {
      const response = await fetch(
        "https://www.googleapis.com/batch/drive/v3",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": `multipart/mixed; boundary=${boundary}`,
          },
          body,
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        for (const file of chunk) {
          result.failed.push({
            fileId: file.fileId,
            error: `Batch failed: ${response.status}`,
          });
        }
        continue;
      }

      const contentType = response.headers.get("content-type") || "";
      const responseBoundary =
        contentType.match(/boundary=([^\s;]+)/)?.[1] || boundary;
      const responseBody = await response.text();
      const fileIds = chunk.map((f) => f.fileId);
      const batchResults = parseBatchResponse(
        responseBody,
        responseBoundary,
        fileIds
      );

      for (const batchResult of batchResults) {
        if (batchResult.success) {
          result.succeeded.push(batchResult.fileId);
        } else {
          result.failed.push({
            fileId: batchResult.fileId,
            error: batchResult.error || "Unknown error",
          });
        }
      }
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`Batch move timeout after ${getBatchTimeout()}ms`);
      }

      logger.error({ err: error, chunk }, "[Batch] Move request failed");
      for (const file of chunk) {
        result.failed.push({
          fileId: file.fileId,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  }

  // Log performance metrics
  const duration = Date.now() - startTime;
  logger.info(
    {
      duration,
      total: files.length,
      succeeded: result.succeeded.length,
      failed: result.failed.length,
    },
    "[Batch] Move from different parents completed"
  );

  return result;
}
