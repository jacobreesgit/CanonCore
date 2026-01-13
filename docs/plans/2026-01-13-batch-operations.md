# Batch Operations Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement Google Drive Batch API for bulk delete/move operations to significantly improve performance when operating on multiple items.

**Architecture:** Use Google Drive's batch request API (multipart/mixed) to bundle up to 100 operations per request. Reduces 50 sequential API calls to a single batch request.

**Tech Stack:** Google Drive API v3 batch endpoint, googleapis library, Prisma

---

## Background

### Current Problem

Delete 50 items = 50 sequential API calls:

- Each call has ~100-200ms network overhead
- 50 items × 150ms = 7.5 seconds minimum
- User sees slow progress, poor UX

### Solution

Google Drive Batch API allows up to 100 operations per request:

- Single HTTP request for bulk operations
- Server processes in parallel
- Returns individual results for each sub-request
- 50 items in ~200-500ms total

---

## Task 1: Create Batch Request Builder

**Files:**

- Create: `lib/google-drive-batch.ts`
- Test: `tests/unit/lib/google-drive-batch.test.ts`

**Step 1: Write the failing test**

Create `tests/unit/lib/google-drive-batch.test.ts`:

```typescript
/**
 * Unit tests for Google Drive batch operations.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  buildBatchRequest,
  parseBatchResponse,
  BatchOperation,
  BatchResult,
} from "@/lib/google-drive-batch";

describe("google-drive-batch", () => {
  describe("buildBatchRequest", () => {
    it("creates multipart request body for delete operations", () => {
      const operations: BatchOperation[] = [
        { method: "PATCH", fileId: "file-1", body: { trashed: true } },
        { method: "PATCH", fileId: "file-2", body: { trashed: true } },
      ];

      const { body, boundary } = buildBatchRequest(operations);

      expect(boundary).toBeTruthy();
      expect(body).toContain("--" + boundary);
      expect(body).toContain("PATCH /drive/v3/files/file-1");
      expect(body).toContain("PATCH /drive/v3/files/file-2");
      expect(body).toContain('"trashed":true');
    });

    it("creates multipart request for move operations", () => {
      const operations: BatchOperation[] = [
        {
          method: "PATCH",
          fileId: "file-1",
          params: { addParents: "folder-new", removeParents: "folder-old" },
        },
      ];

      const { body } = buildBatchRequest(operations);

      expect(body).toContain("addParents=folder-new");
      expect(body).toContain("removeParents=folder-old");
    });

    it("limits to 100 operations", () => {
      const operations: BatchOperation[] = Array.from(
        { length: 150 },
        (_, i) => ({
          method: "PATCH" as const,
          fileId: `file-${i}`,
          body: { trashed: true },
        })
      );

      expect(() => buildBatchRequest(operations)).toThrow(
        "Batch limit exceeded: max 100 operations"
      );
    });
  });

  describe("parseBatchResponse", () => {
    it("parses successful batch response", () => {
      const boundary = "batch_abc123";
      const responseBody = `--batch_abc123
Content-Type: application/http

HTTP/1.1 200 OK
Content-Type: application/json

{"id":"file-1"}
--batch_abc123
Content-Type: application/http

HTTP/1.1 200 OK
Content-Type: application/json

{"id":"file-2"}
--batch_abc123--`;

      const results = parseBatchResponse(responseBody, boundary);

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({
        success: true,
        fileId: "file-1",
        status: 200,
      });
      expect(results[1]).toEqual({
        success: true,
        fileId: "file-2",
        status: 200,
      });
    });

    it("handles mixed success/failure responses", () => {
      const boundary = "batch_xyz";
      const responseBody = `--batch_xyz
Content-Type: application/http

HTTP/1.1 200 OK
Content-Type: application/json

{"id":"file-1"}
--batch_xyz
Content-Type: application/http

HTTP/1.1 404 Not Found
Content-Type: application/json

