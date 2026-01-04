/**
 * Database seed script for development/QA.
 * Creates sample users, items, and files for manual exploration.
 *
 * Usage: npx prisma db seed
 *
 * SAFETY: Refuses to run against production databases.
 */

import { PrismaClient, FileType } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcryptjs";
import { config } from "dotenv";

// Load .env.local for local development
config({ path: ".env.local" });

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

// File size constants (in bytes)
const KB = 1024;
const MB = 1024 * KB;
const GB = 1024 * MB;

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
 * Creates an item with optional parent and description.
 */
async function createItem(
  userId: string,
  name: string,
  parentId: string | null,
  order: number,
  depth: number,
  description?: string
): Promise<string> {
  const item = await prisma.item.create({
    data: {
      userId,
      name,
      description: description ?? null,
      parentId,
      order,
      depth,
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

/**
 * Seeds Alex Demo's Movies folder.
 */
async function seedMovies(userId: string): Promise<void> {
  console.log("    📽️  Seeding Movies...");
  const moviesId = await createItem(
    userId,
    "Movies",
    null,
    0,
    0,
    "Feature films and cinema collection."
  );

  // 1. The Shawshank Redemption (1994) - STRESS TEST: 2 media, 3 artwork, 3 subs
  const shawshankId = await createItem(
    userId,
    "The Shawshank Redemption (1994)",
    moviesId,
    0,
    1,
    "Two imprisoned men bond over years, finding solace and redemption."
  );
  const shawshankPath = "/Movies/The Shawshank Redemption (1994)";
  await createFile(
    shawshankId,
    "The.Shawshank.Redemption.1994.1080p.x264.YIFY.mp4",
    shawshankPath,
    FileType.MEDIA,
    "video/mp4",
    BigInt(Math.floor(1.6 * GB)),
    true
  );
  await createFile(
    shawshankId,
    "The.Shawshank.Redemption.1994.2160p.4K.BluRay.x265.10bit.HDR.AAC5.1-[YTS.MX].mkv",
    shawshankPath,
    FileType.MEDIA,
    "video/x-matroska",
    BigInt(Math.floor(6.9 * GB)),
    false
  );
  await createFile(
    shawshankId,
    "poster.jpg",
    shawshankPath,
    FileType.ARTWORK,
    "image/jpeg",
    BigInt(272 * KB),
    true
  );
  await createFile(
    shawshankId,
    "fanart.jpg",
    shawshankPath,
    FileType.ARTWORK,
    "image/jpeg",
    BigInt(177 * KB),
    false
  );
  await createFile(
    shawshankId,
    "banner.jpeg",
    shawshankPath,
    FileType.ARTWORK,
    "image/jpeg",
    BigInt(949 * KB),
    false
  );
  await createFile(
    shawshankId,
    "The.Shawshank.Redemption.1994.en.srt",
    shawshankPath,
    FileType.SUBTITLE,
    "application/x-subrip",
    BigInt(136 * KB),
    true
  );
  await createFile(
    shawshankId,
    "The.Shawshank.Redemption.1994.es.srt",
    shawshankPath,
    FileType.SUBTITLE,
    "application/x-subrip",
    BigInt(122 * KB),
    false
  );
  await createFile(
    shawshankId,
    "The.Shawshank.Redemption.1994.fr.srt",
    shawshankPath,
    FileType.SUBTITLE,
    "application/x-subrip",
    BigInt(112 * KB),
    false
  );

  // 2. Inception (2010) - Single media
  const inceptionId = await createItem(
    userId,
    "Inception (2010)",
    moviesId,
    1,
    1,
    "A thief who steals secrets through dream invasion is offered redemption."
  );
  const inceptionPath = "/Movies/Inception (2010)";
  await createFile(
    inceptionId,
    "Inception.2010.1080p.BrRip.x264.YIFY.mp4",
    inceptionPath,
    FileType.MEDIA,
    "video/mp4",
    BigInt(Math.floor(1.9 * GB)),
    true
  );
  await createFile(
    inceptionId,
    "poster.jpg",
    inceptionPath,
    FileType.ARTWORK,
    "image/jpeg",
    BigInt(305 * KB),
    true
  );
  await createFile(
    inceptionId,
    "fanart.jpg",
    inceptionPath,
    FileType.ARTWORK,
    "image/jpeg",
    BigInt(Math.floor(1.4 * MB)),
    false
  );
  await createFile(
    inceptionId,
    "Inception.2010.en.srt",
    inceptionPath,
    FileType.SUBTITLE,
    "application/x-subrip",
    BigInt(133 * KB),
    true
  );
  await createFile(
    inceptionId,
    "Inception.2010.es.srt",
    inceptionPath,
    FileType.SUBTITLE,
    "application/x-subrip",
    BigInt(75 * KB),
    false
  );

  // 3. Interstellar (2014) - Multiple artwork (4)
  const interstellarId = await createItem(
    userId,
    "Interstellar (2014)",
    moviesId,
    2,
    1,
    "Explorers travel through a wormhole in space to ensure humanity's survival."
  );
  const interstellarPath = "/Movies/Interstellar (2014)";
  await createFile(
    interstellarId,
    "Interstellar.2014.2014.1080p.BluRay.x264.YIFY.mp4",
    interstellarPath,
    FileType.MEDIA,
    "video/mp4",
    BigInt(Math.floor(2.3 * GB)),
    true
  );
  await createFile(
    interstellarId,
    "poster.jpg",
    interstellarPath,
    FileType.ARTWORK,
    "image/jpeg",
    BigInt(816 * KB),
    true
  );
  await createFile(
    interstellarId,
    "fanart.jpg",
    interstellarPath,
    FileType.ARTWORK,
    "image/jpeg",
    BigInt(291 * KB),
    false
  );
  await createFile(
    interstellarId,
    "banner.jpeg",
    interstellarPath,
    FileType.ARTWORK,
    "image/jpeg",
    BigInt(Math.floor(7.1 * KB)),
    false
  );
  await createFile(
    interstellarId,
    "logo.jpg",
    interstellarPath,
    FileType.ARTWORK,
    "image/jpeg",
    BigInt(35 * KB),
    false
  );
  await createFile(
    interstellarId,
    "Interstellar.2014.en.srt",
    interstellarPath,
    FileType.SUBTITLE,
    "application/x-subrip",
    BigInt(150 * KB),
    true
  );

  // 4. The Dark Knight (2008) - Multiple media (theatrical vs IMAX)
  const darkKnightId = await createItem(
    userId,
    "The Dark Knight (2008)",
    moviesId,
    3,
    1,
    "Batman faces the Joker in one of the greatest tests of his abilities."
  );
  const darkKnightPath = "/Movies/The Dark Knight (2008)";
  await createFile(
    darkKnightId,
    "Batman.The.Dark.Knight.2008.1080p.BluRay.x264.YIFY.mp4",
    darkKnightPath,
    FileType.MEDIA,
    "video/mp4",
    BigInt(Math.floor(1.7 * GB)),
    true
  );
  await createFile(
    darkKnightId,
    "The.Dark.Knight.2008.IMAX.1080p.10bit.BluRay.6CH.x265.HEVC-PSA.mkv",
    darkKnightPath,
    FileType.MEDIA,
    "video/x-matroska",
    BigInt(Math.floor(3.5 * GB)),
    false
  );
  await createFile(
    darkKnightId,
    "poster.jpg",
    darkKnightPath,
    FileType.ARTWORK,
    "image/jpeg",
    BigInt(376 * KB),
    true
  );
  await createFile(
    darkKnightId,
    "fanart.webp",
    darkKnightPath,
    FileType.ARTWORK,
    "image/webp",
    BigInt(263 * KB),
    false
  );
  await createFile(
    darkKnightId,
    "The.Dark.Knight.2008.en.srt",
    darkKnightPath,
    FileType.SUBTITLE,
    "application/x-subrip",
    BigInt(139 * KB),
    true
  );

  // 5. Pulp Fiction (1994) - MINIMAL (media only)
  const pulpFictionId = await createItem(
    userId,
    "Pulp Fiction (1994)",
    moviesId,
    4,
    1,
    "The lives of two mob hitmen, a boxer, and others intertwine."
  );
  const pulpFictionPath = "/Movies/Pulp Fiction (1994)";
  await createFile(
    pulpFictionId,
    "Pulp.Fiction.1994.1080p.BrRip.x264.YIFY.mp4",
    pulpFictionPath,
    FileType.MEDIA,
    "video/mp4",
    BigInt(Math.floor(1.4 * GB)),
    true
  );

  // 6. Parasite (2019) - Multiple subtitles (4 languages)
  const parasiteId = await createItem(
    userId,
    "Parasite (2019)",
    moviesId,
    5,
    1,
    "A poor family schemes to infiltrate a wealthy household."
  );
  const parasitePath = "/Movies/Parasite (2019)";
  await createFile(
    parasiteId,
    "Parasite.2019.1080p.BluRay.x264-[YTS.LT].mp4",
    parasitePath,
    FileType.MEDIA,
    "video/mp4",
    BigInt(Math.floor(2.1 * GB)),
    true
  );
  await createFile(
    parasiteId,
    "poster.jpeg",
    parasitePath,
    FileType.ARTWORK,
    "image/jpeg",
    BigInt(10 * KB),
    true
  );
  await createFile(
    parasiteId,
    "fanart.jpg",
    parasitePath,
    FileType.ARTWORK,
    "image/jpeg",
    BigInt(381 * KB),
    false
  );
  await createFile(
    parasiteId,
    "Gisaengchung.2019.en.srt",
    parasitePath,
    FileType.SUBTITLE,
    "application/x-subrip",
    BigInt(114 * KB),
    true
  );
  await createFile(
    parasiteId,
    "Gisaengchung.2019.es.srt",
    parasitePath,
    FileType.SUBTITLE,
    "application/x-subrip",
    BigInt(119 * KB),
    false
  );
  await createFile(
    parasiteId,
    "Gisaengchung.2019.fr.srt",
    parasitePath,
    FileType.SUBTITLE,
    "application/x-subrip",
    BigInt(121 * KB),
    false
  );
  await createFile(
    parasiteId,
    "Gisaengchung.albanian.sq.srt",
    parasitePath,
    FileType.SUBTITLE,
    "application/x-subrip",
    BigInt(115 * KB),
    false
  );

  // 7. Spider-Man No Way Home (2021) - Single files only
  const spidermanId = await createItem(
    userId,
    "Spider-Man No Way Home (2021)",
    moviesId,
    6,
    1,
    "Peter Parker seeks help from Doctor Strange when his identity is revealed."
  );
  const spidermanPath = "/Movies/Spider-Man No Way Home (2021)";
  await createFile(
    spidermanId,
    "Spider-Man.No.Way.Home.2021.1080p.WEBRip.x264.AAC5.1-[YTS.MX].mp4",
    spidermanPath,
    FileType.MEDIA,
    "video/mp4",
    BigInt(Math.floor(2.7 * GB)),
    true
  );
  await createFile(
    spidermanId,
    "poster.jpeg",
    spidermanPath,
    FileType.ARTWORK,
    "image/jpeg",
    BigInt(14 * KB),
    true
  );
  await createFile(
    spidermanId,
    "Spider-Man.No.Way.Home.2021.1080p.WEBRip.x264.AAC5.1-[YTS.MX].srt",
    spidermanPath,
    FileType.SUBTITLE,
    "application/x-subrip",
    BigInt(131 * KB),
    true
  );

  // 8. Dune (2021) - Multiple media (3 versions)
  const duneId = await createItem(
    userId,
    "Dune (2021)",
    moviesId,
    7,
    1,
    "Paul Atreides must travel to the most dangerous planet in the universe."
  );
  const dunePath = "/Movies/Dune (2021)";
  await createFile(
    duneId,
    "Dune.2021.1080p.BluRay.x264.AAC5.1-[YTS.MX].mp4",
    dunePath,
    FileType.MEDIA,
    "video/mp4",
    BigInt(Math.floor(2.9 * GB)),
    true
  );
  await createFile(
    duneId,
    "Dune.2021.2160p.4K.WEB.x265.10bit.HDR.AAC5.1-[YTS.MX].mkv",
    dunePath,
    FileType.MEDIA,
    "video/x-matroska",
    BigInt(Math.floor(6.9 * GB)),
    false
  );
  await createFile(
    duneId,
    "Dune.2021.720p.BluRay.x264.AAC-[YTS.MX].mp4",
    dunePath,
    FileType.MEDIA,
    "video/mp4",
    BigInt(Math.floor(1.4 * GB)),
    false
  );
  await createFile(
    duneId,
    "poster.jpg",
    dunePath,
    FileType.ARTWORK,
    "image/jpeg",
    BigInt(126 * KB),
    true
  );
  await createFile(
    duneId,
    "fanart.jpg",
    dunePath,
    FileType.ARTWORK,
    "image/jpeg",
    BigInt(Math.floor(1.3 * MB)),
    false
  );
  await createFile(
    duneId,
    "Dune.2021.en.srt",
    dunePath,
    FileType.SUBTITLE,
    "application/x-subrip",
    BigInt(83 * KB),
    true
  );
  await createFile(
    duneId,
    "Dune.2021.es.srt",
    dunePath,
    FileType.SUBTITLE,
    "application/x-subrip",
    BigInt(80 * KB),
    false
  );

  // 9. Oppenheimer (2023) - Multiple subtitles (inc. SDH)
  const oppenheimerId = await createItem(
    userId,
    "Oppenheimer (2023)",
    moviesId,
    8,
    1,
    "The story of J. Robert Oppenheimer and the creation of the atomic bomb."
  );
  const oppenheimerPath = "/Movies/Oppenheimer (2023)";
  await createFile(
    oppenheimerId,
    "Oppenheimer.2023.1080p.BluRay.x264.AAC5.1-[YTS.MX].mp4",
    oppenheimerPath,
    FileType.MEDIA,
    "video/mp4",
    BigInt(Math.floor(3.3 * GB)),
    true
  );
  await createFile(
    oppenheimerId,
    "poster.jpg",
    oppenheimerPath,
    FileType.ARTWORK,
    "image/jpeg",
    BigInt(265 * KB),
    true
  );
  await createFile(
    oppenheimerId,
    "fanart.jpeg",
    oppenheimerPath,
    FileType.ARTWORK,
    "image/jpeg",
    BigInt(16 * KB),
    false
  );
  await createFile(
    oppenheimerId,
    "Oppenheimer.English.en.srt",
    oppenheimerPath,
    FileType.SUBTITLE,
    "application/x-subrip",
    BigInt(194 * KB),
    true
  );
  await createFile(
    oppenheimerId,
    "Oppenheimer.English.sdh..en.srt",
    oppenheimerPath,
    FileType.SUBTITLE,
    "application/x-subrip",
    BigInt(265 * KB),
    false
  );
  await createFile(
    oppenheimerId,
    "Oppenheimer.2023.es.srt",
    oppenheimerPath,
    FileType.SUBTITLE,
    "application/x-subrip",
    BigInt(216 * KB),
    false
  );

  // 10. Barbie (2023) - Single files only
  const barbieId = await createItem(
    userId,
    "Barbie (2023)",
    moviesId,
    9,
    1,
    "Barbie suffers a crisis that leads her to question her world and existence."
  );
  const barbiePath = "/Movies/Barbie (2023)";
  await createFile(
    barbieId,
    "Barbie.2023.1080p.BluRay.x264.AAC5.1-[YTS.MX].mp4",
    barbiePath,
    FileType.MEDIA,
    "video/mp4",
    BigInt(Math.floor(2.1 * GB)),
    true
  );
  await createFile(
    barbieId,
    "poster.jpg.webp",
    barbiePath,
    FileType.ARTWORK,
    "image/webp",
    BigInt(216 * KB),
    true
  );
  await createFile(
    barbieId,
    "Barbie.English.en.srt",
    barbiePath,
    FileType.SUBTITLE,
    "application/x-subrip",
    BigInt(153 * KB),
    true
  );
}

/**
 * Seeds Alex Demo's TV Shows folder.
 */
async function seedTVShows(userId: string): Promise<void> {
  console.log("    📺 Seeding TV Shows...");
  const tvId = await createItem(
    userId,
    "TV Shows",
    null,
    1,
    0,
    "Television series and episodic content."
  );

  // Breaking Bad
  const bbId = await createItem(
    userId,
    "Breaking Bad",
    tvId,
    0,
    1,
    "A chemistry teacher turns to manufacturing meth after his cancer diagnosis."
  );

  // Season 1 with artwork
  const bbS1Id = await createItem(
    userId,
    "Season 1",
    bbId,
    0,
    2,
    "Walter White begins his transformation from teacher to drug manufacturer."
  );
  const bbS1Path = "/TV Shows/Breaking Bad/Season 1";
  await createFile(
    bbS1Id,
    "poster.jpg",
    bbS1Path,
    FileType.ARTWORK,
    "image/jpeg",
    BigInt(177 * KB),
    true
  );
  await createFile(
    bbS1Id,
    "fanart.jpg",
    bbS1Path,
    FileType.ARTWORK,
    "image/jpeg",
    BigInt(72 * KB),
    false
  );
  await createFile(
    bbS1Id,
    "banner.jpg",
    bbS1Path,
    FileType.ARTWORK,
    "image/jpeg",
    BigInt(56 * KB),
    false
  );

  // S01E01 - Multiple media + subs
  const bbS1E1Id = await createItem(
    userId,
    "S01E01 - Pilot",
    bbS1Id,
    0,
    3,
    "Diagnosed with cancer, Walter partners with Jesse to cook meth."
  );
  const bbS1E1Path = "/TV Shows/Breaking Bad/Season 1/S01E01 - Pilot";
  await createFile(
    bbS1E1Id,
    "Breaking.Bad.S01E01.1080p.BluRay.x265-RARBG.mp4",
    bbS1E1Path,
    FileType.MEDIA,
    "video/mp4",
    BigInt(927 * MB),
    true
  );
  await createFile(
    bbS1E1Id,
    "Breaking.Bad.S01E01.2160p.NF.WEB-DL.DTS-HD.MA.5.1.HEVC-CRFW.mkv",
    bbS1E1Path,
    FileType.MEDIA,
    "video/x-matroska",
    BigInt(Math.floor(5.8 * GB)),
    false
  );
  await createFile(
    bbS1E1Id,
    "Breaking.Bad.s01e01.en.srt",
    bbS1E1Path,
    FileType.SUBTITLE,
    "application/x-subrip",
    BigInt(48 * KB),
    true
  );
  await createFile(
    bbS1E1Id,
    "Breaking.Bad.S01E01.es.srt",
    bbS1E1Path,
    FileType.SUBTITLE,
    "application/x-subrip",
    BigInt(44 * KB),
    false
  );

  // S01E02 - Single files
  const bbS1E2Id = await createItem(
    userId,
    "S01E02 - Cat's in the Bag",
    bbS1Id,
    1,
    3,
    "Walt and Jesse must deal with the aftermath of their first cook."
  );
  const bbS1E2Path =
    "/TV Shows/Breaking Bad/Season 1/S01E02 - Cat's in the Bag";
  await createFile(
    bbS1E2Id,
    "Breaking.Bad.S01E02.1080p.BluRay.x265-RARBG.mp4",
    bbS1E2Path,
    FileType.MEDIA,
    "video/mp4",
    BigInt(770 * MB),
    true
  );
  await createFile(
    bbS1E2Id,
    "Breaking.Bad.s01e02.en.srt",
    bbS1E2Path,
    FileType.SUBTITLE,
    "application/x-subrip",
    BigInt(48 * KB),
    true
  );

  // S01E03 - Single files
  const bbS1E3Id = await createItem(
    userId,
    "S01E03 - And the Bag's in the River",
    bbS1Id,
    2,
    3,
    "Walter faces a difficult decision about Krazy-8."
  );
  const bbS1E3Path =
    "/TV Shows/Breaking Bad/Season 1/S01E03 - And the Bag's in the River";
  await createFile(
    bbS1E3Id,
    "Breaking.Bad.S01E03.1080p.BluRay.x265-RARBG.mp4",
    bbS1E3Path,
    FileType.MEDIA,
    "video/mp4",
    BigInt(769 * MB),
    true
  );
  await createFile(
    bbS1E3Id,
    "Breaking.Bad.s01e03.en.srt",
    bbS1E3Path,
    FileType.SUBTITLE,
    "application/x-subrip",
    BigInt(48 * KB),
    true
  );

  // Season 2 minimal
  const bbS2Id = await createItem(
    userId,
    "Season 2",
    bbId,
    1,
    2,
    "The consequences of Walt's choices begin to unfold."
  );
  const bbS2Path = "/TV Shows/Breaking Bad/Season 2";
  await createFile(
    bbS2Id,
    "poster.jpg",
    bbS2Path,
    FileType.ARTWORK,
    "image/jpeg",
    BigInt(449 * KB),
    true
  );

  const bbS2E1Id = await createItem(
    userId,
    "S02E01 - Seven Thirty-Seven",
    bbS2Id,
    0,
    3,
    "Walt and Jesse face the aftermath of Tuco's death."
  );
  const bbS2E1Path =
    "/TV Shows/Breaking Bad/Season 2/S02E01 - Seven Thirty-Seven";
  await createFile(
    bbS2E1Id,
    "Breaking.Bad.S02E01.1080p.BluRay.x265-RARBG.mp4",
    bbS2E1Path,
    FileType.MEDIA,
    "video/mp4",
    BigInt(754 * MB),
    true
  );
  await createFile(
    bbS2E1Id,
    "Breaking.Bad.S02E01.en.srt",
    bbS2E1Path,
    FileType.SUBTITLE,
    "application/x-subrip",
    BigInt(33 * KB),
    true
  );

  // Stranger Things
  const stId = await createItem(
    userId,
    "Stranger Things",
    tvId,
    1,
    1,
    "A group of kids encounter supernatural forces in their small town."
  );
  const stS1Id = await createItem(
    userId,
    "Season 1",
    stId,
    0,
    2,
    "The disappearance of Will Byers exposes a dark secret in Hawkins."
  );
  const stS1Path = "/TV Shows/Stranger Things/Season 1";
  await createFile(
    stS1Id,
    "poster.jpg",
    stS1Path,
    FileType.ARTWORK,
    "image/jpeg",
    BigInt(714 * KB),
    true
  );
  await createFile(
    stS1Id,
    "fanart.jpg",
    stS1Path,
    FileType.ARTWORK,
    "image/jpeg",
    BigInt(227 * KB),
    false
  );

  // S01E01 - STRESS TEST
  const stS1E1Id = await createItem(
    userId,
    "S01E01 - The Vanishing of Will Byers",
    stS1Id,
    0,
    3,
    "Will Byers mysteriously disappears, and his friends begin to search."
  );
  const stS1E1Path =
    "/TV Shows/Stranger Things/Season 1/S01E01 - The Vanishing of Will Byers";
  await createFile(
    stS1E1Id,
    "Stranger.Things.S01E01.1080p.BluRay.x264-SHORTBREHD.mkv",
    stS1E1Path,
    FileType.MEDIA,
    "video/x-matroska",
    BigInt(Math.floor(3.3 * GB)),
    true
  );
  await createFile(
    stS1E1Id,
    "Stranger.Things.S01E01.2160p.UHD.BluRay.x265-DEPTH.mkv",
    stS1E1Path,
    FileType.MEDIA,
    "video/x-matroska",
    BigInt(Math.floor(9.0 * GB)),
    false
  );
  await createFile(
    stS1E1Id,
    "thumb.jpg",
    stS1E1Path,
    FileType.ARTWORK,
    "image/jpeg",
    BigInt(Math.floor(8.0 * MB)),
    true
  );
  await createFile(
    stS1E1Id,
    "title.webp",
    stS1E1Path,
    FileType.ARTWORK,
    "image/webp",
    BigInt(Math.floor(1.7 * KB)),
    false
  );
  await createFile(
    stS1E1Id,
    "Stranger.Things.S01E01.1080p.BluRay.x264-SHORTBREHD.sub",
    stS1E1Path,
    FileType.SUBTITLE,
    "application/x-subrip",
    BigInt(Math.floor(4.7 * MB)),
    true
  );
  await createFile(
    stS1E1Id,
    "Stranger.Things.S01E01.es.srt",
    stS1E1Path,
    FileType.SUBTITLE,
    "application/x-subrip",
    BigInt(43 * KB),
    false
  );
  await createFile(
    stS1E1Id,
    "Stranger.Things.S01E01.fr.srt",
    stS1E1Path,
    FileType.SUBTITLE,
    "application/x-subrip",
    BigInt(31 * KB),
    false
  );

  // S01E02-03 - Single files
  const stS1E2Id = await createItem(
    userId,
    "S01E02 - The Weirdo on Maple Street",
    stS1Id,
    1,
    3,
    "The boys discover a strange girl in the woods with unusual abilities."
  );
  await createFile(
    stS1E2Id,
    "Stranger.Things.S01E02.1080p.BluRay.x264-SHORTBREHD.mkv",
    "/TV Shows/Stranger Things/Season 1/S01E02 - The Weirdo on Maple Street",
    FileType.MEDIA,
    "video/x-matroska",
    BigInt(Math.floor(4.4 * GB)),
    true
  );
  await createFile(
    stS1E2Id,
    "Stranger.Things.S01E02.1080p.BluRay.x264-SHORTBREHD.sub",
    "/TV Shows/Stranger Things/Season 1/S01E02 - The Weirdo on Maple Street",
    FileType.SUBTITLE,
    "application/x-subrip",
    BigInt(Math.floor(4.7 * MB)),
    true
  );

  const stS1E3Id = await createItem(
    userId,
    "S01E03 - Holly, Jolly",
    stS1Id,
    2,
    3,
    "Joyce communicates with Will through Christmas lights."
  );
  await createFile(
    stS1E3Id,
    "Stranger.Things.S01E03.1080p.BluRay.x264-SHORTBREHD.mkv",
    "/TV Shows/Stranger Things/Season 1/S01E03 - Holly, Jolly",
    FileType.MEDIA,
    "video/x-matroska",
    BigInt(Math.floor(3.3 * GB)),
    true
  );
  await createFile(
    stS1E3Id,
    "Stranger.Things.S01E03.1080p.BluRay.x264-SHORTBREHD.sub",
    "/TV Shows/Stranger Things/Season 1/S01E03 - Holly, Jolly",
    FileType.SUBTITLE,
    "application/x-subrip",
    BigInt(Math.floor(3.6 * MB)),
    true
  );

  // The Office (UK)
  const officeId = await createItem(
    userId,
    "The Office (UK)",
    tvId,
    2,
    1,
    "The daily lives of office employees at Wernham Hogg paper company."
  );
  const officeS1Id = await createItem(
    userId,
    "Season 1",
    officeId,
    0,
    2,
    "David Brent manages his staff with delusions of being a brilliant boss."
  );
  await createFile(
    officeS1Id,
    "poster.jpg",
    "/TV Shows/The Office (UK)/Season 1",
    FileType.ARTWORK,
    "image/jpeg",
    BigInt(49 * KB),
    true
  );

  const officeS1E1Id = await createItem(
    userId,
    "S01E01 - Pilot",
    officeS1Id,
    0,
    3,
    "Documentary crew begins filming at Wernham Hogg."
  );
  await createFile(
    officeS1E1Id,
    "The.Office.UK.S01E01.1080p.WEBRip.x265-RARBG.mp4",
    "/TV Shows/The Office (UK)/Season 1/S01E01 - Pilot",
    FileType.MEDIA,
    "video/mp4",
    BigInt(474 * MB),
    true
  );
  await createFile(
    officeS1E1Id,
    "2_English.srt",
    "/TV Shows/The Office (UK)/Season 1/S01E01 - Pilot",
    FileType.SUBTITLE,
    "application/x-subrip",
    BigInt(43 * KB),
    true
  );

  // S01E02 - MINIMAL (media only)
  const officeS1E2Id = await createItem(
    userId,
    "S01E02 - Diversity Day",
    officeS1Id,
    1,
    3,
    "David runs a diversity seminar after a corporate memo."
  );
  await createFile(
    officeS1E2Id,
    "The.Office.UK.S01E02.1080p.WEBRip.x265-RARBG.mp4",
    "/TV Shows/The Office (UK)/Season 1/S01E02 - Diversity Day",
    FileType.MEDIA,
    "video/mp4",
    BigInt(470 * MB),
    true
  );

  const officeS1E3Id = await createItem(
    userId,
    "S01E03 - Health Care",
    officeS1Id,
    2,
    3,
    "David tasks Gareth with choosing a health care plan for the office."
  );
  await createFile(
    officeS1E3Id,
    "The.Office.UK.S01E03.1080p.WEBRip.x265-RARBG.mp4",
    "/TV Shows/The Office (UK)/Season 1/S01E03 - Health Care",
    FileType.MEDIA,
    "video/mp4",
    BigInt(474 * MB),
    true
  );
  await createFile(
    officeS1E3Id,
    "2_English.srt",
    "/TV Shows/The Office (UK)/Season 1/S01E03 - Health Care",
    FileType.SUBTITLE,
    "application/x-subrip",
    BigInt(41 * KB),
    true
  );

  // Game of Thrones
  const gotId = await createItem(
    userId,
    "Game of Thrones",
    tvId,
    3,
    1,
    "Noble families vie for control of the Iron Throne of Westeros."
  );
  const gotS1Id = await createItem(
    userId,
    "Season 1",
    gotId,
    0,
    2,
    "Eddard Stark is appointed Hand of the King and uncovers dark secrets."
  );
  const gotS1Path = "/TV Shows/Game of Thrones/Season 1";
  await createFile(
    gotS1Id,
    "poster.jpeg",
    gotS1Path,
    FileType.ARTWORK,
    "image/jpeg",
    BigInt(8 * KB),
    true
  );
  await createFile(
    gotS1Id,
    "fanart.jpg",
    gotS1Path,
    FileType.ARTWORK,
    "image/jpeg",
    BigInt(143 * KB),
    false
  );
  await createFile(
    gotS1Id,
    "banner.jpg",
    gotS1Path,
    FileType.ARTWORK,
    "image/jpeg",
    BigInt(53 * KB),
    false
  );

  // S01E01 - STRESS TEST
  const gotS1E1Id = await createItem(
    userId,
    "S01E01 - Winter Is Coming",
    gotS1Id,
    0,
    3,
    "King Robert arrives at Winterfell to ask Ned to be his Hand."
  );
  const gotS1E1Path =
    "/TV Shows/Game of Thrones/Season 1/S01E01 - Winter Is Coming";
  await createFile(
    gotS1E1Id,
    "Game of Thrones S01E01 1080p BluRay DTS x264-LiNG.mkv",
    gotS1E1Path,
    FileType.MEDIA,
    "video/x-matroska",
    BigInt(Math.floor(8.4 * GB)),
    true
  );
  await createFile(
    gotS1E1Id,
    "Game of Thrones S01E01 Winter Is Coming REPACK 2160p MAX WEB-DL TrueHD 7 1 Atmos DV HDR H 265-Kitsune.mkv",
    gotS1E1Path,
    FileType.MEDIA,
    "video/x-matroska",
    BigInt(Math.floor(11.3 * GB)),
    false
  );
  await createFile(
    gotS1E1Id,
    "thumb.jpg",
    gotS1E1Path,
    FileType.ARTWORK,
    "image/jpeg",
    BigInt(Math.floor(1.3 * MB)),
    true
  );
  await createFile(
    gotS1E1Id,
    "title.jpg",
    gotS1E1Path,
    FileType.ARTWORK,
    "image/jpeg",
    BigInt(55 * KB),
    false
  );
  await createFile(
    gotS1E1Id,
    "Game.of.Thrones.S01E01.en.srt",
    gotS1E1Path,
    FileType.SUBTITLE,
    "application/x-subrip",
    BigInt(44 * KB),
    true
  );
  await createFile(
    gotS1E1Id,
    "Game.of.Thrones.S01E01.es.srt",
    gotS1E1Path,
    FileType.SUBTITLE,
    "application/x-subrip",
    BigInt(37 * KB),
    false
  );
  await createFile(
    gotS1E1Id,
    "Game.of.Thrones.S01E01.fr.srt",
    gotS1E1Path,
    FileType.SUBTITLE,
    "application/x-subrip",
    BigInt(41 * KB),
    false
  );
  await createFile(
    gotS1E1Id,
    "Game.of.Thrones.S01E01.de.srt",
    gotS1E1Path,
    FileType.SUBTITLE,
    "application/x-subrip",
    BigInt(42 * KB),
    false
  );

  // S01E02 - Multiple subtitles
  const gotS1E2Id = await createItem(
    userId,
    "S01E02 - The Kingsroad",
    gotS1Id,
    1,
    3,
    "Ned and his daughters travel to King's Landing with the royal family."
  );
  const gotS1E2Path =
    "/TV Shows/Game of Thrones/Season 1/S01E02 - The Kingsroad";
  await createFile(
    gotS1E2Id,
    "Game of Thrones S01E02 1080p BluRay DTS x264-LiNG.mkv",
    gotS1E2Path,
    FileType.MEDIA,
    "video/x-matroska",
    BigInt(Math.floor(5.6 * GB)),
    true
  );
  await createFile(
    gotS1E2Id,
    "Game.of.Thrones.S01E02.en.srt",
    gotS1E2Path,
    FileType.SUBTITLE,
    "application/x-subrip",
    BigInt(44 * KB),
    true
  );
  await createFile(
    gotS1E2Id,
    "Game.of.Thrones.S01E02.es.srt",
    gotS1E2Path,
    FileType.SUBTITLE,
    "application/x-subrip",
    BigInt(80 * KB),
    false
  );

  // The Mandalorian - EMPTY (no seasons)
  await createItem(
    userId,
    "The Mandalorian",
    tvId,
    4,
    1,
    "A lone bounty hunter makes his way through the outer reaches of the galaxy."
  );
}

/**
 * Seeds Alex Demo's Music folder.
 */
async function seedMusic(userId: string): Promise<void> {
  console.log("    🎵 Seeding Music...");
  const musicId = await createItem(
    userId,
    "Music",
    null,
    2,
    0,
    "Audio albums and music collection."
  );

  // Pink Floyd - The Dark Side of the Moon
  const pinkFloydId = await createItem(
    userId,
    "Pink Floyd - The Dark Side of the Moon",
    musicId,
    0,
    1,
    "1973 progressive rock masterpiece exploring themes of time and mortality."
  );
  const pinkFloydPath = "/Music/Pink Floyd - The Dark Side of the Moon";
  await createFile(
    pinkFloydId,
    "Pink Floyd - The Dark Side of the Moon - 01 - Speak to Me.flac",
    pinkFloydPath,
    FileType.MEDIA,
    "audio/flac",
    BigInt(41 * MB),
    true
  );
  await createFile(
    pinkFloydId,
    "Pink Floyd - The Dark Side of the Moon - 02 - Breathe (in the Air).flac",
    pinkFloydPath,
    FileType.MEDIA,
    "audio/flac",
    BigInt(104 * MB),
    false
  );
  await createFile(
    pinkFloydId,
    "Pink Floyd - The Dark Side of the Moon - 03 - On the Run.flac",
    pinkFloydPath,
    FileType.MEDIA,
    "audio/flac",
    BigInt(131 * MB),
    false
  );
  await createFile(
    pinkFloydId,
    "Pink Floyd - The Dark Side of the Moon - 04 - Time.flac",
    pinkFloydPath,
    FileType.MEDIA,
    "audio/flac",
    BigInt(266 * MB),
    false
  );
  await createFile(
    pinkFloydId,
    "Pink Floyd - The Dark Side of the Moon - 05 - The Great Gig in the Sky.flac",
    pinkFloydPath,
    FileType.MEDIA,
    "audio/flac",
    BigInt(171 * MB),
    false
  );
  await createFile(
    pinkFloydId,
    "cover.jpg",
    pinkFloydPath,
    FileType.ARTWORK,
    "image/jpeg",
    BigInt(23 * KB),
    true
  );
  await createFile(
    pinkFloydId,
    "back.jpg",
    pinkFloydPath,
    FileType.ARTWORK,
    "image/jpeg",
    BigInt(67 * KB),
    false
  );
  await createFile(
    pinkFloydId,
    "cd.webp",
    pinkFloydPath,
    FileType.ARTWORK,
    "image/webp",
    BigInt(220 * KB),
    false
  );

  // Daft Punk - Random Access Memories
  const daftPunkId = await createItem(
    userId,
    "Daft Punk - Random Access Memories",
    musicId,
    1,
    1,
    "2013 Grammy-winning album blending disco and electronic music."
  );
  const daftPunkPath = "/Music/Daft Punk - Random Access Memories";
  await createFile(
    daftPunkId,
    "Daft Punk_Random Access Memories_01-01_Give Life Back to Music.flac",
    daftPunkPath,
    FileType.MEDIA,
    "audio/flac",
    BigInt(30 * MB),
    true
  );
  await createFile(
    daftPunkId,
    "Daft Punk_Random Access Memories_01-02_The Game of Love.flac",
    daftPunkPath,
    FileType.MEDIA,
    "audio/flac",
    BigInt(31 * MB),
    false
  );
  await createFile(
    daftPunkId,
    "Daft Punk_Random Access Memories_01-03_Giorgio by Moroder.flac",
    daftPunkPath,
    FileType.MEDIA,
    "audio/flac",
    BigInt(56 * MB),
    false
  );
  await createFile(
    daftPunkId,
    "cover.jpg",
    daftPunkPath,
    FileType.ARTWORK,
    "image/jpeg",
    BigInt(35 * KB),
    true
  );
  await createFile(
    daftPunkId,
    "fanart.jpg",
    daftPunkPath,
    FileType.ARTWORK,
    "image/jpeg",
    BigInt(121 * KB),
    false
  );

  // Favorites - EMPTY
  await createItem(
    userId,
    "Favorites",
    musicId,
    2,
    1,
    "Your hand-picked favorite tracks."
  );
}

/**
 * Seeds Alex Demo's account with full sample data.
 */
async function seedAlexDemo(userId: string): Promise<void> {
  console.log("  Seeding Alex Demo data...");

  await seedMovies(userId);
  await seedTVShows(userId);
  await seedMusic(userId);

  // Documentaries folder (empty)
  await createItem(
    userId,
    "Documentaries",
    null,
    3,
    0,
    "Collection of documentary films and series."
  );
}

/**
 * Seeds Jordan Test's account with minimal data.
 */
async function seedJordanTest(userId: string): Promise<void> {
  console.log("  Seeding Jordan Test data...");

  await createItem(
    userId,
    "My Files",
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

/**
 * Main seed function.
 */
async function main(): Promise<void> {
  console.log("🌱 Starting database seed...\n");

  validateEnvironment();

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

  console.log("\n📁 Creating items and files...");
  await seedAlexDemo(alexId);
  await seedJordanTest(jordanId);

  console.log("\n✨ Seed completed successfully!");
  console.log("\n📊 Summary:");
  console.log("  - 10 Movies (51 files)");
  console.log("  - 4 TV Shows, 11 episodes (47 files)");
  console.log("  - 2 Albums (13 files)");
  console.log("  - 3 Empty folders");
  console.log("  - Total: ~111 files");
  console.log("\n🔐 Login credentials:");
  console.log("  Email: seed@canoncore.com (full data)");
  console.log("  Email: seed2@canoncore.com (minimal data)");
  console.log("  Email: seed3@canoncore.com (empty account)");
  console.log(`  Password: ${process.env.SEED_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
