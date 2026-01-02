# Bidirectional SFTP CRUD Operations Design

## Overview

A bidirectional file synchronization system between the web application and user-owned SFTP servers. Users configure their existing SFTP server credentials, and the web app performs CRUD operations on files/folders that stay synchronized between both interfaces.

## Summary

| Feature            | Implementation                                                 |
| ------------------ | -------------------------------------------------------------- |
| SFTP Client        | `ssh2-sftp-client` (promise-based wrapper around ssh2)         |
| Sync Direction     | Bidirectional: Web ↔ SFTP                                      |
| Sync Trigger       | On-demand (manual) + polling for SFTP→Web + SSE progress       |
| Credential Storage | AES-256-GCM encrypted at rest                                  |
| File Storage       | Files stored on user's SFTP server (not in our infrastructure) |
| Metadata Storage   | PostgreSQL (Prisma) for sync state, checksums, timestamps      |
| Auth               | Password or SSH private key authentication                     |
| File Limits        | 50MB upload, 10MB direct download (streaming for larger)       |
| Rate Limiting      | 5/min connection ops, 10/min sync ops                          |

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Web Browser   │────▶│   Next.js App   │────▶│  User's SFTP    │
│   (React UI)    │◀────│  (Server Acts)  │◀────│    Server       │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │
        │ SSE (progress)        ▼
        └──────────────▶ ┌─────────────────┐
                         │   PostgreSQL    │
                         │   (Metadata)    │
                         └─────────────────┘
```

### Data Flow

**Web → SFTP (User uploads/creates via web UI):**

1. User triggers action in web UI (upload file, create folder, rename, delete)
2. Server action validates request, sanitizes paths, and verifies ownership
3. Rate limiter checks operation quota
4. SFTP client connects to user's server using decrypted credentials
5. Operation executed on SFTP server with timeout wrapper
6. Database updated with new metadata and sync status
7. UI refreshed with success/error feedback

**SFTP → Web (Changes made directly on SFTP server):**

1. User triggers manual sync (or polling interval fires)
2. SSE connection opened for progress updates
3. SFTP client recursively lists directory contents
4. Compare SFTP state with database records (using mtime + checksum)
5. Detect additions, modifications, deletions, conflicts
6. Update database to reflect SFTP state
7. UI refreshed with new items via SSE completion event

## Database Schema

### Extended Item Model

```prisma
model Item {
  id        String   @id @default(cuid())
  name      String
  order     Int      @default(0)
  depth     Int      @default(0)

  // Hierarchy
  parentId  String?
  parent    Item?    @relation("ItemChildren", fields: [parentId], references: [id], onDelete: Cascade)
  children  Item[]   @relation("ItemChildren")

  // Ownership
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  // SFTP-specific fields
  type           ItemType   @default(FOLDER)
  sftpPath       String?    // Full path on SFTP server, e.g., "/uploads/docs/file.pdf"
  mimeType       String?    // MIME type for files
  size           BigInt?    // File size in bytes
  checksum       String?    // SHA-256 hash for change detection
  syncStatus     SyncStatus @default(SYNCED)
  lastSyncedAt   DateTime?
  sftpModifiedAt DateTime?  // mtime from SFTP server

  // Connection reference
  connectionId   String?
  connection     SftpConnection? @relation(fields: [connectionId], references: [id], onDelete: SetNull)

  // Timestamps
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([parentId])
  @@index([userId])
  @@index([userId, parentId, order])
  @@index([connectionId, sftpPath])
  @@index([syncStatus])
}

enum ItemType {
  FOLDER
  FILE
}

enum SyncStatus {
  SYNCED           // In sync with SFTP
  PENDING_UPLOAD   // Local changes not yet on SFTP
  PENDING_DOWNLOAD // SFTP changes not yet in DB
  CONFLICT         // Modified on both sides
  ERROR            // Sync failed
}
```

### New SftpConnection Model

```prisma
model SftpConnection {
  id                  String    @id @default(cuid())

  // Ownership
  userId              String
  user                User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Connection details
  name                String    // Display name: "My Server", "Production"
  host                String    // Hostname or IP
  port                Int       @default(22)
  username            String
  authType            AuthType  @default(PASSWORD)
  encryptedCredential String    // AES-256-GCM encrypted password or private key
  basePath            String    @default("/") // Root sync directory

  // Status
  isActive            Boolean   @default(true)
  lastConnectedAt     DateTime?
  lastSyncAt          DateTime?
  lastError           String?

  // Related items
  items               Item[]

  // Timestamps
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt

  @@unique([userId, name])
  @@index([userId])
}

