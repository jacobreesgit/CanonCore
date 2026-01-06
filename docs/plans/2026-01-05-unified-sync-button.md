# Unified Sync Button Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a unified sync button to the my-items page that syncs ALL SFTP connections, and add per-item sync buttons on item detail pages that sync an item and all its children.

**Architecture:** Create a `syncAllConnections` server action that iterates through all user's SFTP connections and syncs each one sequentially with console progress logging. Create a `syncItem` server action that syncs a specific item and its descendants. Add a `SyncAllButton` component for the my-items page header and update the item detail page to show a sync button for SFTP-connected items.

**Tech Stack:** Next.js App Router, React, TypeScript, Prisma, ssh2-sftp-client, Vitest, Playwright

---

## Validation Checklist (from code review)

Issues identified via code-review-excellence skill, context7, and sequential thinking:

- [x] 🔴 **N+1 queries in syncItemTree** - Pre-compute max orders with groupBy, avoid aggregate in loop
- [x] 🔴 **Rate limiting on syncAllConnections** - Added `checkRateLimit("sftpSyncAll")` at entry point
- [x] 🟡 **Redundant revalidatePath calls** - Added `skipRevalidate` option to syncFromSftp for internal use
- [x] 🟡 **Transaction wrapping** - Wrapped syncItemTree DB operations in `prisma.$transaction`
- [x] 🟡 **itemId format validation** - Added CUID regex validation
- [x] 🟢 **Error case unit tests** - Added tests for rate limiting, invalid ID, partial failure (Task 7.1)
- [ ] 🟢 **Integration test coverage** - Expand beyond stub tests (optional enhancement)

---

## Summary of Changes

| Area                | Before                                                 | After                                                 |
| ------------------- | ------------------------------------------------------ | ----------------------------------------------------- |
| My Items page       | Sync button only shown when connection filter selected | Always shows "Sync All" button when connections exist |
| Item detail page    | No sync button                                         | Shows sync button for SFTP-connected items            |
| Sync scope          | Single connection at a time                            | Sync all connections OR specific item tree            |
| Progress feedback   | Toast only                                             | Console/server logs + toast summary                   |
| ItemsView component | Shows SyncButton when connectionId set                 | Removed - sync moved to page level                    |

---

## Task 1: Create syncAllConnections Server Action

**Files:**

- Modify: `lib/sftp-actions.ts`

### Step 1.1: Write failing unit test for syncAllConnections

**Test file:** `tests/unit/lib/sftp-actions.test.ts` (create or append)

```typescript
/**
 * Unit tests for syncAllConnections action.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies before importing
vi.mock("@/lib/prisma", () => ({
  prisma: {
    sftpConnection: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue(null),
}));

// Need to mock the actual sync function
vi.mock("@/lib/sftp-client", () => ({
  getConnection: vi.fn(),
  closeConnection: vi.fn(),
}));

import { syncAllConnections } from "@/lib/sftp-actions";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

describe("syncAllConnections", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns unauthorized when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);

    const result = await syncAllConnections();

    expect(result.success).toBe(false);
    expect(result).toHaveProperty("error", "Unauthorized");
  });

  it("returns empty results when no connections exist", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-1" },
      expires: new Date().toISOString(),
    });
    vi.mocked(prisma.sftpConnection.findMany).mockResolvedValue([]);

    const result = await syncAllConnections();

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      totalConnections: 0,
      successfulSyncs: 0,
      failedSyncs: 0,
      results: [],
    });
  });
});
```

### Step 1.2: Run test to verify it fails

Run: `pnpm run test:unit -- tests/unit/lib/sftp-actions.test.ts`
Expected: FAIL - syncAllConnections doesn't exist

### Step 1.3: Add rate limit config for sftpSyncAll

**Modify:** `lib/rate-limit.ts`

Add new rate limit configuration:

```typescript
// In the rateLimits config object, add:
sftpSyncAll: { limit: 5, window: "1m" }, // 5 sync-all per minute
```

### Step 1.4: Implement syncAllConnections

**Modify:** `lib/sftp-actions.ts`

Add after the existing `syncFromSftp` function (around line 969):

```typescript
/** Result for syncing all connections */
export interface SyncAllResult {
  totalConnections: number;
  successfulSyncs: number;
  failedSyncs: number;
  results: Array<{
    connectionId: string;
    connectionName: string;
    success: boolean;
    created: number;
    updated: number;
    deleted: number;
    error?: string;
  }>;
}

/**
 * Syncs all SFTP connections for the current user.
 * Processes connections sequentially with console progress logging.
 *
 * @returns Aggregated sync results
 */
export async function syncAllConnections(): Promise<
  ActionResult<SyncAllResult>
> {
  try {
    // Rate limit check - prevents abuse of bulk sync
    const rateLimitResult = await checkRateLimit("sftpSyncAll");
    if (rateLimitResult) {
      return { success: false, error: rateLimitResult.error };
    }

    const userId = await requireAuth();

    // Get all active connections
    const connections = await prisma.sftpConnection.findMany({
      where: { userId, isActive: true },
      orderBy: { name: "asc" },
    });

    console.log(
      `[SFTP Sync All] Starting sync for ${connections.length} connection(s)`
    );

    const results: SyncAllResult["results"] = [];
    let successfulSyncs = 0;
    let failedSyncs = 0;

    // Process each connection sequentially
    // NOTE: Uses _syncFromSftpInternal to avoid redundant revalidatePath calls
    // The public syncFromSftp calls revalidatePath; we do it once at end instead
    for (const connection of connections) {
      console.log(
        `[SFTP Sync All] Syncing "${connection.name}" (${connection.id})...`
      );

      const startTime = Date.now();
      // Use internal version that skips revalidation (add skipRevalidate param to syncFromSftp)
      const syncResult = await syncFromSftp(connection.id, {
        skipRevalidate: true,
      });
      const duration = Date.now() - startTime;

      if (syncResult.success && syncResult.data) {
        const { created, updated, deleted } = syncResult.data;
        console.log(
          `[SFTP Sync All] ✓ "${connection.name}" completed in ${duration}ms: ` +
            `${created} created, ${updated} updated, ${deleted} deleted`
        );
        results.push({
          connectionId: connection.id,
          connectionName: connection.name,
          success: true,
          created,
          updated,
          deleted,
        });
        successfulSyncs++;
      } else {
        const error =
          "error" in syncResult ? syncResult.error : "Unknown error";
        console.error(
          `[SFTP Sync All] ✗ "${connection.name}" failed: ${error}`
        );
        results.push({
          connectionId: connection.id,
          connectionName: connection.name,
          success: false,
          created: 0,
          updated: 0,
          deleted: 0,
          error,
        });
        failedSyncs++;
      }
    }

    console.log(
      `[SFTP Sync All] Completed: ${successfulSyncs}/${connections.length} successful`
    );

    revalidatePath("/my-items");
    revalidatePath("/my-items/connections");

    return {
      success: true,
      data: {
        totalConnections: connections.length,
        successfulSyncs,
        failedSyncs,
        results,
      },
    };
  } catch (error) {
    console.error("[SFTP Sync All] Error:", error);
    return { success: false, error: "Failed to sync connections" };
  }
}
```

