/**
 * Unit tests for queue-aware actions utility.
 * Tests network error detection and queue fallback.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import "fake-indexeddb/auto";
import {
  isNetworkError,
  withQueueFallback,
  isOffline,
  queueIfOffline,
} from "@/lib/queue-aware-actions";
import { clearQueue, getQueuedOperations } from "@/lib/sync-queue";

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("queue-aware-actions", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Clear IndexedDB
    const dbs = await indexedDB.databases();
    for (const db of dbs) {
      if (db.name) indexedDB.deleteDatabase(db.name);
    }
    await clearQueue();
    // Default to online
    Object.defineProperty(navigator, "onLine", {
      value: true,
      configurable: true,
      writable: true,
    });
  });

  afterEach(async () => {
    await clearQueue();
  });

  describe("isNetworkError", () => {
    it("detects TypeError with fetch message", () => {
      const error = new TypeError("Failed to fetch");
      expect(isNetworkError(error)).toBe(true);
    });

    it("detects network keyword in error message", () => {
      const error = new Error("Network request failed");
      expect(isNetworkError(error)).toBe(true);
    });

    it("detects offline keyword in error message", () => {
      const error = new Error("Client is offline");
      expect(isNetworkError(error)).toBe(true);
    });

    it("detects connection keyword in error message", () => {
      const error = new Error("Connection refused");
      expect(isNetworkError(error)).toBe(true);
    });

    it("detects timeout keyword in error message", () => {
      const error = new Error("Request timeout");
      expect(isNetworkError(error)).toBe(true);
    });

    it("returns false for non-network errors", () => {
      const error = new Error("Invalid input");
      expect(isNetworkError(error)).toBe(false);
    });

    it("returns false for non-Error objects", () => {
      expect(isNetworkError("string error")).toBe(false);
      expect(isNetworkError(null)).toBe(false);
      expect(isNetworkError(undefined)).toBe(false);
    });
  });

  describe("withQueueFallback", () => {
    it("returns success when action succeeds", async () => {
      const action = vi.fn().mockResolvedValue({ id: "123" });

      const result = await withQueueFallback(action, {
        type: "create",
        payload: { name: "Test" },
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ id: "123" });
      expect(result.queued).toBeUndefined();
    });

    it("queues operation when offline and network error occurs", async () => {
      Object.defineProperty(navigator, "onLine", {
        value: false,
        configurable: true,
      });

      const action = vi
        .fn()
        .mockRejectedValue(new TypeError("Failed to fetch"));

      const result = await withQueueFallback(action, {
        type: "create",
        payload: { name: "Test Folder" },
      });

      expect(result.success).toBe(false);
      expect(result.queued).toBe(true);
      expect(result.error).toBe("Saved for sync when online");

      const queued = await getQueuedOperations();
      expect(queued).toHaveLength(1);
      expect(queued[0].type).toBe("create");
      expect(queued[0].payload).toEqual({ name: "Test Folder" });
    });

    it("returns error when online and action fails", async () => {
      Object.defineProperty(navigator, "onLine", {
        value: true,
        configurable: true,
      });

      const action = vi.fn().mockRejectedValue(new Error("Server error"));

      const result = await withQueueFallback(action, {
        type: "create",
        payload: { name: "Test" },
      });

      expect(result.success).toBe(false);
      expect(result.queued).toBeUndefined();
      expect(result.error).toBe("Server error");
    });

    it("does not queue non-network errors even when offline", async () => {
      Object.defineProperty(navigator, "onLine", {
        value: false,
        configurable: true,
      });

      const action = vi.fn().mockRejectedValue(new Error("Invalid input"));

      const result = await withQueueFallback(action, {
        type: "create",
        payload: { name: "Test" },
      });

      expect(result.success).toBe(false);
      expect(result.queued).toBeUndefined();
      expect(result.error).toBe("Invalid input");

      const queued = await getQueuedOperations();
      expect(queued).toHaveLength(0);
    });
  });

  describe("isOffline", () => {
    it("returns true when navigator.onLine is false", () => {
      Object.defineProperty(navigator, "onLine", {
        value: false,
        configurable: true,
      });
      expect(isOffline()).toBe(true);
    });

    it("returns false when navigator.onLine is true", () => {
      Object.defineProperty(navigator, "onLine", {
        value: true,
        configurable: true,
      });
      expect(isOffline()).toBe(false);
    });
  });

  describe("queueIfOffline", () => {
    it("queues operation when offline", async () => {
      Object.defineProperty(navigator, "onLine", {
        value: false,
        configurable: true,
      });

      const result = await queueIfOffline({
        type: "rename",
        payload: { itemId: "item-1", name: "New Name" },
      });

      expect(result.queued).toBe(true);

      const queued = await getQueuedOperations();
      expect(queued).toHaveLength(1);
      expect(queued[0].type).toBe("rename");
    });

    it("does not queue when online", async () => {
      Object.defineProperty(navigator, "onLine", {
        value: true,
        configurable: true,
      });

      const result = await queueIfOffline({
        type: "delete",
        payload: { itemId: "item-1" },
      });

      expect(result.queued).toBe(false);

      const queued = await getQueuedOperations();
      expect(queued).toHaveLength(0);
    });
  });
});
