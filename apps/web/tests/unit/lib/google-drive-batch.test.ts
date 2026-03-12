/**
 * Unit tests for Google Drive batch operations.
 */

import { describe, it, expect } from "vitest";
import {
  buildBatchRequest,
  parseBatchResponse,
  BatchOperation,
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