enum AuthType {
  PASSWORD
  PRIVATE_KEY
}
```

### User Model Extension

```prisma
model User {
  // ... existing fields
  items           Item[]
  sftpConnections SftpConnection[]
}
```

## Utilities

### lib/sftp-utils.ts

```typescript
/**
 * SFTP path and filename utilities.
 * Provides security validation to prevent directory traversal attacks.
 */

/**
 * Sanitizes a path to prevent directory traversal attacks.
 * Ensures the resolved path stays within the allowed base path.
 *
 * @param basePath - The allowed root directory
 * @param userPath - The user-provided path segment
 * @returns Sanitized absolute path
 * @throws If path attempts to escape basePath
 *
 * @example
 * sanitizePath("/home/user", "docs/file.txt") // "/home/user/docs/file.txt"
 * sanitizePath("/home/user", "../etc/passwd") // throws Error
 */
export function sanitizePath(basePath: string, userPath: string): string {
  const normalizedBase = basePath.replace(/\/+$/, "") || "/";
  const normalizedUser = userPath.replace(/^\/+/, "");

  const segments = normalizedUser.split("/").filter((s) => s && s !== ".");

  const resolvedSegments: string[] = [];
  for (const segment of segments) {
    if (segment === "..") {
      throw new Error("Path traversal not allowed");
    }
    resolvedSegments.push(segment);
  }

  const resolvedPath =
    `${normalizedBase}/${resolvedSegments.join("/")}`.replace(/\/+/g, "/");

  if (!resolvedPath.startsWith(normalizedBase)) {
    throw new Error("Path traversal not allowed");
  }

  return resolvedPath;
}

/**
 * Validates a filename against safe characters.
 *
 * @param name - Filename to validate
 * @throws If filename contains invalid characters
 */
