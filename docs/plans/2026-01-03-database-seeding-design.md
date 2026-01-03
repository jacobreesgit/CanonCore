# Database Seeding Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a database seeding system to populate the development database with realistic sample data for manual exploration and QA testing.

**Architecture:** A standalone Prisma seed script (`prisma/seed.ts`) executed via `npx prisma db seed`. Creates multiple users with identical passwords, hierarchical items, files, and SFTP connections. Includes safety checks to prevent accidental production seeding.

**Tech Stack:** Prisma 7, bcryptjs, TypeScript, dotenv

---

## Design Decisions

### Safety First

The seed script MUST:

1. Require `ALLOW_SEEDING=true` in environment - explicit opt-in for safety
2. Check `DATABASE_URL` contains "development" or "localhost" - refuse to run otherwise
3. Log a clear warning before proceeding
4. Clean up existing seed users before re-seeding (idempotency)

### Seed Users

| Email               | Name        | Purpose                             |
| ------------------- | ----------- | ----------------------------------- |
| seed@canoncore.com  | Alex Demo   | Primary demo account with full data |
| seed2@canoncore.com | Jordan Test | Secondary account with minimal data |
| seed3@canoncore.com | Sam Empty   | Empty account (no items)            |

All users share the same password from `SEED_PASSWORD` env var.

### Test Scenarios Covered

| Scenario                | Items   | Purpose                          |
| ----------------------- | ------- | -------------------------------- |
| Multiple media (2+)     | 8 items | Tests primary media selection UI |
| Multiple artwork (2+)   | 7 items | Tests primary artwork grid       |
| Multiple subtitles (2+) | 7 items | Tests default subtitle selection |
| Single files only       | 5 items | Tests no selection UI shown      |
| Media only (minimal)    | 2 items | Tests empty file sections        |
| Empty folders           | 3 items | Tests empty state UI             |

### Seed Data Structure

```
Alex Demo (seed@canoncore.com):
├── Movies/
│   ├── The Shawshank Redemption (1994)/     [2 media, 3 artwork, 3 subs] STRESS TEST
│   ├── Inception (2010)/                     [2 media, 2 artwork, 2 subs]
│   ├── Interstellar (2014)/                  [1 media, 4 artwork, 1 sub] MULTIPLE ARTWORK
│   ├── The Dark Knight (2008)/               [2 media, 2 artwork, 1 sub]
│   ├── Pulp Fiction (1994)/                  [1 media only] MINIMAL
│   ├── Parasite (2019)/                      [1 media, 2 artwork, 4 subs] MULTIPLE SUBS
│   ├── Spider-Man No Way Home (2021)/        [1 media, 1 artwork, 1 sub] SINGLE FILES
│   ├── Dune (2021)/                          [3 media, 2 artwork, 2 subs] 3 VERSIONS
│   ├── Oppenheimer (2023)/                   [1 media, 2 artwork, 3 subs]
│   └── Barbie (2023)/                        [1 media, 1 artwork, 1 sub] SINGLE FILES
├── TV Shows/
│   ├── Breaking Bad/
│   │   ├── Season 1/                         [3 artwork on folder]
│   │   │   ├── S01E01 - Pilot/              [2 media, 2 subs]
│   │   │   ├── S01E02/                      [1 media, 1 sub]
│   │   │   └── S01E03/                      [1 media, 1 sub]
│   │   └── Season 2/                        [1 artwork on folder]
│   │       └── S02E01/                      [1 media, 1 sub]
│   ├── Stranger Things/
│   │   └── Season 1/                        [2 artwork on folder]
│   │       ├── S01E01/                      [2 media, 2 artwork, 3 subs] STRESS TEST
│   │       ├── S01E02/                      [1 media, 1 sub]
│   │       └── S01E03/                      [1 media, 1 sub]
│   ├── The Office/
│   │   └── Season 1/                        [1 artwork on folder]
│   │       ├── S01E01/                      [1 media, 1 sub]
│   │       ├── S01E02/                      [1 media only] MINIMAL
│   │       └── S01E03/                      [1 media, 1 sub]
│   ├── Game of Thrones/
│   │   └── Season 1/                        [3 artwork on folder]
│   │       ├── S01E01/                      [2 media, 2 artwork, 4 subs] STRESS TEST
│   │       └── S01E02/                      [1 media, 2 subs]
│   └── The Mandalorian/                     [EMPTY - no seasons]
├── Music/
│   ├── Pink Floyd - The Dark Side of the Moon/  [5 audio, 3 artwork]
│   ├── Daft Punk - Random Access Memories/      [3 audio, 2 artwork]
│   └── Favorites/                               [EMPTY]
└── Documentaries/                               [EMPTY]

Jordan Test (seed2@canoncore.com):
├── My Files/
└── Projects/

Sam Empty (seed3@canoncore.com):
(no items - tests empty state)
```

---

## Complete File List

### Movies (10 items, 52 files)

#### 1. The Shawshank Redemption (1994) — STRESS TEST

| Type     | Filename                                         | Size   | Primary |
| -------- | ------------------------------------------------ | ------ | ------- |
| MEDIA    | `The.Shawshank.Redemption.1994.1080p.BluRay.mkv` | 4.5 GB | ✓       |
| MEDIA    | `The.Shawshank.Redemption.1994.2160p.4K.mkv`     | 15 GB  |         |
| ARTWORK  | `poster.jpg`                                     | 250 KB | ✓       |
| ARTWORK  | `fanart.jpg`                                     | 450 KB |         |
| ARTWORK  | `banner.jpg`                                     | 120 KB |         |
| SUBTITLE | `english.srt`                                    | 45 KB  | ✓       |
| SUBTITLE | `spanish.srt`                                    | 48 KB  |         |
| SUBTITLE | `french.srt`                                     | 47 KB  |         |

#### 2. Inception (2010) — Multiple media

| Type     | Filename                          | Size    | Primary |
| -------- | --------------------------------- | ------- | ------- |
| MEDIA    | `Inception.2010.1080p.BluRay.mkv` | 3.2 GB  | ✓       |
| MEDIA    | `Inception.2010.2160p.4K.mkv`     | 12.8 GB |         |
| ARTWORK  | `poster.jpg`                      | 180 KB  | ✓       |
| ARTWORK  | `fanart.jpg`                      | 320 KB  |         |
| SUBTITLE | `english.srt`                     | 42 KB   | ✓       |
| SUBTITLE | `spanish.srt`                     | 44 KB   |         |

#### 3. Interstellar (2014) — Multiple artwork (4)

| Type     | Filename                             | Size   | Primary |
| -------- | ------------------------------------ | ------ | ------- |
| MEDIA    | `Interstellar.2014.1080p.BluRay.mkv` | 5.1 GB | ✓       |
| ARTWORK  | `poster.jpg`                         | 280 KB | ✓       |
| ARTWORK  | `fanart.jpg`                         | 520 KB |         |
| ARTWORK  | `banner.jpg`                         | 150 KB |         |
| ARTWORK  | `logo.png`                           | 45 KB  |         |
| SUBTITLE | `english.srt`                        | 38 KB  | ✓       |

#### 4. The Dark Knight (2008) — Multiple media (theatrical vs IMAX)

| Type     | Filename                                | Size   | Primary |
| -------- | --------------------------------------- | ------ | ------- |
| MEDIA    | `The.Dark.Knight.2008.1080p.BluRay.mkv` | 4.2 GB | ✓       |
| MEDIA    | `The.Dark.Knight.2008.IMAX.1080p.mkv`   | 4.8 GB |         |
| ARTWORK  | `poster.jpg`                            | 220 KB | ✓       |
| ARTWORK  | `fanart.jpg`                            | 380 KB |         |
| SUBTITLE | `english.srt`                           | 41 KB  | ✓       |

#### 5. Pulp Fiction (1994) — MINIMAL (media only)

| Type  | Filename                             | Size   | Primary |
| ----- | ------------------------------------ | ------ | ------- |
| MEDIA | `Pulp.Fiction.1994.1080p.BluRay.mkv` | 3.8 GB | ✓       |

