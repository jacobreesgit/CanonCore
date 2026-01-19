# Seed Script Drive Cleanup Design

**Date:** 2026-01-19
**Status:** Ready for Implementation

## Overview

Modify the seed script to guarantee a clean slate by automatically cleaning all Google Drive content and emptying trash before seeding. The Google Drive account is dedicated to seeding, so all content can be safely deleted.

## Requirements

1. Delete ALL files and folders in Drive root folder before seeding
2. Handle pagination for accounts with >1000 items
3. Use batch deletion for performance (up to 100 items per request)
4. Empty the trash completely
5. Verify trash is empty before proceeding (poll until confirmed)
6. Abort entirely if cleanup fails (clean slate or nothing)
7. Use existing `ALLOW_SEEDING=true` as the only safeguard (no additional confirmation)

## New Flow

```
1. Validate environment (existing)
2. [NEW] Delete ALL files/folders in Drive root folder (with pagination + batch delete)
3. [NEW] Empty trash
4. [NEW] Verify trash is empty (poll until confirmed)
5. Cleanup seed users from database (existing)
6. Create seed users (existing)
7. Create Drive connection (existing)
8. Seed content (existing)
```

**Important Behaviors:**

- **Cascading deletes:** When a folder is deleted, Google Drive automatically deletes all nested contents. We only need to delete items directly in the root folder.
- **Partial failure state:** If Drive cleanup succeeds but database cleanup fails, the Drive is empty but DB has stale data. Re-running the seed script will fix this (DB cleanup runs again).

## Implementation Details

### New Function: `cleanupGoogleDrive()`

Add to `prisma/seed.ts`:

```typescript
import type { drive_v3 } from "googleapis";

/**
 * Cleans all content from the seed Google Drive account.
 * Deletes all files/folders in root, empties trash, and verifies empty.
 *
 * Note: Deleting a folder cascades to all nested contents (Google Drive behavior).
 * We only need to delete items directly in the root folder.
 *
 * @throws Error if cleanup fails at any step (abort seed on failure)
 */
async function cleanupGoogleDrive(): Promise<void> {
  const refreshToken = process.env.GOOGLE_TEST_REFRESH_TOKEN;
  const rootFolderId = process.env.GOOGLE_TEST_ROOT_FOLDER_ID;

  if (!refreshToken || !rootFolderId) {
    throw new Error("Drive credentials required for cleanup");
  }

  const { getDriveClientFromRefreshToken, batchDelete, emptyTrash } =
    await import("@/lib/google-drive-client");

  const drive = await getDriveClientFromRefreshToken(refreshToken);

  // 1. List ALL items in root folder with pagination
  const allItems: Array<{ id: string; name: string }> = [];
  let pageToken: string | undefined;

  do {
    const response = await drive.files.list({
      q: `'${rootFolderId}' in parents and trashed = false`,
      fields: "files(id, name), nextPageToken",
      pageSize: 1000,
      pageToken,
    });

    const items = response.data.files || [];
    for (const item of items) {
      if (item.id && item.name) {
        allItems.push({ id: item.id, name: item.name });
      }
    }

    pageToken = response.data.nextPageToken ?? undefined;
  } while (pageToken);

  console.log(`🗑️  Found ${allItems.length} items to delete`);

  // 2. Batch delete items (100 per batch for efficiency)
  if (allItems.length > 0) {
    const fileIds = allItems.map((item) => item.id);

    // batchDelete handles chunking into batches of 100
    await batchDelete(drive, fileIds, rootFolderId);

    console.log(`🗑️  Deleted ${allItems.length} items`);
  }

  // 3. Empty trash (catches any pre-existing trashed items)
  console.log("🗑️  Emptying trash...");
  await emptyTrash(drive);

  // 4. Verify trash is empty (poll with timeout)
  await verifyTrashEmpty(drive);
}

/**
 * Polls Google Drive until trash is confirmed empty.
 * Google Drive trash emptying can be async, so we verify completion.
 *
 * @param drive - Google Drive client instance
 * @throws Error if trash not empty after 30 seconds
 */
async function verifyTrashEmpty(drive: drive_v3.Drive): Promise<void> {
  const POLL_INTERVAL_MS = 2000;
  const TIMEOUT_MS = 30000;
  const startTime = Date.now();

  while (Date.now() - startTime < TIMEOUT_MS) {
    const response = await drive.files.list({
      q: "trashed = true",
      fields: "files(id)",
      pageSize: 1,
    });

    const trashedItems = response.data.files || [];
    if (trashedItems.length === 0) {
      console.log("✅ Trash verified empty");
      return;
    }

    console.log("  ⏳ Waiting for trash to empty...");
    await sleep(POLL_INTERVAL_MS);
  }

  throw new Error("Timeout: Trash not empty after 30 seconds");
}
```

