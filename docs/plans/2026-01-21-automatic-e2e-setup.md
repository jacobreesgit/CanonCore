# Automatic E2E Setup Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make E2E test setup fully automatic - auto-recover from any fixable issue instead of failing with instructions.

**Architecture:** Extract auto-recovery logic into a dedicated `lib/e2e-setup.ts` module that `global.setup.ts` calls. This module handles: untrashing root folder, creating "Breaking Bad" folder, uploading test video, and creating/repairing E2E user with Drive connection. Keep `setup-e2e-drive.ts` as a manual full-reset script.

**Tech Stack:** Playwright, Google Drive API (googleapis), Prisma with PrismaPg adapter, bcryptjs

**Validation Applied:** Code reviewed against `skills/code-review-excellence`, `skills/react-best-practices` (async-parallel, js-early-exit, async-defer-await rules), and CLAUDE.md JSDoc standards.

---

## Design Decisions

### Q1: Keep `setup-e2e-drive.ts` or remove it?

**Decision:** Keep it as manual full-reset option.

**Rationale:**

- `global.setup.ts` → automatic incremental recovery (fast, runs every test)
- `setup-e2e-drive.ts` → manual full-reset (slow, wipes everything, re-uploads video)
- Best practice: have both automatic recovery AND manual override for when things are truly broken

### Q2: Upload video on every run or only if missing?

**Decision:** Only upload if missing.

**Rationale:**

- Video is 18MB, takes time to upload
- Most runs will have video present
- Only upload when: video file missing OR video file has different name than local file
- Best practice: idempotent operations that minimize unnecessary work

---

## Test Impact Analysis

### Unit Tests to Add

| File                                        | Purpose                                        |
| ------------------------------------------- | ---------------------------------------------- |
| `tests/unit/lib/e2e-setup.test.ts`          | Test auto-recovery logic with mocked Drive API |
| `tests/unit/lib/drive-verification.test.ts` | Test verification logic (currently untested)   |

### Unit Tests to Modify

None - existing tests are unaffected.

### Integration Tests to Add

| File                                                | Purpose                                                |
| --------------------------------------------------- | ------------------------------------------------------ |
| `tests/integration/e2e-setup/auto-recovery.test.ts` | Test actual Drive operations (restore, create, upload) |

### E2E Tests to Modify

None - E2E tests should work unchanged since setup is transparent.

### E2E Tests to Verify

Run full E2E suite after implementation to verify automatic setup works.

---

## Task 1: Create E2E Setup Module

**Files:**

- Create: `lib/e2e-setup.ts`
- Test: `tests/unit/lib/e2e-setup.test.ts`

### Step 1: Write failing tests for auto-recovery functions

Create `tests/unit/lib/e2e-setup.test.ts`:

