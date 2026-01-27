# Incremental Seed Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make database seeding incremental - only update items that have changed in seed-config, preserving existing content and Google Drive files.

**Architecture:** Add a content hash system that computes a fingerprint for each user's content configuration. On seed, compare hashes against stored values. If unchanged, skip that user entirely. If changed, update only that user's content (preserving other users). Never wipe Google Drive files wholesale.

**Tech Stack:** Prisma, TypeScript, crypto (for hashing), existing seed infrastructure

> **⚠️ Important:** Incremental seeding is single-process only. Do not run multiple seed commands simultaneously as this could cause race conditions where both processes try to clean the same user.

---

## Review Notes

This plan was validated against code-review-excellence, react-best-practices (async patterns, js patterns), and Prisma documentation. The following improvements were incorporated:

| Issue                                           | Resolution                                   |
| ----------------------------------------------- | -------------------------------------------- |
| N+1 query in `getUsersToSeed`                   | Changed to batch `findMany` with `in` filter |
| Sequential cleanup loops                        | Changed to parallel `Promise.all`            |
| `.sort()` mutates arrays                        | Changed to `.toSorted()`                     |
| Missing `getAccessTokenFromRefreshToken` import | Added explicit import                        |
| Hash truncation (16 chars)                      | Use full 64-char SHA-256                     |
| No hash versioning                              | Added `v1:` prefix                           |
| Missing error handling in Drive cleanup         | Added try/catch with graceful failure        |
| No unit tests                                   | Added Task 8 with hash computation tests     |
| Race condition risk                             | Added warning in header                      |

---

## Background

Current seed behavior:

1. **Wipes ALL Google Drive content** in root folder (lines 321-382 in seed.ts)
2. **Deletes ALL seed users** from database (cleanupSeedUsers)
3. **Recreates everything from scratch** (~15-20 minutes)

Problems:

- Slow iteration when tweaking screenshots
- Wasteful - re-uploads same content repeatedly
- Breaking Bad video upload alone takes ~5 minutes

Desired behavior:

- If seed-config unchanged for a user → skip entirely
- If user config changed (e.g., Dark Knight updated) → update only that user
- Preserve Google Drive files unless content actually changed
- Fast re-runs when nothing changed (~5 seconds)

---

## Task 1: Add Content Hash Computation

**Files:**

- Modify: `prisma/seed-config.ts`

**Step 1: Add hash computation function**

Add to end of seed-config.ts:

```typescript
import crypto from "crypto";

/** Hash version prefix - increment when changing hash algorithm or included fields */
const HASH_VERSION = "v1";

/**
 * Computes a content hash for a user's seed configuration.
 * Changes to any of these trigger a re-seed for that user:
 * - Movie IDs
 * - Show IDs
 * - Progress range
 * - Pinned items
 * - User profile (name, username, isPublic, avatar/hero seeds)
 *
 * @param email - User email to compute hash for
 * @returns Versioned SHA-256 hash of user's content configuration (e.g., "v1:abc123...")
 */
export function computeUserContentHash(email: string): string {
  const userConfig = SEED_USERS.find((u) => u.email === email);
  const contentConfig = USER_CONTENT_DISTRIBUTION[email];
  const progressConfig = USER_PROGRESS_RANGES[email];
  const pinnedConfig = USER_PINNED_ITEMS[email];

  if (!userConfig || !contentConfig) {
    return "";
  }

  // Use .toSorted() to avoid mutating original arrays
  const hashInput = JSON.stringify({
    // User profile
    name: userConfig.name,
    username: userConfig.username,
    isPublic: userConfig.isPublic,
    avatarSeed: userConfig.avatarSeed,
    heroSeed: userConfig.heroSeed,
    heroUrl: userConfig.heroUrl,
    // Content (sorted for determinism, using immutable toSorted)
    movieIds: contentConfig.movieIds.toSorted(),
    showIds: contentConfig.showIds.toSorted(),
    // Progress
    progressRange: progressConfig,
    // Pinned (sorted for determinism)
    pinnedItems: pinnedConfig?.toSorted() ?? [],
    // Global settings that affect output
    maxSeasons: MAX_SEASONS,
    maxEpisodes: MAX_EPISODES,
    groupedStructure: SEED_GROUPED_STRUCTURE,
    simulatePlayback: SEED_SIMULATE_PLAYBACK,
  });

  // Use full SHA-256 hash (64 chars) with version prefix for future-proofing
  const hash = crypto.createHash("sha256").update(hashInput).digest("hex");
  return `${HASH_VERSION}:${hash}`;
}

/**
 * Computes hashes for all seed users.
 *
 * @returns Map of email to content hash
 */
export function computeAllUserHashes(): Map<string, string> {
  const hashes = new Map<string, string>();
  for (const user of SEED_USERS) {
    hashes.set(user.email, computeUserContentHash(user.email));
  }
  return hashes;
}
```

