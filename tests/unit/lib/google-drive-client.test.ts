/**
 * Unit tests for Google Drive client utilities.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { drive_v3 } from "googleapis";

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

// Mock dependencies before imports
vi.mock("@/lib/prisma", () => ({
  prisma: {
    googleDriveConnection: {
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/crypto", () => ({
  encryptCredential: vi.fn((val) => `encrypted_${val}`),
  decryptCredential: vi.fn((val) => val.replace("encrypted_", "")),
}));

describe("google-drive-client", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Set required env vars
    vi.stubEnv("GOOGLE_CLIENT_ID", "test-client-id");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "test-client-secret");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
    vi.stubEnv("ENCRYPTION_KEY", "dGVzdC1lbmNyeXB0aW9uLWtleS0zMi1ieXRlcyE=");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("getAuthorizationUrl", () => {
    it("should include drive and userinfo.email scopes", async () => {
      const { getAuthorizationUrl } = await import("@/lib/google-drive-client");
      const url = getAuthorizationUrl("test-state");

      expect(url).toContain("scope=");
      // Full drive scope needed to sync files created directly in Drive
      expect(url).toContain("auth%2Fdrive");
      expect(url).toContain("userinfo.email");
    });

    it("should include state parameter", async () => {
      const { getAuthorizationUrl } = await import("@/lib/google-drive-client");
      const url = getAuthorizationUrl("my-csrf-state");

      expect(url).toContain("state=my-csrf-state");
    });

    it("should request offline access for refresh token", async () => {
      const { getAuthorizationUrl } = await import("@/lib/google-drive-client");
      const url = getAuthorizationUrl("test");

      expect(url).toContain("access_type=offline");
    });

    it("should force consent prompt", async () => {
      const { getAuthorizationUrl } = await import("@/lib/google-drive-client");
      const url = getAuthorizationUrl("test");

      expect(url).toContain("prompt=consent");
    });
  });

  describe("generateOAuthState", () => {
    it("should create signed state with userId and timestamp", async () => {
      const { generateOAuthState } = await import("@/lib/google-drive-client");
      const state = generateOAuthState("user-123");

      expect(state).toBeTruthy();
      expect(typeof state).toBe("string");
    });

    it("should be verifiable", async () => {
      const { generateOAuthState, verifyOAuthState } =
        await import("@/lib/google-drive-client");
      const state = generateOAuthState("user-123");
      const result = verifyOAuthState(state);

      expect(result).not.toBeNull();
      expect(result?.userId).toBe("user-123");
    });

    it("should reject tampered state", async () => {
      const { verifyOAuthState } = await import("@/lib/google-drive-client");
      const result = verifyOAuthState("tampered-invalid-state");

      expect(result).toBeNull();
    });

    it("should reject expired state (older than 10 minutes)", async () => {
      const { generateOAuthState, verifyOAuthState } =
        await import("@/lib/google-drive-client");

      // Create state with old timestamp (mock Date.now)
      const realDateNow = Date.now;
      const oldTime = realDateNow() - 11 * 60 * 1000; // 11 minutes ago
      vi.spyOn(Date, "now").mockReturnValueOnce(oldTime);

      const state = generateOAuthState("user-123");

      // Restore Date.now for verification
      vi.spyOn(Date, "now").mockReturnValue(realDateNow());

      const result = verifyOAuthState(state);
      expect(result).toBeNull();
    });
  });

  describe("withRateLimit", () => {
    it("should execute function and return result", async () => {
      const { withRateLimit } = await import("@/lib/google-drive-client");
      const result = await withRateLimit(async () => "success");

      expect(result).toBe("success");
    });

    it("should retry on rate limit error with exponential backoff", async () => {
      vi.useFakeTimers();
      const { withRateLimit } = await import("@/lib/google-drive-client");

      let attempts = 0;
      const fn = vi.fn(async () => {
        attempts++;
        if (attempts < 3) {
          const error = new Error("rateLimitExceeded") as Error & {
            code: number;
          };
          error.code = 403;
          throw error;
        }
        return "success";
      });

      const resultPromise = withRateLimit(fn);

      // Advance timers for retries
      await vi.advanceTimersByTimeAsync(5000);
      await vi.advanceTimersByTimeAsync(10000);

      const result = await resultPromise;

      expect(result).toBe("success");
      expect(fn).toHaveBeenCalledTimes(3);
      vi.useRealTimers();
    });
  });

  describe("uploadFile", () => {
    const mockDrive = {
      files: {
        create: vi.fn(),
      },
    } as unknown as drive_v3.Drive;

    beforeEach(() => {
      vi.mocked(mockDrive.files.create).mockReset();
    });

    it("should use simple upload for small files (<5MB)", async () => {
      vi.mocked(mockDrive.files.create).mockResolvedValue({
        data: { id: "file-123", name: "small.txt" },
      } as never);

      const { uploadFile } = await import("@/lib/google-drive-client");
      const smallBuffer = Buffer.alloc(1024); // 1KB
      const result = await uploadFile(
        mockDrive,
        "small.txt",
        smallBuffer,
        "text/plain",
        "parent-123"
      );

      expect(result.id).toBe("file-123");
      expect(mockDrive.files.create).toHaveBeenCalledTimes(1);
    });

    it("should use resumable upload with retry for large files (>=5MB)", async () => {
      vi.mocked(mockDrive.files.create).mockResolvedValue({
        data: { id: "large-file-123", name: "video.mp4" },
      } as never);

      const { uploadFile } = await import("@/lib/google-drive-client");
      const largeBuffer = Buffer.alloc(6 * 1024 * 1024); // 6MB
      const onProgress = vi.fn();

      const result = await uploadFile(
        mockDrive,
        "video.mp4",
        largeBuffer,
        "video/mp4",
        "parent-123",
        onProgress
      );

      expect(result.id).toBe("large-file-123");
      expect(onProgress).toHaveBeenCalled();
      // Progress should report percentage
      const lastCall =
        onProgress.mock.calls[onProgress.mock.calls.length - 1][0];
      expect(lastCall.percentage).toBe(100);
    });

    it("should retry on network failure with exponential backoff", async () => {
      vi.useFakeTimers();
      let attempts = 0;
      vi.mocked(mockDrive.files.create).mockImplementation(async () => {
        attempts++;
        if (attempts < 3) {
          const error = new Error("ECONNRESET") as Error & { code: number };
          error.code = 500;
          throw error;
        }
        return { data: { id: "retried-file", name: "file.txt" } } as never;
      });

      const { uploadFile } = await import("@/lib/google-drive-client");
      const largeBuffer = Buffer.alloc(6 * 1024 * 1024); // 6MB (triggers retry path)

      const resultPromise = uploadFile(
        mockDrive,
        "file.txt",
        largeBuffer,
        "text/plain",
        "parent-123"
      );

      // Advance timers for retries
      await vi.advanceTimersByTimeAsync(5000);
      await vi.advanceTimersByTimeAsync(10000);

      const result = await resultPromise;

      expect(result.id).toBe("retried-file");
      expect(attempts).toBe(3);
      vi.useRealTimers();
    });

    it("should throw after max retries exceeded", async () => {
      vi.useFakeTimers();
      vi.mocked(mockDrive.files.create).mockRejectedValue(
        Object.assign(new Error("Service unavailable"), { code: 503 })
      );

      const { uploadFile } = await import("@/lib/google-drive-client");
      const largeBuffer = Buffer.alloc(6 * 1024 * 1024); // 6MB

      // Start the upload and immediately catch to prevent unhandled rejection
      let caughtError: Error | null = null;
      const resultPromise = uploadFile(
        mockDrive,
        "file.txt",
        largeBuffer,
        "text/plain",
        "parent-123"
      ).catch((err) => {
        caughtError = err;
      });

      // Advance timers for all retries
      await vi.advanceTimersByTimeAsync(5000);
      await vi.advanceTimersByTimeAsync(10000);
      await vi.advanceTimersByTimeAsync(20000);

      await resultPromise;
      expect(caughtError).toBeTruthy();
      expect(caughtError!.message).toBe("Service unavailable");
      vi.useRealTimers();
    });

    it("should not retry on non-retryable errors", async () => {
      vi.mocked(mockDrive.files.create).mockRejectedValue(
        Object.assign(new Error("Not found"), { code: 404 })
      );

      const { uploadFile } = await import("@/lib/google-drive-client");
      const largeBuffer = Buffer.alloc(6 * 1024 * 1024); // 6MB

      await expect(
        uploadFile(
          mockDrive,
          "file.txt",
          largeBuffer,
          "text/plain",
          "parent-123"
        )
      ).rejects.toThrow("Not found");

      // Should only attempt once for non-retryable error
      expect(mockDrive.files.create).toHaveBeenCalledTimes(1);
    });
  });

  describe("checkRootFolderStatus", () => {
    const mockDrive = {
      files: {
        get: vi.fn(),
      },
    } as unknown as drive_v3.Drive;

    beforeEach(() => {
      vi.mocked(mockDrive.files.get).mockReset();
    });

    it("should return exists: true, trashed: false for healthy folder", async () => {
      vi.mocked(mockDrive.files.get).mockResolvedValue({
        data: { id: "folder-123", trashed: false },
      } as never);

      const { checkRootFolderStatus } =
        await import("@/lib/google-drive-client");
      const result = await checkRootFolderStatus(mockDrive, "folder-123");

      expect(result).toEqual({ exists: true, trashed: false });
      expect(mockDrive.files.get).toHaveBeenCalledWith({
        fileId: "folder-123",
        fields: "id, trashed",
      });
    });

    it("should return exists: true, trashed: true when folder is in trash", async () => {
      vi.mocked(mockDrive.files.get).mockResolvedValue({
        data: { id: "folder-123", trashed: true },
      } as never);

      const { checkRootFolderStatus } =
        await import("@/lib/google-drive-client");
      const result = await checkRootFolderStatus(mockDrive, "folder-123");

      expect(result).toEqual({ exists: true, trashed: true });
    });

    it("should return exists: false when folder is permanently deleted (404)", async () => {
      vi.mocked(mockDrive.files.get).mockRejectedValue(
        Object.assign(new Error("Not Found"), { code: 404 })
      );

      const { checkRootFolderStatus } =
        await import("@/lib/google-drive-client");
      const result = await checkRootFolderStatus(mockDrive, "deleted-folder");

      expect(result).toEqual({ exists: false });
    });

    it("should throw on other errors (not 404)", async () => {
      vi.mocked(mockDrive.files.get).mockRejectedValue(
        Object.assign(new Error("Service unavailable"), { code: 503 })
      );

      const { checkRootFolderStatus } =
        await import("@/lib/google-drive-client");

      await expect(
        checkRootFolderStatus(mockDrive, "folder-123")
      ).rejects.toThrow("Service unavailable");
    });

    it("should default trashed to false if not present in response", async () => {
      vi.mocked(mockDrive.files.get).mockResolvedValue({
        data: { id: "folder-123" }, // No trashed field
      } as never);

      const { checkRootFolderStatus } =
        await import("@/lib/google-drive-client");
      const result = await checkRootFolderStatus(mockDrive, "folder-123");

      expect(result).toEqual({ exists: true, trashed: false });
    });
  });

  describe("batchDelete", () => {
    beforeEach(() => {
      vi.stubGlobal("fetch", vi.fn());
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("deletes multiple files in single request", async () => {
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

      const { batchDelete } = await import("@/lib/google-drive-client");
      const result = await batchDelete("test-access-token", [
        "file-1",
        "file-2",
      ]);

      expect(result.succeeded).toEqual(["file-1", "file-2"]);
      expect(result.failed).toEqual([]);
    });

    it("returns empty result for empty file array", async () => {
      const { batchDelete } = await import("@/lib/google-drive-client");
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

      const { batchDelete } = await import("@/lib/google-drive-client");
      const result = await batchDelete("token", ["file-1", "file-2"]);

      expect(result.succeeded).toContain("file-1");
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].error).toBe("File not found");
    });

    it("chunks large batches into multiple requests", async () => {
      const fileIds = Array.from({ length: 150 }, (_, i) => `file-${i}`);

      vi.mocked(global.fetch)
        .mockResolvedValueOnce(createMockBatchResponse(100))
        .mockResolvedValueOnce(createMockBatchResponse(50));

      const { batchDelete } = await import("@/lib/google-drive-client");
      const result = await batchDelete("token", fileIds);

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(result.succeeded).toHaveLength(150);
    });

    it("throws timeout error when fetch is aborted", async () => {
      // Simulate an AbortError from fetch
      const abortError = new Error("The operation was aborted.");
      abortError.name = "AbortError";
      vi.mocked(global.fetch).mockRejectedValue(abortError);

      const { batchDelete } = await import("@/lib/google-drive-client");

      await expect(batchDelete("token", ["file-1"])).rejects.toThrow(
        /timeout/i
      );
    });
  });

  describe("batchMove", () => {
    beforeEach(() => {
      vi.stubGlobal("fetch", vi.fn());
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("moves multiple files to new parent", async () => {
      vi.mocked(global.fetch).mockResolvedValue(
        createMockBatchResponse(3, true)
      );

      const { batchMove } = await import("@/lib/google-drive-client");
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
      const { batchMove } = await import("@/lib/google-drive-client");
      const result = await batchMove("token", [], "new-parent", "old-parent");

      expect(result.succeeded).toEqual([]);
      expect(result.failed).toEqual([]);
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe("createRootFolder", () => {
    it("returns existing folder if found", async () => {
      const mockDrive = {
        files: {
          list: vi.fn().mockResolvedValue({
            data: {
              files: [{ id: "existing-folder-123", name: "CanonCore" }],
            },
          }),
          create: vi.fn(),
        },
      } as unknown as drive_v3.Drive;

      const { createRootFolder } = await import("@/lib/google-drive-client");
      const result = await createRootFolder(mockDrive);

      expect(result.id).toBe("existing-folder-123");
      expect(result.wasExisting).toBe(true);
      expect(mockDrive.files.create).not.toHaveBeenCalled();
    });

    it("creates new folder if not found", async () => {
      const mockDrive = {
        files: {
          list: vi.fn().mockResolvedValue({ data: { files: [] } }),
          create: vi.fn().mockResolvedValue({ data: { id: "new-folder-456" } }),
        },
      } as unknown as drive_v3.Drive;

      const { createRootFolder } = await import("@/lib/google-drive-client");
      const result = await createRootFolder(mockDrive);

      expect(result.id).toBe("new-folder-456");
      expect(result.wasExisting).toBe(false);
      expect(mockDrive.files.create).toHaveBeenCalled();
    });

    it("throws if folder creation fails", async () => {
      const mockDrive = {
        files: {
          list: vi.fn().mockResolvedValue({ data: { files: [] } }),
          create: vi.fn().mockResolvedValue({ data: {} }), // No id returned
        },
      } as unknown as drive_v3.Drive;

      const { createRootFolder } = await import("@/lib/google-drive-client");

      await expect(createRootFolder(mockDrive)).rejects.toThrow(
        "Failed to create CanonCore folder"
      );
    });
  });

  describe("listFiles", () => {
    it("returns files and next page token", async () => {
      const mockDrive = {
        files: {
          list: vi.fn().mockResolvedValue({
            data: {
              files: [
                { id: "file-1", name: "test.mp4" },
                { id: "file-2", name: "test2.mp4" },
              ],
              nextPageToken: "next-page-token",
            },
          }),
        },
      } as unknown as drive_v3.Drive;

      const { listFiles } = await import("@/lib/google-drive-client");
      const result = await listFiles(mockDrive, "parent-folder-id");

      expect(result.files).toHaveLength(2);
      expect(result.nextPageToken).toBe("next-page-token");
    });

    it("handles empty file list", async () => {
      const mockDrive = {
        files: {
          list: vi.fn().mockResolvedValue({
            data: { files: [], nextPageToken: null },
          }),
        },
      } as unknown as drive_v3.Drive;

      const { listFiles } = await import("@/lib/google-drive-client");
      const result = await listFiles(mockDrive, "parent-folder-id");

      expect(result.files).toHaveLength(0);
      expect(result.nextPageToken).toBeUndefined();
    });

    it("passes page token for pagination", async () => {
      const mockDrive = {
        files: {
          list: vi.fn().mockResolvedValue({
            data: { files: [], nextPageToken: null },
          }),
        },
      } as unknown as drive_v3.Drive;

      const { listFiles } = await import("@/lib/google-drive-client");
      await listFiles(mockDrive, "parent-folder-id", "page-token");

      expect(mockDrive.files.list).toHaveBeenCalledWith(
        expect.objectContaining({ pageToken: "page-token" })
      );
    });
  });

  describe("createFolder", () => {
    it("creates folder and returns id", async () => {
      const mockDrive = {
        files: {
          create: vi.fn().mockResolvedValue({ data: { id: "new-folder-id" } }),
        },
      } as unknown as drive_v3.Drive;

      const { createFolder } = await import("@/lib/google-drive-client");
      const result = await createFolder(
        mockDrive,
        "My Folder",
        "parent-folder-id"
      );

      expect(result).toBe("new-folder-id");
      expect(mockDrive.files.create).toHaveBeenCalledWith(
        expect.objectContaining({
          requestBody: expect.objectContaining({
            name: "My Folder",
            mimeType: "application/vnd.google-apps.folder",
          }),
        })
      );
    });

    it("throws if folder creation fails", async () => {
      const mockDrive = {
        files: {
          create: vi.fn().mockResolvedValue({ data: {} }),
        },
      } as unknown as drive_v3.Drive;

      const { createFolder } = await import("@/lib/google-drive-client");

      await expect(
        createFolder(mockDrive, "My Folder", "parent-id")
      ).rejects.toThrow("Failed to create folder");
    });
  });

  describe("deleteFile", () => {
    it("moves file to trash", async () => {
      const mockDrive = {
        files: {
          update: vi.fn().mockResolvedValue({ data: {} }),
        },
      } as unknown as drive_v3.Drive;

      const { deleteFile } = await import("@/lib/google-drive-client");
      await deleteFile(mockDrive, "file-to-delete");

      expect(mockDrive.files.update).toHaveBeenCalledWith({
        fileId: "file-to-delete",
        requestBody: { trashed: true },
      });
    });
  });

  describe("renameFile", () => {
    it("renames file in Drive", async () => {
      const mockDrive = {
        files: {
          update: vi.fn().mockResolvedValue({ data: {} }),
        },
      } as unknown as drive_v3.Drive;

      const { renameFile } = await import("@/lib/google-drive-client");
      await renameFile(mockDrive, "file-id", "new-name.mp4");

      expect(mockDrive.files.update).toHaveBeenCalledWith({
        fileId: "file-id",
        requestBody: { name: "new-name.mp4" },
      });
    });
  });

  describe("moveFile", () => {
    it("moves file to new parent", async () => {
      const mockDrive = {
        files: {
          update: vi.fn().mockResolvedValue({ data: {} }),
        },
      } as unknown as drive_v3.Drive;

      const { moveFile } = await import("@/lib/google-drive-client");
      await moveFile(mockDrive, "file-id", "new-parent", "old-parent");

      expect(mockDrive.files.update).toHaveBeenCalledWith({
        fileId: "file-id",
        addParents: "new-parent",
        removeParents: "old-parent",
      });
    });
  });

  describe("downloadFile", () => {
    it("downloads file content", async () => {
      const testContent = Buffer.from("test file content");
      const mockDrive = {
        files: {
          get: vi.fn().mockResolvedValue({ data: testContent }),
        },
      } as unknown as drive_v3.Drive;

      const { downloadFile } = await import("@/lib/google-drive-client");
      const result = await downloadFile(mockDrive, "file-id");

      expect(result).toBeInstanceOf(Buffer);
      expect(mockDrive.files.get).toHaveBeenCalledWith(
        { fileId: "file-id", alt: "media" },
        { responseType: "arraybuffer" }
      );
    });
  });

  describe("getUserEmail", () => {
    beforeEach(() => {
      vi.stubGlobal("fetch", vi.fn());
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("returns email from Google API", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ email: "user@example.com" }),
      } as Response);

      const { getUserEmail } = await import("@/lib/google-drive-client");
      const email = await getUserEmail("test-access-token");

      expect(email).toBe("user@example.com");
    });

    it("throws if API request fails", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
      } as Response);

      const { getUserEmail } = await import("@/lib/google-drive-client");

      await expect(getUserEmail("test-token")).rejects.toThrow(
        "Failed to get user info from Google"
      );
    });

    it("throws if no email returned", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({}),
      } as Response);

      const { getUserEmail } = await import("@/lib/google-drive-client");

      await expect(getUserEmail("test-token")).rejects.toThrow(
        "No email returned from Google"
      );
    });
  });

  describe("createResumableUploadUrl", () => {
    beforeEach(() => {
      vi.stubGlobal("fetch", vi.fn());
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("returns upload URL from Location header", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        headers: new Headers({
          Location:
            "https://www.googleapis.com/upload/drive/v3/files?uploadId=xyz",
        }),
      } as Response);

      const { createResumableUploadUrl } =
        await import("@/lib/google-drive-client");
      const url = await createResumableUploadUrl(
        "test-token",
        "file.mp4",
        "video/mp4",
        "parent-folder",
        "https://example.com"
      );

      expect(url).toContain("uploadId=xyz");
    });

    it("throws if request fails", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => "Bad Request",
      } as Response);

      const { createResumableUploadUrl } =
        await import("@/lib/google-drive-client");

      await expect(
        createResumableUploadUrl(
          "test-token",
          "file.mp4",
          "video/mp4",
          "parent-folder",
          "https://example.com"
        )
      ).rejects.toThrow("Failed to create upload session: 400");
    });

    it("throws if no Location header", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        headers: new Headers({}),
      } as Response);

      const { createResumableUploadUrl } =
        await import("@/lib/google-drive-client");

      await expect(
        createResumableUploadUrl(
          "test-token",
          "file.mp4",
          "video/mp4",
          "parent-folder",
          "https://example.com"
        )
      ).rejects.toThrow("No upload URL returned");
    });
  });

  describe("permanentlyDeleteFile", () => {
    it("permanently deletes file", async () => {
      const mockDrive = {
        files: {
          delete: vi.fn().mockResolvedValue({}),
        },
      } as unknown as drive_v3.Drive;

      const { permanentlyDeleteFile } =
        await import("@/lib/google-drive-client");
      await permanentlyDeleteFile(mockDrive, "file-to-delete");

      expect(mockDrive.files.delete).toHaveBeenCalledWith({
        fileId: "file-to-delete",
      });
    });
  });

  describe("emptyTrash", () => {
    it("empties trash", async () => {
      const mockDrive = {
        files: {
          emptyTrash: vi.fn().mockResolvedValue({}),
        },
      } as unknown as drive_v3.Drive;

      const { emptyTrash } = await import("@/lib/google-drive-client");
      await emptyTrash(mockDrive);

      expect(mockDrive.files.emptyTrash).toHaveBeenCalledWith({});
    });
  });

  describe("batchMoveFromDifferentParents", () => {
    beforeEach(() => {
      vi.stubGlobal("fetch", vi.fn());
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("handles files from different parents", async () => {
      vi.mocked(global.fetch).mockResolvedValue(
        createMockBatchResponse(2, true)
      );

      const { batchMoveFromDifferentParents } =
        await import("@/lib/google-drive-client");

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

    it("returns empty result for empty file array", async () => {
      const { batchMoveFromDifferentParents } =
        await import("@/lib/google-drive-client");

      const result = await batchMoveFromDifferentParents(
        "token",
        [],
        "new-parent"
      );

      expect(result.succeeded).toEqual([]);
      expect(result.failed).toEqual([]);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("handles batch request failure with non-ok response", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      } as Response);

      const { batchMoveFromDifferentParents } =
        await import("@/lib/google-drive-client");

      const result = await batchMoveFromDifferentParents(
        "token",
        [
          { fileId: "file-1", oldParentId: "parent-a" },
          { fileId: "file-2", oldParentId: "parent-b" },
        ],
        "new-parent"
      );

      // All files should be marked as failed
      expect(result.succeeded).toHaveLength(0);
      expect(result.failed).toHaveLength(2);
      expect(result.failed[0].error).toContain("Batch failed: 500");
    });

    it("handles partial batch failures in response", async () => {
      // Create a response with mixed success/failure
      const boundary = "batch_mock123";
      let body = "";

      // First file succeeds
      body += `--${boundary}\r\n`;
      body += `Content-Type: application/http\r\n`;
      body += `Content-ID: <response-item-0>\r\n\r\n`;
      body += `HTTP/1.1 200 OK\r\n`;
      body += `Content-Type: application/json\r\n\r\n`;
      body += `{"id":"file-1"}\r\n`;

      // Second file fails
      body += `--${boundary}\r\n`;
      body += `Content-Type: application/http\r\n`;
      body += `Content-ID: <response-item-1>\r\n\r\n`;
      body += `HTTP/1.1 404 Not Found\r\n`;
      body += `Content-Type: application/json\r\n\r\n`;
      body += `{"error":{"message":"File not found"}}\r\n`;

      body += `--${boundary}--`;

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        headers: new Headers({
          "content-type": `multipart/mixed; boundary=${boundary}`,
        }),
        text: async () => body,
      } as Response);

      const { batchMoveFromDifferentParents } =
        await import("@/lib/google-drive-client");

      const result = await batchMoveFromDifferentParents(
        "token",
        [
          { fileId: "file-1", oldParentId: "parent-a" },
          { fileId: "file-2", oldParentId: "parent-b" },
        ],
        "new-parent"
      );

      expect(result.succeeded).toHaveLength(1);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].fileId).toBe("file-2");
    });

    it("handles network errors during batch request", async () => {
      vi.mocked(global.fetch).mockRejectedValue(new Error("Network error"));

      const { batchMoveFromDifferentParents } =
        await import("@/lib/google-drive-client");

      const result = await batchMoveFromDifferentParents(
        "token",
        [{ fileId: "file-1", oldParentId: "parent-a" }],
        "new-parent"
      );

      expect(result.succeeded).toHaveLength(0);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].error).toBe("Network error");
    });

    it("handles timeout errors during batch request", async () => {
      const abortError = new Error("Aborted");
      abortError.name = "AbortError";
      vi.mocked(global.fetch).mockRejectedValue(abortError);

      const { batchMoveFromDifferentParents } =
        await import("@/lib/google-drive-client");

      await expect(
        batchMoveFromDifferentParents(
          "token",
          [{ fileId: "file-1", oldParentId: "parent-a" }],
          "new-parent"
        )
      ).rejects.toThrow("Batch move timeout");
    });
  });
});