{"error":{"message":"File not found"}}
--batch_xyz--`;

      const results = parseBatchResponse(responseBody, boundary);

      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[1].error).toBe("File not found");
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/lib/google-drive-batch.test.ts`
Expected: FAIL - module doesn't exist

**Step 3: Write minimal implementation**

Create `lib/google-drive-batch.ts`:

```typescript
/**
 * Google Drive Batch API utilities.
 * Enables bulk operations (delete, move) in a single HTTP request.
 *
 * @see https://developers.google.com/drive/api/guides/performance#batch-requests
 */

import { logger } from "@/lib/logger";

/** Maximum operations per batch request */
const MAX_BATCH_SIZE = 100;

/** HTTP method for batch operations */
export type BatchMethod = "PATCH" | "DELETE";

/** A single operation in a batch request */
export interface BatchOperation {
  method: BatchMethod;
  fileId: string;
  body?: Record<string, unknown>;
  params?: Record<string, string>;
}

/** Result of a single operation in a batch response */
export interface BatchResult {
  success: boolean;
  fileId: string;
  status: number;
  error?: string;
}

/**
 * Builds a multipart/mixed batch request body.
 *
 * @param operations - Array of operations to batch
 * @returns Object with body string and boundary
 * @throws Error if operations exceed MAX_BATCH_SIZE
 */
export function buildBatchRequest(operations: BatchOperation[]): {
  body: string;
  boundary: string;
} {
  if (operations.length > MAX_BATCH_SIZE) {
    throw new Error(`Batch limit exceeded: max ${MAX_BATCH_SIZE} operations`);
  }

  const boundary = `batch_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
  const parts: string[] = [];

  for (const op of operations) {
    // Build query string if params exist
    const queryString = op.params
      ? "?" + new URLSearchParams(op.params).toString()
      : "";

    const path = `/drive/v3/files/${op.fileId}${queryString}`;

    let part = `--${boundary}\r\n`;
    part += `Content-Type: application/http\r\n\r\n`;
    part += `${op.method} ${path} HTTP/1.1\r\n`;

    if (op.body) {
      part += `Content-Type: application/json\r\n\r\n`;
      part += JSON.stringify(op.body);
    } else {
      part += `\r\n`;
    }

    parts.push(part);
  }

  const body = parts.join("\r\n") + `\r\n--${boundary}--`;

  return { body, boundary };
}

/**
 * Parses a multipart/mixed batch response.
 *
 * @param responseBody - Raw response body
 * @param boundary - Boundary string from Content-Type header
 * @returns Array of results for each operation
 */
