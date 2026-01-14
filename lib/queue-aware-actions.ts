/**
 * Client-side utilities for queue-aware server action calls.
 * Provides automatic queueing of failed operations for offline resilience.
 */

import {
  queueOperation,
  isQueueAvailable,
  type OperationType,
} from "@/lib/sync-queue";

/**
 * Checks if an error is a network-related error.
 *
 * @param error - The error to check
 * @returns True if the error appears to be network-related
 */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError) {
    // "Failed to fetch" is a common network error message
    return error.message.includes("fetch");
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes("network") ||
      message.includes("offline") ||
      message.includes("connection") ||
      message.includes("timeout") ||
      message.includes("econnrefused") ||
      message.includes("enotfound")
    );
  }

  return false;
}

/**
 * Result from a queue-aware action call.
 */
export interface QueueAwareResult<T> {
  /** Whether the action succeeded */
  success: boolean;
  /** The result data if successful */
  data?: T;
  /** Error message if failed */
  error?: string;
  /** Whether the operation was queued for later retry */
  queued?: boolean;
}

/**
 * Parameters for a queueable operation.
 */
export interface QueueableOperationParams {
  /** The operation type for the queue */
  type: OperationType;
  /** The payload to store in the queue */
  payload: Record<string, unknown>;
  /** User ID for sync logging */
  userId?: string;
}

/**
 * Wraps a server action call with queue fallback for network errors.
 * If the action fails due to a network error and we're offline,
 * the operation is queued for retry when online.
 *
 * @param action - The async action to execute
 * @param queueParams - Parameters for queueing if the action fails
 * @returns The action result or a queued indicator
 *
 * @example
 * const result = await withQueueFallback(
 *   () => createItem({ name: "New Folder" }),
 *   { type: "create", payload: { name: "New Folder" } }
 * );
 * if (result.queued) {
 *   toast.info("Saved for sync when online");
 * }
 */
export async function withQueueFallback<T>(
  action: () => Promise<T>,
  queueParams: QueueableOperationParams
): Promise<QueueAwareResult<T>> {
  try {
    const result = await action();
    return { success: true, data: result };
  } catch (error) {
    // Check if it's a network error and queue is available
    const canQueue =
      isNetworkError(error) &&
      typeof window !== "undefined" &&
      !navigator.onLine &&
      (await isQueueAvailable());

    if (canQueue) {
      const queued = await queueOperation({
        type: queueParams.type,
        payload: queueParams.payload,
        attempts: 0,
        lastAttempt: null,
        error: null,
      });

      if (queued) {
        return {
          success: false,
          queued: true,
          error: "Saved for sync when online",
        };
      }
    }

    // Re-throw if we couldn't queue
    const errorMessage =
      error instanceof Error ? error.message : "Operation failed";
    return { success: false, error: errorMessage };
  }
}

/**
 * Checks if the browser is currently offline.
 * Use this to decide whether to attempt a server action.
 *
 * @returns True if the browser is offline
 */
export function isOffline(): boolean {
  return typeof navigator !== "undefined" && !navigator.onLine;
}

/**
 * Pre-emptively queues an operation when offline.
 * Use this when you know you're offline and want to queue directly.
 *
 * @param params - The queue parameters
 * @returns Whether the operation was successfully queued
 */
export async function queueIfOffline(
  params: QueueableOperationParams
): Promise<{ queued: boolean; error?: string }> {
  if (!isOffline()) {
    return { queued: false };
  }

  const available = await isQueueAvailable();
  if (!available) {
    return { queued: false, error: "Queue not available" };
  }

  const id = await queueOperation({
    type: params.type,
    payload: params.payload,
    attempts: 0,
    lastAttempt: null,
    error: null,
  });

  return { queued: id !== null };
}
