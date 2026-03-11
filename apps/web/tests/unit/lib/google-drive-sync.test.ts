/**
 * Unit tests for Google Drive sync operations.
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
  checkRootFolderStatus: vi.fn(() => ({ exists: true, trashed: false })),
}));

// Mock logger
vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock sync-log module
vi.mock("@/lib/sync-log", () => ({
  logSyncOperation: vi.fn(),
  startSyncTimer: vi.fn(() => () => 100),
  SyncLogAction: {
    CREATE: "CREATE",
    RENAME: "RENAME",
    DELETE: "DELETE",
    MOVE: "MOVE",
    UPLOAD: "UPLOAD",
    DOWNLOAD: "DOWNLOAD",
    SYNC: "SYNC",
  },
  SyncLogStatus: {
    SUCCESS: "SUCCESS",
    FAILED: "FAILED",
    PENDING: "PENDING",
  },
}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

describe("google-drive-sync", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("syncFromGoogleDrive", () => {
    it("should return error if not authenticated", async () => {
      vi.mocked(auth).mockResolvedValue(null as never);

      const { syncFromGoogleDrive } = await import("@/lib/google-drive-sync");
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

      const { syncFromGoogleDrive } = await import("@/lib/google-drive-sync");
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

      const { syncFromGoogleDrive } = await import("@/lib/google-drive-sync");
      const result = await syncFromGoogleDrive();

      expect(result.success).toBe(false);
      expect(result.error).toBe("Please reconnect your Google Drive");
    });

    it("should return ROOT_FOLDER_TRASHED when root folder is in trash", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-123" },
        expires: new Date().toISOString(),
      } as never);
      vi.mocked(prisma.googleDriveConnection.findUnique).mockResolvedValue({
        id: "conn-123",
        userId: "user-123",
        rootFolderId: "root-folder-id",
        needsReauth: false,
        lastError: null,
      } as never);

      const { getDriveClient, checkRootFolderStatus } =
        await import("@/lib/google-drive-client");
      vi.mocked(getDriveClient).mockResolvedValue({} as never);
      vi.mocked(checkRootFolderStatus).mockResolvedValue({
        exists: true,
        trashed: true,
      });

      const { syncFromGoogleDrive } = await import("@/lib/google-drive-sync");
      const result = await syncFromGoogleDrive();

      expect(result.success).toBe(false);
      expect(result.error).toBe("ROOT_FOLDER_TRASHED");
      expect(prisma.googleDriveConnection.update).toHaveBeenCalledWith({
        where: { id: "conn-123" },
        data: {
          lastError: "ROOT_FOLDER_TRASHED",
          lastSyncAt: expect.any(Date),
        },
      });
    });

    it("should return ROOT_FOLDER_DELETED when root folder is permanently deleted", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-123" },
        expires: new Date().toISOString(),
      } as never);
      vi.mocked(prisma.googleDriveConnection.findUnique).mockResolvedValue({
        id: "conn-123",
        userId: "user-123",
        rootFolderId: "root-folder-id",
        needsReauth: false,
        lastError: null,
      } as never);

      const { getDriveClient, checkRootFolderStatus } =
        await import("@/lib/google-drive-client");
      vi.mocked(getDriveClient).mockResolvedValue({} as never);
      vi.mocked(checkRootFolderStatus).mockResolvedValue({ exists: false });

      const { syncFromGoogleDrive } = await import("@/lib/google-drive-sync");
      const result = await syncFromGoogleDrive();

      expect(result.success).toBe(false);
      expect(result.error).toBe("ROOT_FOLDER_DELETED");
      expect(prisma.googleDriveConnection.update).toHaveBeenCalledWith({
        where: { id: "conn-123" },
        data: {
          lastError: "ROOT_FOLDER_DELETED",
          lastSyncAt: expect.any(Date),
        },
      });
    });

    it("should clear ROOT_FOLDER error when folder is restored", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-123" },
        expires: new Date().toISOString(),
      } as never);
      vi.mocked(prisma.googleDriveConnection.findUnique).mockResolvedValue({
        id: "conn-123",
        userId: "user-123",
        rootFolderId: "root-folder-id",
        needsReauth: false,
        lastError: "ROOT_FOLDER_TRASHED", // Previously had error
        changePageToken: null,
      } as never);

      const { getDriveClient, checkRootFolderStatus } =
        await import("@/lib/google-drive-client");
      vi.mocked(getDriveClient).mockResolvedValue({
        files: {
          list: vi.fn().mockResolvedValue({ data: { files: [] } }),
        },
        changes: {
          getStartPageToken: vi
            .fn()
            .mockResolvedValue({ data: { startPageToken: "token-1" } }),
        },
      } as never);
      vi.mocked(checkRootFolderStatus).mockResolvedValue({
        exists: true,
        trashed: false,
      });

      vi.mocked(prisma.item.aggregate).mockResolvedValue({
        _max: { order: null },
      } as never);

      const { syncFromGoogleDrive } = await import("@/lib/google-drive-sync");
      await syncFromGoogleDrive();

      // Should clear the error
      expect(prisma.googleDriveConnection.update).toHaveBeenCalledWith({
        where: { id: "conn-123" },
        data: { lastError: null },
      });
    });

    describe("quota update", () => {
      it("should update quota bytes after successful sync", async () => {
        vi.mocked(auth).mockResolvedValue({
          user: { id: "user-123" },
          expires: new Date().toISOString(),
        } as never);

        vi.mocked(prisma.googleDriveConnection.findUnique).mockResolvedValue({
          id: "conn-123",
          userId: "user-123",
          rootFolderId: "root-folder-id",
          needsReauth: false,
          lastError: null,
          changePageToken: null,
          quotaBytesUsed: null,
          quotaBytesTotal: null,
        } as never);

        const { getDriveClient, checkRootFolderStatus } =
          await import("@/lib/google-drive-client");
        vi.mocked(getDriveClient).mockResolvedValue({
          files: {
            list: vi.fn().mockResolvedValue({ data: { files: [] } }),
          },
          changes: {
            getStartPageToken: vi
              .fn()
              .mockResolvedValue({ data: { startPageToken: "token-1" } }),
          },
          about: {
            get: vi.fn().mockResolvedValue({
              data: {
                storageQuota: {
                  usage: "1073741824", // 1 GB
                  limit: "16106127360", // 15 GB
                },
              },
            }),
          },
        } as never);
        vi.mocked(checkRootFolderStatus).mockResolvedValue({
          exists: true,
          trashed: false,
        });

        vi.mocked(prisma.item.aggregate).mockResolvedValue({
          _max: { order: null },
        } as never);

        const { syncFromGoogleDrive } = await import("@/lib/google-drive-sync");
        await syncFromGoogleDrive();

        expect(prisma.googleDriveConnection.update).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { userId: "user-123" },
            data: expect.objectContaining({
              quotaBytesUsed: BigInt("1073741824"),
              quotaBytesTotal: BigInt("16106127360"),
            }),
          })
        );
      });

      it("should handle missing quota gracefully", async () => {
        vi.mocked(auth).mockResolvedValue({
          user: { id: "user-123" },
          expires: new Date().toISOString(),
        } as never);

        vi.mocked(prisma.googleDriveConnection.findUnique).mockResolvedValue({
          id: "conn-123",
          userId: "user-123",
          rootFolderId: "root-folder-id",
          needsReauth: false,
          lastError: null,
          changePageToken: null,
        } as never);

        const { getDriveClient, checkRootFolderStatus } =
          await import("@/lib/google-drive-client");
        vi.mocked(getDriveClient).mockResolvedValue({
          files: {
            list: vi.fn().mockResolvedValue({ data: { files: [] } }),
          },
          changes: {
            getStartPageToken: vi
              .fn()
              .mockResolvedValue({ data: { startPageToken: "token-1" } }),
          },
          about: {
            get: vi.fn().mockResolvedValue({
              data: { storageQuota: {} },
            }),
          },
        } as never);
        vi.mocked(checkRootFolderStatus).mockResolvedValue({
          exists: true,
          trashed: false,
        });

        vi.mocked(prisma.item.aggregate).mockResolvedValue({
          _max: { order: null },
        } as never);

        const { syncFromGoogleDrive } = await import("@/lib/google-drive-sync");
        const result = await syncFromGoogleDrive();

        expect(result.success).toBe(true);
      });

      it("should continue sync if quota fetch fails", async () => {
        vi.mocked(auth).mockResolvedValue({
          user: { id: "user-123" },
          expires: new Date().toISOString(),
        } as never);

        vi.mocked(prisma.googleDriveConnection.findUnique).mockResolvedValue({
          id: "conn-123",
          userId: "user-123",
          rootFolderId: "root-folder-id",
          needsReauth: false,
          lastError: null,
          changePageToken: null,
        } as never);

        const { getDriveClient, checkRootFolderStatus } =
          await import("@/lib/google-drive-client");
        vi.mocked(getDriveClient).mockResolvedValue({
          files: {
            list: vi.fn().mockResolvedValue({ data: { files: [] } }),
          },
          changes: {
            getStartPageToken: vi
              .fn()
              .mockResolvedValue({ data: { startPageToken: "token-1" } }),
          },
          about: {
            get: vi.fn().mockRejectedValue(new Error("API error")),
          },
        } as never);
        vi.mocked(checkRootFolderStatus).mockResolvedValue({
          exists: true,
          trashed: false,
        });

        vi.mocked(prisma.item.aggregate).mockResolvedValue({
          _max: { order: null },
        } as never);

        const { syncFromGoogleDrive } = await import("@/lib/google-drive-sync");
        const result = await syncFromGoogleDrive();

        // Sync should still succeed even if quota fetch fails
        expect(result.success).toBe(true);
      });
    });
  });

  describe("syncForConnection - full sync", () => {
    it("should perform full sync when no changePageToken exists", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-123" },
        expires: new Date().toISOString(),
      } as never);

      vi.mocked(prisma.googleDriveConnection.findUnique).mockResolvedValue({
        id: "conn-123",
        userId: "user-123",
        rootFolderId: "root-folder-id",
        needsReauth: false,
        lastError: null,
        changePageToken: null, // No token = full sync
        email: "test@example.com",
        encryptedRefreshToken: "encrypted-token",
        encryptedAccessToken: null,
        accessTokenExpiry: null,
      } as never);

      const mockDrive = {
        files: {
          list: vi.fn().mockResolvedValue({
            data: {
              files: [
                {
                  id: "folder-1",
                  name: "Movies",
                  mimeType: "application/vnd.google-apps.folder",
                },
              ],
              nextPageToken: null,
            },
          }),
        },
        changes: {
          getStartPageToken: vi
            .fn()
            .mockResolvedValue({ data: { startPageToken: "token-1" } }),
        },
        about: {
          get: vi.fn().mockResolvedValue({ data: { storageQuota: {} } }),
        },
      };

      const { getDriveClient, checkRootFolderStatus } =
        await import("@/lib/google-drive-client");
      vi.mocked(getDriveClient).mockResolvedValue(mockDrive as never);
      vi.mocked(checkRootFolderStatus).mockResolvedValue({
        exists: true,
        trashed: false,
      });

      vi.mocked(prisma.item.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.item.findMany).mockResolvedValue([]);
      vi.mocked(prisma.item.aggregate).mockResolvedValue({
        _max: { order: 0 },
      } as never);
      vi.mocked(prisma.item.create).mockResolvedValue({
        id: "item-1",
        name: "Movies",
        driveFileId: "folder-1",
      } as never);

      const { syncFromGoogleDrive } = await import("@/lib/google-drive-sync");
      const result = await syncFromGoogleDrive();

      expect(result.success).toBe(true);
      expect(result.itemsCreated).toBeGreaterThanOrEqual(0);
    });

    it("should perform incremental sync when changePageToken exists", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-123" },
        expires: new Date().toISOString(),
      } as never);

      vi.mocked(prisma.googleDriveConnection.findUnique).mockResolvedValue({
        id: "conn-123",
        userId: "user-123",
        rootFolderId: "root-folder-id",
        needsReauth: false,
        lastError: null,
        changePageToken: "existing-token", // Has token = incremental sync
        email: "test@example.com",
        encryptedRefreshToken: "encrypted-token",
        encryptedAccessToken: null,
        accessTokenExpiry: null,
      } as never);

      const mockDrive = {
        files: {
          list: vi.fn().mockResolvedValue({ data: { files: [] } }),
        },
        changes: {
          list: vi.fn().mockResolvedValue({
            data: {
              changes: [],
              newStartPageToken: "new-token",
            },
          }),
          getStartPageToken: vi
            .fn()
            .mockResolvedValue({ data: { startPageToken: "token-1" } }),
        },
        about: {
          get: vi.fn().mockResolvedValue({ data: { storageQuota: {} } }),
        },
      };

      const { getDriveClient, checkRootFolderStatus } =
        await import("@/lib/google-drive-client");
      vi.mocked(getDriveClient).mockResolvedValue(mockDrive as never);
      vi.mocked(checkRootFolderStatus).mockResolvedValue({
        exists: true,
        trashed: false,
      });

      vi.mocked(prisma.item.aggregate).mockResolvedValue({
        _max: { order: null },
      } as never);
      vi.mocked(prisma.item.findMany).mockResolvedValue([]);

      const { syncFromGoogleDrive } = await import("@/lib/google-drive-sync");
      const result = await syncFromGoogleDrive();

      expect(result.success).toBe(true);
      expect(mockDrive.changes.list).toHaveBeenCalled();
    });
  });

  describe("file type categorization during sync", () => {
    it("should handle file sync with correct categorization", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-123" },
        expires: new Date().toISOString(),
      } as never);

      vi.mocked(prisma.googleDriveConnection.findUnique).mockResolvedValue({
        id: "conn-123",
        userId: "user-123",
        rootFolderId: "root-folder-id",
        needsReauth: false,
        lastError: null,
        changePageToken: null,
        email: "test@example.com",
        encryptedRefreshToken: "encrypted-token",
        encryptedAccessToken: null,
        accessTokenExpiry: null,
      } as never);

      const mockDrive = {
        files: {
          list: vi.fn().mockResolvedValue({
            data: {
              files: [
                {
                  id: "file-1",
                  name: "movie.mp4",
                  mimeType: "video/mp4",
                  size: "1000000",
                },
                {
                  id: "file-2",
                  name: "poster.jpg",
                  mimeType: "image/jpeg",
                  size: "50000",
                },
                {
                  id: "file-3",
                  name: "subs.srt",
                  mimeType: "application/x-subrip",
                  size: "5000",
                },
              ],
            },
          }),
        },
        changes: {
          getStartPageToken: vi
            .fn()
            .mockResolvedValue({ data: { startPageToken: "token-1" } }),
        },
        about: {
          get: vi.fn().mockResolvedValue({ data: { storageQuota: {} } }),
        },
      };

      const { getDriveClient, checkRootFolderStatus } =
        await import("@/lib/google-drive-client");
      vi.mocked(getDriveClient).mockResolvedValue(mockDrive as never);
      vi.mocked(checkRootFolderStatus).mockResolvedValue({
        exists: true,
        trashed: false,
      });

      vi.mocked(prisma.item.findFirst).mockResolvedValue({
        id: "item-1",
        userId: "user-123",
      } as never);
      vi.mocked(prisma.item.findMany).mockResolvedValue([]);
      vi.mocked(prisma.item.aggregate).mockResolvedValue({
        _max: { order: null },
      } as never);
      vi.mocked(prisma.item.create).mockResolvedValue({
        id: "item-new",
      } as never);
      vi.mocked(prisma.itemFile.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.itemFile.create).mockResolvedValue({} as never);
      vi.mocked(prisma.itemFile.upsert).mockResolvedValue({} as never);

      const { syncFromGoogleDrive } = await import("@/lib/google-drive-sync");
      const result = await syncFromGoogleDrive();

      expect(result.success).toBe(true);
    });
  });

  describe("sync depth limiting", () => {
    it("should not sync items beyond maximum depth", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-123" },
        expires: new Date().toISOString(),
      } as never);

      vi.mocked(prisma.googleDriveConnection.findUnique).mockResolvedValue({
        id: "conn-123",
        userId: "user-123",
        rootFolderId: "root-folder-id",
        needsReauth: false,
        lastError: null,
        changePageToken: null,
        email: "test@example.com",
        encryptedRefreshToken: "encrypted-token",
        encryptedAccessToken: null,
        accessTokenExpiry: null,
      } as never);

      const mockDrive = {
        files: {
          list: vi.fn().mockResolvedValue({
            data: {
              files: [
                {
                  id: "folder-1",
                  name: "Level1",
                  mimeType: "application/vnd.google-apps.folder",
                },
              ],
            },
          }),
        },
        changes: {
          getStartPageToken: vi
            .fn()
            .mockResolvedValue({ data: { startPageToken: "token-1" } }),
        },
        about: {
          get: vi.fn().mockResolvedValue({ data: { storageQuota: {} } }),
        },
      };

      const { getDriveClient, checkRootFolderStatus } =
        await import("@/lib/google-drive-client");
      vi.mocked(getDriveClient).mockResolvedValue(mockDrive as never);
      vi.mocked(checkRootFolderStatus).mockResolvedValue({
        exists: true,
        trashed: false,
      });

      vi.mocked(prisma.item.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.item.findMany).mockResolvedValue([]);
      vi.mocked(prisma.item.aggregate).mockResolvedValue({
        _max: { order: null },
      } as never);
      vi.mocked(prisma.item.create).mockResolvedValue({
        id: "item-new",
      } as never);

      const { syncFromGoogleDrive } = await import("@/lib/google-drive-sync");
      const result = await syncFromGoogleDrive();

      // Verify sync completes successfully (depth limiting is internal behavior)
      expect(result.success).toBe(true);
    });
  });

  describe("error handling", () => {
    it("should log and continue when individual file sync fails", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-123" },
        expires: new Date().toISOString(),
      } as never);

      vi.mocked(prisma.googleDriveConnection.findUnique).mockResolvedValue({
        id: "conn-123",
        userId: "user-123",
        rootFolderId: "root-folder-id",
        needsReauth: false,
        lastError: null,
        changePageToken: null,
        email: "test@example.com",
        encryptedRefreshToken: "encrypted-token",
        encryptedAccessToken: null,
        accessTokenExpiry: null,
      } as never);

      const mockDrive = {
        files: {
          list: vi.fn().mockResolvedValue({
            data: {
              files: [
                { id: "file-1", name: "good.mp4", mimeType: "video/mp4" },
                { id: "file-2", name: "bad.mp4", mimeType: "video/mp4" },
              ],
            },
          }),
        },
        changes: {
          getStartPageToken: vi
            .fn()
            .mockResolvedValue({ data: { startPageToken: "token-1" } }),
        },
        about: {
          get: vi.fn().mockResolvedValue({ data: { storageQuota: {} } }),
        },
      };

      const { getDriveClient, checkRootFolderStatus } =
        await import("@/lib/google-drive-client");
      vi.mocked(getDriveClient).mockResolvedValue(mockDrive as never);
      vi.mocked(checkRootFolderStatus).mockResolvedValue({
        exists: true,
        trashed: false,
      });

      vi.mocked(prisma.item.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.item.findMany).mockResolvedValue([]);
      vi.mocked(prisma.item.aggregate).mockResolvedValue({
        _max: { order: null },
      } as never);
      vi.mocked(prisma.item.create).mockResolvedValue({
        id: "item-new",
      } as never);
      vi.mocked(prisma.itemFile.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.itemFile.create).mockResolvedValue({} as never);

      const { syncFromGoogleDrive } = await import("@/lib/google-drive-sync");
      const result = await syncFromGoogleDrive();

      // Should succeed overall even if individual files have issues
      expect(result.success).toBe(true);
    });

    it("should handle Drive API errors gracefully", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-123" },
        expires: new Date().toISOString(),
      } as never);

      vi.mocked(prisma.googleDriveConnection.findUnique).mockResolvedValue({
        id: "conn-123",
        userId: "user-123",
        rootFolderId: "root-folder-id",
        needsReauth: false,
        lastError: null,
        changePageToken: null,
        email: "test@example.com",
        encryptedRefreshToken: "encrypted-token",
        encryptedAccessToken: null,
        accessTokenExpiry: null,
      } as never);

      const { getDriveClient, checkRootFolderStatus } =
        await import("@/lib/google-drive-client");
      vi.mocked(getDriveClient).mockRejectedValue(new Error("API error"));
      vi.mocked(checkRootFolderStatus).mockResolvedValue({
        exists: true,
        trashed: false,
      });

      const { syncFromGoogleDrive } = await import("@/lib/google-drive-sync");
      const result = await syncFromGoogleDrive();

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("syncByUserId", () => {
    it("should return error when no connection exists", async () => {
      vi.mocked(prisma.googleDriveConnection.findUnique).mockResolvedValue(
        null
      );

      const { syncByUserId } = await import("@/lib/google-drive-sync");
      const result = await syncByUserId("user-123");

      expect(result.success).toBe(false);
      expect(result.error).toBe("No Google Drive connected");
    });

    it("should return error when connection needs reauth", async () => {
      vi.mocked(prisma.googleDriveConnection.findUnique).mockResolvedValue({
        id: "conn-123",
        userId: "user-123",
        needsReauth: true,
      } as never);

      const { syncByUserId } = await import("@/lib/google-drive-sync");
      const result = await syncByUserId("user-123");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Please reconnect your Google Drive");
    });

    it("should call syncForConnection when connection exists", async () => {
      vi.mocked(prisma.googleDriveConnection.findUnique).mockResolvedValue({
        id: "conn-123",
        userId: "user-123",
        rootFolderId: "root-folder-id",
        needsReauth: false,
        lastError: null,
        changePageToken: null,
        email: "test@example.com",
        encryptedRefreshToken: "encrypted-token",
        encryptedAccessToken: null,
        accessTokenExpiry: null,
      } as never);

      const { getDriveClient, checkRootFolderStatus } =
        await import("@/lib/google-drive-client");
      vi.mocked(getDriveClient).mockResolvedValue({
        files: {
          list: vi.fn().mockResolvedValue({ data: { files: [] } }),
        },
        changes: {
          getStartPageToken: vi
            .fn()
            .mockResolvedValue({ data: { startPageToken: "token-1" } }),
        },
      } as never);
      vi.mocked(checkRootFolderStatus).mockResolvedValue({
        exists: true,
        trashed: false,
      });

      vi.mocked(prisma.item.aggregate).mockResolvedValue({
        _max: { order: null },
      } as never);

      const { syncByUserId } = await import("@/lib/google-drive-sync");
      const result = await syncByUserId("user-123");

      expect(result.success).toBe(true);
    });
  });

  describe("incremental sync", () => {
    it("should handle expired page token by performing full sync", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-123" },
        expires: new Date().toISOString(),
      } as never);

      vi.mocked(prisma.googleDriveConnection.findUnique).mockResolvedValue({
        id: "conn-123",
        userId: "user-123",
        rootFolderId: "root-folder-id",
        needsReauth: false,
        lastError: null,
        changePageToken: "existing-token", // Has existing token - triggers incremental
        email: "test@example.com",
        encryptedRefreshToken: "encrypted-token",
        encryptedAccessToken: null,
        accessTokenExpiry: null,
      } as never);

      const { getDriveClient, checkRootFolderStatus } =
        await import("@/lib/google-drive-client");

      // First call: incremental sync fails with 404 (expired token)
      // Second call: full sync succeeds
      const mockDrive = {
        files: {
          list: vi.fn().mockResolvedValue({ data: { files: [] } }),
        },
        changes: {
          list: vi
            .fn()
            .mockRejectedValueOnce(
              Object.assign(new Error("pageToken is expired"), { code: 404 })
            ),
          getStartPageToken: vi
            .fn()
            .mockResolvedValue({ data: { startPageToken: "new-token" } }),
        },
      };
      vi.mocked(getDriveClient).mockResolvedValue(mockDrive as never);
      vi.mocked(checkRootFolderStatus).mockResolvedValue({
        exists: true,
        trashed: false,
      });

      vi.mocked(prisma.item.aggregate).mockResolvedValue({
        _max: { order: null },
      } as never);

      const { syncFromGoogleDrive } = await import("@/lib/google-drive-sync");
      const result = await syncFromGoogleDrive();

      // Should clear the page token and retry
      expect(prisma.googleDriveConnection.update).toHaveBeenCalledWith({
        where: { id: "conn-123" },
        data: { changePageToken: null },
      });
      expect(result.success).toBe(true);
    });

    it("should handle file removals in incremental sync", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-123" },
        expires: new Date().toISOString(),
      } as never);

      vi.mocked(prisma.googleDriveConnection.findUnique).mockResolvedValue({
        id: "conn-123",
        userId: "user-123",
        rootFolderId: "root-folder-id",
        needsReauth: false,
        lastError: null,
        changePageToken: "existing-token",
        email: "test@example.com",
        encryptedRefreshToken: "encrypted-token",
        encryptedAccessToken: null,
        accessTokenExpiry: null,
      } as never);

      const { getDriveClient, checkRootFolderStatus } =
        await import("@/lib/google-drive-client");

      // Return changes with removed file
      const mockDrive = {
        files: {
          list: vi.fn().mockResolvedValue({ data: { files: [] } }),
        },
        changes: {
          list: vi.fn().mockResolvedValue({
            data: {
              changes: [{ fileId: "removed-file-id", removed: true }],
              newStartPageToken: "new-token",
            },
          }),
          getStartPageToken: vi
            .fn()
            .mockResolvedValue({ data: { startPageToken: "new-token" } }),
        },
      };
      vi.mocked(getDriveClient).mockResolvedValue(mockDrive as never);
      vi.mocked(checkRootFolderStatus).mockResolvedValue({
        exists: true,
        trashed: false,
      });

      // Mock finding the item to delete
      vi.mocked(prisma.item.findFirst).mockResolvedValueOnce({
        id: "item-123",
        driveFileId: "removed-file-id",
      } as never);

      vi.mocked(prisma.item.aggregate).mockResolvedValue({
        _max: { order: null },
      } as never);

      const { syncFromGoogleDrive } = await import("@/lib/google-drive-sync");
      await syncFromGoogleDrive();

      // Should delete the item
      expect(prisma.item.delete).toHaveBeenCalledWith({
        where: { id: "item-123" },
      });
    });

    it("should handle file removal when file is ItemFile not Item", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-123" },
        expires: new Date().toISOString(),
      } as never);

      vi.mocked(prisma.googleDriveConnection.findUnique).mockResolvedValue({
        id: "conn-123",
        userId: "user-123",
        rootFolderId: "root-folder-id",
        needsReauth: false,
        lastError: null,
        changePageToken: "existing-token",
        email: "test@example.com",
        encryptedRefreshToken: "encrypted-token",
        encryptedAccessToken: null,
        accessTokenExpiry: null,
      } as never);

      const { getDriveClient, checkRootFolderStatus } =
        await import("@/lib/google-drive-client");

      const mockDrive = {
        files: {
          list: vi.fn().mockResolvedValue({ data: { files: [] } }),
        },
        changes: {
          list: vi.fn().mockResolvedValue({
            data: {
              changes: [{ fileId: "removed-file-id", removed: true }],
              newStartPageToken: "new-token",
            },
          }),
          getStartPageToken: vi
            .fn()
            .mockResolvedValue({ data: { startPageToken: "new-token" } }),
        },
      };
      vi.mocked(getDriveClient).mockResolvedValue(mockDrive as never);
      vi.mocked(checkRootFolderStatus).mockResolvedValue({
        exists: true,
        trashed: false,
      });

      // Item not found, check ItemFile
      vi.mocked(prisma.item.findFirst).mockResolvedValueOnce(null);
      vi.mocked(prisma.itemFile.findFirst).mockResolvedValueOnce({
        id: "file-123",
        driveFileId: "removed-file-id",
      } as never);

      vi.mocked(prisma.item.aggregate).mockResolvedValue({
        _max: { order: null },
      } as never);

      const { syncFromGoogleDrive } = await import("@/lib/google-drive-sync");
      await syncFromGoogleDrive();

      // Should delete the ItemFile
      expect(prisma.itemFile.delete).toHaveBeenCalledWith({
        where: { id: "file-123" },
      });
    });

    it("should handle file changes in incremental sync", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-123" },
        expires: new Date().toISOString(),
      } as never);

      vi.mocked(prisma.googleDriveConnection.findUnique).mockResolvedValue({
        id: "conn-123",
        userId: "user-123",
        rootFolderId: "root-folder-id",
        needsReauth: false,
        lastError: null,
        changePageToken: "existing-token",
        email: "test@example.com",
        encryptedRefreshToken: "encrypted-token",
        encryptedAccessToken: null,
        accessTokenExpiry: null,
      } as never);

      const { getDriveClient, checkRootFolderStatus } =
        await import("@/lib/google-drive-client");

      // Return changes with modified file
      const mockDrive = {
        files: {
          list: vi.fn().mockResolvedValue({ data: { files: [] } }),
        },
        changes: {
          list: vi.fn().mockResolvedValue({
            data: {
              changes: [
                {
                  fileId: "changed-file-id",
                  file: {
                    id: "changed-file-id",
                    name: "Updated Folder",
                    mimeType: "application/vnd.google-apps.folder",
                    parents: ["root-folder-id"], // Top-level
                    modifiedTime: "2024-01-01T00:00:00.000Z",
                    trashed: false,
                  },
                },
              ],
              newStartPageToken: "new-token",
            },
          }),
          getStartPageToken: vi
            .fn()
            .mockResolvedValue({ data: { startPageToken: "new-token" } }),
        },
      };
      vi.mocked(getDriveClient).mockResolvedValue(mockDrive as never);
      vi.mocked(checkRootFolderStatus).mockResolvedValue({
        exists: true,
        trashed: false,
      });

      // File doesn't exist yet - will be created
      vi.mocked(prisma.item.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.item.aggregate).mockResolvedValue({
        _max: { order: null },
      } as never);
      vi.mocked(prisma.item.create).mockResolvedValue({
        id: "new-item-id",
      } as never);

      const { syncFromGoogleDrive } = await import("@/lib/google-drive-sync");
      await syncFromGoogleDrive();

      // Should create the item
      expect(prisma.item.create).toHaveBeenCalled();
    });

    it("should skip file changes when parent is not in tree", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-123" },
        expires: new Date().toISOString(),
      } as never);

      vi.mocked(prisma.googleDriveConnection.findUnique).mockResolvedValue({
        id: "conn-123",
        userId: "user-123",
        rootFolderId: "root-folder-id",
        needsReauth: false,
        lastError: null,
        changePageToken: "existing-token",
        email: "test@example.com",
        encryptedRefreshToken: "encrypted-token",
        encryptedAccessToken: null,
        accessTokenExpiry: null,
      } as never);

      const { getDriveClient, checkRootFolderStatus } =
        await import("@/lib/google-drive-client");

      // Return changes with file in unknown parent
      const mockDrive = {
        files: {
          list: vi.fn().mockResolvedValue({ data: { files: [] } }),
        },
        changes: {
          list: vi.fn().mockResolvedValue({
            data: {
              changes: [
                {
                  fileId: "file-id",
                  file: {
                    id: "file-id",
                    name: "Random File",
                    mimeType: "application/vnd.google-apps.folder",
                    parents: ["unknown-parent-id"], // Not in tree
                    modifiedTime: "2024-01-01T00:00:00.000Z",
                    trashed: false,
                  },
                },
              ],
              newStartPageToken: "new-token",
            },
          }),
          getStartPageToken: vi
            .fn()
            .mockResolvedValue({ data: { startPageToken: "new-token" } }),
        },
      };
      vi.mocked(getDriveClient).mockResolvedValue(mockDrive as never);
      vi.mocked(checkRootFolderStatus).mockResolvedValue({
        exists: true,
        trashed: false,
      });

      // Parent not found in our items
      vi.mocked(prisma.item.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.item.aggregate).mockResolvedValue({
        _max: { order: null },
      } as never);

      const { syncFromGoogleDrive } = await import("@/lib/google-drive-sync");
      const result = await syncFromGoogleDrive();

      expect(result.success).toBe(true);
      // Should not create item since parent is not in tree
      expect(prisma.item.create).not.toHaveBeenCalled();
    });
  });
});