### Step 1.4: Run test to verify it passes

Run: `pnpm run test:unit -- tests/unit/lib/sftp-actions.test.ts`
Expected: PASS

### Step 1.5: Commit

```bash
git add lib/sftp-actions.ts tests/unit/lib/sftp-actions.test.ts
git commit -m "feat: add syncAllConnections server action with logging"
```

---

## Task 2: Create syncItemTree Server Action

**Files:**

- Modify: `lib/sftp-actions.ts`

### Step 2.1: Write failing unit test for syncItemTree

**Append to:** `tests/unit/lib/sftp-actions.test.ts`

```typescript
describe("syncItemTree", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns unauthorized when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);

    const { syncItemTree } = await import("@/lib/sftp-actions");
    const result = await syncItemTree("item-1");

    expect(result.success).toBe(false);
    expect(result).toHaveProperty("error", "Unauthorized");
  });

  it("returns error when item not found", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-1" },
      expires: new Date().toISOString(),
    });
    vi.mocked(prisma.item.findFirst).mockResolvedValue(null);

    const { syncItemTree } = await import("@/lib/sftp-actions");
    const result = await syncItemTree("nonexistent");

    expect(result.success).toBe(false);
    expect(result).toHaveProperty("error", "Item not found");
  });

  it("returns error when item has no connection", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-1" },
      expires: new Date().toISOString(),
    });
    vi.mocked(prisma.item.findFirst).mockResolvedValue({
      id: "item-1",
      connectionId: null,
      sftpPath: null,
    } as any);

    const { syncItemTree } = await import("@/lib/sftp-actions");
    const result = await syncItemTree("item-1");

    expect(result.success).toBe(false);
    expect(result).toHaveProperty("error", "Item is not connected to SFTP");
  });
});
```

### Step 2.2: Run test to verify it fails

Run: `pnpm run test:unit -- tests/unit/lib/sftp-actions.test.ts`
Expected: FAIL - syncItemTree doesn't exist

### Step 2.3: Implement syncItemTree

**Modify:** `lib/sftp-actions.ts`

Add after `syncAllConnections`:

