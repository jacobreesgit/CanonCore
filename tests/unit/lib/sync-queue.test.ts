/**
 * Unit tests for sync queue (IndexedDB).
 * Uses fake-indexeddb for testing.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import "fake-indexeddb/auto";
import {
  queueOperation,
  getQueuedOperations,
  removeFromQueue,
  updateQueuedOperation,
  getPendingCount,
  clearQueue,
  isQueueAvailable,
} from "@/lib/sync-queue";

vi.mock("@/lib/logger", () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("sync-queue", () => {
  beforeEach(async () => {
    // Clear IndexedDB between tests
    const dbs = await indexedDB.databases();
    for (const db of dbs) {
      if (db.name) indexedDB.deleteDatabase(db.name);
    }
  });

  afterEach(async () => {
    await clearQueue();
  });

  describe("queueOperation", () => {
    it("adds operation with generated ID", async () => {
      const id = await queueOperation({
        type: "create",
        payload: { name: "Test Folder" },
        attempts: 0,
        lastAttempt: null,
        error: null,
      });

      expect(id).toBeTruthy();
      expect(typeof id).toBe("string");

      const operations = await getQueuedOperations();
      expect(operations).toHaveLength(1);
      expect(operations[0].type).toBe("create");
      expect(operations[0].payload).toEqual({ name: "Test Folder" });
    });

    it("enforces max queue size", async () => {
      // Queue 100 operations (the max)
      for (let i = 0; i < 100; i++) {
        await queueOperation({
          type: "create",
          payload: { name: `Folder ${i}` },
          attempts: 0,
          lastAttempt: null,
          error: null,
        });
      }

      // 101st should be rejected
      const id = await queueOperation({
        type: "create",
        payload: { name: "Over limit" },
        attempts: 0,
        lastAttempt: null,
        error: null,
      });

      expect(id).toBeNull();

      const count = await getPendingCount();
      expect(count).toBe(100);
    });
  });

  describe("getQueuedOperations", () => {
    it("returns operations sorted by createdAt", async () => {
      await queueOperation({
        type: "create",
        payload: { name: "First" },
        attempts: 0,
        lastAttempt: null,
        error: null,
      });

      // Small delay to ensure different timestamps
      await new Promise((r) => setTimeout(r, 10));

      await queueOperation({
        type: "rename",
        payload: { name: "Second" },
        attempts: 0,
        lastAttempt: null,
        error: null,
      });

      const operations = await getQueuedOperations();
      expect(operations).toHaveLength(2);
      expect(operations[0].payload.name).toBe("First");
      expect(operations[1].payload.name).toBe("Second");
    });
  });

  describe("removeFromQueue", () => {
    it("removes operation by ID", async () => {
      const id = await queueOperation({
        type: "delete",
        payload: { itemId: "123" },
        attempts: 0,
        lastAttempt: null,
        error: null,
      });

      expect(id).toBeTruthy();
      await removeFromQueue(id!);

      const operations = await getQueuedOperations();
      expect(operations).toHaveLength(0);
    });
  });

  describe("updateQueuedOperation", () => {
    it("updates attempts and error atomically", async () => {
      const id = await queueOperation({
        type: "upload",
        payload: { fileId: "abc" },
        attempts: 0,
        lastAttempt: null,
        error: null,
      });

      await updateQueuedOperation(id!, {
        attempts: 1,
        lastAttempt: new Date(),
        error: "Network error",
      });

      const operations = await getQueuedOperations();
      expect(operations[0].attempts).toBe(1);
      expect(operations[0].error).toBe("Network error");
      expect(operations[0].lastAttempt).toBeTruthy();
    });
  });

  describe("getPendingCount", () => {
    it("returns correct count", async () => {
      expect(await getPendingCount()).toBe(0);

      await queueOperation({
        type: "create",
        payload: {},
        attempts: 0,
        lastAttempt: null,
        error: null,
      });

      expect(await getPendingCount()).toBe(1);

      await queueOperation({
        type: "rename",
        payload: {},
        attempts: 0,
        lastAttempt: null,
        error: null,
      });

      expect(await getPendingCount()).toBe(2);
    });
  });

  describe("clearQueue", () => {
    it("removes all operations", async () => {
      await queueOperation({
        type: "create",
        payload: {},
        attempts: 0,
        lastAttempt: null,
        error: null,
      });
      await queueOperation({
        type: "delete",
        payload: {},
        attempts: 0,
        lastAttempt: null,
        error: null,
      });

      await clearQueue();

      const count = await getPendingCount();
      expect(count).toBe(0);
    });
  });

  describe("isQueueAvailable", () => {
    it("returns true when IndexedDB is available", async () => {
      const available = await isQueueAvailable();
      expect(available).toBe(true);
    });
  });
});
