/**
 * Database seed script for development/QA.
 * Creates sample users, items, and files for manual exploration.
 *
 * Usage:
 *   pnpm run db:seed                    # Seed everything
 *   pnpm run db:seed -- --help          # Show all flags
 *   pnpm run db:seed -- --movies        # Seed movies only
 *   pnpm run db:seed -- --tv            # Seed TV shows only
 *   pnpm run db:seed -- --music         # Seed music only
 *   pnpm run db:seed -- --tv --filter="Office"  # Just The Office
 *   pnpm run db:seed -- --no-upload     # Skip SFTP uploads
 *   pnpm run db:seed -- --upload-only   # Only upload files
 *
 * SAFETY: Refuses to run against production databases.
 */

import * as fs from "fs";
import * as path from "path";
import { PrismaClient, FileType } from "@prisma/client";
import type { SftpConnection } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcryptjs";
import { config } from "dotenv";
import {
  checkFileExists,
  uploadFile,
  createDirectory,
  closeAllConnections,
} from "@/lib/sftp-client";
import { discoverSeedFiles, mapLocalToRemotePath } from "./seed-utils";
import { MOVIES, TV_SHOWS, MUSIC, type SeedItem } from "./seed-data";

// Load .env.local for local development
config({ path: ".env.local" });

/**
 * Seed configuration parsed from command-line arguments.
 */
interface SeedConfig {
  /** Seed movies category */
  movies: boolean;
  /** Seed TV shows category */
  tv: boolean;
  /** Seed music category */
  music: boolean;
  /** Filter items by name (case-insensitive) */
  filter: string | null;
  /** Skip SFTP file uploads */
  noUpload: boolean;
  /** Only upload files, skip DB seeding */
  uploadOnly: boolean;
  /** Show help and exit */
  help: boolean;
}

/**
 * Parses command-line arguments into seed configuration.
 *
 * @returns Parsed seed configuration
 */
function parseArgs(): SeedConfig {
  const args = process.argv.slice(2);

  const seedConfig: SeedConfig = {
    movies: false,
    tv: false,
    music: false,
    filter: null,
    noUpload: false,
    uploadOnly: false,
    help: false,
  };

  for (const arg of args) {
    if (arg === "--help" || arg === "-h") {
      seedConfig.help = true;
    } else if (arg === "--movies") {
      seedConfig.movies = true;
    } else if (arg === "--tv") {
      seedConfig.tv = true;
    } else if (arg === "--music") {
      seedConfig.music = true;
    } else if (arg === "--no-upload") {
      seedConfig.noUpload = true;
    } else if (arg === "--upload-only") {
      seedConfig.uploadOnly = true;
    } else if (arg.startsWith("--filter=")) {
      seedConfig.filter = arg.slice("--filter=".length);
    }
  }

  // If no categories specified, seed all
  if (!seedConfig.movies && !seedConfig.tv && !seedConfig.music) {
    seedConfig.movies = true;
    seedConfig.tv = true;
    seedConfig.music = true;
  }

  return seedConfig;
}

/**
 * Shows help message with available flags.
 */
function showHelp(): void {
  console.log(`
🌱 Database Seed Script

Usage: pnpm run db:seed -- [flags]

Categories (combine multiple):
  --movies          Seed Movies category
  --tv              Seed TV Shows category
  --music           Seed Music category

Filtering:
  --filter=<text>   Only seed items containing text (case-insensitive)
                    Example: --filter="Office" seeds only The Office

Upload control:
  --no-upload       Skip SFTP file uploads (DB records only)
  --upload-only     Only upload files (skip DB seeding)

Other:
  --help, -h        Show this help message

Examples:
  pnpm run db:seed                           # Seed everything
  pnpm run db:seed -- --tv                   # TV shows only
  pnpm run db:seed -- --tv --filter="Office" # Just The Office
  pnpm run db:seed -- --movies --music       # Movies and music
  pnpm run db:seed -- --no-upload            # DB only, skip uploads
  pnpm run db:seed -- --upload-only          # Upload files only
`);
}

