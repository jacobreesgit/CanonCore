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

### Important Implementation Notes

> **Response Ordering:** Google Batch API responses may not return in request order. The implementation uses `content-id` headers for request/response correlation to ensure correct result mapping. This is critical for accurate success/failure attribution.

> **Token Refresh:** Batch operations should integrate with the existing token refresh logic in `google-drive-client.ts`. If a batch spans a long duration, tokens may expire mid-operation.

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
      // Verify content-id headers for response correlation
      expect(body).toContain("Content-ID: <item-0>");
      expect(body).toContain("Content-ID: <item-1>");
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

    it("returns early for empty operations array", () => {
      const { body, boundary } = buildBatchRequest([]);

      expect(body).toBe("");
      expect(boundary).toBe("");
    });
  });

  describe("parseBatchResponse", () => {
    it("parses successful batch response using content-id", () => {
      const boundary = "batch_abc123";
      const responseBody = `--batch_abc123
Content-Type: application/http
Content-ID: <response-item-0>

HTTP/1.1 200 OK
Content-Type: application/json

{"id":"file-1"}
--batch_abc123
Content-Type: application/http
Content-ID: <response-item-1>

HTTP/1.1 200 OK
Content-Type: application/json

{"id":"file-2"}
--batch_abc123--`;

      const fileIds = ["file-1", "file-2"];
      const results = parseBatchResponse(responseBody, boundary, fileIds);

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
Content-ID: <response-item-0>

HTTP/1.1 200 OK
Content-Type: application/json

{"id":"file-1"}
--batch_xyz
Content-Type: application/http
Content-ID: <response-item-1>

HTTP/1.1 404 Not Found
Content-Type: application/json

{"error":{"message":"File not found"}}
--batch_xyz--`;

      const fileIds = ["file-1", "file-2"];
      const results = parseBatchResponse(responseBody, boundary, fileIds);

      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[1].error).toBe("File not found");
    });

    it("handles out-of-order responses correctly", () => {
      const boundary = "batch_ooo";
      // Response comes back in reverse order
      const responseBody = `--batch_ooo
Content-Type: application/http
Content-ID: <response-item-1>

HTTP/1.1 200 OK
Content-Type: application/json

{"id":"file-2"}
--batch_ooo
Content-Type: application/http
Content-ID: <response-item-0>

HTTP/1.1 404 Not Found
Content-Type: application/json

{"error":{"message":"File not found"}}
--batch_ooo--`;

      const fileIds = ["file-1", "file-2"];
      const results = parseBatchResponse(responseBody, boundary, fileIds);

      // Results should be correctly mapped despite out-of-order response
      expect(results[0].fileId).toBe("file-1");
      expect(results[0].success).toBe(false);
      expect(results[1].fileId).toBe("file-2");
      expect(results[1].success).toBe(true);
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

/** Maximum operations per batch request (Google API limit) */
const MAX_BATCH_SIZE = 100;

/** Default timeout for batch requests in milliseconds */
const BATCH_TIMEOUT_MS = 30000;

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
 * Includes content-id headers for request/response correlation.
 *
 * @param operations - Array of operations to batch
 * @returns Object with body string and boundary (empty strings if no operations)
 * @throws Error if operations exceed MAX_BATCH_SIZE
 */
export function buildBatchRequest(operations: BatchOperation[]): {
  body: string;
  boundary: string;
} {
  // Handle empty array - return early
  if (operations.length === 0) {
    return { body: "", boundary: "" };
  }

  if (operations.length > MAX_BATCH_SIZE) {
    throw new Error(`Batch limit exceeded: max ${MAX_BATCH_SIZE} operations`);
  }

  const boundary = `batch_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
  const parts: string[] = [];

  for (let i = 0; i < operations.length; i++) {
    const op = operations[i];

    // Build query string if params exist
    const queryString = op.params
      ? "?" + new URLSearchParams(op.params).toString()
      : "";

    const path = `/drive/v3/files/${op.fileId}${queryString}`;

    let part = `--${boundary}\r\n`;
    part += `Content-Type: application/http\r\n`;
    // Content-ID for request/response correlation (critical for out-of-order responses)
    part += `Content-ID: <item-${i}>\r\n`;
    part += `Content-Transfer-Encoding: binary\r\n\r\n`;
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
 * Uses Content-ID headers to correctly correlate responses with requests,
 * handling cases where Google returns responses out of order.
 *
 * @param responseBody - Raw response body
 * @param boundary - Boundary string from Content-Type header
 * @param fileIds - Original file IDs in request order for correlation
 * @returns Array of results for each operation, in original request order
 */
export function parseBatchResponse(
  responseBody: string,
  boundary: string,
  fileIds: string[]
): BatchResult[] {
  // Initialize results array with placeholders
  const results: BatchResult[] = fileIds.map((fileId) => ({
    success: false,
    fileId,
    status: 0,
    error: "No response received",
  }));

  const parts = responseBody.split(`--${boundary}`);

  for (const part of parts) {
    // Skip empty parts and closing boundary
    if (!part.trim() || part.trim() === "--") continue;

    // Extract Content-ID to determine which request this response is for
    const contentIdMatch = part.match(/Content-ID:\s*<response-item-(\d+)>/i);
    const requestIndex = contentIdMatch ? parseInt(contentIdMatch[1], 10) : -1;

    // Extract HTTP status line
    const statusMatch = part.match(/HTTP\/1\.1 (\d+)/);
    const status = statusMatch ? parseInt(statusMatch[1], 10) : 0;

    // Extract JSON body
    const jsonMatch = part.match(/\{[\s\S]*\}/);
    let error: string | undefined;

    if (jsonMatch) {
      try {
        const json = JSON.parse(jsonMatch[0]);
        if (json.error?.message) {
          error = json.error.message;
        }
      } catch {
        logger.warn(
          { part: part.slice(0, 200) },
          "[Batch] Failed to parse response part"
        );
      }
    }

    // Map result to correct position using Content-ID
    if (requestIndex >= 0 && requestIndex < results.length) {
      results[requestIndex] = {
        success: status >= 200 && status < 300,
        fileId: fileIds[requestIndex],
        status,
        error,
      };
    } else {
      // Fallback: try to find by fileId in response (less reliable)
      logger.warn(
        { contentIdMatch, requestIndex },
        "[Batch] Could not correlate response by Content-ID"
      );
    }
  }

  return results;
}

/**
 * Returns the batch timeout in milliseconds.
 * Exposed for testing and configuration.
 */
export function getBatchTimeout(): number {
  return BATCH_TIMEOUT_MS;
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
Uses Content-ID headers for request/response correlation.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Implement Batch Delete

**Files:**

- Modify: `lib/google-drive-client.ts`
- Test: `tests/unit/lib/google-drive-client.test.ts`

**Step 1: Add test helper**

Add to top of `tests/unit/lib/google-drive-client.test.ts`:

```typescript
/**
 * Creates a mock batch response for testing.
 *
 * @param count - Number of successful responses to include
 * @param includeFileIds - Whether to include file IDs in responses
 * @returns Mock Response object
 */
function createMockBatchResponse(
  count: number,
  includeFileIds = true
): Response {
  const boundary = "batch_mock123";
  let body = "";

  for (let i = 0; i < count; i++) {
    body += `--${boundary}\r\n`;
    body += `Content-Type: application/http\r\n`;
    body += `Content-ID: <response-item-${i}>\r\n\r\n`;
    body += `HTTP/1.1 200 OK\r\n`;
    body += `Content-Type: application/json\r\n\r\n`;
    body += includeFileIds ? `{"id":"file-${i}"}\r\n` : `{}\r\n`;
  }
  body += `--${boundary}--`;

  return {
    ok: true,
    headers: new Headers({
      "content-type": `multipart/mixed; boundary=${boundary}`,
    }),
    text: async () => body,
  } as Response;
}
```

**Step 2: Write the failing test**

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
Content-ID: <response-item-0>

HTTP/1.1 200 OK
Content-Type: application/json

{"id":"file-1"}
--batch_abc123
Content-Type: application/http
Content-ID: <response-item-1>

HTTP/1.1 200 OK
Content-Type: application/json

{"id":"file-2"}
--batch_abc123--`,
    } as Response);

    const result = await batchDelete("test-access-token", ["file-1", "file-2"]);

    expect(result.succeeded).toEqual(["file-1", "file-2"]);
    expect(result.failed).toEqual([]);
  });

  it("returns empty result for empty file array", async () => {
    const result = await batchDelete("token", []);

    expect(result.succeeded).toEqual([]);
    expect(result.failed).toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("reports partial failures", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      headers: new Headers({
        "content-type": "multipart/mixed; boundary=batch_xyz",
      }),
      text: async () => `--batch_xyz
Content-Type: application/http
Content-ID: <response-item-0>

HTTP/1.1 200 OK
Content-Type: application/json

{"id":"file-1"}
--batch_xyz
Content-Type: application/http
Content-ID: <response-item-1>

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

  it("aborts on timeout", async () => {
    vi.mocked(global.fetch).mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 60000))
    );

    await expect(batchDelete("token", ["file-1"])).rejects.toThrow(
      /aborted|timeout/i
    );
  });
});
```

**Step 3: Run test to verify it fails**

Run: `pnpm test tests/unit/lib/google-drive-client.test.ts -t "batchDelete"`
Expected: FAIL - function doesn't exist

**Step 4: Write minimal implementation**

Add to `lib/google-drive-client.ts`:

```typescript
import {
  buildBatchRequest,
  parseBatchResponse,
  BatchOperation,
  getBatchTimeout,
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

  // Handle empty array - return early
  if (fileIds.length === 0) {
    return result;
  }

  const startTime = Date.now();

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

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), getBatchTimeout());

    try {
      const response = await fetch(
        "https://www.googleapis.com/batch/drive/v3",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": `multipart/mixed; boundary=${boundary}`,
          },
          body,
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

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
      const batchResults = parseBatchResponse(
        responseBody,
        responseBoundary,
        chunk
      );

      // Collect results
      for (const batchResult of batchResults) {
        if (batchResult.success) {
          result.succeeded.push(batchResult.fileId);
        } else {
          result.failed.push({
            fileId: batchResult.fileId,
            error: batchResult.error || "Unknown error",
          });
        }
      }
    } catch (error) {
      clearTimeout(timeoutId);

      // Handle abort/timeout
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`Batch delete timeout after ${getBatchTimeout()}ms`);
      }

      // Log and fail all items in this chunk
      logger.error({ err: error, chunk }, "[Batch] Request failed");
      for (const fileId of chunk) {
        result.failed.push({
          fileId,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  }

  // Log performance metrics
  const duration = Date.now() - startTime;
  logger.info(
    {
      duration,
      total: fileIds.length,
      succeeded: result.succeeded.length,
      failed: result.failed.length,
    },
    "[Batch] Delete completed"
  );

  return result;
}
```

**Step 5: Run test to verify it passes**

Run: `pnpm test tests/unit/lib/google-drive-client.test.ts -t "batchDelete"`
Expected: PASS

**Step 6: Commit**

```bash
git add lib/google-drive-client.ts tests/unit/lib/google-drive-client.test.ts
git commit -m "$(cat <<'EOF'
feat(google-drive): implement batch delete operation

Deletes up to 100 files per batch request, automatically chunking
larger sets. Returns succeeded/failed arrays for error handling.
Includes timeout handling and performance logging.

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

  it("returns empty result for empty file array", async () => {
    const result = await batchMove("token", [], "new-parent", "old-parent");

    expect(result.succeeded).toEqual([]);
    expect(result.failed).toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
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

  // Handle empty array - return early
  if (fileIds.length === 0) {
    return result;
  }

  const startTime = Date.now();

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

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), getBatchTimeout());

    try {
      const response = await fetch(
        "https://www.googleapis.com/batch/drive/v3",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": `multipart/mixed; boundary=${boundary}`,
          },
          body,
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

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
      const batchResults = parseBatchResponse(
        responseBody,
        responseBoundary,
        chunk
      );

      for (const batchResult of batchResults) {
        if (batchResult.success) {
          result.succeeded.push(batchResult.fileId);
        } else {
          result.failed.push({
            fileId: batchResult.fileId,
            error: batchResult.error || "Unknown error",
          });
        }
      }
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`Batch move timeout after ${getBatchTimeout()}ms`);
      }

      logger.error({ err: error, chunk }, "[Batch] Move request failed");
      for (const fileId of chunk) {
        result.failed.push({
          fileId,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  }

  // Log performance metrics
  const duration = Date.now() - startTime;
  logger.info(
    {
      duration,
      total: fileIds.length,
      succeeded: result.succeeded.length,
      failed: result.failed.length,
    },
    "[Batch] Move completed"
  );

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

  // Handle empty array - return early
  if (files.length === 0) {
    return result;
  }

  const startTime = Date.now();

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

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), getBatchTimeout());

    try {
      const response = await fetch(
        "https://www.googleapis.com/batch/drive/v3",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": `multipart/mixed; boundary=${boundary}`,
          },
          body,
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

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
      const fileIds = chunk.map((f) => f.fileId);
      const batchResults = parseBatchResponse(
        responseBody,
        responseBoundary,
        fileIds
      );

      for (const batchResult of batchResults) {
        if (batchResult.success) {
          result.succeeded.push(batchResult.fileId);
        } else {
          result.failed.push({
            fileId: batchResult.fileId,
            error: batchResult.error || "Unknown error",
          });
        }
      }
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`Batch move timeout after ${getBatchTimeout()}ms`);
      }

      logger.error({ err: error, chunk }, "[Batch] Move request failed");
      for (const file of chunk) {
        result.failed.push({
          fileId: file.fileId,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  }

  // Log performance metrics
  const duration = Date.now() - startTime;
  logger.info(
    {
      duration,
      total: files.length,
      succeeded: result.succeeded.length,
      failed: result.failed.length,
    },
    "[Batch] Move from different parents completed"
  );

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
Includes timeout handling and performance logging.

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
import { batchDelete, deleteFile } from "@/lib/google-drive-client";

// Add mock at top of file
vi.mock("@/lib/google-drive-client", () => ({
  batchDelete: vi.fn(),
  deleteFile: vi.fn(),
}));

describe("deleteItem - batch operations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses batch delete for items with children", async () => {
    // Setup: item with 10 children, each with driveFileId
    vi.mocked(prisma.item.findUnique).mockResolvedValue({
      id: "parent-1",
      driveFileId: "drive-parent",
      driveConnection: { id: "conn-1", accessToken: "encrypted-token" },
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

  it("uses single delete for items without children", async () => {
    vi.mocked(prisma.item.findUnique).mockResolvedValue({
      id: "single-1",
      driveFileId: "drive-single",
      driveConnection: { id: "conn-1" },
      children: [],
    } as any);

    await deleteItem("single-1");

    // Should use single delete, not batch
    expect(batchDelete).not.toHaveBeenCalled();
    expect(deleteFile).toHaveBeenCalled();
  });

  it("continues with DB delete even if batch fails", async () => {
    vi.mocked(prisma.item.findUnique).mockResolvedValue({
      id: "parent-1",
      driveFileId: "drive-parent",
      driveConnection: { id: "conn-1" },
      children: [{ id: "child-1", driveFileId: "drive-child", children: [] }],
    } as any);

    vi.mocked(batchDelete).mockRejectedValue(new Error("Batch API error"));
    vi.mocked(prisma.item.delete).mockResolvedValue({} as any);

    const result = await deleteItem("parent-1");

    // Should still succeed - DB deletion should happen
    expect(result.success).toBe(true);
    expect(prisma.item.delete).toHaveBeenCalled();
  });
});
```

**Step 2: Run test to verify it fails**

**Step 3: Write minimal implementation**

Update `lib/item-actions.ts` `deleteItem` function:

```typescript
import { batchDelete, deleteFile } from "@/lib/google-drive-client";
import { getAccessToken } from "@/lib/google-drive-actions";
import { logger } from "@/lib/logger";

export async function deleteItem(itemId: string) {
  // ... existing auth check ...

  const item = await prisma.item.findUnique({
    where: { id: itemId },
    include: {
      children: {
        include: {
          children: {
            include: {
              children: {
                include: {
                  children: true, // 4 levels deep to handle max depth
                },
              },
            },
          },
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
      collectDriveIds(child as typeof item);
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
          {
            failed: batchResult.failed,
            succeeded: batchResult.succeeded.length,
          },
          "[Delete] Some Drive files failed to delete"
        );
      }
    } catch (error) {
      // Log but continue - we'll still delete from DB
      // Drive files become orphaned but user can clean up via Drive UI
      logger.error(
        { err: error },
        "[Delete] Batch delete failed, continuing with DB delete"
      );
    }
  } else if (item.driveConnection && driveFileIds.length === 1) {
    // Single file - use standard delete
    try {
      const drive = await getDriveClient(item.driveConnection);
      await deleteFile(drive, driveFileIds[0]);
    } catch (error) {
      logger.error(
        { err: error },
        "[Delete] Drive delete failed, continuing with DB delete"
      );
    }
  }

  // Delete from database (cascades to children via Prisma)
  await prisma.item.delete({ where: { id: itemId } });

  revalidatePath("/my-items");
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
many children by batching Drive API calls. Falls back gracefully
if batch fails - DB deletion always proceeds.

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
 * Tests real batch API behavior with test Drive account.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { batchDelete, batchMove } from "@/lib/google-drive-client";

// These tests require GOOGLE_TEST_REFRESH_TOKEN for real API calls
const SKIP_INTEGRATION = !process.env.GOOGLE_TEST_REFRESH_TOKEN;

/**
 * Gets a fresh access token for testing.
 * Uses the test account refresh token from env vars.
 */
async function getTestAccessToken(): Promise<string> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: process.env.GOOGLE_TEST_REFRESH_TOKEN!,
      grant_type: "refresh_token",
    }),
  });
  const data = await response.json();
  return data.access_token;
}

/**
 * Creates test files in the test folder.
 *
 * @param count - Number of files to create
 * @returns Array of created file IDs
 */
async function createTestFiles(
  accessToken: string,
  count: number
): Promise<string[]> {
  const fileIds: string[] = [];
  const parentId = process.env.GOOGLE_TEST_ROOT_FOLDER_ID;

  for (let i = 0; i < count; i++) {
    const response = await fetch("https://www.googleapis.com/drive/v3/files", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: `batch-test-${Date.now()}-${i}`,
        parents: parentId ? [parentId] : undefined,
      }),
    });
    const file = await response.json();
    fileIds.push(file.id);
  }

  return fileIds;
}

