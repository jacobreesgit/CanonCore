/**
 * Sets up the Google Drive E2E test folder structure.
 * Creates "Breaking Bad" folder and uploads test video if missing.
 *
 * Run: npx tsx scripts/setup-e2e-drive.ts
 */

import { google } from "googleapis";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

dotenv.config({ path: ".env.local" });

const TEST_FOLDER_NAME = "Breaking Bad";
const TEST_VIDEO_PATH =
  "seed-media/The.Office.UK.S01E01.1080p.WEBRip.x265-RARBG.mp4";

async function main() {
  // Validate environment
  const refreshToken = process.env.E2E_GOOGLE_REFRESH_TOKEN;
  const rootFolderId = process.env.E2E_GOOGLE_ROOT_FOLDER_ID;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!refreshToken || !rootFolderId || !clientId || !clientSecret) {
    console.error("Missing required environment variables:");
    if (!refreshToken) console.error("  - E2E_GOOGLE_REFRESH_TOKEN");
    if (!rootFolderId) console.error("  - E2E_GOOGLE_ROOT_FOLDER_ID");
    if (!clientId) console.error("  - GOOGLE_CLIENT_ID");
    if (!clientSecret) console.error("  - GOOGLE_CLIENT_SECRET");
    process.exit(1);
  }

  // Set up OAuth client
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  const drive = google.drive({ version: "v3", auth: oauth2Client });

  console.log("Setting up E2E Google Drive test structure...\n");

  // Check for existing test folder
  console.log(`1. Checking for "${TEST_FOLDER_NAME}" folder...`);
  const folderRes = await drive.files.list({
    q: `"${rootFolderId}" in parents and name = "${TEST_FOLDER_NAME}" and mimeType = "application/vnd.google-apps.folder" and trashed = false`,
    fields: "files(id, name)",
  });

  let testFolderId: string;

  if (folderRes.data.files && folderRes.data.files.length > 0) {
    testFolderId = folderRes.data.files[0].id!;
    console.log(`   ✓ Found existing folder (${testFolderId})\n`);
  } else {
    console.log(`   Creating "${TEST_FOLDER_NAME}" folder...`);
    const createRes = await drive.files.create({
      requestBody: {
        name: TEST_FOLDER_NAME,
        mimeType: "application/vnd.google-apps.folder",
        parents: [rootFolderId],
      },
      fields: "id",
    });
    testFolderId = createRes.data.id!;
    console.log(`   ✓ Created folder (${testFolderId})\n`);
  }

  // Check for existing video file
  console.log("2. Checking for video file...");
  const videoRes = await drive.files.list({
    q: `"${testFolderId}" in parents and mimeType contains "video" and trashed = false`,
    fields: "files(id, name, size)",
  });

  if (videoRes.data.files && videoRes.data.files.length > 0) {
    const video = videoRes.data.files[0];
    const sizeMB = video.size
      ? (parseInt(video.size) / 1024 / 1024).toFixed(2)
      : "unknown";
    console.log(`   ✓ Found existing video: ${video.name} (${sizeMB} MB)\n`);
  } else {
    // Check if local video file exists
    const videoPath = path.join(process.cwd(), TEST_VIDEO_PATH);
    if (!fs.existsSync(videoPath)) {
      console.error(`   ✗ Local video file not found: ${videoPath}`);
      console.error(
        "   Please add a test video to seed-media/ and update TEST_VIDEO_PATH"
      );
      process.exit(1);
    }

    const stats = fs.statSync(videoPath);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
    const fileName = path.basename(videoPath);

    console.log(`   Uploading ${fileName} (${sizeMB} MB)...`);

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

    console.log(`   ✓ Uploaded successfully\n`);
  }

  // Final verification
  console.log("3. Verifying setup...");
  const verifyRes = await drive.files.list({
    q: `"${testFolderId}" in parents and trashed = false`,
    fields: "files(id, name, mimeType)",
  });

  console.log(`\n   📁 ${TEST_FOLDER_NAME}/`);
  if (verifyRes.data.files) {
    for (const file of verifyRes.data.files) {
      const icon = file.mimeType?.startsWith("video") ? "🎬" : "📄";
      console.log(`      ${icon} ${file.name}`);
    }
  }

  console.log("\n✓ E2E Drive setup complete!");
}

main().catch((err) => {
  console.error("Setup failed:", err.message);
  process.exit(1);
});
