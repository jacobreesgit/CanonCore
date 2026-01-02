# Bidirectional SFTP Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement bidirectional file sync between web app and user SFTP servers with encrypted credential storage.

**Architecture:** Server actions connect to user SFTP servers via ssh2-sftp-client with connection pooling. Credentials stored with AES-256-GCM encryption. Database tracks sync state, checksums, and file metadata.

**Tech Stack:** ssh2-sftp-client, Node.js crypto, Prisma, Next.js Server Actions, SSE for progress

**Commit Strategy:** NO intermediate commits. Single commit at the end after all tasks pass `pnpm run check`.

---

## Phase 1: Prerequisites

### Task 1: Generate Encryption Key

**Files:**

- Modify: `.env.local`

**Step 1: Generate a 32-byte encryption key**

Run:

```bash
openssl rand -base64 32
```

**Step 2: Add to .env.local**

Update `.env.local` - replace the commented line:

```bash
# SFTP Credential Encryption (generate with: openssl rand -base64 32)
ENCRYPTION_KEY="<paste-generated-key>"
```

---

### Task 2: Install Dependencies

**Files:**

- Modify: `package.json`

**Step 1: Install ssh2-sftp-client**

Run:

```bash
pnpm add ssh2-sftp-client
pnpm add -D @types/ssh2-sftp-client
```

**Step 2: Verify installation**

Run:

```bash
pnpm list ssh2-sftp-client
```

Expected: Shows ssh2-sftp-client version

---

## Phase 2: Database Schema

### Task 3: Update Prisma Schema

**Files:**

- Modify: `prisma/schema.prisma`

**Step 1: Add enums and SftpConnection model**

Add to `prisma/schema.prisma` after the existing models:

```prisma
enum ItemType {
  FOLDER
  FILE
}

enum SyncStatus {
  SYNCED
  PENDING_UPLOAD
  PENDING_DOWNLOAD
  CONFLICT
  ERROR
}

enum AuthType {
  PASSWORD
  PRIVATE_KEY
}

model SftpConnection {
  id                  String    @id @default(cuid())

  // Ownership
  userId              String
  user                User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Connection details
  name                String
  host                String
  port                Int       @default(22)
  username            String
  authType            AuthType  @default(PASSWORD)
  encryptedCredential String
  basePath            String    @default("/")

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
```

**Step 2: Extend Item model**

Replace the existing `Item` model with:

```prisma
model Item {
  id        String   @id @default(cuid())
  name      String
  order     Int      @default(0)
  depth     Int      @default(0)

  // Hierarchy (max 10 levels deep)
  parentId  String?
  parent    Item?    @relation("ItemChildren", fields: [parentId], references: [id], onDelete: Cascade)
  children  Item[]   @relation("ItemChildren")

  // Ownership
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  // SFTP-specific fields
  type           ItemType   @default(FOLDER)
  sftpPath       String?
  mimeType       String?
  size           BigInt?
  checksum       String?
  syncStatus     SyncStatus @default(SYNCED)
  lastSyncedAt   DateTime?
  sftpModifiedAt DateTime?

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
```

**Step 3: Add relation to User model**

Update `User` model to add `sftpConnections`:

```prisma
model User {
  id              String           @id @default(cuid())
  email           String           @unique
  emailVerified   DateTime?
  passwordHash    String
  name            String?
  image           String?
  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt
  passwordResets  PasswordReset[]
  items           Item[]
  sftpConnections SftpConnection[]
}
```

**Step 4: Run migration**

Run:

```bash
npx prisma migrate dev --name add_sftp_connection
```

Expected: Migration created and applied

**Step 5: Generate client**

Run:

```bash
npx prisma generate
```

---

## Phase 3: Core Utilities

### Task 4: Create Crypto Utilities

**Files:**

- Create: `lib/crypto.ts`
- Create: `tests/unit/lib/crypto.test.ts`

**Step 1: Create lib/crypto.ts**

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

**Step 2: Create tests/unit/lib/crypto.test.ts**

