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
});
