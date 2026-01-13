# Sync Operations Tracking Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement offline queue for resilient sync operations and sync history for user visibility into what synced and when.

**Architecture:** Two complementary systems:

1. **Offline Queue (Client-side):** IndexedDB queue for failed operations with exponential backoff retry
2. **Sync History (Server-side):** `SyncLog` Prisma model tracking all sync operations with success/failure status

**Tech Stack:** IndexedDB (idb library), React Context, Prisma, PostgreSQL

---

## Security Considerations

### Payload Storage (IndexedDB)

- Queued operations store payloads in browser IndexedDB (unencrypted)
- **Sensitive data handling:** Payloads should only contain IDs and names, never tokens or credentials
- **Private browsing:** IndexedDB may be unavailable - requires graceful degradation
- **Quota limits:** Large queues may hit storage limits - implement queue size cap

### Error Message Sanitization

- Error messages stored in SyncLog must be sanitized to prevent leaking:
  - API keys or tokens
  - Internal file paths
  - User credentials
  - Stack traces with sensitive context

### Data Retention

- SyncLog entries should be automatically cleaned up after 30 days
- Prevents unbounded table growth
- Users can export history before cleanup if needed

---

## Part A: Sync History (Server-Side)

### Task A1: Create SyncLog Prisma Model

**Files:**

- Modify: `prisma/schema.prisma`
- Create migration

**Step 1: Add enums and SyncLog model to schema**

Add to `prisma/schema.prisma`:

```prisma
/// Actions that can be tracked in sync history
enum SyncLogAction {
  CREATE
  RENAME
  DELETE
  MOVE
  UPLOAD
  DOWNLOAD
  SYNC
}

/// Status of a sync log entry (distinct from Item SyncStatus)
enum SyncLogStatus {
  SUCCESS
  FAILED
  PENDING
}

model SyncLog {
  id          String         @id @default(cuid())
  userId      String

  // What happened
  action      SyncLogAction  // Type-safe enum for action type
  itemId      String?        // Related item (if applicable)
  itemName    String?        // Snapshot of item name at time of action
  fileId      String?        // Related file (if applicable)
  fileName    String?        // Snapshot of file name at time of action

  // Result
  status      SyncLogStatus  // Type-safe enum for status
  error       String?        // Sanitized error message if failed
  duration    Int?           // Milliseconds

  // Timestamps
  createdAt   DateTime @default(now())

  // Relations
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Indexes optimized for common query patterns
  @@index([userId, createdAt(sort: Desc)])  // Recent activity by user
  @@index([userId, status])                  // Filter by status per user
  @@index([createdAt])                       // For cleanup job
}
```

**Step 2: Update User model**

Add relation to User model:

```prisma
model User {
  // ... existing fields
  syncLogs    SyncLog[]
}
```

**Step 3: Run migration**

Run: `npx prisma migrate dev --name add_sync_log`
Expected: Migration created and applied

**Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "$(cat <<'EOF'
feat(schema): add SyncLog model for sync history tracking

Tracks all sync operations with action type, status, and duration.
Enables "Recent Activity" UI and sync debugging.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task A2: Create Sync Logging Utilities

**Files:**

- Create: `lib/sync-log.ts`
- Test: `tests/unit/lib/sync-log.test.ts`

**Step 1: Write the failing test**

Create `tests/unit/lib/sync-log.test.ts`:

```typescript
/**
 * Unit tests for sync logging utilities.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  logSyncOperation,
  logSyncOperationsBatch,
  getSyncHistory,
  sanitizeErrorMessage,
  cleanupOldSyncLogs,
  SyncLogAction,
  SyncLogStatus,
} from "@/lib/sync-log";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    syncLog: {
      create: vi.fn(),
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/logger", () => ({
  createUserLogger: vi.fn(() => ({
    error: vi.fn(),
    info: vi.fn(),
  })),
}));

describe("sync-log", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("sanitizeErrorMessage", () => {
    it("removes bearer tokens", () => {
      const message = "Auth failed: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9";
      expect(sanitizeErrorMessage(message)).toBe("Auth failed: [REDACTED]");
    });

    it("removes API keys", () => {
      const message = 'Request failed with api_key="sk-1234567890"';
      expect(sanitizeErrorMessage(message)).toBe("Request failed with [REDACTED]");
    });

    it("removes local paths", () => {
      const message = "File not found at /Users/john/secret/file.txt";
      expect(sanitizeErrorMessage(message)).toBe("File not found at [REDACTED]/secret/file.txt");
    });

    it("truncates long messages", () => {
      const longMessage = "a".repeat(600);
      expect(sanitizeErrorMessage(longMessage).length).toBe(500);
    });
  });

  describe("logSyncOperation", () => {
    it("creates a sync log entry and returns ID", async () => {
      vi.mocked(prisma.syncLog.create).mockResolvedValue({
        id: "log-1",
        userId: "user-1",
        action: SyncLogAction.CREATE,
        itemId: "item-1",
        itemName: "Test Item",
        status: SyncLogStatus.SUCCESS,
        duration: 150,
        createdAt: new Date(),
      } as any);

      const result = await logSyncOperation({
        userId: "user-1",
        action: SyncLogAction.CREATE,
        itemId: "item-1",
        itemName: "Test Item",
        status: SyncLogStatus.SUCCESS,
        duration: 150,
      });

      expect(result).toBe("log-1");
      expect(prisma.syncLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: "user-1",
          action: SyncLogAction.CREATE,
          itemId: "item-1",
          itemName: "Test Item",
          status: SyncLogStatus.SUCCESS,
          duration: 150,
        }),
      });
    });

    it("sanitizes error messages before storing", async () => {
      vi.mocked(prisma.syncLog.create).mockResolvedValue({ id: "log-1" } as any);

      await logSyncOperation({
        userId: "user-1",
        action: SyncLogAction.UPLOAD,
        status: SyncLogStatus.FAILED,
        error: "Failed with Bearer secret-token-123",
      });

      expect(prisma.syncLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          error: "Failed with [REDACTED]",
        }),
      });
    });

    it("returns null on failure without throwing", async () => {
      vi.mocked(prisma.syncLog.create).mockRejectedValue(new Error("DB error"));

      const result = await logSyncOperation({
        userId: "user-1",
        action: SyncLogAction.CREATE,
        status: SyncLogStatus.SUCCESS,
      });

      expect(result).toBeNull();
    });
  });

  describe("logSyncOperationsBatch", () => {
    it("creates multiple logs in a transaction", async () => {
      vi.mocked(prisma.$transaction).mockResolvedValue([
        { id: "log-1" },
        { id: "log-2" },
      ] as any);

      const result = await logSyncOperationsBatch([
        { userId: "user-1", action: SyncLogAction.CREATE, status: SyncLogStatus.SUCCESS },
        { userId: "user-1", action: SyncLogAction.UPLOAD, status: SyncLogStatus.SUCCESS },
      ]);

      expect(result).toEqual(["log-1", "log-2"]);
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it("returns empty array for empty input", async () => {
      const result = await logSyncOperationsBatch([]);
      expect(result).toEqual([]);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe("getSyncHistory", () => {
    it("returns recent sync logs for user", async () => {
      const mockLogs = [
        { id: "log-1", action: SyncLogAction.CREATE, status: SyncLogStatus.SUCCESS },
        { id: "log-2", action: SyncLogAction.RENAME, status: SyncLogStatus.SUCCESS },
      ];
      vi.mocked(prisma.syncLog.findMany).mockResolvedValue(mockLogs as any);

      const result = await getSyncHistory("user-1", 20);

      expect(prisma.syncLog.findMany).toHaveBeenCalledWith({
        where: { userId: "user-1" },
        orderBy: { createdAt: "desc" },
        take: 20,
      });
      expect(result).toEqual(mockLogs);
    });

    it("filters by status when provided", async () => {
      vi.mocked(prisma.syncLog.findMany).mockResolvedValue([]);

      await getSyncHistory("user-1", 20, SyncLogStatus.FAILED);

      expect(prisma.syncLog.findMany).toHaveBeenCalledWith({
        where: { userId: "user-1", status: SyncLogStatus.FAILED },
        orderBy: { createdAt: "desc" },
        take: 20,
      });
    });
  });

  describe("cleanupOldSyncLogs", () => {
    it("deletes logs older than specified days", async () => {
      vi.mocked(prisma.syncLog.deleteMany).mockResolvedValue({ count: 50 });

      const result = await cleanupOldSyncLogs(30);

      expect(result).toBe(50);
      expect(prisma.syncLog.deleteMany).toHaveBeenCalledWith({
        where: {
          createdAt: { lt: expect.any(Date) },
        },
      });
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/lib/sync-log.test.ts`
Expected: FAIL - module doesn't exist

