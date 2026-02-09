/**
 * E2E automatic setup and recovery utilities.
 * Provides idempotent functions that ensure test prerequisites exist,
 * creating or restoring them automatically when missing.
 *
 * Used by global.setup.ts to make E2E tests self-healing.
 */

import { google } from "googleapis";
import * as fs from "fs";
import * as path from "path";
import { hash } from "bcryptjs";
import { FileType, SyncStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { encryptCredential } from "@/lib/crypto";

/** Test folder name (protected from cleanup). */
export const TEST_FOLDER_NAME = "Breaking Bad";

/** Local test video file path. */
const TEST_VIDEO_PATH = "video.mp4";

/** E2E test user credentials. */
export const E2E_USER_EMAIL = "e2e-drive-test@canoncore.test";
/**
 * Hardcoded test password - intentional for E2E test automation.
 * This is NOT a security risk as it's only used for test accounts
 * that are isolated from production data.
 */
export const E2E_USER_PASSWORD = "TestPassword123";

/**
 * Gets a configured Google Drive client using E2E credentials.
 *
 * @returns Configured Drive client
 * @throws Error if credentials are missing
 */
function getDriveClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_E2E_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Missing Google credentials. Run: pnpm run setup:e2e");
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  return google.drive({ version: "v3", auth: oauth2Client });
}

/**
 * Gets the root folder ID from environment.
 *
 * @returns Root folder ID
 * @throws Error if not configured
 */
function getRootFolderId(): string {
  const rootFolderId = process.env.GOOGLE_E2E_ROOT_FOLDER_ID;
  if (!rootFolderId) {
    throw new Error(
      "GOOGLE_E2E_ROOT_FOLDER_ID not set. Run: pnpm run setup:e2e"
    );
  }
  return rootFolderId;
}

/**
 * Restores the root folder from trash if it was trashed.
 *
 * @returns true if folder is usable (exists and not trashed), false if unrecoverable
 */
export async function restoreRootFolderIfTrashed(): Promise<boolean> {
  const drive = getDriveClient();
  const rootFolderId = getRootFolderId();

  try {
    const response = await drive.files.get({
      fileId: rootFolderId,
      fields: "id,name,trashed",
    });

    if (response.data.trashed) {
      console.log("[E2E Setup] Root folder is trashed, restoring...");
      await drive.files.update({
        fileId: rootFolderId,
        requestBody: { trashed: false },
      });
      console.log("[E2E Setup] Root folder restored from trash");
    }

    return true;
  } catch (err: unknown) {
    const error = err as { code?: number };
    if (error.code === 404) {
      console.error("[E2E Setup] Root folder not found (permanently deleted)");
      return false;
    }
    throw err;
  }
}

/**
 * Ensures the "Breaking Bad" test folder exists in Drive.
 * Creates it if missing.
 *
 * @returns Folder ID
 */
