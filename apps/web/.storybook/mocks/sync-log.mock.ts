/**
 * Mock for lib/sync-log.ts
 * Provides fake sync history data for Storybook stories.
 */

import { fn } from "storybook/test";
import { SyncLogAction, SyncLogStatus } from "@/lib/sync-utils";

/**
 * Creates mock sync log entries with realistic data.
 */
function createMockLogs() {
  const now = Date.now();

  return [
    {
      id: "log-1",
      action: SyncLogAction.CREATE,
      status: SyncLogStatus.SUCCESS,
      itemName: "Breaking Bad",
      fileName: null,
      error: null,
      duration: 245,
      createdAt: new Date(now - 5 * 60 * 1000),
    },
    {
      id: "log-2",
      action: SyncLogAction.UPLOAD,
      status: SyncLogStatus.SUCCESS,
      itemName: null,
      fileName: "poster.jpg",
      error: null,
      duration: 1250,
      createdAt: new Date(now - 15 * 60 * 1000),
    },
    {
      id: "log-3",
      action: SyncLogAction.RENAME,
      status: SyncLogStatus.SUCCESS,
      itemName: "Season 1",
      fileName: null,
      error: null,
      duration: 120,
      createdAt: new Date(now - 30 * 60 * 1000),
    },
    {
      id: "log-4",
      action: SyncLogAction.DELETE,
      status: SyncLogStatus.FAILED,
      itemName: "Old Item",
      fileName: null,
      error: "Permission denied: Cannot delete folder",
      duration: 89,
      createdAt: new Date(now - 60 * 60 * 1000),
    },
    {
      id: "log-5",
      action: SyncLogAction.SYNC,
      status: SyncLogStatus.SUCCESS,
      itemName: null,
      fileName: null,
      error: null,
      duration: 3500,
      createdAt: new Date(now - 2 * 60 * 60 * 1000),
    },
  ];
}

// Mock server actions
export const logSyncOperation = fn(async () => "mock-log-id");

export const logSyncOperationsBatch = fn(async (operations: unknown[]) =>
  (operations as unknown[]).map(() => "mock-log-id")
);

export const getSyncHistory = fn(async () => createMockLogs());

export const cleanupOldSyncLogs = fn(async () => 0);

export const getSyncHistoryAction = fn(async () => createMockLogs());