**Step 3: Write minimal implementation**

Create `lib/sync-log.ts`:

```typescript
/**
 * Sync logging utilities for tracking Google Drive operations.
 * Provides audit trail and debugging capability for sync issues.
 */

import { prisma } from "@/lib/prisma";
import { createUserLogger } from "@/lib/logger";
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

/** Sensitive patterns to remove from error messages */
const SENSITIVE_PATTERNS = [
  /Bearer\s+[A-Za-z0-9\-_]+/gi, // Bearer tokens
  /api[_-]?key[=:]\s*['"]?[A-Za-z0-9\-_]+['"]?/gi, // API keys
  /\/Users\/[^\/\s]+/g, // Local user paths
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
```

**Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/lib/sync-log.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/sync-log.ts tests/unit/lib/sync-log.test.ts
git commit -m "$(cat <<'EOF'
feat(sync): add sync logging utilities

Provides logSyncOperation() and getSyncHistory() for tracking
all Google Drive sync operations with timing and error details.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task A3: Integrate Logging into Google Drive Actions

**Files:**

- Modify: `lib/google-drive-actions.ts`
- Test: `tests/unit/lib/google-drive-actions.test.ts`

**Step 1: Write the failing test**

Add to `tests/unit/lib/google-drive-actions.test.ts`:

```typescript
import { logSyncOperation } from "@/lib/sync-log";

vi.mock("@/lib/sync-log", () => ({
  logSyncOperation: vi.fn(),
  startSyncTimer: vi.fn(() => () => 100),
}));

describe("sync logging integration", () => {
  it("logs successful item creation", async () => {
    // Setup mocks for createItem...

    await createItem({ name: "Test Item", parentId: null });

    expect(logSyncOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "create",
        status: "success",
        itemName: "Test Item",
      })
    );
  });

  it("logs failed item creation with error", async () => {
    // Setup mock to throw...
    mockDrive.files.create.mockRejectedValue(new Error("API Error"));

    await expect(createItem({ name: "Test" })).rejects.toThrow();

    expect(logSyncOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "create",
        status: "failed",
        error: "API Error",
      })
    );
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/lib/google-drive-actions.test.ts -t "sync logging"`
Expected: FAIL - logSyncOperation not called

**Step 3: Write minimal implementation**

Add logging to key functions in `lib/google-drive-actions.ts`:

```typescript
import { logSyncOperation, startSyncTimer } from "@/lib/sync-log";

// In createItemInDrive():
export async function createItemInDrive(...) {
  const timer = startSyncTimer();
  try {
    // ... existing creation logic ...

    await logSyncOperation({
      userId,
      action: "create",
      itemId: item.id,
      itemName: item.name,
      status: "success",
      duration: timer(),
    });

    return item;
  } catch (error) {
    await logSyncOperation({
      userId,
      action: "create",
      itemName: name,
      status: "failed",
      error: error instanceof Error ? error.message : "Unknown error",
      duration: timer(),
    });
    throw error;
  }
}

// Similar pattern for renameItem, deleteItem, uploadFile, syncFromGoogleDrive
```

**Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/lib/google-drive-actions.test.ts -t "sync logging"`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/google-drive-actions.ts tests/unit/lib/google-drive-actions.test.ts
git commit -m "$(cat <<'EOF'
feat(sync): integrate sync logging into Drive actions

All create, rename, delete, upload, and sync operations now
log to SyncLog with timing and error details.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task A4: Create Sync History Server Action

**Files:**

- Modify: `lib/google-drive-actions.ts`
- Test: `tests/unit/lib/google-drive-actions.test.ts`

**Step 1: Write the failing test**

```typescript
describe("getSyncHistoryAction", () => {
  it("returns sync history for authenticated user", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    vi.mocked(prisma.syncLog.findMany).mockResolvedValue([
      { id: "log-1", action: "create", status: "success" },
    ] as any);

    const result = await getSyncHistoryAction();

    expect(result.success).toBe(true);
    expect(result.logs).toHaveLength(1);
  });

  it("returns error when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const result = await getSyncHistoryAction();

    expect(result.success).toBe(false);
    expect(result.error).toBe("Not authenticated");
  });
});
```

**Step 2: Run test to verify it fails**

**Step 3: Write minimal implementation**

```typescript
/**
 * Gets sync history for the current user.
 * Returns last 20 sync operations.
 */
