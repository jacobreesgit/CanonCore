/**
 * Re-extracts dominant colours for all items with a TMDB backdrop.
 * Applies the boosted saturation pipeline to update stale values.
 *
 * Usage: npx tsx scripts/reextract-colours.ts [env-file]
 * Examples:
 *   npx tsx scripts/reextract-colours.ts              # Uses .env.local
 *   npx tsx scripts/reextract-colours.ts production   # Uses .env.production
 */

import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { extractDominantColour } from "../lib/colour-extract";

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

async function reextractColours() {
  console.log(`Environment: ${envFile}`);
  console.log("Database URL:", databaseUrl?.substring(0, 50) + "...\n");

  const adapter = new PrismaPg({ connectionString: databaseUrl });
  const prisma = new PrismaClient({ adapter });

  try {
    await prisma.$connect();

    const items = await prisma.item.findMany({
      where: { tmdbBackdropPath: { not: null } },
      select: {
        id: true,
        name: true,
        tmdbBackdropPath: true,
        dominantColour: true,
      },
    });

    console.log(`Found ${items.length} items with TMDB backdrops\n`);

    let updated = 0;
    let failed = 0;

    for (const item of items) {
      const url = `https://image.tmdb.org/t/p/w300${item.tmdbBackdropPath}`;

      try {
        const colour = await extractDominantColour(url);

        if (colour) {
          await prisma.item.update({
            where: { id: item.id },
            data: { dominantColour: colour },
          });
          console.log(
            `  ${item.name}: ${item.dominantColour ?? "(none)"} -> ${colour}`
          );
          updated++;
        } else {
          console.log(`  ${item.name}: extraction returned null, skipping`);
          failed++;
        }
      } catch (err) {
        console.log(`  ${item.name}: FAILED - ${err}`);
        failed++;
      }
    }

    console.log(`\nDone: ${updated} updated, ${failed} failed`);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

reextractColours();