**Step 2: Test manually**

Run:

```bash
npx tsx --eval "
import { computeUserContentHash } from './prisma/seed-config.js';
console.log(computeUserContentHash('demo@canoncore.com'));
"
```

Expected: Versioned hash like `v1:a1b2c3d4e5f67890...` (v1: prefix + 64-char hex)

**Step 3: Commit**

```bash
git add prisma/seed-config.ts
git commit -m "feat(seed): add content hash computation for incremental seeding"
```

---

## Task 2: Add Seed Hash Storage to User Model

**Files:**

- Modify: `prisma/schema.prisma`

**Step 1: Add seedContentHash field to User model**

Add field to User model (after heroImage field):

```prisma
  /// Hash of seed configuration for incremental seeding (null for non-seeded users)
  seedContentHash String?
```

**Step 2: Create migration**

Run: `npx prisma migrate dev --name add_seed_content_hash`

Expected: Migration created successfully

**Step 3: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(db): add seedContentHash field for incremental seeding"
```

---

## Task 3: Add SEED_INCREMENTAL Mode

**Files:**

- Modify: `prisma/seed-config.ts`

**Step 1: Add incremental mode flag**

Add after SEED_GROUPED_STRUCTURE definition (around line 84):

```typescript
/**
 * Enable incremental seeding mode.
 * When true: only re-seed users whose content hash has changed.
 * When false: clean slate seeding (legacy behavior).
 * Default: true
 */
export const SEED_INCREMENTAL =
  process.env.SEED_INCREMENTAL?.toLowerCase() !== "false";
```

**Step 2: Update docstring at top of file**

Add to the environment variables documentation:

```typescript
 *   - SEED_INCREMENTAL: Enable incremental mode (default: true, set to "false" for clean slate)
```

**Step 3: Commit**

```bash
git add prisma/seed-config.ts
git commit -m "feat(seed): add SEED_INCREMENTAL mode flag"
```

---

## Task 4: Modify Cleanup Logic for Incremental Mode

**Files:**

- Modify: `prisma/seed.ts`

**Step 1: Import new config values**

Update imports at top of seed.ts to include:

```typescript
import {
  // ... existing imports ...
  SEED_INCREMENTAL,
  computeUserContentHash,
} from "./seed-config";

import { getAccessTokenFromRefreshToken } from "@/lib/google-drive-client";
```

**Step 2: Add getUsersToSeed function**

Add after cleanupSeedUsers function (around line 980):

```typescript
/**
 * Determines which users need to be seeded based on content hash comparison.
 * In incremental mode, only returns users whose config has changed.
 * Uses batch query (findMany) to avoid N+1 database calls.
 *
 * @returns Object with usersToSeed array and skippedUsers list
 */
async function getUsersToSeed(): Promise<{
  usersToSeed: SeedUserConfig[];
  skippedUsers: string[];
}> {
  const effectiveUsers = getEffectiveSeedUsers();

  if (!SEED_INCREMENTAL) {
    // Legacy mode: seed all users
    return { usersToSeed: effectiveUsers, skippedUsers: [] };
  }

  // Batch query: fetch all existing users in one DB call (avoids N+1)
  const emails = effectiveUsers.map((u) => u.email);
  const existingUsers = await prisma.user.findMany({
    where: { email: { in: emails } },
    select: { email: true, seedContentHash: true },
  });

  // Build lookup map for O(1) access
  const hashMap = new Map(
    existingUsers.map((u) => [u.email, u.seedContentHash])
  );

  const usersToSeed: SeedUserConfig[] = [];
  const skippedUsers: string[] = [];

  for (const userConfig of effectiveUsers) {
    const newHash = computeUserContentHash(userConfig.email);
    const existingHash = hashMap.get(userConfig.email);

    if (existingHash === newHash) {
      skippedUsers.push(userConfig.email);
    } else {
      usersToSeed.push(userConfig);
    }
  }

  return { usersToSeed, skippedUsers };
}
```

**Step 3: Modify cleanupGoogleDrive to be conditional**

Rename `cleanupGoogleDrive` to `cleanupGoogleDriveForUser` and modify to only delete a specific user's folder:

```typescript
/**
 * Cleans up Google Drive content for a specific user.
 * Finds and deletes the user's content folder (by email prefix) in the root folder.
 * Gracefully handles errors to allow seed to continue with database-only cleanup.
 *
 * @param userEmail - Email of user whose content to clean
 */