export async function getSyncHistoryAction(): Promise<{
  success: boolean;
  logs?: Awaited<ReturnType<typeof getSyncHistory>>;
  error?: string;
}> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Not authenticated" };
  }

  try {
    const logs = await getSyncHistory(session.user.id);
    return { success: true, logs };
  } catch (error) {
    logger.error({ err: error }, "[GoogleDrive] Failed to get sync history");
    return { success: false, error: "Failed to load sync history" };
  }
}
```

**Step 4: Run test to verify it passes**

**Step 5: Commit**

```bash
git add lib/google-drive-actions.ts tests/unit/lib/google-drive-actions.test.ts
git commit -m "$(cat <<'EOF'
feat(sync): add getSyncHistoryAction server action

Returns last 20 sync operations for displaying in UI.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task A5: Create Sync History UI Component

**Files:**

- Create: `components/google-drive/sync-history.tsx`
- Test: `tests/unit/components/sync-history.test.tsx`

**Step 1: Write the failing test**

Create `tests/unit/components/sync-history.test.tsx`:

```typescript
/**
 * Unit tests for SyncHistory component.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { SyncHistory } from "@/components/google-drive/sync-history";
import { SyncLogAction, SyncLogStatus } from "@prisma/client";

vi.mock("@/lib/google-drive-actions", () => ({
  getSyncHistoryAction: vi.fn(),
}));

import { getSyncHistoryAction } from "@/lib/google-drive-actions";

describe("SyncHistory", () => {
  it("displays sync log entries", async () => {
    vi.mocked(getSyncHistoryAction).mockResolvedValue({
      success: true,
      logs: [
        {
          id: "log-1",
          action: SyncLogAction.CREATE,
          itemName: "Test Folder",
          status: SyncLogStatus.SUCCESS,
          createdAt: new Date("2026-01-13T10:00:00"),
          duration: 150,
        },
        {
          id: "log-2",
          action: SyncLogAction.UPLOAD,
          fileName: "video.mp4",
          status: SyncLogStatus.FAILED,
          error: "Network error",
          createdAt: new Date("2026-01-13T09:55:00"),
          duration: 30000,
        },
      ],
    });

    render(<SyncHistory />);

    await waitFor(() => {
      expect(screen.getByText("Test Folder")).toBeInTheDocument();
      expect(screen.getByText("Created")).toBeInTheDocument();
      expect(screen.getByText("video.mp4")).toBeInTheDocument();
      expect(screen.getByText("Failed")).toBeInTheDocument();
    });
  });

  it("shows empty state when no history", async () => {
    vi.mocked(getSyncHistoryAction).mockResolvedValue({
      success: true,
      logs: [],
    });

    render(<SyncHistory />);

    await waitFor(() => {
      expect(screen.getByText(/no sync activity/i)).toBeInTheDocument();
    });
  });

  it("shows error state on failure", async () => {
    vi.mocked(getSyncHistoryAction).mockResolvedValue({
      success: false,
      error: "Failed to load",
    });

    render(<SyncHistory />);

    await waitFor(() => {
      expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/components/sync-history.test.tsx`
Expected: FAIL - component doesn't exist

**Step 3: Write minimal implementation**

Create `components/google-drive/sync-history.tsx`:

```typescript
/**
 * Sync history panel showing recent Google Drive operations.
 * Displays action type, item/file name, status, and timestamp.
 */

"use client";

import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  CheckCircle2,
  XCircle,
  Clock,
  FolderPlus,
  FileEdit,
  Trash2,
  Upload,
  Download,
  RefreshCw,
  ArrowRight,
} from "lucide-react";
import { getSyncHistoryAction } from "@/lib/google-drive-actions";
import { cn } from "@/lib/utils";

import { SyncLogAction, SyncLogStatus } from "@prisma/client";

interface SyncLogEntry {
  id: string;
  action: SyncLogAction;
  itemId?: string | null;
  itemName?: string | null;
  fileId?: string | null;
  fileName?: string | null;
  status: SyncLogStatus;
  error?: string | null;
  duration?: number | null;
  createdAt: Date;
}

const ACTION_ICONS: Record<SyncLogAction, React.ElementType> = {
  [SyncLogAction.CREATE]: FolderPlus,
  [SyncLogAction.RENAME]: FileEdit,
  [SyncLogAction.DELETE]: Trash2,
  [SyncLogAction.MOVE]: ArrowRight,
  [SyncLogAction.UPLOAD]: Upload,
  [SyncLogAction.DOWNLOAD]: Download,
  [SyncLogAction.SYNC]: RefreshCw,
};

const ACTION_LABELS: Record<SyncLogAction, string> = {
  [SyncLogAction.CREATE]: "Created",
  [SyncLogAction.RENAME]: "Renamed",
  [SyncLogAction.DELETE]: "Deleted",
  [SyncLogAction.MOVE]: "Moved",
  [SyncLogAction.UPLOAD]: "Uploaded",
  [SyncLogAction.DOWNLOAD]: "Downloaded",
  [SyncLogAction.SYNC]: "Synced",
};

/**
 * Displays recent sync history with status indicators.
 */
export function SyncHistory() {
  const [logs, setLogs] = useState<SyncLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadHistory() {
      const result = await getSyncHistoryAction();
      if (result.success && result.logs) {
        setLogs(result.logs);
      } else {
        setError(result.error || "Failed to load sync history");
      }
      setLoading(false);
    }
    loadHistory();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCw className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-4 text-center text-sm text-muted-foreground">
        {error}
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="py-4 text-center text-sm text-muted-foreground">
        No sync activity yet
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {logs.map((log) => {
        const Icon = ACTION_ICONS[log.action] || RefreshCw;
        const label = ACTION_LABELS[log.action] || log.action;
        const name = log.itemName || log.fileName || "Unknown";
        const isSuccess = log.status === SyncLogStatus.SUCCESS;
        const isFailed = log.status === SyncLogStatus.FAILED;

        return (
          <div
            key={log.id}
            className={cn(
              "flex items-start gap-3 rounded-lg border p-3",
              isFailed && "border-destructive/50 bg-destructive/5"
            )}
          >
            <div
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-full",
                isSuccess && "bg-green-500/10 text-green-600",
                isFailed && "bg-destructive/10 text-destructive",
                !isSuccess && !isFailed && "bg-muted text-muted-foreground"
              )}
            >
              <Icon className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-medium">{name}</span>
                {isSuccess && (
                  <CheckCircle2 className="size-3.5 shrink-0 text-green-600" />
                )}
                {isFailed && (
                  <XCircle className="size-3.5 shrink-0 text-destructive" />
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{label}</span>
                <span>·</span>
                <span>
                  {formatDistanceToNow(new Date(log.createdAt), {
                    addSuffix: true,
                  })}
                </span>
                {log.duration && (
                  <>
                    <span>·</span>
                    <span>{log.duration}ms</span>
                  </>
                )}
              </div>
              {isFailed && log.error && (
                <p className="mt-1 text-xs text-destructive">{log.error}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/components/sync-history.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add components/google-drive/sync-history.tsx tests/unit/components/sync-history.test.tsx
git commit -m "$(cat <<'EOF'
feat(ui): add SyncHistory component for recent activity

Shows recent sync operations with status icons, timestamps,
and error messages for failed operations.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task A6: Add Sync History to Settings Dialog

**Files:**

- Modify: `components/google-drive/settings-section.tsx`

**Step 1: Add collapsible sync history section**

```typescript
import { SyncHistory } from "@/components/google-drive/sync-history";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";