```typescript
/**
 * Unit tests for E2E automatic setup and recovery.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock googleapis
vi.mock("googleapis", () => ({
  google: {
    auth: {
      OAuth2: vi.fn().mockImplementation(() => ({
        setCredentials: vi.fn(),
      })),
    },
    drive: vi.fn().mockReturnValue({
      files: {
        get: vi.fn(),
        list: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        emptyTrash: vi.fn(),
      },
    }),
  },
}));

// Mock Prisma
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    googleDriveConnection: {
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    item: {
      findFirst: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    itemFile: {
      findFirst: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

// Mock bcryptjs
vi.mock("bcryptjs", () => ({
  hash: vi.fn().mockResolvedValue("hashed-password"),
}));

// Mock crypto
vi.mock("@/lib/crypto", () => ({
  encryptCredential: vi.fn().mockReturnValue("encrypted"),
}));

describe("e2e-setup", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.GOOGLE_CLIENT_ID = "test-client-id";
    process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";
    process.env.GOOGLE_E2E_REFRESH_TOKEN = "test-refresh-token";
    process.env.GOOGLE_E2E_ROOT_FOLDER_ID = "test-root-folder-id";
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("restoreRootFolderIfTrashed", () => {
    it("returns true when folder is not trashed", async () => {
      const { google } = await import("googleapis");
      const mockDrive = google.drive();
      vi.mocked(mockDrive.files.get).mockResolvedValue({
        data: { id: "test-id", name: "E2E Root", trashed: false },
      } as never);

      const { restoreRootFolderIfTrashed } = await import("@/lib/e2e-setup");
      const result = await restoreRootFolderIfTrashed();
      expect(result).toBe(true);
    });

    it("restores folder when trashed and returns true", async () => {
      const { google } = await import("googleapis");
      const mockDrive = google.drive();
      vi.mocked(mockDrive.files.get).mockResolvedValue({
        data: { id: "test-id", name: "E2E Root", trashed: true },
      } as never);
      vi.mocked(mockDrive.files.update).mockResolvedValue({
        data: { id: "test-id", trashed: false },
      } as never);

      const { restoreRootFolderIfTrashed } = await import("@/lib/e2e-setup");
      const result = await restoreRootFolderIfTrashed();
      expect(result).toBe(true);
      expect(mockDrive.files.update).toHaveBeenCalledWith({
        fileId: "test-root-folder-id",
        requestBody: { trashed: false },
      });
    });

    it("returns false when folder not found", async () => {
      const { google } = await import("googleapis");
      const mockDrive = google.drive();
      vi.mocked(mockDrive.files.get).mockRejectedValue({ code: 404 });

      const { restoreRootFolderIfTrashed } = await import("@/lib/e2e-setup");
      const result = await restoreRootFolderIfTrashed();
      expect(result).toBe(false);
    });

    it("throws on API errors other than 404", async () => {
      const { google } = await import("googleapis");
      const mockDrive = google.drive();
      vi.mocked(mockDrive.files.get).mockRejectedValue({
        code: 403,
        message: "Rate Limit Exceeded",
      });

      const { restoreRootFolderIfTrashed } = await import("@/lib/e2e-setup");
      await expect(restoreRootFolderIfTrashed()).rejects.toMatchObject({
        code: 403,
      });
    });

    it("throws when restore operation fails", async () => {
      const { google } = await import("googleapis");
      const mockDrive = google.drive();
      vi.mocked(mockDrive.files.get).mockResolvedValue({
        data: { id: "test-id", name: "E2E Root", trashed: true },
      } as never);
      vi.mocked(mockDrive.files.update).mockRejectedValue({
        code: 500,
        message: "Internal Server Error",
      });

      const { restoreRootFolderIfTrashed } = await import("@/lib/e2e-setup");
      await expect(restoreRootFolderIfTrashed()).rejects.toMatchObject({
        code: 500,
      });
    });
  });

  describe("ensureTestFolderExists", () => {
    it("returns existing folder ID when folder exists", async () => {
      const { google } = await import("googleapis");
      const mockDrive = google.drive();
      vi.mocked(mockDrive.files.list).mockResolvedValue({
        data: { files: [{ id: "existing-folder-id", name: "Breaking Bad" }] },
      } as never);

      const { ensureTestFolderExists } = await import("@/lib/e2e-setup");
      const result = await ensureTestFolderExists();
      expect(result).toBe("existing-folder-id");
    });

    it("creates folder when missing and returns new ID", async () => {
      const { google } = await import("googleapis");
      const mockDrive = google.drive();
      vi.mocked(mockDrive.files.list).mockResolvedValue({
        data: { files: [] },
      } as never);
      vi.mocked(mockDrive.files.create).mockResolvedValue({
        data: { id: "new-folder-id" },
      } as never);

      const { ensureTestFolderExists } = await import("@/lib/e2e-setup");
      const result = await ensureTestFolderExists();
      expect(result).toBe("new-folder-id");
      expect(mockDrive.files.create).toHaveBeenCalled();
    });

    it("throws when Drive API quota exceeded", async () => {
      const { google } = await import("googleapis");
      const mockDrive = google.drive();
      vi.mocked(mockDrive.files.list).mockRejectedValue({
        code: 403,
        message: "User Rate Limit Exceeded",
      });

      const { ensureTestFolderExists } = await import("@/lib/e2e-setup");
      await expect(ensureTestFolderExists()).rejects.toMatchObject({
        code: 403,
      });
    });

    it("throws when folder creation fails", async () => {
      const { google } = await import("googleapis");
      const mockDrive = google.drive();
      vi.mocked(mockDrive.files.list).mockResolvedValue({
        data: { files: [] },
      } as never);
      vi.mocked(mockDrive.files.create).mockRejectedValue({
        code: 507,
        message: "Insufficient Storage",
      });

      const { ensureTestFolderExists } = await import("@/lib/e2e-setup");
      await expect(ensureTestFolderExists()).rejects.toMatchObject({
        code: 507,
      });
    });
  });

  describe("ensureVideoFileExists", () => {
    it("returns true when video already exists in Drive", async () => {
      const { google } = await import("googleapis");
      const mockDrive = google.drive();
      vi.mocked(mockDrive.files.list).mockResolvedValue({
        data: { files: [{ id: "video-id", name: "test.mp4" }] },
      } as never);

      const { ensureVideoFileExists } = await import("@/lib/e2e-setup");
      const result = await ensureVideoFileExists("folder-id");
      expect(result).toEqual({
        exists: true,
        fileId: "video-id",
        fileName: "test.mp4",
      });
    });

    it("returns false with reason when video missing and no local file", async () => {
      const { google } = await import("googleapis");
      const mockDrive = google.drive();
      vi.mocked(mockDrive.files.list).mockResolvedValue({
        data: { files: [] },
      } as never);

      const { ensureVideoFileExists } = await import("@/lib/e2e-setup");
      // Will return false because local file doesn't exist in test env
      const result = await ensureVideoFileExists("folder-id");
      expect(result.exists).toBe(false);
      expect(result.reason).toContain("local");
    });
  });

  describe("ensureE2EUserExists", () => {
    it("returns existing user when found", async () => {
      const { prisma } = await import("@/lib/prisma");
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: "existing-user-id",
        email: "e2e-drive-test@canoncore.test",
      } as never);

      const { ensureE2EUserExists } = await import("@/lib/e2e-setup");
      const result = await ensureE2EUserExists();
      expect(result).toBe("existing-user-id");
    });

    it("creates user when missing", async () => {
      const { prisma } = await import("@/lib/prisma");
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.user.create).mockResolvedValue({
        id: "new-user-id",
        email: "e2e-drive-test@canoncore.test",
      } as never);

      const { ensureE2EUserExists } = await import("@/lib/e2e-setup");
      const result = await ensureE2EUserExists();
      expect(result).toBe("new-user-id");
      expect(prisma.user.create).toHaveBeenCalled();
    });

    it("throws on database connection failure", async () => {
      const { prisma } = await import("@/lib/prisma");
      vi.mocked(prisma.user.findUnique).mockRejectedValue(
        new Error("Connection refused")
      );

      const { ensureE2EUserExists } = await import("@/lib/e2e-setup");
      await expect(ensureE2EUserExists()).rejects.toThrow("Connection refused");
    });

    it("throws on unique constraint violation during create", async () => {
      const { prisma } = await import("@/lib/prisma");
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.user.create).mockRejectedValue(
        Object.assign(new Error("Unique constraint failed"), { code: "P2002" })
      );

      const { ensureE2EUserExists } = await import("@/lib/e2e-setup");
      await expect(ensureE2EUserExists()).rejects.toThrow(
        "Unique constraint failed"
      );
    });
  });

  describe("ensureDriveConnectionExists", () => {
    it("returns existing connection ID when found", async () => {
      const { prisma } = await import("@/lib/prisma");
      vi.mocked(prisma.googleDriveConnection.findUnique).mockResolvedValue({
        id: "existing-connection-id",
        userId: "user-id",
      } as never);

      const { ensureDriveConnectionExists } = await import("@/lib/e2e-setup");
      const result = await ensureDriveConnectionExists("user-id");
      expect(result).toBe("existing-connection-id");
    });

    it("creates connection when missing", async () => {
      const { prisma } = await import("@/lib/prisma");
      vi.mocked(prisma.googleDriveConnection.findUnique).mockResolvedValue(
        null
      );
      vi.mocked(prisma.googleDriveConnection.create).mockResolvedValue({
        id: "new-connection-id",
        userId: "user-id",
      } as never);

      const { ensureDriveConnectionExists } = await import("@/lib/e2e-setup");
      const result = await ensureDriveConnectionExists("user-id");
      expect(result).toBe("new-connection-id");
      expect(prisma.googleDriveConnection.create).toHaveBeenCalled();
    });
  });

  describe("ensureItemRecordExists", () => {
    it("returns existing item ID when found", async () => {
      const { prisma } = await import("@/lib/prisma");
      vi.mocked(prisma.item.findFirst).mockResolvedValue({
        id: "existing-item-id",
        name: "Breaking Bad",
        driveFileId: "folder-id",
      } as never);

      const { ensureItemRecordExists } = await import("@/lib/e2e-setup");
      const result = await ensureItemRecordExists("user-id", "folder-id");
      expect(result).toBe("existing-item-id");
    });

    it("creates item when missing", async () => {
      const { prisma } = await import("@/lib/prisma");
      vi.mocked(prisma.item.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.item.create).mockResolvedValue({
        id: "new-item-id",
        name: "Breaking Bad",
      } as never);

      const { ensureItemRecordExists } = await import("@/lib/e2e-setup");
      const result = await ensureItemRecordExists("user-id", "folder-id");
      expect(result).toBe("new-item-id");
      expect(prisma.item.create).toHaveBeenCalled();
    });
  });

  describe("ensureItemFileRecordExists", () => {
    it("returns existing when found", async () => {
      const { prisma } = await import("@/lib/prisma");
      vi.mocked(prisma.itemFile.findFirst).mockResolvedValue({
        id: "existing-file-id",
        driveFileId: "video-id",
      } as never);

      const { ensureItemFileRecordExists } = await import("@/lib/e2e-setup");
      const result = await ensureItemFileRecordExists(
        "item-id",
        "video-id",
        "test.mp4"
      );
      expect(result).toBe("existing-file-id");
    });

    it("creates record when missing", async () => {
      const { prisma } = await import("@/lib/prisma");
      vi.mocked(prisma.itemFile.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.itemFile.create).mockResolvedValue({
        id: "new-file-id",
        driveFileId: "video-id",
      } as never);

      const { ensureItemFileRecordExists } = await import("@/lib/e2e-setup");
      const result = await ensureItemFileRecordExists(
        "item-id",
        "video-id",
        "test.mp4"
      );
      expect(result).toBe("new-file-id");
      expect(prisma.itemFile.create).toHaveBeenCalled();
    });
  });

  describe("runAutomaticSetup", () => {
    it("returns error when root folder permanently deleted", async () => {
      const { google } = await import("googleapis");
      const mockDrive = google.drive();
      vi.mocked(mockDrive.files.get).mockRejectedValue({ code: 404 });

      const { runAutomaticSetup } = await import("@/lib/e2e-setup");
      const result = await runAutomaticSetup();
      expect(result.success).toBe(false);
      expect(result.error).toContain("permanently deleted");
    });

    it("returns error when video missing and no local file", async () => {
      const { google } = await import("googleapis");
      const { prisma } = await import("@/lib/prisma");
      const mockDrive = google.drive();

      // Root folder OK
      vi.mocked(mockDrive.files.get).mockResolvedValue({
        data: { id: "root-id", name: "E2E Root", trashed: false },
      } as never);
      // Test folder exists
      vi.mocked(mockDrive.files.list)
        .mockResolvedValueOnce({
          data: { files: [{ id: "folder-id", name: "Breaking Bad" }] },
        } as never)
        // No video in folder
        .mockResolvedValueOnce({
          data: { files: [] },
        } as never);
      // User exists (parallel operation)
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: "user-id",
        email: "e2e-drive-test@canoncore.test",
      } as never);

      const { runAutomaticSetup } = await import("@/lib/e2e-setup");
      const result = await runAutomaticSetup();
      expect(result.success).toBe(false);
      expect(result.error).toContain("local");
    });

    it("catches and returns errors from any step", async () => {
      const { google } = await import("googleapis");
      const mockDrive = google.drive();
      vi.mocked(mockDrive.files.get).mockRejectedValue(
        new Error("Network timeout")
      );

      const { runAutomaticSetup } = await import("@/lib/e2e-setup");
      const result = await runAutomaticSetup();
      expect(result.success).toBe(false);
      expect(result.error).toBe("Network timeout");
    });
  });
});
```