export function parseBatchResponse(
  responseBody: string,
  boundary: string
): BatchResult[] {
  const results: BatchResult[] = [];
  const parts = responseBody.split(`--${boundary}`);

  for (const part of parts) {
    // Skip empty parts and closing boundary
    if (!part.trim() || part.trim() === "--") continue;

    // Extract HTTP status line
    const statusMatch = part.match(/HTTP\/1\.1 (\d+)/);
    const status = statusMatch ? parseInt(statusMatch[1], 10) : 0;

    // Extract JSON body
    const jsonMatch = part.match(/\{[\s\S]*\}/);
    let fileId = "";
    let error: string | undefined;

    if (jsonMatch) {
      try {
        const json = JSON.parse(jsonMatch[0]);
        fileId = json.id || "";
        if (json.error?.message) {
          error = json.error.message;
        }
      } catch {
        logger.warn({ part }, "[Batch] Failed to parse response part");
      }
    }

    results.push({
      success: status >= 200 && status < 300,
      fileId,
      status,
      error,
    });
  }

  return results;
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/lib/google-drive-batch.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/google-drive-batch.ts tests/unit/lib/google-drive-batch.test.ts
git commit -m "$(cat <<'EOF'
feat(google-drive): add batch request builder and parser

Utilities for Google Drive Batch API multipart/mixed format.
Supports up to 100 operations per batch request.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Implement Batch Delete

**Files:**

- Modify: `lib/google-drive-client.ts`
- Test: `tests/unit/lib/google-drive-client.test.ts`

**Step 1: Write the failing test**

Add to `tests/unit/lib/google-drive-client.test.ts`:

```typescript
describe("batchDelete", () => {
  it("deletes multiple files in single request", async () => {
    // Mock successful batch response
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      headers: new Headers({
        "content-type": "multipart/mixed; boundary=batch_abc123",
      }),
      text: async () => `--batch_abc123
Content-Type: application/http

HTTP/1.1 200 OK
Content-Type: application/json

{"id":"file-1"}
--batch_abc123
Content-Type: application/http

HTTP/1.1 200 OK
Content-Type: application/json

{"id":"file-2"}
--batch_abc123--`,
    } as Response);

    const result = await batchDelete("test-access-token", ["file-1", "file-2"]);

    expect(result.succeeded).toEqual(["file-1", "file-2"]);
    expect(result.failed).toEqual([]);
  });

  it("reports partial failures", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      headers: new Headers({
        "content-type": "multipart/mixed; boundary=batch_xyz",
      }),
      text: async () => `--batch_xyz
Content-Type: application/http

HTTP/1.1 200 OK
Content-Type: application/json

{"id":"file-1"}
--batch_xyz
Content-Type: application/http

HTTP/1.1 404 Not Found
Content-Type: application/json

{"error":{"message":"File not found"}}
--batch_xyz--`,
    } as Response);

    const result = await batchDelete("token", ["file-1", "file-2"]);

    expect(result.succeeded).toContain("file-1");
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].error).toBe("File not found");
  });

  it("chunks large batches into multiple requests", async () => {
    const fileIds = Array.from({ length: 150 }, (_, i) => `file-${i}`);

    // Mock two successful batch responses
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(createMockBatchResponse(100))
      .mockResolvedValueOnce(createMockBatchResponse(50));

    const result = await batchDelete("token", fileIds);

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(result.succeeded).toHaveLength(150);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/lib/google-drive-client.test.ts -t "batchDelete"`
Expected: FAIL - function doesn't exist

**Step 3: Write minimal implementation**

Add to `lib/google-drive-client.ts`:

```typescript
import {
  buildBatchRequest,
  parseBatchResponse,
  BatchOperation,
} from "@/lib/google-drive-batch";

/** Result of a batch delete operation */
export interface BatchDeleteResult {
  succeeded: string[];
  failed: Array<{ fileId: string; error: string }>;
}

/**
 * Deletes multiple files in batch.
 * Automatically chunks into multiple requests if > 100 files.
 *
 * @param accessToken - Valid OAuth access token
 * @param fileIds - Array of file IDs to delete (move to trash)
 * @returns Object with succeeded and failed file IDs
 */
export async function batchDelete(
  accessToken: string,
  fileIds: string[]
): Promise<BatchDeleteResult> {
  const result: BatchDeleteResult = { succeeded: [], failed: [] };

  // Chunk into batches of 100
  const chunks: string[][] = [];
  for (let i = 0; i < fileIds.length; i += 100) {
    chunks.push(fileIds.slice(i, i + 100));
  }

  for (const chunk of chunks) {
    const operations: BatchOperation[] = chunk.map((fileId) => ({
      method: "PATCH",
      fileId,
      body: { trashed: true },
    }));

    const { body, boundary } = buildBatchRequest(operations);

    const response = await fetch("https://www.googleapis.com/batch/drive/v3", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/mixed; boundary=${boundary}`,
      },
      body,
    });

    if (!response.ok) {
      // Entire batch failed
      for (const fileId of chunk) {
        result.failed.push({
          fileId,
          error: `Batch request failed: ${response.status}`,
        });
      }
      continue;
    }

    // Extract boundary from response Content-Type
    const contentType = response.headers.get("content-type") || "";
    const responseBoundary =
      contentType.match(/boundary=([^\s;]+)/)?.[1] || boundary;

    const responseBody = await response.text();
    const batchResults = parseBatchResponse(responseBody, responseBoundary);

    // Map results back to file IDs
    for (let i = 0; i < chunk.length; i++) {
      const fileId = chunk[i];
      const batchResult = batchResults[i];

      if (batchResult?.success) {
        result.succeeded.push(fileId);
      } else {
        result.failed.push({
          fileId,
          error: batchResult?.error || "Unknown error",
        });
      }
    }
  }

  return result;
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/lib/google-drive-client.test.ts -t "batchDelete"`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/google-drive-client.ts tests/unit/lib/google-drive-client.test.ts
git commit -m "$(cat <<'EOF'
feat(google-drive): implement batch delete operation

Deletes up to 100 files per batch request, automatically chunking
larger sets. Returns succeeded/failed arrays for error handling.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Implement Batch Move

**Files:**

- Modify: `lib/google-drive-client.ts`
- Test: `tests/unit/lib/google-drive-client.test.ts`

**Step 1: Write the failing test**

Add to `tests/unit/lib/google-drive-client.test.ts`:

```typescript
describe("batchMove", () => {
  it("moves multiple files to new parent", async () => {
    vi.mocked(global.fetch).mockResolvedValue(createMockBatchResponse(3, true));

    const result = await batchMove(
      "token",
      ["file-1", "file-2", "file-3"],
      "new-parent",
      "old-parent"
    );

    expect(result.succeeded).toHaveLength(3);

    // Verify request contains correct params
    expect(global.fetch).toHaveBeenCalledWith(
      "https://www.googleapis.com/batch/drive/v3",
      expect.objectContaining({
        body: expect.stringContaining("addParents=new-parent"),
      })
    );
  });

  it("handles files from different parents", async () => {
    vi.mocked(global.fetch).mockResolvedValue(createMockBatchResponse(2, true));

    const result = await batchMoveFromDifferentParents(
      "token",
      [
        { fileId: "file-1", oldParentId: "parent-a" },
        { fileId: "file-2", oldParentId: "parent-b" },
      ],
      "new-parent"
    );

    expect(result.succeeded).toHaveLength(2);
  });
});
```

**Step 2: Run test to verify it fails**

**Step 3: Write minimal implementation**

Add to `lib/google-drive-client.ts`:

```typescript
/** Result of a batch move operation */
export interface BatchMoveResult {
  succeeded: string[];
  failed: Array<{ fileId: string; error: string }>;
}