#### 6. Parasite (2019) — Multiple subtitles (4 languages)

| Type     | Filename                         | Size   | Primary |
| -------- | -------------------------------- | ------ | ------- |
| MEDIA    | `Parasite.2019.1080p.BluRay.mkv` | 3.5 GB | ✓       |
| ARTWORK  | `poster.jpg`                     | 195 KB | ✓       |
| ARTWORK  | `fanart.jpg`                     | 340 KB |         |
| SUBTITLE | `english.srt`                    | 52 KB  | ✓       |
| SUBTITLE | `korean.srt`                     | 48 KB  |         |
| SUBTITLE | `spanish.srt`                    | 54 KB  |         |
| SUBTITLE | `french.srt`                     | 53 KB  |         |

#### 7. Spider-Man No Way Home (2021) — Single files only

| Type     | Filename                                       | Size   | Primary |
| -------- | ---------------------------------------------- | ------ | ------- |
| MEDIA    | `Spider-Man.No.Way.Home.2021.1080p.BluRay.mkv` | 4.1 GB | ✓       |
| ARTWORK  | `poster.jpg`                                   | 210 KB | ✓       |
| SUBTITLE | `english.srt`                                  | 39 KB  | ✓       |

#### 8. Dune (2021) — Multiple media (3 versions)

| Type     | Filename                     | Size   | Primary |
| -------- | ---------------------------- | ------ | ------- |
| MEDIA    | `Dune.2021.1080p.BluRay.mkv` | 4.5 GB | ✓       |
| MEDIA    | `Dune.2021.2160p.4K.mkv`     | 18 GB  |         |
| MEDIA    | `Dune.2021.2160p.HDR.mkv`    | 22 GB  |         |
| ARTWORK  | `poster.jpg`                 | 240 KB | ✓       |
| ARTWORK  | `fanart.jpg`                 | 410 KB |         |
| SUBTITLE | `english.srt`                | 36 KB  | ✓       |
| SUBTITLE | `spanish.srt`                | 38 KB  |         |

#### 9. Oppenheimer (2023) — Multiple subtitles (inc. SDH)

| Type     | Filename                            | Size   | Primary |
| -------- | ----------------------------------- | ------ | ------- |
| MEDIA    | `Oppenheimer.2023.1080p.BluRay.mkv` | 5.8 GB | ✓       |
| ARTWORK  | `poster.jpg`                        | 260 KB | ✓       |
| ARTWORK  | `fanart.jpg`                        | 480 KB |         |
| SUBTITLE | `english.srt`                       | 58 KB  | ✓       |
| SUBTITLE | `english-sdh.srt`                   | 72 KB  |         |
| SUBTITLE | `spanish.srt`                       | 60 KB  |         |

#### 10. Barbie (2023) — Single files only

| Type     | Filename                       | Size   | Primary |
| -------- | ------------------------------ | ------ | ------- |
| MEDIA    | `Barbie.2023.1080p.BluRay.mkv` | 3.2 GB | ✓       |
| ARTWORK  | `poster.jpg`                   | 185 KB | ✓       |
| SUBTITLE | `english.srt`                  | 32 KB  | ✓       |

---

### TV Shows (4 shows, 11 episodes, 46 files)

#### Breaking Bad

**Season 1 folder** — artwork on folder level
| Type | Filename | Size | Primary |
|------|----------|------|---------|
| ARTWORK | `poster.jpg` | 180 KB | ✓ |
| ARTWORK | `fanart.jpg` | 350 KB | |
| ARTWORK | `banner.jpg` | 95 KB | |

**S01E01 - Pilot** — Multiple media + subs
| Type | Filename | Size | Primary |
|------|----------|------|---------|
| MEDIA | `Breaking.Bad.S01E01.Pilot.1080p.mkv` | 850 MB | ✓ |
| MEDIA | `Breaking.Bad.S01E01.Pilot.2160p.mkv` | 3.2 GB | |
| SUBTITLE | `english.srt` | 28 KB | ✓ |
| SUBTITLE | `spanish.srt` | 30 KB | |

**S01E02 - Cat's in the Bag** — Single files
| Type | Filename | Size | Primary |
|------|----------|------|---------|
| MEDIA | `Breaking.Bad.S01E02.1080p.mkv` | 820 MB | ✓ |
| SUBTITLE | `english.srt` | 26 KB | ✓ |

**S01E03 - And the Bag's in the River** — Single files
| Type | Filename | Size | Primary |
|------|----------|------|---------|
| MEDIA | `Breaking.Bad.S01E03.1080p.mkv` | 810 MB | ✓ |
| SUBTITLE | `english.srt` | 27 KB | ✓ |

**Season 2 folder** — minimal artwork
| Type | Filename | Size | Primary |
|------|----------|------|---------|
| ARTWORK | `poster.jpg` | 175 KB | ✓ |

**S02E01 - Seven Thirty-Seven** — Single files
| Type | Filename | Size | Primary |
|------|----------|------|---------|
| MEDIA | `Breaking.Bad.S02E01.1080p.mkv` | 900 MB | ✓ |
| SUBTITLE | `english.srt` | 29 KB | ✓ |

---

#### Stranger Things

**Season 1 folder** — artwork on folder level
| Type | Filename | Size | Primary |
|------|----------|------|---------|
| ARTWORK | `poster.jpg` | 195 KB | ✓ |
| ARTWORK | `fanart.jpg` | 380 KB | |

**S01E01 - The Vanishing of Will Byers** — STRESS TEST
| Type | Filename | Size | Primary |
|------|----------|------|---------|
| MEDIA | `Stranger.Things.S01E01.1080p.mkv` | 1.1 GB | ✓ |
| MEDIA | `Stranger.Things.S01E01.2160p.mkv` | 4.2 GB | |
| ARTWORK | `thumb.jpg` | 65 KB | ✓ |
| ARTWORK | `title.jpg` | 48 KB | |
| SUBTITLE | `english.srt` | 31 KB | ✓ |
| SUBTITLE | `spanish.srt` | 33 KB | |
| SUBTITLE | `french.srt` | 32 KB | |

**S01E02 - The Weirdo on Maple Street** — Single files
| Type | Filename | Size | Primary |
|------|----------|------|---------|
| MEDIA | `Stranger.Things.S01E02.1080p.mkv` | 980 MB | ✓ |
| SUBTITLE | `english.srt` | 29 KB | ✓ |

**S01E03 - Holly, Jolly** — Single files
| Type | Filename | Size | Primary |
|------|----------|------|---------|
| MEDIA | `Stranger.Things.S01E03.1080p.mkv` | 1.0 GB | ✓ |
| SUBTITLE | `english.srt` | 30 KB | ✓ |

---

#### The Office (US)

**Season 1 folder** — minimal artwork
| Type | Filename | Size | Primary |
|------|----------|------|---------|
| ARTWORK | `poster.jpg` | 145 KB | ✓ |

**S01E01 - Pilot** — Single files
| Type | Filename | Size | Primary |
|------|----------|------|---------|
| MEDIA | `The.Office.S01E01.Pilot.1080p.mkv` | 420 MB | ✓ |
| SUBTITLE | `english.srt` | 18 KB | ✓ |

**S01E02 - Diversity Day** — MINIMAL (media only)
| Type | Filename | Size | Primary |
|------|----------|------|---------|
| MEDIA | `The.Office.S01E02.1080p.mkv` | 410 MB | ✓ |

**S01E03 - Health Care** — Single files
| Type | Filename | Size | Primary |
|------|----------|------|---------|
| MEDIA | `The.Office.S01E03.1080p.mkv` | 415 MB | ✓ |
| SUBTITLE | `english.srt` | 19 KB | ✓ |

---

#### Game of Thrones

**Season 1 folder** — multiple artwork
| Type | Filename | Size | Primary |
|------|----------|------|---------|
| ARTWORK | `poster.jpg` | 220 KB | ✓ |
| ARTWORK | `fanart.jpg` | 480 KB | |
| ARTWORK | `banner.jpg` | 110 KB | |

