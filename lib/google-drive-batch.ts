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
 *
 * @returns Batch timeout in milliseconds
 */
export function getBatchTimeout(): number {
  return BATCH_TIMEOUT_MS;
}