export function validateFileName(name: string): void {
  const invalidChars = /[<>:"/\\|?*\x00-\x1f]/;
  if (invalidChars.test(name)) {
    throw new Error("Filename contains invalid characters");
  }
  if (name === "." || name === "..") {
    throw new Error("Invalid filename");
  }
  if (name.length > 255) {
    throw new Error("Filename too long");
  }
}

/**
 * Wraps an async operation with a timeout.
 *
 * @param promise - The promise to wrap
 * @param timeoutMs - Timeout in milliseconds
 * @param operation - Operation name for error message
 * @returns The promise result
 * @throws If operation times out
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operation: string
): Promise<T> {
  let timeoutId: NodeJS.Timeout;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${operation} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutId!);
  }
}
```

## SFTP Client Service

### lib/sftp-client.ts

```typescript
/**
 * SFTP client service for connecting to user SFTP servers.
 * Wraps ssh2-sftp-client with connection pooling, mutex locks, and streaming support.
 */

import Client from "ssh2-sftp-client";
import { PassThrough, Readable } from "stream";
import { decryptCredential } from "@/lib/crypto";
import { withTimeout } from "@/lib/sftp-utils";
import type { SftpConnection } from "@prisma/client";

/** File information returned from SFTP directory listing. */
export interface SftpFileInfo {
  name: string;
  type: "d" | "-" | "l";
  size: number;
  modifyTime: number;
  accessTime: number;
  rights: { user: string; group: string; other: string };
  owner: number;
  group: number;
}

/** Result of a sync operation. */
export interface SyncResult {
  added: number;
  updated: number;
  deleted: number;
  conflicts: number;
  errors: string[];
}

/** Paginated directory listing result. */
export interface PaginatedListing {
  files: SftpFileInfo[];
  total: number;
  hasMore: boolean;
}

// Connection pool with mutex locks to prevent race conditions
const connectionPool = new Map<string, { client: Client; lastUsed: number }>();
const connectionLocks = new Map<string, Promise<Client>>();
const POOL_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const OPERATION_TIMEOUT_MS = 30 * 1000; // 30 seconds per operation

/**
 * Gets or creates an SFTP connection from the pool with mutex lock.
 * Prevents race conditions when multiple requests try to create connections.
 *
 * @param connection - SFTP connection configuration
 * @returns Connected SFTP client
 */
export async function getConnection(
  connection: SftpConnection
): Promise<Client> {
  // Check if connection exists in pool
  const pooled = connectionPool.get(connection.id);
  if (pooled) {
    pooled.lastUsed = Date.now();
    return pooled.client;
  }

  // Check if connection is being created (mutex)
  const existingLock = connectionLocks.get(connection.id);
  if (existingLock) {
    return existingLock;
  }

  // Create new connection with lock
  const connectionPromise = (async () => {
    try {
      const client = new Client();
      const credential = decryptCredential(connection.encryptedCredential);

      await withTimeout(
        client.connect({
          host: connection.host,
          port: connection.port,
          username: connection.username,
          ...(connection.authType === "PASSWORD"
            ? { password: credential }
            : { privateKey: credential }),
          readyTimeout: 10000,
          retries: 2,
          retry_minTimeout: 2000,
        }),
        15000,
        "SFTP connection"
      );

      connectionPool.set(connection.id, { client, lastUsed: Date.now() });
      return client;
    } finally {
      connectionLocks.delete(connection.id);
    }
  })();

  connectionLocks.set(connection.id, connectionPromise);
  return connectionPromise;
}

/**
 * Closes and removes a connection from the pool.
 *
 * @param connectionId - ID of connection to close
 */
export async function closeConnection(connectionId: string): Promise<void> {
  const pooled = connectionPool.get(connectionId);
  if (pooled) {
    await pooled.client.end();
    connectionPool.delete(connectionId);
  }
}

/**
 * Lists contents of a remote directory with optional pagination.
 *
 * @param connection - SFTP connection configuration
 * @param remotePath - Path to list
 * @param options - Pagination options
 * @returns Paginated file/directory info
 */
export async function listDirectory(
  connection: SftpConnection,
  remotePath: string,
  options?: { offset?: number; limit?: number }
): Promise<PaginatedListing> {
  const client = await getConnection(connection);
  const allFiles = await withTimeout(
    client.list(remotePath) as Promise<SftpFileInfo[]>,
    OPERATION_TIMEOUT_MS,
    "list directory"
  );

  const total = allFiles.length;
  const offset = options?.offset ?? 0;
  const limit = options?.limit ?? total;

  return {
    files: allFiles.slice(offset, offset + limit),
    total,
    hasMore: offset + limit < total,
  };
}

/**
 * Recursively lists all files and directories.
 *
 * @param connection - SFTP connection configuration
 * @param remotePath - Starting path
 * @param onProgress - Progress callback
 * @returns All files/directories with full paths
 */
export async function listDirectoryRecursive(
  connection: SftpConnection,
  remotePath: string,
  onProgress?: (scanned: number) => void
): Promise<Array<SftpFileInfo & { fullPath: string }>> {
  const results: Array<SftpFileInfo & { fullPath: string }> = [];
  const queue: string[] = [remotePath];
  let scanned = 0;

  while (queue.length > 0) {
    const currentPath = queue.shift()!;
    const { files } = await listDirectory(connection, currentPath);

    for (const file of files) {
      const fullPath = `${currentPath}/${file.name}`.replace(/\/+/g, "/");
      results.push({ ...file, fullPath });
      scanned++;

      if (onProgress) onProgress(scanned);

      if (file.type === "d") {
        queue.push(fullPath);
      }
    }
  }

  return results;
}

/**
 * Uploads a file to the remote server.
 *
 * @param connection - SFTP connection configuration
 * @param source - Local file path or Buffer
 * @param remotePath - Destination path on SFTP server
 */
export async function uploadFile(
  connection: SftpConnection,
  source: string | Buffer,
  remotePath: string
): Promise<void> {
  const client = await getConnection(connection);
  await withTimeout(
    client.put(source, remotePath),
    OPERATION_TIMEOUT_MS,
    "upload file"
  );
}

/**
 * Downloads a file as a Buffer (for files <= 10MB).
 *
 * @param connection - SFTP connection configuration
 * @param remotePath - Path on SFTP server
 * @returns File contents as Buffer
 */
export async function downloadFileBuffer(
  connection: SftpConnection,
  remotePath: string
): Promise<Buffer> {
  const client = await getConnection(connection);
  return withTimeout(
    client.get(remotePath) as Promise<Buffer>,
    OPERATION_TIMEOUT_MS,
    "download file"
  );
}

/**
 * Downloads a file as a readable stream (for files > 10MB).
 * Uses PassThrough to pipe SFTP data to a readable stream.
 *
 * @param connection - SFTP connection configuration
 * @param remotePath - Path on SFTP server
 * @returns Readable stream
 */
export async function downloadFileStream(
  connection: SftpConnection,
  remotePath: string
): Promise<Readable> {
  const client = await getConnection(connection);
  const passThrough = new PassThrough();

  // Pipe SFTP data to PassThrough stream
  client.get(remotePath, passThrough).catch((err: Error) => {
    passThrough.destroy(err);
  });

  return passThrough;
}

/**
 * Deletes a file from the remote server.
 *
 * @param connection - SFTP connection configuration
 * @param remotePath - Path to delete
 */
export async function deleteFile(
  connection: SftpConnection,
  remotePath: string
): Promise<void> {
  const client = await getConnection(connection);
  await withTimeout(
    client.delete(remotePath),
    OPERATION_TIMEOUT_MS,
    "delete file"
  );
}

/**
 * Renames/moves a file or directory.
 *
 * @param connection - SFTP connection configuration
 * @param oldPath - Current path
 * @param newPath - New path
 */
export async function rename(
  connection: SftpConnection,
  oldPath: string,
  newPath: string
): Promise<void> {
  const client = await getConnection(connection);
  await withTimeout(
    client.rename(oldPath, newPath),
    OPERATION_TIMEOUT_MS,
    "rename"
  );
}

/**
 * Creates a directory on the remote server.
 *
 * @param connection - SFTP connection configuration
 * @param remotePath - Path to create
 * @param recursive - Create parent directories if needed
 */
export async function createDirectory(
  connection: SftpConnection,
  remotePath: string,
  recursive = true
): Promise<void> {
  const client = await getConnection(connection);
  await withTimeout(
    client.mkdir(remotePath, recursive),
    OPERATION_TIMEOUT_MS,
    "create directory"
  );
}

/**
 * Removes a directory from the remote server.
 *
 * @param connection - SFTP connection configuration
 * @param remotePath - Path to remove
 */
export async function removeDirectory(
  connection: SftpConnection,
  remotePath: string
): Promise<void> {
  const client = await getConnection(connection);
  await withTimeout(
    client.rmdir(remotePath, true),
    OPERATION_TIMEOUT_MS,
    "remove directory"
  );
}

/**
 * Checks if a path exists on the remote server.
 *
 * @param connection - SFTP connection configuration
 * @param remotePath - Path to check
 * @returns Boolean or type string ("d", "-", "l")
 */
export async function exists(
  connection: SftpConnection,
  remotePath: string
): Promise<false | "d" | "-" | "l"> {
  const client = await getConnection(connection);
  return withTimeout(
    client.exists(remotePath),
    OPERATION_TIMEOUT_MS,
    "check exists"
  );
}

/**
 * Gets file stats from the remote server.
 *
 * @param connection - SFTP connection configuration
 * @param remotePath - Path to stat
 * @returns File stats object
 */
export async function stat(
  connection: SftpConnection,
  remotePath: string
): Promise<{ size: number; modifyTime: number; isDirectory: boolean }> {
  const client = await getConnection(connection);
  const stats = await withTimeout(
    client.stat(remotePath),
    OPERATION_TIMEOUT_MS,
    "get stats"
  );
  return {
    size: stats.size,
    modifyTime: stats.modifyTime,
    isDirectory: stats.isDirectory,
  };
}

// Cleanup stale connections periodically
setInterval(() => {
  const now = Date.now();
  for (const [id, pooled] of connectionPool.entries()) {
    if (now - pooled.lastUsed > POOL_TIMEOUT_MS) {
      pooled.client.end().catch(() => {});
      connectionPool.delete(id);
    }
  }
}, 60000);
```

### lib/crypto.ts

```typescript
/**
 * Cryptographic utilities for secure credential storage.
 * Uses AES-256-GCM for authenticated encryption.
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Gets the encryption key from environment variable.
 * Must be 32 bytes (256 bits) for AES-256.
 *
 * @returns Encryption key as Buffer
 * @throws If ENCRYPTION_KEY is not set or invalid length
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error("ENCRYPTION_KEY environment variable is required");
  }

  const keyBuffer = Buffer.from(key, "base64");
  if (keyBuffer.length !== 32) {
    throw new Error("ENCRYPTION_KEY must be 32 bytes (256 bits)");
  }

  return keyBuffer;
}

/**
 * Encrypts a credential string using AES-256-GCM.
 *
 * @param plaintext - The credential to encrypt
 * @returns Base64-encoded encrypted string (IV + AuthTag + Ciphertext)
 *
 * @example
 * const encrypted = encryptCredential("my-sftp-password");
 */
export function encryptCredential(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();
  const combined = Buffer.concat([iv, authTag, encrypted]);
  return combined.toString("base64");
}

/**
 * Decrypts a credential string encrypted with encryptCredential.
 *
 * @param ciphertext - Base64-encoded encrypted string
 * @returns Decrypted plaintext credential
 * @throws If decryption fails (invalid key, tampered data)
 *
 * @example
 * const password = decryptCredential(connection.encryptedCredential);
 */
export function decryptCredential(ciphertext: string): string {
  const key = getEncryptionKey();
  const combined = Buffer.from(ciphertext, "base64");

  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}
```

## Server Actions

See `lib/sftp-actions.ts` for full implementation including:

- `createSftpConnection` - Create new SFTP connection with encrypted credentials
- `updateSftpConnection` - Update existing connection
- `deleteSftpConnection` - Delete connection and close active sessions
- `testSftpConnection` - Test connection and measure latency
- `syncFromSftp` - Recursive sync from SFTP to database with conflict detection
- `uploadToSftp` - Upload file with validation and size limits (50MB max)
- `createSftpFolder` - Create folder with path sanitization
- `deleteSftpItem` - Delete file or folder from SFTP and database
- `renameSftpItem` - Rename with validation
- `downloadFromSftp` - Download with streaming for large files (>10MB)

All actions include:

- Session authentication
- Rate limiting (5/min connection ops, 10/min sync ops)
- Path traversal prevention via `sanitizePath()`
- Filename validation via `validateFileName()`
- Operation timeouts (30s default)

## Validations

### lib/validations.ts (additions)

```typescript
export const sftpConnectionSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long"),
  host: z.string().min(1, "Host is required").max(255, "Host too long"),
  port: z.number().int().min(1).max(65535).default(22),
  username: z
    .string()
    .min(1, "Username is required")
    .max(100, "Username too long"),
  authType: z.enum(["PASSWORD", "PRIVATE_KEY"]),
  credential: z.string().min(1, "Credential is required"),
  basePath: z.string().default("/"),
});

