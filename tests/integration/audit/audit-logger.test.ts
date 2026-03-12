/**
 * Integration tests for audit logging.
 * Tests with real database to verify audit logs are created correctly.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Prisma, AuditLog } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withAuditContext } from "@/lib/audit-context";
import "../setup";

// Use unique ID per test run to avoid conflicts
const TEST_USER_ID = `test-audit-${Date.now()}-${Math.random().toString(36).substring(7)}`;
const TEST_USER_EMAIL = `audit-${Date.now()}@test.example.com`;

/**
 * Polls for an audit log entry instead of using fixed delays.
 * More reliable than hardcoded timeouts for fire-and-forget operations.
 *
 * @param where - Prisma where clause for finding the log
 * @param options - Polling options (timeout and interval in ms)
 * @returns The audit log if found, null if timeout exceeded
 */
async function waitForAuditLog(
  where: Prisma.AuditLogWhereInput,
  options?: { timeout?: number; interval?: number }
): Promise<AuditLog | null> {
  const { timeout = 2000, interval = 50 } = options ?? {};
  const start = Date.now();

  while (Date.now() - start < timeout) {
    const log = await prisma.auditLog.findFirst({
      where,
      orderBy: { timestamp: "desc" },
    });
    if (log) return log;
    await new Promise((r) => setTimeout(r, interval));
  }

  return null;
}

/**
 * Polls for multiple audit log entries.
 *
 * @param where - Prisma where clause for finding logs
 * @param count - Number of logs to wait for
 * @param options - Polling options (timeout and interval in ms)
 * @returns Array of audit logs (may be fewer than count if timeout exceeded)
 */
async function waitForAuditLogs(
  where: Prisma.AuditLogWhereInput,
  count: number,
  options?: { timeout?: number; interval?: number }
): Promise<AuditLog[]> {
  const { timeout = 2000, interval = 50 } = options ?? {};
  const start = Date.now();

  while (Date.now() - start < timeout) {
    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { timestamp: "desc" },
      take: count,
    });
    if (logs.length >= count) return logs;
    await new Promise((r) => setTimeout(r, interval));
  }

  // Return whatever we found even if less than requested
  return prisma.auditLog.findMany({
    where,
    orderBy: { timestamp: "desc" },
    take: count,
  });
}