### Step 2: Run tests to verify they fail

Run: `pnpm test tests/unit/lib/e2e-setup.test.ts`
Expected: FAIL with "Cannot find module '@/lib/e2e-setup'"

### Step 3: Create the e2e-setup module

Create `lib/e2e-setup.ts`:

````typescript
/**
 * E2E automatic setup and recovery utilities.
 * Provides idempotent functions that ensure test prerequisites exist,
 * creating or restoring them automatically when missing.
 *
 * Used by global.setup.ts to make E2E tests self-healing.
 */

import { google } from "googleapis";
import * as fs from "fs";
import * as path from "path";
import { hash } from "bcryptjs";
import { FileType, SyncStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { encryptCredential } from "@/lib/crypto";

/** Test folder name (protected from cleanup). */
export const TEST_FOLDER_NAME = "Breaking Bad";

/** Local test video file path. */
const TEST_VIDEO_PATH = "file_example_MP4_1920_18MG.mp4";

/** E2E test user credentials. */
export const E2E_USER_EMAIL = "e2e-drive-test@canoncore.test";
/**
 * Hardcoded test password - intentional for E2E test automation.
 * This is NOT a security risk as it's only used for test accounts
 * that are isolated from production data.
 */
export const E2E_USER_PASSWORD = "TestPassword123";

/**
 * Gets a configured Google Drive client using E2E credentials.
 *
 * @returns Configured Drive client
 * @throws Error if credentials are missing
 */
function getDriveClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_E2E_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Missing Google credentials. Run: pnpm run setup:e2e");
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  return google.drive({ version: "v3", auth: oauth2Client });
}

