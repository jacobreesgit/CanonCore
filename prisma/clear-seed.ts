/**
 * Clears seed data from the database.
 * Only removes users with seed@canoncore.com pattern.
 *
 * Usage: npx tsx prisma/clear-seed.ts
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "dotenv";

config({ path: ".env.local" });

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

/**
 * Main function to clear seed data from the database.
 * Deletes all seed users which cascades to their items and files.
 */
async function main(): Promise<void> {
  console.log("🧹 Clearing seed data...\n");

  const dbUrl = process.env.DATABASE_URL || "";
  const isSafe =
    dbUrl.includes("development") ||
    dbUrl.includes("localhost") ||
    dbUrl.includes("127.0.0.1") ||
    dbUrl.includes("neondb") ||
    dbUrl.includes("neon.tech");

  if (!isSafe) {
    console.error("❌ Safety check failed - not a development database");
    process.exit(1);
  }

  // Delete seed users (cascades to items and files)
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

  console.log("\n✨ Seed data cleared!");
}

main()
  .catch((e) => {
    console.error("❌ Clear failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