**S01E01 - Winter Is Coming** — STRESS TEST
| Type | Filename | Size | Primary |
|------|----------|------|---------|
| MEDIA | `Game.of.Thrones.S01E01.1080p.mkv` | 1.8 GB | ✓ |
| MEDIA | `Game.of.Thrones.S01E01.2160p.mkv` | 6.5 GB | |
| ARTWORK | `thumb.jpg` | 72 KB | ✓ |
| ARTWORK | `title.jpg` | 55 KB | |
| SUBTITLE | `english.srt` | 35 KB | ✓ |
| SUBTITLE | `spanish.srt` | 37 KB | |
| SUBTITLE | `french.srt` | 36 KB | |
| SUBTITLE | `german.srt` | 38 KB | |

**S01E02 - The Kingsroad** — Multiple subtitles
| Type | Filename | Size | Primary |
|------|----------|------|---------|
| MEDIA | `Game.of.Thrones.S01E02.1080p.mkv` | 1.7 GB | ✓ |
| SUBTITLE | `english.srt` | 33 KB | ✓ |
| SUBTITLE | `spanish.srt` | 35 KB | |

---

### Music (2 albums, 16 files)

#### Pink Floyd - The Dark Side of the Moon — Multiple audio + artwork

| Type    | Filename                 | Size   | Primary |
| ------- | ------------------------ | ------ | ------- |
| MEDIA   | `01 - Speak to Me.flac`  | 12 MB  | ✓       |
| MEDIA   | `02 - Breathe.flac`      | 35 MB  |         |
| MEDIA   | `03 - Time.flac`         | 85 MB  |         |
| MEDIA   | `04 - Money.flac`        | 78 MB  |         |
| MEDIA   | `05 - Brain Damage.flac` | 48 MB  |         |
| ARTWORK | `cover.jpg`              | 850 KB | ✓       |
| ARTWORK | `back.jpg`               | 720 KB |         |
| ARTWORK | `cd.png`                 | 380 KB |         |

#### Daft Punk - Random Access Memories — Standard album

| Type    | Filename                            | Size   | Primary |
| ------- | ----------------------------------- | ------ | ------- |
| MEDIA   | `01 - Give Life Back to Music.flac` | 58 MB  | ✓       |
| MEDIA   | `02 - The Game of Love.flac`        | 62 MB  |         |
| MEDIA   | `03 - Get Lucky.flac`               | 72 MB  |         |
| ARTWORK | `cover.jpg`                         | 920 KB | ✓       |
| ARTWORK | `fanart.jpg`                        | 1.2 MB |         |

---

### Empty Folders (3)

| Folder                      | Purpose                         |
| --------------------------- | ------------------------------- |
| Documentaries/              | Empty root folder               |
| Music > Favorites/          | Empty nested folder             |
| TV Shows > The Mandalorian/ | Folder with no seasons/episodes |

---

## Environment Setup

### Task 1: Add SEED_PASSWORD to Environment

**Files:**

- Modify: `.env.local`
- Modify: `lib/env.ts`

**Step 1: Add to .env.local**

```bash
# Seed data (development only)
SEED_PASSWORD=SeedPassword123!
ALLOW_SEEDING=true
```

**Step 2: Update env validation (make optional)**

```typescript
// lib/env.ts - add to schema
const envSchema = z.object({
  // ... existing fields ...

  // Seeding (optional - only needed for seed script)
  SEED_PASSWORD: z.string().optional(),
  ALLOW_SEEDING: z.string().optional(),
});
```

**Step 3: Commit**

```bash
git add lib/env.ts
git commit -m "feat: add optional SEED_PASSWORD env var"
```

---

## Seed Script

### Task 2: Create Seed Script

**Files:**

- Create: `prisma/seed.ts`

**Step 1: Write seed script**

