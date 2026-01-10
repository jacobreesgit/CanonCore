# SFTP Sync Resilience & Conflict Resolution Design

**Date:** 2026-01-07
**Status:** Draft
**Scope:** Data conflicts, error resilience, user feedback, sync badges, industry-standard features

---

## Problem Summary

The current SFTP sync implementation has several gaps:

| Issue                                       | Impact                                      | Severity |
| ------------------------------------------- | ------------------------------------------- | -------- |
| No transaction wrapping in `syncFromSftp()` | Partial sync on failure, data inconsistency | Critical |
| Manual items ignored during sync            | Duplicates created with same names          | Critical |
| Race condition on concurrent syncs          | Duplicate items from parallel calls         | Critical |
| No path validation in merge                 | Path traversal security risk                | Critical |
| Symlink cycle detection missing             | Infinite loop possible                      | Critical |
| Orphaned items unrecoverable                | Items stuck after connection deleted        | High     |
| Silent depth/entry limits                   | Users unaware sync incomplete               | High     |
| Silent unknown file skips                   | Files missing with no notice                | High     |
| N+1 queries in folder creation              | Performance degradation on large syncs      | High     |
| mtime-only change detection                 | Unreliable with clock skew                  | Medium   |
| No dry-run/preview mode                     | Users can't preview before commit           | Medium   |
| No circuit breaker integration              | Cascade failures possible                   | Medium   |
| No include/exclude filters                  | Can't selectively sync                      | Low      |

---

## Solution Overview

### Core Fixes

1. **Transaction wrapping** with proper isolation level
2. **Conflict detection** for manual items matching SFTP folders
3. **Warning collection** instead of silent skips
4. **Path validation** to prevent traversal attacks
5. **Symlink handling** with cycle detection
6. **Circuit breaker** integration for resilience

### New Features

7. **SyncDialog component** with results, conflicts, warnings
8. **Dry-run/preview mode** before committing changes
9. **Sync badges** on tree/grid views
10. **Include/exclude filters** for selective sync
11. **Progress tracking** with item counts
12. **Batch operations** for performance

### Cleanup

13. **Orphaned item cleanup** on connection delete
14. **Connection health check** before sync

---

## Data Model

### Schema Changes

No migrations needed. Existing fields used for state detection:

```
Manual items:   connectionId = null AND sftpPath = null
Synced items:   connectionId != null AND sftpPath != null
Orphaned items: connectionId = null AND sftpPath != null (cleaned on delete)
```

### New Types (`lib/types.ts`)

```typescript
/** Conflict when manual item matches SFTP folder */
interface SyncConflict {
  manualItemId: string;
  manualItemName: string;
  sftpPath: string;
  parentPath: string;
  /** Number of children in manual item */
  manualChildCount: number;
  /** Number of children in SFTP folder */
  sftpChildCount: number;
}

/** Warning types for sync issues */
type SyncWarningType =
  | "depth_limit"
  | "max_entries"
  | "unknown_file"
  | "inaccessible_dir"
  | "symlink_skipped"
  | "symlink_cycle"
  | "permission_denied"
  | "invalid_filename";

/** Warning for non-fatal sync issues */
interface SyncWarning {
  type: SyncWarningType;
  path: string;
  message: string;
}

/** Statistics for sync operation */
interface SyncStats {
  itemsCreated: number;
  itemsUpdated: number;
  itemsDeleted: number;
  filesCreated: number;
  filesUpdated: number;
  filesDeleted: number;
  /** Total bytes of new files */
  bytesAdded: bigint;
}

/** Preview of what sync would do (dry-run) */
interface SyncPreview {
  stats: SyncStats;
  conflicts: SyncConflict[];
  warnings: SyncWarning[];
  /** Items that would be created */
  itemsToCreate: Array<{ name: string; path: string; depth: number }>;
  /** Items that would be deleted */
  itemsToDelete: Array<{ name: string; path: string }>;
}

/** Full sync result with all details */
interface SyncResultWithConflicts {
  stats: SyncStats;
  conflicts: SyncConflict[];
  warnings: SyncWarning[];
  /** Duration in milliseconds */
  durationMs: number;
  /** Whether sync was a dry-run */
  isDryRun: boolean;
}

/** Filter configuration for selective sync */
interface SyncFilter {
  /** Glob patterns to include (e.g., "Movies/**", "*.mp4") */
  include?: string[];
  /** Glob patterns to exclude (e.g., "*.tmp", ".DS_Store") */
  exclude?: string[];
  /** Maximum depth to sync (overrides default 10) */
  maxDepth?: number;
}
```

---

## Security Hardening

### Path Traversal Prevention