```typescript
/**
 * Unit tests for AES-256-GCM credential encryption.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("crypto", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    // Valid 32-byte key encoded as base64
    process.env.ENCRYPTION_KEY = "dGVzdGtleXRoYXRpczMyYnl0ZXNsb25nIQ==";
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("encryptCredential", () => {
    it("encrypts plaintext to base64 string", async () => {
      const { encryptCredential } = await import("@/lib/crypto");
      const encrypted = encryptCredential("my-secret-password");
      expect(typeof encrypted).toBe("string");
      expect(encrypted).not.toBe("my-secret-password");
      expect(encrypted.length).toBeGreaterThan(0);
    });

    it("produces different output for same input (random IV)", async () => {
      const { encryptCredential } = await import("@/lib/crypto");
      const encrypted1 = encryptCredential("password");
      const encrypted2 = encryptCredential("password");
      expect(encrypted1).not.toBe(encrypted2);
    });
  });

  describe("decryptCredential", () => {
    it("decrypts back to original plaintext", async () => {
      const { encryptCredential, decryptCredential } =
        await import("@/lib/crypto");
      const original = "my-secret-password";
      const encrypted = encryptCredential(original);
      const decrypted = decryptCredential(encrypted);
      expect(decrypted).toBe(original);
    });

    it("handles special characters", async () => {
      const { encryptCredential, decryptCredential } =
        await import("@/lib/crypto");
      const original = "p@$$w0rd!#$%^&*()_+-=[]{}|;':\",./<>?";
      const encrypted = encryptCredential(original);
      const decrypted = decryptCredential(encrypted);
      expect(decrypted).toBe(original);
    });

    it("throws on tampered ciphertext", async () => {
      const { encryptCredential, decryptCredential } =
        await import("@/lib/crypto");
      const encrypted = encryptCredential("password");
      const tampered = encrypted.slice(0, -4) + "XXXX";
      expect(() => decryptCredential(tampered)).toThrow();
    });
  });

  describe("missing ENCRYPTION_KEY", () => {
    it("throws when key is not set", async () => {
      delete process.env.ENCRYPTION_KEY;
      vi.resetModules();
      const { encryptCredential } = await import("@/lib/crypto");
      expect(() => encryptCredential("test")).toThrow(
        "ENCRYPTION_KEY environment variable is required"
      );
    });
  });
});
```

**Step 3: Run tests**

Run:

```bash
pnpm run test:unit -- tests/unit/lib/crypto.test.ts
```

Expected: All tests PASS

---

### Task 5: Create SFTP Path Utilities

**Files:**

- Create: `lib/sftp-utils.ts`
- Create: `tests/unit/lib/sftp-utils.test.ts`

**Step 1: Create lib/sftp-utils.ts**

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

**Step 2: Create tests/unit/lib/sftp-utils.test.ts**

