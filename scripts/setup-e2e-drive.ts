/**
 * Sets up the Google Drive E2E test environment from scratch.
 * Wipes everything, empties trash, creates baseline test data,
 * and syncs it to the database for E2E tests.
 *
 * Run: pnpm run setup:e2e-drive
 */

import { google } from "googleapis";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import { FileType, SyncStatus } from "@prisma/client";
import type { ExtendedPrismaClient } from "@/lib/prisma";
import { hash } from "bcryptjs";
import { encryptCredential } from "@/lib/crypto";

dotenv.config({ path: ".env.local" });

// Use dedicated E2E database to avoid destroying dev/seed data
if (!process.env.E2E_DATABASE_URL) {
  throw new Error("E2E_DATABASE_URL is required — set it in .env.local");
}
process.env.DATABASE_URL = process.env.E2E_DATABASE_URL;

// Prisma client - initialized dynamically after env vars are loaded
let prisma: ExtendedPrismaClient;

const TEST_FOLDER_NAME = "Breaking Bad";
const TEST_VIDEO_PATH = "video.mp4";
const E2E_TEST_USER_EMAIL = "e2e-drive-test@canoncore.test";
const E2E_TEST_PASSWORD = "TestPassword123";

async function main() {
  // Dynamic import of prisma after env vars are loaded
  const prismaModule = await import("@/lib/prisma");
  prisma = prismaModule.prisma;

  // Validate environment
  const refreshToken = process.env.GOOGLE_E2E_REFRESH_TOKEN;
  const rootFolderId = process.env.GOOGLE_E2E_ROOT_FOLDER_ID;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!refreshToken || !rootFolderId || !clientId || !clientSecret) {
    console.error("Missing required environment variables:");
    if (!refreshToken) console.error("  - GOOGLE_E2E_REFRESH_TOKEN");
    if (!rootFolderId) console.error("  - GOOGLE_E2E_ROOT_FOLDER_ID");
    if (!clientId) console.error("  - GOOGLE_CLIENT_ID");
    if (!clientSecret) console.error("  - GOOGLE_CLIENT_SECRET");
    console.error("\nRun: pnpm run setup:e2e");
    process.exit(1);
  }

  // Set up OAuth client
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  const drive = google.drive({ version: "v3", auth: oauth2Client });

  console.log("\n🧹 Setting up E2E Google Drive (fresh start)...\n");

  // Step 1: Wipe everything in root folder
  console.log("1. Wiping all contents...");
  let pageToken: string | undefined;
  let deletedCount = 0;

  do {
    const response = await drive.files.list({
      q: `'${rootFolderId}' in parents and trashed = false`,
      fields: "files(id, name), nextPageToken",
      pageSize: 100,
      pageToken,
    });

    const files = response.data.files || [];
    for (const file of files) {
      if (file.id) {
        try {
          await drive.files.delete({ fileId: file.id });
          deletedCount++;
          process.stdout.write(`   Deleted: ${file.name}\n`);
        } catch (err) {
          console.warn(`   Failed to delete ${file.name}:`, err);
        }
      }
    }

    pageToken = response.data.nextPageToken ?? undefined;
  } while (pageToken);

  if (deletedCount === 0) {
    console.log("   ✓ Already empty\n");
  } else {
    console.log(`   ✓ Deleted ${deletedCount} items\n`);
  }

  // Step 2: Empty trash
  console.log("2. Emptying trash...");
  try {
    await drive.files.emptyTrash();
    console.log("   ✓ Trash emptied\n");
  } catch {
    console.warn("   ⚠️  Failed to empty trash (may need permissions)\n");
  }

  // Step 3: Create test folder
  console.log(`3. Creating "${TEST_FOLDER_NAME}" folder...`);
  const createRes = await drive.files.create({
    requestBody: {
      name: TEST_FOLDER_NAME,
      mimeType: "application/vnd.google-apps.folder",
      parents: [rootFolderId],
    },
    fields: "id",
  });
  const testFolderId = createRes.data.id!;
  console.log(`   ✓ Created folder (${testFolderId})\n`);

  // Step 4: Upload video
  console.log("4. Uploading test video...");
  const videoPath = path.join(process.cwd(), TEST_VIDEO_PATH);

  if (!fs.existsSync(videoPath)) {
    console.error(`   ✗ Video file not found: ${videoPath}`);
    console.error("   Please add a test video to seed-media/");
    process.exit(1);
  }

  const stats = fs.statSync(videoPath);
  const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
  const fileName = path.basename(videoPath);

  console.log(`   Uploading ${fileName} (${sizeMB} MB)...`);
  console.log("   This may take a few minutes...\n");

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

  console.log("   ✓ Upload complete\n");

  // Step 5: Verify
  console.log("5. Verifying setup...");
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

  // Step 6: Create/update E2E test user with Drive connection in database
  console.log("6. Setting up database for E2E tests...");

  // Clean up existing E2E test user if exists
  const existingUser = await prisma.user.findUnique({
    where: { email: E2E_TEST_USER_EMAIL },
    include: { items: true, googleDriveConnection: true },
  });

  if (existingUser) {
    console.log("   Cleaning up existing E2E test user...");
    await prisma.itemFile.deleteMany({
      where: { item: { userId: existingUser.id } },
    });
    await prisma.item.deleteMany({ where: { userId: existingUser.id } });
    if (existingUser.googleDriveConnection) {
      await prisma.googleDriveConnection.delete({
        where: { id: existingUser.googleDriveConnection.id },
      });
    }
    await prisma.user.delete({ where: { id: existingUser.id } });
  }

  // Create E2E test user with unique username
  const passwordHash = await hash(E2E_TEST_PASSWORD, 10);
  const e2eUsername = "e2e_drive_user";
  const e2eUser = await prisma.user.create({
    data: {
      email: E2E_TEST_USER_EMAIL,
      passwordHash,
      username: e2eUsername,
    },
  });
  console.log(
    `   ✓ Created E2E test user: ${E2E_TEST_USER_EMAIL} (@${e2eUsername})`
  );

  // Create Google Drive connection with encrypted tokens
  const encryptedAccessToken = encryptCredential("placeholder-will-refresh");
  const encryptedRefreshToken = encryptCredential(refreshToken);

  await prisma.googleDriveConnection.create({
    data: {
      userId: e2eUser.id,
      name: "E2E Test Drive",
      encryptedAccessToken,
      encryptedRefreshToken,
      accessTokenExpiry: new Date(Date.now() - 1000), // Expired, will refresh
      rootFolderId,
      email: process.env.GOOGLE_E2E_EMAIL || "e2e@test.com",
    },
  });
  console.log("   ✓ Created Google Drive connection");

  // Create item in database for the test folder
  const testItem = await prisma.item.create({
    data: {
      name: TEST_FOLDER_NAME,
      userId: e2eUser.id,
      depth: 0,
      order: 0,
      driveFileId: testFolderId,
      syncStatus: SyncStatus.SYNCED,
      driveModifiedAt: new Date(),
    },
  });
  console.log(`   ✓ Created item: ${TEST_FOLDER_NAME}`);

  // Create ItemFile for the video (if uploaded)
  if (verifyRes.data.files && verifyRes.data.files.length > 0) {
    const videoFile = verifyRes.data.files[0];
    await prisma.itemFile.create({
      data: {
        itemId: testItem.id,
        filename: videoFile.name!,
        driveFileId: videoFile.id!,
        fileType: FileType.MEDIA,
        mimeType: "video/mp4",
        isPrimary: true,
      },
    });
    console.log(`   ✓ Created ItemFile: ${videoFile.name}`);
  }

  console.log("\n✅ E2E Drive setup complete!");
  console.log(`   Test user: ${E2E_TEST_USER_EMAIL}`);
  console.log(`   Password: ${E2E_TEST_PASSWORD}`);
  console.log("   You can now run: pnpm run test:e2e\n");
}

main()
  .catch((err) => {
    console.error("\n❌ Setup failed:", err.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