```typescript
// lib/sftp-utils.ts - Add new validation function

/**
 * Validates that an SFTP path is within the connection's base path.
 * Prevents path traversal attacks via "../" sequences.
 */
export function validatePathWithinBase(
  sftpPath: string,
  basePath: string
): boolean {
  // Normalize paths (resolve .. and .)
  const normalizedPath = path.posix.normalize(sftpPath);
  const normalizedBase = path.posix.normalize(basePath);

  // Ensure path starts with base
  if (!normalizedPath.startsWith(normalizedBase)) {
    return false;
  }

  // Check for null bytes (can bypass checks in some systems)
  if (sftpPath.includes("\0")) {
    return false;
  }

  return true;
}

/**
 * Validates filename for safety.
 * Extended from existing validateFileName to catch more edge cases.
 */
export function validateFileNameStrict(name: string): void {
  // Existing checks...
  validateFileName(name);

  // Additional checks
  if (name.includes("\0")) {
    throw new Error("Filename contains null byte");
  }
  if (name.startsWith("-")) {
    throw new Error("Filename starts with dash (potential command injection)");
  }
  if (/[<>:"|?*]/.test(name)) {
    throw new Error("Filename contains invalid characters");
  }
  // Check for excessive length
  if (Buffer.byteLength(name, "utf8") > 255) {
    throw new Error("Filename exceeds 255 bytes");
  }
}
```

### Input Validation in Merge

```typescript
// In mergeManualItemWithSftp - add validation

export async function mergeManualItemWithSftp(
  manualItemId: string,
  connectionId: string,
  sftpPath: string
): Promise<ActionResult<{ merged: boolean; filesAdded: number }>> {
  const userId = await requireAuth();

  // Validate IDs (Prisma handles most, but be explicit)
  if (!manualItemId || !connectionId) {
    return { success: false, error: "Invalid parameters" };
  }

  // Get connection first to validate path
  const connection = await prisma.sftpConnection.findFirst({
    where: { id: connectionId, userId },
  });
  if (!connection) {
    return { success: false, error: "Connection not found" };
  }

  // CRITICAL: Validate sftpPath is within connection's basePath
  if (!validatePathWithinBase(sftpPath, connection.basePath)) {
    logger.warn(
      { userId, sftpPath, basePath: connection.basePath },
      "[SFTP] Path traversal attempt blocked"
    );
    return { success: false, error: "Invalid path" };
  }

  // Continue with existing logic...
}
```

---

## Symlink Handling

### Detection and Cycle Prevention

```typescript
// In listRecursive function

/** Track visited paths to detect symlink cycles */
const visitedPaths = new Set<string>();

async function listRecursive(
  dirPath: string,
  depth: number,
  realPath?: string
) {
  // Check for symlink cycles
  const pathKey = realPath || dirPath;
  if (visitedPaths.has(pathKey)) {
    warnings.push({
      type: "symlink_cycle",
      path: dirPath,
      message: `Symlink cycle detected, skipping`,
    });
    return;
  }
  visitedPaths.add(pathKey);

  // Existing depth/entry checks...
  if (depth > maxDepth || remoteEntries.length >= SYNC_MAX_ENTRIES) {
    if (depth > maxDepth) {
      warnings.push({
        type: "depth_limit",
        path: dirPath,
        message: `Exceeds max depth of ${maxDepth}`,
      });
    }
    return;
  }

  let entries;
  try {
    entries = await client.list(dirPath);
  } catch (error) {
    // Handle permission denied specifically
    if (error.message?.includes("Permission denied")) {
      warnings.push({
        type: "permission_denied",
        path: dirPath,
        message: "Permission denied",
      });
    } else {
      warnings.push({
        type: "inaccessible_dir",
        path: dirPath,
        message: error.message,
      });
    }
    return;
  }

  for (const entry of entries) {
    if (entry.name === "." || entry.name === "..") continue;

    const entryPath = `${dirPath}/${entry.name}`.replace(/\/+/g, "/");

    // Handle symlinks
    if (entry.type === "l") {
      // Option 1: Skip symlinks (safer)
      warnings.push({
        type: "symlink_skipped",
        path: entryPath,
        message: "Symlinks are not synced",
      });
      continue;

      // Option 2: Follow symlinks with cycle detection (if needed in future)
      // const realPath = await client.realPath(entryPath);
      // if (visitedPaths.has(realPath)) { ... cycle detected }
    }

    // Continue with regular files/directories...
  }
}
```

---

## Transaction Configuration

### Proper Isolation and Timeout

```typescript
// In syncFromSftp

await prisma.$transaction(
  async (tx) => {
    // All database operations use tx
  },
  {
    // 60s timeout for large syncs
    timeout: 60000,
    // Wait up to 10s for transaction slot
    maxWait: 10000,
    // Serializable prevents phantom reads during conflict detection
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  }
);
```

