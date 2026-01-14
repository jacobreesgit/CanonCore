/**
 * Sync utility functions for Google Drive operations.
 * Non-server-action helpers used across sync modules.
 */

import { SyncLogAction, SyncLogStatus } from "@prisma/client";

// Re-export enums for convenience
export { SyncLogAction, SyncLogStatus };

/** Parameters for logging a sync operation */
export interface LogSyncParams {
  userId: string;
  action: SyncLogAction;
  itemId?: string;
  itemName?: string;
  fileId?: string;
  fileName?: string;
  status: SyncLogStatus;
  error?: string;
  duration?: number;
}

/** SyncLog entry returned from getSyncHistoryAction */
export interface SyncLogEntry {
  id: string;
  action: SyncLogAction;
  status: SyncLogStatus;
  itemName: string | null;
  fileName: string | null;
  error: string | null;
  duration: number | null;
  createdAt: Date;
}

/** Sensitive patterns to remove from error messages */
const SENSITIVE_PATTERNS = [
  /Bearer\s+[A-Za-z0-9\-_]+/gi, // Bearer tokens
  /api[_-]?key[=:]\s*['"]?[A-Za-z0-9\-_]+['"]?/gi, // API keys
  /\/Users\/[^/\s]+/g, // Local user paths
  /password[=:]\s*['"]?[^'"\s]+['"]?/gi, // Passwords
];

/**
 * Sanitizes error messages to remove sensitive information.
 *
 * @param message - Raw error message
 * @returns Sanitized message safe for storage
 */
export function sanitizeErrorMessage(message: string): string {
  let sanitized = message;
  for (const pattern of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(pattern, "[REDACTED]");
  }
  // Truncate to reasonable length
  return sanitized.slice(0, 500);
}

/**
 * Helper to measure and log operation duration.
 *
 * @example
 * const timer = startSyncTimer();
 * await performOperation();
 * await logSyncOperation({ ...params, duration: timer() });
 */
export function startSyncTimer(): () => number {
  const start = Date.now();
  return () => Date.now() - start;
}
