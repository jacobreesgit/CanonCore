# Deployment 2.5.0 - Offline Sync Queue & Storage Monitoring

**Date**: 2026-01-14
**Branch**: development

## Summary

Google Drive sync operations now queue locally when offline and retry automatically when connectivity returns. A new sync history panel shows recent activity with success/failure status, and a storage bar displays quota usage with warning indicators. The batch API reduces network requests when syncing multiple items.

## Features

### Offline sync queue

Failed sync operations are stored locally in IndexedDB and retried automatically when you come back online. The queue processor uses exponential backoff with jitter to prevent overwhelming the server after reconnection.

**Queue behavior:**

- Maximum 100 pending operations
- 5 retry attempts per operation before marking as failed
- 30-second processing interval
- Automatic processing when coming online
- Backoff delays: 1s, 2s, 4s, 8s, up to 60s max

A PendingIndicator component is available for showing queued operation counts (polls every 5 seconds, pauses when tab is hidden).

### Sync history

A new **Activity** tab in Settings shows your recent sync operations. Each entry displays the operation type, item name, status, and timestamp.

**Tracked operations:**

- Create (folder creation)
- Rename
- Delete
- Move
- Upload
- Download
- Sync (full sync)

Failed operations show error messages to help diagnose issues. The history is stored server-side in the new SyncLog table, making it available across devices.

### Storage quota display

The Google Drive section now shows your storage usage as a visual progress bar. The bar changes color based on usage:

- **Default** (blue): Under 80% used
- **Warning** (yellow): 80-94% used
- **Critical** (red): 95% or more used

Storage data comes from the Google Drive API quota endpoint. The bar shows "Sync to see storage usage" until the first sync completes.

### Batch API operations

Multiple Google Drive operations can now be combined into a single HTTP request using the Batch API. This reduces latency and API quota usage when syncing several items at once.

- Maximum 100 operations per batch request
- 30-second timeout
- Content-ID headers for response correlation

### Online status detection

The new `useOnlineStatus` hook provides real-time browser connectivity status. Components can react to online/offline transitions to show appropriate UI feedback.

## Files Changed

### Added

```
lib/sync-queue.ts                           # IndexedDB queue for offline operations
lib/sync-queue-processor.ts                 # Queue retry logic with exponential backoff
lib/sync-log.ts                             # Server actions for sync history
lib/sync-utils.ts                           # Shared sync types and utilities
lib/queue-aware-actions.ts                  # Actions that queue when offline
lib/google-drive-batch.ts                   # Batch API request/response handling
hooks/use-online-status.ts                  # Online/offline status hook
components/google-drive/pending-indicator.tsx   # Pending operations badge
components/google-drive/storage-bar.tsx     # Storage quota progress bar
components/google-drive/sync-history.tsx    # Sync activity feed
components/ui/progress.tsx                  # shadcn progress bar component
prisma/migrations/20260113215722_add_sync_log/migration.sql
tests/unit/lib/sync-queue.test.ts
tests/unit/lib/sync-queue-processor.test.ts
tests/unit/lib/sync-log.test.ts
tests/unit/lib/queue-aware-actions.test.ts
tests/unit/lib/google-drive-batch.test.ts
tests/unit/hooks/use-online-status.test.ts
tests/unit/components/google-drive/pending-indicator.test.tsx
tests/unit/components/google-drive/storage-bar.test.tsx
tests/unit/components/google-drive/sync-history.test.tsx
tests/integration/google-drive/batch-operations.test.ts
```

### Modified

```
lib/google-drive-actions.ts     # Integrated queue-aware operations
lib/google-drive-client.ts      # Added quota fetching
lib/google-drive-sync.ts        # Sync logging integration
lib/item-actions.ts             # Queue operations when offline
lib/types.ts                    # SyncLogEntry, PendingOperation types
lib/validations.ts              # Sync log validation schemas
prisma/schema.prisma            # SyncLog model, SyncLogAction/Status enums
components/google-drive/index.ts            # Barrel export updates
components/google-drive/settings-section.tsx # Storage bar, sync history
components/nav-user.tsx         # Storage bar in user dropdown
components/profile/settings-dialog.tsx      # Activity tab
components/ui/animated-dialog-content.tsx   # Dialog improvements
tests/unit/setup.ts             # IndexedDB mocks
```