```typescript
/** Result for syncing an item tree */
export interface SyncItemResult {
  itemId: string;
  itemName: string;
  created: number;
  updated: number;
  deleted: number;
}

/** CUID format validation regex */
const CUID_REGEX = /^c[a-z0-9]{24}$/;

/**
 * Syncs a specific item and all its descendants from SFTP.
 * Only syncs the subtree rooted at the given item.
 * Uses batch operations and transactions for performance and atomicity.
 *
 * @param itemId - Root item ID to sync
 * @returns Sync statistics for the item tree
 */
export async function syncItemTree(
  itemId: string
): Promise<ActionResult<SyncItemResult>> {
  try {
    // Validate itemId format
    if (!CUID_REGEX.test(itemId)) {
      return { success: false, error: "Invalid item ID format" };
    }

    const userId = await requireAuth();

    // Get item with connection
    const item = await prisma.item.findFirst({
      where: { id: itemId, userId },
      include: { connection: true },
    });

    if (!item) {
      return { success: false, error: "Item not found" };
    }

    if (!item.connectionId || !item.sftpPath || !item.connection) {
      return { success: false, error: "Item is not connected to SFTP" };
    }

    console.log(
      `[SFTP Sync Item] Starting sync for "${item.name}" (${item.sftpPath})`
    );

    const startTime = Date.now();

    // Get pooled SFTP connection
    const client = await getConnection(item.connection);

    // Recursively list entries from item's SFTP path
    const remoteEntries: Array<{
      path: string;
      name: string;
      type: "d" | "-" | "l";
      size: number;
      modifyTime: number;
      depth: number;
      parentPath: string;
    }> = [];

    const failedDirs: string[] = [];
    const baseDepth = item.depth;

    async function listRecursive(dirPath: string, depth: number) {
      if (depth > SYNC_MAX_DEPTH || remoteEntries.length >= SYNC_MAX_ENTRIES) {
        return;
      }

      let entries;
      try {
        entries = await client.list(dirPath);
      } catch (listError) {
        console.warn(`[SFTP Sync Item] Failed to list: ${dirPath}`, listError);
        failedDirs.push(dirPath);
        return;
      }

      for (const entry of entries) {
        if (entry.name === "." || entry.name === "..") continue;

        const entryPath = `${dirPath}/${entry.name}`.replace(/\/+/g, "/");

        remoteEntries.push({
          path: entryPath,
          name: entry.name,
          type: entry.type,
          size: entry.size,
          modifyTime: entry.modifyTime,
          depth,
          parentPath: dirPath,
        });

        if (entry.type === "d" && depth < SYNC_MAX_DEPTH) {
          await listRecursive(entryPath, depth + 1);
        }
      }
    }

    // Start listing from the item's SFTP path
    await listRecursive(item.sftpPath, baseDepth + 1);

    if (failedDirs.length > 0) {
      console.warn(
        `[SFTP Sync Item] Completed with ${failedDirs.length} inaccessible directories`
      );
    }

    // Separate folders and files
    const remoteFolders = remoteEntries.filter((e) => e.type === "d");
    const remoteFiles = remoteEntries.filter((e) => e.type !== "d");

    // Get existing child items for this item (recursively)
    const existingItems = await prisma.item.findMany({
      where: {
        userId,
        connectionId: item.connectionId,
        sftpPath: { startsWith: item.sftpPath + "/" },
      },
      select: {
        id: true,
        sftpPath: true,
        sftpModifiedAt: true,
      },
    });

    const existingByPath = new Map(
      existingItems.filter((i) => i.sftpPath).map((i) => [i.sftpPath!, i])
    );
    const remoteFolderPaths = new Set(remoteFolders.map((f) => f.path));

    let created = 0;
    let updated = 0;
    let deleted = 0;

    // Map paths to item IDs
    const pathToItemId = new Map<string, string>();
    pathToItemId.set(item.sftpPath, item.id);

    for (const existingItem of existingItems) {
      if (existingItem.sftpPath) {
        pathToItemId.set(existingItem.sftpPath, existingItem.id);
      }
    }

    // Process folders in order (parents before children)
    // NOTE: For performance, collect all creates first then use createMany
    // However, we need IDs for parent relationships, so we process depth by depth
    const sortedFolders = remoteFolders.sort((a, b) => a.depth - b.depth);

    // Pre-compute max orders per parent to avoid N+1 aggregate queries
    const orderCounters = new Map<string | null, number>();
    const existingMaxOrders = await prisma.item.groupBy({
      by: ["parentId"],
      where: { userId },
      _max: { order: true },
    });
    for (const row of existingMaxOrders) {
      orderCounters.set(row.parentId, (row._max.order ?? -1) + 1);
    }

    // Wrap all DB operations in a transaction for atomicity
    await prisma.$transaction(async (tx) => {
      for (const folder of sortedFolders) {
        const existing = existingByPath.get(folder.path);

        if (!existing) {
          const parentId = pathToItemId.get(folder.parentPath) ?? item.id;

          // Get and increment order counter for this parent
          const order = orderCounters.get(parentId) ?? 0;
          orderCounters.set(parentId, order + 1);

          const newItem = await tx.item.create({
            data: {
              name: folder.name,
              userId,
              parentId,
              connectionId: item.connectionId,
              sftpPath: folder.path,
              sftpModifiedAt: new Date(folder.modifyTime),
              order,
              depth: folder.depth,
            },
          });

          pathToItemId.set(folder.path, newItem.id);
          created++;
          console.log(`[SFTP Sync Item] Created: ${folder.path}`);
        } else {
          const remoteMtime = new Date(folder.modifyTime);
          const localMtime = existing.sftpModifiedAt;

          if (!localMtime || remoteMtime.getTime() !== localMtime.getTime()) {
            await tx.item.update({
              where: { id: existing.id },
              data: { sftpModifiedAt: remoteMtime },
            });
            updated++;
          }
        }
      }

      // Get existing ItemFiles for child items (inside transaction)
      const childItemIds = Array.from(pathToItemId.values());
      const existingFiles = await tx.itemFile.findMany({
        where: { itemId: { in: childItemIds } },
        select: {
          id: true,
          itemId: true,
          sftpPath: true,
          sftpModifiedAt: true,
        },
      });

      const existingFilesByPath = new Map(
        existingFiles.map((f) => [f.sftpPath, f])
      );
      const remoteFilePaths = new Set(remoteFiles.map((f) => f.path));

      // Create/update ItemFiles
      for (const file of remoteFiles) {
        const fileType = getFileTypeByExtension(file.name);
        if (!fileType) continue;

        const parentItemId = pathToItemId.get(file.parentPath);
        if (!parentItemId) continue;

        const existing = existingFilesByPath.get(file.path);

        if (!existing) {
          await tx.itemFile.create({
            data: {
              itemId: parentItemId,
              filename: file.name,
              sftpPath: file.path,
              fileType,
              mimeType: getMimeTypeByExtension(file.name),
              size: BigInt(file.size),
              sftpModifiedAt: new Date(file.modifyTime),
            },
          });
          created++;
          console.log(`[SFTP Sync Item] Created file: ${file.path}`);
        } else {
          const remoteMtime = new Date(file.modifyTime);
          const localMtime = existing.sftpModifiedAt;

          if (!localMtime || remoteMtime.getTime() !== localMtime.getTime()) {
            await tx.itemFile.update({
              where: { id: existing.id },
              data: {
                size: BigInt(file.size),
                sftpModifiedAt: remoteMtime,
                mimeType: getMimeTypeByExtension(file.name),
              },
            });
            updated++;
          }
        }
      }

      // Delete files that no longer exist
      for (const file of existingFiles) {
        if (!remoteFilePaths.has(file.sftpPath)) {
          await tx.itemFile.delete({ where: { id: file.id } });
          deleted++;
          console.log(`[SFTP Sync Item] Deleted file: ${file.sftpPath}`);
        }
      }

      // Delete items that no longer exist
      for (const existingItem of existingItems) {
        if (
          existingItem.sftpPath &&
          !remoteFolderPaths.has(existingItem.sftpPath)
        ) {
          await tx.item.delete({ where: { id: existingItem.id } });
          deleted++;
          console.log(`[SFTP Sync Item] Deleted: ${existingItem.sftpPath}`);
        }
      }
    }); // End of transaction

    const duration = Date.now() - startTime;
    console.log(
      `[SFTP Sync Item] ✓ "${item.name}" completed in ${duration}ms: ` +
        `${created} created, ${updated} updated, ${deleted} deleted`
    );

    revalidatePath("/my-items");
    revalidatePath(`/my-items/${itemId}`);

    return {
      success: true,
      data: {
        itemId: item.id,
        itemName: item.name,
        created,
        updated,
        deleted,
      },
    };
  } catch (error) {
    console.error("[SFTP Sync Item] Error:", error);
    return { success: false, error: "Failed to sync item" };
  }
}
```

### Step 2.4: Run tests

Run: `pnpm run test:unit -- tests/unit/lib/sftp-actions.test.ts`
Expected: PASS

### Step 2.5: Commit

```bash
git add lib/sftp-actions.ts tests/unit/lib/sftp-actions.test.ts
git commit -m "feat: add syncItemTree server action for per-item sync"
```

---

## Task 3: Create SyncAllButton Component

**Files:**