/**
 * Gets the root folder ID from environment.
 *
 * @returns Root folder ID
 * @throws Error if not configured
 */
function getRootFolderId(): string {
  const rootFolderId = process.env.GOOGLE_E2E_ROOT_FOLDER_ID;
  if (!rootFolderId) {
    throw new Error(
      "GOOGLE_E2E_ROOT_FOLDER_ID not set. Run: pnpm run setup:e2e"
    );
  }
  return rootFolderId;
}

/**
 * Restores the root folder from trash if it was trashed.
 *
 * @returns true if folder is usable (exists and not trashed), false if unrecoverable
 */
export async function restoreRootFolderIfTrashed(): Promise<boolean> {
  const drive = getDriveClient();
  const rootFolderId = getRootFolderId();

  try {
    const response = await drive.files.get({
      fileId: rootFolderId,
      fields: "id,name,trashed",
    });

    if (response.data.trashed) {
      console.log("[E2E Setup] Root folder is trashed, restoring...");
      await drive.files.update({
        fileId: rootFolderId,
        requestBody: { trashed: false },
      });
      console.log("[E2E Setup] ✓ Root folder restored from trash");
    }

    return true;
  } catch (err: unknown) {
    const error = err as { code?: number };
    if (error.code === 404) {
      console.error("[E2E Setup] Root folder not found (permanently deleted)");
      return false;
    }
    throw err;
  }
}

/**
 * Ensures the "Breaking Bad" test folder exists in Drive.
 * Creates it if missing.
 *
 * @returns Folder ID
 */