### Call Site in `main()`

```typescript
async function main(): Promise<void> {
  // ... existing validation ...

  // Dynamic import of prisma after env vars are loaded
  const prismaModule = await import("@/lib/prisma");
  prisma = prismaModule.prisma;

  // NEW: Clean Google Drive first (unless skipping Drive)
  // Note: If this succeeds but DB cleanup fails, re-running seed will fix it
  if (!SEED_SKIP_DRIVE) {
    console.log("\n🧹 Cleaning Google Drive...\n");
    await cleanupGoogleDrive();
  }

  // Existing: Cleanup seed users from database
  await cleanupSeedUsers();

  // ... rest of existing seed logic ...
}
```

### Required Type Import

Add at top of `prisma/seed.ts`:

```typescript
import type { drive_v3 } from "googleapis";
```

## Files to Modify

| File | Changes |
|------|---------|
| `prisma/seed.ts` | Add type import, `cleanupGoogleDrive()`, `verifyTrashEmpty()`, call before `cleanupSeedUsers()` |
| `prisma/seed-config.ts` | Remove `PROTECTED_FOLDERS` export |

## Files to Delete

| File | Reason |
|------|--------|
| `prisma/seed-cleanup.ts` | Functionality merged into `seed.ts` |

## Testing Strategy

### Unit Tests (`tests/unit/prisma/seed.test.ts`)

**Tests to Add:**

| Test | Description |
|------|-------------|
| `cleanupGoogleDrive deletes all items in root` | Mock Drive API, verify `batchDelete` called with all item IDs |
| `cleanupGoogleDrive handles pagination for >1000 items` | Mock multiple pages with `nextPageToken`, verify all pages fetched |
| `cleanupGoogleDrive uses batch delete for efficiency` | Verify `batchDelete` called instead of individual `permanentlyDeleteFile` calls |
| `cleanupGoogleDrive empties trash` | Mock Drive API, verify `emptyTrash` called |
| `cleanupGoogleDrive handles empty root folder` | Mock empty file list, verify no delete calls, trash still emptied |
| `verifyTrashEmpty polls until empty` | Mock responses: non-empty → non-empty → empty, verify 3 calls with delays |
| `verifyTrashEmpty times out after 30s` | Mock never-empty trash, verify throws error after timeout |
| `cleanup failure aborts seed` | Mock Drive error, verify seed doesn't proceed to database operations |
| `cleanup skipped when SEED_SKIP_DRIVE=true` | Verify no Drive calls when flag set |

**Tests to Remove:**

- Any tests referencing `PROTECTED_FOLDERS`

### Integration Tests (`tests/integration/seed/seed.test.ts`)

**Tests to Add:**

| Test | Description |
|------|-------------|
| `database cleanup succeeds independently of Drive cleanup` | Verify DB operations work with mocked Drive |
| `cleanup handles Drive API rate limiting` | Mock 429 response, verify appropriate retry/error handling |

**Tests to Remove:**

- Tests for `seed-cleanup.ts` functionality (if any)

### No E2E Tests

The seed script is a developer tool, not a user-facing feature. E2E coverage is not required.

## Documentation Updates

1. Update `prisma/seed.ts` file header to document the new cleanup-first flow
2. Remove any references to `prisma/seed-cleanup.ts` from:
   - `CLAUDE.md` (if present)
   - Any README or usage documentation

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Drive credentials missing | Throw error, abort seed |
| Failed to list items | Throw error, abort seed |
| Failed to delete items (batch) | Throw error, abort seed |
| Failed to empty trash | Throw error, abort seed |
| Trash not empty after 30s | Throw error, abort seed |
| `SEED_SKIP_DRIVE=true` | Skip all Drive cleanup, proceed with database-only seed |
| Drive cleanup succeeds, DB cleanup fails | Drive is empty, DB has stale data. Re-run seed to fix. |

## Cascading Delete Behavior

When deleting folders from Google Drive:

- Google Drive automatically deletes all nested files and subfolders
- We only need to delete items directly in the root folder
- This is efficient: one delete call removes an entire folder tree
- If a folder delete fails partway through, nested items may be orphaned in trash
- The `emptyTrash()` call handles any orphaned items

## Performance Considerations

- **Batch deletion:** Uses `batchDelete()` which sends up to 100 delete requests in a single HTTP call
- **Pagination:** Handles accounts with >1000 items by following `nextPageToken`
- **Parallel within batch:** Google's batch API processes requests in parallel server-side
- **Rate limiting:** The existing `batchDelete` implementation includes rate limiting via Bottleneck

## Rollback Plan

If issues arise, the previous behavior can be restored by:
1. Reverting `prisma/seed.ts` changes
2. Restoring `prisma/seed-cleanup.ts` from git
3. Restoring `PROTECTED_FOLDERS` in `prisma/seed-config.ts`