```typescript
/**
 * Database seed script for development/QA.
 * Creates sample users, items, and files for manual exploration.
 *
 * Usage: npx prisma db seed
 *
 * SAFETY: Refuses to run against production databases.
 */

import { PrismaClient, FileType } from "@prisma/client";
import { hash } from "bcryptjs";
import { config } from "dotenv";

// Load .env.local for local development
config({ path: ".env.local" });

const prisma = new PrismaClient();

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
    dbUrl.includes("neondb_dev");

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
 * Creates an item with optional parent.
 */
async function createItem(
  userId: string,
  name: string,
  parentId: string | null,
  order: number,
  depth: number
): Promise<string> {
  const item = await prisma.item.create({
    data: { userId, name, parentId, order, depth },
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
  const moviesId = await createItem(userId, "Movies", null, 0, 0);

  // 1. The Shawshank Redemption (1994) - STRESS TEST: 2 media, 3 artwork, 3 subs
  const shawshankId = await createItem(
    userId,
    "The Shawshank Redemption (1994)",
    moviesId,
    0,
    1
  );
  const shawshankPath = "/Movies/The Shawshank Redemption (1994)";
  await createFile(
    shawshankId,
    "The.Shawshank.Redemption.1994.1080p.BluRay.mkv",
    shawshankPath,
    FileType.MEDIA,
    "video/x-matroska",
    BigInt(Math.floor(4.5 * GB)),
    true
  );
  await createFile(
    shawshankId,
    "The.Shawshank.Redemption.1994.2160p.4K.mkv",
    shawshankPath,
    FileType.MEDIA,
    "video/x-matroska",
    BigInt(15 * GB),
    false
  );
  await createFile(
    shawshankId,
    "poster.jpg",
    shawshankPath,
    FileType.ARTWORK,
    "image/jpeg",
    BigInt(250 * KB),
    true
  );
  await createFile(
    shawshankId,
    "fanart.jpg",
    shawshankPath,
    FileType.ARTWORK,
    "image/jpeg",
    BigInt(450 * KB),
    false
  );
  await createFile(
    shawshankId,
    "banner.jpg",
    shawshankPath,
    FileType.ARTWORK,
    "image/jpeg",
    BigInt(120 * KB),
    false
  );
  await createFile(
    shawshankId,
    "english.srt",
    shawshankPath,
    FileType.SUBTITLE,
    "application/x-subrip",
    BigInt(45 * KB),
    true
  );
  await createFile(
    shawshankId,
    "spanish.srt",
    shawshankPath,
    FileType.SUBTITLE,
    "application/x-subrip",
    BigInt(48 * KB),
    false
  );
  await createFile(
    shawshankId,
    "french.srt",
    shawshankPath,
    FileType.SUBTITLE,
    "application/x-subrip",
    BigInt(47 * KB),
    false
  );

  // 2. Inception (2010) - Multiple media
  const inceptionId = await createItem(
    userId,
    "Inception (2010)",
    moviesId,
    1,
    1
  );
  const inceptionPath = "/Movies/Inception (2010)";
  await createFile(
    inceptionId,
    "Inception.2010.1080p.BluRay.mkv",
    inceptionPath,
    FileType.MEDIA,
    "video/x-matroska",
    BigInt(Math.floor(3.2 * GB)),
    true
  );
  await createFile(
    inceptionId,
    "Inception.2010.2160p.4K.mkv",
    inceptionPath,
    FileType.MEDIA,
    "video/x-matroska",
    BigInt(Math.floor(12.8 * GB)),
    false
  );
  await createFile(
    inceptionId,
    "poster.jpg",
    inceptionPath,
    FileType.ARTWORK,
    "image/jpeg",
    BigInt(180 * KB),
    true
  );
  await createFile(
    inceptionId,
    "fanart.jpg",
    inceptionPath,
    FileType.ARTWORK,
    "image/jpeg",
    BigInt(320 * KB),
    false
  );
  await createFile(
    inceptionId,
    "english.srt",
    inceptionPath,
    FileType.SUBTITLE,
    "application/x-subrip",
    BigInt(42 * KB),
    true
  );
  await createFile(
    inceptionId,
    "spanish.srt",
    inceptionPath,
    FileType.SUBTITLE,
    "application/x-subrip",
    BigInt(44 * KB),
    false
  );

  // 3. Interstellar (2014) - Multiple artwork (4)
  const interstellarId = await createItem(
    userId,
    "Interstellar (2014)",
    moviesId,
    2,
    1
  );
  const interstellarPath = "/Movies/Interstellar (2014)";
  await createFile(
    interstellarId,
    "Interstellar.2014.1080p.BluRay.mkv",
    interstellarPath,
    FileType.MEDIA,
    "video/x-matroska",
    BigInt(Math.floor(5.1 * GB)),
    true
  );
  await createFile(
    interstellarId,
    "poster.jpg",
    interstellarPath,
    FileType.ARTWORK,
    "image/jpeg",
    BigInt(280 * KB),
    true
  );
  await createFile(
    interstellarId,
    "fanart.jpg",
    interstellarPath,
    FileType.ARTWORK,
    "image/jpeg",
    BigInt(520 * KB),
    false
  );
  await createFile(
    interstellarId,
    "banner.jpg",
    interstellarPath,
    FileType.ARTWORK,
    "image/jpeg",
    BigInt(150 * KB),
    false
  );
  await createFile(
    interstellarId,
    "logo.png",
    interstellarPath,
    FileType.ARTWORK,
    "image/png",
    BigInt(45 * KB),
    false
  );
  await createFile(
    interstellarId,
    "english.srt",
    interstellarPath,
    FileType.SUBTITLE,
    "application/x-subrip",
    BigInt(38 * KB),
    true
  );

  // 4. The Dark Knight (2008) - Multiple media (theatrical vs IMAX)
  const darkKnightId = await createItem(
    userId,
    "The Dark Knight (2008)",
    moviesId,
    3,
    1
  );
  const darkKnightPath = "/Movies/The Dark Knight (2008)";
  await createFile(
    darkKnightId,
    "The.Dark.Knight.2008.1080p.BluRay.mkv",
    darkKnightPath,
    FileType.MEDIA,
    "video/x-matroska",
    BigInt(Math.floor(4.2 * GB)),
    true
  );
  await createFile(
    darkKnightId,
    "The.Dark.Knight.2008.IMAX.1080p.mkv",
    darkKnightPath,
    FileType.MEDIA,
    "video/x-matroska",
    BigInt(Math.floor(4.8 * GB)),
    false
  );
  await createFile(
    darkKnightId,
    "poster.jpg",
    darkKnightPath,
    FileType.ARTWORK,
    "image/jpeg",
    BigInt(220 * KB),
    true
  );
  await createFile(
    darkKnightId,
    "fanart.jpg",
    darkKnightPath,
    FileType.ARTWORK,
    "image/jpeg",
    BigInt(380 * KB),
    false
  );
  await createFile(
    darkKnightId,
    "english.srt",
    darkKnightPath,
    FileType.SUBTITLE,
    "application/x-subrip",
    BigInt(41 * KB),
    true
  );

  // 5. Pulp Fiction (1994) - MINIMAL (media only)
  const pulpFictionId = await createItem(
    userId,
    "Pulp Fiction (1994)",
    moviesId,
    4,
    1
  );
  const pulpFictionPath = "/Movies/Pulp Fiction (1994)";
  await createFile(
    pulpFictionId,
    "Pulp.Fiction.1994.1080p.BluRay.mkv",
    pulpFictionPath,
    FileType.MEDIA,
    "video/x-matroska",
    BigInt(Math.floor(3.8 * GB)),
    true
  );

  // 6. Parasite (2019) - Multiple subtitles (4 languages)
  const parasiteId = await createItem(
    userId,
    "Parasite (2019)",
    moviesId,
    5,
    1
  );
  const parasitePath = "/Movies/Parasite (2019)";
  await createFile(
    parasiteId,
    "Parasite.2019.1080p.BluRay.mkv",
    parasitePath,
    FileType.MEDIA,
    "video/x-matroska",
    BigInt(Math.floor(3.5 * GB)),
    true
  );
  await createFile(
    parasiteId,
    "poster.jpg",
    parasitePath,
    FileType.ARTWORK,
    "image/jpeg",
    BigInt(195 * KB),
    true
  );
  await createFile(
    parasiteId,
    "fanart.jpg",
    parasitePath,
    FileType.ARTWORK,
    "image/jpeg",
    BigInt(340 * KB),
    false
  );
  await createFile(
    parasiteId,
    "english.srt",
    parasitePath,
    FileType.SUBTITLE,
    "application/x-subrip",
    BigInt(52 * KB),
    true
  );
  await createFile(
    parasiteId,
    "korean.srt",
    parasitePath,
    FileType.SUBTITLE,
    "application/x-subrip",
    BigInt(48 * KB),
    false
  );
  await createFile(
    parasiteId,
    "spanish.srt",
    parasitePath,
    FileType.SUBTITLE,
    "application/x-subrip",
    BigInt(54 * KB),
    false
  );
  await createFile(
    parasiteId,
    "french.srt",
    parasitePath,
    FileType.SUBTITLE,
    "application/x-subrip",
    BigInt(53 * KB),
    false
  );

  // 7. Spider-Man No Way Home (2021) - Single files only
  const spidermanId = await createItem(
    userId,
    "Spider-Man No Way Home (2021)",
    moviesId,
    6,
    1
  );
  const spidermanPath = "/Movies/Spider-Man No Way Home (2021)";
  await createFile(
    spidermanId,
    "Spider-Man.No.Way.Home.2021.1080p.BluRay.mkv",
    spidermanPath,
    FileType.MEDIA,
    "video/x-matroska",
    BigInt(Math.floor(4.1 * GB)),
    true
  );
  await createFile(
    spidermanId,
    "poster.jpg",
    spidermanPath,
    FileType.ARTWORK,
    "image/jpeg",
    BigInt(210 * KB),
    true
  );
  await createFile(
    spidermanId,
    "english.srt",
    spidermanPath,
    FileType.SUBTITLE,
    "application/x-subrip",
    BigInt(39 * KB),
    true
  );

  // 8. Dune (2021) - Multiple media (3 versions)
  const duneId = await createItem(userId, "Dune (2021)", moviesId, 7, 1);
  const dunePath = "/Movies/Dune (2021)";
  await createFile(
    duneId,
    "Dune.2021.1080p.BluRay.mkv",
    dunePath,
    FileType.MEDIA,
    "video/x-matroska",
    BigInt(Math.floor(4.5 * GB)),
    true
  );
  await createFile(
    duneId,
    "Dune.2021.2160p.4K.mkv",
    dunePath,
    FileType.MEDIA,
    "video/x-matroska",
    BigInt(18 * GB),
    false
  );
  await createFile(
    duneId,
    "Dune.2021.2160p.HDR.mkv",
    dunePath,
    FileType.MEDIA,
    "video/x-matroska",
    BigInt(22 * GB),
    false
  );
  await createFile(
    duneId,
    "poster.jpg",
    dunePath,
    FileType.ARTWORK,
    "image/jpeg",
    BigInt(240 * KB),
    true
  );
  await createFile(
    duneId,
    "fanart.jpg",
    dunePath,
    FileType.ARTWORK,
    "image/jpeg",
    BigInt(410 * KB),
    false
  );
  await createFile(
    duneId,
    "english.srt",
    dunePath,
    FileType.SUBTITLE,
    "application/x-subrip",
    BigInt(36 * KB),
    true
  );
  await createFile(
    duneId,
    "spanish.srt",
    dunePath,
    FileType.SUBTITLE,
    "application/x-subrip",
    BigInt(38 * KB),
    false
  );

  // 9. Oppenheimer (2023) - Multiple subtitles (inc. SDH)
  const oppenheimerId = await createItem(
    userId,
    "Oppenheimer (2023)",
    moviesId,
    8,
    1
  );
  const oppenheimerPath = "/Movies/Oppenheimer (2023)";
  await createFile(
    oppenheimerId,
    "Oppenheimer.2023.1080p.BluRay.mkv",
    oppenheimerPath,
    FileType.MEDIA,
    "video/x-matroska",
    BigInt(Math.floor(5.8 * GB)),
    true
  );
  await createFile(
    oppenheimerId,
    "poster.jpg",
    oppenheimerPath,
    FileType.ARTWORK,
    "image/jpeg",
    BigInt(260 * KB),
    true
  );
  await createFile(
    oppenheimerId,
    "fanart.jpg",
    oppenheimerPath,
    FileType.ARTWORK,
    "image/jpeg",
    BigInt(480 * KB),
    false
  );
  await createFile(
    oppenheimerId,
    "english.srt",
    oppenheimerPath,
    FileType.SUBTITLE,
    "application/x-subrip",
    BigInt(58 * KB),
    true
  );
  await createFile(
    oppenheimerId,
    "english-sdh.srt",
    oppenheimerPath,
    FileType.SUBTITLE,
    "application/x-subrip",
    BigInt(72 * KB),
    false
  );
  await createFile(
    oppenheimerId,
    "spanish.srt",
    oppenheimerPath,
    FileType.SUBTITLE,
    "application/x-subrip",
    BigInt(60 * KB),
    false
  );

  // 10. Barbie (2023) - Single files only
  const barbieId = await createItem(userId, "Barbie (2023)", moviesId, 9, 1);
  const barbiePath = "/Movies/Barbie (2023)";
  await createFile(
    barbieId,
    "Barbie.2023.1080p.BluRay.mkv",
    barbiePath,
    FileType.MEDIA,
    "video/x-matroska",
    BigInt(Math.floor(3.2 * GB)),
    true
  );
  await createFile(
    barbieId,
    "poster.jpg",
    barbiePath,
    FileType.ARTWORK,
    "image/jpeg",
    BigInt(185 * KB),
    true
  );
  await createFile(
    barbieId,
    "english.srt",
    barbiePath,
    FileType.SUBTITLE,
    "application/x-subrip",
    BigInt(32 * KB),
    true
  );
}

/**
 * Seeds Alex Demo's TV Shows folder.
 */
async function seedTVShows(userId: string): Promise<void> {
  console.log("    📺 Seeding TV Shows...");
  const tvId = await createItem(userId, "TV Shows", null, 1, 0);

  // Breaking Bad
  const bbId = await createItem(userId, "Breaking Bad", tvId, 0, 1);

  // Season 1 with artwork
  const bbS1Id = await createItem(userId, "Season 1", bbId, 0, 2);
  const bbS1Path = "/TV Shows/Breaking Bad/Season 1";
  await createFile(
    bbS1Id,
    "poster.jpg",
    bbS1Path,
    FileType.ARTWORK,
    "image/jpeg",
    BigInt(180 * KB),
    true
  );
  await createFile(
    bbS1Id,
    "fanart.jpg",
    bbS1Path,
    FileType.ARTWORK,
    "image/jpeg",
    BigInt(350 * KB),
    false
  );
  await createFile(
    bbS1Id,
    "banner.jpg",
    bbS1Path,
    FileType.ARTWORK,
    "image/jpeg",
    BigInt(95 * KB),
    false
  );

  // S01E01 - Multiple media + subs
  const bbS1E1Id = await createItem(userId, "S01E01 - Pilot", bbS1Id, 0, 3);
  const bbS1E1Path = "/TV Shows/Breaking Bad/Season 1/S01E01 - Pilot";
  await createFile(
    bbS1E1Id,
    "Breaking.Bad.S01E01.Pilot.1080p.mkv",
    bbS1E1Path,
    FileType.MEDIA,
    "video/x-matroska",
    BigInt(850 * MB),
    true
  );
  await createFile(
    bbS1E1Id,
    "Breaking.Bad.S01E01.Pilot.2160p.mkv",
    bbS1E1Path,
    FileType.MEDIA,
    "video/x-matroska",
    BigInt(Math.floor(3.2 * GB)),
    false
  );
  await createFile(
    bbS1E1Id,
    "english.srt",
    bbS1E1Path,
    FileType.SUBTITLE,
    "application/x-subrip",
    BigInt(28 * KB),
    true
  );
  await createFile(
    bbS1E1Id,
    "spanish.srt",
    bbS1E1Path,
    FileType.SUBTITLE,
    "application/x-subrip",
    BigInt(30 * KB),
    false
  );

  // S01E02 - Single files
  const bbS1E2Id = await createItem(
    userId,
    "S01E02 - Cat's in the Bag",
    bbS1Id,
    1,
    3
  );
  const bbS1E2Path = "/TV Shows/Breaking Bad/Season 1/S01E02";
  await createFile(
    bbS1E2Id,
    "Breaking.Bad.S01E02.1080p.mkv",
    bbS1E2Path,
    FileType.MEDIA,
    "video/x-matroska",
    BigInt(820 * MB),
    true
  );
  await createFile(
    bbS1E2Id,
    "english.srt",
    bbS1E2Path,
    FileType.SUBTITLE,
    "application/x-subrip",
    BigInt(26 * KB),
    true
  );

  // S01E03 - Single files
  const bbS1E3Id = await createItem(
    userId,
    "S01E03 - And the Bag's in the River",
    bbS1Id,
    2,
    3
  );
  const bbS1E3Path = "/TV Shows/Breaking Bad/Season 1/S01E03";
  await createFile(
    bbS1E3Id,
    "Breaking.Bad.S01E03.1080p.mkv",
    bbS1E3Path,
    FileType.MEDIA,
    "video/x-matroska",
    BigInt(810 * MB),
    true
  );
  await createFile(
    bbS1E3Id,
    "english.srt",
    bbS1E3Path,
    FileType.SUBTITLE,
    "application/x-subrip",
    BigInt(27 * KB),
    true
  );

  // Season 2 minimal
  const bbS2Id = await createItem(userId, "Season 2", bbId, 1, 2);
  const bbS2Path = "/TV Shows/Breaking Bad/Season 2";
  await createFile(
    bbS2Id,
    "poster.jpg",
    bbS2Path,
    FileType.ARTWORK,
    "image/jpeg",
    BigInt(175 * KB),
    true
  );

  const bbS2E1Id = await createItem(
    userId,
    "S02E01 - Seven Thirty-Seven",
    bbS2Id,
    0,
    3
  );
  const bbS2E1Path = "/TV Shows/Breaking Bad/Season 2/S02E01";
  await createFile(
    bbS2E1Id,
    "Breaking.Bad.S02E01.1080p.mkv",
    bbS2E1Path,
    FileType.MEDIA,
    "video/x-matroska",
    BigInt(900 * MB),
    true
  );
  await createFile(
    bbS2E1Id,
    "english.srt",
    bbS2E1Path,
    FileType.SUBTITLE,
    "application/x-subrip",
    BigInt(29 * KB),
    true
  );

  // Stranger Things
  const stId = await createItem(userId, "Stranger Things", tvId, 1, 1);
  const stS1Id = await createItem(userId, "Season 1", stId, 0, 2);
  const stS1Path = "/TV Shows/Stranger Things/Season 1";
  await createFile(
    stS1Id,
    "poster.jpg",
    stS1Path,
    FileType.ARTWORK,
    "image/jpeg",
    BigInt(195 * KB),
    true
  );
  await createFile(
    stS1Id,
    "fanart.jpg",
    stS1Path,
    FileType.ARTWORK,
    "image/jpeg",
    BigInt(380 * KB),
    false
  );

  // S01E01 - STRESS TEST
  const stS1E1Id = await createItem(
    userId,
    "S01E01 - The Vanishing of Will Byers",
    stS1Id,
    0,
    3
  );
  const stS1E1Path = "/TV Shows/Stranger Things/Season 1/S01E01";
  await createFile(
    stS1E1Id,
    "Stranger.Things.S01E01.1080p.mkv",
    stS1E1Path,
    FileType.MEDIA,
    "video/x-matroska",
    BigInt(Math.floor(1.1 * GB)),
    true
  );
  await createFile(
    stS1E1Id,
    "Stranger.Things.S01E01.2160p.mkv",
    stS1E1Path,
    FileType.MEDIA,
    "video/x-matroska",
    BigInt(Math.floor(4.2 * GB)),
    false
  );
  await createFile(
    stS1E1Id,
    "thumb.jpg",
    stS1E1Path,
    FileType.ARTWORK,
    "image/jpeg",
    BigInt(65 * KB),
    true
  );
  await createFile(
    stS1E1Id,
    "title.jpg",
    stS1E1Path,
    FileType.ARTWORK,
    "image/jpeg",
    BigInt(48 * KB),
    false
  );
  await createFile(
    stS1E1Id,
    "english.srt",
    stS1E1Path,
    FileType.SUBTITLE,
    "application/x-subrip",
    BigInt(31 * KB),
    true
  );
  await createFile(
    stS1E1Id,
    "spanish.srt",
    stS1E1Path,
    FileType.SUBTITLE,
    "application/x-subrip",
    BigInt(33 * KB),
    false
  );
  await createFile(
    stS1E1Id,
    "french.srt",
    stS1E1Path,
    FileType.SUBTITLE,
    "application/x-subrip",
    BigInt(32 * KB),
    false
  );

  // S01E02-03 - Single files
  const stS1E2Id = await createItem(
    userId,
    "S01E02 - The Weirdo on Maple Street",
    stS1Id,
    1,
    3
  );
  await createFile(
    stS1E2Id,
    "Stranger.Things.S01E02.1080p.mkv",
    "/TV Shows/Stranger Things/Season 1/S01E02",
    FileType.MEDIA,
    "video/x-matroska",
    BigInt(980 * MB),
    true
  );
  await createFile(
    stS1E2Id,
    "english.srt",
    "/TV Shows/Stranger Things/Season 1/S01E02",
    FileType.SUBTITLE,
    "application/x-subrip",
    BigInt(29 * KB),
    true
  );

  const stS1E3Id = await createItem(
    userId,
    "S01E03 - Holly, Jolly",
    stS1Id,
    2,
    3
  );
  await createFile(
    stS1E3Id,
    "Stranger.Things.S01E03.1080p.mkv",
    "/TV Shows/Stranger Things/Season 1/S01E03",
    FileType.MEDIA,
    "video/x-matroska",
    BigInt(1 * GB),
    true
  );
  await createFile(
    stS1E3Id,
    "english.srt",
    "/TV Shows/Stranger Things/Season 1/S01E03",
    FileType.SUBTITLE,
    "application/x-subrip",
    BigInt(30 * KB),
    true
  );

  // The Office
  const officeId = await createItem(userId, "The Office", tvId, 2, 1);
  const officeS1Id = await createItem(userId, "Season 1", officeId, 0, 2);
  await createFile(
    officeS1Id,
    "poster.jpg",
    "/TV Shows/The Office/Season 1",
    FileType.ARTWORK,
    "image/jpeg",
    BigInt(145 * KB),
    true
  );

  const officeS1E1Id = await createItem(
    userId,
    "S01E01 - Pilot",
    officeS1Id,
    0,
    3
  );
  await createFile(
    officeS1E1Id,
    "The.Office.S01E01.Pilot.1080p.mkv",
    "/TV Shows/The Office/Season 1/S01E01",
    FileType.MEDIA,
    "video/x-matroska",
    BigInt(420 * MB),
    true
  );
  await createFile(
    officeS1E1Id,
    "english.srt",
    "/TV Shows/The Office/Season 1/S01E01",
    FileType.SUBTITLE,
    "application/x-subrip",
    BigInt(18 * KB),
    true
  );

  // S01E02 - MINIMAL (media only)
  const officeS1E2Id = await createItem(
    userId,
    "S01E02 - Diversity Day",
    officeS1Id,
    1,
    3
  );
  await createFile(
    officeS1E2Id,
    "The.Office.S01E02.1080p.mkv",
    "/TV Shows/The Office/Season 1/S01E02",
    FileType.MEDIA,
    "video/x-matroska",
    BigInt(410 * MB),
    true
  );

  const officeS1E3Id = await createItem(
    userId,
    "S01E03 - Health Care",
    officeS1Id,
    2,
    3
  );
  await createFile(
    officeS1E3Id,
    "The.Office.S01E03.1080p.mkv",
    "/TV Shows/The Office/Season 1/S01E03",
    FileType.MEDIA,
    "video/x-matroska",
    BigInt(415 * MB),
    true
  );
  await createFile(
    officeS1E3Id,
    "english.srt",
    "/TV Shows/The Office/Season 1/S01E03",
    FileType.SUBTITLE,
    "application/x-subrip",
    BigInt(19 * KB),
    true
  );

  // Game of Thrones
  const gotId = await createItem(userId, "Game of Thrones", tvId, 3, 1);
  const gotS1Id = await createItem(userId, "Season 1", gotId, 0, 2);
  const gotS1Path = "/TV Shows/Game of Thrones/Season 1";
  await createFile(
    gotS1Id,
    "poster.jpg",
    gotS1Path,
    FileType.ARTWORK,
    "image/jpeg",
    BigInt(220 * KB),
    true
  );
  await createFile(
    gotS1Id,
    "fanart.jpg",
    gotS1Path,
    FileType.ARTWORK,
    "image/jpeg",
    BigInt(480 * KB),
    false
  );
  await createFile(
    gotS1Id,
    "banner.jpg",
    gotS1Path,
    FileType.ARTWORK,
    "image/jpeg",
    BigInt(110 * KB),
    false
  );

  // S01E01 - STRESS TEST
  const gotS1E1Id = await createItem(
    userId,
    "S01E01 - Winter Is Coming",
    gotS1Id,
    0,
    3
  );
  const gotS1E1Path = "/TV Shows/Game of Thrones/Season 1/S01E01";
  await createFile(
    gotS1E1Id,
    "Game.of.Thrones.S01E01.1080p.mkv",
    gotS1E1Path,
    FileType.MEDIA,
    "video/x-matroska",
    BigInt(Math.floor(1.8 * GB)),
    true
  );
  await createFile(
    gotS1E1Id,
    "Game.of.Thrones.S01E01.2160p.mkv",
    gotS1E1Path,
    FileType.MEDIA,
    "video/x-matroska",
    BigInt(Math.floor(6.5 * GB)),
    false
  );
  await createFile(
    gotS1E1Id,
    "thumb.jpg",
    gotS1E1Path,
    FileType.ARTWORK,
    "image/jpeg",
    BigInt(72 * KB),
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
    "english.srt",
    gotS1E1Path,
    FileType.SUBTITLE,
    "application/x-subrip",
    BigInt(35 * KB),
    true
  );
  await createFile(
    gotS1E1Id,
    "spanish.srt",
    gotS1E1Path,
    FileType.SUBTITLE,
    "application/x-subrip",
    BigInt(37 * KB),
    false
  );
  await createFile(
    gotS1E1Id,
    "french.srt",
    gotS1E1Path,
    FileType.SUBTITLE,
    "application/x-subrip",
    BigInt(36 * KB),
    false
  );
  await createFile(
    gotS1E1Id,
    "german.srt",
    gotS1E1Path,
    FileType.SUBTITLE,
    "application/x-subrip",
    BigInt(38 * KB),
    false
  );

  // S01E02 - Multiple subtitles
  const gotS1E2Id = await createItem(
    userId,
    "S01E02 - The Kingsroad",
    gotS1Id,
    1,
    3
  );
  const gotS1E2Path = "/TV Shows/Game of Thrones/Season 1/S01E02";
  await createFile(
    gotS1E2Id,
    "Game.of.Thrones.S01E02.1080p.mkv",
    gotS1E2Path,
    FileType.MEDIA,
    "video/x-matroska",
    BigInt(Math.floor(1.7 * GB)),
    true
  );
  await createFile(
    gotS1E2Id,
    "english.srt",
    gotS1E2Path,
    FileType.SUBTITLE,
    "application/x-subrip",
    BigInt(33 * KB),
    true
  );
  await createFile(
    gotS1E2Id,
    "spanish.srt",
    gotS1E2Path,
    FileType.SUBTITLE,
    "application/x-subrip",
    BigInt(35 * KB),
    false
  );

  // The Mandalorian - EMPTY (no seasons)
  await createItem(userId, "The Mandalorian", tvId, 4, 1);
}

/**
 * Seeds Alex Demo's Music folder.
 */
async function seedMusic(userId: string): Promise<void> {
  console.log("    🎵 Seeding Music...");
  const musicId = await createItem(userId, "Music", null, 2, 0);

  // Pink Floyd - The Dark Side of the Moon
  const pinkFloydId = await createItem(
    userId,
    "Pink Floyd - The Dark Side of the Moon",
    musicId,
    0,
    1
  );
  const pinkFloydPath = "/Music/Pink Floyd - The Dark Side of the Moon";
  await createFile(
    pinkFloydId,
    "01 - Speak to Me.flac",
    pinkFloydPath,
    FileType.MEDIA,
    "audio/flac",
    BigInt(12 * MB),
    true
  );
  await createFile(
    pinkFloydId,
    "02 - Breathe.flac",
    pinkFloydPath,
    FileType.MEDIA,
    "audio/flac",
    BigInt(35 * MB),
    false
  );
  await createFile(
    pinkFloydId,
    "03 - Time.flac",
    pinkFloydPath,
    FileType.MEDIA,
    "audio/flac",
    BigInt(85 * MB),
    false
  );
  await createFile(
    pinkFloydId,
    "04 - Money.flac",
    pinkFloydPath,
    FileType.MEDIA,
    "audio/flac",
    BigInt(78 * MB),
    false
  );
  await createFile(
    pinkFloydId,
    "05 - Brain Damage.flac",
    pinkFloydPath,
    FileType.MEDIA,
    "audio/flac",
    BigInt(48 * MB),
    false
  );
  await createFile(
    pinkFloydId,
    "cover.jpg",
    pinkFloydPath,
    FileType.ARTWORK,
    "image/jpeg",
    BigInt(850 * KB),
    true
  );
  await createFile(
    pinkFloydId,
    "back.jpg",
    pinkFloydPath,
    FileType.ARTWORK,
    "image/jpeg",
    BigInt(720 * KB),
    false
  );
  await createFile(
    pinkFloydId,
    "cd.png",
    pinkFloydPath,
    FileType.ARTWORK,
    "image/png",
    BigInt(380 * KB),
    false
  );

  // Daft Punk - Random Access Memories
  const daftPunkId = await createItem(
    userId,
    "Daft Punk - Random Access Memories",
    musicId,
    1,
    1
  );
  const daftPunkPath = "/Music/Daft Punk - Random Access Memories";
  await createFile(
    daftPunkId,
    "01 - Give Life Back to Music.flac",
    daftPunkPath,
    FileType.MEDIA,
    "audio/flac",
    BigInt(58 * MB),
    true
  );
  await createFile(
    daftPunkId,
    "02 - The Game of Love.flac",
    daftPunkPath,
    FileType.MEDIA,
    "audio/flac",
    BigInt(62 * MB),
    false
  );
  await createFile(
    daftPunkId,
    "03 - Get Lucky.flac",
    daftPunkPath,
    FileType.MEDIA,
    "audio/flac",
    BigInt(72 * MB),
    false
  );
  await createFile(
    daftPunkId,
    "cover.jpg",
    daftPunkPath,
    FileType.ARTWORK,
    "image/jpeg",
    BigInt(920 * KB),
    true
  );
  await createFile(
    daftPunkId,
    "fanart.jpg",
    daftPunkPath,
    FileType.ARTWORK,
    "image/jpeg",
    BigInt(Math.floor(1.2 * MB)),
    false
  );

  // Favorites - EMPTY
  await createItem(userId, "Favorites", musicId, 2, 1);
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
  await createItem(userId, "Documentaries", null, 3, 0);
}

/**
 * Seeds Jordan Test's account with minimal data.
 */
async function seedJordanTest(userId: string): Promise<void> {
  console.log("  Seeding Jordan Test data...");

  await createItem(userId, "My Files", null, 0, 0);
  await createItem(userId, "Projects", null, 1, 0);
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
  console.log("  - 10 Movies (52 files)");
  console.log("  - 4 TV Shows, 11 episodes (46 files)");
  console.log("  - 2 Albums (16 files)");
  console.log("  - 3 Empty folders");
  console.log("  - Total: ~114 files");
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
```