/**
 * Moves multiple files to a new parent folder in batch.
 * All files must currently be in the same parent.
 *
 * @param accessToken - Valid OAuth access token
 * @param fileIds - Array of file IDs to move
 * @param newParentId - Destination folder ID
 * @param oldParentId - Current parent folder ID
 * @returns Object with succeeded and failed file IDs
 */
export async function batchMove(
  accessToken: string,
  fileIds: string[],
  newParentId: string,
  oldParentId: string
): Promise<BatchMoveResult> {
  const result: BatchMoveResult = { succeeded: [], failed: [] };

  const chunks: string[][] = [];
  for (let i = 0; i < fileIds.length; i += 100) {
    chunks.push(fileIds.slice(i, i + 100));
  }

  for (const chunk of chunks) {
    const operations: BatchOperation[] = chunk.map((fileId) => ({
      method: "PATCH",
      fileId,
      params: {
        addParents: newParentId,
        removeParents: oldParentId,
      },
    }));

    const { body, boundary } = buildBatchRequest(operations);

    const response = await fetch("https://www.googleapis.com/batch/drive/v3", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/mixed; boundary=${boundary}`,
      },
      body,
    });

    if (!response.ok) {
      for (const fileId of chunk) {
        result.failed.push({
          fileId,
          error: `Batch request failed: ${response.status}`,
        });
      }
      continue;
    }

    const contentType = response.headers.get("content-type") || "";
    const responseBoundary =
      contentType.match(/boundary=([^\s;]+)/)?.[1] || boundary;
    const responseBody = await response.text();
    const batchResults = parseBatchResponse(responseBody, responseBoundary);

    for (let i = 0; i < chunk.length; i++) {
      const fileId = chunk[i];
      const batchResult = batchResults[i];

      if (batchResult?.success) {
        result.succeeded.push(fileId);
      } else {
        result.failed.push({
          fileId,
          error: batchResult?.error || "Unknown error",
        });
      }
    }
  }

  return result;
}

/** Input for moving files from different parents */
export interface MoveFromDifferentParent {
  fileId: string;
  oldParentId: string;
}

/**
 * Moves files from different parent folders to a single destination.
 *
 * @param accessToken - Valid OAuth access token
 * @param files - Array of file IDs with their current parent IDs
 * @param newParentId - Destination folder ID
 * @returns Object with succeeded and failed file IDs
 */
export async function batchMoveFromDifferentParents(
  accessToken: string,
  files: MoveFromDifferentParent[],
  newParentId: string
): Promise<BatchMoveResult> {
  const result: BatchMoveResult = { succeeded: [], failed: [] };

  const chunks: MoveFromDifferentParent[][] = [];
  for (let i = 0; i < files.length; i += 100) {
    chunks.push(files.slice(i, i + 100));
  }

  for (const chunk of chunks) {
    const operations: BatchOperation[] = chunk.map((file) => ({
      method: "PATCH",
      fileId: file.fileId,
      params: {
        addParents: newParentId,
        removeParents: file.oldParentId,
      },
    }));

    const { body, boundary } = buildBatchRequest(operations);

    const response = await fetch("https://www.googleapis.com/batch/drive/v3", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/mixed; boundary=${boundary}`,
      },
      body,
    });

    if (!response.ok) {
      for (const file of chunk) {
        result.failed.push({
          fileId: file.fileId,
          error: `Batch failed: ${response.status}`,
        });
      }
      continue;
    }

    const contentType = response.headers.get("content-type") || "";
    const responseBoundary =
      contentType.match(/boundary=([^\s;]+)/)?.[1] || boundary;
    const responseBody = await response.text();
    const batchResults = parseBatchResponse(responseBody, responseBoundary);

    for (let i = 0; i < chunk.length; i++) {
      const file = chunk[i];
      const batchResult = batchResults[i];

      if (batchResult?.success) {
        result.succeeded.push(file.fileId);
      } else {
        result.failed.push({
          fileId: file.fileId,
          error: batchResult?.error || "Unknown error",
        });
      }
    }
  }

  return result;
}
```

**Step 4: Run test to verify it passes**

**Step 5: Commit**

```bash
git add lib/google-drive-client.ts tests/unit/lib/google-drive-client.test.ts
git commit -m "$(cat <<'EOF'
feat(google-drive): implement batch move operations

