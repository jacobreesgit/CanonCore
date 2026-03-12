/**
 * Unit tests for audit logger helper functions.
 * Tests sanitization, ID extraction, and result summarization.
 */

import { describe, it, expect } from "vitest";
import {
  sanitizeArgs,
  extractRecordId,
  summarizeResult,
  truncateJson,
} from "@/lib/audit-logger";

describe("audit-logger helpers", () => {
  describe("sanitizeArgs", () => {
    it("returns null for null input", () => {
      expect(sanitizeArgs(null)).toBeNull();
    });

    it("returns null for undefined input", () => {
      expect(sanitizeArgs(undefined)).toBeNull();
    });

    it("passes through primitives unchanged", () => {
      expect(sanitizeArgs("test")).toBe("test");
      expect(sanitizeArgs(123)).toBe(123);
      expect(sanitizeArgs(true)).toBe(true);
      expect(sanitizeArgs(false)).toBe(false);
    });

    it("redacts password field", () => {
      const args = {
        data: { email: "test@example.com", password: "secret123" },
      };
      const result = sanitizeArgs(args);
      expect(result).toEqual({
        data: { email: "test@example.com", password: "[REDACTED]" },
      });
    });

    it("redacts hashedPassword field", () => {
      const args = {
        data: { email: "test@example.com", hashedPassword: "$2b$..." },
      };
      const result = sanitizeArgs(args);
      expect(result).toEqual({
        data: { email: "test@example.com", hashedPassword: "[REDACTED]" },
      });
    });

    it("redacts token fields", () => {
      const args = {
        data: {
          token: "abc123",
          accessToken: "xyz",
          refreshToken: "refresh",
        },
      };
      const result = sanitizeArgs(args);
      expect(result).toEqual({
        data: {
          token: "[REDACTED]",
          accessToken: "[REDACTED]",
          refreshToken: "[REDACTED]",
        },
      });
    });

    it("redacts nested sensitive fields", () => {
      const args = {
        data: {
          user: {
            profile: {
              secret: "should-redact",
              name: "keep-this",
            },
          },
        },
      };
      const result = sanitizeArgs(args);
      expect(result).toEqual({
        data: {
          user: {
            profile: {
              secret: "[REDACTED]",
              name: "keep-this",
            },
          },
        },
      });
    });

    it("handles arrays", () => {
      const args = { data: [{ password: "a" }, { password: "b" }] };
      const result = sanitizeArgs(args);
      expect(result).toEqual({
        data: [{ password: "[REDACTED]" }, { password: "[REDACTED]" }],
      });
    });

    it("redacts case-insensitively", () => {
      const args = {
        data: {
          PASSWORD: "upper",
          Password: "mixed",
          ApiKey: "key123",
        },
      };
      const result = sanitizeArgs(args);
      expect(result).toEqual({
        data: {
          PASSWORD: "[REDACTED]",
          Password: "[REDACTED]",
          ApiKey: "[REDACTED]",
        },
      });
    });

    it("handles encrypted token fields", () => {
      const args = {
        data: {
          encryptedToken: "encrypted-data",
          encryptedRefreshToken: "more-encrypted",
        },
      };
      const result = sanitizeArgs(args);
      expect(result).toEqual({
        data: {
          encryptedToken: "[REDACTED]",
          encryptedRefreshToken: "[REDACTED]",
        },
      });
    });

    it("preserves non-sensitive fields", () => {
      const args = {
        where: { id: "item-123" },
        data: { name: "Test Item", description: "A description" },
      };
      const result = sanitizeArgs(args);
      expect(result).toEqual(args);
    });

    it("redacts additional security-sensitive fields", () => {
      const args = {
        data: {
          credentials: "user:pass",
          authorization: "Bearer abc123",
          cookie: "sessionid=xyz",
          session: "session-data",
          bearer: "token123",
          privateKey: "-----BEGIN PRIVATE KEY-----",
          privKey: "private-key-data",
          secretKey: "secret-key-value",
        },
      };
      const result = sanitizeArgs(args);
      expect(result).toEqual({
        data: {
          credentials: "[REDACTED]",
          authorization: "[REDACTED]",
          cookie: "[REDACTED]",
          session: "[REDACTED]",
          bearer: "[REDACTED]",
          privateKey: "[REDACTED]",
          privKey: "[REDACTED]",
          secretKey: "[REDACTED]",
        },
      });
    });
  });

  describe("extractRecordId", () => {
    it("extracts ID from create result", () => {
      const result = extractRecordId(
        "create",
        { data: { name: "Test" } },
        { id: "abc123", name: "Test" }
      );
      expect(result).toBe("abc123");
    });

    it("extracts ID from update where clause", () => {
      const result = extractRecordId(
        "update",
        { where: { id: "xyz789" }, data: { name: "Updated" } },
        { id: "xyz789", name: "Updated" }
      );
      expect(result).toBe("xyz789");
    });

    it("extracts ID from delete where clause", () => {
      const result = extractRecordId(
        "delete",
        { where: { id: "del-123" } },
        { id: "del-123" }
      );
      expect(result).toBe("del-123");
    });

    it("extracts ID from upsert where clause", () => {
      const result = extractRecordId(
        "upsert",
        { where: { id: "ups-456" }, create: {}, update: {} },
        { id: "ups-456" }
      );
      expect(result).toBe("ups-456");
    });

    it("returns null for deleteMany", () => {
      const result = extractRecordId(
        "deleteMany",
        { where: { userId: "user-1" } },
        { count: 5 }
      );
      expect(result).toBeNull();
    });

    it("returns null for updateMany", () => {
      const result = extractRecordId(
        "updateMany",
        { where: { isActive: false }, data: { isActive: true } },
        { count: 10 }
      );
      expect(result).toBeNull();
    });

    it("returns null for createMany", () => {
      const result = extractRecordId(
        "createMany",
        { data: [{ name: "A" }, { name: "B" }] },
        { count: 2 }
      );
      expect(result).toBeNull();
    });

    it("returns null when result has no id", () => {
      const result = extractRecordId("create", { data: { name: "Test" } }, {});
      expect(result).toBeNull();
    });

    it("returns null when where clause has no id", () => {
      const result = extractRecordId(
        "delete",
        { where: { email: "test@example.com" } },
        {}
      );
      expect(result).toBeNull();
    });

    it("handles null result gracefully", () => {
      const result = extractRecordId("create", { data: {} }, null);
      expect(result).toBeNull();
    });
  });

  describe("summarizeResult", () => {
    it("returns count for deleteMany", () => {
      const result = summarizeResult("deleteMany", { count: 5 });
      expect(result).toEqual({ count: 5 });
    });

    it("returns count for updateMany", () => {
      const result = summarizeResult("updateMany", { count: 10 });
      expect(result).toEqual({ count: 10 });
    });

    it("returns count for createMany", () => {
      const result = summarizeResult("createMany", { count: 3 });
      expect(result).toEqual({ count: 3 });
    });

    it("returns id for single create", () => {
      const result = summarizeResult("create", { id: "new-123", name: "Test" });
      expect(result).toEqual({ id: "new-123" });
    });

    it("returns id for update", () => {
      const result = summarizeResult("update", {
        id: "upd-456",
        name: "Updated",
      });
      expect(result).toEqual({ id: "upd-456" });
    });

    it("returns id for delete", () => {
      const result = summarizeResult("delete", { id: "del-789" });
      expect(result).toEqual({ id: "del-789" });
    });

    it("returns id for upsert", () => {
      const result = summarizeResult("upsert", { id: "ups-012" });
      expect(result).toEqual({ id: "ups-012" });
    });

    it("returns null for null result", () => {
      const result = summarizeResult("create", null);
      expect(result).toBeNull();
    });

    it("returns null for undefined result", () => {
      const result = summarizeResult("create", undefined);
      expect(result).toBeNull();
    });

    it("returns null when no id in result", () => {
      const result = summarizeResult("create", { name: "No ID" });
      expect(result).toBeNull();
    });
  });

  describe("truncateJson", () => {
    it("returns null for null input", () => {
      expect(truncateJson(null)).toBeNull();
    });

    it("passes through small objects unchanged", () => {
      const small = { id: "123", name: "Test", count: 42 };
      expect(truncateJson(small)).toEqual(small);
    });

    it("passes through strings under limit", () => {
      const str = "Hello, World!";
      expect(truncateJson(str)).toBe(str);
    });

    it("passes through numbers unchanged", () => {
      expect(truncateJson(42)).toBe(42);
      expect(truncateJson(3.14)).toBe(3.14);
    });

    it("passes through booleans unchanged", () => {
      expect(truncateJson(true)).toBe(true);
      expect(truncateJson(false)).toBe(false);
    });

    it("truncates objects exceeding size limit", () => {
      // Create an object that exceeds 10KB when serialized
      const largeData: Record<string, string> = {};
      for (let i = 0; i < 500; i++) {
        largeData[`key${i}`] = "x".repeat(100);
      }

      const result = truncateJson(largeData) as Record<string, unknown>;

      expect(result._truncated).toBe(true);
      expect(typeof result._originalSize).toBe("number");
      expect(result._originalSize).toBeGreaterThan(10000);
      expect(Array.isArray(result._preview)).toBe(true);
      expect((result._preview as string[]).length).toBeLessThanOrEqual(5);
    });

    it("truncates large arrays", () => {
      // Create an array that exceeds 10KB when serialized
      const largeArray = Array(1000).fill({ value: "x".repeat(20) });

      const result = truncateJson(largeArray) as Record<string, unknown>;

      expect(result._truncated).toBe(true);
      expect(result._originalSize).toBeGreaterThan(10000);
    });

    it("handles objects just under the limit", () => {
      // Create an object just under 10KB
      const nearLimit = { data: "x".repeat(9000) };
      const result = truncateJson(nearLimit);

      // Should pass through unchanged since under limit
      expect(result).toEqual(nearLimit);
    });

    it("handles deeply nested objects", () => {
      const nested = {
        level1: {
          level2: {
            level3: {
              value: "test",
            },
          },
        },
      };
      expect(truncateJson(nested)).toEqual(nested);
    });
  });
});