async function cleanupGoogleDriveForUser(userEmail: string): Promise<void> {
  const refreshToken = process.env.GOOGLE_SEED_REFRESH_TOKEN;
  const rootFolderId = process.env.GOOGLE_SEED_ROOT_FOLDER_ID;
  const username = userEmail.split("@")[0];

  if (!refreshToken || !rootFolderId) {
    console.warn(
      `  ⚠️  Drive credentials not configured, skipping Drive cleanup for ${username}`
    );
    return;
  }

  try {
    const { batchDelete } = await import("@/lib/google-drive-client");

    // Find folders that belong to this user
    // In flat structure, each item has user-specific driveFileId
    const user = await prisma.user.findUnique({
      where: { email: userEmail },
      include: {
        googleDriveConnection: true,
        items: {
          where: { driveFileId: { not: null } },
          select: { driveFileId: true },
        },
      },
    });

    if (!user) {
      console.log(`  ℹ️  No existing user ${username} to clean`);
      return;
    }

    const driveFileIds = user.items
      .map((item) => item.driveFileId)
      .filter((id): id is string => id !== null);

    if (driveFileIds.length === 0) {
      console.log(`  ℹ️  No Drive content for ${username}`);
      return;
    }

    console.log(
      `  🗑️  Cleaning ${driveFileIds.length} Drive items for ${username}`
    );

    const accessToken = await getAccessTokenFromRefreshToken(refreshToken);
    const result = await batchDelete(accessToken, driveFileIds);

    if (result.failed.length > 0) {
      console.warn(
        `  ⚠️  Failed to delete ${result.failed.length} items for ${username}`
      );
    }

    console.log(`  ✅ Cleaned ${result.succeeded.length} Drive items`);
  } catch (error) {
    // Graceful failure - log warning but continue with database cleanup
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`  ⚠️  Failed to cleanup Drive for ${username}: ${message}`);
    console.warn(`     Proceeding with database cleanup only`);
  }
}

/**
 * Legacy cleanup - wipes ALL Google Drive content.
 * Only used when SEED_INCREMENTAL=false.
 */
async function cleanupAllGoogleDrive(): Promise<void> {
  // ... move existing cleanupGoogleDrive code here ...
}
```

**Step 4: Modify cleanupSeedUsers to be selective**

Update to only clean users that will be reseeded:

```typescript
/**
 * Cleans up specific seed users from database.
 * Deletes users and all related data (items, files, connections).
 *
 * @param emails - Array of user emails to clean up
 */