/**
 * Checks if an item name matches the filter.
 *
 * @param name - Item name to check
 * @param filter - Filter string (case-insensitive)
 * @returns True if name matches filter or filter is null
 */
function matchesFilter(name: string, filter: string | null): boolean {
  if (!filter) return true;
  return name.toLowerCase().includes(filter.toLowerCase());
}

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

/**
 * Validates that we're running against a safe database.
 * Refuses to seed production databases.
 */
function validateEnvironment(): void {
  // Explicit opt-in required
  if (process.env.ALLOW_SEEDING !== "true") {
    console.error("❌ ALLOW_SEEDING not enabled");
    console.error("Add ALLOW_SEEDING=true to .env.local to seed");
    process.exit(1);
  }

  const dbUrl = process.env.DATABASE_URL || "";

  const isSafe =
    dbUrl.includes("development") ||
    dbUrl.includes("localhost") ||
    dbUrl.includes("127.0.0.1") ||
    dbUrl.includes("neondb") ||
    dbUrl.includes("neon.tech");

  if (!isSafe) {
    console.error("❌ SAFETY CHECK FAILED");
    console.error("DATABASE_URL does not appear to be a development database.");
    console.error(
      "Refusing to seed. Set DATABASE_URL to a development branch."
    );
    process.exit(1);
  }

  if (!process.env.SEED_PASSWORD) {
    console.error("❌ SEED_PASSWORD not set in environment");
    console.error("Add SEED_PASSWORD to .env.local");
    process.exit(1);
  }

  console.log("✅ Safety check passed - seeding development database");

  // Check SFTP configuration
  if (process.env.SFTP_SEED_HOST) {
    console.log(
      "✅ SFTP_SEED_* configured - seeded items will have connections"
    );
    // Check WebDAV configuration (optional enhancement for media streaming)
    if (process.env.SFTP_SEED_HTTPS_URL) {
      console.log(
        "✅ SFTP_SEED_HTTPS_URL configured - WebDAV streaming enabled"
      );
    }
  } else {
    console.warn(
      "⚠️  SFTP_SEED_* not set - seeded items won't display artwork"
    );
  }
}

/**
 * Creates a user with hashed password.
 */
async function createUser(
  email: string,
  name: string,
  passwordHash: string
): Promise<string> {
  const user = await prisma.user.upsert({
    where: { email },
    update: { name, passwordHash },
    create: { email, name, passwordHash },
  });
  console.log(`  Created user: ${email}`);
  return user.id;
}

/**
 * Creates an SFTP connection for a user using env vars.
 * Uses SFTP_SEED_* vars from .env.local.
 *
 * If SFTP_SEED_HTTPS_URL is set, WebDAV fields are also configured
 * using the same credentials as SFTP (common pattern for media servers).
 *
 * @param userId - The user ID to create the connection for
 * @returns The connection ID if created, null if SFTP env vars are missing
 */
async function createSftpConnection(userId: string): Promise<string | null> {
  const host = process.env.SFTP_SEED_HOST;
  const username = process.env.SFTP_SEED_USERNAME;
  const password = process.env.SFTP_SEED_PASSWORD;

  if (!host || !username || !password) {
    return null;
  }

  const { encryptCredential } = await import("@/lib/crypto");
  const encryptedPassword = encryptCredential(password);

  // WebDAV configuration (optional) - uses same credentials as SFTP
  const webdavUrl = process.env.SFTP_SEED_HTTPS_URL;
  const webdavFields = webdavUrl
    ? {
        webdavUrl,
        webdavUsername: username,
        encryptedWebdavPassword: encryptedPassword,
      }
    : {};

  const connection = await prisma.sftpConnection.upsert({
    where: {
      userId_name: { userId, name: "Seed Media Server" },
    },
    update: {
      host,
      port: parseInt(process.env.SFTP_SEED_PORT || "22"),
      username,
      encryptedCredential: encryptedPassword,
      basePath: process.env.SFTP_SEED_BASE_PATH || "/",
      ...webdavFields,
    },
    create: {
      userId,
      name: "Seed Media Server",
      host,
      port: parseInt(process.env.SFTP_SEED_PORT || "22"),
      username,
      encryptedCredential: encryptedPassword,
      basePath: process.env.SFTP_SEED_BASE_PATH || "/",
      authType: "PASSWORD",
      ...webdavFields,
    },
  });

  console.log(`  Created SFTP connection: ${connection.name} -> ${host}`);
  if (webdavUrl) {
    console.log(`  WebDAV configured: ${webdavUrl}`);
  }
  return connection.id;
}