### Circuit Breaker Integration

```typescript
// lib/sftp-actions.ts - Wrap SFTP operations

import { circuitBreaker } from "@/lib/circuit-breaker";

/**
 * Execute SFTP operation with circuit breaker protection.
 * Prevents cascade failures when SFTP server is unhealthy.
 */
async function withCircuitBreaker<T>(
  connectionId: string,
  operation: () => Promise<T>
): Promise<T> {
  const breakerId = `sftp:${connectionId}`;
  return circuitBreaker.execute(breakerId, operation, {
    failureThreshold: 5,
    recoveryTimeout: 60000, // 60s before retry
    timeout: 30000, // 30s operation timeout
  });
}

// Usage in syncFromSftp:
const client = await withCircuitBreaker(connectionId, () =>
  getConnection(connection)
);
```

---

## Sync Function Refactoring

### Complete `syncFromSftp` Rewrite

```typescript
export async function syncFromSftp(
  connectionId: string,
  options?: {
    skipRevalidate?: boolean;
    dryRun?: boolean;
    filters?: SyncFilter;
  }
): Promise<ActionResult<SyncResultWithConflicts>> {
  const startTime = Date.now();

  try {
    // Rate limit check
    const rateLimitResult = await checkRateLimit("sftpSync");
    if (rateLimitResult) {
      return { success: false, error: rateLimitResult.error };
    }

    const userId = await requireAuth();

    // Get connection
    const connection = await prisma.sftpConnection.findFirst({
      where: { id: connectionId, userId },
    });
    if (!connection) {
      return { success: false, error: "Connection not found" };
    }

    // Connection health check before long operation
    const healthCheck = await testConnectionHealth(connection);
    if (!healthCheck.healthy) {
      return {
        success: false,
        error: `Connection unhealthy: ${healthCheck.error}`,
      };
    }

    // Acquire sync lock
    if (syncLocks.has(connectionId)) {
      return {
        success: false,
        error: "Sync already in progress for this connection",
      };
    }

    const lockPromise = new Promise<void>((resolve) => {
      syncLocks.set(connectionId, { resolve });
    });

    try {
      // Get SFTP connection with circuit breaker
      const client = await withCircuitBreaker(connectionId, () =>
        getConnection(connection)
      );

      const warnings: SyncWarning[] = [];
      const conflicts: SyncConflict[] = [];
      const stats: SyncStats = {
        itemsCreated: 0,
        itemsUpdated: 0,
        itemsDeleted: 0,
        filesCreated: 0,
        filesUpdated: 0,
        filesDeleted: 0,
        bytesAdded: BigInt(0),
      };

      // Parse filters
      const maxDepth = options?.filters?.maxDepth ?? SYNC_MAX_DEPTH;
      const includePatterns = options?.filters?.include ?? [];
      const excludePatterns = options?.filters?.exclude ?? [
        ".DS_Store",
        "Thumbs.db",
        "*.tmp",
        "*.partial",
      ];

      // Recursively list with all safety checks
      const remoteEntries = await listRemoteEntriesSafe(
        client,
        connection.basePath,
        maxDepth,
        includePatterns,
        excludePatterns,
        warnings
      );

      // Separate folders and files
      const remoteFolders = remoteEntries.filter((e) => e.type === "d");
      const remoteFiles = remoteEntries.filter((e) => e.type === "-");

      // If dry-run, calculate preview without modifying
      if (options?.dryRun) {
        const preview = await calculateSyncPreview(
          userId,
          connectionId,
          remoteFolders,
          remoteFiles,
          warnings
        );
        return {
          success: true,
          data: {
            stats: preview.stats,
            conflicts: preview.conflicts,
            warnings,
            durationMs: Date.now() - startTime,
            isDryRun: true,
          },
        };
      }

      // Execute sync in transaction
      await prisma.$transaction(
        async (tx) => {
          // Get existing items
          const existingItems = await tx.item.findMany({
            where: { userId, connectionId },
            select: {
              id: true,
              sftpPath: true,
              sftpModifiedAt: true,
              name: true,
            },
          });

          const existingByPath = new Map(
            existingItems.filter((i) => i.sftpPath).map((i) => [i.sftpPath!, i])
          );

          // Pre-compute order counters (fixes N+1)
          const orderCounters = new Map<string | null, number>();
          const existingMaxOrders = await tx.item.groupBy({
            by: ["parentId"],
            where: { userId },
            _max: { order: true },
          });
          for (const row of existingMaxOrders) {
            orderCounters.set(row.parentId, (row._max.order ?? -1) + 1);
          }

          // Map paths to item IDs
          const pathToItemId = new Map<string, string>();
          for (const item of existingItems) {
            if (item.sftpPath) {
              pathToItemId.set(item.sftpPath, item.id);
            }
          }

          // Process folders (parents before children)
          const sortedFolders = remoteFolders.sort((a, b) => a.depth - b.depth);

          // Batch items to create
          const itemsToCreate: Array<{
            name: string;
            userId: string;
            parentId: string | null;
            connectionId: string;
            sftpPath: string;
            sftpModifiedAt: Date;
            order: number;
            depth: number;
          }> = [];

          for (const folder of sortedFolders) {
            const existing = existingByPath.get(folder.path);

            if (!existing) {
              // Check for manual item conflict (case-insensitive)
              const parentId = pathToItemId.get(folder.parentPath) ?? null;
              const manualMatch = await tx.item.findFirst({
                where: {
                  userId,
                  parentId,
                  name: { equals: folder.name, mode: "insensitive" },
                  connectionId: null,
                  sftpPath: null,
                },
                include: {
                  _count: { select: { children: true } },
                },
              });

              if (manualMatch) {
                // Count SFTP children for this folder
                const sftpChildCount = sortedFolders.filter(
                  (f) => f.parentPath === folder.path
                ).length;

                conflicts.push({
                  manualItemId: manualMatch.id,
                  manualItemName: manualMatch.name,
                  sftpPath: folder.path,
                  parentPath: folder.parentPath,
                  manualChildCount: manualMatch._count.children,
                  sftpChildCount,
                });
                continue; // Skip - let user decide
              }

              // Queue for batch create
              const order = orderCounters.get(parentId) ?? 0;
              orderCounters.set(parentId, order + 1);

              itemsToCreate.push({
                name: folder.name,
                userId,
                parentId,
                connectionId,
                sftpPath: folder.path,
                sftpModifiedAt: new Date(folder.modifyTime),
                order,
                depth: folder.depth,
              });
            } else {
              // Check for updates using mtime + size
              const remoteMtime = new Date(folder.modifyTime);
              if (
                !existing.sftpModifiedAt ||
                remoteMtime.getTime() !== existing.sftpModifiedAt.getTime()
              ) {
                await tx.item.update({
                  where: { id: existing.id },
                  data: { sftpModifiedAt: remoteMtime },
                });
                stats.itemsUpdated++;
              }
            }
          }

          // Batch create items
          if (itemsToCreate.length > 0) {
            await tx.item.createMany({ data: itemsToCreate });
            stats.itemsCreated = itemsToCreate.length;

            // Fetch created items to update pathToItemId map
            const createdItems = await tx.item.findMany({
              where: {
                userId,
                connectionId,
                sftpPath: { in: itemsToCreate.map((i) => i.sftpPath) },
              },
              select: { id: true, sftpPath: true },
            });
            for (const item of createdItems) {
              if (item.sftpPath) {
                pathToItemId.set(item.sftpPath, item.id);
              }
            }
          }

          // Process files (similar batch approach)
          await syncFiles(
            tx,
            remoteFiles,
            pathToItemId,
            connectionId,
            stats,
            warnings
          );

          // Delete items no longer on server
          const remoteFolderPaths = new Set(remoteFolders.map((f) => f.path));
          const itemsToDelete = existingItems.filter(
            (i) => i.sftpPath && !remoteFolderPaths.has(i.sftpPath)
          );

          if (itemsToDelete.length > 0) {
            await tx.item.deleteMany({
              where: { id: { in: itemsToDelete.map((i) => i.id) } },
            });
            stats.itemsDeleted = itemsToDelete.length;
          }
        },
        {
          timeout: 60000,
          maxWait: 10000,
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        }
      );

      // Update connection last sync time
      await prisma.sftpConnection.update({
        where: { id: connectionId },
        data: { lastSyncAt: new Date(), lastError: null },
      });

      if (!options?.skipRevalidate) {
        revalidatePath("/my-items");
        revalidatePath("/my-items/connections");
      }

      return {
        success: true,
        data: {
          stats,
          conflicts,
          warnings,
          durationMs: Date.now() - startTime,
          isDryRun: false,
        },
      };
    } finally {
      // Release sync lock
      const lock = syncLocks.get(connectionId);
      if (lock) {
        lock.resolve();
        syncLocks.delete(connectionId);
      }
    }
  } catch (error) {
    logger.error({ err: error }, "[SFTP] Sync error");

    // Update error state
    try {
      await prisma.sftpConnection.update({
        where: { id: connectionId },
        data: {
          lastError: error instanceof Error ? error.message : "Sync failed",
        },
      });
    } catch {
      // Ignore update error
    }

    return { success: false, error: "Failed to sync from SFTP" };
  }
}
```

