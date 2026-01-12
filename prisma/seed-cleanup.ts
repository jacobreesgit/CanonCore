/**
 * Cleanup script for seeded demo content.
 * Removes seed users from database and their folders from Google Drive.
 *
 * Usage:
 *   ALLOW_SEEDING=true npx tsx prisma/seed-cleanup.ts
 *
 * Environment Variables:
 *   - ALLOW_SEEDING: Must be "true" to run (prevents accidental cleanup)
 *   - GOOGLE_TEST_REFRESH_TOKEN: Required for Drive cleanup
 *   - GOOGLE_TEST_ROOT_FOLDER_ID: Root folder for Drive cleanup
 */

// Load environment variables before any other imports
import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

import { SEED_USERS, PROTECTED_FOLDERS } from "./seed-config";

// Prisma will be dynamically imported after env vars are loaded
import type { PrismaClient } from "@prisma/client";
let prisma: PrismaClient;

/**
 * Validates environment before cleanup.
 */
function validateEnvironment(): void {
  if (process.env.ALLOW_SEEDING !== "true") {
    console.error("❌ ALLOW_SEEDING must be set to 'true' to run cleanup");
    console.error(
      "   Example: ALLOW_SEEDING=true npx tsx prisma/seed-cleanup.ts"
    );
    process.exit(1);
  }

  // Block production database - check against known production Neon endpoint
  const dbUrl = process.env.DATABASE_URL || "";
  const PRODUCTION_NEON_ENDPOINT = "ep-dry-poetry-ab4m7vi1";

  if (dbUrl.includes(PRODUCTION_NEON_ENDPOINT)) {
    console.error("❌ DATABASE_URL is the production database");
    console.error("   Cleanup is only allowed on development/test databases");
    process.exit(1);
  }

  console.log("✅ Environment validated");
}

/**
 * Cleans up seed users and their data from database.
 */
async function cleanupDatabase(): Promise<void> {
  const seedEmails = SEED_USERS.map((u) => u.email);

  // Delete ItemFiles for seed users (via Item relationship)
  const deletedFiles = await prisma.itemFile.deleteMany({
    where: {
      item: {
        user: {
          email: { in: seedEmails },
        },
      },
    },
  });

  if (deletedFiles.count > 0) {
    console.log(`🗑️  Deleted ${deletedFiles.count} item file(s)`);
  }

  // Delete Items for seed users
  const deletedItems = await prisma.item.deleteMany({
    where: {
      user: {
        email: { in: seedEmails },
      },
    },
  });

  if (deletedItems.count > 0) {
    console.log(`🗑️  Deleted ${deletedItems.count} item(s)`);
  }

  // Delete GoogleDriveConnections for seed users
  const deletedConnections = await prisma.googleDriveConnection.deleteMany({
    where: {
      user: {
        email: { in: seedEmails },
      },
    },
  });

  if (deletedConnections.count > 0) {
    console.log(`🗑️  Deleted ${deletedConnections.count} Drive connection(s)`);
  }

  // Delete seed users
  const deletedUsers = await prisma.user.deleteMany({
    where: {
      email: { in: seedEmails },
    },
  });

  if (deletedUsers.count > 0) {
    console.log(`🗑️  Deleted ${deletedUsers.count} seed user(s)`);
  }
}

/**
 * Cleans up seed folders from Google Drive.
 */
async function cleanupGoogleDrive(): Promise<void> {
  const refreshToken = process.env.GOOGLE_TEST_REFRESH_TOKEN;
  const rootFolderId = process.env.GOOGLE_TEST_ROOT_FOLDER_ID;

  if (!refreshToken || !rootFolderId) {
    console.log("⏭️  Skipping Drive cleanup (no credentials configured)");
    return;
  }

  try {
    // Dynamic import to avoid requiring googleapis when not used
    const {
      getDriveClientFromRefreshToken,
      permanentlyDeleteFile,
      emptyTrash,
    } = await import("@/lib/google-drive-client");

    const drive = await getDriveClientFromRefreshToken(refreshToken);

    // List all folders in root folder
    const response = await drive.files.list({
      q: `'${rootFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: "files(id, name)",
      pageSize: 1000,
    });

    const folders = response.data.files || [];

    // Delete all folders except protected ones
    let deletedCount = 0;
    for (const folder of folders) {
      if (folder.name && PROTECTED_FOLDERS.includes(folder.name)) {
        console.log(`  ⏭️  Skipping protected folder: ${folder.name}`);
        continue;
      }

      if (folder.id) {
        try {
          await permanentlyDeleteFile(drive, folder.id);
          deletedCount++;
          console.log(`  🗑️  Deleted folder: ${folder.name}`);
        } catch (err) {
          console.warn(
            `  ⚠️  Failed to delete folder "${folder.name}":`,
            err instanceof Error ? err.message : err
          );
        }
      }
    }

    if (deletedCount > 0) {
      console.log(`🗑️  Permanently deleted ${deletedCount} Drive folder(s)`);
    }

    // Empty trash
    try {
      await emptyTrash(drive);
      console.log("🗑️  Emptied Drive trash");
    } catch (err) {
      console.warn(
        "⚠️  Failed to empty trash:",
        err instanceof Error ? err.message : err
      );
    }
  } catch (err) {
    console.warn(
      "⚠️  Drive cleanup failed:",
      err instanceof Error ? err.message : err
    );
  }
}

/**
 * Main cleanup function.
 */
async function main(): Promise<void> {
  console.log("\n🧹 Starting seed cleanup...\n");

  validateEnvironment();

  // Dynamic import of prisma after env vars are loaded
  const prismaModule = await import("@/lib/prisma");
  prisma = prismaModule.prisma;

  await cleanupDatabase();
  await cleanupGoogleDrive();

  console.log("\n✅ Cleanup complete!\n");
}

main()
  .catch((error) => {
    console.error("Cleanup failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    if (prisma) {
      await prisma.$disconnect();
    }
  });
