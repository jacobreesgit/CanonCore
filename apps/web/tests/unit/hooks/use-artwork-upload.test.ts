/**
 * Unit tests for useArtworkUpload hook.
 */

import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  useArtworkUpload,
  MAX_IMAGE_SIZE_BYTES,
  MAX_UPLOAD_FILES,
} from "@/hooks/use-artwork-upload";
import type { QueuedFile } from "@/lib/types";

// Mock crypto.randomUUID
vi.stubGlobal("crypto", {
  randomUUID: () => "mock-uuid-" + Math.random().toString(36).substr(2, 9),
});

describe("useArtworkUpload", () => {
  const mockOnQueueChange = vi.fn();
  const mockOnSelect = vi.fn();

  const createQueuedFile = (id: string, size: number): QueuedFile => ({
    id,
    file: new File(["test"], "test.jpg", { type: "image/jpeg" }),
    fileType: "ARTWORK",
    size,
    status: "pending",
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("constants", () => {
    it("exports MAX_IMAGE_SIZE_BYTES as 50MB", () => {
      expect(MAX_IMAGE_SIZE_BYTES).toBe(50 * 1024 * 1024);
    });

    it("exports MAX_UPLOAD_FILES as 10", () => {
      expect(MAX_UPLOAD_FILES).toBe(10);
    });
  });

  describe("handleFileDrop", () => {
    it("adds dropped files to the queue", () => {
      const { result } = renderHook(() =>
        useArtworkUpload({
          queuedFiles: [],
          onQueueChange: mockOnQueueChange,
          selectedValue: null,
          onSelect: mockOnSelect,
          isSkipped: false,
          disabled: false,
        })
      );

      const file = new File(["content"], "poster.jpg", { type: "image/jpeg" });

      act(() => {
        result.current.handleFileDrop([file]);
      });

      expect(mockOnQueueChange).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            file,
            fileType: "ARTWORK",
            status: "pending",
          }),
        ])
      );
    });

    it("auto-selects first file when nothing selected", () => {
      const { result } = renderHook(() =>
        useArtworkUpload({
          queuedFiles: [],
          onQueueChange: mockOnQueueChange,
          selectedValue: null,
          onSelect: mockOnSelect,
          isSkipped: false,
          disabled: false,
        })
      );

      const file = new File(["content"], "poster.jpg", { type: "image/jpeg" });

      act(() => {
        result.current.handleFileDrop([file]);
      });

      expect(mockOnSelect).toHaveBeenCalledWith(expect.any(String), "queued");
    });

    it("does not auto-select when step is skipped", () => {
      const { result } = renderHook(() =>
        useArtworkUpload({
          queuedFiles: [],
          onQueueChange: mockOnQueueChange,
          selectedValue: null,
          onSelect: mockOnSelect,
          isSkipped: true,
          disabled: false,
        })
      );

      const file = new File(["content"], "poster.jpg", { type: "image/jpeg" });

      act(() => {
        result.current.handleFileDrop([file]);
      });

      expect(mockOnQueueChange).toHaveBeenCalled();
      expect(mockOnSelect).not.toHaveBeenCalled();
    });

    it("does not auto-select when something already selected", () => {
      const { result } = renderHook(() =>
        useArtworkUpload({
          queuedFiles: [],
          onQueueChange: mockOnQueueChange,
          selectedValue: "existing-selection",
          onSelect: mockOnSelect,
          isSkipped: false,
          disabled: false,
        })
      );

      const file = new File(["content"], "poster.jpg", { type: "image/jpeg" });

      act(() => {
        result.current.handleFileDrop([file]);
      });

      expect(mockOnQueueChange).toHaveBeenCalled();
      expect(mockOnSelect).not.toHaveBeenCalled();
    });

    it("does nothing when onQueueChange is not provided", () => {
      const { result } = renderHook(() =>
        useArtworkUpload({
          queuedFiles: [],
          onQueueChange: undefined,
          selectedValue: null,
          onSelect: mockOnSelect,
          isSkipped: false,
          disabled: false,
        })
      );

      const file = new File(["content"], "poster.jpg", { type: "image/jpeg" });

      act(() => {
        result.current.handleFileDrop([file]);
      });

      expect(mockOnSelect).not.toHaveBeenCalled();
    });

    it("appends to existing queued files", () => {
      const existingFile = createQueuedFile("existing-1", 1000);

      const { result } = renderHook(() =>
        useArtworkUpload({
          queuedFiles: [existingFile],
          onQueueChange: mockOnQueueChange,
          selectedValue: "existing-1",
          onSelect: mockOnSelect,
          isSkipped: false,
          disabled: false,
        })
      );

      const newFile = new File(["content"], "new.jpg", { type: "image/jpeg" });

      act(() => {
        result.current.handleFileDrop([newFile]);
      });

      expect(mockOnQueueChange).toHaveBeenCalledWith(
        expect.arrayContaining([
          existingFile,
          expect.objectContaining({ file: newFile }),
        ])
      );
    });
  });

  describe("handleRemoveFile", () => {
    it("removes file from queue", () => {
      const file1 = createQueuedFile("file-1", 1000);
      const file2 = createQueuedFile("file-2", 2000);

      const { result } = renderHook(() =>
        useArtworkUpload({
          queuedFiles: [file1, file2],
          onQueueChange: mockOnQueueChange,
          selectedValue: "file-1",
          onSelect: mockOnSelect,
          isSkipped: false,
          disabled: false,
        })
      );

      act(() => {
        result.current.handleRemoveFile("file-2");
      });

      expect(mockOnQueueChange).toHaveBeenCalledWith([file1]);
    });

    it("selects next file when removed file was selected", () => {
      const file1 = createQueuedFile("file-1", 1000);
      const file2 = createQueuedFile("file-2", 2000);

      const { result } = renderHook(() =>
        useArtworkUpload({
          queuedFiles: [file1, file2],
          onQueueChange: mockOnQueueChange,
          selectedValue: "file-1",
          onSelect: mockOnSelect,
          isSkipped: false,
          disabled: false,
        })
      );

      act(() => {
        result.current.handleRemoveFile("file-1");
      });

      expect(mockOnSelect).toHaveBeenCalledWith("file-2", "queued");
    });

    it("clears selection when last file removed", () => {
      const file1 = createQueuedFile("file-1", 1000);

      const { result } = renderHook(() =>
        useArtworkUpload({
          queuedFiles: [file1],
          onQueueChange: mockOnQueueChange,
          selectedValue: "file-1",
          onSelect: mockOnSelect,
          isSkipped: false,
          disabled: false,
        })
      );

      act(() => {
        result.current.handleRemoveFile("file-1");
      });

      expect(mockOnSelect).toHaveBeenCalledWith(null, "queued");
    });

    it("does not change selection when different file removed", () => {
      const file1 = createQueuedFile("file-1", 1000);
      const file2 = createQueuedFile("file-2", 2000);

      const { result } = renderHook(() =>
        useArtworkUpload({
          queuedFiles: [file1, file2],
          onQueueChange: mockOnQueueChange,
          selectedValue: "file-1",
          onSelect: mockOnSelect,
          isSkipped: false,
          disabled: false,
        })
      );

      act(() => {
        result.current.handleRemoveFile("file-2");
      });

      expect(mockOnSelect).not.toHaveBeenCalled();
    });

    it("does nothing when onQueueChange is not provided", () => {
      const { result } = renderHook(() =>
        useArtworkUpload({
          queuedFiles: [],
          onQueueChange: undefined,
          selectedValue: null,
          onSelect: mockOnSelect,
          isSkipped: false,
          disabled: false,
        })
      );

      act(() => {
        result.current.handleRemoveFile("any-id");
      });

      expect(mockOnSelect).not.toHaveBeenCalled();
    });
  });

  describe("handleQueuedSelect", () => {
    it("selects file when clicked", () => {
      const { result } = renderHook(() =>
        useArtworkUpload({
          queuedFiles: [],
          onQueueChange: mockOnQueueChange,
          selectedValue: null,
          onSelect: mockOnSelect,
          isSkipped: false,
          disabled: false,
        })
      );

      act(() => {
        result.current.handleQueuedSelect("file-1");
      });

      expect(mockOnSelect).toHaveBeenCalledWith("file-1", "queued");
    });

    it("toggles selection off when clicking selected file", () => {
      const { result } = renderHook(() =>
        useArtworkUpload({
          queuedFiles: [],
          onQueueChange: mockOnQueueChange,
          selectedValue: "file-1",
          onSelect: mockOnSelect,
          isSkipped: false,
          disabled: false,
        })
      );

      act(() => {
        result.current.handleQueuedSelect("file-1");
      });

      expect(mockOnSelect).toHaveBeenCalledWith(null, "queued");
    });

    it("does not select when disabled", () => {
      const { result } = renderHook(() =>
        useArtworkUpload({
          queuedFiles: [],
          onQueueChange: mockOnQueueChange,
          selectedValue: null,
          onSelect: mockOnSelect,
          isSkipped: false,
          disabled: true,
        })
      );

      act(() => {
        result.current.handleQueuedSelect("file-1");
      });

      expect(mockOnSelect).not.toHaveBeenCalled();
    });

    it("does not select when skipped", () => {
      const { result } = renderHook(() =>
        useArtworkUpload({
          queuedFiles: [],
          onQueueChange: mockOnQueueChange,
          selectedValue: null,
          onSelect: mockOnSelect,
          isSkipped: true,
          disabled: false,
        })
      );

      act(() => {
        result.current.handleQueuedSelect("file-1");
      });

      expect(mockOnSelect).not.toHaveBeenCalled();
    });
  });

  describe("totalSize", () => {
    it("returns sum of all file sizes", () => {
      const files = [
        createQueuedFile("file-1", 1000),
        createQueuedFile("file-2", 2000),
        createQueuedFile("file-3", 3000),
      ];

      const { result } = renderHook(() =>
        useArtworkUpload({
          queuedFiles: files,
          onQueueChange: mockOnQueueChange,
          selectedValue: null,
          onSelect: mockOnSelect,
          isSkipped: false,
          disabled: false,
        })
      );

      expect(result.current.totalSize).toBe(6000);
    });

    it("returns 0 for empty queue", () => {
      const { result } = renderHook(() =>
        useArtworkUpload({
          queuedFiles: [],
          onQueueChange: mockOnQueueChange,
          selectedValue: null,
          onSelect: mockOnSelect,
          isSkipped: false,
          disabled: false,
        })
      );

      expect(result.current.totalSize).toBe(0);
    });

    it("updates when files change", () => {
      const initialFiles = [createQueuedFile("file-1", 1000)];

      const { result, rerender } = renderHook(
        ({ files }) =>
          useArtworkUpload({
            queuedFiles: files,
            onQueueChange: mockOnQueueChange,
            selectedValue: null,
            onSelect: mockOnSelect,
            isSkipped: false,
            disabled: false,
          }),
        { initialProps: { files: initialFiles } }
      );

      expect(result.current.totalSize).toBe(1000);

      const updatedFiles = [...initialFiles, createQueuedFile("file-2", 2000)];

      rerender({ files: updatedFiles });

      expect(result.current.totalSize).toBe(3000);
    });
  });
});
