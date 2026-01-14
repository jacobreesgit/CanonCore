/**
 * Unit tests for sync logging utilities.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import {
  logSyncOperation,
  logSyncOperationsBatch,
  getSyncHistory,
  getSyncHistoryAction,
  cleanupOldSyncLogs,
} from "@/lib/sync-log";
import {
  sanitizeErrorMessage,
  SyncLogAction,
  SyncLogStatus,
} from "@/lib/sync-utils";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    syncLog: {
      create: vi.fn(),
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  createUserLogger: vi.fn(() => ({
    error: vi.fn(),
    info: vi.fn(),
  })),
}));

describe("sync-log", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("sanitizeErrorMessage", () => {
    it("removes bearer tokens", () => {
      const message =
        "Auth failed: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9";
      expect(sanitizeErrorMessage(message)).toBe("Auth failed: [REDACTED]");
    });

    it("removes API keys", () => {
      const message = 'Request failed with api_key="sk-1234567890"';
      expect(sanitizeErrorMessage(message)).toBe(
        "Request failed with [REDACTED]"
      );
    });

    it("removes local paths", () => {
      const message = "File not found at /Users/john/secret/file.txt";
      expect(sanitizeErrorMessage(message)).toBe(
        "File not found at [REDACTED]/secret/file.txt"
      );
    });

    it("truncates long messages", () => {
      const longMessage = "a".repeat(600);
      expect(sanitizeErrorMessage(longMessage).length).toBe(500);
    });
  });

  describe("logSyncOperation", () => {
    it("creates a sync log entry and returns ID", async () => {
      vi.mocked(prisma.syncLog.create).mockResolvedValue({
        id: "log-1",
        userId: "user-1",
        action: SyncLogAction.CREATE,
        itemId: "item-1",
        itemName: "Test Item",
        fileId: null,
        fileName: null,
        status: SyncLogStatus.SUCCESS,
        error: null,
        duration: 150,
        createdAt: new Date(),
      });

      const result = await logSyncOperation({
        userId: "user-1",
        action: SyncLogAction.CREATE,
        itemId: "item-1",
        itemName: "Test Item",
        status: SyncLogStatus.SUCCESS,
        duration: 150,
      });

      expect(result).toBe("log-1");
      expect(prisma.syncLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: "user-1",
          action: SyncLogAction.CREATE,
          itemId: "item-1",
          itemName: "Test Item",
          status: SyncLogStatus.SUCCESS,
          duration: 150,
        }),
      });
    });

    it("sanitizes error messages before storing", async () => {
      vi.mocked(prisma.syncLog.create).mockResolvedValue({
        id: "log-1",
        userId: "user-1",
        action: SyncLogAction.UPLOAD,
        itemId: null,
        itemName: null,
        fileId: null,
        fileName: null,
        status: SyncLogStatus.FAILED,
        error: "Failed with [REDACTED]",
        duration: null,
        createdAt: new Date(),
      });

      await logSyncOperation({
        userId: "user-1",
        action: SyncLogAction.UPLOAD,
        status: SyncLogStatus.FAILED,
        error: "Failed with Bearer secret-token-123",
      });

      expect(prisma.syncLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          error: "Failed with [REDACTED]",
        }),
      });
    });

    it("returns null on failure without throwing", async () => {
      vi.mocked(prisma.syncLog.create).mockRejectedValue(new Error("DB error"));

      const result = await logSyncOperation({
        userId: "user-1",
        action: SyncLogAction.CREATE,
        status: SyncLogStatus.SUCCESS,
      });

      expect(result).toBeNull();
    });
  });

  describe("logSyncOperationsBatch", () => {
    it("creates multiple logs in a transaction", async () => {
      vi.mocked(prisma.$transaction).mockResolvedValue([
        { id: "log-1" },
        { id: "log-2" },
      ] as never);

      const result = await logSyncOperationsBatch([
        {
          userId: "user-1",
          action: SyncLogAction.CREATE,
          status: SyncLogStatus.SUCCESS,
        },
        {
          userId: "user-1",
          action: SyncLogAction.UPLOAD,
          status: SyncLogStatus.SUCCESS,
        },
      ]);

      expect(result).toEqual(["log-1", "log-2"]);
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it("returns empty array for empty input", async () => {
      const result = await logSyncOperationsBatch([]);
      expect(result).toEqual([]);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe("getSyncHistory", () => {
    it("returns recent sync logs for user", async () => {
      const mockLogs = [
        {
          id: "log-1",
          action: SyncLogAction.CREATE,
          status: SyncLogStatus.SUCCESS,
        },
        {
          id: "log-2",
          action: SyncLogAction.RENAME,
          status: SyncLogStatus.SUCCESS,
        },
      ];
      vi.mocked(prisma.syncLog.findMany).mockResolvedValue(mockLogs as never);

      const result = await getSyncHistory("user-1", 20);

      expect(prisma.syncLog.findMany).toHaveBeenCalledWith({
        where: { userId: "user-1" },
        orderBy: { createdAt: "desc" },
        take: 20,
      });
      expect(result).toEqual(mockLogs);
    });

    it("filters by status when provided", async () => {
      vi.mocked(prisma.syncLog.findMany).mockResolvedValue([]);

      await getSyncHistory("user-1", 20, SyncLogStatus.FAILED);

      expect(prisma.syncLog.findMany).toHaveBeenCalledWith({
        where: { userId: "user-1", status: SyncLogStatus.FAILED },
        orderBy: { createdAt: "desc" },
        take: 20,
      });
    });
  });

  describe("cleanupOldSyncLogs", () => {
    it("deletes logs older than specified days", async () => {
      vi.mocked(prisma.syncLog.deleteMany).mockResolvedValue({ count: 50 });

      const result = await cleanupOldSyncLogs(30);

      expect(result).toBe(50);
      expect(prisma.syncLog.deleteMany).toHaveBeenCalledWith({
        where: {
          createdAt: { lt: expect.any(Date) },
        },
      });
    });
  });

  describe("getSyncHistoryAction", () => {
    it("returns null if not authenticated", async () => {
      vi.mocked(auth).mockResolvedValue(null as never);

      const result = await getSyncHistoryAction();

      expect(result).toBeNull();
    });

    it("returns sync logs for authenticated user", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-1" },
        expires: new Date().toISOString(),
      } as never);

      const mockLogs = [
        {
          id: "log-1",
          userId: "user-1",
          action: SyncLogAction.CREATE,
          status: SyncLogStatus.SUCCESS,
          itemId: null,
          itemName: "Test Item",
          fileId: null,
          fileName: null,
          error: null,
          duration: 150,
          createdAt: new Date(),
        },
      ];
      vi.mocked(prisma.syncLog.findMany).mockResolvedValue(mockLogs);

      const result = await getSyncHistoryAction(10);

      expect(result).toHaveLength(1);
      expect(result?.[0]).toMatchObject({
        id: "log-1",
        action: SyncLogAction.CREATE,
        status: SyncLogStatus.SUCCESS,
        itemName: "Test Item",
      });
    });

    it("supports filtering by status", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-1" },
        expires: new Date().toISOString(),
      } as never);
      vi.mocked(prisma.syncLog.findMany).mockResolvedValue([]);

      await getSyncHistoryAction(20, SyncLogStatus.FAILED);

      expect(prisma.syncLog.findMany).toHaveBeenCalledWith({
        where: { userId: "user-1", status: SyncLogStatus.FAILED },
        orderBy: { createdAt: "desc" },
        take: 20,
      });
    });
  });
});