```typescript
/**
 * Unit tests for SFTP path and filename utilities.
 */

import { describe, it, expect } from "vitest";
import { sanitizePath, validateFileName, withTimeout } from "@/lib/sftp-utils";

describe("sanitizePath", () => {
  it("joins base and user paths correctly", () => {
    expect(sanitizePath("/home/user", "docs/file.txt")).toBe(
      "/home/user/docs/file.txt"
    );
  });

  it("handles leading slashes in user path", () => {
    expect(sanitizePath("/home/user", "/docs/file.txt")).toBe(
      "/home/user/docs/file.txt"
    );
  });

  it("handles trailing slashes in base path", () => {
    expect(sanitizePath("/home/user/", "docs")).toBe("/home/user/docs");
  });

  it("removes . segments", () => {
    expect(sanitizePath("/home/user", "./docs/./file.txt")).toBe(
      "/home/user/docs/file.txt"
    );
  });

  it("throws on .. traversal attempts", () => {
    expect(() => sanitizePath("/home/user", "../etc/passwd")).toThrow(
      "Path traversal not allowed"
    );
  });

  it("throws on embedded .. traversal", () => {
    expect(() => sanitizePath("/home/user", "docs/../../../etc")).toThrow(
      "Path traversal not allowed"
    );
  });

  it("handles root base path", () => {
    expect(sanitizePath("/", "uploads/file.txt")).toBe("/uploads/file.txt");
  });

  it("normalizes multiple slashes", () => {
    expect(sanitizePath("/home//user", "docs///file.txt")).toBe(
      "/home/user/docs/file.txt"
    );
  });
});

describe("validateFileName", () => {
  it("accepts valid filenames", () => {
    expect(() => validateFileName("document.pdf")).not.toThrow();
    expect(() => validateFileName("my-file_2024.txt")).not.toThrow();
    expect(() => validateFileName("file with spaces.doc")).not.toThrow();
  });

  it("rejects filenames with invalid characters", () => {
    expect(() => validateFileName("file<name>.txt")).toThrow(
      "Filename contains invalid characters"
    );
    expect(() => validateFileName("file:name.txt")).toThrow();
    expect(() => validateFileName('file"name.txt')).toThrow();
    expect(() => validateFileName("file|name.txt")).toThrow();
    expect(() => validateFileName("file?name.txt")).toThrow();
    expect(() => validateFileName("file*name.txt")).toThrow();
  });

  it("rejects . and ..", () => {
    expect(() => validateFileName(".")).toThrow("Invalid filename");
    expect(() => validateFileName("..")).toThrow("Invalid filename");
  });

  it("rejects filenames over 255 characters", () => {
    const longName = "a".repeat(256);
    expect(() => validateFileName(longName)).toThrow("Filename too long");
  });

  it("accepts 255 character filename", () => {
    const maxName = "a".repeat(255);
    expect(() => validateFileName(maxName)).not.toThrow();
  });
});

describe("withTimeout", () => {
  it("resolves when promise completes in time", async () => {
    const fastPromise = Promise.resolve("success");
    const result = await withTimeout(fastPromise, 1000, "test operation");
    expect(result).toBe("success");
  });

  it("rejects when promise times out", async () => {
    const slowPromise = new Promise((resolve) => setTimeout(resolve, 5000));
    await expect(
      withTimeout(slowPromise, 100, "slow operation")
    ).rejects.toThrow("slow operation timed out after 100ms");
  });

  it("passes through promise rejections", async () => {
    const failingPromise = Promise.reject(new Error("original error"));
    await expect(withTimeout(failingPromise, 1000, "test")).rejects.toThrow(
      "original error"
    );
  });
});
```

**Step 3: Run tests**

Run:

```bash
pnpm run test:unit -- tests/unit/lib/sftp-utils.test.ts
```

Expected: All tests PASS

---

### Task 6: Add SFTP Validations

**Files:**

- Modify: `lib/validations.ts`
- Modify: `tests/unit/lib/validations.test.ts`

**Step 1: Add to lib/validations.ts**

Add these schemas after the existing ones:

```typescript
/**
 * Validates SFTP connection configuration.
 */
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

/**
 * Validates SFTP file/folder names.
 */
export const sftpFileNameSchema = z
  .string()
  .min(1, "Name is required")
  .max(255, "Name too long")
  .regex(/^[^<>:"/\\|?*\x00-\x1f]+$/, "Name contains invalid characters");
```

**Step 2: Add tests to tests/unit/lib/validations.test.ts**

Add these test suites:

```typescript
import {
  // ... existing imports
  sftpConnectionSchema,
  sftpFileNameSchema,
} from "@/lib/validations";

// ... existing tests

describe("sftpConnectionSchema", () => {
  it("validates correct connection", () => {
    const result = sftpConnectionSchema.safeParse({
      name: "My Server",
      host: "sftp.example.com",
      port: 22,
      username: "user",
      authType: "PASSWORD",
      credential: "password123",
      basePath: "/uploads",
    });
    expect(result.success).toBe(true);
  });

  it("requires name", () => {
    const result = sftpConnectionSchema.safeParse({
      host: "sftp.example.com",
      username: "user",
      authType: "PASSWORD",
      credential: "pass",
    });
    expect(result.success).toBe(false);
  });

  it("validates port range", () => {
    const result = sftpConnectionSchema.safeParse({
      name: "Test",
      host: "host",
      port: 70000,
      username: "user",
      authType: "PASSWORD",
      credential: "pass",
    });
    expect(result.success).toBe(false);
  });

  it("defaults port to 22", () => {
    const result = sftpConnectionSchema.safeParse({
      name: "Test",
      host: "host",
      username: "user",
      authType: "PASSWORD",
      credential: "pass",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.port).toBe(22);
    }
  });
});

describe("sftpFileNameSchema", () => {
  it("accepts valid filenames", () => {
    expect(sftpFileNameSchema.safeParse("document.pdf").success).toBe(true);
    expect(sftpFileNameSchema.safeParse("my-file_2024.txt").success).toBe(true);
  });

  it("rejects invalid characters", () => {
    expect(sftpFileNameSchema.safeParse("file<>.txt").success).toBe(false);
    expect(sftpFileNameSchema.safeParse("file:name").success).toBe(false);
  });

  it("rejects empty string", () => {
    expect(sftpFileNameSchema.safeParse("").success).toBe(false);
  });
});
```