## Database Migration

```sql
-- CreateEnum
CREATE TYPE "SyncLogAction" AS ENUM ('CREATE', 'RENAME', 'DELETE', 'MOVE', 'UPLOAD', 'DOWNLOAD', 'SYNC');

-- CreateEnum
CREATE TYPE "SyncLogStatus" AS ENUM ('SUCCESS', 'FAILED', 'PENDING');

-- CreateTable
CREATE TABLE "SyncLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" "SyncLogAction" NOT NULL,
    "itemId" TEXT,
    "itemName" TEXT,
    "fileId" TEXT,
    "fileName" TEXT,
    "status" "SyncLogStatus" NOT NULL,
    "error" TEXT,
    "duration" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SyncLog_pkey" PRIMARY KEY ("id")
);

-- Indexes for efficient querying
CREATE INDEX "SyncLog_userId_createdAt_idx" ON "SyncLog"("userId", "createdAt" DESC);
CREATE INDEX "SyncLog_userId_status_idx" ON "SyncLog"("userId", "status");
CREATE INDEX "SyncLog_createdAt_idx" ON "SyncLog"("createdAt");

-- Foreign key with cascade delete
ALTER TABLE "SyncLog" ADD CONSTRAINT "SyncLog_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

The SyncLog table stores server-side sync history with indexed queries by user and timestamp. Old logs can be cleaned up via `cleanupOldSyncLogs(daysOld)`.

## Test Results

| Suite       | Tests | Result     |
| ----------- | ----- | ---------- |
| Unit        | 1192  | All passed |
| Integration | 92    | All passed |
| E2E         | 58    | All passed |

## API Changes

### New server actions

```typescript
// lib/sync-log.ts
export async function logSyncOperation(
  params: LogSyncParams
): Promise<string | null>;
export async function logSyncOperationsBatch(
  operations: LogSyncParams[]
): Promise<(string | null)[]>;
export async function getSyncHistory(
  userId: string,
  limit?: number,
  status?: SyncLogStatus
): Promise<SyncLog[]>;
export async function getSyncHistoryAction(
  limit?: number,
  status?: SyncLogStatus
): Promise<SyncLogEntry[] | null>;
export async function cleanupOldSyncLogs(daysOld?: number): Promise<number>;
```

### New client-side queue functions

```typescript
// lib/sync-queue.ts
export async function queueOperation(
  operation: Omit<PendingOperation, "id" | "createdAt">
): Promise<string | null>;
export async function getQueuedOperations(): Promise<PendingOperation[]>;
export async function removeFromQueue(id: string): Promise<void>;
export async function updateQueuedOperation(
  id: string,
  updates: Partial<PendingOperation>
): Promise<void>;
export async function getPendingCount(): Promise<number>;
export async function clearQueue(): Promise<void>;
export async function isQueueAvailable(): Promise<boolean>;

// lib/sync-queue-processor.ts
export function calculateBackoff(attempts: number): number;
export async function processQueue(): Promise<void>;
export function startQueueProcessor(): void;
export function stopQueueProcessor(): void;
export function isProcessorRunning(): boolean;
```

### New batch API utilities

```typescript
// lib/google-drive-batch.ts
export function buildBatchRequest(operations: BatchOperation[]): {
  body: string;
  boundary: string;
};
export function parseBatchResponse(
  responseBody: string,
  boundary: string,
  fileIds: string[]
): BatchResult[];
export function getBatchTimeout(): number;
```

### New types

```typescript
// lib/types.ts
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

// lib/sync-queue.ts
export type OperationType = "create" | "rename" | "delete" | "move" | "upload";

export interface PendingOperation {
  id?: string;
  type: OperationType;
  payload: Record<string, unknown>;
  attempts: number;
  lastAttempt: Date | null;
  error: string | null;
  createdAt?: Date;
}

// lib/sync-utils.ts
export enum SyncLogAction {
  CREATE,
  RENAME,
  DELETE,
  MOVE,
  UPLOAD,
  DOWNLOAD,
  SYNC,
}
export enum SyncLogStatus {
  SUCCESS,
  FAILED,
  PENDING,
}
```

### New hook

```typescript
// hooks/use-online-status.ts
export function useOnlineStatus(): boolean;
```