Adds batchMove() for files in same parent and
batchMoveFromDifferentParents() for mixed-parent moves.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Integrate Batch Delete into Delete Action

**Files:**

- Modify: `lib/google-drive-actions.ts`
- Modify: `lib/item-actions.ts`
- Test: `tests/unit/lib/item-actions.test.ts`

**Step 1: Write the failing test**

Add to `tests/unit/lib/item-actions.test.ts`:

```typescript
describe("deleteItem - batch operations", () => {
  it("uses batch delete for items with children", async () => {
    // Setup: item with 10 children, each with driveFileId
    vi.mocked(prisma.item.findUnique).mockResolvedValue({
      id: "parent-1",
      driveFileId: "drive-parent",
      children: Array.from({ length: 10 }, (_, i) => ({
        id: `child-${i}`,
        driveFileId: `drive-child-${i}`,
        children: [],
      })),
    } as any);

    vi.mocked(batchDelete).mockResolvedValue({
      succeeded: Array.from({ length: 11 }, (_, i) =>
        i === 0 ? "drive-parent" : `drive-child-${i - 1}`
      ),
      failed: [],
    });

    await deleteItem("parent-1");

    // Should call batchDelete with all file IDs
    expect(batchDelete).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining(["drive-parent", "drive-child-0"])
    );
  });

  it("falls back to sequential delete on batch failure", async () => {
    vi.mocked(batchDelete).mockRejectedValue(new Error("Batch API error"));

    // Should still succeed using sequential deletes
    await deleteItem("item-1");

    expect(deleteFile).toHaveBeenCalled();
  });
});
```