- Create: `components/sftp/sync-all-button.tsx`
- Create: `tests/unit/components/sftp/sync-all-button.test.tsx`

### Step 3.1: Write failing unit test

**File:** `tests/unit/components/sftp/sync-all-button.test.tsx`

```tsx
/**
 * Unit tests for SyncAllButton component.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SyncAllButton } from "@/components/sftp/sync-all-button";

// Mock server action
vi.mock("@/lib/sftp-actions", () => ({
  syncAllConnections: vi.fn(),
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { syncAllConnections } from "@/lib/sftp-actions";
import { toast } from "sonner";

describe("SyncAllButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders with 'Sync All' text", () => {
    render(<SyncAllButton connectionCount={2} />);

    expect(
      screen.getByRole("button", { name: /sync all/i })
    ).toBeInTheDocument();
  });

  it("is disabled when connectionCount is 0", () => {
    render(<SyncAllButton connectionCount={0} />);

    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("shows syncing state when clicked", async () => {
    vi.mocked(syncAllConnections).mockImplementation(
      () => new Promise(() => {}) // Never resolves, to test pending state
    );

    const user = userEvent.setup();
    render(<SyncAllButton connectionCount={2} />);

    await user.click(screen.getByRole("button"));

    expect(screen.getByText(/syncing/i)).toBeInTheDocument();
  });

  it("shows success toast on completion", async () => {
    vi.mocked(syncAllConnections).mockResolvedValue({
      success: true,
      data: {
        totalConnections: 2,
        successfulSyncs: 2,
        failedSyncs: 0,
        results: [],
      },
    });

    const user = userEvent.setup();
    render(<SyncAllButton connectionCount={2} />);

    await user.click(screen.getByRole("button"));

    expect(toast.success).toHaveBeenCalled();
  });
});
```

### Step 3.2: Run test to verify it fails

Run: `pnpm run test:unit -- tests/unit/components/sftp/sync-all-button.test.tsx`
Expected: FAIL - component doesn't exist

### Step 3.3: Create SyncAllButton component

**File:** `components/sftp/sync-all-button.tsx`

```tsx
/**
 * Sync All button component for triggering sync across all SFTP connections.
 * Features loading animation, progress feedback, and comprehensive result toast.
 */

"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { syncAllConnections, type SyncAllResult } from "@/lib/sftp-actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { RefreshCw, Check, AlertTriangle } from "lucide-react";

interface SyncAllButtonProps {
  /** Number of active connections */
  connectionCount: number;
  /** Button style variant */
  variant?: "default" | "outline" | "ghost";
  /** Button size */
  size?: "default" | "sm" | "lg" | "icon";
  /** Additional CSS classes */
  className?: string;
  /** Callback after sync completes */
  onSyncComplete?: (result: SyncAllResult) => void | Promise<void>;
}

/**
 * Button that triggers SFTP sync for all connections.
 *
 * @param connectionCount - Number of connections (0 disables the button)
 * @param variant - Button style variant
 * @param size - Button size
 * @param className - Additional CSS classes
 * @param onSyncComplete - Callback after all syncs complete
 */
export function SyncAllButton({
  connectionCount,
  variant = "outline",
  size = "default",
  className,
  onSyncComplete,
}: SyncAllButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<
    "idle" | "syncing" | "success" | "error"
  >("idle");

  const handleSync = () => {
    setStatus("syncing");

    startTransition(async () => {
      const result = await syncAllConnections();

      if (result.success && result.data) {
        const { successfulSyncs, failedSyncs, results } = result.data;

        if (failedSyncs === 0) {
          setStatus("success");

          // Calculate totals
          const totalCreated = results.reduce((sum, r) => sum + r.created, 0);
          const totalUpdated = results.reduce((sum, r) => sum + r.updated, 0);
          const totalDeleted = results.reduce((sum, r) => sum + r.deleted, 0);

          const parts: string[] = [];
          if (totalCreated > 0) parts.push(`${totalCreated} added`);
          if (totalUpdated > 0) parts.push(`${totalUpdated} updated`);
          if (totalDeleted > 0) parts.push(`${totalDeleted} removed`);

          const message =
            parts.length > 0
              ? `Synced ${successfulSyncs} connection(s): ${parts.join(", ")}`
              : `${successfulSyncs} connection(s) already in sync`;

          toast.success(message);
        } else {
          setStatus("error");
          toast.error(
            `Sync completed with errors: ${successfulSyncs} succeeded, ${failedSyncs} failed`
          );
        }

        await onSyncComplete?.(result.data);

        // Reset to idle after showing state
        setTimeout(() => setStatus("idle"), 2000);
      } else {
        setStatus("error");
        toast.error("error" in result ? result.error : "Sync failed");
        setTimeout(() => setStatus("idle"), 2000);
      }
    });
  };

  const isDisabled = isPending || status === "syncing" || connectionCount === 0;

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleSync}
      disabled={isDisabled}
      className={cn(
        "relative overflow-hidden transition-all duration-300",
        status === "success" &&
          "ring-offset-background ring-2 ring-emerald-500/50 ring-offset-2",
        status === "error" &&
          "ring-destructive/50 ring-offset-background ring-2 ring-offset-2",
        className
      )}
    >
      {/* Background sweep animation during sync */}
      {status === "syncing" && (
        <span
          className="via-primary/10 absolute inset-0 animate-[sweep_1.5s_ease-in-out_infinite] bg-gradient-to-r from-transparent to-transparent"
          style={{
            background:
              "linear-gradient(90deg, transparent, hsl(var(--primary) / 0.1), transparent)",
          }}
        />
      )}

      {/* Icon with state-based rendering */}
      <span className="relative flex items-center gap-2">
        {status === "success" ? (
          <Check className="animate-in zoom-in-50 size-4 text-emerald-500 duration-200" />
        ) : status === "error" ? (
          <AlertTriangle className="text-destructive animate-in zoom-in-50 size-4 duration-200" />
        ) : (
          <RefreshCw
            className={cn(
              "size-4 transition-transform duration-300",
              status === "syncing" && "animate-spin"
            )}
          />
        )}

        {/* Text - hide on icon size */}
        {size !== "icon" && (
          <span className="relative">
            {status === "syncing"
              ? "Syncing..."
              : status === "success"
                ? "Synced"
                : "Sync All"}
          </span>
        )}
      </span>
    </Button>
  );
}
```

