/**
 * Unit tests for Google Drive upload operations.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock @/lib/env
vi.mock("@/lib/env", () => ({
  env: {
    DATABASE_URL: "postgresql://test:test@localhost:5432/test",
    AUTH_SECRET: "test-auth-secret",
    RESEND_API_KEY: "re_test_key",
    EMAIL_FROM: "test@example.com",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    UPSTASH_REDIS_REST_URL: "https://test.upstash.io",
    UPSTASH_REDIS_REST_TOKEN: "test-token",
    BYPASS_RATE_LIMIT: "true",
    GOOGLE_CLIENT_ID: "test-client-id",
    GOOGLE_CLIENT_SECRET: "test-client-secret",
    ENCRYPTION_KEY: "dGVzdC1lbmNyeXB0aW9uLWtleS0zMi1ieXRlcyE=",
  },
}));

// Mock auth
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

// Mock prisma
vi.mock("@/lib/prisma", () => ({
  prisma: {
    googleDriveConnection: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    item: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
      aggregate: vi.fn(),
    },
    itemFile: {
      upsert: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

// Mock revalidatePath
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Mock google-drive-client
vi.mock("@/lib/google-drive-client", () => ({
  getDriveClient: vi.fn(),
  withRateLimit: vi.fn((fn) => fn()),
  createResumableUploadUrl: vi.fn(
    () =>
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable"
  ),
  refreshAccessToken: vi.fn(() => "refreshed-access-token"),
  uploadFile: vi.fn(),
}));

// Mock crypto module
vi.mock("@/lib/crypto", () => ({
  encryptCredential: vi.fn((value) => `encrypted:${value}`),
  decryptCredential: vi.fn((value) => value.replace("encrypted:", "")),
}));

// Mock logger
vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Set process.env for signing functions (they use process.env directly)
process.env.AUTH_SECRET = "test-auth-secret-32-bytes-long!!";

describe("google-drive-upload", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("createUploadSessions", () => {
    it("should return error if not authenticated", async () => {
      vi.mocked(auth).mockResolvedValue(null as never);

      const { createUploadSessions } =
        await import("@/lib/google-drive-upload");
      const result = await createUploadSessions(
        "item-123",
        [{ name: "test.mp4", mimeType: "video/mp4" }],
        "http://localhost:3000"
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Not authenticated");
    });

    it("should return error if no files provided", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-123" },
        expires: new Date().toISOString(),
      } as never);

      const { createUploadSessions } =
        await import("@/lib/google-drive-upload");
      const result = await createUploadSessions(
        "item-123",
        [],
        "http://localhost:3000"
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("No files provided");
    });

    it("should return error if too many files", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-123" },
        expires: new Date().toISOString(),
      } as never);

      const files = Array.from({ length: 11 }, (_, i) => ({
        name: `file${i}.mp4`,
        mimeType: "video/mp4",
      }));

      const { createUploadSessions } =
        await import("@/lib/google-drive-upload");
      const result = await createUploadSessions(
        "item-123",
        files,
        "http://localhost:3000"
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Maximum 10 files per batch");
    });

    it("should return error if no Google Drive connected", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-123" },
        expires: new Date().toISOString(),
      } as never);
      vi.mocked(prisma.googleDriveConnection.findUnique).mockResolvedValue(
        null
      );
      vi.mocked(prisma.item.findFirst).mockResolvedValue({
        id: "item-123",
        driveFileId: "drive-folder-123",
      } as never);

      const { createUploadSessions } =
        await import("@/lib/google-drive-upload");
      const result = await createUploadSessions(
        "item-123",
        [{ name: "test.mp4", mimeType: "video/mp4" }],
        "http://localhost:3000"
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("No Google Drive connected");
    });

    it("should return error if connection needs reauth", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-123" },
        expires: new Date().toISOString(),
      } as never);
      vi.mocked(prisma.googleDriveConnection.findUnique).mockResolvedValue({
        id: "conn-123",
        userId: "user-123",
        needsReauth: true,
      } as never);
      vi.mocked(prisma.item.findFirst).mockResolvedValue({
        id: "item-123",
        driveFileId: "drive-folder-123",
      } as never);

      const { createUploadSessions } =
        await import("@/lib/google-drive-upload");
      const result = await createUploadSessions(
        "item-123",
        [{ name: "test.mp4", mimeType: "video/mp4" }],
        "http://localhost:3000"
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Please reconnect your Google Drive");
    });

    it("should return error if item not found", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-123" },
        expires: new Date().toISOString(),
      } as never);
      vi.mocked(prisma.googleDriveConnection.findUnique).mockResolvedValue({
        id: "conn-123",
        userId: "user-123",
        rootFolderId: "root-folder-id",
        needsReauth: false,
        encryptedAccessToken: "encrypted:access-token",
        accessTokenExpiry: new Date(Date.now() + 3600000), // 1 hour from now
      } as never);
      vi.mocked(prisma.item.findFirst).mockResolvedValue(null);

      const { createUploadSessions } =
        await import("@/lib/google-drive-upload");
      const result = await createUploadSessions(
        "item-123",
        [{ name: "test.mp4", mimeType: "video/mp4" }],
        "http://localhost:3000"
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Item not found");
    });

    it("should return error if filename sanitizes to empty", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-123" },
        expires: new Date().toISOString(),
      } as never);
      vi.mocked(prisma.googleDriveConnection.findUnique).mockResolvedValue({
        id: "conn-123",
        userId: "user-123",
        rootFolderId: "root-folder-id",
        needsReauth: false,
        encryptedAccessToken: "encrypted:access-token",
        accessTokenExpiry: new Date(Date.now() + 3600000),
      } as never);
      vi.mocked(prisma.item.findFirst).mockResolvedValue({
        id: "item-123",
        driveFileId: "drive-folder-123",
      } as never);

      const { createUploadSessions } =
        await import("@/lib/google-drive-upload");
      // Filename with only path separators becomes empty after sanitization
      const result = await createUploadSessions(
        "item-123",
        [{ name: "../..", mimeType: "text/plain" }],
        "http://localhost:3000"
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid filename");
    });

    it("should return upload sessions on success", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-123" },
        expires: new Date().toISOString(),
      } as never);
      vi.mocked(prisma.googleDriveConnection.findUnique).mockResolvedValue({
        id: "conn-123",
        userId: "user-123",
        rootFolderId: "root-folder-id",
        needsReauth: false,
        encryptedAccessToken: "encrypted:access-token",
        accessTokenExpiry: new Date(Date.now() + 3600000),
      } as never);
      vi.mocked(prisma.item.findFirst).mockResolvedValue({
        id: "item-123",
        driveFileId: "drive-folder-123",
      } as never);

      const { createUploadSessions } =
        await import("@/lib/google-drive-upload");
      const result = await createUploadSessions(
        "item-123",
        [
          { name: "video.mp4", mimeType: "video/mp4" },
          { name: "poster.jpg", mimeType: "image/jpeg" },
        ],
        "http://localhost:3000"
      );

      expect(result.success).toBe(true);
      expect(result.sessions).toHaveLength(2);
      expect(result.sessions![0].fileName).toBe("video.mp4");
      expect(result.sessions![0].uploadUrl).toContain("googleapis.com");
      expect(result.sessions![0].sessionToken).toBeDefined();
      expect(result.sessions![1].fileName).toBe("poster.jpg");
    });

    describe("pre-upload quota check", () => {
      it("should return error when storage quota is exceeded (95%+ used)", async () => {
        vi.mocked(auth).mockResolvedValue({
          user: { id: "user-1" },
          expires: new Date().toISOString(),
        } as never);

        vi.mocked(prisma.googleDriveConnection.findUnique).mockResolvedValue({
          id: "conn-1",
          userId: "user-1",
          rootFolderId: "root-1",
          needsReauth: false,
          encryptedAccessToken: "encrypted:token",
          accessTokenExpiry: new Date(Date.now() + 3600000),
          // 14.5 GB of 15 GB used (96.7%)
          quotaBytesUsed: BigInt("15569256448"),
          quotaBytesTotal: BigInt("16106127360"),
        } as never);

        vi.mocked(prisma.item.findFirst).mockResolvedValue({
          id: "item-1",
          driveFileId: "drive-folder-1",
        } as never);

        const { createUploadSessions } =
          await import("@/lib/google-drive-upload");
        const result = await createUploadSessions(
          "item-1",
          [{ name: "video.mp4", mimeType: "video/mp4" }],
          "https://localhost:3000"
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain("storage");
      });

      it("should block upload at exactly 95% usage (boundary)", async () => {
        vi.mocked(auth).mockResolvedValue({
          user: { id: "user-1" },
          expires: new Date().toISOString(),
        } as never);

        vi.mocked(prisma.googleDriveConnection.findUnique).mockResolvedValue({
          id: "conn-1",
          userId: "user-1",
          rootFolderId: "root-1",
          needsReauth: false,
          encryptedAccessToken: "encrypted:token",
          accessTokenExpiry: new Date(Date.now() + 3600000),
          // Exactly 95% of 100 GB
          quotaBytesUsed: BigInt("102005473280"),
          quotaBytesTotal: BigInt("107374182400"),
        } as never);

        vi.mocked(prisma.item.findFirst).mockResolvedValue({
          id: "item-1",
          driveFileId: "drive-folder-1",
        } as never);

        const { createUploadSessions } =
          await import("@/lib/google-drive-upload");
        const result = await createUploadSessions(
          "item-1",
          [{ name: "video.mp4", mimeType: "video/mp4" }],
          "https://localhost:3000"
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain("storage");
      });

      it("should skip quota check when quota data is not available", async () => {
        vi.mocked(auth).mockResolvedValue({
          user: { id: "user-1" },
          expires: new Date().toISOString(),
        } as never);

        vi.mocked(prisma.googleDriveConnection.findUnique).mockResolvedValue({
          id: "conn-1",
          userId: "user-1",
          rootFolderId: "root-1",
          needsReauth: false,
          encryptedAccessToken: "encrypted:token",
          encryptedRefreshToken: "encrypted:refresh",
          accessTokenExpiry: new Date(Date.now() + 3600000),
          quotaBytesUsed: null,
          quotaBytesTotal: null,
        } as never);

        vi.mocked(prisma.item.findFirst).mockResolvedValue({
          id: "item-1",
          driveFileId: "drive-folder-1",
        } as never);

        const { createUploadSessions } =
          await import("@/lib/google-drive-upload");
        const result = await createUploadSessions(
          "item-1",
          [{ name: "video.mp4", mimeType: "video/mp4" }],
          "https://localhost:3000"
        );

        // Should not fail with quota error (might fail for other reasons)
        if (!result.success) {
          expect(result.error).not.toContain("storage");
        }
      });
    });
  });

  describe("confirmUpload", () => {
    it("should return error if not authenticated", async () => {
      vi.mocked(auth).mockResolvedValue(null as never);

      const { confirmUpload } = await import("@/lib/google-drive-upload");
      const result = await confirmUpload("some-token", "drive-file-123");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Not authenticated");
    });

    it("should return error if token is invalid", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-123" },
        expires: new Date().toISOString(),
      } as never);

      const { confirmUpload } = await import("@/lib/google-drive-upload");
      const result = await confirmUpload("invalid-token", "drive-file-123");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid or expired session token");
    });

    it("should return error if file already registered (replay attack)", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-123" },
        expires: new Date().toISOString(),
      } as never);

      // First create a valid session to get a real token
      vi.mocked(prisma.googleDriveConnection.findUnique).mockResolvedValue({
        id: "conn-123",
        userId: "user-123",
        rootFolderId: "root-folder-id",
        needsReauth: false,
        encryptedAccessToken: "encrypted:access-token",
        accessTokenExpiry: new Date(Date.now() + 3600000),
      } as never);
      vi.mocked(prisma.item.findFirst).mockResolvedValue({
        id: "item-123",
        driveFileId: "drive-folder-123",
      } as never);

      const { createUploadSessions, confirmUpload } =
        await import("@/lib/google-drive-upload");
      const sessionResult = await createUploadSessions(
        "item-123",
        [{ name: "test.mp4", mimeType: "video/mp4" }],
        "http://localhost:3000"
      );

      // Now try to confirm with existing file
      vi.mocked(prisma.itemFile.findFirst).mockResolvedValue({
        id: "existing-file-123",
        driveFileId: "drive-file-123",
      } as never);

      const result = await confirmUpload(
        sessionResult.sessions![0].sessionToken,
        "drive-file-123"
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("File already registered");
    });

    it("should return error if item not found", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-123" },
        expires: new Date().toISOString(),
      } as never);

      // First create a valid session
      vi.mocked(prisma.googleDriveConnection.findUnique).mockResolvedValue({
        id: "conn-123",
        userId: "user-123",
        rootFolderId: "root-folder-id",
        needsReauth: false,
        encryptedAccessToken: "encrypted:access-token",
        accessTokenExpiry: new Date(Date.now() + 3600000),
      } as never);
      vi.mocked(prisma.item.findFirst).mockResolvedValue({
        id: "item-123",
        driveFileId: "drive-folder-123",
      } as never);

      const { createUploadSessions, confirmUpload } =
        await import("@/lib/google-drive-upload");
      const sessionResult = await createUploadSessions(
        "item-123",
        [{ name: "test.mp4", mimeType: "video/mp4" }],
        "http://localhost:3000"
      );

      // Now item doesn't exist when confirming
      vi.mocked(prisma.itemFile.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.item.findFirst).mockResolvedValue(null);

      const result = await confirmUpload(
        sessionResult.sessions![0].sessionToken,
        "new-drive-file-123"
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Item not found");
    });

    it("should create ItemFile on successful confirmation", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-123" },
        expires: new Date().toISOString(),
      } as never);

      // First create a valid session
      vi.mocked(prisma.googleDriveConnection.findUnique).mockResolvedValue({
        id: "conn-123",
        userId: "user-123",
        rootFolderId: "root-folder-id",
        needsReauth: false,
        encryptedAccessToken: "encrypted:access-token",
        accessTokenExpiry: new Date(Date.now() + 3600000),
      } as never);
      vi.mocked(prisma.item.findFirst).mockResolvedValue({
        id: "item-123",
        driveFileId: "drive-folder-123",
      } as never);

      const { createUploadSessions, confirmUpload } =
        await import("@/lib/google-drive-upload");
      const sessionResult = await createUploadSessions(
        "item-123",
        [{ name: "test.mp4", mimeType: "video/mp4" }],
        "http://localhost:3000"
      );

      // Setup for confirmation
      vi.mocked(prisma.itemFile.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.item.findFirst).mockResolvedValue({
        id: "item-123",
        userId: "user-123",
      } as never);
      vi.mocked(prisma.itemFile.create).mockResolvedValue({
        id: "new-file-123",
        filename: "test.mp4",
        fileType: "MEDIA",
      } as never);

      const result = await confirmUpload(
        sessionResult.sessions![0].sessionToken,
        "new-drive-file-123"
      );

      expect(result.success).toBe(true);
      expect(result.itemFile).toBeDefined();
      expect(result.itemFile!.filename).toBe("test.mp4");
      expect(prisma.itemFile.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            itemId: "item-123",
            filename: "test.mp4",
            driveFileId: "new-drive-file-123",
            mimeType: "video/mp4",
          }),
        })
      );
    });
  });

  describe("uploadBuffer", () => {
    it("should return error if not authenticated", async () => {
      vi.mocked(auth).mockResolvedValue(null as never);

      const { uploadBuffer } = await import("@/lib/google-drive-upload");
      const result = await uploadBuffer(
        "item-123",
        Buffer.from("test"),
        "test.txt",
        "text/plain"
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Not authenticated");
    });

    it("should return error if item not found", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-123" },
        expires: new Date().toISOString(),
      } as never);
      vi.mocked(prisma.item.findFirst).mockResolvedValue(null);

      const { uploadBuffer } = await import("@/lib/google-drive-upload");
      const result = await uploadBuffer(
        "item-123",
        Buffer.from("test"),
        "test.txt",
        "text/plain"
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Item not found");
    });

    it("should return error if item has no Drive connection", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-123" },
        expires: new Date().toISOString(),
      } as never);
      vi.mocked(prisma.item.findFirst).mockResolvedValue({
        id: "item-123",
        driveFileId: "drive-file-123",
        driveConnectionId: null,
      } as never);

      const { uploadBuffer } = await import("@/lib/google-drive-upload");
      const result = await uploadBuffer(
        "item-123",
        Buffer.from("test"),
        "test.txt",
        "text/plain"
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Item has no Drive connection");
    });

    it("should upload buffer and return driveFileId on success", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-123" },
        expires: new Date().toISOString(),
      } as never);
      vi.mocked(prisma.item.findFirst).mockResolvedValue({
        id: "item-123",
        driveFileId: "drive-folder-123",
        driveConnectionId: "conn-123",
      } as never);
      vi.mocked(prisma.googleDriveConnection.findUnique).mockResolvedValue({
        id: "conn-123",
        userId: "user-123",
        rootFolderId: "root-folder-id",
        needsReauth: false,
      } as never);

      const { getDriveClient, uploadFile } =
        await import("@/lib/google-drive-client");
      vi.mocked(getDriveClient).mockResolvedValue({} as never);
      vi.mocked(uploadFile).mockResolvedValue({
        id: "new-drive-file-id",
        name: "test.txt",
      });

      const { uploadBuffer } = await import("@/lib/google-drive-upload");
      const result = await uploadBuffer(
        "item-123",
        Buffer.from("test content"),
        "test.txt",
        "text/plain"
      );

      expect(result.success).toBe(true);
      expect(result.data?.driveFileId).toBe("new-drive-file-id");
      expect(uploadFile).toHaveBeenCalledWith(
        {},
        "test.txt",
        expect.any(Buffer),
        "text/plain",
        "drive-folder-123"
      );
    });
  });
});
