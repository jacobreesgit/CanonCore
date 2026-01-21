/**
 * Global setup for E2E tests.
 * Automatically ensures all prerequisites exist, creating or restoring them as needed.
 *
 * Auto-recovery handles:
 * - Root folder in trash -> restores it
 * - "Breaking Bad" folder missing -> creates it
 * - Video file missing -> uploads it (if local file exists)
 * - E2E user missing -> creates it
 * - Drive connection missing -> creates it
 * - Database records missing -> creates them
 *
 * Only fails when issues are unrecoverable (e.g., permanently deleted folder, missing credentials).
 */

import { test as setup } from "@playwright/test";
import { config } from "dotenv";
import {
  getDriveClientFromRefreshToken,
  batchDelete,
  emptyTrash,
} from "@/lib/google-drive-client";
import { assertDriveConfigured } from "@/lib/drive-verification";
import { runAutomaticSetup, TEST_FOLDER_NAME } from "@/lib/e2e-setup";

// Load environment variables
config({ path: ".env.local" });

/** Protected folders are not deleted during cleanup (baseline test data). */
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
  const refreshToken = process.env.GOOGLE_E2E_REFRESH_TOKEN!;
  const rootFolderId = process.env.GOOGLE_E2E_ROOT_FOLDER_ID!;

  console.log(
    "[E2E Setup] Cleaning Google Drive (keeping protected folders)..."
  );

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

setup("global setup", async () => {
  // Pre-flight check: Basic credentials must be configured
  // This only checks that env vars exist, not that they're valid
  await assertDriveConfigured("e2e");

  try {
    // Clean up test-created content (keeps protected folders)
    await cleanupE2EDrive();

    // Run automatic setup - creates/restores any missing prerequisites
    const result = await runAutomaticSetup();

    if (!result.success) {
      throw new Error(result.error || "Automatic setup failed");
    }

    console.log("[E2E Setup] ✅ All prerequisites verified - ready for tests");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[E2E Setup] ❌ Setup failed: ${message}`);
    throw err;
  }
});