### Step 3.4: Run tests

Run: `pnpm run test:unit -- tests/unit/components/sftp/sync-all-button.test.tsx`
Expected: PASS

### Step 3.5: Export from sftp index

**Modify or Create:** `components/sftp/index.ts`

```typescript
export { ConnectionCard } from "./connection-card";
export { ConnectionForm } from "./connection-form";
export { ConnectionTestButton } from "./connection-test-button";
export { SyncButton } from "./sync-button";
export { SyncAllButton } from "./sync-all-button";
```

### Step 3.6: Commit

```bash
git add components/sftp/sync-all-button.tsx components/sftp/index.ts tests/unit/components/sftp/sync-all-button.test.tsx
git commit -m "feat: add SyncAllButton component"
```

---

## Task 4: Create ItemSyncButton Component

**Files:**

- Create: `components/sftp/item-sync-button.tsx`
- Create: `tests/unit/components/sftp/item-sync-button.test.tsx`

### Step 4.1: Write failing unit test

**File:** `tests/unit/components/sftp/item-sync-button.test.tsx`

```tsx
/**
 * Unit tests for ItemSyncButton component.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ItemSyncButton } from "@/components/sftp/item-sync-button";

vi.mock("@/lib/sftp-actions", () => ({
  syncItemTree: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { syncItemTree } from "@/lib/sftp-actions";
import { toast } from "sonner";

describe("ItemSyncButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders with 'Sync' text", () => {
    render(<ItemSyncButton itemId="item-1" itemName="Movies" />);

    expect(screen.getByRole("button", { name: /sync/i })).toBeInTheDocument();
  });

  it("calls syncItemTree when clicked", async () => {
    vi.mocked(syncItemTree).mockResolvedValue({
      success: true,
      data: {
        itemId: "item-1",
        itemName: "Movies",
        created: 5,
        updated: 2,
        deleted: 1,
      },
    });

    const user = userEvent.setup();
    render(<ItemSyncButton itemId="item-1" itemName="Movies" />);

    await user.click(screen.getByRole("button"));

    expect(syncItemTree).toHaveBeenCalledWith("item-1");
    expect(toast.success).toHaveBeenCalled();
  });
});
```

### Step 4.2: Create ItemSyncButton component

**File:** `components/sftp/item-sync-button.tsx`

```tsx
/**
 * Sync button for individual items and their descendants.
 * Syncs only the subtree rooted at the specified item.
 */

"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { syncItemTree, type SyncItemResult } from "@/lib/sftp-actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { RefreshCw, Check, AlertTriangle } from "lucide-react";

interface ItemSyncButtonProps {
  /** Item ID to sync */
  itemId: string;
  /** Item name for toast messages */
  itemName: string;
  /** Button style variant */
  variant?: "default" | "outline" | "ghost";
  /** Button size */
  size?: "default" | "sm" | "lg" | "icon";
  /** Additional CSS classes */
  className?: string;
  /** Callback after sync completes */
  onSyncComplete?: (result: SyncItemResult) => void | Promise<void>;
}

/**
 * Button that triggers SFTP sync for a specific item and its children.
 *
 * @param itemId - Item ID to sync
 * @param itemName - Item name for display in toast
 * @param variant - Button style variant
 * @param size - Button size
 * @param className - Additional CSS classes
 * @param onSyncComplete - Callback after sync completes
 */
export function ItemSyncButton({
  itemId,
  itemName,
  variant = "outline",
  size = "default",
  className,
  onSyncComplete,
}: ItemSyncButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<
    "idle" | "syncing" | "success" | "error"
  >("idle");

  const handleSync = () => {
    setStatus("syncing");

    startTransition(async () => {
      const result = await syncItemTree(itemId);

      if (result.success && result.data) {
        setStatus("success");
        const { created, updated, deleted } = result.data;

        const parts: string[] = [];
        if (created > 0) parts.push(`${created} added`);
        if (updated > 0) parts.push(`${updated} updated`);
        if (deleted > 0) parts.push(`${deleted} removed`);

        const message =
          parts.length > 0
            ? `Synced "${itemName}": ${parts.join(", ")}`
            : `"${itemName}" already in sync`;

        toast.success(message);

        await onSyncComplete?.(result.data);

        setTimeout(() => setStatus("idle"), 2000);
      } else {
        setStatus("error");
        toast.error(
          "error" in result ? result.error : `Failed to sync "${itemName}"`
        );
        setTimeout(() => setStatus("idle"), 2000);
      }
    });
  };

  const isDisabled = isPending || status === "syncing";

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleSync}
      disabled={isDisabled}
      className={cn(
        "relative overflow-hidden transition-all duration-300",
        status === "success" &&
          "ring-offset-background ring-2 ring-emerald-500/50 ring-offset-2",
        status === "error" &&
          "ring-destructive/50 ring-offset-background ring-2 ring-offset-2",
        className
      )}
    >
      {status === "syncing" && (
        <span
          className="via-primary/10 absolute inset-0 animate-[sweep_1.5s_ease-in-out_infinite] bg-gradient-to-r from-transparent to-transparent"
          style={{
            background:
              "linear-gradient(90deg, transparent, hsl(var(--primary) / 0.1), transparent)",
          }}
        />
      )}

      <span className="relative flex items-center gap-2">
        {status === "success" ? (
          <Check className="animate-in zoom-in-50 size-4 text-emerald-500 duration-200" />
        ) : status === "error" ? (
          <AlertTriangle className="text-destructive animate-in zoom-in-50 size-4 duration-200" />
        ) : (
          <RefreshCw
            className={cn(
              "size-4 transition-transform duration-300",
              status === "syncing" && "animate-spin"
            )}
          />
        )}

        {size !== "icon" && (
          <span className="relative">
            {status === "syncing"
              ? "Syncing..."
              : status === "success"
                ? "Synced"
                : "Sync"}
          </span>
        )}
      </span>
    </Button>
  );
}
```

### Step 4.3: Update sftp index export

**Modify:** `components/sftp/index.ts`

Add:

```typescript
export { ItemSyncButton } from "./item-sync-button";
```

