/**
 * Client-side sync queue using IndexedDB.
 * Queues failed operations for retry with exponential backoff.
 */

import { openDB, type IDBPDatabase } from "idb";

/** Maximum number of operations in queue */
const MAX_QUEUE_SIZE = 100;

/** IndexedDB database name */
const DB_NAME = "canoncore-sync-queue";

/** Database version */
const DB_VERSION = 1;

/** Store name for pending operations */
const STORE_NAME = "pending-operations";

/** Operation types that can be queued */
export type OperationType = "create" | "rename" | "delete" | "move" | "upload";

/**
 * Pending operation stored in IndexedDB.
 */
export interface PendingOperation {
  /** Unique operation ID */
  id?: string;
  /** Operation type */
  type: OperationType;
  /** Operation payload (item data, file data, etc.) */
  payload: Record<string, unknown>;
  /** Number of retry attempts */
  attempts: number;
  /** Timestamp of last attempt */
  lastAttempt: Date | null;
  /** Last error message */
  error: string | null;
  /** When the operation was queued */
  createdAt?: Date;
}

/** Cached database instance */
let dbPromise: Promise<IDBPDatabase> | null = null;

/**
 * Checks if IndexedDB is available in the current environment.
 *
 * @returns True if IndexedDB is available
 */
function checkIndexedDBAvailability(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  if (!window.indexedDB) {
    return false;
  }

  return true;
}

/**
 * Opens or creates the IndexedDB database.
 *
 * @returns Database instance or null if unavailable
 */
async function getDB(): Promise<IDBPDatabase | null> {
  if (!checkIndexedDBAvailability()) {
    return null;
  }

  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, {
            keyPath: "id",
            autoIncrement: false,
          });
          store.createIndex("createdAt", "createdAt", { unique: false });
        }
      },
    });
  }

  return dbPromise;
}

/**
 * Generates a unique ID for an operation.
 * Uses crypto.randomUUID() for strong uniqueness.
 *
 * @returns Unique string ID
 */
function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Queues an operation for later processing.
 * Enforces maximum queue size of 100 operations.
 *
 * @param operation - Operation to queue (without id and createdAt)
 * @returns Operation ID if queued, null if queue is full
 */
export async function queueOperation(
  operation: Omit<PendingOperation, "id" | "createdAt">
): Promise<string | null> {
  const db = await getDB();
  if (!db) {
    return null;
  }

  // Check queue size
  const count = await db.count(STORE_NAME);
  if (count >= MAX_QUEUE_SIZE) {
    const { logger } = await import("@/lib/logger");
    logger.warn({ count, maxSize: MAX_QUEUE_SIZE }, "Sync queue is full");
    return null;
  }

  const id = generateId();
  const pendingOp: PendingOperation = {
    ...operation,
    id,
    createdAt: new Date(),
  };

  await db.put(STORE_NAME, pendingOp);
  return id;
}

/**
 * Gets all queued operations sorted by creation time.
 *
 * @returns Array of pending operations, oldest first
 */
export async function getQueuedOperations(): Promise<PendingOperation[]> {
  const db = await getDB();
  if (!db) {
    return [];
  }

  const operations = await db.getAllFromIndex(STORE_NAME, "createdAt");
  return operations;
}

/**
 * Removes an operation from the queue.
 *
 * @param id - Operation ID to remove
 */
export async function removeFromQueue(id: string): Promise<void> {
  const db = await getDB();
  if (!db) {
    return;
  }

  await db.delete(STORE_NAME, id);
}

/**
 * Updates a queued operation's retry state.
 *
 * @param id - Operation ID
 * @param updates - Fields to update
 */
export async function updateQueuedOperation(
  id: string,
  updates: Partial<Pick<PendingOperation, "attempts" | "lastAttempt" | "error">>
): Promise<void> {
  const db = await getDB();
  if (!db) {
    return;
  }

  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);
  const operation = await store.get(id);

  if (operation) {
    const updated = { ...operation, ...updates };
    await store.put(updated);
  }

  await tx.done;
}

/**
 * Gets the count of pending operations.
 *
 * @returns Number of queued operations
 */
export async function getPendingCount(): Promise<number> {
  const db = await getDB();
  if (!db) {
    return 0;
  }

  return db.count(STORE_NAME);
}

/**
 * Clears all operations from the queue.
 */
export async function clearQueue(): Promise<void> {
  const db = await getDB();
  if (!db) {
    return;
  }

  await db.clear(STORE_NAME);
}

/**
 * Checks if the sync queue is available.
 *
 * @returns True if IndexedDB is accessible
 */
export async function isQueueAvailable(): Promise<boolean> {
  const db = await getDB();
  return db !== null;
}