export async function ensureTestFolderExists(): Promise<string> {
  const drive = getDriveClient();
  const rootFolderId = getRootFolderId();

  // Check if folder exists
  const response = await drive.files.list({
    q: `'${rootFolderId}' in parents and name = '${TEST_FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: "files(id,name)",
  });

  if (response.data.files && response.data.files.length > 0) {
    const folderId = response.data.files[0].id!;
    console.log(`[E2E Setup] Found "${TEST_FOLDER_NAME}" folder`);
    return folderId;
  }

  // Create folder
  console.log(`[E2E Setup] Creating "${TEST_FOLDER_NAME}" folder...`);
  const createResponse = await drive.files.create({
    requestBody: {
      name: TEST_FOLDER_NAME,
      mimeType: "application/vnd.google-apps.folder",
      parents: [rootFolderId],
    },
    fields: "id",
  });

  const folderId = createResponse.data.id!;
  console.log(`[E2E Setup] Created "${TEST_FOLDER_NAME}" folder`);
  return folderId;
}

/**
 * Result of video file check.
 */
export interface VideoFileResult {
  exists: boolean;
  fileId?: string;
  fileName?: string;
  reason?: string;
}

/**
 * Ensures a video file exists in the test folder.
 * Uploads from local file if missing from Drive.
 *
 * @param testFolderId - ID of the test folder
 * @returns Result indicating if video exists and file info
 */
export async function ensureVideoFileExists(
  testFolderId: string
): Promise<VideoFileResult> {
  const drive = getDriveClient();

  // Check if video exists in Drive
  const response = await drive.files.list({
    q: `'${testFolderId}' in parents and mimeType contains 'video' and trashed = false`,
    fields: "files(id,name)",
  });

  if (response.data.files && response.data.files.length > 0) {
    const file = response.data.files[0];
    console.log(`[E2E Setup] Found video: ${file.name}`);
    return { exists: true, fileId: file.id!, fileName: file.name! };
  }

  // Check if local video file exists
  const videoPath = path.join(process.cwd(), TEST_VIDEO_PATH);
  if (!fs.existsSync(videoPath)) {
    return {
      exists: false,
      reason: `No video in Drive and local file not found: ${TEST_VIDEO_PATH}`,
    };
  }

  // Upload video
  console.log(`[E2E Setup] Uploading ${TEST_VIDEO_PATH}...`);
  const stats = fs.statSync(videoPath);
  const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
  console.log(`[E2E Setup] File size: ${sizeMB} MB (this may take a moment)`);

  const uploadResponse = await drive.files.create({
    requestBody: {
      name: path.basename(videoPath),
      parents: [testFolderId],
    },
    media: {
      mimeType: "video/mp4",
      body: fs.createReadStream(videoPath),
    },
    fields: "id,name",
  });

  console.log(`[E2E Setup] Uploaded video: ${uploadResponse.data.name}`);
  return {
    exists: true,
    fileId: uploadResponse.data.id!,
    fileName: uploadResponse.data.name!,
  };
}

/**
 * Ensures the E2E test user exists in the database.
 *
 * @returns User ID
 */
export async function ensureE2EUserExists(): Promise<string> {
  // Check if user exists
  const existingUser = await prisma.user.findUnique({
    where: { email: E2E_USER_EMAIL },
  });

  if (existingUser) {
    console.log(`[E2E Setup] Found E2E user: ${E2E_USER_EMAIL}`);
    return existingUser.id;
  }

  // Create user
  console.log(`[E2E Setup] Creating E2E user: ${E2E_USER_EMAIL}`);
  const passwordHash = await hash(E2E_USER_PASSWORD, 10);
  const user = await prisma.user.create({
    data: {
      email: E2E_USER_EMAIL,
      passwordHash,
    },
  });

  console.log(`[E2E Setup] Created E2E user`);
  return user.id;
}

/**
 * Ensures the Google Drive connection exists for the E2E user.
 *
 * @param userId - E2E user ID
 * @returns Connection ID
 */
export async function ensureDriveConnectionExists(
  userId: string
): Promise<string> {
  const refreshToken = process.env.GOOGLE_E2E_REFRESH_TOKEN!;
  const rootFolderId = getRootFolderId();

  // Check if connection exists
  const existingConnection = await prisma.googleDriveConnection.findUnique({
    where: { userId },
  });

  if (existingConnection) {
    console.log("[E2E Setup] Found Drive connection");
    return existingConnection.id;
  }

  // Create connection
  console.log("[E2E Setup] Creating Drive connection...");
  const encryptedAccessToken = encryptCredential("placeholder-will-refresh");
  const encryptedRefreshToken = encryptCredential(refreshToken);

  const connection = await prisma.googleDriveConnection.create({
    data: {
      userId,
      name: "E2E Test Drive",
      encryptedAccessToken,
      encryptedRefreshToken,
      accessTokenExpiry: new Date(Date.now() - 1000), // Expired, will refresh
      rootFolderId,
      email: process.env.GOOGLE_E2E_EMAIL || "e2e@test.com",
    },
  });

  console.log("[E2E Setup] Created Drive connection");
  return connection.id;
}

/**
 * Ensures the Item record exists for the test folder.
 *
 * @param userId - E2E user ID
 * @param driveFileId - Drive folder ID
 * @returns Item ID
 */
export async function ensureItemRecordExists(
  userId: string,
  driveFileId: string
): Promise<string> {
  // Check if item exists
  const existingItem = await prisma.item.findFirst({
    where: {
      userId,
      driveFileId,
    },
  });

  if (existingItem) {
    console.log(`[E2E Setup] Found Item record: ${existingItem.name}`);
    return existingItem.id;
  }

  // Create item
  console.log(`[E2E Setup] Creating Item record: ${TEST_FOLDER_NAME}`);
  const item = await prisma.item.create({
    data: {
      name: TEST_FOLDER_NAME,
      userId,
      depth: 0,
      order: 0,
      driveFileId,
      syncStatus: SyncStatus.SYNCED,
      driveModifiedAt: new Date(),
    },
  });

  console.log(`[E2E Setup] Created Item record`);
  return item.id;
}

/**
 * Ensures the ItemFile record exists for the video.
 *
 * @param itemId - Parent item ID
 * @param driveFileId - Drive file ID
 * @param filename - Video filename
 * @returns ItemFile ID
 */
export async function ensureItemFileRecordExists(
  itemId: string,
  driveFileId: string,
  filename: string
): Promise<string> {
  // Check if ItemFile exists
  const existingFile = await prisma.itemFile.findFirst({
    where: {
      itemId,
      driveFileId,
    },
  });

  if (existingFile) {
    console.log(`[E2E Setup] Found ItemFile record: ${existingFile.filename}`);
    return existingFile.id;
  }

  // Create ItemFile
  console.log(`[E2E Setup] Creating ItemFile record: ${filename}`);
  const itemFile = await prisma.itemFile.create({
    data: {
      itemId,
      filename,
      driveFileId,
      fileType: FileType.MEDIA,
      mimeType: "video/mp4",
      isPrimary: true,
    },
  });

  console.log(`[E2E Setup] Created ItemFile record`);
  return itemFile.id;
}

/**
 * Result of the full automatic setup.
 */
export interface AutoSetupResult {
  success: boolean;
  userId?: string;
  testFolderId?: string;
  videoFileId?: string;
  error?: string;
}

/**
 * Runs the full automatic E2E setup.
 * Ensures all prerequisites exist, creating or restoring them as needed.
 *
 * Uses Promise.all to parallelize independent operations for ~2x speedup:
 * - Drive operations (folder/video) run in parallel with DB operations (user)
 * - Dependent operations wait for their prerequisites
 *
 * @returns Setup result with IDs of created/found resources
 *
 * @example
 * ```typescript
 * const result = await runAutomaticSetup();
 * if (!result.success) {
 *   throw new Error(result.error);
 * }
 * console.log(`User: ${result.userId}, Folder: ${result.testFolderId}`);
 * ```
 */
export async function runAutomaticSetup(): Promise<AutoSetupResult> {
  try {
    // Step 1: Restore root folder if trashed (must complete first)
    const rootFolderOk = await restoreRootFolderIfTrashed();
    if (!rootFolderOk) {
      return {
        success: false,
        error: "Root folder permanently deleted. Run: pnpm run setup:e2e",
      };
    }

    // Steps 2-4: Run Drive setup and DB user creation in parallel
    // - Drive path: folder -> video (sequential, video needs folder ID)
    // - DB path: user (independent)
    const [driveSetupResult, userId] = await Promise.all([
      // Drive setup chain
      (async () => {
        const testFolderId = await ensureTestFolderExists();
        const videoResult = await ensureVideoFileExists(testFolderId);
        return { testFolderId, videoResult };
      })(),
      // DB user (independent)
      ensureE2EUserExists(),
    ]);

    const { testFolderId, videoResult } = driveSetupResult;

    // Early return if video missing
    if (!videoResult.exists) {
      return {
        success: false,
        error: videoResult.reason || "Video file not found",
      };
    }

    // Steps 5-7: Create DB records (sequential, each depends on previous)
    await ensureDriveConnectionExists(userId);
    const itemId = await ensureItemRecordExists(userId, testFolderId);
    await ensureItemFileRecordExists(
      itemId,
      videoResult.fileId!,
      videoResult.fileName!
    );

    return {
      success: true,
      userId,
      testFolderId,
      videoFileId: videoResult.fileId,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: message,
    };
  }
}