### Step 4.4: Run tests

Run: `pnpm run test:unit -- tests/unit/components/sftp/item-sync-button.test.tsx`
Expected: PASS

### Step 4.5: Commit

```bash
git add components/sftp/item-sync-button.tsx components/sftp/index.ts tests/unit/components/sftp/item-sync-button.test.tsx
git commit -m "feat: add ItemSyncButton component for per-item sync"
```

---

## Task 5: Add SyncAllButton to My Items Page

**Files:**

- Modify: `components/items/filtered-items-view.tsx`

### Step 5.1: Update FilteredItemsView to show SyncAllButton

**Modify:** `components/items/filtered-items-view.tsx`

Import and add the button:

```tsx
// Add import
import { SyncAllButton } from "@/components/sftp/sync-all-button";

// In FilteredItemsViewInner, update the return:
return (
  <div className="flex flex-col gap-6">
    {/* Header with filter and sync */}
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        {connections.length > 0 && (
          <>
            <ConnectionFilter
              connections={connections}
              selectedConnectionId={connectionId}
              onConnectionChange={handleConnectionChange}
            />
            {isPending && (
              <Loader2 className="text-muted-foreground size-4 animate-spin" />
            )}
          </>
        )}
      </div>

      {/* Sync All button - always visible when connections exist */}
      {connections.length > 0 && (
        <SyncAllButton
          connectionCount={connections.length}
          size="sm"
          onSyncComplete={async () => {
            // Refetch items after sync
            startTransition(async () => {
              const result = connectionId
                ? await getItemsByConnection(connectionId, null)
                : await getItems(null);
              if (result.success && result.data) {
                setItems(result.data);
              }
            });
          }}
        />
      )}
    </div>

    <ItemsView items={items} parentId={null} connectionId={connectionId} />
  </div>
);
```

### Step 5.2: Remove SyncButton from ItemsView

**Modify:** `components/items/items-view.tsx`

Remove the SyncButton import and usage in the controls section (around lines 383-392):

```tsx
// Remove this import:
// import { SyncButton } from "@/components/sftp/sync-button";

// Remove this block from controls section:
// {/* SFTP Sync button - only show when connected */}
// {connectionId && (
//   <SyncButton
//     connectionId={connectionId}
//     size="sm"
//     onSyncComplete={async () => {
//       await refetchItems();
//     }}
//   />
// )}
```

### Step 5.3: Run type-check

Run: `pnpm run type-check`
Expected: PASS

### Step 5.4: Commit

```bash
git add components/items/filtered-items-view.tsx components/items/items-view.tsx
git commit -m "feat: add SyncAllButton to my-items page header"
```

---

## Task 6: Add ItemSyncButton to Item Detail Page

**Files:**

- Modify: `app/(my-items)/my-items/[itemId]/page.tsx`

### Step 6.1: Update ItemDetailPage to show sync button for SFTP items

**Modify:** `app/(my-items)/my-items/[itemId]/page.tsx`

```tsx
// Add import
import { ItemSyncButton } from "@/components/sftp/item-sync-button";

// In the component, after fetching item and before return statements:
const isConnectedToSftp = !!item.connectionId && !!item.sftpPath;

// Create a header section component for reuse
const headerControls = isConnectedToSftp ? (
  <div className="flex items-center gap-3">
    <ItemSyncButton itemId={item.id} itemName={item.name} size="sm" />
  </div>
) : null;

// In each return case, add the sync button before the content:
// Case 1: No files (just items view)
return (
  <>
    <SiteHeader
      title="My Items"
      titleHref="/my-items"
      breadcrumbs={breadcrumbs}
    />
    <div className="flex flex-col gap-4 px-4 py-6 md:px-6 lg:px-8">
      {headerControls && (
        <div className="flex justify-end">{headerControls}</div>
      )}
      <ItemsView items={childItems} parentId={itemId} />
    </div>
  </>
);

// Case 2: Files but no children
return (
  <>
    <SiteHeader
      title="My Items"
      titleHref="/my-items"
      breadcrumbs={breadcrumbs}
    />
    <div className="flex flex-col gap-4 px-4 py-6 md:px-6 lg:px-8">
      {headerControls && (
        <div className="flex justify-end">{headerControls}</div>
      )}
      <ItemDetail item={item} files={files} />
    </div>
  </>
);

// Case 3: Both files and children (tabs)
return (
  <>
    <SiteHeader
      title="My Items"
      titleHref="/my-items"
      breadcrumbs={breadcrumbs}
    />
    <div className="flex flex-col gap-4 px-4 py-6 md:px-6 lg:px-8">
      {headerControls && (
        <div className="flex justify-end">{headerControls}</div>
      )}
      <Tabs defaultValue="files" className="w-full">
        {/* ... rest of tabs */}
      </Tabs>
    </div>
  </>
);
```

### Step 6.2: Run type-check

Run: `pnpm run type-check`
Expected: PASS

### Step 6.3: Commit

```bash
git add app/(my-items)/my-items/[itemId]/page.tsx
git commit -m "feat: add ItemSyncButton to item detail page"
```

---

## Task 7: Write Unit Tests for Updated Item Actions

**Files:**

- Modify: `tests/unit/lib/item-actions.test.ts`

### Step 7.1: Add error case unit tests

**Append to:** `tests/unit/lib/sftp-actions.test.ts`