// Inside the connected state, after storage section:
<Collapsible className="border-t">
  <CollapsibleTrigger className="flex w-full items-center justify-between p-3 text-sm font-medium hover:bg-muted/50">
    Recent Activity
    <ChevronDown className="size-4 transition-transform duration-200 [[data-state=open]>svg&]:rotate-180" />
  </CollapsibleTrigger>
  <CollapsibleContent className="px-3 pb-3">
    <SyncHistory />
  </CollapsibleContent>
</Collapsible>
```

**Step 2: Commit**

```bash
git add components/google-drive/settings-section.tsx
git commit -m "$(cat <<'EOF'
feat(settings): add sync history section to Drive settings

Collapsible "Recent Activity" panel shows last 20 sync operations.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Part B: Offline Queue (Client-Side)

### Task B1: Install idb Library

**Step 1: Install dependency**

Run: `pnpm add idb`

**Step 2: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
chore(deps): add idb for IndexedDB offline queue

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task B2: Create Sync Queue Store

**Files:**

- Create: `lib/sync-queue.ts`
- Test: `tests/unit/lib/sync-queue.test.ts`

**Step 1: Write the failing test**

Create `tests/unit/lib/sync-queue.test.ts`:

```typescript
/**
 * Unit tests for sync queue (IndexedDB).
 * Uses fake-indexeddb for testing.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import "fake-indexeddb/auto";
import {
  queueOperation,
  getQueuedOperations,
  removeFromQueue,
  updateQueuedOperation,
  getPendingCount,
  clearQueue,
  isQueueAvailable,
  checkIndexedDBAvailability,
  PendingOperation,
} from "@/lib/sync-queue";

vi.mock("@/lib/logger", () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe("sync-queue", () => {
  beforeEach(async () => {
    // Clear IndexedDB between tests
    const dbs = await indexedDB.databases();
    for (const db of dbs) {
      if (db.name) indexedDB.deleteDatabase(db.name);
    }
    // Reset availability cache
    vi.resetModules();
  });

  describe("queueOperation", () => {
    it("adds operation to queue and returns ID", async () => {
      const op: Omit<PendingOperation, "id" | "createdAt"> = {
        type: "create",
        payload: { name: "Test Folder", parentId: null },
        attempts: 0,
        lastAttempt: null,
        error: null,
      };

      const id = await queueOperation(op);

      expect(id).toBeTruthy();
      const queued = await getQueuedOperations();
      expect(queued).toHaveLength(1);
      expect(queued[0].type).toBe("create");
    });

    it("enforces maximum queue size", async () => {
      // Queue up to the limit
      for (let i = 0; i < 100; i++) {
        await queueOperation({
          type: "create",
          payload: { name: `Item ${i}` },
          attempts: 0,
          lastAttempt: null,
          error: null,
        });
      }

      // This should fail due to queue being full
      const result = await queueOperation({
        type: "create",
        payload: { name: "Over limit" },
        attempts: 0,
        lastAttempt: null,
        error: null,
      });

      expect(result).toBeNull();
      const count = await getPendingCount();
      expect(count).toBe(100);
    });
  });

  describe("getQueuedOperations", () => {
    it("returns operations sorted by createdAt", async () => {
      await queueOperation({
        type: "create",
        payload: { name: "A" },
        attempts: 0,
        lastAttempt: null,
        error: null,
      });
      await queueOperation({
        type: "rename",
        payload: { name: "B" },
        attempts: 0,
        lastAttempt: null,
        error: null,
      });

      const ops = await getQueuedOperations();

      expect(ops).toHaveLength(2);
      expect(ops[0].type).toBe("create"); // First in, first out
    });
  });

  describe("removeFromQueue", () => {
    it("removes operation by id", async () => {
      const id = await queueOperation({
        type: "delete",
        payload: {},
        attempts: 0,
        lastAttempt: null,
        error: null,
      });

      await removeFromQueue(id!);

      const ops = await getQueuedOperations();
      expect(ops).toHaveLength(0);
    });
  });

  describe("updateQueuedOperation", () => {
    it("updates attempts and error atomically", async () => {
      const id = await queueOperation({
        type: "upload",
        payload: {},
        attempts: 0,
        lastAttempt: null,
        error: null,
      });

      await updateQueuedOperation(id!, {
        attempts: 1,
        lastAttempt: new Date(),
        error: "Network error",
      });

      const ops = await getQueuedOperations();
      expect(ops[0].attempts).toBe(1);
      expect(ops[0].error).toBe("Network error");
    });
  });

  describe("getPendingCount", () => {
    it("returns correct count", async () => {
      expect(await getPendingCount()).toBe(0);

      await queueOperation({
        type: "create",
        payload: {},
        attempts: 0,
        lastAttempt: null,
        error: null,
      });
      await queueOperation({
        type: "delete",
        payload: {},
        attempts: 0,
        lastAttempt: null,
        error: null,
      });

      expect(await getPendingCount()).toBe(2);
    });
  });

  describe("clearQueue", () => {
    it("removes all operations", async () => {
      await queueOperation({
        type: "create",
        payload: {},
        attempts: 0,
        lastAttempt: null,
        error: null,
      });
      await queueOperation({
        type: "delete",
        payload: {},
        attempts: 0,
        lastAttempt: null,
        error: null,
      });

      await clearQueue();

      expect(await getPendingCount()).toBe(0);
    });
  });

  describe("isQueueAvailable", () => {
    it("returns true when IndexedDB is available", async () => {
      const available = await isQueueAvailable();
      expect(available).toBe(true);
    });
  });
});

describe("sync-queue graceful degradation", () => {
  let originalIndexedDB: IDBFactory;

  beforeEach(() => {
    originalIndexedDB = globalThis.indexedDB;
  });

  afterEach(() => {
    globalThis.indexedDB = originalIndexedDB;
    vi.resetModules();
  });

  it("returns null/empty when IndexedDB is unavailable", async () => {
    // Simulate IndexedDB being undefined (like in SSR)
    // @ts-expect-error - intentionally testing unavailability
    delete globalThis.indexedDB;

    // Re-import to get fresh module state
    const { queueOperation, getQueuedOperations, getPendingCount } =
      await import("@/lib/sync-queue");

    const id = await queueOperation({
      type: "create",
      payload: {},
      attempts: 0,
      lastAttempt: null,
      error: null,
    });

    expect(id).toBeNull();
    expect(await getQueuedOperations()).toEqual([]);
    expect(await getPendingCount()).toBe(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/lib/sync-queue.test.ts`