export const sftpFileNameSchema = z
  .string()
  .min(1, "Name is required")
  .max(255, "Name too long")
  .regex(/^[^<>:"/\\|?*\x00-\x1f]+$/, "Name contains invalid characters");
```

## Environment Variables

Add to `.env.local`:

```bash
# SFTP Credential Encryption (generate with: openssl rand -base64 32)
ENCRYPTION_KEY=

# SFTP Server for development/testing
SFTP_SEED_HOST=
SFTP_SEED_PORT=
SFTP_SEED_USERNAME=
SFTP_SEED_PASSWORD=
SFTP_SEED_BASE_PATH=
SFTP_SEED_HTTPS_URL=
```

## UI Components

### Route Structure

```
app/
├── (dashboard)/
│   ├── dashboard/
│   │   ├── connections/
│   │   │   ├── page.tsx                # List SFTP connections
│   │   │   ├── new/page.tsx            # Add new connection
│   │   │   └── [connectionId]/
│   │   │       └── edit/page.tsx       # Edit connection
├── api/
│   └── sftp/
│       └── download/
│           └── [itemId]/route.ts       # Streaming download endpoint
```

### Components

```
components/sftp/
├── connection-form.tsx             # Add/edit connection form
├── connection-card.tsx             # Connection card with status
├── connection-test-button.tsx      # Test connection button
├── sync-button.tsx                 # Manual sync with progress
├── sync-progress.tsx               # SSE-based progress display
├── file-upload-dialog.tsx          # Upload file modal
├── download-button.tsx             # Download (handles streaming)
└── sync-status-badge.tsx           # Visual sync status
```

## Testing Strategy

### Unit Tests (tests/unit/lib/)

| File                   | Description                                   |
| ---------------------- | --------------------------------------------- |
| `sftp-client.test.ts`  | Connection pooling, mutex, timeout, streaming |
| `sftp-actions.test.ts` | Server action logic with mocked SFTP client   |
| `sftp-utils.test.ts`   | Path sanitization, filename validation        |
| `crypto.test.ts`       | Encryption/decryption correctness             |

### Integration Tests (tests/integration/sftp/)

| File                      | Description                              |
| ------------------------- | ---------------------------------------- |
| `sftp-connection.test.ts` | CRUD on SftpConnection model             |
| `sftp-item-sync.test.ts`  | Item creation with SFTP fields           |
| `sftp-actions-db.test.ts` | Server actions with real DB, mocked SFTP |

### E2E Tests (e2e/journeys/sftp/)

Real SFTP server via environment variables:

| File                       | Description                                     |
| -------------------------- | ----------------------------------------------- |
| `sftp-connection.spec.ts`  | Add, edit, delete, test SFTP connections via UI |
| `sftp-upload.spec.ts`      | Upload file through web → verify on SFTP        |
| `sftp-download.spec.ts`    | Download file from SFTP via web UI              |
| `sftp-sync.spec.ts`        | Trigger sync, verify new items appear           |
| `sftp-folder-ops.spec.ts`  | Create/rename/delete folders                    |
| `sftp-conflict.spec.ts`    | Modify on both sides, verify conflict state     |
| `sftp-errors.spec.ts`      | Invalid credentials, permission denied          |
| `sftp-large-files.spec.ts` | Streaming download for files > 10MB             |

## Files to Create

| Path                                                                 | Description                          |
| -------------------------------------------------------------------- | ------------------------------------ |
| `lib/sftp-client.ts`                                                 | SFTP client with pooling & streaming |
| `lib/sftp-actions.ts`                                                | SFTP server actions (full CRUD)      |
| `lib/sftp-utils.ts`                                                  | Path sanitization and validation     |
| `lib/crypto.ts`                                                      | AES-256-GCM encryption utilities     |
| `app/api/sftp/download/[itemId]/route.ts`                            | Streaming download endpoint          |
| `components/sftp/connection-form.tsx`                                | Add/edit connection form             |
| `components/sftp/connection-card.tsx`                                | Connection card component            |
| `components/sftp/connection-test-button.tsx`                         | Test connection button               |
| `components/sftp/sync-button.tsx`                                    | Manual sync trigger                  |
| `components/sftp/sync-progress.tsx`                                  | SSE-based progress display           |
| `components/sftp/file-upload-dialog.tsx`                             | Upload file modal                    |
| `components/sftp/download-button.tsx`                                | Download button (streaming)          |
| `components/sftp/sync-status-badge.tsx`                              | Sync status indicator                |
| `app/(dashboard)/dashboard/connections/page.tsx`                     | Connections list page                |
| `app/(dashboard)/dashboard/connections/new/page.tsx`                 | New connection page                  |
| `app/(dashboard)/dashboard/connections/[connectionId]/edit/page.tsx` | Edit connection                      |
| `tests/unit/lib/sftp-*.test.ts`                                      | Unit tests                           |
| `tests/integration/sftp/*.test.ts`                                   | Integration tests                    |
| `e2e/journeys/sftp/*.spec.ts`                                        | E2E tests                            |
| `e2e/pages/sftp-connections.page.ts`                                 | Page object                          |

## Dependencies

```bash
pnpm add ssh2-sftp-client
pnpm add -D @types/ssh2-sftp-client
```

## Security Considerations

1. **Credential Storage**: AES-256-GCM encryption with unique IV per credential
2. **Key Management**: `ENCRYPTION_KEY` stored in environment, rotatable
3. **Connection Isolation**: Each user's connections isolated by userId
4. **Path Traversal Prevention**: `sanitizePath()` validates all user-provided paths
5. **Input Validation**: `validateFileName()` rejects dangerous characters
6. **File Size Limits**: 50MB upload max, streaming for downloads > 10MB
7. **Rate Limiting**: 5/min for connection ops, 10/min for sync ops
8. **Operation Timeouts**: 30s timeout on all SFTP operations
9. **Mutex Locks**: Prevent connection pool race conditions
10. **Error Messages**: Generic errors to users, detailed logs for debugging