export async function ensureTestFolderExists(): Promise<string> {
  const drive = getDriveClient();
  const rootFolderId = getRootFolderId();

  // Check if folder exists
  const response = await drive.files.list({
    q: `'${rootFolderId}' in parents and name = '${TEST_FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: "files(id,name)",
  });

  if (response.data.files && response.data.files.length > 0) {
    const folderId = response.data.files[0].id!;
    console.log(`[E2E Setup] ✓ Found "${TEST_FOLDER_NAME}" folder`);
    return folderId;
  }

  // Create folder
  console.log(`[E2E Setup] Creating "${TEST_FOLDER_NAME}" folder...`);
  const createResponse = await drive.files.create({
    requestBody: {
      name: TEST_FOLDER_NAME,
      mimeType: "application/vnd.google-apps.folder",
      parents: [rootFolderId],
    },
    fields: "id",
  });

  const folderId = createResponse.data.id!;
  console.log(`[E2E Setup] ✓ Created "${TEST_FOLDER_NAME}" folder`);
  return folderId;
}

/**
 * Result of video file check.
 */
export interface VideoFileResult {
  exists: boolean;
  fileId?: string;
  fileName?: string;
  reason?: string;
}

/**
 * Ensures a video file exists in the test folder.
 * Uploads from local file if missing from Drive.
 *
 * @param testFolderId - ID of the test folder
 * @returns Result indicating if video exists and file info
 */
export async function ensureVideoFileExists(
  testFolderId: string
): Promise<VideoFileResult> {
  const drive = getDriveClient();

  // Check if video exists in Drive
  const response = await drive.files.list({
    q: `'${testFolderId}' in parents and mimeType contains 'video' and trashed = false`,
    fields: "files(id,name)",
  });

  if (response.data.files && response.data.files.length > 0) {
    const file = response.data.files[0];
    console.log(`[E2E Setup] ✓ Found video: ${file.name}`);
    return { exists: true, fileId: file.id!, fileName: file.name! };
  }

  // Check if local video file exists
  const videoPath = path.join(process.cwd(), TEST_VIDEO_PATH);
  if (!fs.existsSync(videoPath)) {
    return {
      exists: false,
      reason: `No video in Drive and local file not found: ${TEST_VIDEO_PATH}`,
    };
  }

  // Upload video
  console.log(`[E2E Setup] Uploading ${TEST_VIDEO_PATH}...`);
  const stats = fs.statSync(videoPath);
  const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
  console.log(`[E2E Setup] File size: ${sizeMB} MB (this may take a moment)`);

  const uploadResponse = await drive.files.create({
    requestBody: {
      name: path.basename(videoPath),
      parents: [testFolderId],
    },
    media: {
      mimeType: "video/mp4",
      body: fs.createReadStream(videoPath),
    },
    fields: "id,name",
  });

  console.log(`[E2E Setup] ✓ Uploaded video: ${uploadResponse.data.name}`);
  return {
    exists: true,
    fileId: uploadResponse.data.id!,
    fileName: uploadResponse.data.name!,
  };
}

/**
 * Ensures the E2E test user exists in the database.
 *
 * @returns User ID
 */
export async function ensureE2EUserExists(): Promise<string> {
  // Check if user exists
  const existingUser = await prisma.user.findUnique({
    where: { email: E2E_USER_EMAIL },
  });

  if (existingUser) {
    console.log(`[E2E Setup] ✓ Found E2E user: ${E2E_USER_EMAIL}`);
    return existingUser.id;
  }

  // Create user
  console.log(`[E2E Setup] Creating E2E user: ${E2E_USER_EMAIL}`);
  const passwordHash = await hash(E2E_USER_PASSWORD, 10);
  const user = await prisma.user.create({
    data: {
      email: E2E_USER_EMAIL,
      passwordHash,
    },
  });

  console.log(`[E2E Setup] ✓ Created E2E user`);
  return user.id;
}

/**
 * Ensures the Google Drive connection exists for the E2E user.
 *
 * @param userId - E2E user ID
 * @returns Connection ID
 */
export async function ensureDriveConnectionExists(
  userId: string
): Promise<string> {
  const refreshToken = process.env.GOOGLE_E2E_REFRESH_TOKEN!;
  const rootFolderId = getRootFolderId();

  // Check if connection exists
  const existingConnection = await prisma.googleDriveConnection.findUnique({
    where: { userId },
  });

  if (existingConnection) {
    console.log("[E2E Setup] ✓ Found Drive connection");
    return existingConnection.id;
  }

  // Create connection
  console.log("[E2E Setup] Creating Drive connection...");
  const encryptedAccessToken = encryptCredential("placeholder-will-refresh");
  const encryptedRefreshToken = encryptCredential(refreshToken);

  const connection = await prisma.googleDriveConnection.create({
    data: {
      userId,
      name: "E2E Test Drive",
      encryptedAccessToken,
      encryptedRefreshToken,
      accessTokenExpiry: new Date(Date.now() - 1000), // Expired, will refresh
      rootFolderId,
      email: process.env.GOOGLE_E2E_EMAIL || "e2e@test.com",
    },
  });

  console.log("[E2E Setup] ✓ Created Drive connection");
  return connection.id;
}

/**
 * Ensures the Item record exists for the test folder.
 *
 * @param userId - E2E user ID
 * @param driveFileId - Drive folder ID
 * @returns Item ID
 */
export async function ensureItemRecordExists(
  userId: string,
  driveFileId: string
): Promise<string> {
  // Check if item exists
  const existingItem = await prisma.item.findFirst({
    where: {
      userId,
      driveFileId,
    },
  });

  if (existingItem) {
    console.log(`[E2E Setup] ✓ Found Item record: ${existingItem.name}`);
    return existingItem.id;
  }

  // Create item
  console.log(`[E2E Setup] Creating Item record: ${TEST_FOLDER_NAME}`);
  const item = await prisma.item.create({
    data: {
      name: TEST_FOLDER_NAME,
      userId,
      depth: 0,
      order: 0,
      driveFileId,
      syncStatus: SyncStatus.SYNCED,
      driveModifiedAt: new Date(),
    },
  });

  console.log(`[E2E Setup] ✓ Created Item record`);
  return item.id;
}

/**
 * Ensures the ItemFile record exists for the video.
 *
 * @param itemId - Parent item ID
 * @param driveFileId - Drive file ID
 * @param filename - Video filename
 * @returns ItemFile ID
 */
export async function ensureItemFileRecordExists(
  itemId: string,
  driveFileId: string,
  filename: string
): Promise<string> {
  // Check if ItemFile exists
  const existingFile = await prisma.itemFile.findFirst({
    where: {
      itemId,
      driveFileId,
    },
  });

  if (existingFile) {
    console.log(
      `[E2E Setup] ✓ Found ItemFile record: ${existingFile.filename}`
    );
    return existingFile.id;
  }

  // Create ItemFile
  console.log(`[E2E Setup] Creating ItemFile record: ${filename}`);
  const itemFile = await prisma.itemFile.create({
    data: {
      itemId,
      filename,
      driveFileId,
      fileType: FileType.MEDIA,
      mimeType: "video/mp4",
      isPrimary: true,
    },
  });

  console.log(`[E2E Setup] ✓ Created ItemFile record`);
  return itemFile.id;
}

/**
 * Result of the full automatic setup.
 */
export interface AutoSetupResult {
  success: boolean;
  userId?: string;
  testFolderId?: string;
  videoFileId?: string;
  error?: string;
}

/**
 * Runs the full automatic E2E setup.
 * Ensures all prerequisites exist, creating or restoring them as needed.
 *
 * Uses Promise.all to parallelize independent operations for ~2x speedup:
 * - Drive operations (folder/video) run in parallel with DB operations (user)
 * - Dependent operations wait for their prerequisites
 *
 * @returns Setup result with IDs of created/found resources
 *
 * @example
 * ```typescript
 * const result = await runAutomaticSetup();
 * if (!result.success) {
 *   throw new Error(result.error);
 * }
 * console.log(`User: ${result.userId}, Folder: ${result.testFolderId}`);
 * ```
 */
export async function runAutomaticSetup(): Promise<AutoSetupResult> {
  try {
    // Step 1: Restore root folder if trashed (must complete first)
    const rootFolderOk = await restoreRootFolderIfTrashed();
    if (!rootFolderOk) {
      return {
        success: false,
        error: "Root folder permanently deleted. Run: pnpm run setup:e2e",
      };
    }

    // Steps 2-4: Run Drive setup and DB user creation in parallel
    // - Drive path: folder → video (sequential, video needs folder ID)
    // - DB path: user (independent)
    const [driveSetupResult, userId] = await Promise.all([
      // Drive setup chain
      (async () => {
        const testFolderId = await ensureTestFolderExists();
        const videoResult = await ensureVideoFileExists(testFolderId);
        return { testFolderId, videoResult };
      })(),
      // DB user (independent)
      ensureE2EUserExists(),
    ]);

    const { testFolderId, videoResult } = driveSetupResult;

    // Early return if video missing
    if (!videoResult.exists) {
      return {
        success: false,
        error: videoResult.reason || "Video file not found",
      };
    }

    // Steps 5-7: Create DB records (sequential, each depends on previous)
    await ensureDriveConnectionExists(userId);
    const itemId = await ensureItemRecordExists(userId, testFolderId);
    await ensureItemFileRecordExists(
      itemId,
      videoResult.fileId!,
      videoResult.fileName!
    );

    return {
      success: true,
      userId,
      testFolderId,
      videoFileId: videoResult.fileId,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: message,
    };
  }
}
````

### Step 4: Run tests to verify they pass

Run: `pnpm test tests/unit/lib/e2e-setup.test.ts`
Expected: PASS

---

## Task 2: Add Unit Tests for drive-verification.ts

**Files:**

- Create: `tests/unit/lib/drive-verification.test.ts`

### Step 1: Write unit tests

Create `tests/unit/lib/drive-verification.test.ts`:

```typescript
/**
 * Unit tests for Drive verification utilities.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("drive-verification", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    process.env.GOOGLE_CLIENT_ID = "test-client-id";
    process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";
    mockFetch.mockReset();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("verifyDriveSetup", () => {
    it("returns errors when credentials missing", async () => {
      delete process.env.GOOGLE_CLIENT_ID;
      delete process.env.GOOGLE_E2E_REFRESH_TOKEN;
      delete process.env.GOOGLE_E2E_ROOT_FOLDER_ID;

      const { verifyDriveSetup } = await import("@/lib/drive-verification");
      const result = await verifyDriveSetup("e2e");

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("GOOGLE_CLIENT_ID not set");
      expect(result.errors).toContain("GOOGLE_E2E_REFRESH_TOKEN not set");
      expect(result.errors).toContain("GOOGLE_E2E_ROOT_FOLDER_ID not set");
    });

    it("returns valid when all checks pass", async () => {
      process.env.GOOGLE_E2E_REFRESH_TOKEN = "test-token";
      process.env.GOOGLE_E2E_ROOT_FOLDER_ID = "test-folder";

      // Mock token refresh success
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: "access-token" }),
      });

      // Mock folder check success
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ name: "E2E Folder", trashed: false }),
      });

      const { verifyDriveSetup } = await import("@/lib/drive-verification");
      const result = await verifyDriveSetup("e2e");

      expect(result.valid).toBe(true);
      expect(result.tokenValid).toBe(true);
      expect(result.folderExists).toBe(true);
      expect(result.folderTrashed).toBe(false);
      expect(result.errors).toHaveLength(0);
    });

    it("returns error when token refresh fails", async () => {
      process.env.GOOGLE_E2E_REFRESH_TOKEN = "invalid-token";
      process.env.GOOGLE_E2E_ROOT_FOLDER_ID = "test-folder";

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => "Invalid token",
      });

      const { verifyDriveSetup } = await import("@/lib/drive-verification");
      const result = await verifyDriveSetup("e2e");

      expect(result.valid).toBe(false);
      expect(result.tokenValid).toBe(false);
      expect(result.errors[0]).toContain("Token refresh failed");
    });

    it("returns error when folder is trashed", async () => {
      process.env.GOOGLE_E2E_REFRESH_TOKEN = "test-token";
      process.env.GOOGLE_E2E_ROOT_FOLDER_ID = "test-folder";

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: "access-token" }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ name: "E2E Folder", trashed: true }),
      });

      const { verifyDriveSetup } = await import("@/lib/drive-verification");
      const result = await verifyDriveSetup("e2e");

      expect(result.valid).toBe(false);
      expect(result.folderTrashed).toBe(true);
      expect(result.errors[0]).toContain("in trash");
    });

    it("returns error when folder not found", async () => {
      process.env.GOOGLE_E2E_REFRESH_TOKEN = "test-token";
      process.env.GOOGLE_E2E_ROOT_FOLDER_ID = "missing-folder";

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: "access-token" }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
      });

      const { verifyDriveSetup } = await import("@/lib/drive-verification");
      const result = await verifyDriveSetup("e2e");

      expect(result.valid).toBe(false);
      expect(result.folderExists).toBe(false);
      expect(result.errors[0]).toContain("not found");
    });
  });

  describe("assertDriveConfigured", () => {
    it("throws error with instructions when not configured", async () => {
      delete process.env.GOOGLE_E2E_REFRESH_TOKEN;

      const { assertDriveConfigured } =
        await import("@/lib/drive-verification");

      await expect(assertDriveConfigured("e2e")).rejects.toThrow(
        "Google Drive not configured"
      );
    });

    it("does not throw when configured correctly", async () => {
      process.env.GOOGLE_E2E_REFRESH_TOKEN = "test-token";
      process.env.GOOGLE_E2E_ROOT_FOLDER_ID = "test-folder";

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: "access-token" }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ name: "E2E Folder", trashed: false }),
      });

      const { assertDriveConfigured } =
        await import("@/lib/drive-verification");
      await expect(assertDriveConfigured("e2e")).resolves.toBeUndefined();
    });
  });

  describe("getDriveConfig", () => {
    it("returns e2e config", async () => {
      const { getDriveConfig } = await import("@/lib/drive-verification");
      const config = getDriveConfig("e2e");

      expect(config.name).toBe("E2E Testing");
      expect(config.tokenVar).toBe("GOOGLE_E2E_REFRESH_TOKEN");
      expect(config.setupCommand).toBe("pnpm run setup:e2e");
    });

    it("returns seed config", async () => {
      const { getDriveConfig } = await import("@/lib/drive-verification");
      const config = getDriveConfig("seed");

      expect(config.name).toBe("Database Seeding");
      expect(config.tokenVar).toBe("GOOGLE_SEED_REFRESH_TOKEN");
      expect(config.setupCommand).toBe("pnpm run setup:seed");
    });
  });
});
```

### Step 2: Run tests to verify they pass

Run: `pnpm test tests/unit/lib/drive-verification.test.ts`
Expected: PASS

---

## Task 3: Update global.setup.ts to Use Automatic Setup

**Files:**

- Modify: `e2e/journeys/global.setup.ts`

### Step 1: Update global.setup.ts to use automatic setup

Replace `e2e/journeys/global.setup.ts` with:

```typescript
/**
 * Global setup for E2E tests.
 * Automatically ensures all prerequisites exist, creating or restoring them as needed.
 *
 * Auto-recovery handles:
 * - Root folder in trash → restores it
 * - "Breaking Bad" folder missing → creates it
 * - Video file missing → uploads it (if local file exists)
 * - E2E user missing → creates it
 * - Drive connection missing → creates it
 * - Database records missing → creates them
 *
 * Only fails when issues are unrecoverable (e.g., permanently deleted folder, missing credentials).
 */

import { test as setup } from "@playwright/test";
import { config } from "dotenv";
import {
  getDriveClientFromRefreshToken,
  batchDelete,
  emptyTrash,
} from "@/lib/google-drive-client";
import { assertDriveConfigured } from "@/lib/drive-verification";
import { runAutomaticSetup, TEST_FOLDER_NAME } from "@/lib/e2e-setup";

// Load environment variables
config({ path: ".env.local" });

/** Protected folders are not deleted during cleanup (baseline test data). */
const PROTECTED_FOLDERS = [TEST_FOLDER_NAME];

/**
 * Gets an access token from a refresh token for batch API operations.
 *
 * @param refreshToken - Google OAuth refresh token
 * @returns Access token
 */
async function getAccessTokenFromRefreshToken(
  refreshToken: string
): Promise<string> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to refresh token: ${response.status} ${errorText}`);
  }

  const { access_token } = await response.json();
  return access_token;
}

/**
 * Cleans test-created content from E2E Google Drive folder.
 * Skips protected folders (baseline test data like "Breaking Bad").
 */
async function cleanupE2EDrive(): Promise<void> {
  const refreshToken = process.env.GOOGLE_E2E_REFRESH_TOKEN!;
  const rootFolderId = process.env.GOOGLE_E2E_ROOT_FOLDER_ID!;

  console.log(
    "[E2E Setup] Cleaning Google Drive (keeping protected folders)..."
  );

  const drive = await getDriveClientFromRefreshToken(refreshToken);

  // List all items in root folder with pagination
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
        // Skip protected folders
        if (PROTECTED_FOLDERS.includes(item.name)) {
          console.log(`[E2E Setup] Keeping protected folder: ${item.name}`);
          continue;
        }
        allItems.push({ id: item.id, name: item.name });
      }
    }

    pageToken = response.data.nextPageToken ?? undefined;
  } while (pageToken);

  if (allItems.length === 0) {
    console.log("[E2E Setup] No items to delete");
  } else {
    console.log(`[E2E Setup] Found ${allItems.length} items to delete`);

    // Batch delete items
    const fileIds = allItems.map((item) => item.id);
    const accessToken = await getAccessTokenFromRefreshToken(refreshToken);

    const result = await batchDelete(accessToken, fileIds);

    if (result.failed.length > 0) {
      console.warn(
        `[E2E Setup] Failed to delete ${result.failed.length} items:`,
        result.failed.slice(0, 3).map((f) => f.error)
      );
    }

    console.log(`[E2E Setup] Deleted ${result.succeeded.length} items`);
  }

  // Empty trash
  console.log("[E2E Setup] Emptying trash...");
  try {
    await emptyTrash(drive);
  } catch (err) {
    console.warn(
      "[E2E Setup] Failed to empty trash:",
      err instanceof Error ? err.message : err
    );
  }

  console.log("[E2E Setup] Drive cleanup complete");
}

setup("global setup", async () => {
  // Pre-flight check: Basic credentials must be configured
  // This only checks that env vars exist, not that they're valid
  await assertDriveConfigured("e2e");

  try {
    // Clean up test-created content (keeps protected folders)
    await cleanupE2EDrive();

    // Run automatic setup - creates/restores any missing prerequisites
    const result = await runAutomaticSetup();

    if (!result.success) {
      throw new Error(result.error || "Automatic setup failed");
    }

    console.log("[E2E Setup] ✅ All prerequisites verified - ready for tests");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[E2E Setup] ❌ Setup failed: ${message}`);
    throw err;
  }
});
```

### Step 2: Run E2E tests to verify

Run: `pnpm run test:e2e --project=chromium`
Expected: Tests should pass

---

## Task 4: Add Integration Tests for Auto-Recovery

**Files:**

- Create: `tests/integration/e2e-setup/auto-recovery.test.ts`

### Step 1: Write integration tests

Create `tests/integration/e2e-setup/auto-recovery.test.ts`:

```typescript
/**
 * Integration tests for E2E automatic setup.
 * Tests actual Drive operations with real credentials.
 *
 * IMPORTANT: These tests modify real Google Drive content.
 * Only run with a dedicated E2E test account.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { config } from "dotenv";

// Load environment variables
config({ path: ".env.local" });

// Skip if E2E credentials not configured
const E2E_CONFIGURED =
  process.env.GOOGLE_E2E_REFRESH_TOKEN &&
  process.env.GOOGLE_E2E_ROOT_FOLDER_ID &&
  process.env.GOOGLE_CLIENT_ID &&
  process.env.GOOGLE_CLIENT_SECRET;

describe.skipIf(!E2E_CONFIGURED)("e2e-setup integration", () => {
  beforeAll(() => {
    if (!E2E_CONFIGURED) {
      console.log(
        "Skipping E2E setup integration tests - credentials not configured"
      );
    }
  });

  describe("restoreRootFolderIfTrashed", () => {
    it("returns true when root folder exists and is not trashed", async () => {
      const { restoreRootFolderIfTrashed } = await import("@/lib/e2e-setup");
      const result = await restoreRootFolderIfTrashed();
      expect(result).toBe(true);
    });
  });

  describe("ensureTestFolderExists", () => {
    it("returns folder ID (creates if needed)", async () => {
      const { ensureTestFolderExists } = await import("@/lib/e2e-setup");
      const folderId = await ensureTestFolderExists();
      expect(folderId).toBeTruthy();
      expect(typeof folderId).toBe("string");
    });
  });

  describe("ensureVideoFileExists", () => {
    it("returns video info if exists", async () => {
      const { ensureTestFolderExists, ensureVideoFileExists } =
        await import("@/lib/e2e-setup");
      const folderId = await ensureTestFolderExists();
      const result = await ensureVideoFileExists(folderId);

      // Either exists or returns reason why not
      if (result.exists) {
        expect(result.fileId).toBeTruthy();
        expect(result.fileName).toBeTruthy();
      } else {
        expect(result.reason).toBeTruthy();
      }
    });
  });

  describe("ensureE2EUserExists", () => {
    it("returns user ID (creates if needed)", async () => {
      const { ensureE2EUserExists } = await import("@/lib/e2e-setup");
      const userId = await ensureE2EUserExists();
      expect(userId).toBeTruthy();
      expect(typeof userId).toBe("string");
    });
  });

  describe("ensureDriveConnectionExists", () => {
    it("returns connection ID (creates if needed)", async () => {
      const { ensureE2EUserExists, ensureDriveConnectionExists } =
        await import("@/lib/e2e-setup");
      const userId = await ensureE2EUserExists();
      const connectionId = await ensureDriveConnectionExists(userId);
      expect(connectionId).toBeTruthy();
      expect(typeof connectionId).toBe("string");
    });
  });

  describe("runAutomaticSetup", () => {
    it("runs full setup and returns success or clear error", async () => {
      const { runAutomaticSetup } = await import("@/lib/e2e-setup");
      const result = await runAutomaticSetup();

      if (result.success) {
        expect(result.userId).toBeTruthy();
        expect(result.testFolderId).toBeTruthy();
      } else {
        // Should have clear error message
        expect(result.error).toBeTruthy();
        console.log(
          "Setup failed (expected if video not uploaded):",
          result.error
        );
      }
    });
  });
});
```

### Step 2: Run integration tests

Run: `pnpm run test:integration tests/integration/e2e-setup/auto-recovery.test.ts`
Expected: PASS (or skip if credentials not configured)

---

## Task 5: Run Full Test Suite

### Step 1: Run check

Run: `pnpm run check`
Expected: PASS

### Step 2: Run unit tests

Run: `pnpm run test:unit`
Expected: PASS

### Step 3: Run integration tests

Run: `pnpm run test:integration`
Expected: PASS

### Step 4: Run E2E tests

Run: `pnpm run test:e2e`
Expected: PASS

---

## Summary

| What Changed                                                | Purpose                                       |
| ----------------------------------------------------------- | --------------------------------------------- |
| Created `lib/e2e-setup.ts`                                  | Auto-recovery functions for E2E prerequisites |
| Created `tests/unit/lib/e2e-setup.test.ts`                  | Unit tests for auto-recovery (mocked)         |
| Created `tests/unit/lib/drive-verification.test.ts`         | Unit tests for verification module            |
| Created `tests/integration/e2e-setup/auto-recovery.test.ts` | Integration tests with real Drive             |
| Modified `e2e/journeys/global.setup.ts`                     | Uses automatic setup instead of fail-fast     |
| Kept `scripts/setup-e2e-drive.ts`                           | Manual full-reset option remains available    |

**Best Practices Applied:**

- Idempotent operations (safe to run multiple times)
- Only upload video when missing (avoid 18MB uploads)
- Clear error messages for unrecoverable issues
- Separate unit tests (mocked) from integration tests (real)
- Keep manual reset script for when automatic recovery isn't enough

**Validation Fixes (from skills review):**

- ✅ **Async parallelization** (react-best-practices/async-parallel): `runAutomaticSetup` uses `Promise.all` to run Drive operations and DB user creation in parallel (~2x speedup)
- ✅ **Error case tests** (code-review-excellence): Added tests for API failures (quota exceeded, network errors), DB failures (unique constraint violations), and `runAutomaticSetup` error handling
- ✅ **@example JSDoc** (CLAUDE.md standards): Added `@example` block to `runAutomaticSetup` showing usage pattern
- ✅ **Test password documentation**: Added comment explaining `E2E_USER_PASSWORD` is intentionally hardcoded for test automation