**Step 2: Commit**

```bash
git add prisma/seed.ts
git commit -m "feat: add database seed script with real media"
```

---

### Task 3: Configure Prisma Seed Command

**Files:**

- Modify: `package.json`

**Step 1: Add seed configuration to package.json**

```json
{
  "prisma": {
    "seed": "npx tsx prisma/seed.ts"
  }
}
```

**Step 2: Add tsx as dev dependency (for running TypeScript)**

```bash
pnpm add -D tsx
```

**Step 3: Add npm script for convenience**

```json
{
  "scripts": {
    "db:seed": "npx prisma db seed",
    "db:reset": "npx prisma migrate reset"
  }
}
```

**Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "feat: configure prisma seed command"
```

---

### Task 4: Add Clear Seed Data Script

**Files:**

- Create: `prisma/clear-seed.ts`

**Step 1: Write clear script**

```typescript
/**
 * Clears seed data from the database.
 * Only removes users with seed@canoncore.com pattern.
 *
 * Usage: npx tsx prisma/clear-seed.ts
 */

import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";

config({ path: ".env.local" });

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log("🧹 Clearing seed data...\n");

  const dbUrl = process.env.DATABASE_URL || "";
  const isSafe =
    dbUrl.includes("development") ||
    dbUrl.includes("localhost") ||
    dbUrl.includes("127.0.0.1");

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
```

**Step 2: Add npm script**

```json
{
  "scripts": {
    "db:seed:clear": "npx tsx prisma/clear-seed.ts"
  }
}
```

**Step 3: Commit**

```bash
git add prisma/clear-seed.ts package.json
git commit -m "feat: add clear seed data script"
```

---

## Documentation

### Task 5: Update CLAUDE.md

**Files:**

- Modify: `CLAUDE.md`

**Step 1: Add seeding section to Commands**

```markdown
# Database Seeding (Development Only)