**Step 2: Run test to verify it fails**

**Step 3: Write minimal implementation**

Update `lib/item-actions.ts` `deleteItem` function:

```typescript
import { batchDelete, deleteFile } from "@/lib/google-drive-client";
import { decryptCredential } from "@/lib/crypto";

export async function deleteItem(itemId: string) {
  // ... existing auth check ...

  const item = await prisma.item.findUnique({
    where: { id: itemId },
    include: {
      children: {
        include: {
          children: { include: { children: true } }, // 3 levels deep
        },
      },
      driveConnection: true,
    },
  });

  if (!item) {
    return { success: false, error: "Item not found" };
  }

  // Collect all Drive file IDs (item + descendants)
  const driveFileIds: string[] = [];
  function collectDriveIds(node: typeof item) {
    if (node.driveFileId) {
      driveFileIds.push(node.driveFileId);
    }
    for (const child of node.children || []) {
      collectDriveIds(child);
    }
  }
  collectDriveIds(item);

  // Use batch delete if we have a connection and multiple files
  if (item.driveConnection && driveFileIds.length > 1) {
    try {
      const accessToken = await getAccessToken(item.driveConnection);
      const batchResult = await batchDelete(accessToken, driveFileIds);

      if (batchResult.failed.length > 0) {
        logger.warn(
          { failed: batchResult.failed },
          "[Delete] Some Drive files failed to delete"
        );
      }
    } catch (error) {
      // Log but continue - we'll still delete from DB
      logger.error({ err: error }, "[Delete] Batch delete failed, continuing");
    }
  } else if (item.driveConnection && driveFileIds.length === 1) {
    // Single file - use standard delete
    try {
      const drive = await getDriveClient(item.driveConnection);
      await deleteFile(drive, driveFileIds[0]);
    } catch (error) {
      logger.error({ err: error }, "[Delete] Drive delete failed");
    }
  }

  // Delete from database (cascades to children)
  await prisma.item.delete({ where: { id: itemId } });

  return { success: true };
}
```

**Step 4: Run test to verify it passes**

**Step 5: Commit**