/**
 * Creates an item with optional parent, description, and SFTP connection.
 */
async function createItem(
  userId: string,
  name: string,
  parentId: string | null,
  order: number,
  depth: number,
  description?: string,
  connectionId?: string | null,
  sftpPath?: string | null
): Promise<string> {
  const item = await prisma.item.create({
    data: {
      userId,
      name,
      description: description ?? null,
      parentId,
      order,
      depth,
      connectionId: connectionId ?? null,
      sftpPath: sftpPath ?? null,
    },
  });
  return item.id;
}

/**
 * Creates an item file.
 */
async function createFile(
  itemId: string,
  filename: string,
  basePath: string,
  fileType: FileType,
  mimeType: string,
  size: bigint,
  isPrimary: boolean = false
): Promise<void> {
  await prisma.itemFile.create({
    data: {
      itemId,
      filename,
      sftpPath: `${basePath}/${filename}`,
      fileType,
      mimeType,
      size,
      isPrimary,
    },
  });
}

/** Remote folder where seed media files are uploaded */
const SEED_REMOTE_FOLDER = "/seed-media";

/**
 * Recursively seeds items from a SeedItem array.
 * Creates items, files, and child items with filter support.
 *
 * @param userId - User ID to create items for
 * @param connectionId - SFTP connection ID (or null)
 * @param parentId - Parent item ID (or null for root)
 * @param basePath - Base SFTP path for this level
 * @param items - Array of seed items to create
 * @param filter - Filter string for top-level item names (or null)
 * @param startOrder - Starting order index
 * @param depth - Current depth level
 * @returns Number of items created
 */
async function seedItems(
  userId: string,
  connectionId: string | null,
  parentId: string | null,
  basePath: string,
  items: SeedItem[],
  filter: string | null,
  startOrder: number,
  depth: number
): Promise<number> {
  let order = startOrder;
  let created = 0;

  for (const item of items) {
    // Apply filter only at top level (depth 1 = movies/shows/albums)
    if (depth === 1 && !matchesFilter(item.name, filter)) {
      continue;
    }

    const itemPath = `${basePath}/${item.name}`;
    const sftpPath = connectionId ? itemPath : null;

    const itemId = await createItem(
      userId,
      item.name,
      parentId,
      order++,
      depth,
      item.description,
      connectionId,
      sftpPath
    );
    created++;

    // Create files for this item
    for (const file of item.files) {
      await createFile(
        itemId,
        file.filename,
        itemPath,
        file.fileType,
        file.mimeType,
        file.size,
        file.isPrimary ?? false
      );
    }

    // Recursively create children (no filter applied to children)
    if (item.children && item.children.length > 0) {
      await seedItems(
        userId,
        connectionId,
        itemId,
        itemPath,
        item.children,
        null, // No filter for children - if parent matches, include all children
        0,
        depth + 1
      );
    }
  }

  return created;
}

/**
 * Seeds a category (Movies, TV Shows, or Music) with its items.
 *
 * @param userId - User ID to create items for
 * @param connectionId - SFTP connection ID (or null)
 * @param categoryName - Display name for the category
 * @param categoryPath - SFTP path for the category
 * @param items - Seed items for this category
 * @param filter - Filter string for item names (or null)
 * @param order - Order index for the category folder
 * @param emoji - Emoji for logging
 */