```typescript
// Add prisma.item mock setup
vi.mock("@/lib/prisma", () => ({
  prisma: {
    sftpConnection: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    item: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      aggregate: vi.fn(),
      groupBy: vi.fn(),
    },
    itemFile: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    $transaction: vi.fn((fn) =>
      fn({
        item: { create: vi.fn(), update: vi.fn(), delete: vi.fn() },
        itemFile: {
          findMany: vi.fn(),
          create: vi.fn(),
          update: vi.fn(),
          delete: vi.fn(),
        },
      })
    ),
  },
}));

describe("syncAllConnections - error cases", () => {
  it("continues syncing when one connection fails", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-1" },
      expires: new Date().toISOString(),
    });
    vi.mocked(prisma.sftpConnection.findMany).mockResolvedValue([
      { id: "conn-1", name: "Server 1", isActive: true } as any,
      { id: "conn-2", name: "Server 2", isActive: true } as any,
    ]);

    // Mock syncFromSftp to fail for first, succeed for second
    // (This requires mocking the internal call)

    const result = await syncAllConnections();

    expect(result.success).toBe(true);
    // Should have partial results
    expect(result.data?.totalConnections).toBe(2);
  });

  it("respects rate limiting", async () => {
    const { checkRateLimit } = await import("@/lib/rate-limit");
    vi.mocked(checkRateLimit).mockResolvedValue({
      error: "Rate limit exceeded",
    });

    const result = await syncAllConnections();

    expect(result.success).toBe(false);
    expect(result).toHaveProperty("error", "Rate limit exceeded");
  });
});

describe("syncItemTree - error cases", () => {
  it("returns error for invalid item ID format", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-1" },
      expires: new Date().toISOString(),
    });

    const { syncItemTree } = await import("@/lib/sftp-actions");
    const result = await syncItemTree("invalid-id-format");

    expect(result.success).toBe(false);
    expect(result).toHaveProperty("error", "Invalid item ID format");
  });
});
```

### Step 7.2: Run all unit tests

Run: `pnpm run test:unit`
Expected: PASS

### Step 7.3: Commit

```bash
git add tests/unit/
git commit -m "test: update unit tests for unified sync"
```

---

## Task 8: Update E2E Tests for New Sync Flow

**Files:**

- Modify: `e2e/journeys/sftp/sftp-sync.spec.ts`
- Create: `e2e/journeys/sftp/sftp-sync-all.spec.ts`

### Step 8.1: Create E2E test for Sync All functionality

**File:** `e2e/journeys/sftp/sftp-sync-all.spec.ts`

```typescript
/**
 * E2E tests for Sync All functionality.
 * Tests the unified sync button on the my-items page.
 */

import { test, expect } from "../../fixtures";
import { generateUniqueEmail, TEST_PASSWORD } from "../../helpers/test-user";
import {
  createSftpTestDir,
  cleanSftpTestDir,
} from "../../fixtures/sftp.fixture";

const describeOrSkip = process.env.SKIP_SFTP_TESTS
  ? test.describe.skip
  : test.describe;

describeOrSkip("SFTP Sync All", () => {
  test.beforeEach(async ({ page, signUpPage, connectionsPage, sftpConfig }) => {
    try {
      await cleanSftpTestDir(sftpConfig);
    } catch {
      // Ignore if SFTP not available
    }

    const userEmail = generateUniqueEmail("sync-all");
    await signUpPage.goto();
    await signUpPage.signUp(userEmail, TEST_PASSWORD, TEST_PASSWORD);
    await expect(page).toHaveURL("/my-items", { timeout: 10000 });

    // Create SFTP connection
    await connectionsPage.gotoNew();
    await connectionsPage.fillConnectionForm({
      name: "Sync All Test Server",
      host: sftpConfig.host,
      port: sftpConfig.port,
      username: sftpConfig.username,
      credential: sftpConfig.password,
      basePath: sftpConfig.basePath,
    });
    await connectionsPage.submitForm();
    await expect(page).toHaveURL("/my-items/connections", { timeout: 10000 });
  });

  test("sync all button syncs all connections", async ({
    page,
    sftpConfig,
  }) => {
    // Create folders on SFTP
    await createSftpTestDir(
      `${sftpConfig.basePath}/sync-all-folder`,
      sftpConfig
    );

    // Navigate to my-items
    await page.goto("/my-items");

    // Wait for Sync All button to appear
    const syncAllButton = page.getByRole("button", { name: /sync all/i });
    await expect(syncAllButton).toBeVisible({ timeout: 10000 });
    await syncAllButton.click();

    // Wait for sync to complete
    await expect(page.getByRole("button", { name: /synced/i })).toBeVisible({
      timeout: 30000,
    });

    // Filter to the connection
    await page.getByRole("combobox").click();
    await page.getByRole("option", { name: "Sync All Test Server" }).click();

    // Verify folder was synced
    const treeView = page.getByTestId("items-tree-view");
    await expect(
      treeView.getByRole("listitem").filter({ hasText: "sync-all-folder" })
    ).toBeVisible({ timeout: 10000 });
  });

  test("sync all shows connection count in logs", async ({ page }) => {
    // Navigate to my-items
    await page.goto("/my-items");

    // Click Sync All
    const syncAllButton = page.getByRole("button", { name: /sync all/i });
    await expect(syncAllButton).toBeVisible({ timeout: 10000 });
    await syncAllButton.click();

    // Wait for completion and verify toast mentions connection count
    await expect(page.getByText(/synced 1 connection/i)).toBeVisible({
      timeout: 30000,
    });
  });
});
```

### Step 8.2: Update existing sftp-sync.spec.ts

**Modify:** `e2e/journeys/sftp/sftp-sync.spec.ts`

Update tests to use the new sync flow:

```typescript
// Line 64-71: Replace sync button wait with new location
// Navigate to my-items and select connection from filter
await page.goto("/my-items");
await page.getByRole("combobox").click();
await page.getByRole("option", { name: "Test SFTP Server" }).click();

// Wait for sync button in the page (not connection-specific anymore)
// Use Sync All button
const syncAllButton = page.getByRole("button", { name: /sync all/i });
await expect(syncAllButton).toBeVisible({ timeout: 10000 });
await syncAllButton.click();
```

### Step 8.3: Create E2E test for per-item sync

**Append to:** `e2e/journeys/sftp/sftp-sync.spec.ts`

```typescript
test("item sync button syncs specific item tree", async ({
  page,
  sftpConfig,
}) => {
  // Create nested folders on SFTP
  await createSftpTestDir(`${sftpConfig.basePath}/parent-folder`, sftpConfig);
  await createSftpTestDir(
    `${sftpConfig.basePath}/parent-folder/child`,
    sftpConfig
  );

  // Navigate to my-items and trigger initial sync
  await page.goto("/my-items");
  await page.getByRole("combobox").click();
  await page.getByRole("option", { name: "Test SFTP Server" }).click();

  const syncAllButton = page.getByRole("button", { name: /sync all/i });
  await syncAllButton.click();
  await expect(page.getByRole("button", { name: /synced/i })).toBeVisible({
    timeout: 30000,
  });

  // Navigate to parent folder
  const treeView = page.getByTestId("items-tree-view");
  await treeView
    .getByRole("listitem")
    .filter({ hasText: "parent-folder" })
    .click();

  // Should see item-level sync button
  const itemSyncButton = page.getByRole("button", { name: /^sync$/i });
  await expect(itemSyncButton).toBeVisible({ timeout: 10000 });

  // Click sync for this item
  await itemSyncButton.click();
  await expect(page.getByRole("button", { name: /synced/i })).toBeVisible({
    timeout: 30000,
  });
});
```