---

## Connection Health Check

```typescript
/**
 * Quick health check before starting long sync operation.
 */
async function testConnectionHealth(
  connection: SftpConnection
): Promise<{ healthy: boolean; error?: string; latencyMs?: number }> {
  const start = Date.now();

  try {
    const client = await getConnection(connection);

    // Simple list of base path to verify access
    await withTimeout(client.list(connection.basePath), 5000, "Health check");

    return {
      healthy: true,
      latencyMs: Date.now() - start,
    };
  } catch (error) {
    return {
      healthy: false,
      error: error instanceof Error ? error.message : "Connection failed",
    };
  }
}
```

---

## Conflict Resolution

### Enhanced Merge Action

```typescript
export async function mergeManualItemWithSftp(
  manualItemId: string,
  connectionId: string,
  sftpPath: string,
  options?: {
    /** Recursively merge matching children */
    recursive?: boolean;
  }
): Promise<
  ActionResult<{
    merged: boolean;
    itemsMerged: number;
    filesAdded: number;
  }>
> {
  const userId = await requireAuth();

  // Validate IDs
  if (!manualItemId || !connectionId) {
    return { success: false, error: "Invalid parameters" };
  }

  // Get connection first for path validation
  const connection = await prisma.sftpConnection.findFirst({
    where: { id: connectionId, userId },
  });
  if (!connection) {
    return { success: false, error: "Connection not found" };
  }

  // SECURITY: Validate path is within base
  if (!validatePathWithinBase(sftpPath, connection.basePath)) {
    logger.warn(
      { userId, sftpPath, basePath: connection.basePath },
      "[SFTP] Path traversal attempt blocked in merge"
    );
    return { success: false, error: "Invalid path" };
  }

  // Get manual item
  const item = await prisma.item.findFirst({
    where: { id: manualItemId, userId, connectionId: null, sftpPath: null },
    include: { children: true },
  });
  if (!item) {
    return { success: false, error: "Item not found or already synced" };
  }

  let itemsMerged = 0;
  let filesAdded = 0;

  await prisma.$transaction(async (tx) => {
    // 1. Link root item to SFTP
    await tx.item.update({
      where: { id: manualItemId },
      data: {
        connectionId,
        sftpPath,
        sftpModifiedAt: new Date(),
      },
    });
    itemsMerged++;

    // 2. If recursive, merge children
    if (options?.recursive && item.children.length > 0) {
      const client = await getConnection(connection);
      const remoteChildren = await client.list(sftpPath);

      for (const child of item.children) {
        // Find matching remote folder (case-insensitive)
        const remoteMatch = remoteChildren.find(
          (r) =>
            r.type === "d" && r.name.toLowerCase() === child.name.toLowerCase()
        );

        if (remoteMatch) {
          const childSftpPath = `${sftpPath}/${remoteMatch.name}`.replace(
            /\/+/g,
            "/"
          );

          // Recursively merge
          const childResult = await mergeManualItemWithSftp(
            child.id,
            connectionId,
            childSftpPath,
            { recursive: true }
          );

          if (childResult.success && childResult.data) {
            itemsMerged += childResult.data.itemsMerged;
            filesAdded += childResult.data.filesAdded;
          }
        }
      }
    }

    // 3. Sync files from SFTP into this item
    const client = await getConnection(connection);
    const remoteFiles = await client.list(sftpPath);

    for (const file of remoteFiles) {
      if (file.type !== "-") continue;

      const fileType = getFileTypeByExtension(file.name);
      if (!fileType) continue;

      const fileSftpPath = `${sftpPath}/${file.name}`.replace(/\/+/g, "/");

      // Check if file already exists
      const existingFile = await tx.itemFile.findFirst({
        where: { itemId: manualItemId, filename: file.name },
      });

      if (!existingFile) {
        await tx.itemFile.create({
          data: {
            itemId: manualItemId,
            filename: file.name,
            sftpPath: fileSftpPath,
            fileType,
            mimeType: getMimeTypeByExtension(file.name),
            size: BigInt(file.size),
            sftpModifiedAt: new Date(file.modifyTime),
          },
        });
        filesAdded++;
      }
    }
  });

  revalidatePath("/my-items");
  return { success: true, data: { merged: true, itemsMerged, filesAdded } };
}
```

