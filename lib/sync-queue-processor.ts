/**
 * Queue processor for retrying failed sync operations.
 * Uses exponential backoff with jitter and integrates with sync logging.
 */

import {
  getQueuedOperations,
  removeFromQueue,
  updateQueuedOperation,
  type PendingOperation,
  type OperationType,
} from "@/lib/sync-queue";
import {
  createFolderInGoogleDrive,
  renameItemInGoogleDrive,
  deleteItemFromGoogleDrive,
  moveItemInGoogleDrive,
} from "@/lib/google-drive-actions";
import { logSyncOperation } from "@/lib/sync-log";
import { SyncLogAction, SyncLogStatus } from "@/lib/sync-utils";
import { logger } from "@/lib/logger";

/** Maximum number of retry attempts before giving up */
export const MAX_RETRY_ATTEMPTS = 5;

/** Base delay in milliseconds for exponential backoff */
export const BACKOFF_BASE_MS = 1000;

/** Maximum backoff delay in milliseconds */
export const MAX_BACKOFF_MS = 60000;

/** Interval between queue processing runs in milliseconds */
const PROCESS_INTERVAL_MS = 30000;

/** Processor state */
let processorInterval: ReturnType<typeof setInterval> | null = null;
let isProcessing = false;

/**
 * Calculates exponential backoff delay with jitter.
 * Jitter helps prevent thundering herd problems.
 *
 * @param attempts - Number of previous attempts
 * @returns Delay in milliseconds
 */
export function calculateBackoff(attempts: number): number {
  const exponentialDelay = BACKOFF_BASE_MS * Math.pow(2, attempts);
  const jitter = Math.random() * 0.1 * exponentialDelay;
  return Math.min(exponentialDelay + jitter, MAX_BACKOFF_MS);
}

/**
 * Maps operation types to their handler functions.
 */
type OperationHandler = (
  payload: Record<string, unknown>
) => Promise<{ success: boolean }>;

const OPERATION_HANDLERS: Record<OperationType, OperationHandler> = {
  create: async (payload) =>
    createFolderInGoogleDrive(
      payload.parentItemId as string | null,
      payload.name as string
    ),
  rename: async (payload) =>
    renameItemInGoogleDrive(
      payload.itemId as string,
      payload.newName as string
    ),
  delete: async (payload) =>
    deleteItemFromGoogleDrive(payload.itemId as string),
  move: async (payload) =>
    moveItemInGoogleDrive(
      payload.itemId as string,
      payload.newParentId as string | null,
      payload.oldParentId as string | null
    ),
  // Upload operations are handled differently via resumable uploads
  // This is a no-op handler - uploads should be retried via createUploadSessions
  upload: async () => ({ success: false }),
};

/**
 * Maps operation types to SyncLog actions.
 */
const OPERATION_TO_LOG_ACTION: Record<OperationType, SyncLogAction> = {
  create: SyncLogAction.CREATE,
  rename: SyncLogAction.RENAME,
  delete: SyncLogAction.DELETE,
  move: SyncLogAction.MOVE,
  upload: SyncLogAction.UPLOAD,
};

/**
 * Checks if an operation is ready for retry based on backoff timing.
 *
 * @param operation - The pending operation
 * @returns True if enough time has passed since the last attempt
 */
function isReadyForRetry(operation: PendingOperation): boolean {
  if (!operation.lastAttempt) return true;

  const backoffMs = calculateBackoff(operation.attempts);
  const lastAttemptTime =
    operation.lastAttempt instanceof Date
      ? operation.lastAttempt.getTime()
      : new Date(operation.lastAttempt).getTime();
  const nextAttemptTime = lastAttemptTime + backoffMs;

  return Date.now() >= nextAttemptTime;
}

/**
 * Processes a single queued operation.
 *
 * @param operation - The operation to process
 */
async function processOperation(operation: PendingOperation): Promise<void> {
  const handler = OPERATION_HANDLERS[operation.type];

  if (!handler) {
    logger.error(
      { type: operation.type },
      "[QueueProcessor] Unknown operation type"
    );
    await removeFromQueue(operation.id!);
    return;
  }

  const userId = operation.payload.userId as string | undefined;

  try {
    const result = await handler(operation.payload);

    if (result.success) {
      await removeFromQueue(operation.id!);

      if (userId) {
        await logSyncOperation({
          userId,
          action: OPERATION_TO_LOG_ACTION[operation.type],
          itemId: operation.payload.itemId as string | undefined,
          itemName: operation.payload.name as string | undefined,
          status: SyncLogStatus.SUCCESS,
        });
      }

      logger.info(
        { type: operation.type, id: operation.id },
        "[QueueProcessor] Operation succeeded"
      );
    } else {
      throw new Error("Operation returned success: false");
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    const newAttempts = operation.attempts + 1;

    if (newAttempts >= MAX_RETRY_ATTEMPTS) {
      await removeFromQueue(operation.id!);

      if (userId) {
        await logSyncOperation({
          userId,
          action: OPERATION_TO_LOG_ACTION[operation.type],
          itemId: operation.payload.itemId as string | undefined,
          itemName: operation.payload.name as string | undefined,
          status: SyncLogStatus.FAILED,
          error: `Max retries exceeded: ${errorMessage}`,
        });
      }

      logger.warn(
        { type: operation.type, attempts: newAttempts },
        "[QueueProcessor] Max retries exceeded, removing operation"
      );
    } else {
      await updateQueuedOperation(operation.id!, {
        attempts: newAttempts,
        lastAttempt: new Date(),
        error: errorMessage,
      });

      logger.info(
        { type: operation.type, attempts: newAttempts, error: errorMessage },
        "[QueueProcessor] Operation failed, will retry"
      );
    }
  }
}

/**
 * Processes all queued operations that are ready for retry.
 * Operations are processed sequentially to avoid race conditions.
 */
export async function processQueue(): Promise<void> {
  if (isProcessing) {
    logger.debug("[QueueProcessor] Already processing, skipping");
    return;
  }

  if (typeof navigator !== "undefined" && !navigator.onLine) {
    logger.debug("[QueueProcessor] Offline, skipping");
    return;
  }

  isProcessing = true;

  try {
    const operations = await getQueuedOperations();

    for (const operation of operations) {
      if (!isReadyForRetry(operation)) {
        continue;
      }

      await processOperation(operation);
    }
  } catch (error) {
    logger.error({ err: error }, "[QueueProcessor] Error processing queue");
  } finally {
    isProcessing = false;
  }
}

/**
 * Starts the queue processor.
 * Processes on interval and when coming online.
 */
export function startQueueProcessor(): void {
  if (processorInterval) {
    return;
  }

  if (typeof navigator !== "undefined" && navigator.onLine) {
    processQueue();
  }

  processorInterval = setInterval(processQueue, PROCESS_INTERVAL_MS);

  if (typeof window !== "undefined") {
    window.addEventListener("online", processQueue);
  }

  logger.info("[QueueProcessor] Started");
}

/**
 * Stops the queue processor.
 */
export function stopQueueProcessor(): void {
  if (processorInterval) {
    clearInterval(processorInterval);
    processorInterval = null;
  }

  if (typeof window !== "undefined") {
    window.removeEventListener("online", processQueue);
  }

  logger.info("[QueueProcessor] Stopped");
}

/**
 * Checks if the queue processor is running.
 *
 * @returns True if the processor is active
 */
export function isProcessorRunning(): boolean {
  return processorInterval !== null;
}