**Step 3: Run tests**

Run:

```bash
pnpm run test:unit -- tests/unit/lib/validations.test.ts
```

Expected: All tests PASS

---

## Phase 4: SFTP Client Service

### Task 7: Create SFTP Client Service

**Files:**

- Create: `lib/sftp-client.ts`

**Step 1: Create lib/sftp-client.ts**

See the full implementation in the design document at `docs/plans/2025-12-30-bidirectional-sftp-design.md` section "lib/sftp-client.ts".

The file includes:

- `getConnection()` - Connection pooling with mutex
- `closeConnection()` - Close and remove from pool
- `listDirectory()` - List with pagination
- `listDirectoryRecursive()` - Recursive listing
- `uploadFile()` - Upload buffer or file
- `downloadFileBuffer()` - Download small files
- `downloadFileStream()` - Stream large files using PassThrough pattern
- `deleteFile()`, `rename()`, `createDirectory()`, `removeDirectory()`
- `exists()`, `stat()`
- Periodic stale connection cleanup

**Important:** The `downloadFileStream()` function uses a `PassThrough` stream pattern:

```typescript
import { PassThrough, Readable } from "stream";

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
```

This is required because `ssh2-sftp-client`'s `get()` returns a `Buffer` when no destination is provided, not a stream. The `PassThrough` approach pipes the SFTP data correctly.

---

## Phase 5: Server Actions

### Task 8: Create SFTP Connection Actions

**Files:**

- Create: `lib/sftp-actions.ts`

**Step 1: Create lib/sftp-actions.ts**

See the full implementation in the design document section "Server Actions".

The file includes:

- `createSftpConnection()` - Create with encrypted credentials
- `updateSftpConnection()` - Update existing
- `deleteSftpConnection()` - Delete and close pool
- `testSftpConnection()` - Test and measure latency
- `getSftpConnections()` - List user's connections
- `createSftpFolder()` - Create folder on SFTP + DB
- `deleteSftpItem()` - Delete from SFTP + DB
- `renameSftpItem()` - Rename on SFTP + DB

---

## Phase 6: UI Components

> **REQUIRED SKILL:** Use `frontend-design:frontend-design` for all component tasks in this phase.

### Task 9: Create Sync Status Badge Component

**Files:**

- Create: `components/sftp/sync-status-badge.tsx`

> **Use Skill:** `frontend-design:frontend-design`

Create a badge component that displays sync status with appropriate colors:

- SYNCED: Green
- PENDING_UPLOAD: Blue with upload icon
- PENDING_DOWNLOAD: Blue with download icon
- CONFLICT: Yellow with warning icon
- ERROR: Red with error icon

---

### Task 10: Create Connection Card Component

**Files:**

- Create: `components/sftp/connection-card.tsx`

> **Use Skill:** `frontend-design:frontend-design`

Create a card component displaying:

- Connection name and host
- Last connected/synced timestamps
- Status indicator (active, error)
- Test connection button
- Edit/Delete actions in dropdown menu

---

### Task 11: Create Connection Form Component

**Files:**

- Create: `components/sftp/connection-form.tsx`

> **Use Skill:** `frontend-design:frontend-design`

Create a form for adding/editing SFTP connections:

- Name field
- Host field
- Port field (default 22)
- Username field
- Auth type toggle (Password / Private Key)
- Credential field (password or textarea for key)
- Base path field
- Test connection button
- Save/Cancel buttons

Use shadcn/ui form components, react-hook-form, and zod validation.

---

### Task 12: Create Connection Test Button Component

**Files:**

- Create: `components/sftp/connection-test-button.tsx`

> **Use Skill:** `frontend-design:frontend-design`

Create a button that:

- Shows loading state while testing
- Shows success with latency on success
- Shows error message on failure
- Uses toast for feedback

---

### Task 13: Create Connections List Page

**Files:**

