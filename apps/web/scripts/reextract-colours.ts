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

    // --- Seasons/Episodes: items with poster but no backdrop and no colour ---
    const posterItems = await prisma.item.findMany({
      where: {
        tmdbPosterPath: { not: null },
        tmdbBackdropPath: null,
        dominantColour: null,
      },
      select: {
        id: true,
        name: true,
        tmdbPosterPath: true,
      },
    });

    console.log(
      `\nFound ${posterItems.length} items with poster but no backdrop/colour\n`
    );

    let posterUpdated = 0;
    let posterFailed = 0;

    for (const item of posterItems) {
      const url = `https://image.tmdb.org/t/p/w300${item.tmdbPosterPath}`;
      try {
        const colour = await extractDominantColour(url);
        if (colour) {
          await prisma.item.update({
            where: { id: item.id },
            data: { dominantColour: colour },
          });
          console.log(`  ${item.name}: (none) -> ${colour}`);
          posterUpdated++;
        } else {
          console.log(`  ${item.name}: extraction returned null, skipping`);
          posterFailed++;
        }
      } catch (err) {
        console.log(`  ${item.name}: FAILED - ${err}`);
        posterFailed++;
      }
    }

    console.log(
      `\nPoster items: ${posterUpdated} updated, ${posterFailed} failed`
    );

    // --- Users: hero images without colour ---
    // NOTE: This fetches binary heroImage blobs (up to 2MB each). At current scale
    // this is fine, but for large user bases use cursor-based pagination:
    // prisma.user.findMany({ take: 50, cursor: { id: lastId }, skip: 1 })
    const usersWithHero = await prisma.user.findMany({
      where: {
        heroImage: { not: null },
        dominantColour: null,
      },
      select: {
        id: true,
        name: true,
        heroImage: true,
      },
    });

    console.log(
      `\nFound ${usersWithHero.length} users with hero image but no colour\n`
    );

    let userUpdated = 0;
    let userFailed = 0;

    for (const user of usersWithHero) {
      try {
        const colour = await extractDominantColour(
          Buffer.from(user.heroImage!)
        );
        if (colour) {
          await prisma.user.update({
            where: { id: user.id },
            data: { dominantColour: colour },
          });
          console.log(`  User ${user.name ?? user.id}: (none) -> ${colour}`);
          userUpdated++;
        } else {
          console.log(
            `  User ${user.name ?? user.id}: extraction returned null`
          );
          userFailed++;
        }
      } catch (err) {
        console.log(`  User ${user.name ?? user.id}: FAILED - ${err}`);
        userFailed++;
      }
    }

    console.log(`\nUsers: ${userUpdated} updated, ${userFailed} failed`);

    // --- Playlists: artwork without colour ---
    // NOTE: Same memory consideration as users — binary artworkImage blobs.
    // Use cursor-based pagination for large datasets.
    const playlistsWithArtwork = await prisma.playlist.findMany({
      where: {
        artworkImage: { not: null },
        dominantColour: null,
      },
      select: {
        id: true,
        name: true,
        artworkImage: true,
      },
    });

    console.log(
      `\nFound ${playlistsWithArtwork.length} playlists with artwork but no colour\n`
    );

    let playlistUpdated = 0;
    let playlistFailed = 0;

    for (const playlist of playlistsWithArtwork) {
      try {
        const colour = await extractDominantColour(
          Buffer.from(playlist.artworkImage!)
        );
        if (colour) {
          await prisma.playlist.update({
            where: { id: playlist.id },
            data: { dominantColour: colour },
          });
          console.log(`  Playlist ${playlist.name}: (none) -> ${colour}`);
          playlistUpdated++;
        } else {
          console.log(`  Playlist ${playlist.name}: extraction returned null`);
          playlistFailed++;
        }
      } catch (err) {
        console.log(`  Playlist ${playlist.name}: FAILED - ${err}`);
        playlistFailed++;
      }
    }

    console.log(
      `\nPlaylists: ${playlistUpdated} updated, ${playlistFailed} failed`
    );
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

reextractColours();