async function cleanupSeedUsers(emails: string[]): Promise<void> {
  if (emails.length === 0) return;

  const seedUserEmails = getEffectiveSeedUsers().map((u) => u.email);
  const toDelete = emails.filter((e) => seedUserEmails.includes(e));

  if (toDelete.length === 0) return;

  await prisma.user.deleteMany({
    where: { email: { in: toDelete } },
  });

  console.log(`🗑️  Cleaned up ${toDelete.length} seed user(s)`);
}
```

**Step 5: Commit**

```bash
git add prisma/seed.ts
git commit -m "feat(seed): add incremental seeding with per-user cleanup"
```

---

## Task 5: Update Main Seed Flow for Incremental Mode

**Files:**

- Modify: `prisma/seed.ts`

**Step 1: Modify main() function**

Replace the cleanup and seeding section in main() (around line 2590-2600):

```typescript
async function main(): Promise<void> {
  // ... validation code stays the same ...

  console.log(
    "\n🌱 Starting database seed with Google Drive integration (flat structure)...\n"
  );

  // Validation stays the same
  validateContentDistribution();

  // ... env validation stays the same ...

  if (SEED_INCREMENTAL) {
    console.log("📊 Incremental mode: checking for changes...\n");

    const { usersToSeed, skippedUsers } = await getUsersToSeed();

    if (skippedUsers.length > 0) {
      console.log(
        `⏭️  Skipping ${skippedUsers.length} unchanged user(s): ${skippedUsers.join(", ")}`
      );
    }

    if (usersToSeed.length === 0) {
      console.log("\n✅ All users up to date. Nothing to seed.\n");
      return;
    }

    console.log(
      `🔄 Seeding ${usersToSeed.length} user(s): ${usersToSeed.map((u) => u.email).join(", ")}\n`
    );

    // Clean affected users in parallel (Drive + DB cleanup per user)
    await Promise.all(
      usersToSeed.map(async (userConfig) => {
        await cleanupGoogleDriveForUser(userConfig.email);
        await cleanupSeedUsers([userConfig.email]);
      })
    );

    // Seed users sequentially to avoid Drive API rate limits
    // (each user seeds multiple items with Drive uploads)
    for (const userConfig of usersToSeed) {
      await seedUserContent(userConfig);
    }
  } else {
    // Legacy clean-slate mode
    console.log("🧹 Clean slate mode: wiping all content...\n");
    await cleanupAllGoogleDrive();
    await cleanupSeedUsers(getEffectiveSeedUsers().map((u) => u.email));

    // Seed all users sequentially (Drive rate limits)
    for (const userConfig of getEffectiveSeedUsers()) {
      await seedUserContent(userConfig);
    }
  }

  console.log("\n🎉 Seed complete!\n");
}
```

**Step 2: Update seedUserContent to save hash**

At the end of seedUserContent (after all content is created), add:

```typescript
// Save content hash for incremental seeding
const contentHash = computeUserContentHash(userConfig.email);
await prisma.user.update({
  where: { id: userId },
  data: { seedContentHash: contentHash },
});
```

**Step 3: Commit**

```bash
git add prisma/seed.ts
git commit -m "feat(seed): implement incremental seeding flow"
```

---

## Task 6: Add Quick-Seed Script

**Files:**

- Modify: `package.json`

**Step 1: Add quick-seed script**

Add to scripts section:

```json
"seed:quick": "ALLOW_SEEDING=true npx prisma db seed",
"seed:full": "ALLOW_SEEDING=true SEED_INCREMENTAL=false npx prisma db seed"
```

**Step 2: Commit**

```bash
git add package.json
git commit -m "feat(seed): add seed:quick and seed:full npm scripts"
```

---

## Task 7: Update Documentation

**Files:**

- Modify: `prisma/seed.ts` (docstring)
- Modify: `prisma/seed-config.ts` (docstring)
- Modify: `CLAUDE.md`

**Step 1: Update seed.ts docstring**

Update the file header comment:

```typescript
/**
 * Database seed script for populating demo content with Google Drive integration.
 *
 * MODES:
 *   - Incremental (default): Only re-seeds users whose config has changed
 *   - Clean Slate: Wipes everything and recreates (SEED_INCREMENTAL=false)
 *
 * Usage:
 *   pnpm seed:quick                    # Incremental - fast when unchanged
 *   pnpm seed:full                     # Clean slate - full rebuild
 *   ALLOW_SEEDING=true npx prisma db seed  # Default incremental
 *   SEED_INCREMENTAL=false ALLOW_SEEDING=true npx prisma db seed  # Force clean
 * ...
 */