- Create: `app/(dashboard)/dashboard/connections/page.tsx`

> **Use Skill:** `frontend-design:frontend-design`

Create the connections list page:

- Page title "SFTP Connections"
- "Add Connection" button linking to /dashboard/connections/new
- Grid of ConnectionCard components
- Empty state when no connections

---

### Task 14: Create New Connection Page

**Files:**

- Create: `app/(dashboard)/dashboard/connections/new/page.tsx`

> **Use Skill:** `frontend-design:frontend-design`

Create the new connection page:

- Page title "Add SFTP Connection"
- ConnectionForm component in create mode
- Back button to connections list
- Redirect to connections list on success

---

### Task 15: Create Edit Connection Page

**Files:**

- Create: `app/(dashboard)/dashboard/connections/[connectionId]/page.tsx`

> **Use Skill:** `frontend-design:frontend-design`

Create the edit connection page:

- Page title "Edit Connection"
- ConnectionForm component in edit mode with prefilled data
- Back button to connections list
- Redirect to connections list on success

---

### Task 16: Update Sidebar Navigation

**Files:**

- Modify: `components/app-sidebar.tsx`

Add "Connections" link to the dashboard navigation:

```typescript
const dashboardNavMain = [
  {
    title: "My Files",
    url: "/dashboard",
    icon: Folder,
  },
  {
    title: "Connections",
    url: "/dashboard/connections",
    icon: Server, // from lucide-react
  },
];
```

---

## Phase 7: Integration Tests

### Task 17: Create SFTP Integration Tests

**Files:**

- Create: `tests/integration/sftp/sftp-connection.test.ts`

Create integration tests for:

- Create SftpConnection with encrypted credentials
- Update SftpConnection
- Delete SftpConnection
- Item creation with SFTP fields
- Connection ownership isolation

---

## Phase 8: E2E Tests

### Task 18: Create SFTP E2E Page Object

**Files:**

- Create: `e2e/pages/sftp-connections.page.ts`

Create page object with:

- Navigation to connections page
- Add connection form interaction
- Edit connection flow
- Delete connection flow
- Test connection action

---

### Task 19: Create SFTP Connection E2E Tests

**Files:**

- Create: `e2e/journeys/sftp/sftp-connection.spec.ts`

Create E2E tests for:

- Add new SFTP connection
- Test connection button shows success
- Edit existing connection
- Delete connection
- Invalid credentials show error

---

## Phase 9: Final Verification

### Task 20: Run Full Check and Commit

**Step 1: Run all checks**

Run:

```bash
pnpm run check
```

Expected: All checks pass (format, lint, type-check, knip, build)

**Step 2: Run all tests**

Run:

```bash
pnpm run test:unit && pnpm run test:integration
```

Expected: All tests pass

**Step 3: Run E2E tests**

Run:

```bash
BYPASS_RATE_LIMIT=true pnpm run test:e2e
```

Expected: All tests pass

**Step 4: Stage all changes**

Run:

```bash
git add -A
```

**Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat: add bidirectional SFTP connection support (v0.12.0)

- Add SftpConnection model with AES-256-GCM encrypted credentials
- Extend Item model with SFTP fields (type, path, size, checksum, syncStatus)
- Add SFTP client service with connection pooling and mutex locks
- Add server actions for connection CRUD and item operations
- Add connections management UI (list, add, edit, delete, test)
- Add sync status badge component
- Add path sanitization and filename validation utilities
- Add unit, integration, and E2E tests for SFTP features

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

**Step 6: Push**

```bash
git push
```

---

## Summary

| Phase | Tasks | Description                               |
| ----- | ----- | ----------------------------------------- |
| 1     | 1-2   | Prerequisites (env, deps)                 |
| 2     | 3     | Database schema                           |
| 3     | 4-6   | Core utilities                            |
| 4     | 7     | SFTP client service                       |
| 5     | 8     | Server actions                            |
| 6     | 9-16  | UI components (use frontend-design skill) |
| 7     | 17    | Integration tests                         |
| 8     | 18-19 | E2E tests                                 |
| 9     | 20    | Final verification and commit             |

**Total: 20 tasks**

**Skills to use:**

- `superpowers:executing-plans` - For task-by-task execution
- `frontend-design:frontend-design` - For Tasks 9-15 (UI components)