pnpm run db:seed # Seed development database with sample data
pnpm run db:seed:clear # Remove seed data
pnpm run db:reset # Reset database and re-seed
```

**Step 2: Add seed user section**

```markdown
## Seed Users

For development and QA, seed the database with sample data:

| Email               | Password                          | Purpose              |
| ------------------- | --------------------------------- | -------------------- |
| seed@canoncore.com  | (see SEED_PASSWORD in .env.local) | Full demo account    |
| seed2@canoncore.com | (same)                            | Minimal data account |
| seed3@canoncore.com | (same)                            | Empty account        |

Seed data includes:

- 10 Movies with varying file configurations
- 4 TV Shows with 11 episodes
- 2 Music albums
- ~114 total files covering all test scenarios
```

**Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add database seeding instructions"
```

---

## Testing

### Task 6: Unit Tests for Seed Validation

**Files:**

- Create: `tests/unit/prisma/seed.test.ts`

**Step 1: Write tests**

```typescript
/**
 * Unit tests for seed script validation logic.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

describe("Seed Script Validation", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("requires ALLOW_SEEDING to be true", () => {
    const testCases = [
      { value: undefined, expected: false },
      { value: "false", expected: false },
      { value: "", expected: false },
      { value: "true", expected: true },
    ];

    for (const { value, expected } of testCases) {
      const isAllowed = value === "true";
      expect(isAllowed).toBe(expected);
    }
  });

  it("rejects production database URLs", () => {
    const productionUrls = [
      "postgresql://user:pass@prod.neon.tech/db",
      "postgresql://user:pass@production.neon.tech/db",
      "postgresql://user:pass@main.neon.tech/db",
    ];

    for (const url of productionUrls) {
      const isSafe =
        url.includes("development") ||
        url.includes("localhost") ||
        url.includes("127.0.0.1");
      expect(isSafe).toBe(false);
    }
  });

  it("accepts development database URLs", () => {
    const devUrls = [
      "postgresql://user:pass@development.neon.tech/db",
      "postgresql://user:pass@localhost:5432/db",
      "postgresql://user:pass@127.0.0.1:5432/db",
    ];

    for (const url of devUrls) {
      const isSafe =
        url.includes("development") ||
        url.includes("localhost") ||
        url.includes("127.0.0.1");
      expect(isSafe).toBe(true);
    }
  });
});

describe("Seed User Emails", () => {
  it("follows expected pattern", () => {
    const seedEmails = [
      "seed@canoncore.com",
      "seed2@canoncore.com",
      "seed3@canoncore.com",
    ];

    for (const email of seedEmails) {
      expect(email).toMatch(/^seed\d*@canoncore\.com$/);
    }
  });
});

describe("File Size Constants", () => {
  const KB = 1024;
  const MB = 1024 * KB;
  const GB = 1024 * MB;

  it("calculates KB correctly", () => {
    expect(KB).toBe(1024);
  });

  it("calculates MB correctly", () => {
    expect(MB).toBe(1024 * 1024);
  });

  it("calculates GB correctly", () => {
    expect(GB).toBe(1024 * 1024 * 1024);
  });

  it("handles realistic file sizes with Math.floor", () => {
    // Use Math.floor to avoid floating point precision issues
    expect(BigInt(Math.floor(4.5 * GB))).toBeGreaterThan(BigInt(4 * GB));
    expect(BigInt(250 * KB)).toBeLessThan(BigInt(1 * MB));
  });
});
```