---

## Sync Dialog Component

### Enhanced Props and UI

```typescript
// components/sftp/sync-dialog.tsx

interface SyncDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connectionId: string;
  connectionName: string;
}

type SyncPhase = 'idle' | 'preview' | 'syncing' | 'results';

export function SyncDialog({
  open,
  onOpenChange,
  connectionId,
  connectionName,
}: SyncDialogProps) {
  const [phase, setPhase] = useState<SyncPhase>('idle');
  const [preview, setPreview] = useState<SyncPreview | null>(null);
  const [results, setResults] = useState<SyncResultWithConflicts | null>(null);
  const [filters, setFilters] = useState<SyncFilter>({});

  // Start with preview (dry-run)
  const handleStartSync = async () => {
    setPhase('preview');
    const result = await syncFromSftp(connectionId, {
      dryRun: true,
      filters,
    });
    if (result.success && result.data) {
      setPreview(result.data);
    }
  };

  // Execute actual sync
  const handleConfirmSync = async () => {
    setPhase('syncing');
    const result = await syncFromSftp(connectionId, { filters });
    if (result.success && result.data) {
      setResults(result.data);
      setPhase('results');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Sync: {connectionName}</DialogTitle>
        </DialogHeader>

        {phase === 'idle' && (
          <SyncFiltersForm
            filters={filters}
            onChange={setFilters}
            onStart={handleStartSync}
          />
        )}

        {phase === 'preview' && preview && (
          <SyncPreviewView
            preview={preview}
            onConfirm={handleConfirmSync}
            onCancel={() => setPhase('idle')}
          />
        )}

        {phase === 'syncing' && <SyncProgress connectionName={connectionName} />}

        {phase === 'results' && results && (
          <SyncResultsView
            results={results}
            connectionId={connectionId}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
```