```bash
git add lib/item-actions.ts tests/unit/lib/item-actions.test.ts
git commit -m "$(cat <<'EOF'
feat(items): use batch delete for items with children

Significantly improves delete performance for folders with
many children by batching Drive API calls.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Add Batch Operations Integration Tests

**Files:**

- Create: `tests/integration/google-drive/batch-operations.test.ts`

**Step 1: Create integration test**

```typescript
/**
 * Integration tests for batch operations.
 * Tests real batch API behavior with mocked auth.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { batchDelete, batchMove } from "@/lib/google-drive-client";

// These tests require GOOGLE_TEST_REFRESH_TOKEN for real API calls
const SKIP_INTEGRATION = !process.env.GOOGLE_TEST_REFRESH_TOKEN;

describe.skipIf(SKIP_INTEGRATION)("batch operations integration", () => {
  let accessToken: string;

  beforeEach(async () => {
    // Get fresh access token
    accessToken = await getTestAccessToken();
  });

  it("batch deletes multiple test files", async () => {
    // Create test files
    const fileIds = await createTestFiles(3);

    const result = await batchDelete(accessToken, fileIds);

    expect(result.succeeded).toHaveLength(3);
    expect(result.failed).toHaveLength(0);

    // Verify files are trashed
    for (const fileId of fileIds) {
      const file = await getFile(accessToken, fileId);
      expect(file.trashed).toBe(true);
    }
  });

  it("handles non-existent files gracefully", async () => {
    const result = await batchDelete(accessToken, [
      "nonexistent-file-id-12345",
    ]);

    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].error).toContain("not found");
  });
});
```

**Step 2: Run integration tests**

Run: `pnpm test:integration tests/integration/google-drive/batch-operations.test.ts`

**Step 3: Commit**

```bash
git add tests/integration/google-drive/batch-operations.test.ts
git commit -m "$(cat <<'EOF'
test(integration): add batch operations integration tests

Tests real batch API behavior with test Drive account.
Skipped when GOOGLE_TEST_REFRESH_TOKEN not available.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: E2E Test for Batch Delete

**Files:**

- Modify: `e2e/journeys/google-drive/drive-sync.spec.ts`

**Step 1: Add E2E test**

```typescript
test("deletes folder with children efficiently", async ({
  page,
  setupDriveConnection,
  testUser,
  cleanupTestDriveFolders,
}) => {
  await cleanupTestDriveFolders();
  await setupDriveConnection(testUser.id);

  // Create folder with children
  await itemsPage.createItem("Batch Delete Test");
  await itemsPage.openItem("Batch Delete Test");
  await itemsPage.createItem("Child 1");
  await itemsPage.createItem("Child 2");
  await itemsPage.createItem("Child 3");

  // Wait for all items to sync
  await expect(async () => {
    const items = await prisma.item.findMany({
      where: { userId: testUser.id },
    });
    expect(items.every((i) => i.driveFileId)).toBe(true);
  }).toPass({ timeout: 30000 });

  // Go back and delete parent
  await page.goBack();
  await itemsPage.deleteItem("Batch Delete Test");

  // Verify all items deleted
  await expect(itemsPage.getItemCard("Batch Delete Test")).not.toBeVisible();

  // Verify children also deleted from DB
  const remaining = await prisma.item.count({
    where: { userId: testUser.id },
  });
  expect(remaining).toBe(0);
});
```

**Step 2: Commit**

```bash
git add e2e/journeys/google-drive/drive-sync.spec.ts
git commit -m "$(cat <<'EOF'
test(e2e): verify batch delete for folders with children

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Testing Summary

### New Tests

| Type        | File                                                      | Tests                                  |
| ----------- | --------------------------------------------------------- | -------------------------------------- |
| Unit        | `tests/unit/lib/google-drive-batch.test.ts`               | Batch request builder/parser (5 tests) |
| Unit        | `tests/unit/lib/google-drive-client.test.ts`              | batchDelete, batchMove (5 tests)       |
| Unit        | `tests/unit/lib/item-actions.test.ts`                     | Batch delete integration (2 tests)     |
| Integration | `tests/integration/google-drive/batch-operations.test.ts` | Real API batch tests (2 tests)         |
| E2E         | `e2e/journeys/google-drive/drive-sync.spec.ts`            | Batch delete folder (1 test)           |

### Existing Tests - Updates Needed

| File                                  | Change                      |
| ------------------------------------- | --------------------------- |
| `tests/unit/lib/item-actions.test.ts` | Add mocks for `batchDelete` |

---

## Performance Expectations

| Operation        | Before (Sequential) | After (Batch) | Improvement |
| ---------------- | ------------------- | ------------- | ----------- |
| Delete 10 items  | ~1.5s               | ~200ms        | 7.5x faster |
| Delete 50 items  | ~7.5s               | ~300ms        | 25x faster  |
| Delete 100 items | ~15s                | ~400ms        | 37x faster  |
| Move 50 items    | ~7.5s               | ~300ms        | 25x faster  |

---

## Final Checklist

- [ ] Batch request builder and parser utilities
- [ ] batchDelete function with chunking
- [ ] batchMove function with chunking
- [ ] batchMoveFromDifferentParents for mixed-parent moves
- [ ] Integration with deleteItem action
- [ ] Unit tests for all batch functions
- [ ] Integration tests with real API
- [ ] E2E test for folder deletion
- [ ] Performance logging for comparison