Expected: FAIL - module doesn't exist

**Step 3: Write minimal implementation**

Create `lib/sync-queue.ts`:

```typescript
/**
 * Client-side sync queue using IndexedDB.
 * Stores failed operations for retry when online.
 * Includes graceful degradation when IndexedDB is unavailable.
 */

import { openDB, DBSchema, IDBPDatabase } from "idb";
import { logger } from "@/lib/logger";

/** Operation types that can be queued */
export type OperationType = "create" | "rename" | "delete" | "move" | "upload";

/** A pending sync operation */
export interface PendingOperation {
  id: string;
  type: OperationType;
  payload: Record<string, unknown>;
  attempts: number;
  lastAttempt: Date | null;
  error: string | null;
  createdAt: Date;
}

interface SyncQueueDB extends DBSchema {
  operations: {
    key: string;
    value: PendingOperation;
    indexes: { "by-created": Date };
  };
}

const DB_NAME = "canoncore-sync-queue";
const DB_VERSION = 1;
const MAX_QUEUE_SIZE = 100;

let dbPromise: Promise<IDBPDatabase<SyncQueueDB>> | null = null;
let isIndexedDBAvailable: boolean | null = null;

/**
 * Checks if IndexedDB is available in the current environment.
 * Handles private browsing, SSR, and unsupported browsers.
 */
export async function checkIndexedDBAvailability(): Promise<boolean> {
  if (isIndexedDBAvailable !== null) {
    return isIndexedDBAvailable;
  }

  // Not available in SSR
  if (typeof window === "undefined" || typeof indexedDB === "undefined") {
    isIndexedDBAvailable = false;
    return false;
  }

  try {
    // Test if we can actually open a database (fails in some private modes)
    const testDb = await openDB("__idb_test__", 1, {
      upgrade(db) {
        db.createObjectStore("test");
      },
    });
    testDb.close();
    await indexedDB.deleteDatabase("__idb_test__");
    isIndexedDBAvailable = true;
    return true;
  } catch (error) {
    logger.warn(
      { err: error },
      "[SyncQueue] IndexedDB not available (private browsing or unsupported)"
    );
    isIndexedDBAvailable = false;
    return false;
  }
}

/**
 * Gets the IndexedDB database instance.
 * Returns null if IndexedDB is unavailable.
 */
async function getDB(): Promise<IDBPDatabase<SyncQueueDB> | null> {
  const available = await checkIndexedDBAvailability();
  if (!available) {
    return null;
  }

  if (!dbPromise) {
    dbPromise = openDB<SyncQueueDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const store = db.createObjectStore("operations", { keyPath: "id" });
        store.createIndex("by-created", "createdAt");
      },
      blocked() {
        logger.warn("[SyncQueue] Database blocked by older version");
      },
      blocking() {
        logger.warn("[SyncQueue] Database blocking newer version");
      },
      terminated() {
        logger.error("[SyncQueue] Database connection terminated unexpectedly");
        dbPromise = null; // Reset so we can try again
      },
    });
  }

  try {
    return await dbPromise;
  } catch (error) {
    logger.error({ err: error }, "[SyncQueue] Failed to open database");
    dbPromise = null;
    return null;
  }
}

/**
 * Generates a unique ID for queue entries.
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Adds an operation to the queue.
 * Returns null if IndexedDB is unavailable (graceful degradation).
 *
 * @param operation - Operation details (without id/createdAt)
 * @returns The generated operation ID, or null if queuing failed
 */
export async function queueOperation(
  operation: Omit<PendingOperation, "id" | "createdAt">
): Promise<string | null> {
  const db = await getDB();
  if (!db) {
    logger.warn(
      { type: operation.type },
      "[SyncQueue] Cannot queue operation - IndexedDB unavailable"
    );
    return null;
  }

  try {
    // Check queue size limit
    const currentCount = await db.count("operations");
    if (currentCount >= MAX_QUEUE_SIZE) {
      logger.warn(
        { count: currentCount, max: MAX_QUEUE_SIZE },
        "[SyncQueue] Queue full, rejecting new operation"
      );
      return null;
    }

    const id = generateId();
    const entry: PendingOperation = {
      ...operation,
      id,
      createdAt: new Date(),
    };
    await db.put("operations", entry);
    return id;
  } catch (error) {
    logger.error({ err: error }, "[SyncQueue] Failed to queue operation");
    return null;
  }
}

/**
 * Gets all queued operations, oldest first.
 * Returns empty array if IndexedDB is unavailable.
 */
export async function getQueuedOperations(): Promise<PendingOperation[]> {
  const db = await getDB();
  if (!db) {
    return [];
  }

  try {
    return await db.getAllFromIndex("operations", "by-created");
  } catch (error) {
    logger.error({ err: error }, "[SyncQueue] Failed to get operations");
    return [];
  }
}

/**
 * Removes an operation from the queue.
 *
 * @param id - The operation ID to remove
 */
export async function removeFromQueue(id: string): Promise<void> {
  const db = await getDB();
  if (!db) return;

  try {
    await db.delete("operations", id);
  } catch (error) {
    logger.error({ err: error, id }, "[SyncQueue] Failed to remove operation");
  }
}

/**
 * Updates a queued operation (e.g., increment attempts, set error).
 *
 * @param id - The operation ID
 * @param updates - Fields to update
 */
export async function updateQueuedOperation(
  id: string,
  updates: Partial<Pick<PendingOperation, "attempts" | "lastAttempt" | "error">>
): Promise<void> {
  const db = await getDB();
  if (!db) return;

  try {
    const tx = db.transaction("operations", "readwrite");
    const existing = await tx.store.get(id);
    if (existing) {
      await tx.store.put({ ...existing, ...updates });
    }
    await tx.done;
  } catch (error) {
    logger.error({ err: error, id }, "[SyncQueue] Failed to update operation");
  }
}

/**
 * Gets the count of pending operations.
 * Returns 0 if IndexedDB is unavailable.
 */
export async function getPendingCount(): Promise<number> {
  const db = await getDB();
  if (!db) return 0;

  try {
    return await db.count("operations");
  } catch (error) {
    logger.error({ err: error }, "[SyncQueue] Failed to count operations");
    return 0;
  }
}

/**
 * Clears all queued operations.
 * Use with caution - for testing or user-initiated clear.
 */
export async function clearQueue(): Promise<void> {
  const db = await getDB();
  if (!db) return;

  try {
    await db.clear("operations");
  } catch (error) {
    logger.error({ err: error }, "[SyncQueue] Failed to clear queue");
  }
}

/**
 * Checks if the sync queue is available.
 * Use this to conditionally show queue-related UI.
 */
export async function isQueueAvailable(): Promise<boolean> {
  return checkIndexedDBAvailability();
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/lib/sync-queue.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/sync-queue.ts tests/unit/lib/sync-queue.test.ts
git commit -m "$(cat <<'EOF'
feat(sync): add IndexedDB sync queue for offline operations

Stores failed sync operations locally for retry when online.
Supports create, rename, delete, move, and upload operations.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task B3: Create Queue Processor

**Files:**

- Create: `lib/sync-queue-processor.ts`
- Test: `tests/unit/lib/sync-queue-processor.test.ts`

**Step 1: Write the failing test**

Create `tests/unit/lib/sync-queue-processor.test.ts`:

```typescript
/**
 * Unit tests for sync queue processor.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import "fake-indexeddb/auto";
import {
  processQueue,
  startQueueProcessor,
  stopQueueProcessor,
  calculateBackoff,
  MAX_RETRY_ATTEMPTS,
  BACKOFF_BASE_MS,
  MAX_BACKOFF_MS,
} from "@/lib/sync-queue-processor";
import {
  queueOperation,
  getQueuedOperations,
  clearQueue,
  OperationType,
} from "@/lib/sync-queue";
import * as driveActions from "@/lib/google-drive-actions";

vi.mock("@/lib/google-drive-actions", () => ({
  createItemInDrive: vi.fn(),
  renameItemInDrive: vi.fn(),
  deleteItemInDrive: vi.fn(),
  moveItemInDrive: vi.fn(),
  uploadFileToDrive: vi.fn(),
}));

vi.mock("@/lib/circuit-breaker", () => ({
  withCircuitBreaker: vi.fn((fn) => fn),
}));

describe("sync-queue-processor", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await clearQueue();
    vi.useFakeTimers();
  });

  afterEach(() => {
    stopQueueProcessor();
    vi.useRealTimers();
  });

  describe("calculateBackoff", () => {
    it("calculates exponential backoff", () => {
      expect(calculateBackoff(0)).toBe(BACKOFF_BASE_MS); // 1000ms
      expect(calculateBackoff(1)).toBe(BACKOFF_BASE_MS * 2); // 2000ms
      expect(calculateBackoff(2)).toBe(BACKOFF_BASE_MS * 4); // 4000ms
      expect(calculateBackoff(3)).toBe(BACKOFF_BASE_MS * 8); // 8000ms
    });

    it("caps at maximum backoff", () => {
      expect(calculateBackoff(10)).toBe(MAX_BACKOFF_MS); // 60000ms cap
    });
  });

  describe("processQueue", () => {
    it("processes pending operations successfully", async () => {
      vi.mocked(driveActions.createItemInDrive).mockResolvedValue({
        success: true,
        item: { id: "item-1" },
      });

      await queueOperation({
        type: "create",
        payload: { name: "Test", parentId: null, userId: "user-1" },
        attempts: 0,
        lastAttempt: null,
        error: null,
      });

      await processQueue();

      const remaining = await getQueuedOperations();
      expect(remaining).toHaveLength(0);
      expect(driveActions.createItemInDrive).toHaveBeenCalled();
    });

    it("increments attempts on failure", async () => {
      vi.mocked(driveActions.createItemInDrive).mockRejectedValue(
        new Error("Network error")
      );

      await queueOperation({
        type: "create",
        payload: { name: "Test", userId: "user-1" },
        attempts: 0,
        lastAttempt: null,
        error: null,
      });

      await processQueue();

      const ops = await getQueuedOperations();
      expect(ops).toHaveLength(1);
      expect(ops[0].attempts).toBe(1);
      expect(ops[0].error).toBe("Network error");
    });

    it("removes operations after max retries exceeded", async () => {
      await queueOperation({
        type: "create",
        payload: { name: "Test", userId: "user-1" },
        attempts: MAX_RETRY_ATTEMPTS,
        lastAttempt: new Date(),
        error: "Previous error",
      });

      await processQueue();

      const ops = await getQueuedOperations();
      expect(ops).toHaveLength(0);
    });

    it("respects backoff timing", async () => {
      const recentAttempt = new Date();

      await queueOperation({
        type: "create",
        payload: { name: "Test", userId: "user-1" },
        attempts: 2,
        lastAttempt: recentAttempt,
        error: "Previous error",
      });

      await processQueue();

      // Should not process yet due to backoff
      expect(driveActions.createItemInDrive).not.toHaveBeenCalled();
    });

    it("processes multiple operations sequentially", async () => {
      vi.mocked(driveActions.createItemInDrive).mockResolvedValue({ success: true });
      vi.mocked(driveActions.renameItemInDrive).mockResolvedValue({ success: true });

      await queueOperation({
        type: "create",
        payload: { name: "First", userId: "user-1" },
        attempts: 0,
        lastAttempt: null,
        error: null,
      });
      await queueOperation({
        type: "rename",
        payload: { itemId: "item-1", name: "Second", userId: "user-1" },
        attempts: 0,
        lastAttempt: null,
        error: null,
      });

      await processQueue();

      expect(driveActions.createItemInDrive).toHaveBeenCalled();
      expect(driveActions.renameItemInDrive).toHaveBeenCalled();
    });
  });

  describe("startQueueProcessor", () => {
    it("starts processing on online event", async () => {
      vi.mocked(driveActions.createItemInDrive).mockResolvedValue({ success: true });

      await queueOperation({
        type: "create",
        payload: { name: "Test", userId: "user-1" },
        attempts: 0,
        lastAttempt: null,
        error: null,
      });

      startQueueProcessor();

      // Simulate coming online
      window.dispatchEvent(new Event("online"));
      await vi.advanceTimersByTimeAsync(100);

      expect(driveActions.createItemInDrive).toHaveBeenCalled();
    });

    it("processes on interval when online", async () => {
      vi.mocked(driveActions.createItemInDrive).mockResolvedValue({ success: true });
      vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);

      startQueueProcessor();

      await queueOperation({
        type: "create",
        payload: { name: "Test", userId: "user-1" },
        attempts: 0,
        lastAttempt: null,
        error: null,
      });

      // Advance past the interval (30 seconds)
      await vi.advanceTimersByTimeAsync(30000);

      expect(driveActions.createItemInDrive).toHaveBeenCalled();
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/lib/sync-queue-processor.test.ts`
Expected: FAIL - module doesn't exist

**Step 3: Write complete implementation**

Create `lib/sync-queue-processor.ts`:

```typescript
/**
 * Queue processor for retrying failed sync operations.
 * Integrates with circuit breaker and respects rate limits.
 */

