/**
 * Database audit logger for tracking all mutations.
 * Captures create, update, and delete operations across all models.
 * Uses Prisma Client Extensions (not deprecated middleware).
 *
 * Features:
 * - Automatic logging of all mutation operations
 * - Sensitive data sanitization (passwords, tokens redacted)
 * - AsyncLocalStorage context for userId/source tracking
 * - Fire-and-forget logging (non-blocking)
 */

import { Prisma, PrismaClient } from "@prisma/client";
import { logger } from "./logger";
import { getAuditContext } from "./audit-context";

/** Actions we want to audit (skip reads) */
const AUDITED_ACTIONS = new Set([
  "create",
  "createMany",
  "update",
  "updateMany",
  "delete",
  "deleteMany",
  "upsert",
]);

/** Fields that should never be logged (security) */
const REDACT_FIELDS = new Set([
  "password",
  "hashedpassword",
  "passwordhash",
  "token",
  "accesstoken",
  "refreshtoken",
  "secret",
  "apikey",
  "encryptedtoken",
  "encryptedrefreshtoken",
  "encryptedaccesstoken",
  // Additional sensitive patterns
  "credentials",
  "authorization",
  "cookie",
  "session",
  "bearer",
  "privatekey",
  "privkey",
  "secretkey",
]);

/** Maximum JSON size in characters before truncation */
const MAX_JSON_SIZE = 10000;

/** Cache environment values at module level (never change at runtime) */
const ENV = process.env.NODE_ENV || "unknown";

/** Hashed database host identifier for safe logging */
const DB_HOST = (() => {
  try {
    const url = process.env.DATABASE_URL || "";
    const parsed = new URL(url);
    // Base64 encode and truncate for privacy
    return Buffer.from(parsed.host).toString("base64").slice(0, 16);
  } catch {
    return "unknown";
  }
})();

/**
 * Truncates a JSON value if it exceeds MAX_JSON_SIZE.
 * Returns a summary object for truncated payloads.
 *
 * @param value - The sanitized JSON value
 * @returns The original value or a truncation summary
 */
export function truncateJson(value: Prisma.JsonValue): Prisma.JsonValue {
  if (value === null) return null;

  try {
    const serialized = JSON.stringify(value);
    if (serialized.length <= MAX_JSON_SIZE) {
      return value;
    }
    return {
      _truncated: true,
      _originalSize: serialized.length,
      _preview:
        typeof value === "object" && value !== null
          ? Object.keys(value as Record<string, unknown>).slice(0, 5)
          : null,
    };
  } catch {
    return { _error: "Failed to serialize" };
  }
}

/**
 * Recursively redacts sensitive fields from an object.
 * Returns a sanitized copy safe for logging.
 *
 * @param obj - The object to sanitize
 * @returns A sanitized copy with sensitive fields redacted
 *
 * @example
 * sanitizeArgs({ password: "secret", email: "test@test.com" })
 * // Returns: { password: "[REDACTED]", email: "test@test.com" }
 */
export function sanitizeArgs(obj: unknown): Prisma.JsonValue {
  if (obj === null || obj === undefined) {
    return null;
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeArgs);
  }

  if (typeof obj === "object") {
    const result: Record<string, Prisma.JsonValue> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (REDACT_FIELDS.has(key.toLowerCase())) {
        result[key] = "[REDACTED]";
      } else {
        result[key] = sanitizeArgs(value);
      }
    }
    return result;
  }

  // Primitives are safe
  if (
    typeof obj === "string" ||
    typeof obj === "number" ||
    typeof obj === "boolean"
  ) {
    return obj;
  }

  return null;
}

/**
 * Extracts the record ID from operation params and result.
 * Handles different operation types appropriately.
 *
 * @param operation - The Prisma operation name
 * @param args - The operation arguments
 * @param result - The operation result
 * @returns The record ID if available, null otherwise
 */
