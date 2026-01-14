/**
 * Global setup for E2E tests.
 * Sets up Google Drive test folder structure before all tests.
 */

import { test as setup } from "@playwright/test";
import { google } from "googleapis";
import * as fs from "fs";
import * as path from "path";

const TEST_FOLDER_NAME = "Breaking Bad";
const TEST_VIDEO_PATH =
  "seed-media/The.Office.UK.S01E01.1080p.WEBRip.x265-RARBG.mp4";

/**
 * Sets up the Google Drive E2E test folder structure.
 * Creates "Breaking Bad" folder and uploads test video if missing.
 */
async function setupE2EDrive(): Promise<void> {
  const refreshToken = process.env.E2E_GOOGLE_REFRESH_TOKEN;
  const rootFolderId = process.env.E2E_GOOGLE_ROOT_FOLDER_ID;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  // Skip if credentials not configured
  if (!refreshToken || !rootFolderId || !clientId || !clientSecret) {
    console.log(
      "[E2E Setup] Skipping Drive setup - missing credentials (E2E_GOOGLE_REFRESH_TOKEN, E2E_GOOGLE_ROOT_FOLDER_ID)"
    );
    return;
  }

  console.log("[E2E Setup] Setting up Google Drive test structure...");

  // Set up OAuth client
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  const drive = google.drive({ version: "v3", auth: oauth2Client });

  // Check for existing test folder
  const folderRes = await drive.files.list({
    q: `"${rootFolderId}" in parents and name = "${TEST_FOLDER_NAME}" and mimeType = "application/vnd.google-apps.folder" and trashed = false`,
    fields: "files(id, name)",
  });

  let testFolderId: string;

  if (folderRes.data.files && folderRes.data.files.length > 0) {
    testFolderId = folderRes.data.files[0].id!;
    console.log(`[E2E Setup] Found existing "${TEST_FOLDER_NAME}" folder`);
  } else {
    console.log(`[E2E Setup] Creating "${TEST_FOLDER_NAME}" folder...`);
    const createRes = await drive.files.create({
      requestBody: {
        name: TEST_FOLDER_NAME,
        mimeType: "application/vnd.google-apps.folder",
        parents: [rootFolderId],
      },
      fields: "id",
    });
    testFolderId = createRes.data.id!;
    console.log(`[E2E Setup] Created folder (${testFolderId})`);
  }

  // Check for existing video file
  const videoRes = await drive.files.list({
    q: `"${testFolderId}" in parents and mimeType contains "video" and trashed = false`,
    fields: "files(id, name, size)",
  });

  if (videoRes.data.files && videoRes.data.files.length > 0) {
    const video = videoRes.data.files[0];
    console.log(`[E2E Setup] Found existing video: ${video.name}`);
  } else {
    // Check if local video file exists
    const videoPath = path.join(process.cwd(), TEST_VIDEO_PATH);
    if (!fs.existsSync(videoPath)) {
      console.warn(
        `[E2E Setup] Local video file not found: ${videoPath} - media tests will be skipped`
      );
      return;
    }

    const stats = fs.statSync(videoPath);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
    const fileName = path.basename(videoPath);

    console.log(`[E2E Setup] Uploading ${fileName} (${sizeMB} MB)...`);

    await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [testFolderId],
      },
      media: {
        mimeType: "video/mp4",
        body: fs.createReadStream(videoPath),
      },
      fields: "id",
    });

    console.log(`[E2E Setup] Video uploaded successfully`);
  }

  console.log("[E2E Setup] Google Drive setup complete");
}

setup("global setup", async () => {
  try {
    await setupE2EDrive();
  } catch (err) {
    console.warn(
      "[E2E Setup] Drive setup failed (tests will continue):",
      err instanceof Error ? err.message : err
    );
  }
  console.log("E2E test setup complete");
});