### UI Structure

```
┌──────────────────────────────────────────────────────────────┐
│  Sync: My Media Server                                   [X] │
├──────────────────────────────────────────────────────────────┤
│  PHASE 1: FILTERS (optional)                                 │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ Include patterns (optional):                           │  │
│  │ [Movies/**, TV Shows/**                              ] │  │
│  │                                                        │  │
│  │ Exclude patterns:                                      │  │
│  │ [.DS_Store, *.tmp, *.partial                        ] │  │
│  │                                                        │  │
│  │ Max depth: [10 ▼]                                      │  │
│  └────────────────────────────────────────────────────────┘  │
│                                          [Preview Sync →]    │
├──────────────────────────────────────────────────────────────┤
│  PHASE 2: PREVIEW (dry-run)                                  │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ This sync will:                                        │  │
│  │   + Create   15 items, 47 files (2.3 GB)              │  │
│  │   ↻ Update    3 items, 12 files                       │  │
│  │   − Delete    2 items,  5 files                       │  │
│  │                                                        │  │
│  │ ⚠️ 2 conflicts require attention                       │  │
│  │ ⚠️ 11 warnings (expand to view)                        │  │
│  └────────────────────────────────────────────────────────┘  │
│                              [← Back]  [Confirm & Sync →]    │
├──────────────────────────────────────────────────────────────┤
│  PHASE 3: SYNCING                                            │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ ████████████████████░░░░░░░░░░  67%                    │  │
│  │                                                        │  │
│  │ Scanning: /Movies/Action/Die Hard (1988)/...          │  │
│  │ Items: 42/62  Files: 156/234                          │  │
│  └────────────────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────────────────┤
│  PHASE 4: RESULTS                                            │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ ✓ Sync completed in 4.2s                              │  │
│  │                                                        │  │
│  │ Created    15 items, 47 files                         │  │
│  │ Updated     3 items, 12 files                         │  │
│  │ Deleted     2 items,  5 files                         │  │
│  └────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ ⚠️ Conflicts (2)                              [Expand] │  │
│  │ ┌──────────────────────────────────────────────────┐   │  │
│  │ │ "Movies" matches /sftp/Movies                    │   │  │
│  │ │ Manual: 12 children  SFTP: 45 children           │   │  │
│  │ │ [Merge All] [Merge (choose children)] [Keep Both]│   │  │
│  │ └──────────────────────────────────────────────────┘   │  │
│  └────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ ⚠️ Warnings (11)                              [Expand] │  │
│  │   3 directories inaccessible                          │  │
│  │   5 files skipped (unknown type)                      │  │
│  │   2 symlinks skipped                                  │  │
│  │   1 filename invalid                                  │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                     [Done]   │
└──────────────────────────────────────────────────────────────┘
```

---

## Sync Badges

### Implementation

```typescript
// components/items/sync-badge.tsx

interface SyncBadgeProps {
  connectionName: string | null;
  className?: string;
}

export function SyncBadge({ connectionName, className }: SyncBadgeProps) {
  if (!connectionName) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn('inline-flex', className)}>
            <CloudIcon className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p className="text-xs">Synced from {connectionName}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
```

**Grid View** (`components/sortable-grid/GridItem.tsx`):

```typescript
{!isEditMode && (
  <div className="absolute top-2 right-2">
    <SyncBadge connectionName={item.connectionName} />
  </div>
)}
```

**Tree View** (`components/sortable-tree/components/TreeItem/TreeItem.tsx`):

```typescript
<span className="flex items-center gap-1.5">
  {item.name}
  {!isEditMode && (
    <SyncBadge connectionName={item.connectionName} className="ml-1" />
  )}
</span>
```

