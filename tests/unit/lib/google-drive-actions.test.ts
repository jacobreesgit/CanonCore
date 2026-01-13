/**
 * Unit tests for Google Drive server actions.
 * Tests OAuth, connection management, and folder operations.
 *
 * For sync tests, see: google-drive-sync.test.ts
 * For upload tests, see: google-drive-upload.test.ts
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
}));

// Mock crypto module
vi.mock("@/lib/crypto", () => ({
  encryptCredential: vi.fn((value) => `encrypted:${value}`),
  decryptCredential: vi.fn((value) => value.replace("encrypted:", "")),
}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

  describe("deleteFileFromDrive", () => {
    it("should throw error when not authenticated", async () => {
      vi.mocked(auth).mockResolvedValue(null as never);

      const { deleteFileFromDrive } =
        await import("@/lib/google-drive-actions");

      await expect(deleteFileFromDrive("drive-file-123")).rejects.toThrow(
        "Unauthorized"
      );
    });

    it("should silently return when no Drive connection exists", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-123", email: "test@example.com" },
        expires: new Date().toISOString(),
      } as never);
      vi.mocked(prisma.googleDriveConnection.findUnique).mockResolvedValue(
        null
      );

      const { deleteFileFromDrive } =
        await import("@/lib/google-drive-actions");

      // Should not throw
      await expect(
        deleteFileFromDrive("drive-file-123")
      ).resolves.toBeUndefined();
    });

    it("should call Drive API to delete file", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-123", email: "test@example.com" },
        expires: new Date().toISOString(),
      } as never);
      vi.mocked(prisma.googleDriveConnection.findUnique).mockResolvedValue({
        id: "conn-1",
        userId: "user-123",
        accessToken: "encrypted:access-token",
        refreshToken: "encrypted:refresh-token",
        encryptedAccessToken: "encrypted:access-token",
        accessTokenExpiry: new Date(Date.now() + 3600000),
        needsReauth: false,
      } as never);

      const mockDelete = vi.fn().mockResolvedValue({});
      const { getDriveClient } = await import("@/lib/google-drive-client");
      vi.mocked(getDriveClient).mockResolvedValue({
        files: { delete: mockDelete },
      } as never);

      const { deleteFileFromDrive } =
        await import("@/lib/google-drive-actions");
      await deleteFileFromDrive("drive-file-123");

      expect(mockDelete).toHaveBeenCalledWith({
        fileId: "drive-file-123",
      });
    });
  });
});