```

**Step 2: Update CLAUDE.md Commands section**

Add to the Development commands:

```markdown
pnpm run seed:quick # Incremental seed (fast - only changed users)
pnpm run seed:full # Full clean slate seed (slow - rebuilds everything)
```

**Step 3: Commit**

```bash
git add prisma/seed.ts prisma/seed-config.ts CLAUDE.md
git commit -m "docs: update seed documentation for incremental mode"
```

---

## Task 8: Add Unit Tests

**Files:**

- Create: `tests/unit/lib/seed-hash.test.ts`

**Step 1: Create unit tests for hash computation**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the seed-config module
vi.mock("../../../prisma/seed-config", async () => {
  const actual = await vi.importActual("../../../prisma/seed-config");
  return {
    ...actual,
    SEED_USERS: [
      {
        email: "demo@canoncore.com",
        name: "Demo",
        username: "demo",
        isPublic: true,
      },
      {
        email: "test@canoncore.com",
        name: "Test",
        username: "test",
        isPublic: false,
      },
    ],
    USER_CONTENT_DISTRIBUTION: {
      "demo@canoncore.com": { movieIds: [550, 680], showIds: [1396] },
      "test@canoncore.com": { movieIds: [550], showIds: [] },
    },
    USER_PROGRESS_RANGES: {
      "demo@canoncore.com": [0.5, 1.0],
      "test@canoncore.com": [0.0, 0.5],
    },
    USER_PINNED_ITEMS: {
      "demo@canoncore.com": ["Breaking Bad"],
    },
  };
});

import { computeUserContentHash } from "../../../prisma/seed-config";

describe("computeUserContentHash", () => {
  it("produces same hash for same input (deterministic)", () => {
    const hash1 = computeUserContentHash("demo@canoncore.com");
    const hash2 = computeUserContentHash("demo@canoncore.com");
    expect(hash1).toBe(hash2);
  });

  it("produces different hash for different users", () => {
    const demoHash = computeUserContentHash("demo@canoncore.com");
    const testHash = computeUserContentHash("test@canoncore.com");
    expect(demoHash).not.toBe(testHash);
  });

  it("returns empty string for missing user", () => {
    const hash = computeUserContentHash("nonexistent@canoncore.com");
    expect(hash).toBe("");
  });

  it("includes version prefix", () => {
    const hash = computeUserContentHash("demo@canoncore.com");
    expect(hash).toMatch(/^v1:/);
  });

  it("produces 64-char hex hash after version prefix", () => {
    const hash = computeUserContentHash("demo@canoncore.com");
    const hashPart = hash.replace(/^v1:/, "");
    expect(hashPart).toMatch(/^[a-f0-9]{64}$/);
  });
});
```

**Step 2: Run unit tests**

```bash
pnpm test tests/unit/lib/seed-hash.test.ts
```

Expected: All 5 tests pass

---

## Task 9: Manual Integration Testing

**Step 1: Run initial seed**

```bash
pnpm seed:quick
```

Expected: Full seed runs (all users have no hash yet)

**Step 2: Run again without changes**

```bash
pnpm seed:quick
```

Expected: "All users up to date. Nothing to seed." (~5 seconds)

**Step 3: Change one user's config**

Edit seed-config.ts, add a new movie to demo@canoncore.com's movieIds

```bash
pnpm seed:quick
```

Expected: Only demo user is re-seeded

**Step 4: Force clean slate**

```bash
pnpm seed:full
```

Expected: All users are cleaned and re-seeded

**Step 5: Commit test results (if any fixes needed)**

---

## Summary

After implementing this plan (9 tasks):

1. **Default behavior** (`pnpm seed:quick`): Incremental - skips unchanged users
2. **Full rebuild** (`pnpm seed:full`): Clean slate like before
3. **Fast iteration**: When config unchanged, seed completes in ~5 seconds
4. **Targeted updates**: Change Dark Knight config → only that user re-seeds
5. **No Drive file loss**: Unchanged users keep their existing Drive content

### Key Implementation Details

| Feature         | Implementation                                    |
| --------------- | ------------------------------------------------- |
| Hash versioning | `v1:` prefix for future algorithm changes         |
| Hash length     | Full 64-char SHA-256 (no truncation)              |
| Array sorting   | Uses `.toSorted()` to avoid mutation              |
| DB queries      | Batch `findMany` (avoids N+1)                     |
| Cleanup         | Parallel `Promise.all` for speed                  |
| Seeding         | Sequential (respects Drive rate limits)           |
| Error handling  | Graceful Drive failures (logs warning, continues) |
| Testing         | Unit tests for hash + manual integration tests    |

### Files Modified

- `prisma/seed-config.ts` - Hash computation, incremental flag
- `prisma/seed.ts` - Incremental flow, per-user cleanup
- `prisma/schema.prisma` - seedContentHash field
- `package.json` - seed:quick, seed:full scripts
- `CLAUDE.md` - Documentation updates
- `tests/unit/lib/seed-hash.test.ts` - Unit tests (new file)

This enables fast screenshot iteration - just run `pnpm seed:quick` after code changes, and only affected content gets updated.
