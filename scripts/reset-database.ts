/**
 * Database reset script - truncates all tables while preserving schema.
 * Usage: npx tsx scripts/reset-database.ts [env-file]
 * Examples:
 *   npx tsx scripts/reset-database.ts              # Uses .env.local
 *   npx tsx scripts/reset-database.ts production   # Uses .env.production
 */

import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Determine which env file to use
const envArg = process.argv[2];
const envFile = envArg === "production" ? ".env.production" : ".env.local";

// Load environment variables
config({ path: envFile });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error(`ERROR: DATABASE_URL not found in ${envFile}`);
  process.exit(1);
}

async function resetDatabase() {
  console.log(`Environment: ${envFile}`);
  console.log("Database URL:", databaseUrl?.substring(0, 50) + "...");

  const adapter = new PrismaPg({
    connectionString: databaseUrl,
  });

  const prisma = new PrismaClient({ adapter });

  try {
    console.log("Connecting to database...");
    await prisma.$connect();

    console.log("Truncating all tables (CASCADE)...");

    // Use TRUNCATE with CASCADE to handle foreign key constraints
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE "Item", "SftpConnection", "PasswordReset", "User" CASCADE;
    `);

    console.log("✓ All tables truncated successfully");

    // Verify tables are empty
    const userCount = await prisma.user.count();
    const itemCount = await prisma.item.count();
    const connectionCount = await prisma.sftpConnection.count();
    const resetCount = await prisma.passwordReset.count();

    console.log("\nVerification:");
    console.log(`  Users: ${userCount}`);
    console.log(`  Items: ${itemCount}`);
    console.log(`  SFTP Connections: ${connectionCount}`);
    console.log(`  Password Resets: ${resetCount}`);
  } catch (error) {
    console.error("Error resetting database:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

resetDatabase();