import {
  getQueuedOperations,
  removeFromQueue,
  updateQueuedOperation,
  PendingOperation,
  OperationType,
} from "@/lib/sync-queue";
import {
  createItemInDrive,
  renameItemInDrive,
  deleteItemInDrive,
  uploadFileToDrive,
} from "@/lib/google-drive-actions";
import { withCircuitBreaker } from "@/lib/circuit-breaker";
import { logSyncOperation, SyncLogAction, SyncLogStatus } from "@/lib/sync-log";
import { logger } from "@/lib/logger";

// Configuration constants
export const MAX_RETRY_ATTEMPTS = 5;
export const BACKOFF_BASE_MS = 1000; // 1 second
export const MAX_BACKOFF_MS = 60000; // 1 minute
export const PROCESS_INTERVAL_MS = 30000; // 30 seconds
export const MAX_QUEUE_SIZE = 100;

/** Processor state */
let processorInterval: ReturnType<typeof setInterval> | null = null;
let isProcessing = false;

/**
 * Calculates exponential backoff delay with jitter.
 *
 * @param attempts - Number of previous attempts
 * @returns Delay in milliseconds
 */
export function calculateBackoff(attempts: number): number {
  const exponentialDelay = BACKOFF_BASE_MS * Math.pow(2, attempts);
  const jitter = Math.random() * 0.1 * exponentialDelay; // 10% jitter
  return Math.min(exponentialDelay + jitter, MAX_BACKOFF_MS);
}