---

## Orphaned Item Cleanup

### Enhanced Connection Delete

```typescript
export async function deleteSftpConnection(
  connectionId: string
): Promise<ActionResult> {
  try {
    const userId = await requireAuth();

    const existing = await prisma.sftpConnection.findFirst({
      where: { id: connectionId, userId },
    });
    if (!existing) {
      return { success: false, error: "Connection not found" };
    }

    // Close pooled connection
    await closeConnection(connectionId);

    // Clean up in transaction
    await prisma.$transaction(async (tx) => {
      // Get all items for this connection
      const items = await tx.item.findMany({
        where: { connectionId },
        select: { id: true },
      });
      const itemIds = items.map((i) => i.id);

      // Clear SFTP metadata from files (keep files, just unlink)
      await tx.itemFile.updateMany({
        where: { itemId: { in: itemIds } },
        data: {
          sftpPath: null,
          sftpModifiedAt: null,
        },
      });

      // Convert synced items to manual items (preserve organization)
      await tx.item.updateMany({
        where: { connectionId },
        data: {
          connectionId: null,
          sftpPath: null,
          sftpModifiedAt: null,
        },
      });

      // Delete the connection
      await tx.sftpConnection.delete({
        where: { id: connectionId },
      });
    });

    revalidatePath("/my-items/connections");
    revalidatePath("/my-items");

    return { success: true };
  } catch (error) {
    logger.error({ err: error }, "[SFTP] Delete connection error");
    return { success: false, error: "Failed to delete connection" };
  }
}
```

---

## Error Resilience

### Retry with Exponential Backoff

```typescript
interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  /** Only retry on these error types */
  retryableErrors?: string[];
}

async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelayMs = 1000,
    maxDelayMs = 10000,
    retryableErrors = ["ECONNRESET", "ETIMEDOUT", "ENOTFOUND"],
  } = options;

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if error is retryable
      const isRetryable = retryableErrors.some(
        (e) => lastError?.message?.includes(e) || lastError?.name?.includes(e)
      );

      if (!isRetryable || attempt === maxAttempts) {
        throw lastError;
      }

      // Exponential backoff with jitter
      const delay = Math.min(
        baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * 1000,
        maxDelayMs
      );

      logger.warn(
        { attempt, maxAttempts, delay, error: lastError.message },
        "[SFTP] Retrying after error"
      );

      await sleep(delay);
    }
  }

  throw lastError;
}
```

### Connection-Level Locking

```typescript
interface SyncLock {
  resolve: () => void;
  startedAt: Date;
}

const syncLocks = new Map<string, SyncLock>();

// Cleanup stale locks (in case of crashes)
setInterval(() => {
  const now = Date.now();
  for (const [id, lock] of syncLocks.entries()) {
    // Locks older than 5 minutes are considered stale
    if (now - lock.startedAt.getTime() > 5 * 60 * 1000) {
      logger.warn({ connectionId: id }, "[SFTP] Cleaning stale sync lock");
      lock.resolve();
      syncLocks.delete(id);
    }
  }
}, 60000);
```

---

## Testing Strategy

### Unit Tests (`tests/unit/lib/`)

| Test                                                        | Purpose                          |
| ----------------------------------------------------------- | -------------------------------- |
| `syncFromSftp collects conflicts for matching manual items` | Verify conflicts array populated |
| `syncFromSftp collects conflicts case-insensitively`        | "Movies" matches "movies"        |
| `syncFromSftp collects warnings for depth limit`            | Verify warning at depth 10       |
| `syncFromSftp collects warnings for depth limit boundary`   | Exactly 10 vs 11 levels          |
| `syncFromSftp collects warnings for max entries`            | Verify at 10,000 entries         |
| `syncFromSftp collects warnings for unknown file types`     | Verify warning for .xyz          |
| `syncFromSftp skips symlinks with warning`                  | Verify symlink handling          |
| `syncFromSftp detects symlink cycles`                       | Verify cycle detection           |
| `syncFromSftp rolls back on transaction failure`            | Verify atomicity                 |
| `syncFromSftp dry-run returns preview without changes`      | Verify preview mode              |
| `syncFromSftp applies include filters`                      | Only matching paths synced       |
| `syncFromSftp applies exclude filters`                      | Matching paths skipped           |
| `mergeManualItemWithSftp links item to SFTP path`           | Verify merge updates             |
| `mergeManualItemWithSftp validates path traversal`          | Security test                    |
| `mergeManualItemWithSftp recursively merges children`       | Verify nested merge              |
| `deleteSftpConnection clears orphaned item paths`           | Verify cleanup                   |
| `deleteSftpConnection preserves item organization`          | Items still exist                |
| `syncFromSftp rejects concurrent sync`                      | Verify locking                   |
| `withRetry retries transient failures`                      | Verify retry logic               |
| `withRetry respects max attempts`                           | Stops after limit                |
| `validatePathWithinBase blocks traversal`                   | Security test                    |
| `validateFileNameStrict catches edge cases`                 | Unicode, long names              |