async function seedCategory(
  userId: string,
  connectionId: string | null,
  categoryName: string,
  categoryPath: string,
  items: SeedItem[],
  filter: string | null,
  order: number,
  emoji: string
): Promise<void> {
  console.log(`    ${emoji} Seeding ${categoryName}...`);

  // Create category folder
  const categoryId = await createItem(
    userId,
    categoryName,
    null,
    order,
    0,
    `${categoryName} collection.`,
    connectionId,
    connectionId ? categoryPath : null
  );

  // Seed items in this category
  const created = await seedItems(
    userId,
    connectionId,
    categoryId,
    categoryPath,
    items,
    filter,
    0,
    1
  );

  if (filter) {
    console.log(`      Seeded ${created} matching items`);
  }
}

/**
 * Seeds Alex Demo's account with full sample data.
 *
 * @param userId - User ID to create items for
 * @param connectionId - SFTP connection ID (or null)
 * @param seedConfig - Seed configuration with category and filter options
 */
async function seedAlexDemo(
  userId: string,
  connectionId: string | null,
  seedConfig: SeedConfig
): Promise<void> {
  console.log("  Seeding Alex Demo data...");

  let order = 0;

  if (seedConfig.movies) {
    await seedCategory(
      userId,
      connectionId,
      "Movies",
      `${SEED_REMOTE_FOLDER}/Movies`,
      MOVIES,
      seedConfig.filter,
      order++,
      "📽️"
    );
  }

  if (seedConfig.tv) {
    await seedCategory(
      userId,
      connectionId,
      "TV Shows",
      `${SEED_REMOTE_FOLDER}/TV Shows`,
      TV_SHOWS,
      seedConfig.filter,
      order++,
      "📺"
    );
  }

  if (seedConfig.music) {
    await seedCategory(
      userId,
      connectionId,
      "Music",
      `${SEED_REMOTE_FOLDER}/Music`,
      MUSIC,
      seedConfig.filter,
      order++,
      "🎵"
    );
  }

  // Documentaries folder (empty) - only if seeding all categories without filter
  if (
    seedConfig.movies &&
    seedConfig.tv &&
    seedConfig.music &&
    !seedConfig.filter
  ) {
    await createItem(
      userId,
      "Documentaries",
      null,
      order++,
      0,
      "Collection of documentary films and series.",
      connectionId,
      connectionId ? `${SEED_REMOTE_FOLDER}/Documentaries` : null
    );
  }
}

/**
 * Seeds Jordan Test's account with minimal data.
 */
async function seedJordanTest(userId: string): Promise<void> {
  console.log("  Seeding Jordan Test data...");

  await createItem(
    userId,
    "My Items",
    null,
    0,
    0,
    "Personal files and documents."
  );
  await createItem(
    userId,
    "Projects",
    null,
    1,
    0,
    "Work-in-progress projects."
  );
}

/**
 * Cleans up existing seed users before re-seeding.
 * Cascades to delete all related items and files.
 */
async function cleanupSeedUsers(): Promise<void> {
  console.log("🧹 Cleaning up existing seed users...");
  const seedEmails = [
    "seed@canoncore.com",
    "seed2@canoncore.com",
    "seed3@canoncore.com",
  ];

  for (const email of seedEmails) {
    const deleted = await prisma.user.deleteMany({
      where: { email },
    });
    if (deleted.count > 0) {
      console.log(`  Deleted: ${email}`);
    }
  }
}

/** Progress update interval in milliseconds */
const PROGRESS_INTERVAL_MS = 5000;

/**
 * Formats bytes into human-readable size.
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * Checks if a file path matches the seed config categories and filter.
 *
 * @param remotePath - Remote file path to check
 * @param seedConfig - Seed configuration
 * @returns True if file should be uploaded
 */
