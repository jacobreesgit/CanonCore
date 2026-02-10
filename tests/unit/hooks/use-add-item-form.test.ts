/**
 * Unit tests for useAddItemForm hook.
 */

import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useAddItemForm } from "@/hooks/use-add-item-form";
import type { QueuedFile } from "@/lib/types";
import { toast } from "sonner";

vi.mock("@/lib/tmdb-actions", () => ({
  getMetadataPreviewAction: vi.fn().mockResolvedValue({
    success: true,
    data: { name: "Test Movie", description: "A test movie" },
  }),
  getEpisodePreviewAction: vi.fn().mockResolvedValue({
    success: true,
    data: { name: "Episode 1", description: "First ep" },
  }),
  getSeasonMetadataAction: vi.fn().mockResolvedValue({
    success: true,
    data: { name: "Season 1", description: "First season" },
  }),
}));

vi.mock("@/lib/google-drive-upload", () => ({
  createUploadSessions: vi
    .fn()
    .mockResolvedValue({ success: true, sessions: [] }),
  confirmUpload: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("@/lib/upload-utils", () => ({
  BatchUploadManager: vi.fn(),
  formatBytes: vi.fn((n: number) => `${n}B`),
}));

vi.mock("@/lib/tmdb-client", () => ({
  getPosterUrl: vi.fn((path: string | null) =>
    path ? `https://image.tmdb.org/t/p/w500${path}` : null
  ),
  getBackdropUrl: vi.fn((path: string | null) =>
    path ? `https://image.tmdb.org/t/p/original${path}` : null
  ),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock("motion/react", () => ({ useReducedMotion: () => false }));

const mockOnAdd = vi.fn().mockResolvedValue({ itemId: "new-item-1" });
const mockOnComplete = vi.fn().mockResolvedValue(undefined);
const mockOnOpenChange = vi.fn();

const createMockQueuedFile = (
  name = "test.mp4",
  type = "video/mp4",
  fileType: QueuedFile["fileType"] = "MEDIA"
): QueuedFile => ({
  id: `file-${name}`,
  file: new File(["data"], name, { type }),
  fileType,
  size: 4,
  status: "pending",
  isPrimary: false,
  isHero: false,
});

describe("useAddItemForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOnAdd.mockResolvedValue({ itemId: "new-item-1" });
  });

  describe("form state", () => {
    it("initializes with empty name", () => {
      const { result } = renderHook(() =>
        useAddItemForm(mockOnAdd, mockOnComplete, mockOnOpenChange)
      );

      expect(result.current.name).toBe("");
    });

    it("initializes with empty description", () => {
      const { result } = renderHook(() =>
        useAddItemForm(mockOnAdd, mockOnComplete, mockOnOpenChange)
      );

      expect(result.current.description).toBe("");
    });

    it("initializes at main step", () => {
      const { result } = renderHook(() =>
        useAddItemForm(mockOnAdd, mockOnComplete, mockOnOpenChange)
      );

      expect(result.current.currentStep).toBe("main");
    });

    it("tracks name changes", () => {
      const { result } = renderHook(() =>
        useAddItemForm(mockOnAdd, mockOnComplete, mockOnOpenChange)
      );

      act(() => {
        result.current.setName("New");
      });

      expect(result.current.name).toBe("New");
    });

    it("tracks description changes", () => {
      const { result } = renderHook(() =>
        useAddItemForm(mockOnAdd, mockOnComplete, mockOnOpenChange)
      );

      act(() => {
        result.current.setDescription("Desc");
      });

      expect(result.current.description).toBe("Desc");
    });
  });

  describe("step navigation", () => {
    it("starts at main step", () => {
      const { result } = renderHook(() =>
        useAddItemForm(mockOnAdd, mockOnComplete, mockOnOpenChange)
      );

      expect(result.current.currentStep).toBe("main");
    });

    it("can navigate to episode-picker", () => {
      const { result } = renderHook(() =>
        useAddItemForm(mockOnAdd, mockOnComplete, mockOnOpenChange)
      );

      act(() => {
        result.current.setCurrentStep("episode-picker");
      });

      expect(result.current.currentStep).toBe("episode-picker");
    });

    it("can navigate to tmdb-wizard", () => {
      const { result } = renderHook(() =>
        useAddItemForm(mockOnAdd, mockOnComplete, mockOnOpenChange)
      );

      act(() => {
        result.current.setCurrentStep("tmdb-wizard");
      });

      expect(result.current.currentStep).toBe("tmdb-wizard");
    });

    it("can navigate to wizard-summary", () => {
      const { result } = renderHook(() =>
        useAddItemForm(mockOnAdd, mockOnComplete, mockOnOpenChange)
      );

      act(() => {
        result.current.setCurrentStep("wizard-summary");
      });

      expect(result.current.currentStep).toBe("wizard-summary");
    });

    it("can navigate to change-poster", () => {
      const { result } = renderHook(() =>
        useAddItemForm(mockOnAdd, mockOnComplete, mockOnOpenChange)
      );

      act(() => {
        result.current.setCurrentStep("change-poster");
      });

      expect(result.current.currentStep).toBe("change-poster");
    });

    it("can navigate to change-hero", () => {
      const { result } = renderHook(() =>
        useAddItemForm(mockOnAdd, mockOnComplete, mockOnOpenChange)
      );

      act(() => {
        result.current.setCurrentStep("change-hero");
      });

      expect(result.current.currentStep).toBe("change-hero");
    });
  });

  describe("file queues", () => {
    it("initializes with empty queues", () => {
      const { result } = renderHook(() =>
        useAddItemForm(mockOnAdd, mockOnComplete, mockOnOpenChange)
      );

      expect(result.current.totalQueuedCount).toBe(0);
    });

    it("updates media category", () => {
      const { result } = renderHook(() =>
        useAddItemForm(mockOnAdd, mockOnComplete, mockOnOpenChange)
      );

      const mockFile = createMockQueuedFile();

      act(() => {
        result.current.updateCategory("media")([mockFile]);
      });

      expect(result.current.totalQueuedCount).toBe(1);
    });

    it("updates multiple categories", () => {
      const { result } = renderHook(() =>
        useAddItemForm(mockOnAdd, mockOnComplete, mockOnOpenChange)
      );

      const mediaFile = createMockQueuedFile("video.mp4", "video/mp4", "MEDIA");
      const artworkFile = createMockQueuedFile(
        "poster.jpg",
        "image/jpeg",
        "ARTWORK"
      );

      act(() => {
        result.current.updateCategory("media")([mediaFile]);
        result.current.updateCategory("artwork")([artworkFile]);
      });

      expect(result.current.totalQueuedCount).toBe(2);
    });
  });

  describe("resetForm", () => {
    it("resets name to empty", () => {
      const { result } = renderHook(() =>
        useAddItemForm(mockOnAdd, mockOnComplete, mockOnOpenChange)
      );

      act(() => {
        result.current.setName("Test");
      });

      expect(result.current.name).toBe("Test");

      act(() => {
        result.current.resetForm();
      });

      expect(result.current.name).toBe("");
    });

    it("resets description to empty", () => {
      const { result } = renderHook(() =>
        useAddItemForm(mockOnAdd, mockOnComplete, mockOnOpenChange)
      );

      act(() => {
        result.current.setDescription("Test");
      });

      expect(result.current.description).toBe("Test");

      act(() => {
        result.current.resetForm();
      });

      expect(result.current.description).toBe("");
    });

    it("resets step to main", () => {
      const { result } = renderHook(() =>
        useAddItemForm(mockOnAdd, mockOnComplete, mockOnOpenChange)
      );

      act(() => {
        result.current.setCurrentStep("tmdb-wizard");
      });

      expect(result.current.currentStep).toBe("tmdb-wizard");

      act(() => {
        result.current.resetForm();
      });

      expect(result.current.currentStep).toBe("main");
    });

    it("clears queued files", () => {
      const { result } = renderHook(() =>
        useAddItemForm(mockOnAdd, mockOnComplete, mockOnOpenChange)
      );

      const mockFile = createMockQueuedFile();

      act(() => {
        result.current.updateCategory("media")([mockFile]);
      });

      expect(result.current.totalQueuedCount).toBe(1);

      act(() => {
        result.current.resetForm();
      });

      expect(result.current.totalQueuedCount).toBe(0);
    });
  });

  describe("resetWizardState", () => {
    it("resets text options", () => {
      const { result } = renderHook(() =>
        useAddItemForm(mockOnAdd, mockOnComplete, mockOnOpenChange)
      );

      act(() => {
        result.current.setTextOptions({
          updateName: false,
          updateDescription: false,
        });
      });

      expect(result.current.textOptions.updateName).toBe(false);
      expect(result.current.textOptions.updateDescription).toBe(false);

      act(() => {
        result.current.resetWizardState();
      });

      expect(result.current.textOptions.updateName).toBe(true);
      expect(result.current.textOptions.updateDescription).toBe(true);
    });

    it("resets content type to movie", () => {
      const { result } = renderHook(() =>
        useAddItemForm(mockOnAdd, mockOnComplete, mockOnOpenChange)
      );

      act(() => {
        result.current.resetWizardState();
      });

      expect(result.current.contentType).toBe("movie");
    });
  });

  describe("artwork section visibility", () => {
    it("showArtworkSection is true for movies", () => {
      const { result } = renderHook(() =>
        useAddItemForm(mockOnAdd, mockOnComplete, mockOnOpenChange)
      );

      // Default contentType is "movie"
      expect(result.current.contentType).toBe("movie");
      expect(result.current.showArtworkSection).toBe(true);
    });

    it("showArtworkSection is true when contentType is not episode", () => {
      const { result } = renderHook(() =>
        useAddItemForm(mockOnAdd, mockOnComplete, mockOnOpenChange)
      );

      // Initial state contentType is "movie", showArtworkSection should be true
      expect(result.current.showArtworkSection).toBe(true);
    });
  });

  describe("handleSubmit", () => {
    it("does not submit with empty name", async () => {
      const { result } = renderHook(() =>
        useAddItemForm(mockOnAdd, mockOnComplete, mockOnOpenChange)
      );

      await act(async () => {
        await result.current.handleSubmit();
      });

      expect(mockOnAdd).not.toHaveBeenCalled();
    });

    it("calls onAdd with name", async () => {
      const { result } = renderHook(() =>
        useAddItemForm(mockOnAdd, mockOnComplete, mockOnOpenChange)
      );

      act(() => {
        result.current.setName("Test");
      });

      await act(async () => {
        await result.current.handleSubmit();
      });

      expect(mockOnAdd).toHaveBeenCalledWith("Test", undefined, undefined);
    });

    it("calls onAdd with description", async () => {
      const { result } = renderHook(() =>
        useAddItemForm(mockOnAdd, mockOnComplete, mockOnOpenChange)
      );

      act(() => {
        result.current.setName("Test");
        result.current.setDescription("Desc");
      });

      await act(async () => {
        await result.current.handleSubmit();
      });

      expect(mockOnAdd).toHaveBeenCalledWith("Test", "Desc", undefined);
    });

    it("shows success toast", async () => {
      const { result } = renderHook(() =>
        useAddItemForm(mockOnAdd, mockOnComplete, mockOnOpenChange)
      );

      act(() => {
        result.current.setName("Test");
      });

      await act(async () => {
        await result.current.handleSubmit();
      });

      expect(toast.success).toHaveBeenCalledWith('Created "Test"');
    });

    it("calls onOpenChange(false) after success", async () => {
      const { result } = renderHook(() =>
        useAddItemForm(mockOnAdd, mockOnComplete, mockOnOpenChange)
      );

      act(() => {
        result.current.setName("Test");
      });

      await act(async () => {
        await result.current.handleSubmit();
      });

      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });
  });

  describe("display title", () => {
    it("returns empty string when no pending result", () => {
      const { result } = renderHook(() =>
        useAddItemForm(mockOnAdd, mockOnComplete, mockOnOpenChange)
      );

      expect(result.current.displayTitle).toBe("");
    });
  });

  describe("handleWizardCancel", () => {
    it("resets to main step", () => {
      const { result } = renderHook(() =>
        useAddItemForm(mockOnAdd, mockOnComplete, mockOnOpenChange)
      );

      act(() => {
        result.current.setCurrentStep("tmdb-wizard");
      });

      expect(result.current.currentStep).toBe("tmdb-wizard");

      act(() => {
        result.current.handleWizardCancel();
      });

      expect(result.current.currentStep).toBe("main");
    });

    it("clears pending TMDB result", () => {
      const { result } = renderHook(() =>
        useAddItemForm(mockOnAdd, mockOnComplete, mockOnOpenChange)
      );

      act(() => {
        result.current.handleWizardCancel();
      });

      expect(result.current.pendingTmdbResult).toBeNull();
    });
  });
});