/**
 * Maps operation types to their handler functions.
 */
const OPERATION_HANDLERS: Record<
  OperationType,
  (payload: Record<string, unknown>) => Promise<{ success: boolean }>
> = {
  create: async (payload) =>
    createItemInDrive({
      name: payload.name as string,
      parentId: payload.parentId as string | null,
      userId: payload.userId as string,
    }),
  rename: async (payload) =>
    renameItemInDrive({
      itemId: payload.itemId as string,
      name: payload.name as string,
      userId: payload.userId as string,
    }),
  delete: async (payload) =>
    deleteItemInDrive({
      itemId: payload.itemId as string,
      userId: payload.userId as string,
    }),
  move: async (payload) =>
    // Move is typically a rename with parent change
    renameItemInDrive({
      itemId: payload.itemId as string,
      parentId: payload.newParentId as string,
      userId: payload.userId as string,
    }),
  upload: async (payload) =>
    uploadFileToDrive({
      file: payload.file as File,
      itemId: payload.itemId as string,
      userId: payload.userId as string,
    }),
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
 * Checks if an operation is ready for retry based on backoff.
 */
function isReadyForRetry(operation: PendingOperation): boolean {
  if (!operation.lastAttempt) return true;

  const backoffMs = calculateBackoff(operation.attempts);
  const nextAttemptTime =
    new Date(operation.lastAttempt).getTime() + backoffMs;

  return Date.now() >= nextAttemptTime;
}

/**
 * Processes a single queued operation.
 */
async function processOperation(operation: PendingOperation): Promise<void> {
  const handler = OPERATION_HANDLERS[operation.type];

  if (!handler) {
    logger.error(
      { type: operation.type },
      "[QueueProcessor] Unknown operation type"
    );
    await removeFromQueue(operation.id);
    return;
  }

  try {
    // Use circuit breaker for external calls
    const result = await withCircuitBreaker(() => handler(operation.payload));

    if (result.success) {
      // Success - remove from queue and log
      await removeFromQueue(operation.id);

      const userId = operation.payload.userId as string;
      if (userId) {
        await logSyncOperation({
          userId,
          action: OPERATION_TO_LOG_ACTION[operation.type],
          itemId: operation.payload.itemId as string,
          itemName: operation.payload.name as string,
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
      // Max retries exceeded - remove and log failure
      await removeFromQueue(operation.id);

      const userId = operation.payload.userId as string;
      if (userId) {
        await logSyncOperation({
          userId,
          action: OPERATION_TO_LOG_ACTION[operation.type],
          itemId: operation.payload.itemId as string,
          itemName: operation.payload.name as string,
          status: SyncLogStatus.FAILED,
          error: `Max retries exceeded: ${errorMessage}`,
        });
      }

      logger.warn(
        { type: operation.type, attempts: newAttempts },
        "[QueueProcessor] Max retries exceeded, removing operation"
      );
    } else {
      // Update for retry
      await updateQueuedOperation(operation.id, {
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
  // Prevent concurrent processing
  if (isProcessing) {
    logger.debug("[QueueProcessor] Already processing, skipping");
    return;
  }

  // Don't process if offline
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    logger.debug("[QueueProcessor] Offline, skipping");
    return;
  }

  isProcessing = true;

  try {
    const operations = await getQueuedOperations();

    for (const operation of operations) {
      // Check if ready for retry (respects backoff)
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
 * Processes immediately, on interval, and when coming online.
 */
export function startQueueProcessor(): void {
  if (processorInterval) {
    return; // Already running
  }

  // Process immediately if online
  if (typeof navigator !== "undefined" && navigator.onLine) {
    processQueue();
  }

  // Process on interval
  processorInterval = setInterval(processQueue, PROCESS_INTERVAL_MS);

  // Process when coming online
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
 */
export function isProcessorRunning(): boolean {
  return processorInterval !== null;
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/lib/sync-queue-processor.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/sync-queue-processor.ts tests/unit/lib/sync-queue-processor.test.ts
git commit -m "$(cat <<'EOF'
feat(sync): add queue processor with exponential backoff

Processes failed operations from IndexedDB queue with:
- Exponential backoff with jitter (1s base, 60s max)
- Max 5 retry attempts before permanent failure
- Circuit breaker integration for resilience
- Sequential processing to avoid race conditions
- Auto-trigger on online event and 30s interval

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task B4: Create Pending Changes Indicator

**Files:**

- Create: `components/google-drive/pending-indicator.tsx`
- Test: `tests/unit/components/pending-indicator.test.tsx`

**Step 1: Write the failing test**

```typescript
describe("PendingIndicator", () => {
  it("shows count of pending operations", async () => {
    vi.mocked(getPendingCount).mockResolvedValue(3);

    render(<PendingIndicator />);

    await waitFor(() => {
      expect(screen.getByText("3 pending")).toBeInTheDocument();
    });
  });

  it("hides when no pending operations", async () => {
    vi.mocked(getPendingCount).mockResolvedValue(0);

    const { container } = render(<PendingIndicator />);

    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });
});
```

**Step 2-5:** TDD cycle, implement component, commit

---

### Task B5: Add Online/Offline Detection

**Files:**

- Create: `hooks/use-online-status.ts`
- Test: `tests/unit/hooks/use-online-status.test.ts`

**Step 1: Write the failing test**

```typescript
describe("useOnlineStatus", () => {
  it("returns true when online", () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);

    const { result } = renderHook(() => useOnlineStatus());

    expect(result.current).toBe(true);
  });

  it("updates when going offline", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);

    const { result } = renderHook(() => useOnlineStatus());

    // Simulate going offline
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    window.dispatchEvent(new Event("offline"));

    await waitFor(() => {
      expect(result.current).toBe(false);
    });
  });
});
```

**Step 2-5:** TDD cycle, implement hook, commit

---

### Task B6: Integrate Queue with Server Actions

**Files:**

- Modify: `lib/google-drive-actions.ts`

Add queue fallback to operations that fail due to network errors:

```typescript
export async function createItem(params: CreateItemParams) {
  try {
    // ... existing logic
  } catch (error) {
    // If network error and queue available, add to offline queue
    if (isNetworkError(error) && typeof window !== "undefined") {
      await queueOperation({
        type: "create",
        payload: params,
        attempts: 0,
        lastAttempt: null,
        error: null,
      });
      return {
        success: false,
        queued: true,
        error: "Saved for retry when online",
      };
    }
    throw error;
  }
}
```

---

## Part C: E2E Tests

### Task C1: E2E Test for Sync History

**Files:**

- Modify: `e2e/journeys/google-drive/drive-sync.spec.ts`

```typescript
test("shows sync history after operations", async ({ page, testUser }) => {
  // Create an item (triggers sync log)
  await itemsPage.createItem("E2E Sync History Test");

  // Open settings
  await page.getByRole("button", { name: /settings/i }).click();

  // Expand Recent Activity
  await page.getByRole("button", { name: /recent activity/i }).click();

  // Verify history shows the create operation
  await expect(page.getByText("E2E Sync History Test")).toBeVisible();
  await expect(page.getByText("Created")).toBeVisible();
});
```

---

## Testing Summary

### New Tests

| Type | File                                               | Tests                                        |
| ---- | -------------------------------------------------- | -------------------------------------------- |
| Unit | `tests/unit/lib/sync-log.test.ts`                  | Sync logging utilities (10 tests)            |
| Unit | `tests/unit/lib/sync-queue.test.ts`                | IndexedDB queue (10 tests)                   |
| Unit | `tests/unit/lib/sync-queue-processor.test.ts`      | Queue processor (8 tests)                    |
| Unit | `tests/unit/components/sync-history.test.tsx`      | Sync history UI (3 tests)                    |
| Unit | `tests/unit/components/pending-indicator.test.tsx` | Pending indicator (2 tests)                  |
| Unit | `tests/unit/hooks/use-online-status.test.ts`       | Online status hook (2 tests)                 |
| Unit | `tests/unit/lib/google-drive-actions.test.ts`      | Sync logging integration (3 tests)           |
| E2E  | `e2e/journeys/google-drive/drive-sync.spec.ts`     | Sync history display (1 test)                |

**Total new tests: ~39**

### Test Coverage Details

**sync-log.test.ts (10 tests):**
- sanitizeErrorMessage: removes bearer tokens, API keys, paths, truncates
- logSyncOperation: creates entry with ID, sanitizes errors, returns null on failure
- logSyncOperationsBatch: creates in transaction, handles empty input
- getSyncHistory: returns logs, filters by status
- cleanupOldSyncLogs: deletes old entries

**sync-queue.test.ts (10 tests):**
- queueOperation: adds with ID, enforces max size
- getQueuedOperations: sorted by createdAt
- removeFromQueue: removes by ID
- updateQueuedOperation: atomic updates
- getPendingCount: correct count
- clearQueue: removes all
- isQueueAvailable: returns availability
- graceful degradation: returns null when IndexedDB unavailable

**sync-queue-processor.test.ts (8 tests):**
- calculateBackoff: exponential, caps at max
- processQueue: processes successfully, increments on failure, removes after max retries, respects backoff, processes sequentially
- startQueueProcessor: online event, interval processing

### Existing Tests - Updates Needed

| File                                          | Change                                          |
| --------------------------------------------- | ----------------------------------------------- |
| `tests/unit/lib/google-drive-actions.test.ts` | Add mocks for `logSyncOperation`, `SyncLogAction`, `SyncLogStatus` |

### Test Dependencies

```bash
# Install test dependencies
pnpm add -D fake-indexeddb
```

---

## Final Checklist

### Sync History (Server-Side)

- [ ] SyncLogAction enum added to schema
- [ ] SyncLogStatus enum added to schema
- [ ] SyncLog Prisma model created with proper indexes
- [ ] Sync logging utilities implemented with:
  - [ ] logSyncOperation (returns ID)
  - [ ] logSyncOperationsBatch (transaction support)
  - [ ] sanitizeErrorMessage (security)
  - [ ] cleanupOldSyncLogs (retention)
- [ ] Logging integrated into Drive actions
- [ ] getSyncHistoryAction server action
- [ ] SyncHistory UI component
- [ ] Sync history collapsible in Settings dialog

### Offline Queue (Client-Side)

- [ ] idb library installed
- [ ] IndexedDB sync queue store with:
  - [ ] Graceful degradation when unavailable
  - [ ] Queue size limit (100 operations)
  - [ ] Availability check function
- [ ] Queue processor with:
  - [ ] Exponential backoff with jitter
  - [ ] Max 5 retry attempts
  - [ ] Circuit breaker integration
  - [ ] Sequential processing
  - [ ] Online event trigger
  - [ ] 30-second interval processing
- [ ] PendingIndicator component
- [ ] useOnlineStatus hook
- [ ] Queue integration in server actions

### Security

- [ ] Error message sanitization implemented
- [ ] Payload contains only IDs/names (no credentials)
- [ ] Data retention cleanup job ready

### Testing

- [ ] All unit tests passing (~39 new tests)
- [ ] E2E test for sync history
- [ ] fake-indexeddb installed for tests
- [ ] Graceful degradation tested