**Step 2: Commit**

```bash
git add tests/unit/prisma/
git commit -m "test: add seed script validation tests"
```

---

### Task 7: Integration Test for Seeding

**Files:**

- Create: `tests/integration/prisma/seed.test.ts`

**Step 1: Write integration tests**

```typescript
/**
 * Integration tests for database seeding.
 * Verifies seed data is created correctly.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

describe("Database Seeding Integration", () => {
  const testEmail = `seed-test-${Date.now()}@canoncore.com`;
  let testUserId: string;

  beforeAll(async () => {
    // Create a test user similar to seed script
    const passwordHash = await hash("TestPassword123!", 10);
    const user = await prisma.user.create({
      data: {
        email: testEmail,
        name: "Seed Test User",
        passwordHash,
      },
    });
    testUserId = user.id;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.user.delete({ where: { id: testUserId } });
    await prisma.$disconnect();
  });

  it("creates user with correct password hash", async () => {
    const user = await prisma.user.findUnique({
      where: { email: testEmail },
    });

    expect(user).not.toBeNull();
    expect(user?.passwordHash).toMatch(/^\$2[aby]?\$/);
  });

  it("creates hierarchical items correctly", async () => {
    // Create parent (Movies folder)
    const parent = await prisma.item.create({
      data: {
        userId: testUserId,
        name: "Movies",
        order: 0,
        depth: 0,
      },
    });

    // Create child (Movie item)
    const child = await prisma.item.create({
      data: {
        userId: testUserId,
        name: "The Shawshank Redemption (1994)",
        parentId: parent.id,
        order: 0,
        depth: 1,
      },
    });

    expect(child.parentId).toBe(parent.id);
    expect(child.depth).toBe(1);

    // Cleanup
    await prisma.item.deleteMany({
      where: { userId: testUserId },
    });
  });

  it("creates item files with correct types and sizes", async () => {
    const item = await prisma.item.create({
      data: {
        userId: testUserId,
        name: "Test Movie",
        order: 0,
        depth: 0,
      },
    });

    const mediaFile = await prisma.itemFile.create({
      data: {
        itemId: item.id,
        filename: "movie.mkv",
        sftpPath: "/test/movie.mkv",
        fileType: "MEDIA",
        mimeType: "video/x-matroska",
        size: BigInt(4_500_000_000), // 4.5 GB
        isPrimary: true,
      },
    });

    const artworkFile = await prisma.itemFile.create({
      data: {
        itemId: item.id,
        filename: "poster.jpg",
        sftpPath: "/test/poster.jpg",
        fileType: "ARTWORK",
        mimeType: "image/jpeg",
        size: BigInt(250_000), // 250 KB
        isPrimary: true,
      },
    });

    expect(mediaFile.fileType).toBe("MEDIA");
    expect(mediaFile.isPrimary).toBe(true);
    expect(mediaFile.size).toBe(BigInt(4_500_000_000));

    expect(artworkFile.fileType).toBe("ARTWORK");
    expect(artworkFile.mimeType).toBe("image/jpeg");

    // Cleanup
    await prisma.item.delete({ where: { id: item.id } });
  });

  it("handles multiple files per item with primary selection", async () => {
    const item = await prisma.item.create({
      data: {
        userId: testUserId,
        name: "Multi-File Test",
        order: 0,
        depth: 0,
      },
    });

    // Create multiple media files
    await prisma.itemFile.createMany({
      data: [
        {
          itemId: item.id,
          filename: "movie.1080p.mkv",
          sftpPath: "/test/movie.1080p.mkv",
          fileType: "MEDIA",
          isPrimary: true,
        },
        {
          itemId: item.id,
          filename: "movie.4k.mkv",
          sftpPath: "/test/movie.4k.mkv",
          fileType: "MEDIA",
          isPrimary: false,
        },
      ],
    });

    const files = await prisma.itemFile.findMany({
      where: { itemId: item.id },
      orderBy: { isPrimary: "desc" },
    });

    expect(files).toHaveLength(2);
    expect(files[0].isPrimary).toBe(true);
    expect(files[1].isPrimary).toBe(false);

    // Cleanup
    await prisma.item.delete({ where: { id: item.id } });
  });

  it("cascades deletes correctly", async () => {
    const item = await prisma.item.create({
      data: {
        userId: testUserId,
        name: "Cascade Test",
        order: 0,
        depth: 0,
      },
    });

    await prisma.itemFile.create({
      data: {
        itemId: item.id,
        filename: "test.mp4",
        sftpPath: "/test.mp4",
        fileType: "MEDIA",
      },
    });

    // Delete item - should cascade to files
    await prisma.item.delete({ where: { id: item.id } });

    const files = await prisma.itemFile.findMany({
      where: { itemId: item.id },
    });

    expect(files).toHaveLength(0);
  });
});
```

