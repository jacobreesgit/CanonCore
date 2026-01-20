/**
 * Global setup for E2E tests.
 * Cleans Google Drive and sets up test folder structure before all tests.
 */

import { test as setup } from "@playwright/test";
import { google } from "googleapis";
import {
  getDriveClientFromRefreshToken,
  batchDelete,
  emptyTrash,
} from "@/lib/google-drive-client";

const TEST_FOLDER_NAME = "Breaking Bad";
// Protected folders are not deleted during cleanup (baseline test data)
const PROTECTED_FOLDERS = [TEST_FOLDER_NAME];

/**
 * Gets an access token from a refresh token for batch API operations.
 *
 * @param refreshToken - Google OAuth refresh token
 * @returns Access token
 */
async function getAccessTokenFromRefreshToken(
  refreshToken: string
): Promise<string> {
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
    const errorText = await response.text();
    throw new Error(`Failed to refresh token: ${response.status} ${errorText}`);
  }

  const { access_token } = await response.json();
  return access_token;
}

/**
 * Cleans test-created content from E2E Google Drive folder.
 * Skips protected folders (baseline test data like "Breaking Bad").
 */
async function cleanupE2EDrive(): Promise<void> {
  const refreshToken = process.env.GOOGLE_E2E_REFRESH_TOKEN;
  const rootFolderId = process.env.GOOGLE_E2E_ROOT_FOLDER_ID;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!refreshToken || !rootFolderId || !clientId || !clientSecret) {
    console.log("[E2E Setup] Skipping Drive cleanup - missing credentials");
    return;
  }

  console.log("[E2E Setup] Cleaning Google Drive (keeping protected folders)...");

  const drive = await getDriveClientFromRefreshToken(refreshToken);

  // List all items in root folder with pagination
  const allItems: Array<{ id: string; name: string }> = [];
  let pageToken: string | undefined;

  do {
    const response = await drive.files.list({
      q: `'${rootFolderId}' in parents and trashed = false`,
      fields: "files(id, name), nextPageToken",
      pageSize: 1000,
      pageToken,
    });

    const items = response.data.files || [];
    for (const item of items) {
      if (item.id && item.name) {
        // Skip protected folders
        if (PROTECTED_FOLDERS.includes(item.name)) {
          console.log(`[E2E Setup] Keeping protected folder: ${item.name}`);
          continue;
        }
        allItems.push({ id: item.id, name: item.name });
      }
    }

    pageToken = response.data.nextPageToken ?? undefined;
  } while (pageToken);

  if (allItems.length === 0) {
    console.log("[E2E Setup] No items to delete");
  } else {
    console.log(`[E2E Setup] Found ${allItems.length} items to delete`);

    // Batch delete items
    const fileIds = allItems.map((item) => item.id);
    const accessToken = await getAccessTokenFromRefreshToken(refreshToken);

    const result = await batchDelete(accessToken, fileIds);

    if (result.failed.length > 0) {
      console.warn(
        `[E2E Setup] Failed to delete ${result.failed.length} items:`,
        result.failed.slice(0, 3).map((f) => f.error)
      );
    }

    console.log(`[E2E Setup] Deleted ${result.succeeded.length} items`);
  }

  // Empty trash
  console.log("[E2E Setup] Emptying trash...");
  try {
    await emptyTrash(drive);
  } catch (err) {
    console.warn(
      "[E2E Setup] Failed to empty trash:",
      err instanceof Error ? err.message : err
    );
  }

  console.log("[E2E Setup] Drive cleanup complete");
}

/**
 * Verifies the Google Drive E2E test folder structure exists.
 * Does NOT upload - use `pnpm run setup:e2e-drive` for that.
 */
async function setupE2EDrive(): Promise<void> {
  const refreshToken = process.env.GOOGLE_E2E_REFRESH_TOKEN;
  const rootFolderId = process.env.GOOGLE_E2E_ROOT_FOLDER_ID;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  // Skip if credentials not configured
  if (!refreshToken || !rootFolderId || !clientId || !clientSecret) {
    console.log(
      "[E2E Setup] Skipping Drive verification - missing credentials"
    );
    return;
  }

  console.log("[E2E Setup] Verifying Google Drive test structure...");

  // Set up OAuth client
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  const drive = google.drive({ version: "v3", auth: oauth2Client });

  // Validate root folder exists
  try {
    const folderCheck = await drive.files.get({
      fileId: rootFolderId,
      fields: "name,trashed",
    });

    if (folderCheck.data.trashed) {
      throw new Error(
        "GOOGLE_E2E_ROOT_FOLDER_ID folder is in trash.\n" +
          "Restore it or run: pnpm run setup:e2e"
      );
    }

    console.log(`[E2E Setup] Root folder: ${folderCheck.data.name}`);
  } catch (err: unknown) {
    const error = err as { code?: number; message?: string };
    if (error.code === 404) {
      throw new Error(
        "GOOGLE_E2E_ROOT_FOLDER_ID folder not found.\n" +
          "Run: pnpm run setup:e2e"
      );
    }
    throw err;
  }

  // Check for test folder
  const folderRes = await drive.files.list({
    q: `"${rootFolderId}" in parents and name = "${TEST_FOLDER_NAME}" and mimeType = "application/vnd.google-apps.folder" and trashed = false`,
    fields: "files(id, name)",
  });

  if (!folderRes.data.files || folderRes.data.files.length === 0) {
    console.warn(
      `[E2E Setup] ⚠️  "${TEST_FOLDER_NAME}" folder not found - run: pnpm run setup:e2e-drive`
    );
    return;
  }

  const testFolderId = folderRes.data.files[0].id!;
  console.log(`[E2E Setup] Found "${TEST_FOLDER_NAME}" folder`);

  // Check for video file
  const videoRes = await drive.files.list({
    q: `"${testFolderId}" in parents and mimeType contains "video" and trashed = false`,
    fields: "files(id, name)",
  });

  if (videoRes.data.files && videoRes.data.files.length > 0) {
    console.log(`[E2E Setup] Found video: ${videoRes.data.files[0].name}`);
  } else {
    console.warn(
      `[E2E Setup] ⚠️  No video file found - media tests will be skipped`
    );
    console.warn(`[E2E Setup]    Run: pnpm run setup:e2e-drive`);
  }

  console.log("[E2E Setup] Drive verification complete");
}

setup("global setup", async () => {
  try {
    await cleanupE2EDrive();
    await setupE2EDrive();
  } catch (err) {
    // Log the error clearly
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[E2E Setup] ❌ Drive setup failed: ${message}`);

    // Always re-throw to signal setup failure
    throw err;
  }
  console.log("E2E test setup complete");
});
