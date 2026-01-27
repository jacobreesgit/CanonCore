/**
 * Unit tests for sync queue processor.
 * Tests exponential backoff, retry logic, and queue processing.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import "fake-indexeddb/auto";
import {
  processQueue,
  startQueueProcessor,
  stopQueueProcessor,
  calculateBackoff,
  MAX_RETRY_ATTEMPTS,
  BACKOFF_BASE_MS,
  MAX_BACKOFF_MS,
} from "@/lib/sync-queue-processor";
import {
  queueOperation,
  getQueuedOperations,
  clearQueue,
} from "@/lib/sync-queue";

vi.mock("@/lib/google-drive-actions", () => ({
  createFolderInGoogleDrive: vi.fn(),
  renameItemInGoogleDrive: vi.fn(),
  deleteItemFromGoogleDrive: vi.fn(),
  moveItemInGoogleDrive: vi.fn(),
}));

vi.mock("@/lib/google-drive-upload", () => ({
  uploadFileToDrive: vi.fn(),
}));

vi.mock("@/lib/sync-log", () => ({
  logSyncOperation: vi.fn(),
  startSyncTimer: vi.fn(() => () => 100),
  SyncLogAction: {
    CREATE: "CREATE",
    RENAME: "RENAME",
    DELETE: "DELETE",
    MOVE: "MOVE",
    UPLOAD: "UPLOAD",
  },
  SyncLogStatus: {
    SUCCESS: "SUCCESS",
    FAILED: "FAILED",
    PENDING: "PENDING",
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  createUserLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

import {
  createFolderInGoogleDrive,
  renameItemInGoogleDrive,
} from "@/lib/google-drive-actions";

describe("sync-queue-processor", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    stopQueueProcessor();
    // Clear IndexedDB between tests
    const dbs = await indexedDB.databases();
    for (const db of dbs) {
      if (db.name) indexedDB.deleteDatabase(db.name);
    }
    await clearQueue();
    // Mock navigator.onLine
    Object.defineProperty(navigator, "onLine", {
      value: true,
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    stopQueueProcessor();
    vi.useRealTimers();
  });

  describe("calculateBackoff", () => {
    it("calculates exponential backoff for first attempt", () => {
      const backoff = calculateBackoff(0);
      // First attempt: base delay (1000ms) + up to 10% jitter
      expect(backoff).toBeGreaterThanOrEqual(BACKOFF_BASE_MS);
      expect(backoff).toBeLessThanOrEqual(BACKOFF_BASE_MS * 1.1);
    });

    it("doubles delay for each attempt", () => {
      // Second attempt: 2000ms base
      const backoff1 = calculateBackoff(1);
      expect(backoff1).toBeGreaterThanOrEqual(BACKOFF_BASE_MS * 2);
      expect(backoff1).toBeLessThanOrEqual(BACKOFF_BASE_MS * 2 * 1.1);

      // Third attempt: 4000ms base
      const backoff2 = calculateBackoff(2);
      expect(backoff2).toBeGreaterThanOrEqual(BACKOFF_BASE_MS * 4);
      expect(backoff2).toBeLessThanOrEqual(BACKOFF_BASE_MS * 4 * 1.1);
    });

    it("caps at maximum backoff", () => {
      const backoff = calculateBackoff(10);
      expect(backoff).toBeLessThanOrEqual(MAX_BACKOFF_MS);
    });
  });

  describe("processQueue", () => {
    it("processes pending operations successfully", async () => {
      vi.mocked(createFolderInGoogleDrive).mockResolvedValue({
        success: true,
        data: { itemId: "item-123", driveFileId: "drive-123" },
      });

      await queueOperation({
        type: "create",
        payload: { name: "Test Folder", parentId: null, userId: "user-1" },
        attempts: 0,
        lastAttempt: null,
        error: null,
      });

      await processQueue();

      const remaining = await getQueuedOperations();
      expect(remaining).toHaveLength(0);
      expect(createFolderInGoogleDrive).toHaveBeenCalled();
    });

    it("increments attempts on failure", async () => {
      vi.mocked(createFolderInGoogleDrive).mockRejectedValue(
        new Error("Network error")
      );

      await queueOperation({
        type: "create",
        payload: { name: "Test Folder", userId: "user-1" },
        attempts: 0,
        lastAttempt: null,
        error: null,
      });

      await processQueue();

      const ops = await getQueuedOperations();
      expect(ops).toHaveLength(1);
      expect(ops[0].attempts).toBe(1);
      expect(ops[0].error).toBe("Network error");
    });

    it("removes operations after max retries exceeded", async () => {
      vi.mocked(createFolderInGoogleDrive).mockRejectedValue(
        new Error("Persistent error")
      );

      await queueOperation({
        type: "create",
        payload: { name: "Test Folder", userId: "user-1" },
        attempts: MAX_RETRY_ATTEMPTS - 1,
        lastAttempt: new Date(Date.now() - 120000), // 2 minutes ago
        error: "Previous error",
      });

      await processQueue();

      const ops = await getQueuedOperations();
      expect(ops).toHaveLength(0);
    });

    it("respects backoff timing - skips recently failed operations", async () => {
      const recentAttempt = new Date();

      await queueOperation({
        type: "create",
        payload: { name: "Test Folder", userId: "user-1" },
        attempts: 2,
        lastAttempt: recentAttempt,
        error: "Previous error",
      });

      await processQueue();

      // Should not process yet due to backoff
      expect(createFolderInGoogleDrive).not.toHaveBeenCalled();
    });

    it("processes multiple operations sequentially", async () => {
      vi.mocked(createFolderInGoogleDrive).mockResolvedValue({
        success: true,
        data: { itemId: "item-1", driveFileId: "drive-1" },
      });
      vi.mocked(renameItemInGoogleDrive).mockResolvedValue({
        success: true,
      });

      await queueOperation({
        type: "create",
        payload: { name: "First", userId: "user-1" },
        attempts: 0,
        lastAttempt: null,
        error: null,
      });

      // Small delay for different timestamps
      await new Promise((r) => setTimeout(r, 10));

      await queueOperation({
        type: "rename",
        payload: { itemId: "item-1", name: "Second", userId: "user-1" },
        attempts: 0,
        lastAttempt: null,
        error: null,
      });

      await processQueue();

      expect(createFolderInGoogleDrive).toHaveBeenCalled();
      expect(renameItemInGoogleDrive).toHaveBeenCalled();
    });

    it("skips processing when offline", async () => {
      Object.defineProperty(navigator, "onLine", {
        value: false,
        configurable: true,
      });

      await queueOperation({
        type: "create",
        payload: { name: "Test", userId: "user-1" },
        attempts: 0,
        lastAttempt: null,
        error: null,
      });

      await processQueue();

      expect(createFolderInGoogleDrive).not.toHaveBeenCalled();
    });
  });

  describe("startQueueProcessor", () => {
    it("starts processing on online event", async () => {
      Object.defineProperty(navigator, "onLine", {
        value: false,
        configurable: true,
      });

      vi.mocked(createFolderInGoogleDrive).mockResolvedValue({
        success: true,
        data: { itemId: "item-1", driveFileId: "drive-1" },
      });

      await queueOperation({
        type: "create",
        payload: { name: "Test", userId: "user-1" },
        attempts: 0,
        lastAttempt: null,
        error: null,
      });

      startQueueProcessor();

      // Simulate coming online
      Object.defineProperty(navigator, "onLine", {
        value: true,
        configurable: true,
      });
      window.dispatchEvent(new Event("online"));

      // Wait for async processing
      await new Promise((r) => setTimeout(r, 100));

      expect(createFolderInGoogleDrive).toHaveBeenCalled();
    });

    it("processes on interval when online", async () => {
      // Don't use fake timers due to fake-indexeddb incompatibility
      // Instead, use real timers with a short test interval

      vi.mocked(createFolderInGoogleDrive).mockResolvedValue({
        success: true,
        data: { itemId: "item-1", driveFileId: "drive-1" },
      });

      // Mock getQueuedOperations to return an operation on first call, empty thereafter
      let callCount = 0;
      const mockGetQueuedOperations = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return [
            {
              id: "op-1",
              type: "create",
              payload: { name: "Test", userId: "user-1" },
              attempts: 0,
              lastAttempt: null,
              error: null,
              createdAt: new Date(),
            },
          ];
        }
        return [];
      });

      const originalModule = await import("@/lib/sync-queue");
      vi.spyOn(originalModule, "getQueuedOperations").mockImplementation(
        mockGetQueuedOperations
      );

      // Start the processor
      startQueueProcessor();

      // Wait for the processor to run (it runs every 30s, but we can wait less)
      // The processor should pick up the operation
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(createFolderInGoogleDrive).toHaveBeenCalled();
    });
  });
});
