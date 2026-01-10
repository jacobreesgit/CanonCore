/**
 * Unit tests for Google Drive server actions.
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
  generateOAuthState: vi.fn(() => "test-state"),
  getAuthorizationUrl: vi.fn(() => "https://accounts.google.com/oauth"),
  getDriveClient: vi.fn(),
  withRateLimit: vi.fn((fn) => fn()),
  createFolder: vi.fn(),
  deleteFile: vi.fn(),
  renameFile: vi.fn(),
  moveFile: vi.fn(),
  uploadFile: vi.fn(),
  createResumableUploadUrl: vi.fn(
    () =>
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable"
  ),
  refreshAccessToken: vi.fn(() => "refreshed-access-token"),
}));

// Mock crypto module
vi.mock("@/lib/crypto", () => ({
  encryptCredential: vi.fn((value) => `encrypted:${value}`),
  decryptCredential: vi.fn((value) => value.replace("encrypted:", "")),
}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Set process.env for signing functions (they use process.env directly)
process.env.AUTH_SECRET = "test-auth-secret-32-bytes-long!!";

describe("google-drive-actions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("initiateGoogleDriveOAuth", () => {
    it("should return error if not authenticated", async () => {
      vi.mocked(auth).mockResolvedValue(null as never);

      const { initiateGoogleDriveOAuth } =
        await import("@/lib/google-drive-actions");
      const result = await initiateGoogleDriveOAuth();

      expect(result.success).toBe(false);
      expect(result.error).toBe("Unauthorized");
    });

    it("should return authorization URL if authenticated", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-123" },
        expires: new Date().toISOString(),
      } as never);

      const { initiateGoogleDriveOAuth } =
        await import("@/lib/google-drive-actions");
      const result = await initiateGoogleDriveOAuth();

      expect(result.success).toBe(true);
      expect(result.url).toBe("https://accounts.google.com/oauth");
    });
  });

  describe("disconnectGoogleDrive", () => {
    it("should return error if not authenticated", async () => {
      vi.mocked(auth).mockResolvedValue(null as never);

      const { disconnectGoogleDrive } =
        await import("@/lib/google-drive-actions");
      const result = await disconnectGoogleDrive();

      expect(result.success).toBe(false);
      expect(result.error).toBe("Unauthorized");
    });

    it("should return error if no connection exists", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-123" },
        expires: new Date().toISOString(),
      } as never);
      vi.mocked(prisma.googleDriveConnection.findUnique).mockResolvedValue(
        null
      );

      const { disconnectGoogleDrive } =
        await import("@/lib/google-drive-actions");
      const result = await disconnectGoogleDrive();

      expect(result.success).toBe(false);
      expect(result.error).toBe("No connection to disconnect");
    });
  });

  describe("getGoogleDriveConnection", () => {
    it("should return null if not authenticated", async () => {
      vi.mocked(auth).mockResolvedValue(null as never);

      const { getGoogleDriveConnection } =
        await import("@/lib/google-drive-actions");
      const result = await getGoogleDriveConnection();

      expect(result).toBeNull();
    });

    it("should return connection if exists", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-123" },
        expires: new Date().toISOString(),
      } as never);
      const mockConnection = {
        id: "conn-123",
        userId: "user-123",
        name: "Google Drive",
        email: "test@gmail.com",
        isActive: true,
        needsReauth: false,
      };
      vi.mocked(prisma.googleDriveConnection.findUnique).mockResolvedValue(
        mockConnection as never
      );

      const { getGoogleDriveConnection } =
        await import("@/lib/google-drive-actions");
      const result = await getGoogleDriveConnection();

      expect(result).toEqual(mockConnection);
    });
  });

  describe("syncFromGoogleDrive", () => {
    it("should return error if not authenticated", async () => {
      vi.mocked(auth).mockResolvedValue(null as never);

      const { syncFromGoogleDrive } =
        await import("@/lib/google-drive-actions");
      const result = await syncFromGoogleDrive();

      expect(result.success).toBe(false);
      expect(result.error).toBe("Unauthorized");
    });

    it("should return error if no connection exists", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-123" },
        expires: new Date().toISOString(),
      } as never);
      vi.mocked(prisma.googleDriveConnection.findUnique).mockResolvedValue(
        null
      );

      const { syncFromGoogleDrive } =
        await import("@/lib/google-drive-actions");
      const result = await syncFromGoogleDrive();

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

      const { syncFromGoogleDrive } =
        await import("@/lib/google-drive-actions");
      const result = await syncFromGoogleDrive();

      expect(result.success).toBe(false);
      expect(result.error).toBe("Please reconnect your Google Drive");
    });
  });

  describe("createFolderInGoogleDrive", () => {
    it("should return error if not authenticated", async () => {
      vi.mocked(auth).mockResolvedValue(null as never);

      const { createFolderInGoogleDrive } =
        await import("@/lib/google-drive-actions");
      const result = await createFolderInGoogleDrive(null, "Test Folder");

      expect(result).toEqual({ success: false, error: "Not authenticated" });
    });

    it("should return error if no connection exists", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-123" },
        expires: new Date().toISOString(),
      } as never);
      vi.mocked(prisma.googleDriveConnection.findUnique).mockResolvedValue(
        null
      );

      const { createFolderInGoogleDrive } =
        await import("@/lib/google-drive-actions");
      const result = await createFolderInGoogleDrive(null, "Test Folder");

      expect(result).toEqual({
        success: false,
        error: "No Google Drive connected",
      });
    });

    it("should return error if parent item not found", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-123" },
        expires: new Date().toISOString(),
      } as never);
      vi.mocked(prisma.googleDriveConnection.findUnique).mockResolvedValue({
        id: "conn-123",
        userId: "user-123",
        rootFolderId: "root-folder-id",
      } as never);
      vi.mocked(prisma.item.findFirst).mockResolvedValue(null);

      const { createFolderInGoogleDrive } =
        await import("@/lib/google-drive-actions");
      const result = await createFolderInGoogleDrive(
        "parent-item-123",
        "Test Folder"
      );

      expect(result).toEqual({
        success: false,
        error: "Parent folder not found in Drive",
      });
    });
  });

  describe("createDriveFolderOnly", () => {
    it("should return error if not authenticated", async () => {
      vi.mocked(auth).mockResolvedValue(null as never);

      const { createDriveFolderOnly } =
        await import("@/lib/google-drive-actions");
      const result = await createDriveFolderOnly(null, "Test Folder");

      expect(result).toEqual({ success: false, error: "Not authenticated" });
    });

    it("should return error if no connection exists", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-123" },
        expires: new Date().toISOString(),
      } as never);
      vi.mocked(prisma.googleDriveConnection.findUnique).mockResolvedValue(
        null
      );

      const { createDriveFolderOnly } =
        await import("@/lib/google-drive-actions");
      const result = await createDriveFolderOnly(null, "Test Folder");

      expect(result).toEqual({
        success: false,
        error: "No Google Drive connected",
      });
    });

    it("should return error if parent item not found", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-123" },
        expires: new Date().toISOString(),
      } as never);
      vi.mocked(prisma.googleDriveConnection.findUnique).mockResolvedValue({
        id: "conn-123",
        userId: "user-123",
        rootFolderId: "root-folder-id",
      } as never);
      vi.mocked(prisma.item.findFirst).mockResolvedValue(null);

      const { createDriveFolderOnly } =
        await import("@/lib/google-drive-actions");
      const result = await createDriveFolderOnly(
        "parent-item-123",
        "Test Folder"
      );

      expect(result).toEqual({
        success: false,
        error: "Parent folder not found in Drive",
      });
    });

    it("should return only driveFileId without creating Item", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-123" },
        expires: new Date().toISOString(),
      } as never);
      vi.mocked(prisma.googleDriveConnection.findUnique).mockResolvedValue({
        id: "conn-123",
        userId: "user-123",
        rootFolderId: "root-folder-id",
        accessToken: "token",
        refreshToken: "refresh",
      } as never);

      const mockDriveClient = {
        files: {
          create: vi.fn().mockResolvedValue({
            data: { id: "new-folder-id" },
          }),
        },
      };

      const googleDriveClient = await import("@/lib/google-drive-client");
      vi.mocked(googleDriveClient.getDriveClient).mockResolvedValue(
        mockDriveClient as never
      );
      vi.mocked(googleDriveClient.createFolder).mockResolvedValue(
        "new-folder-id"
      );

      const { createDriveFolderOnly } =
        await import("@/lib/google-drive-actions");
      const result = await createDriveFolderOnly(null, "Test Folder");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({ driveFileId: "new-folder-id" });
      }
      // Should NOT create an Item record
      expect(prisma.item.create).not.toHaveBeenCalled();
    });
  });

  describe("deleteItemFromGoogleDrive", () => {
    it("should return error if not authenticated", async () => {
      vi.mocked(auth).mockResolvedValue(null as never);

      const { deleteItemFromGoogleDrive } =
        await import("@/lib/google-drive-actions");
      const result = await deleteItemFromGoogleDrive("item-123");

      expect(result).toEqual({ success: false, error: "Not authenticated" });
    });

    it("should return error if item not found", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-123" },
        expires: new Date().toISOString(),
      } as never);
      vi.mocked(prisma.item.findFirst).mockResolvedValue(null);

      const { deleteItemFromGoogleDrive } =
        await import("@/lib/google-drive-actions");
      const result = await deleteItemFromGoogleDrive("item-123");

      expect(result).toEqual({ success: false, error: "Item not found" });
    });

    it("should return success if item has no Drive connection", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-123" },
        expires: new Date().toISOString(),
      } as never);
      vi.mocked(prisma.item.findFirst).mockResolvedValue({
        id: "item-123",
        driveFileId: null,
        driveConnectionId: null,
      } as never);

      const { deleteItemFromGoogleDrive } =
        await import("@/lib/google-drive-actions");
      const result = await deleteItemFromGoogleDrive("item-123");

      expect(result.success).toBe(true);
    });
  });

  describe("renameItemInGoogleDrive", () => {
    it("should return error if not authenticated", async () => {
      vi.mocked(auth).mockResolvedValue(null as never);

      const { renameItemInGoogleDrive } =
        await import("@/lib/google-drive-actions");
      const result = await renameItemInGoogleDrive("item-123", "New Name");

      expect(result).toEqual({ success: false, error: "Not authenticated" });
    });

    it("should return error if item not found", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-123" },
        expires: new Date().toISOString(),
      } as never);
      vi.mocked(prisma.item.findFirst).mockResolvedValue(null);

      const { renameItemInGoogleDrive } =
        await import("@/lib/google-drive-actions");
      const result = await renameItemInGoogleDrive("item-123", "New Name");

      expect(result).toEqual({ success: false, error: "Item not found" });
    });

    it("should return success if item has no Drive connection", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-123" },
        expires: new Date().toISOString(),
      } as never);
      vi.mocked(prisma.item.findFirst).mockResolvedValue({
        id: "item-123",
        driveFileId: null,
      } as never);

      const { renameItemInGoogleDrive } =
        await import("@/lib/google-drive-actions");
      const result = await renameItemInGoogleDrive("item-123", "New Name");

      expect(result.success).toBe(true);
    });
  });

  describe("moveItemInGoogleDrive", () => {
    it("should return error if not authenticated", async () => {
      vi.mocked(auth).mockResolvedValue(null as never);

      const { moveItemInGoogleDrive } =
        await import("@/lib/google-drive-actions");
      const result = await moveItemInGoogleDrive(
        "item-123",
        "new-parent-456",
        "old-parent-789"
      );

      expect(result).toEqual({ success: false, error: "Not authenticated" });
    });

    it("should return error if item not found", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-123" },
        expires: new Date().toISOString(),
      } as never);
      vi.mocked(prisma.item.findFirst).mockResolvedValue(null);

      const { moveItemInGoogleDrive } =
        await import("@/lib/google-drive-actions");
      const result = await moveItemInGoogleDrive(
        "item-123",
        "new-parent-456",
        "old-parent-789"
      );

      expect(result).toEqual({ success: false, error: "Item not found" });
    });

    it("should return success if item has no Drive connection", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-123" },
        expires: new Date().toISOString(),
      } as never);
      vi.mocked(prisma.item.findFirst).mockResolvedValue({
        id: "item-123",
        driveFileId: null,
      } as never);

      const { moveItemInGoogleDrive } =
        await import("@/lib/google-drive-actions");
      const result = await moveItemInGoogleDrive("item-123", null, null);

      expect(result.success).toBe(true);
    });
  });

  describe("createUploadSessions", () => {
    it("should return error if not authenticated", async () => {
      vi.mocked(auth).mockResolvedValue(null as never);

      const { createUploadSessions } =
        await import("@/lib/google-drive-actions");
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
        await import("@/lib/google-drive-actions");
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
        await import("@/lib/google-drive-actions");
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
        await import("@/lib/google-drive-actions");
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
        await import("@/lib/google-drive-actions");
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
        await import("@/lib/google-drive-actions");
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
        await import("@/lib/google-drive-actions");
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
        await import("@/lib/google-drive-actions");
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
  });

  describe("confirmUpload", () => {
    it("should return error if not authenticated", async () => {
      vi.mocked(auth).mockResolvedValue(null as never);

      const { confirmUpload } = await import("@/lib/google-drive-actions");
      const result = await confirmUpload("some-token", "drive-file-123");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Not authenticated");
    });

    it("should return error if token is invalid", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-123" },
        expires: new Date().toISOString(),
      } as never);

      const { confirmUpload } = await import("@/lib/google-drive-actions");
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
        await import("@/lib/google-drive-actions");
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
        await import("@/lib/google-drive-actions");
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
        await import("@/lib/google-drive-actions");
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
});