### Integration Tests (`tests/integration/sftp/`)

| Test                            | Purpose                              |
| ------------------------------- | ------------------------------------ |
| `sync-conflicts.test.ts`        | Manual items + sync = conflicts      |
| `sync-case-insensitive.test.ts` | Case variations detected             |
| `merge-items.test.ts`           | Merge updates connectionId/sftpPath  |
| `merge-recursive.test.ts`       | Nested children merged correctly     |
| `orphaned-items.test.ts`        | Delete connection converts to manual |
| `sync-transaction.test.ts`      | Failure mid-sync rolls back          |
| `sync-filters.test.ts`          | Include/exclude patterns work        |
| `sync-dry-run.test.ts`          | Preview matches actual sync          |
| `concurrent-sync.test.ts`       | Two syncs don't race                 |

### E2E Tests (`e2e/journeys/sftp/`)

| Test                          | Purpose                            |
| ----------------------------- | ---------------------------------- |
| `sync-dialog.spec.ts`         | Dialog phases work correctly       |
| `sync-preview.spec.ts`        | Dry-run shows accurate preview     |
| `sync-filters.spec.ts`        | Filter UI works                    |
| `sync-merge-conflict.spec.ts` | Merge button resolves conflict     |
| `sync-badges.spec.ts`         | Badges show in tree/grid           |
| `sync-badges-mobile.spec.ts`  | Badges work on mobile              |
| `sync-progress.spec.ts`       | Progress updates during sync       |
| `sync-warnings.spec.ts`       | Warnings expandable and readable   |
| `sync-large.spec.ts`          | Large sync (1000+ items) completes |

### Boundary Tests

| Test                     | Boundary             |
| ------------------------ | -------------------- |
| Depth exactly 10         | Should sync          |
| Depth exactly 11         | Should warn and skip |
| Entries exactly 10,000   | Should sync          |
| Entries exactly 10,001   | Should warn and stop |
| Filename 255 bytes UTF-8 | Should sync          |
| Filename 256 bytes UTF-8 | Should warn and skip |

---

## Implementation Summary

### Files to Create

| File                                            | Purpose                         |
| ----------------------------------------------- | ------------------------------- |
| `components/sftp/sync-dialog.tsx`               | Multi-phase sync dialog         |
| `components/sftp/sync-preview.tsx`              | Dry-run preview component       |
| `components/sftp/sync-progress.tsx`             | Progress indicator              |
| `components/sftp/sync-results.tsx`              | Results with conflicts/warnings |
| `components/sftp/sync-filters-form.tsx`         | Filter configuration UI         |
| `components/items/sync-badge.tsx`               | Reusable sync badge             |
| `lib/sftp-sync-utils.ts`                        | Helper functions for sync       |
| `tests/unit/lib/sftp-sync-conflicts.test.ts`    | Unit tests                      |
| `tests/unit/lib/sftp-path-validation.test.ts`   | Security tests                  |
| `tests/integration/sftp/sync-conflicts.test.ts` | Integration tests               |
| `e2e/journeys/sftp/sync-dialog.spec.ts`         | E2E tests                       |

### Files to Modify

| File                                                        | Changes                                                      |
| ----------------------------------------------------------- | ------------------------------------------------------------ |
| `lib/sftp-actions.ts`                                       | Refactor sync with transactions, conflicts, dry-run, filters |
| `lib/sftp-utils.ts`                                         | Add path validation, strict filename validation              |
| `lib/types.ts`                                              | Add all new types                                            |
| `components/sftp/sync-button.tsx`                           | Open SyncDialog                                              |
| `components/sftp/sync-all-button.tsx`                       | Aggregate into SyncDialog                                    |
| `components/sortable-grid/GridItem.tsx`                     | Add SyncBadge                                                |
| `components/sortable-tree/components/TreeItem/TreeItem.tsx` | Add SyncBadge                                                |

### Migration Path

No database migrations needed - all changes use existing schema fields.

---

## Known Limitations

These behaviors are documented rather than fixed due to complexity:

| Limitation              | Behavior                                 | Rationale                          |
| ----------------------- | ---------------------------------------- | ---------------------------------- |
| Folder rename detection | Delete + Create (loses customizations)   | Would require stable IDs from SFTP |
| File move detection     | Delete + Create (loses playbackPosition) | Same as above                      |
| Bidirectional sync      | Not supported (SFTP → local only)        | Different feature scope            |