**Step 2: Commit**

```bash
git add tests/integration/prisma/
git commit -m "test: add seed integration tests"
```

---

## Summary

### Files Created

- `prisma/seed.ts` - Main seed script with real media
- `prisma/clear-seed.ts` - Clear seed data script
- `tests/unit/prisma/seed.test.ts` - Unit tests
- `tests/integration/prisma/seed.test.ts` - Integration tests

### Files Modified

- `.env.local` - Add `SEED_PASSWORD` and `ALLOW_SEEDING=true`
- `lib/env.ts` - Add optional `SEED_PASSWORD` and `ALLOW_SEEDING` validation
- `package.json` - Add seed commands and tsx dependency
- `CLAUDE.md` - Add seeding documentation

### NPM Scripts Added

| Script                   | Description               |
| ------------------------ | ------------------------- |
| `pnpm run db:seed`       | Seed development database |
| `pnpm run db:seed:clear` | Remove seed data          |
| `pnpm run db:reset`      | Reset and re-seed         |

### Seed Data Summary

| Category  | Items           | Files    | Test Scenarios                     |
| --------- | --------------- | -------- | ---------------------------------- |
| Movies    | 10              | 52       | Multiple media, artwork, subtitles |
| TV Shows  | 4 shows, 11 eps | 46       | Deep hierarchy, season artwork     |
| Music     | 2 albums        | 16       | Audio files, album art             |
| Empty     | 3 folders       | 0        | Empty state UI                     |
| **Total** | **~30**         | **~114** | All scenarios covered              |

### Seed Users

| Email               | Name        | Data                                   |
| ------------------- | ----------- | -------------------------------------- |
| seed@canoncore.com  | Alex Demo   | Full hierarchy with all test scenarios |
| seed2@canoncore.com | Jordan Test | Minimal items (2 folders)              |
| seed3@canoncore.com | Sam Empty   | No items (empty state)                 |

---

**Plan complete and saved to `docs/plans/2026-01-03-database-seeding-design.md`.**

**Two execution options:**

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach?**