export function extractRecordId(
  operation: string,
  args: Record<string, unknown>,
  result: unknown
): string | null {
  try {
    // For create operations, ID is in the result
    if (operation === "create" && result && typeof result === "object") {
      const rec = result as Record<string, unknown>;
      if (typeof rec.id === "string") return rec.id;
    }

    // For update/delete/upsert, ID is in the where clause
    if (["update", "delete", "upsert"].includes(operation)) {
      const where = args.where as Record<string, unknown> | undefined;
      if (where && typeof where.id === "string") return where.id;
    }

    // Bulk operations don't have a single ID
    return null;
  } catch {
    return null;
  }
}

/**
 * Summarizes the operation result for logging.
 * Includes counts for bulk operations, IDs for single operations.
 *
 * @param operation - The Prisma operation name
 * @param result - The operation result
 * @returns A summary object or null
 */
export function summarizeResult(
  operation: string,
  result: unknown
): Prisma.JsonValue {
  try {
    if (result === null || result === undefined) {
      return null;
    }

    // Bulk operations return { count: number }
    if (
      ["createMany", "updateMany", "deleteMany"].includes(operation) &&
      typeof result === "object"
    ) {
      const rec = result as Record<string, unknown>;
      if (typeof rec.count === "number") {
        return { count: rec.count };
      }
    }

    // Single operations - return just the ID
    if (typeof result === "object") {
      const rec = result as Record<string, unknown>;
      if (typeof rec.id === "string") {
        return { id: rec.id };
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Creates a Prisma Client Extension that logs all mutations to the AuditLog table.
 * This is the recommended pattern over deprecated $use() middleware.
 *
 * @param basePrisma - The base PrismaClient instance (for writing audit logs)
 * @returns A Prisma extension configuration object
 */
export function createAuditExtension(basePrisma: PrismaClient) {
  return Prisma.defineExtension({
    name: "audit-logger",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          // Skip non-mutation actions
          if (!AUDITED_ACTIONS.has(operation)) {
            return query(args);
          }

          // Skip AuditLog itself to prevent infinite recursion
          if (model === "AuditLog") {
            return query(args);
          }

          const start = Date.now();
          let result: unknown;
          let error: Error | null = null;

          try {
            result = await query(args);
          } catch (err) {
            error = err as Error;
            throw err; // Re-throw after capturing
          } finally {
            const durationMs = Date.now() - start;
            const ctx = getAuditContext();

            // Write audit log (fire-and-forget with error handling)
            // Use the base client to avoid extension recursion
            const sanitizedArgs = sanitizeArgs(args);
            basePrisma.auditLog
              .create({
                data: {
                  environment: ENV,
                  database: DB_HOST,
                  model: model,
                  action: operation,
                  recordId: extractRecordId(
                    operation,
                    args as Record<string, unknown>,
                    result
                  ),
                  userId: ctx?.userId ?? null,
                  source: ctx?.source ?? null,
                  requestId: ctx?.requestId ?? null,
                  args: truncateJson(sanitizedArgs) ?? undefined,
                  result: error
                    ? { error: error.message }
                    : (summarizeResult(operation, result) ?? undefined),
                  durationMs,
                },
              })
              .catch((err) => {
                // Log with full context for debugging
                logger.error(
                  {
                    err,
                    model,
                    action: operation,
                    recordId: extractRecordId(
                      operation,
                      args as Record<string, unknown>,
                      result
                    ),
                  },
                  "Failed to write audit log"
                );
              });
          }

          return result;
        },
      },
    },
  });
}

/**
 * Retrieves recent audit logs with optional filtering.
 *
 * @param prisma - The Prisma client instance
 * @param options - Filter options
 * @returns Array of audit log entries
 *
 * @example
 * // Get last 50 delete operations
 * const logs = await getRecentAuditLogs(prisma, { action: "delete", limit: 50 });
 */
export async function getRecentAuditLogs(
  prisma: PrismaClient,
  options?: {
    model?: string;
    action?: string;
    userId?: string;
    source?: string;
    limit?: number;
  }
) {
  return prisma.auditLog.findMany({
    where: {
      model: options?.model,
      action: options?.action ? { contains: options.action } : undefined,
      userId: options?.userId,
      source: options?.source,
    },
    orderBy: { timestamp: "desc" },
    take: options?.limit || 50,
  });
}