function shouldUploadFile(remotePath: string, seedConfig: SeedConfig): boolean {
  // Determine category from path
  const isMovies = remotePath.includes("/Movies/");
  const isTV = remotePath.includes("/TV Shows/");
  const isMusic = remotePath.includes("/Music/");

  // Check category filter
  if (isMovies && !seedConfig.movies) return false;
  if (isTV && !seedConfig.tv) return false;
  if (isMusic && !seedConfig.music) return false;

  // Check name filter
  if (seedConfig.filter) {
    return remotePath.toLowerCase().includes(seedConfig.filter.toLowerCase());
  }

  return true;
}

/**
 * Uploads all files from seed-media/ to the SFTP server.
 * Files are uploaded to the /seed-media folder.
 * Skips files that already exist to avoid re-uploading large media files.
 * Logs progress updates every 5 seconds during long uploads.
 *
 * @param connection - SFTP connection to use for uploads
 * @param seedConfig - Seed configuration for filtering
 */
async function uploadSeedMedia(
  connection: SftpConnection,
  seedConfig: SeedConfig
): Promise<void> {
  const seedMediaPath = path.join(process.cwd(), "seed-media");

  // Check if seed-media directory exists
  if (!fs.existsSync(seedMediaPath)) {
    console.warn("  seed-media/ directory not found, skipping file upload");
    return;
  }

  console.log(`  Uploading seed media files to ${SEED_REMOTE_FOLDER}/...`);

  // Discover all files, excluding .DS_Store
  const allFiles = discoverSeedFiles(seedMediaPath);

  if (allFiles.length === 0) {
    console.log("    No files found in seed-media/");
    return;
  }

  // Filter files based on config
  const files = allFiles.filter((localPath) => {
    const relativePath = mapLocalToRemotePath(localPath, seedMediaPath);
    const remotePath = SEED_REMOTE_FOLDER + relativePath;
    return shouldUploadFile(remotePath, seedConfig);
  });

  const total = files.length;
  if (total === 0) {
    console.log("    No matching files to upload");
    return;
  }

  console.log(`    Found ${total} files matching filters`);

  let uploaded = 0;
  let skipped = 0;
  const startTime = Date.now();

  for (let i = 0; i < files.length; i++) {
    const localPath = files[i];
    // Prepend /seed-media to remote path
    const relativePath = mapLocalToRemotePath(localPath, seedMediaPath);
    const remotePath = SEED_REMOTE_FOLDER + relativePath;
    const fileName = path.basename(remotePath);
    const fileSize = fs.statSync(localPath).size;

    try {
      // Check if file already exists - skip to avoid re-uploading large files
      const exists = await checkFileExists(connection, remotePath);
      if (exists) {
        console.log(`    [${i + 1}/${total}] Skipping (exists): ${fileName}`);
        skipped++;
        continue;
      }

      // Ensure parent directory exists
      const parentDir = path.dirname(remotePath);
      await createDirectory(connection, parentDir);

      // Start progress timer for long uploads
      const uploadStart = Date.now();
      const progressInterval = setInterval(() => {
        const elapsed = Math.round((Date.now() - uploadStart) / 1000);
        console.log(
          `    [${i + 1}/${total}] Still uploading: ${fileName} (${formatBytes(fileSize)}) - ${elapsed}s elapsed...`
        );
      }, PROGRESS_INTERVAL_MS);

      // Upload file (no timeout for large media files)
      console.log(
        `    [${i + 1}/${total}] Uploading: ${fileName} (${formatBytes(fileSize)})...`
      );
      await uploadFile(connection, localPath, remotePath, 0);

      // Clear progress timer and log completion
      clearInterval(progressInterval);
      const uploadTime = ((Date.now() - uploadStart) / 1000).toFixed(1);
      console.log(`    [${i + 1}/${total}] Done: ${fileName} (${uploadTime}s)`);
      uploaded++;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`    [${i + 1}/${total}] Failed: ${fileName} - ${message}`);
    }
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(
    `  Upload complete: ${uploaded} uploaded, ${skipped} skipped (${totalTime}s total)`
  );
}

