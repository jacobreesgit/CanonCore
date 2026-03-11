/**
 * Unit tests for audit context AsyncLocalStorage utilities.
 */

import { describe, it, expect } from "vitest";
import { withAuditContext, getAuditContext } from "@/lib/audit-context";

describe("audit-context", () => {
  describe("getAuditContext", () => {
    it("returns undefined when called outside withAuditContext", () => {
      const ctx = getAuditContext();
      expect(ctx).toBeUndefined();
    });
  });

  describe("withAuditContext", () => {
    it("provides context within the callback", async () => {
      let capturedContext: ReturnType<typeof getAuditContext>;

      await withAuditContext(
        { userId: "user-123", source: "api" },
        async () => {
          capturedContext = getAuditContext();
        }
      );

      expect(capturedContext!).toEqual({ userId: "user-123", source: "api" });
    });

    it("returns the callback result", async () => {
      const result = await withAuditContext({ source: "test" }, async () => {
        return "test-result";
      });

      expect(result).toBe("test-result");
    });

    it("isolates context between concurrent operations", async () => {
      const contexts: Array<ReturnType<typeof getAuditContext>> = [];

      await Promise.all([
        withAuditContext({ userId: "user-1", source: "api" }, async () => {
          // Small delay to ensure concurrency
          await new Promise((r) => setTimeout(r, 10));
          contexts.push(getAuditContext());
        }),
        withAuditContext({ userId: "user-2", source: "sync" }, async () => {
          await new Promise((r) => setTimeout(r, 5));
          contexts.push(getAuditContext());
        }),
      ]);

      // Each context should have captured its own values
      expect(contexts).toHaveLength(2);
      expect(contexts.find((c) => c?.userId === "user-1")?.source).toBe("api");
      expect(contexts.find((c) => c?.userId === "user-2")?.source).toBe("sync");
    });

    it("allows partial context (userId only)", async () => {
      let capturedContext: ReturnType<typeof getAuditContext>;

      await withAuditContext({ userId: "user-only" }, async () => {
        capturedContext = getAuditContext();
      });

      expect(capturedContext!.userId).toBe("user-only");
      expect(capturedContext!.source).toBeUndefined();
    });

    it("allows partial context (source only)", async () => {
      let capturedContext: ReturnType<typeof getAuditContext>;

      await withAuditContext({ source: "seed" }, async () => {
        capturedContext = getAuditContext();
      });

      expect(capturedContext!.source).toBe("seed");
      expect(capturedContext!.userId).toBeUndefined();
    });

    it("propagates errors from callback", async () => {
      await expect(
        withAuditContext({ source: "test" }, async () => {
          throw new Error("Test error");
        })
      ).rejects.toThrow("Test error");
    });
  });
});