/**
 * Gets file metadata to verify state.
 */
async function getFile(
  accessToken: string,
  fileId: string
): Promise<{ id: string; trashed: boolean }> {
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,trashed`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  return response.json();
}

describe.skipIf(SKIP_INTEGRATION)("batch operations integration", () => {
  let accessToken: string;
  let createdFileIds: string[] = [];

  beforeEach(async () => {
    accessToken = await getTestAccessToken();
    createdFileIds = [];
  });

  afterEach(async () => {
    // Cleanup: permanently delete test files
    for (const fileId of createdFileIds) {
      try {
        await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${accessToken}` },
        });
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  it("batch deletes multiple test files", async () => {
    // Create test files
    const fileIds = await createTestFiles(accessToken, 3);
    createdFileIds = fileIds;

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
    expect(result.failed[0].error).toMatch(/not found|File not found/i);
  });

  it("handles mixed existing and non-existing files", async () => {
    const fileIds = await createTestFiles(accessToken, 2);
    createdFileIds = fileIds;

    const result = await batchDelete(accessToken, [
      ...fileIds,
      "nonexistent-file-id-12345",
    ]);

    expect(result.succeeded).toHaveLength(2);
    expect(result.failed).toHaveLength(1);
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
Includes cleanup to permanently delete test files after tests.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: E2E Test for Batch Delete

**Files:**

- Modify: `e2e/journeys/google-drive/drive-sync.spec.ts`
- Verify: `e2e/pages/items.page.ts` has required methods

**Pre-requisite:** Verify items page object has these methods:

```typescript
// In e2e/pages/items.page.ts - verify these exist:
async addItem(name: string) { ... }
async openItem(name: string) { ... }
async deleteItem(name: string) { ... }
getItemCard(name: string) { ... }
```

**Step 1: Add E2E test**

Add to `e2e/journeys/google-drive/drive-sync.spec.ts`:

```typescript
test("deletes folder with children efficiently", async ({
  page,
  setupDriveConnection,
  testUser,
  cleanupTestDriveFolders,
}) => {
  await cleanupTestDriveFolders();
  await setupDriveConnection(testUser.id);

  const itemsPage = new ItemsPage(page);
  await itemsPage.goto();

  // Create folder with children
  await itemsPage.addItem("Batch Delete Test");
  await itemsPage.openItem("Batch Delete Test");
  await itemsPage.addItem("Child 1");
  await itemsPage.addItem("Child 2");
  await itemsPage.addItem("Child 3");

  // Wait for all items to sync to Drive
  await expect(async () => {
    const items = await prisma.item.findMany({
      where: { userId: testUser.id },
    });
    expect(items.every((i) => i.driveFileId)).toBe(true);
  }).toPass({ timeout: 30000 });

  // Go back and delete parent - this should use batch delete
  await page.goBack();
  await itemsPage.deleteItem("Batch Delete Test");

  // Verify parent item is gone from UI
  await expect(itemsPage.getItemCard("Batch Delete Test")).not.toBeVisible();

  // Verify all items (parent + children) deleted from DB
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

| Type        | File                                                      | Tests                                      |
| ----------- | --------------------------------------------------------- | ------------------------------------------ |
| Unit        | `tests/unit/lib/google-drive-batch.test.ts`               | Batch builder/parser with Content-ID (6)   |
| Unit        | `tests/unit/lib/google-drive-client.test.ts`              | batchDelete, batchMove with edge cases (7) |
| Unit        | `tests/unit/lib/item-actions.test.ts`                     | Batch delete integration (3)               |
| Integration | `tests/integration/google-drive/batch-operations.test.ts` | Real API batch tests (3)                   |
| E2E         | `e2e/journeys/google-drive/drive-sync.spec.ts`            | Batch delete folder (1)                    |

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

- [ ] Batch request builder with Content-ID headers for correlation
- [ ] Response parser handling out-of-order responses
- [ ] batchDelete function with chunking and timeout
- [ ] batchMove function with chunking and timeout
- [ ] batchMoveFromDifferentParents for mixed-parent moves
- [ ] Empty array handling (return early, no API call)
- [ ] Integration with deleteItem action
- [ ] Graceful fallback when batch fails (continue with DB delete)
- [ ] Unit tests for all batch functions including edge cases
- [ ] Integration tests with real API and cleanup
- [ ] E2E test for folder deletion
- [ ] Performance logging with duration metrics

---

## Future Considerations

These items are out of scope for this implementation but may be valuable later:

1. **Circuit Breaker Integration:** Consider wrapping batch operations with `lib/circuit-breaker.ts` for consistency with other external API calls.

2. **Progress Callbacks:** For very large deletions (200+ items spanning multiple batches), consider adding progress callback support for UI feedback.

3. **Retry Logic:** Currently no automatic retry on 5xx errors or rate limits (429). Consider adding exponential backoff for transient failures.

4. **Parallel Chunk Processing:** Currently chunks process sequentially. For very large operations, parallel chunk processing with concurrency limit could improve throughput.