/**
 * Main seed function.
 */
async function main(): Promise<void> {
  const seedConfig = parseArgs();

  // Handle help flag
  if (seedConfig.help) {
    showHelp();
    process.exit(0);
  }

  console.log("🌱 Starting database seed...\n");

  // Show active flags
  const activeCategories = [
    seedConfig.movies && "movies",
    seedConfig.tv && "tv",
    seedConfig.music && "music",
  ].filter(Boolean);
  console.log(`📋 Categories: ${activeCategories.join(", ")}`);
  if (seedConfig.filter) {
    console.log(`🔍 Filter: "${seedConfig.filter}"`);
  }
  if (seedConfig.noUpload) {
    console.log("⏭️  Skipping file uploads (--no-upload)");
  }
  if (seedConfig.uploadOnly) {
    console.log("📤 Upload only mode (--upload-only)");
  }
  console.log("");

  validateEnvironment();

  // For upload-only mode, just upload files and exit
  if (seedConfig.uploadOnly) {
    console.log("\n🔌 Getting SFTP connection...");
    const existingUser = await prisma.user.findUnique({
      where: { email: "seed@canoncore.com" },
    });
    if (!existingUser) {
      console.error("❌ No seed user found. Run full seed first.");
      process.exit(1);
    }
    const existingConnection = await prisma.sftpConnection.findFirst({
      where: { userId: existingUser.id },
    });
    if (!existingConnection) {
      console.error("❌ No SFTP connection found. Run full seed first.");
      process.exit(1);
    }
    console.log("\n📤 Uploading seed media...");
    await uploadSeedMedia(existingConnection, seedConfig);
    console.log("\n✨ Upload completed!");
    return;
  }

  // Clean up existing seed users for idempotency
  await cleanupSeedUsers();

  const passwordHash = await hash(process.env.SEED_PASSWORD!, 10);

  console.log("\n📦 Creating users...");
  const alexId = await createUser(
    "seed@canoncore.com",
    "Alex Demo",
    passwordHash
  );
  const jordanId = await createUser(
    "seed2@canoncore.com",
    "Jordan Test",
    passwordHash
  );
  await createUser("seed3@canoncore.com", "Sam Empty", passwordHash);

  console.log("\n🔌 Creating SFTP connections...");
  const alexConnectionId = await createSftpConnection(alexId);

  // Upload seed media files to SFTP server (before creating database records)
  if (alexConnectionId && !seedConfig.noUpload) {
    console.log("\n📤 Uploading seed media...");
    try {
      // Need to get the full connection object for uploadSeedMedia
      const connection = await prisma.sftpConnection.findUnique({
        where: { id: alexConnectionId },
      });
      if (connection) {
        await uploadSeedMedia(connection, seedConfig);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`  Failed to upload seed media: ${message}`);
      console.error(
        "  Continuing with database seeding (artwork won't display)"
      );
    }
  }

  console.log("\n📁 Creating items and files...");
  await seedAlexDemo(alexId, alexConnectionId, seedConfig);
  await seedJordanTest(jordanId);

  console.log("\n✨ Seed completed successfully!");
  console.log("\n📊 Summary:");
  console.log("  - 10 Movies (51 files)");
  console.log("  - 5 TV Shows, 11 episodes (47 files)");
  console.log("  - 3 Albums (13 files)");
  console.log("  - 1 Empty folder (Documentaries)");
  console.log("  - Total: ~111 files");
  console.log("\n🔐 Login credentials:");
  console.log("  Email: seed@canoncore.com (full data)");
  console.log("  Email: seed2@canoncore.com (minimal data)");
  console.log("  Email: seed3@canoncore.com (empty account)");
  console.log("  Password: (see SEED_PASSWORD in .env.local)");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await closeAllConnections();
    await prisma.$disconnect();
  });
