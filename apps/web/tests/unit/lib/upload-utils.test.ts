/**
 * Unit tests for upload-utils.ts.
 * Tests client-side upload utilities including progress tracking,
 * batch upload management, and error handling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createInitialUploadState,
  uploadWithProgress,
  BatchUploadManager,
  getAcceptFilter,
  formatBytes,
  FILE_ACCEPT_FILTERS,
  type UploadState,
  type UploadSession,
} from "@/lib/upload-utils";

// Mock XMLHttpRequest
class MockXHR {
  static instances: MockXHR[] = [];

  open = vi.fn();
  send = vi.fn();
  abort = vi.fn();
  setRequestHeader = vi.fn();

  status = 200;
  statusText = "OK";
  responseText = '{"id": "drive-file-123"}';

  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;

  upload = {
    onprogress: null as
      | ((e: {
          lengthComputable: boolean;
          loaded: number;
          total: number;
        }) => void)
      | null,
  };

  constructor() {
    MockXHR.instances.push(this);
  }

  // Helper to simulate progress
  simulateProgress(loaded: number, total: number) {
    this.upload.onprogress?.({ lengthComputable: true, loaded, total });
  }

  // Helper to simulate successful response
  simulateSuccess(id = "drive-file-123") {
    this.status = 200;
    this.responseText = JSON.stringify({ id });
    this.onload?.();
  }

  // Helper to simulate error response
  simulateErrorResponse(status: number, statusText = "Error") {
    this.status = status;
    this.statusText = statusText;
    this.onload?.();
  }

  // Helper to simulate network error
  simulateNetworkError() {
    this.onerror?.();
  }

  // Helper to simulate abort
  simulateAbort() {
    this.onabort?.();
  }
}

describe("upload-utils", () => {
  beforeEach(() => {
    MockXHR.instances = [];
    vi.stubGlobal("XMLHttpRequest", MockXHR);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("createInitialUploadState", () => {
    it("should create initial state with all files pending", () => {
      const state = createInitialUploadState(["file1.mp4", "file2.jpg"]);

      expect(state.status).toBe("idle");
      expect(state.successCount).toBe(0);
      expect(state.errorCount).toBe(0);
      expect(state.files).toHaveLength(2);
      expect(state.files[0]).toEqual({
        name: "file1.mp4",
        progress: 0,
        status: "pending",
      });
      expect(state.files[1]).toEqual({
        name: "file2.jpg",
        progress: 0,
        status: "pending",
      });
    });

    it("should handle empty file list", () => {
      const state = createInitialUploadState([]);

      expect(state.status).toBe("idle");
      expect(state.files).toHaveLength(0);
    });
  });

  describe("uploadWithProgress", () => {
    it("should upload file and return driveFileId on success", async () => {
      const file = new File(["content"], "test.mp4", { type: "video/mp4" });
      const onProgress = vi.fn();

      const uploadPromise = uploadWithProgress(
        "https://upload.googleapis.com/upload/drive/v3/files",
        file,
        onProgress
      );

      // Get the XHR instance and simulate success
      const xhr = MockXHR.instances[0];
      xhr.simulateSuccess("new-drive-file-id");

      const result = await uploadPromise;

      expect(result.success).toBe(true);
      expect(result.driveFileId).toBe("new-drive-file-id");
      expect(xhr.open).toHaveBeenCalledWith(
        "PUT",
        "https://upload.googleapis.com/upload/drive/v3/files"
      );
      expect(xhr.setRequestHeader).toHaveBeenCalledWith(
        "Content-Type",
        "video/mp4"
      );
      expect(xhr.send).toHaveBeenCalledWith(file);
    });

    it("should track upload progress", async () => {
      const file = new File(["content"], "test.mp4", { type: "video/mp4" });
      const onProgress = vi.fn();

      const uploadPromise = uploadWithProgress(
        "https://upload.googleapis.com/upload/drive/v3/files",
        file,
        onProgress
      );

      const xhr = MockXHR.instances[0];

      // Simulate progress updates
      xhr.simulateProgress(50, 100);
      expect(onProgress).toHaveBeenCalledWith({
        percent: 50,
        loaded: 50,
        total: 100,
      });

      xhr.simulateProgress(100, 100);
      expect(onProgress).toHaveBeenCalledWith({
        percent: 100,
        loaded: 100,
        total: 100,
      });

      xhr.simulateSuccess();
      await uploadPromise;
    });

    it("should handle permission denied (401)", async () => {
      const file = new File(["content"], "test.mp4", { type: "video/mp4" });
      const onProgress = vi.fn();

      const uploadPromise = uploadWithProgress(
        "https://upload.googleapis.com/upload/drive/v3/files",
        file,
        onProgress
      );

      const xhr = MockXHR.instances[0];
      xhr.simulateErrorResponse(401);

      const result = await uploadPromise;

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        "Permission denied. Please reconnect your Google Drive."
      );
    });

    it("should handle forbidden (403)", async () => {
      const file = new File(["content"], "test.mp4", { type: "video/mp4" });

      const uploadPromise = uploadWithProgress(
        "https://upload.googleapis.com/upload/drive/v3/files",
        file,
        vi.fn()
      );

      const xhr = MockXHR.instances[0];
      xhr.simulateErrorResponse(403);

      const result = await uploadPromise;

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        "Permission denied. Please reconnect your Google Drive."
      );
    });

    it("should handle not found (404)", async () => {
      const file = new File(["content"], "test.mp4", { type: "video/mp4" });

      const uploadPromise = uploadWithProgress(
        "https://upload.googleapis.com/upload/drive/v3/files",
        file,
        vi.fn()
      );

      const xhr = MockXHR.instances[0];
      xhr.simulateErrorResponse(404);

      const result = await uploadPromise;

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        "Upload destination not found. Please try again."
      );
    });

    it("should handle server error (500)", async () => {
      const file = new File(["content"], "test.mp4", { type: "video/mp4" });

      const uploadPromise = uploadWithProgress(
        "https://upload.googleapis.com/upload/drive/v3/files",
        file,
        vi.fn()
      );

      const xhr = MockXHR.instances[0];
      xhr.simulateErrorResponse(500);

      const result = await uploadPromise;

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        "Google Drive is temporarily unavailable. Please try again later."
      );
    });

    it("should handle network error", async () => {
      const file = new File(["content"], "test.mp4", { type: "video/mp4" });

      const uploadPromise = uploadWithProgress(
        "https://upload.googleapis.com/upload/drive/v3/files",
        file,
        vi.fn()
      );

      const xhr = MockXHR.instances[0];
      xhr.simulateNetworkError();

      const result = await uploadPromise;

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        "Network error. Please check your connection and try again."
      );
    });

    it("should handle invalid JSON response", async () => {
      const file = new File(["content"], "test.mp4", { type: "video/mp4" });

      const uploadPromise = uploadWithProgress(
        "https://upload.googleapis.com/upload/drive/v3/files",
        file,
        vi.fn()
      );

      const xhr = MockXHR.instances[0];
      xhr.status = 200;
      xhr.responseText = "not json";
      xhr.onload?.();

      const result = await uploadPromise;

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        "Upload completed but verification failed. Please check your Drive."
      );
    });

    it("should handle abort signal", async () => {
      const file = new File(["content"], "test.mp4", { type: "video/mp4" });
      const abortController = new AbortController();

      const uploadPromise = uploadWithProgress(
        "https://upload.googleapis.com/upload/drive/v3/files",
        file,
        vi.fn(),
        abortController.signal
      );

      const xhr = MockXHR.instances[0];

      // Abort the upload
      abortController.abort();

      // XHR abort should have been called
      expect(xhr.abort).toHaveBeenCalled();

      const result = await uploadPromise;

      expect(result.success).toBe(false);
      expect(result.error).toBe("Upload cancelled");
    });

    it("should handle XHR abort event", async () => {
      const file = new File(["content"], "test.mp4", { type: "video/mp4" });

      const uploadPromise = uploadWithProgress(
        "https://upload.googleapis.com/upload/drive/v3/files",
        file,
        vi.fn()
      );

      const xhr = MockXHR.instances[0];
      xhr.simulateAbort();

      const result = await uploadPromise;

      expect(result.success).toBe(false);
      expect(result.error).toBe("Upload cancelled");
    });

    it("should use default mime type when file type is empty", async () => {
      const file = new File(["content"], "test.bin", { type: "" });

      const uploadPromise = uploadWithProgress(
        "https://upload.googleapis.com/upload/drive/v3/files",
        file,
        vi.fn()
      );

      const xhr = MockXHR.instances[0];
      xhr.simulateSuccess();

      await uploadPromise;

      expect(xhr.setRequestHeader).toHaveBeenCalledWith(
        "Content-Type",
        "application/octet-stream"
      );
    });
  });

  describe("BatchUploadManager", () => {
    const createMockSessions = (count: number): UploadSession[] =>
      Array.from({ length: count }, (_, i) => ({
        fileName: `file${i}.mp4`,
        uploadUrl: `https://upload.googleapis.com/upload/${i}`,
        sessionToken: `token-${i}`,
      }));

    const createMockFiles = (count: number): File[] =>
      Array.from(
        { length: count },
        (_, i) =>
          new File([`content${i}`], `file${i}.mp4`, { type: "video/mp4" })
      );

    it("should upload all files successfully", async () => {
      const sessions = createMockSessions(3);
      const files = createMockFiles(3);
      const onStateChange = vi.fn();
      const confirmUpload = vi.fn().mockResolvedValue({ success: true });

      const manager = new BatchUploadManager(
        sessions,
        files,
        onStateChange,
        confirmUpload,
        3
      );

      const startPromise = manager.start();

      // Wait a tick for XHR instances to be created
      await new Promise((r) => setTimeout(r, 0));

      // Simulate all uploads succeeding
      for (const xhr of MockXHR.instances) {
        xhr.simulateSuccess();
      }

      const finalState = await startPromise;

      expect(finalState.successCount).toBe(3);
      expect(finalState.errorCount).toBe(0);
      expect(finalState.status).toBe("idle");
      expect(confirmUpload).toHaveBeenCalledTimes(3);
    });

    it("should handle partial failures", async () => {
      const sessions = createMockSessions(3);
      const files = createMockFiles(3);
      const onStateChange = vi.fn();
      const confirmUpload = vi.fn().mockResolvedValue({ success: true });

      const manager = new BatchUploadManager(
        sessions,
        files,
        onStateChange,
        confirmUpload,
        3
      );

      const startPromise = manager.start();

      await new Promise((r) => setTimeout(r, 0));

      // First two succeed, third fails
      MockXHR.instances[0].simulateSuccess();
      MockXHR.instances[1].simulateSuccess();
      MockXHR.instances[2].simulateErrorResponse(500);

      const finalState = await startPromise;

      expect(finalState.successCount).toBe(2);
      expect(finalState.errorCount).toBe(1);
      expect(finalState.status).toBe("error");
    });

    it("should handle confirm upload failure", async () => {
      const sessions = createMockSessions(1);
      const files = createMockFiles(1);
      const onStateChange = vi.fn();
      const confirmUpload = vi
        .fn()
        .mockResolvedValue({ success: false, error: "Confirmation failed" });

      const manager = new BatchUploadManager(
        sessions,
        files,
        onStateChange,
        confirmUpload,
        1
      );

      const startPromise = manager.start();

      await new Promise((r) => setTimeout(r, 0));
      MockXHR.instances[0].simulateSuccess();

      const finalState = await startPromise;

      expect(finalState.successCount).toBe(0);
      expect(finalState.errorCount).toBe(1);
      expect(finalState.files[0].error).toBe("Confirmation failed");
    });

    it("should update state during upload", async () => {
      const sessions = createMockSessions(1);
      const files = createMockFiles(1);
      const states: UploadState[] = [];
      const onStateChange = vi.fn((state: UploadState) => {
        states.push(JSON.parse(JSON.stringify(state)));
      });
      const confirmUpload = vi.fn().mockResolvedValue({ success: true });

      const manager = new BatchUploadManager(
        sessions,
        files,
        onStateChange,
        confirmUpload,
        1
      );

      const startPromise = manager.start();

      await new Promise((r) => setTimeout(r, 0));

      const xhr = MockXHR.instances[0];

      // Simulate progress
      xhr.simulateProgress(50, 100);
      xhr.simulateProgress(100, 100);
      xhr.simulateSuccess();

      await startPromise;

      // Should have received multiple state updates
      expect(states.length).toBeGreaterThan(1);

      // First state should be uploading
      expect(states[0].status).toBe("uploading");

      // Should have progress updates
      const progressStates = states.filter(
        (s) => s.files[0]?.status === "uploading"
      );
      expect(progressStates.length).toBeGreaterThan(0);
    });

    it("should respect concurrency limit with sliding window", async () => {
      const sessions = createMockSessions(5);
      const files = createMockFiles(5);
      const onStateChange = vi.fn();
      const confirmUpload = vi.fn().mockResolvedValue({ success: true });

      const manager = new BatchUploadManager(
        sessions,
        files,
        onStateChange,
        confirmUpload,
        2 // Max 2 concurrent
      );

      const startPromise = manager.start();

      // Wait for initial batch
      await new Promise((r) => setTimeout(r, 0));

      // Should have 2 XHR instances initially (not 5)
      expect(MockXHR.instances.length).toBe(2);

      // Complete first upload
      MockXHR.instances[0].simulateSuccess();

      // Wait for next to start
      await new Promise((r) => setTimeout(r, 0));

      // Should now have 3 instances (one completed, two active = one new started)
      expect(MockXHR.instances.length).toBe(3);

      // Complete remaining
      for (let i = 1; i < MockXHR.instances.length; i++) {
        MockXHR.instances[i].simulateSuccess();
        await new Promise((r) => setTimeout(r, 0));
      }

      // Handle any remaining
      while (MockXHR.instances.some((xhr) => !xhr.onload)) {
        await new Promise((r) => setTimeout(r, 0));
      }
      for (const xhr of MockXHR.instances) {
        if (xhr.status !== 200) {
          xhr.simulateSuccess();
        }
      }

      const finalState = await startPromise;
      expect(finalState.successCount).toBe(5);
    });

    it("should support cancellation", async () => {
      const sessions = createMockSessions(3);
      const files = createMockFiles(3);
      const onStateChange = vi.fn();
      const confirmUpload = vi.fn().mockResolvedValue({ success: true });

      const manager = new BatchUploadManager(
        sessions,
        files,
        onStateChange,
        confirmUpload,
        3
      );

      const startPromise = manager.start();

      await new Promise((r) => setTimeout(r, 0));

      // Cancel the manager
      manager.cancel();

      // Complete XHRs to let the promise resolve
      for (const xhr of MockXHR.instances) {
        xhr.simulateAbort();
      }

      const finalState = await startPromise;

      // All should be cancelled/failed
      expect(finalState.errorCount).toBe(3);
    });

    it("should preserve result order", async () => {
      const sessions = createMockSessions(3);
      const files = createMockFiles(3);
      const onStateChange = vi.fn();
      const confirmUpload = vi.fn().mockResolvedValue({ success: true });

      const manager = new BatchUploadManager(
        sessions,
        files,
        onStateChange,
        confirmUpload,
        3
      );

      const startPromise = manager.start();

      await new Promise((r) => setTimeout(r, 0));

      // Complete in reverse order
      MockXHR.instances[2].simulateSuccess("id-2");
      MockXHR.instances[0].simulateSuccess("id-0");
      MockXHR.instances[1].simulateSuccess("id-1");

      const finalState = await startPromise;

      // Results should be in original order
      expect(finalState.files[0].name).toBe("file0.mp4");
      expect(finalState.files[1].name).toBe("file1.mp4");
      expect(finalState.files[2].name).toBe("file2.mp4");
    });
  });

  describe("getAcceptFilter", () => {
    it("should return correct filter for media", () => {
      expect(getAcceptFilter("media")).toBe("video/*,audio/*");
    });

    it("should return correct filter for artwork", () => {
      expect(getAcceptFilter("artwork")).toBe("image/*");
    });

    it("should return correct filter for subtitle", () => {
      expect(getAcceptFilter("subtitle")).toBe(".srt,.vtt,.sub,.ass");
    });
  });

  describe("FILE_ACCEPT_FILTERS", () => {
    it("should have all expected file types", () => {
      expect(FILE_ACCEPT_FILTERS).toEqual({
        media: "video/*,audio/*",
        artwork: "image/*",
        subtitle: ".srt,.vtt,.sub,.ass",
      });
    });
  });

  describe("formatBytes", () => {
    it("should format 0 bytes", () => {
      expect(formatBytes(0)).toBe("0 B");
    });

    it("should handle negative input gracefully", () => {
      expect(formatBytes(-100)).toBe("0 B");
      expect(formatBytes(-1)).toBe("0 B");
    });

    it("should format bytes", () => {
      expect(formatBytes(500)).toBe("500 B");
      expect(formatBytes(1023)).toBe("1,023 B"); // Locale-aware thousand separator
    });

    it("should format kilobytes (decimals only for non-whole numbers)", () => {
      expect(formatBytes(1024)).toBe("1 KB"); // Whole number, no decimal
      expect(formatBytes(1536)).toBe("1.5 KB"); // Non-whole, has decimal
      expect(formatBytes(10240)).toBe("10 KB"); // Whole number, no decimal
    });

    it("should format megabytes (decimals only for non-whole numbers)", () => {
      expect(formatBytes(1048576)).toBe("1 MB"); // Whole number, no decimal
      expect(formatBytes(1572864)).toBe("1.5 MB"); // Non-whole, has decimal
      expect(formatBytes(104857600)).toBe("100 MB"); // Whole number, no decimal
    });

    it("should format gigabytes (decimals only for non-whole numbers)", () => {
      expect(formatBytes(1073741824)).toBe("1 GB"); // Whole number, no decimal
      expect(formatBytes(1610612736)).toBe("1.5 GB"); // Non-whole, has decimal
    });

    it("should cap at GB for very large files", () => {
      expect(formatBytes(1099511627776)).toBe("1,024 GB"); // 1 TB shows as GB with locale separator
    });
  });
});
