# Seed Media Upload Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extend the database seeding system to upload all files from `seed-media/` to the SFTP server and configure WebDAV for media streaming.

**Architecture:** The seed script gains file upload capability using existing `sftp-client.ts` functions. Files are uploaded before database records are created, ensuring SFTP paths always point to existing files.

**Tech Stack:** Prisma seed script, ssh2-sftp-client, Node.js fs/path modules

---

## Overview

The current seed creates database records with `sftpPath` values pointing to files that don't exist on the SFTP server. This design adds:

1. **WebDAV Configuration** - When `SFTP_SEED_HTTPS_URL` is set, configure WebDAV credentials (same as SFTP) for media streaming
2. **File Upload** - Walk `seed-media/` directory and upload all 111 files to SFTP server

### Data Flow

```
seed.ts main()
  → validateEnvironment()
  → cleanupSeedUsers()
  → createUsers()
  → createSftpConnection() [now with WebDAV]
  → uploadSeedMedia() [NEW - uploads 111 files]
  → seedAlexDemo() [creates DB records pointing to uploaded files]
```

---

## Environment Variables

```bash
# Required for SFTP upload
SFTP_SEED_HOST="your-sftp-server.com"
SFTP_SEED_PORT="22"
SFTP_SEED_USERNAME="username"
SFTP_SEED_PASSWORD="password"
SFTP_SEED_BASE_PATH="/"

# Optional for WebDAV streaming
SFTP_SEED_HTTPS_URL="https://your-webdav-server.com"
```

---

## Implementation Details

### WebDAV Configuration

Update `createSftpConnection()` to include WebDAV fields when `SFTP_SEED_HTTPS_URL` is set:

```typescript
// New WebDAV fields
webdavUrl: process.env.SFTP_SEED_HTTPS_URL,
webdavUsername: username,  // Same as SFTP
encryptedWebdavPassword: encryptedPassword,  // Same credential
```

### File Upload Function

```typescript
/**
 * Uploads all files from seed-media/ to the SFTP server.
 * Skips files that already exist to avoid re-uploading large media files.
 */
async function uploadSeedMedia(connection: SftpConnection): Promise<void> {
  const seedMediaPath = path.join(process.cwd(), "seed-media");

  // Discover all files, excluding .DS_Store
  const files = discoverSeedFiles(seedMediaPath);
  const total = files.length;

  let uploaded = 0;
  let skipped = 0;

  for (let i = 0; i < files.length; i++) {
    const localPath = files[i];
    const remotePath = mapLocalToRemotePath(localPath, seedMediaPath);
    const progress = Math.round(((i + 1) / total) * 100);

    // Check if file already exists - skip to avoid re-uploading large files
    const exists = await checkFileExists(connection, remotePath);
    if (exists) {
      console.log(`  ⏭️  [${i + 1}/${total}] Skipping (exists): ${remotePath}`);
      skipped++;
      continue;
    }

    // Ensure parent directory exists
    const parentDir = path.dirname(remotePath);
    await createDirectory(connection, parentDir);

    // Upload file
    await uploadFile(connection, localPath, remotePath);
    console.log(
      `  ✅ [${i + 1}/${total}] (${progress}%) Uploaded: ${remotePath}`
    );
    uploaded++;
  }

  console.log(`📊 Upload complete: ${uploaded} uploaded, ${skipped} skipped`);
}
```

### Helper Functions

```typescript
/**
 * Recursively discovers all files in a directory.
 * Excludes .DS_Store and other system files.
 */
function discoverSeedFiles(dirPath: string): string[] {
  const files: string[] = [];

  function walk(dir: string): void {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && !entry.name.startsWith(".")) {
        files.push(fullPath);
      }
    }
  }

  walk(dirPath);
  return files;
}

/**
 * Maps a local file path to its remote SFTP path.
 */
function mapLocalToRemotePath(localPath: string, basePath: string): string {
  const relativePath = path.relative(basePath, localPath);
  return "/" + relativePath.split(path.sep).join("/");
}
```

### New SFTP Client Helper

Add to `lib/sftp-client.ts`:

```typescript
/**
 * Checks if a file or directory exists on the remote server.
 * Uses the native exists() method from ssh2-sftp-client.
 *
 * @param connection - SFTP connection configuration
 * @param remotePath - Path to check on SFTP server
 * @returns True if file/directory exists, false otherwise
 */
export async function checkFileExists(
  connection: SftpConnection,
  remotePath: string
): Promise<boolean> {
  const client = await getConnection(connection);
  const result = await client.exists(remotePath);
  return result !== false; // exists() returns 'd', '-', 'l' or false
}
```

---

## Error Handling

### SFTP Connection Failures

```typescript
try {
  await uploadSeedMedia(connection);
} catch (error) {
  console.error("⚠️  Failed to upload seed media:", error.message);
  console.error("   Continuing with database seeding (artwork won't display)");
}
```

### Individual File Failures

If a single file fails, log the error and continue with remaining files.

### Edge Cases

| Case                        | Behavior                             |
| --------------------------- | ------------------------------------ |
| File already exists on SFTP | Skip (don't overwrite)               |
| File doesn't exist on SFTP  | Upload it                            |
| `seed-media/` doesn't exist | Skip upload, warn user               |
| SFTP credentials not set    | Skip upload entirely                 |
| `.DS_Store` files           | Filter out before upload             |
| Empty directories           | Create directory, no files to upload |

---

## Path Fix

Update "The Office (UK)" to "The Office" in `seed.ts` to match the `seed-media/` directory structure (3 occurrences).

---

## Testing Strategy

### Unit Tests (`tests/unit/prisma/seed-upload.test.ts`)

| Test                                              | Purpose                        |
| ------------------------------------------------- | ------------------------------ |
| `discoverSeedFiles()` returns correct file list   | Verify directory walking logic |
| `discoverSeedFiles()` excludes .DS_Store files    | Filter logic works             |
| `mapLocalToRemotePath()` calculates correct paths | Path transformation            |
| `mapLocalToRemotePath()` handles spaces in paths  | Edge case for movie titles     |

### Unit Tests (`tests/unit/lib/sftp-client.test.ts`)

| Test                                                | Purpose                              |
| --------------------------------------------------- | ------------------------------------ |
| `checkFileExists()` returns true when file exists   | Verify exists() returns truthy value |
| `checkFileExists()` returns false when file missing | Verify exists() returns false        |

### Integration Tests

Skip - E2E tests already cover real SFTP operations.

### Manual Verification

1. Run `pnpm run db:seed`
2. Login as `seed@canoncore.com`
3. Verify artwork thumbnails display in grid view
4. Click a movie → verify media player loads (if WebDAV configured)

---

## Files Changed

| File                                    | Changes                                                        |
| --------------------------------------- | -------------------------------------------------------------- |
| `prisma/seed.ts`                        | Add WebDAV config, file upload function, fix "The Office" path |
| `lib/sftp-client.ts`                    | Add `checkFileExists()` helper using native `exists()` method  |
| `tests/unit/prisma/seed-upload.test.ts` | Unit tests for upload helpers (new file, 4 tests)              |
| `tests/unit/lib/sftp-client.test.ts`    | Unit tests for `checkFileExists()` (new file, 2 tests)         |

---

## Success Criteria

| Criteria                             | Verification                            |
| ------------------------------------ | --------------------------------------- |
| WebDAV configured when env var set   | Check DB record has WebDAV fields       |
| All 111 files uploaded on first seed | Console shows "111 uploaded, 0 skipped" |
| Subsequent seeds skip existing files | Console shows "0 uploaded, 111 skipped" |
| Artwork displays in dashboard        | Login as seed user, see thumbnails      |
| Media streams (with WebDAV)          | Click media file, player loads          |
| Unit tests pass                      | `pnpm run test:unit` passes             |
| All checks pass                      | `pnpm run check` passes                 |

---

## Summary

- ~150 lines of new code in `seed.ts`
- ~10 lines new helper in `sftp-client.ts` (using native `exists()` method)
- ~60 lines of unit tests (6 tests total: 4 for seed helpers, 2 for SFTP client)
- No new dependencies