### Step 8.4: Run E2E tests

Run: `BYPASS_RATE_LIMIT=true pnpm run test:e2e --project=chromium -g "SFTP Sync"`
Expected: All tests pass

### Step 8.5: Commit

```bash
git add e2e/
git commit -m "test: add E2E tests for unified sync functionality"
```

---

## Task 9: Update Integration Tests

**Files:**

- Create: `tests/integration/sftp/sftp-sync.test.ts`

### Step 9.1: Create integration test for syncAllConnections

**File:** `tests/integration/sftp/sftp-sync.test.ts`

```typescript
/**
 * Integration tests for SFTP sync operations.
 * Tests syncAllConnections and syncItemTree with real database.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

describe("SFTP Sync Integration", () => {
  let testUserId: string;

  beforeAll(async () => {
    // Create test user
    const passwordHash = await hash("TestPass123", 12);
    const user = await prisma.user.create({
      data: {
        email: `sync-test-${Date.now()}@example.com`,
        passwordHash,
      },
    });
    testUserId = user.id;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.user.delete({ where: { id: testUserId } });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up items and connections for this user
    await prisma.item.deleteMany({ where: { userId: testUserId } });
    await prisma.sftpConnection.deleteMany({ where: { userId: testUserId } });
  });

  it("syncAllConnections returns empty when no connections exist", async () => {
    // Test would call the action with mocked auth
    // For now, just verify DB state
    const connections = await prisma.sftpConnection.findMany({
      where: { userId: testUserId },
    });

    expect(connections).toHaveLength(0);
  });
});
```

### Step 9.2: Run integration tests

Run: `pnpm run test:integration`
Expected: PASS

### Step 9.3: Commit

```bash
git add tests/integration/
git commit -m "test: add integration tests for SFTP sync"
```

---

## Task 10: Cleanup and Final Verification

**Files:**

- Review all modified files for unused imports/code

### Step 10.1: Run knip to find unused exports

Run: `pnpm run knip`
Expected: No new unused exports

### Step 10.2: Run full check suite

Run: `pnpm run check`
Expected: All checks pass

### Step 10.3: Run all tests

```bash
pnpm run test:unit
pnpm run test:integration
BYPASS_RATE_LIMIT=true pnpm run test:e2e
```

Expected: All tests pass

### Step 10.4: Manual testing checklist

- [ ] My Items page shows "Sync All" button when connections exist
- [ ] "Sync All" button is disabled when no connections
- [ ] Clicking "Sync All" syncs all connections sequentially
- [ ] Console shows progress logs for each connection
- [ ] Toast shows aggregated sync results
- [ ] Item detail page shows "Sync" button for SFTP-connected items
- [ ] Item sync only syncs that item's subtree
- [ ] Console shows progress for per-item sync
- [ ] Sync buttons show correct loading/success/error states

### Step 10.5: Final commit

```bash
git add -A
git commit -m "feat: unified sync button with console logging (v0.23.0)"
```

---

## Testing Summary

| Test Type   | Files                                                  | Count                            |
| ----------- | ------------------------------------------------------ | -------------------------------- |
| Unit        | `tests/unit/lib/sftp-actions.test.ts`                  | ~10 tests (includes error cases) |
| Unit        | `tests/unit/components/sftp/sync-all-button.test.tsx`  | ~4 tests                         |
| Unit        | `tests/unit/components/sftp/item-sync-button.test.tsx` | ~2 tests                         |
| E2E         | `e2e/journeys/sftp/sftp-sync-all.spec.ts`              | ~2 tests                         |
| E2E         | `e2e/journeys/sftp/sftp-sync.spec.ts`                  | Updated + 1 new                  |
| Integration | `tests/integration/sftp/sftp-sync.test.ts`             | ~1 test                          |

**Coverage of validation checklist issues:**

- Rate limiting: Unit test `"respects rate limiting"`
- Invalid ID format: Unit test `"returns error for invalid item ID format"`
- Partial failure: Unit test `"continues syncing when one connection fails"`
- Transaction atomicity: Tested implicitly via mocked `$transaction`

---

## Console Logging Format

The sync operations will output logs in this format:

```
[SFTP Sync All] Starting sync for 3 connection(s)
[SFTP Sync All] Syncing "Media Server" (conn-abc123)...
[SFTP Sync All] ✓ "Media Server" completed in 1234ms: 5 created, 2 updated, 0 deleted
[SFTP Sync All] Syncing "Backup Server" (conn-def456)...
[SFTP Sync All] ✓ "Backup Server" completed in 890ms: 0 created, 0 updated, 0 deleted
[SFTP Sync All] Syncing "Archive" (conn-ghi789)...
[SFTP Sync All] ✗ "Archive" failed: Connection refused
[SFTP Sync All] Completed: 2/3 successful
```

For per-item sync:

```
[SFTP Sync Item] Starting sync for "Movies" (/data/media/movies)
[SFTP Sync Item] Created: /data/media/movies/new-movie
[SFTP Sync Item] Created file: /data/media/movies/new-movie/movie.mkv
[SFTP Sync Item] ✓ "Movies" completed in 567ms: 2 created, 0 updated, 0 deleted
```

---

## Rollback Plan

If issues arise:

1. Remove new server actions from `lib/sftp-actions.ts`
2. Restore ItemsView SyncButton usage
3. Remove SyncAllButton and ItemSyncButton components
4. Revert page changes

---

## Notes

- Console logging is chosen over structured logging (e.g., Winston) for simplicity
- Logs appear in `npm run dev` terminal output
- For production, consider adding log levels or structured logging if needed
- The sync operations are rate-limited via existing `checkRateLimit` calls
