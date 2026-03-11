/**
 * Sync logging server actions for tracking Google Drive operations.
 * Provides audit trail and debugging capability for sync issues.
 */

"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { createUserLogger } from "@/lib/logger";
import {
  sanitizeErrorMessage,
  type LogSyncParams,
  type SyncLogEntry,
  SyncLogStatus,
} from "@/lib/sync-utils";

/**
 * Logs a sync operation to the database.
 * Non-blocking - failures are logged but don't throw.
 *
 * @param params - Operation details to log
 * @returns The created log ID, or null if logging failed
 */
export async function logSyncOperation(
  params: LogSyncParams
): Promise<string | null> {
  const logger = createUserLogger(params.userId);

  try {
    const log = await prisma.syncLog.create({
      data: {
        userId: params.userId,
        action: params.action,
        itemId: params.itemId,
        itemName: params.itemName,
        fileId: params.fileId,
        fileName: params.fileName,
        status: params.status,
        error: params.error ? sanitizeErrorMessage(params.error) : null,
        duration: params.duration,
      },
    });
    return log.id;
  } catch (error) {
    // Log failure but don't throw - sync logging is non-critical
    logger.error({ err: error, params }, "[SyncLog] Failed to log operation");
    return null;
  }
}

/**
 * Logs multiple sync operations in a single transaction.
 * Useful for bulk sync operations to reduce DB calls.
 *
 * @param operations - Array of operation details to log
 * @returns Array of created log IDs (null for any failures)
 */
export async function logSyncOperationsBatch(
  operations: LogSyncParams[]
): Promise<(string | null)[]> {
  if (operations.length === 0) return [];

  const userId = operations[0].userId;
  const logger = createUserLogger(userId);

  try {
    const results = await prisma.$transaction(
      operations.map((params) =>
        prisma.syncLog.create({
          data: {
            userId: params.userId,
            action: params.action,
            itemId: params.itemId,
            itemName: params.itemName,
            fileId: params.fileId,
            fileName: params.fileName,
            status: params.status,
            error: params.error ? sanitizeErrorMessage(params.error) : null,
            duration: params.duration,
          },
        })
      )
    );
    return results.map((log) => log.id);
  } catch (error) {
    logger.error(
      { err: error, count: operations.length },
      "[SyncLog] Failed to batch log operations"
    );
    return operations.map(() => null);
  }
}

/**
 * Gets recent sync history for a user.
 *
 * @param userId - The user ID
 * @param limit - Maximum number of entries (default 20)
 * @param status - Optional filter by status
 * @returns Array of sync log entries, newest first
 */
export async function getSyncHistory(
  userId: string,
  limit = 20,
  status?: SyncLogStatus
) {
  return prisma.syncLog.findMany({
    where: {
      userId,
      ...(status && { status }),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

/**
 * Cleans up old sync log entries.
 * Should be called by a scheduled job.
 *
 * @param daysOld - Delete entries older than this many days (default 30)
 * @returns Number of deleted entries
 */
export async function cleanupOldSyncLogs(daysOld = 30): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  const result = await prisma.syncLog.deleteMany({
    where: {
      createdAt: { lt: cutoffDate },
    },
  });

  return result.count;
}

/**
 * Server action to get sync history for the authenticated user.
 * Returns recent sync operations with all relevant fields.
 *
 * @param limit - Maximum number of entries to return (default 20)
 * @param status - Optional filter by status
 * @returns Array of sync log entries, or null if not authenticated
 */
export async function getSyncHistoryAction(
  limit = 20,
  status?: SyncLogStatus
): Promise<SyncLogEntry[] | null> {
  const session = await auth();
  if (!session?.user?.id) {
    return null;
  }

  const logs = await getSyncHistory(session.user.id, limit, status);

  return logs.map((log) => ({
    id: log.id,
    action: log.action,
    status: log.status,
    itemName: log.itemName,
    fileName: log.fileName,
    error: log.error,
    duration: log.duration,
    createdAt: log.createdAt,
  }));
}