describe("audit logger integration", () => {
  beforeAll(async () => {
    // Create test user
    await prisma.user.create({
      data: {
        id: TEST_USER_ID,
        email: TEST_USER_EMAIL,
        passwordHash: "hashed",
      },
    });
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.auditLog.deleteMany({
      where: { source: "integration-test" },
    });
    await prisma.item.deleteMany({
      where: { userId: TEST_USER_ID },
    });
    await prisma.user.deleteMany({
      where: { id: TEST_USER_ID },
    });
  });

  beforeEach(async () => {
    // Clean up audit logs before each test
    await prisma.auditLog.deleteMany({
      where: { source: "integration-test" },
    });
  });

  describe("create operations", () => {
    it("logs item creation with context", async () => {
      const itemName = `Test Item ${Date.now()}`;

      await withAuditContext(
        { userId: TEST_USER_ID, source: "integration-test" },
        async () => {
          await prisma.item.create({
            data: {
              name: itemName,
              userId: TEST_USER_ID,
            },
          });
        }
      );

      // Poll for audit log (replaces fixed timeout)
      const auditLog = await waitForAuditLog({
        model: "Item",
        action: "create",
        source: "integration-test",
      });

      expect(auditLog).toBeDefined();
      expect(auditLog?.userId).toBe(TEST_USER_ID);
      expect(auditLog?.model).toBe("Item");
      expect(auditLog?.action).toBe("create");
      expect(auditLog?.recordId).toBeDefined();
      expect(auditLog?.result).toHaveProperty("id");
    });
  });

  describe("delete operations", () => {
    it("logs item deletion with record ID", async () => {
      // Create an item first
      const item = await prisma.item.create({
        data: {
          name: `Delete Test ${Date.now()}`,
          userId: TEST_USER_ID,
        },
      });

      // Clear previous audit logs
      await prisma.auditLog.deleteMany({
        where: { source: "integration-test" },
      });

      await withAuditContext(
        { userId: TEST_USER_ID, source: "integration-test" },
        async () => {
          await prisma.item.delete({
            where: { id: item.id },
          });
        }
      );

      const auditLog = await waitForAuditLog({
        model: "Item",
        action: "delete",
        source: "integration-test",
      });

      expect(auditLog).toBeDefined();
      expect(auditLog?.recordId).toBe(item.id);
      expect(auditLog?.userId).toBe(TEST_USER_ID);
    });
  });

  describe("bulk operations", () => {
    it("logs deleteMany with count", async () => {
      // Create multiple items
      await prisma.item.createMany({
        data: [
          { name: "Bulk 1", userId: TEST_USER_ID },
          { name: "Bulk 2", userId: TEST_USER_ID },
          { name: "Bulk 3", userId: TEST_USER_ID },
        ],
      });

      // Clear previous audit logs
      await prisma.auditLog.deleteMany({
        where: { source: "integration-test" },
      });

      await withAuditContext({ source: "integration-test" }, async () => {
        await prisma.item.deleteMany({
          where: {
            userId: TEST_USER_ID,
            name: { startsWith: "Bulk" },
          },
        });
      });

      const auditLog = await waitForAuditLog({
        model: "Item",
        action: "deleteMany",
        source: "integration-test",
      });

      expect(auditLog).toBeDefined();
      expect(auditLog?.recordId).toBeNull(); // Bulk ops don't have single ID
      expect(auditLog?.result).toHaveProperty("count", 3);
    });
  });

  describe("sensitive data sanitization", () => {
    it("redacts password fields in audit logs", async () => {
      const testEmail = `sanitize-${Date.now()}@test.example.com`;

      await withAuditContext({ source: "integration-test" }, async () => {
        await prisma.user.create({
          data: {
            email: testEmail,
            passwordHash: "should-be-redacted",
          },
        });
      });

      const auditLog = await waitForAuditLog({
        model: "User",
        action: "create",
        source: "integration-test",
      });

      expect(auditLog).toBeDefined();

      // Check that passwordHash is redacted in args
      const args = auditLog?.args as Record<string, unknown>;
      const data = args?.data as Record<string, unknown>;
      expect(data?.passwordHash).toBe("[REDACTED]");
      expect(data?.email).toBe(testEmail); // Email should NOT be redacted

      // Clean up
      await prisma.user.deleteMany({
        where: { email: testEmail },
      });
    });
  });

  describe("context isolation", () => {
    it("handles concurrent operations with separate contexts", async () => {
      await Promise.all([
        withAuditContext(
          { userId: "user-a", source: "integration-test" },
          async () => {
            await prisma.item.create({
              data: {
                name: `Concurrent A ${Date.now()}`,
                userId: TEST_USER_ID,
              },
            });
          }
        ),
        withAuditContext(
          { userId: "user-b", source: "integration-test" },
          async () => {
            await prisma.item.create({
              data: {
                name: `Concurrent B ${Date.now()}`,
                userId: TEST_USER_ID,
              },
            });
          }
        ),
      ]);

      const logs = await waitForAuditLogs(
        {
          model: "Item",
          action: "create",
          source: "integration-test",
        },
        2
      );

      // Each log should have the correct userId from its context
      const userIds = logs.map((l) => l.userId);
      expect(userIds).toContain("user-a");
      expect(userIds).toContain("user-b");
    });
  });

  describe("operations without context", () => {
    it("logs operations with null userId when no context", async () => {
      // Create item without audit context
      await prisma.item.create({
        data: {
          name: `No Context ${Date.now()}`,
          userId: TEST_USER_ID,
        },
      });

      const auditLog = await waitForAuditLog({
        model: "Item",
        action: "create",
        userId: null, // Specifically look for log without context
      });

      expect(auditLog).toBeDefined();
      expect(auditLog?.userId).toBeNull();
      expect(auditLog?.source).toBeNull();
    });
  });

  describe("update operations", () => {
    it("logs item updates", async () => {
      const item = await prisma.item.create({
        data: {
          name: "Update Test",
          userId: TEST_USER_ID,
        },
      });

      await prisma.auditLog.deleteMany({
        where: { source: "integration-test" },
      });

      await withAuditContext(
        { userId: TEST_USER_ID, source: "integration-test" },
        async () => {
          await prisma.item.update({
            where: { id: item.id },
            data: { name: "Updated Name" },
          });
        }
      );

      const auditLog = await waitForAuditLog({
        model: "Item",
        action: "update",
        source: "integration-test",
      });

      expect(auditLog).toBeDefined();
      expect(auditLog?.recordId).toBe(item.id);
      expect(auditLog?.action).toBe("update");
    });
  });

  describe("environment tracking", () => {
    it("includes environment in audit log", async () => {
      await withAuditContext({ source: "integration-test" }, async () => {
        await prisma.item.create({
          data: {
            name: `Env Test ${Date.now()}`,
            userId: TEST_USER_ID,
          },
        });
      });

      const auditLog = await waitForAuditLog({
        model: "Item",
        action: "create",
        source: "integration-test",
      });

      expect(auditLog).toBeDefined();
      expect(auditLog?.environment).toBe("test"); // NODE_ENV=test in vitest
      expect(auditLog?.database).toBeDefined();
      expect(auditLog?.database).not.toBe("unknown");
    });
  });
});
