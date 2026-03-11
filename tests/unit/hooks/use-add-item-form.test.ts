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
  BatchUploadManager: vi.fn().mockImplementation(function (
    this: Record<string, unknown>
  ) {
    this.start = vi.fn().mockResolvedValue({
      status: "complete",
      files: [],
      successCount: 0,
      errorCount: 0,
    });
    this.cancel = vi.fn();
  }),
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

import {
  getMetadataPreviewAction,
  getEpisodePreviewAction,
  getSeasonMetadataAction,
} from "@/lib/tmdb-actions";
import { createUploadSessions } from "@/lib/google-drive-upload";

const mockedGetMetadataPreview = vi.mocked(getMetadataPreviewAction);
const mockedGetEpisodePreview = vi.mocked(getEpisodePreviewAction);
const mockedGetSeasonMetadata = vi.mocked(getSeasonMetadataAction);
const mockedCreateUploadSessions = vi.mocked(createUploadSessions);

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
    mockedGetMetadataPreview.mockResolvedValue({
      success: true,
      data: {
        name: "Test Movie",
        description: "A test movie",
        posterUrl: null,
        backdropUrl: null,
        posterPath: null,
        backdropPath: null,
      },
    });
    mockedGetEpisodePreview.mockResolvedValue({
      success: true,
      data: {
        name: "Episode 1",
        description: "First ep",
        stillUrl: null,
        stillPath: null,
        seasonNumber: 1,
        episodeNumber: 1,
      },
    });
    mockedGetSeasonMetadata.mockResolvedValue({
      success: true,
      data: {
        name: "Season 1",
        description: "First season",
        posterUrl: null,
        posterPath: null,
        seasonNumber: 1,
        airDate: null,
      },
    });
    mockedCreateUploadSessions.mockResolvedValue({
      success: true,
      sessions: [],
    });
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

  describe("handleMediaSelect", () => {
    const movieResult = {
      id: 550,
      mediaType: "movie" as const,
      title: "Fight Club",
      overview: "An insomniac office worker...",
      posterPath: "/pB8BM7pdSp6B6Ih7QI4S2t0PODy.jpg",
      backdropPath: "/hZkgoQYus5dXo3H8T7Uef6DNknx.jpg",
      year: "1999",
    };

    const tvResult = {
      id: 1396,
      mediaType: "tv" as const,
      title: "Breaking Bad",
      overview: "A chemistry teacher diagnosed with cancer...",
      posterPath: "/ggFHVNu6YYI5L9pCfOacjizRGt.jpg",
      backdropPath: "/tsRy63Mu5cu8etL1X7ZLyf7UP1M.jpg",
      year: "2008",
    };

    it("navigates TV shows to episode-picker", async () => {
      const { result } = renderHook(() =>
        useAddItemForm(mockOnAdd, mockOnComplete, mockOnOpenChange)
      );

      await act(async () => {
        await result.current.handleMediaSelect(tvResult);
      });

      expect(result.current.currentStep).toBe("episode-picker");
      expect(result.current.pendingTmdbResult).toEqual(tvResult);
    });

    it("navigates movies directly to tmdb-wizard", async () => {
      const { result } = renderHook(() =>
        useAddItemForm(mockOnAdd, mockOnComplete, mockOnOpenChange)
      );

      await act(async () => {
        await result.current.handleMediaSelect(movieResult);
      });

      expect(result.current.currentStep).toBe("tmdb-wizard");
      expect(result.current.pendingTmdbResult).toEqual(movieResult);
    });

    it("stores pending result for TV shows", async () => {
      const { result } = renderHook(() =>
        useAddItemForm(mockOnAdd, mockOnComplete, mockOnOpenChange)
      );

      await act(async () => {
        await result.current.handleMediaSelect(tvResult);
      });

      expect(result.current.pendingTmdbResult).toEqual(tvResult);
    });
  });

  describe("fetchPreviewAndOpenWizard", () => {
    it("fetches movie preview and opens wizard", async () => {
      const { result } = renderHook(() =>
        useAddItemForm(mockOnAdd, mockOnComplete, mockOnOpenChange)
      );

      await act(async () => {
        await result.current.fetchPreviewAndOpenWizard(550, "movie");
      });

      expect(mockedGetMetadataPreview).toHaveBeenCalledWith(550, "movie");
      expect(result.current.currentStep).toBe("tmdb-wizard");
      expect(result.current.tmdbPreview).toEqual({
        name: "Test Movie",
        description: "A test movie",
      });
      expect(result.current.contentType).toBe("movie");
    });

    it("fetches TV show preview and sets contentType to show", async () => {
      const { result } = renderHook(() =>
        useAddItemForm(mockOnAdd, mockOnComplete, mockOnOpenChange)
      );

      await act(async () => {
        await result.current.fetchPreviewAndOpenWizard(1396, "tv");
      });

      expect(mockedGetMetadataPreview).toHaveBeenCalledWith(1396, "tv");
      expect(result.current.currentStep).toBe("tmdb-wizard");
      expect(result.current.contentType).toBe("show");
    });

    it("fetches episode preview with episode selection", async () => {
      const { result } = renderHook(() =>
        useAddItemForm(mockOnAdd, mockOnComplete, mockOnOpenChange)
      );

      await act(async () => {
        await result.current.fetchPreviewAndOpenWizard(1396, "tv", {
          type: "episode",
          seasonNumber: 1,
          episodeNumber: 3,
        });
      });

      expect(mockedGetEpisodePreview).toHaveBeenCalledWith(1396, 1, 3);
      expect(result.current.currentStep).toBe("tmdb-wizard");
      expect(result.current.tmdbPreview).toEqual({
        name: "Episode 1",
        description: "First ep",
      });
      expect(result.current.contentType).toBe("episode");
      expect(result.current.selectedSeasonNumber).toBe(1);
    });

    it("fetches season preview with season selection", async () => {
      const { result } = renderHook(() =>
        useAddItemForm(mockOnAdd, mockOnComplete, mockOnOpenChange)
      );

      await act(async () => {
        await result.current.fetchPreviewAndOpenWizard(1396, "tv", {
          type: "season",
          seasonNumber: 2,
        });
      });

      expect(mockedGetSeasonMetadata).toHaveBeenCalledWith(1396, 2);
      expect(result.current.currentStep).toBe("tmdb-wizard");
      expect(result.current.tmdbPreview).toEqual({
        name: "Season 1",
        description: "First season",
      });
      expect(result.current.contentType).toBe("season");
      expect(result.current.selectedSeasonNumber).toBe(2);
    });

    it("falls back to main on episode preview failure", async () => {
      mockedGetEpisodePreview.mockResolvedValueOnce({
        success: false,
        error: "Not found",
      });

      const { result } = renderHook(() =>
        useAddItemForm(mockOnAdd, mockOnComplete, mockOnOpenChange)
      );

      // Set a pending result so applyBasicInfo can use it
      await act(async () => {
        await result.current.handleMediaSelect({
          id: 1396,
          mediaType: "tv",
          title: "Breaking Bad",
          overview: "A chemistry teacher",
          posterPath: null,
          backdropPath: null,
          year: "2008",
        });
      });

      await act(async () => {
        await result.current.fetchPreviewAndOpenWizard(1396, "tv", {
          type: "episode",
          seasonNumber: 1,
          episodeNumber: 1,
        });
      });

      expect(result.current.currentStep).toBe("main");
      expect(toast.error).toHaveBeenCalledWith(
        "Could not fetch episode preview"
      );
    });

    it("falls back to main on season preview failure", async () => {
      mockedGetSeasonMetadata.mockResolvedValueOnce({
        success: false,
        error: "Not found",
      });

      const { result } = renderHook(() =>
        useAddItemForm(mockOnAdd, mockOnComplete, mockOnOpenChange)
      );

      await act(async () => {
        await result.current.fetchPreviewAndOpenWizard(1396, "tv", {
          type: "season",
          seasonNumber: 1,
        });
      });

      expect(result.current.currentStep).toBe("main");
      expect(toast.error).toHaveBeenCalledWith(
        "Could not fetch season preview"
      );
    });

    it("falls back to main on movie preview failure", async () => {
      mockedGetMetadataPreview.mockResolvedValueOnce({
        success: false,
        error: "Not found",
      });

      const { result } = renderHook(() =>
        useAddItemForm(mockOnAdd, mockOnComplete, mockOnOpenChange)
      );

      await act(async () => {
        await result.current.fetchPreviewAndOpenWizard(550, "movie");
      });

      expect(result.current.currentStep).toBe("main");
      expect(toast.error).toHaveBeenCalledWith(
        "Could not fetch full preview, basic info applied"
      );
    });

    it("handles network error gracefully", async () => {
      mockedGetMetadataPreview.mockRejectedValueOnce(new Error("Network"));

      const { result } = renderHook(() =>
        useAddItemForm(mockOnAdd, mockOnComplete, mockOnOpenChange)
      );

      await act(async () => {
        await result.current.fetchPreviewAndOpenWizard(550, "movie");
      });

      expect(result.current.currentStep).toBe("main");
      expect(result.current.isLoadingPreview).toBe(false);
    });

    it("applies basic info on failure when pending result exists", async () => {
      mockedGetMetadataPreview.mockRejectedValueOnce(new Error("Network"));

      const { result } = renderHook(() =>
        useAddItemForm(mockOnAdd, mockOnComplete, mockOnOpenChange)
      );

      // First set a pending result via handleMediaSelect (movie goes to wizard directly — but we need to trigger a failure)
      // Use handleMediaSelect for TV to just set pendingTmdbResult
      await act(async () => {
        await result.current.handleMediaSelect({
          id: 999,
          mediaType: "tv",
          title: "Test Show",
          overview: "A great show about testing",
          posterPath: null,
          backdropPath: null,
          year: "2024",
        });
      });

      expect(result.current.pendingTmdbResult).not.toBeNull();

      mockedGetMetadataPreview.mockRejectedValueOnce(new Error("Network"));

      await act(async () => {
        await result.current.fetchPreviewAndOpenWizard(999, "movie");
      });

      // applyBasicInfo should have applied the pending result
      expect(result.current.name).toBe("Test Show (2024)");
      expect(result.current.description).toBe("A great show about testing");
      expect(result.current.currentStep).toBe("main");
    });

    it("resets isLoadingPreview after fetch completes", async () => {
      const { result } = renderHook(() =>
        useAddItemForm(mockOnAdd, mockOnComplete, mockOnOpenChange)
      );

      await act(async () => {
        await result.current.fetchPreviewAndOpenWizard(550, "movie");
      });

      expect(result.current.isLoadingPreview).toBe(false);
    });

    it("sets empty images for episode selections", async () => {
      const { result } = renderHook(() =>
        useAddItemForm(mockOnAdd, mockOnComplete, mockOnOpenChange)
      );

      await act(async () => {
        await result.current.fetchPreviewAndOpenWizard(1396, "tv", {
          type: "episode",
          seasonNumber: 1,
          episodeNumber: 1,
        });
      });

      expect(result.current.tmdbImages).toEqual({
        posters: [],
        backdrops: [],
      });
    });
  });

  describe("handleEpisodePickerCancel", () => {
    it("clears pending result and resets to main", async () => {
      const { result } = renderHook(() =>
        useAddItemForm(mockOnAdd, mockOnComplete, mockOnOpenChange)
      );

      // Set up state as if TV show was selected
      await act(async () => {
        await result.current.handleMediaSelect({
          id: 1396,
          mediaType: "tv",
          title: "Breaking Bad",
          overview: "A chemistry teacher",
          posterPath: null,
          backdropPath: null,
          year: "2008",
        });
      });

      expect(result.current.currentStep).toBe("episode-picker");

      act(() => {
        result.current.handleEpisodePickerCancel();
      });

      expect(result.current.pendingTmdbResult).toBeNull();
      expect(result.current.currentStep).toBe("main");
    });

    it("resets tvPickerLevel to show", async () => {
      const { result } = renderHook(() =>
        useAddItemForm(mockOnAdd, mockOnComplete, mockOnOpenChange)
      );

      act(() => {
        result.current.setTvPickerLevel("season");
      });

      act(() => {
        result.current.handleEpisodePickerCancel();
      });

      expect(result.current.tvPickerLevel).toBe("show");
    });
  });

  describe("handleEpisodePickerBack", () => {
    it("cancels when at show level", async () => {
      const { result } = renderHook(() =>
        useAddItemForm(mockOnAdd, mockOnComplete, mockOnOpenChange)
      );

      // Navigate to episode picker
      await act(async () => {
        await result.current.handleMediaSelect({
          id: 1396,
          mediaType: "tv",
          title: "Breaking Bad",
          overview: "Test",
          posterPath: null,
          backdropPath: null,
          year: "2008",
        });
      });

      expect(result.current.currentStep).toBe("episode-picker");

      // At show level, back should cancel
      act(() => {
        result.current.handleEpisodePickerBack();
      });

      expect(result.current.currentStep).toBe("main");
      expect(result.current.pendingTmdbResult).toBeNull();
    });

    it("calls tvPickerBackRef at season level", () => {
      const { result } = renderHook(() =>
        useAddItemForm(mockOnAdd, mockOnComplete, mockOnOpenChange)
      );

      const mockBack = vi.fn();
      result.current.tvPickerBackRef.current = mockBack;

      act(() => {
        result.current.setTvPickerLevel("season");
      });

      act(() => {
        result.current.handleEpisodePickerBack();
      });

      expect(mockBack).toHaveBeenCalled();
    });
  });

  describe("handleTVPickerComplete", () => {
    it("delegates to fetchPreviewAndOpenWizard with correct args", async () => {
      const { result } = renderHook(() =>
        useAddItemForm(mockOnAdd, mockOnComplete, mockOnOpenChange)
      );

      await act(async () => {
        await result.current.handleTVPickerComplete({
          selection: { type: "show" },
          contentType: "show",
          tmdbResult: {
            id: 1396,
            mediaType: "tv",
            title: "Breaking Bad",
            overview: "Test",
            posterPath: null,
            backdropPath: null,
            year: "2008",
          },
          selectedSeason: null,
          selectedEpisode: null,
        });
      });

      expect(mockedGetMetadataPreview).toHaveBeenCalledWith(1396, "tv");
      expect(result.current.currentStep).toBe("tmdb-wizard");
    });

    it("passes season selection through", async () => {
      const { result } = renderHook(() =>
        useAddItemForm(mockOnAdd, mockOnComplete, mockOnOpenChange)
      );

      await act(async () => {
        await result.current.handleTVPickerComplete({
          selection: { type: "season", seasonNumber: 3 },
          contentType: "season",
          tmdbResult: {
            id: 1396,
            mediaType: "tv",
            title: "Breaking Bad",
            overview: "Test",
            posterPath: null,
            backdropPath: null,
            year: "2008",
          },
          selectedSeason: null,
          selectedEpisode: null,
        });
      });

      expect(mockedGetSeasonMetadata).toHaveBeenCalledWith(1396, 3);
      expect(result.current.contentType).toBe("season");
    });
  });

  describe("handleTMDBWizardComplete", () => {
    const wizardResult = {
      tmdbResult: {
        id: 550,
        mediaType: "movie" as const,
        title: "Fight Club",
        overview: "An insomniac...",
        posterPath: "/poster.jpg",
        backdropPath: "/backdrop.jpg",
        year: "1999",
      },
      textOptions: { updateName: true, updateDescription: true },
      preview: { name: "Fight Club (1999)", description: "An insomniac..." },
      contentType: "movie" as const,
      poster: { value: "/poster.jpg", source: "tmdb" as const },
      backdrop: { value: "/backdrop.jpg", source: "tmdb" as const },
      logo: null,
      still: null,
      displayOptions: {
        showTagline: true,
        showMetadata: true,
        showGenres: true,
        showCast: true,
        showProviders: true,
        showVideos: true,
        showRecommendations: true,
      },
    };

    it("applies name when updateName is true", () => {
      const { result } = renderHook(() =>
        useAddItemForm(mockOnAdd, mockOnComplete, mockOnOpenChange)
      );

      act(() => {
        result.current.handleTMDBWizardComplete(wizardResult);
      });

      expect(result.current.name).toBe("Fight Club (1999)");
    });

    it("does not apply name when updateName is false", () => {
      const { result } = renderHook(() =>
        useAddItemForm(mockOnAdd, mockOnComplete, mockOnOpenChange)
      );

      act(() => {
        result.current.setName("Original Name");
      });

      act(() => {
        result.current.handleTMDBWizardComplete({
          ...wizardResult,
          textOptions: { updateName: false, updateDescription: true },
        });
      });

      expect(result.current.name).toBe("Original Name");
    });

    it("applies description when updateDescription is true", () => {
      const { result } = renderHook(() =>
        useAddItemForm(mockOnAdd, mockOnComplete, mockOnOpenChange)
      );

      act(() => {
        result.current.handleTMDBWizardComplete(wizardResult);
      });

      expect(result.current.description).toBe("An insomniac...");
    });

    it("does not apply description when updateDescription is false", () => {
      const { result } = renderHook(() =>
        useAddItemForm(mockOnAdd, mockOnComplete, mockOnOpenChange)
      );

      act(() => {
        result.current.setDescription("Original Desc");
      });

      act(() => {
        result.current.handleTMDBWizardComplete({
          ...wizardResult,
          textOptions: { updateName: true, updateDescription: false },
        });
      });

      expect(result.current.description).toBe("Original Desc");
    });

    it("applies poster artwork selection", () => {
      const { result } = renderHook(() =>
        useAddItemForm(mockOnAdd, mockOnComplete, mockOnOpenChange)
      );

      act(() => {
        result.current.handleTMDBWizardComplete(wizardResult);
      });

      expect(result.current.posterValue).toBe("/poster.jpg");
      expect(result.current.posterSource).toBe("tmdb");
      expect(result.current.posterSkipped).toBe(false);
    });

    it("marks poster as skipped when null", () => {
      const { result } = renderHook(() =>
        useAddItemForm(mockOnAdd, mockOnComplete, mockOnOpenChange)
      );

      act(() => {
        result.current.handleTMDBWizardComplete({
          ...wizardResult,
          poster: null,
        });
      });

      expect(result.current.posterValue).toBeNull();
      expect(result.current.posterSource).toBeNull();
      expect(result.current.posterSkipped).toBe(true);
    });

    it("applies backdrop artwork selection", () => {
      const { result } = renderHook(() =>
        useAddItemForm(mockOnAdd, mockOnComplete, mockOnOpenChange)
      );

      act(() => {
        result.current.handleTMDBWizardComplete(wizardResult);
      });

      expect(result.current.backdropValue).toBe("/backdrop.jpg");
      expect(result.current.backdropSource).toBe("tmdb");
      expect(result.current.backdropSkipped).toBe(false);
    });

    it("marks backdrop as skipped when null", () => {
      const { result } = renderHook(() =>
        useAddItemForm(mockOnAdd, mockOnComplete, mockOnOpenChange)
      );

      act(() => {
        result.current.handleTMDBWizardComplete({
          ...wizardResult,
          backdrop: null,
        });
      });

      expect(result.current.backdropValue).toBeNull();
      expect(result.current.backdropSource).toBeNull();
      expect(result.current.backdropSkipped).toBe(true);
    });

    it("stores TMDB selection options", () => {
      const { result } = renderHook(() =>
        useAddItemForm(mockOnAdd, mockOnComplete, mockOnOpenChange)
      );

      act(() => {
        result.current.handleTMDBWizardComplete(wizardResult);
      });

      expect(result.current.selectedTmdbOptions).toEqual({
        tmdbId: 550,
        mediaType: "movie",
        options: {
          updateName: true,
          updateDescription: true,
          updatePoster: true,
          updateBackdrop: true,
        },
        preview: {
          name: "Fight Club (1999)",
          description: "An insomniac...",
          posterPath: "/poster.jpg",
          backdropPath: "/backdrop.jpg",
        },
        displayOptions: wizardResult.displayOptions,
      });
    });

    it("navigates to wizard-summary", () => {
      const { result } = renderHook(() =>
        useAddItemForm(mockOnAdd, mockOnComplete, mockOnOpenChange)
      );

      act(() => {
        result.current.handleTMDBWizardComplete(wizardResult);
      });

      expect(result.current.currentStep).toBe("wizard-summary");
    });
  });

  describe("change artwork handlers", () => {
    it("handleOpenChangePoster copies current poster to temp and navigates", () => {
      const { result } = renderHook(() =>
        useAddItemForm(mockOnAdd, mockOnComplete, mockOnOpenChange)
      );

      // Set poster values via wizard complete
      act(() => {
        result.current.handleTMDBWizardComplete({
          tmdbResult: {
            id: 550,
            mediaType: "movie",
            title: "Test",
            overview: "",
            posterPath: "/poster.jpg",
            backdropPath: null,
            year: "1999",
          },
          textOptions: { updateName: true, updateDescription: true },
          preview: { name: "Test", description: "" },
          contentType: "movie",
          poster: { value: "/poster.jpg", source: "tmdb" },
          backdrop: null,
          logo: null,
          still: null,
          displayOptions: {
            showTagline: true,
            showMetadata: true,
            showGenres: true,
            showCast: true,
            showProviders: true,
            showVideos: true,
            showRecommendations: true,
          },
        });
      });

      act(() => {
        result.current.handleOpenChangePoster();
      });

      expect(result.current.currentStep).toBe("change-poster");
      expect(result.current.tempPosterValue).toBe("/poster.jpg");
      expect(result.current.tempPosterSource).toBe("tmdb");
    });

    it("handleOpenChangeHero copies current backdrop to temp and navigates", () => {
      const { result } = renderHook(() =>
        useAddItemForm(mockOnAdd, mockOnComplete, mockOnOpenChange)
      );

      act(() => {
        result.current.handleTMDBWizardComplete({
          tmdbResult: {
            id: 550,
            mediaType: "movie",
            title: "Test",
            overview: "",
            posterPath: null,
            backdropPath: "/backdrop.jpg",
            year: "1999",
          },
          textOptions: { updateName: true, updateDescription: true },
          preview: { name: "Test", description: "" },
          contentType: "movie",
          poster: null,
          backdrop: { value: "/backdrop.jpg", source: "tmdb" },
          logo: null,
          still: null,
          displayOptions: {
            showTagline: true,
            showMetadata: true,
            showGenres: true,
            showCast: true,
            showProviders: true,
            showVideos: true,
            showRecommendations: true,
          },
        });
      });

      act(() => {
        result.current.handleOpenChangeHero();
      });

      expect(result.current.currentStep).toBe("change-hero");
      expect(result.current.tempBackdropValue).toBe("/backdrop.jpg");
      expect(result.current.tempBackdropSource).toBe("tmdb");
    });

    it("handleTempPosterSelect updates temp poster state", () => {
      const { result } = renderHook(() =>
        useAddItemForm(mockOnAdd, mockOnComplete, mockOnOpenChange)
      );

      act(() => {
        result.current.handleTempPosterSelect("/new-poster.jpg", "tmdb");
      });

      expect(result.current.tempPosterValue).toBe("/new-poster.jpg");
      expect(result.current.tempPosterSource).toBe("tmdb");
    });

    it("handleTempPosterSelect clears source when value is null", () => {
      const { result } = renderHook(() =>
        useAddItemForm(mockOnAdd, mockOnComplete, mockOnOpenChange)
      );

      act(() => {
        result.current.handleTempPosterSelect("/poster.jpg", "tmdb");
      });

      act(() => {
        result.current.handleTempPosterSelect(null, "tmdb");
      });

      expect(result.current.tempPosterValue).toBeNull();
      expect(result.current.tempPosterSource).toBeNull();
    });

    it("handleTempBackdropSelect updates temp backdrop state", () => {
      const { result } = renderHook(() =>
        useAddItemForm(mockOnAdd, mockOnComplete, mockOnOpenChange)
      );

      act(() => {
        result.current.handleTempBackdropSelect("/new-backdrop.jpg", "tmdb");
      });

      expect(result.current.tempBackdropValue).toBe("/new-backdrop.jpg");
      expect(result.current.tempBackdropSource).toBe("tmdb");
    });

    it("handleTempBackdropSelect clears source when value is null", () => {
      const { result } = renderHook(() =>
        useAddItemForm(mockOnAdd, mockOnComplete, mockOnOpenChange)
      );

      act(() => {
        result.current.handleTempBackdropSelect("/bg.jpg", "tmdb");
      });

      act(() => {
        result.current.handleTempBackdropSelect(null, "tmdb");
      });

      expect(result.current.tempBackdropValue).toBeNull();
      expect(result.current.tempBackdropSource).toBeNull();
    });

    it("handleSavePosterChange commits temp poster to main state", () => {
      const { result } = renderHook(() =>
        useAddItemForm(mockOnAdd, mockOnComplete, mockOnOpenChange)
      );

      // Start change flow
      act(() => {
        result.current.handleOpenChangePoster();
      });

      act(() => {
        result.current.handleTempPosterSelect("/new-poster.jpg", "tmdb");
      });

      act(() => {
        result.current.handleSavePosterChange();
      });

      expect(result.current.posterValue).toBe("/new-poster.jpg");
      expect(result.current.posterSource).toBe("tmdb");
      expect(result.current.currentStep).toBe("wizard-summary");
    });

    it("handleSavePosterChange respects skip state", () => {
      const { result } = renderHook(() =>
        useAddItemForm(mockOnAdd, mockOnComplete, mockOnOpenChange)
      );

      act(() => {
        result.current.handleOpenChangePoster();
      });

      act(() => {
        result.current.handleTempPosterSelect("/poster.jpg", "tmdb");
        result.current.setTempPosterSkipped(true);
      });

      act(() => {
        result.current.handleSavePosterChange();
      });

      expect(result.current.posterValue).toBeNull();
      expect(result.current.posterSource).toBeNull();
      expect(result.current.posterSkipped).toBe(true);
    });

    it("handleSaveHeroChange commits temp backdrop to main state", () => {
      const { result } = renderHook(() =>
        useAddItemForm(mockOnAdd, mockOnComplete, mockOnOpenChange)
      );

      act(() => {
        result.current.handleOpenChangeHero();
      });

      act(() => {
        result.current.handleTempBackdropSelect("/new-bg.jpg", "tmdb");
      });

      act(() => {
        result.current.handleSaveHeroChange();
      });

      expect(result.current.backdropValue).toBe("/new-bg.jpg");
      expect(result.current.backdropSource).toBe("tmdb");
      expect(result.current.currentStep).toBe("wizard-summary");
    });

    it("handleSaveHeroChange respects skip state", () => {
      const { result } = renderHook(() =>
        useAddItemForm(mockOnAdd, mockOnComplete, mockOnOpenChange)
      );

      act(() => {
        result.current.handleOpenChangeHero();
      });

      act(() => {
        result.current.handleTempBackdropSelect("/bg.jpg", "tmdb");
        result.current.setTempBackdropSkipped(true);
      });

      act(() => {
        result.current.handleSaveHeroChange();
      });

      expect(result.current.backdropValue).toBeNull();
      expect(result.current.backdropSource).toBeNull();
      expect(result.current.backdropSkipped).toBe(true);
    });

    it("handleCancelArtworkChange returns to wizard-summary without saving", () => {
      const { result } = renderHook(() =>
        useAddItemForm(mockOnAdd, mockOnComplete, mockOnOpenChange)
      );

      // Set original poster
      act(() => {
        result.current.handleTMDBWizardComplete({
          tmdbResult: {
            id: 550,
            mediaType: "movie",
            title: "Test",
            overview: "",
            posterPath: "/original.jpg",
            backdropPath: null,
            year: "1999",
          },
          textOptions: { updateName: true, updateDescription: true },
          preview: { name: "Test", description: "" },
          contentType: "movie",
          poster: { value: "/original.jpg", source: "tmdb" },
          backdrop: null,
          logo: null,
          still: null,
          displayOptions: {
            showTagline: true,
            showMetadata: true,
            showGenres: true,
            showCast: true,
            showProviders: true,
            showVideos: true,
            showRecommendations: true,
          },
        });
      });

      act(() => {
        result.current.handleOpenChangePoster();
      });

      // Change temp value
      act(() => {
        result.current.handleTempPosterSelect("/different.jpg", "tmdb");
      });

      // Cancel — should not commit temp values
      act(() => {
        result.current.handleCancelArtworkChange();
      });

      expect(result.current.posterValue).toBe("/original.jpg");
      expect(result.current.currentStep).toBe("wizard-summary");
    });

    it("handleClearPoster clears poster and marks as skipped", () => {
      const { result } = renderHook(() =>
        useAddItemForm(mockOnAdd, mockOnComplete, mockOnOpenChange)
      );

      // Set up poster first
      act(() => {
        result.current.handleTMDBWizardComplete({
          tmdbResult: {
            id: 550,
            mediaType: "movie",
            title: "Test",
            overview: "",
            posterPath: "/poster.jpg",
            backdropPath: null,
            year: "1999",
          },
          textOptions: { updateName: true, updateDescription: true },
          preview: { name: "Test", description: "" },
          contentType: "movie",
          poster: { value: "/poster.jpg", source: "tmdb" },
          backdrop: null,
          logo: null,
          still: null,
          displayOptions: {
            showTagline: true,
            showMetadata: true,
            showGenres: true,
            showCast: true,
            showProviders: true,
            showVideos: true,
            showRecommendations: true,
          },
        });
      });

      act(() => {
        result.current.handleClearPoster();
      });

      expect(result.current.posterValue).toBeNull();
      expect(result.current.posterSource).toBeNull();
      expect(result.current.posterSkipped).toBe(true);
    });

    it("handleClearBackdrop clears backdrop and marks as skipped", () => {
      const { result } = renderHook(() =>
        useAddItemForm(mockOnAdd, mockOnComplete, mockOnOpenChange)
      );

      act(() => {
        result.current.handleTMDBWizardComplete({
          tmdbResult: {
            id: 550,
            mediaType: "movie",
            title: "Test",
            overview: "",
            posterPath: null,
            backdropPath: "/backdrop.jpg",
            year: "1999",
          },
          textOptions: { updateName: true, updateDescription: true },
          preview: { name: "Test", description: "" },
          contentType: "movie",
          poster: null,
          backdrop: { value: "/backdrop.jpg", source: "tmdb" },
          logo: null,
          still: null,
          displayOptions: {
            showTagline: true,
            showMetadata: true,
            showGenres: true,
            showCast: true,
            showProviders: true,
            showVideos: true,
            showRecommendations: true,
          },
        });
      });

      act(() => {
        result.current.handleClearBackdrop();
      });

      expect(result.current.backdropValue).toBeNull();
      expect(result.current.backdropSource).toBeNull();
      expect(result.current.backdropSkipped).toBe(true);
    });
  });

  describe("handleSubmit with TMDB data", () => {
    it("includes TMDB selection when pendingTmdbResult and tmdbPreview are set", async () => {
      const { result } = renderHook(() =>
        useAddItemForm(mockOnAdd, mockOnComplete, mockOnOpenChange)
      );

      // Go through the wizard flow
      await act(async () => {
        await result.current.handleMediaSelect({
          id: 550,
          mediaType: "movie",
          title: "Fight Club",
          overview: "An insomniac...",
          posterPath: "/poster.jpg",
          backdropPath: "/backdrop.jpg",
          year: "1999",
        });
      });

      // Complete wizard
      act(() => {
        result.current.handleTMDBWizardComplete({
          tmdbResult: {
            id: 550,
            mediaType: "movie",
            title: "Fight Club",
            overview: "An insomniac...",
            posterPath: "/poster.jpg",
            backdropPath: "/backdrop.jpg",
            year: "1999",
          },
          textOptions: { updateName: true, updateDescription: true },
          preview: {
            name: "Fight Club (1999)",
            description: "An insomniac...",
          },
          contentType: "movie",
          poster: { value: "/poster.jpg", source: "tmdb" },
          backdrop: { value: "/backdrop.jpg", source: "tmdb" },
          logo: null,
          still: null,
          displayOptions: {
            showTagline: true,
            showMetadata: true,
            showGenres: true,
            showCast: true,
            showProviders: true,
            showVideos: true,
            showRecommendations: true,
          },
        });
      });

      await act(async () => {
        await result.current.handleSubmit();
      });

      expect(mockOnAdd).toHaveBeenCalledWith(
        "Fight Club (1999)",
        "An insomniac...",
        expect.objectContaining({
          tmdbId: 550,
          mediaType: "movie",
          options: expect.objectContaining({
            updateName: true,
            updateDescription: true,
            updatePoster: true,
            updateBackdrop: true,
          }),
        })
      );
    });

    it("sets updatePoster false when poster is skipped", async () => {
      const { result } = renderHook(() =>
        useAddItemForm(mockOnAdd, mockOnComplete, mockOnOpenChange)
      );

      await act(async () => {
        await result.current.handleMediaSelect({
          id: 550,
          mediaType: "movie",
          title: "Fight Club",
          overview: "An insomniac...",
          posterPath: "/poster.jpg",
          backdropPath: "/backdrop.jpg",
          year: "1999",
        });
      });

      act(() => {
        result.current.handleTMDBWizardComplete({
          tmdbResult: {
            id: 550,
            mediaType: "movie",
            title: "Fight Club",
            overview: "An insomniac...",
            posterPath: "/poster.jpg",
            backdropPath: "/backdrop.jpg",
            year: "1999",
          },
          textOptions: { updateName: true, updateDescription: true },
          preview: {
            name: "Fight Club (1999)",
            description: "An insomniac...",
          },
          contentType: "movie",
          poster: null,
          backdrop: { value: "/backdrop.jpg", source: "tmdb" },
          logo: null,
          still: null,
          displayOptions: {
            showTagline: true,
            showMetadata: true,
            showGenres: true,
            showCast: true,
            showProviders: true,
            showVideos: true,
            showRecommendations: true,
          },
        });
      });

      await act(async () => {
        await result.current.handleSubmit();
      });

      const calledWith = mockOnAdd.mock.calls[0][2];
      expect(calledWith.options.updatePoster).toBe(false);
    });
  });

  describe("handleSubmit error handling", () => {
    it("shows error toast when onAdd returns error", async () => {
      mockOnAdd.mockResolvedValueOnce({ error: "Name already taken" });

      const { result } = renderHook(() =>
        useAddItemForm(mockOnAdd, mockOnComplete, mockOnOpenChange)
      );

      act(() => {
        result.current.setName("Duplicate");
      });

      await act(async () => {
        await result.current.handleSubmit();
      });

      expect(toast.error).toHaveBeenCalledWith("Name already taken");
      expect(mockOnOpenChange).not.toHaveBeenCalled();
    });

    it("shows generic error when onAdd returns no itemId", async () => {
      mockOnAdd.mockResolvedValueOnce({});

      const { result } = renderHook(() =>
        useAddItemForm(mockOnAdd, mockOnComplete, mockOnOpenChange)
      );

      act(() => {
        result.current.setName("Test");
      });

      await act(async () => {
        await result.current.handleSubmit();
      });

      expect(toast.error).toHaveBeenCalledWith("Failed to create item");
    });

    it("does not submit when already loading", async () => {
      let resolveOnAdd!: (value: unknown) => void;
      mockOnAdd.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveOnAdd = resolve;
          })
      );

      const { result } = renderHook(() =>
        useAddItemForm(mockOnAdd, mockOnComplete, mockOnOpenChange)
      );

      act(() => {
        result.current.setName("Test");
      });

      let firstSubmit: Promise<void>;
      act(() => {
        firstSubmit = result.current.handleSubmit();
      });

      // Second submit while first is in progress
      await act(async () => {
        await result.current.handleSubmit();
      });

      // Only one call to onAdd
      expect(mockOnAdd).toHaveBeenCalledTimes(1);

      await act(async () => {
        resolveOnAdd({ itemId: "id-1" });
        await firstSubmit!;
      });
    });
  });

  describe("handleSubmit with files", () => {
    it("uploads files when hasDriveConnection is true", async () => {
      mockedCreateUploadSessions.mockResolvedValueOnce({
        success: true,
        sessions: [],
      });

      const { result } = renderHook(() =>
        useAddItemForm(
          mockOnAdd,
          mockOnComplete,
          mockOnOpenChange,
          true // hasDriveConnection
        )
      );

      const mediaFile = createMockQueuedFile("video.mp4", "video/mp4", "MEDIA");

      act(() => {
        result.current.setName("Test Item");
        result.current.updateCategory("media")([mediaFile]);
      });

      await act(async () => {
        await result.current.handleSubmit();
      });

      expect(mockOnAdd).toHaveBeenCalledWith("Test Item", undefined, undefined);
      expect(mockedCreateUploadSessions).toHaveBeenCalled();
    });

    it("skips upload when hasDriveConnection is false", async () => {
      const { result } = renderHook(() =>
        useAddItemForm(
          mockOnAdd,
          mockOnComplete,
          mockOnOpenChange,
          false // hasDriveConnection
        )
      );

      const mediaFile = createMockQueuedFile("video.mp4", "video/mp4", "MEDIA");

      act(() => {
        result.current.setName("Test Item");
        result.current.updateCategory("media")([mediaFile]);
      });

      await act(async () => {
        await result.current.handleSubmit();
      });

      expect(mockOnAdd).toHaveBeenCalled();
      expect(mockedCreateUploadSessions).not.toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith('Created "Test Item"');
    });
  });

  describe("upload state", () => {
    it("isUploading is false initially", () => {
      const { result } = renderHook(() =>
        useAddItemForm(mockOnAdd, mockOnComplete, mockOnOpenChange)
      );

      expect(result.current.isUploading).toBe(false);
    });

    it("hasUploadError is false initially", () => {
      const { result } = renderHook(() =>
        useAddItemForm(mockOnAdd, mockOnComplete, mockOnOpenChange)
      );

      expect(result.current.hasUploadError).toBe(false);
    });

    it("uploadProgress is null initially", () => {
      const { result } = renderHook(() =>
        useAddItemForm(mockOnAdd, mockOnComplete, mockOnOpenChange)
      );

      expect(result.current.uploadProgress).toBeNull();
    });

    it("failedFiles is empty initially", () => {
      const { result } = renderHook(() =>
        useAddItemForm(mockOnAdd, mockOnComplete, mockOnOpenChange)
      );

      expect(result.current.failedFiles).toEqual([]);
    });

    it("createdItemId is null initially", () => {
      const { result } = renderHook(() =>
        useAddItemForm(mockOnAdd, mockOnComplete, mockOnOpenChange)
      );

      expect(result.current.createdItemId).toBeNull();
    });
  });

  describe("startUpload error handling", () => {
    it("sets error state when createUploadSessions fails", async () => {
      mockedCreateUploadSessions.mockResolvedValueOnce({
        success: false,
        error: "Connection expired",
      });

      const { result } = renderHook(() =>
        useAddItemForm(mockOnAdd, mockOnComplete, mockOnOpenChange, true)
      );

      const files = [createMockQueuedFile("test.mp4", "video/mp4", "MEDIA")];

      await act(async () => {
        await result.current.startUpload("item-1", files);
      });

      expect(result.current.hasUploadError).toBe(true);
      expect(result.current.failedFiles).toHaveLength(1);
    });
  });

  describe("handleRetryUpload", () => {
    it("does nothing when no failed files and no created item id", async () => {
      const { result } = renderHook(() =>
        useAddItemForm(mockOnAdd, mockOnComplete, mockOnOpenChange, true)
      );

      await act(async () => {
        await result.current.handleRetryUpload();
      });

      // startUpload is never called so no side effects
      expect(result.current.failedFiles).toEqual([]);
    });
  });

  describe("handleDismissUpload", () => {
    it("clears upload state and closes dialog", async () => {
      const { result } = renderHook(() =>
        useAddItemForm(mockOnAdd, mockOnComplete, mockOnOpenChange)
      );

      await act(async () => {
        await result.current.handleDismissUpload();
      });

      expect(result.current.uploadState).toBeNull();
      expect(result.current.failedFiles).toEqual([]);
      expect(toast.success).toHaveBeenCalled();
      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });
  });

  describe("displayTitle", () => {
    it("shows title with year when pending result has year", async () => {
      const { result } = renderHook(() =>
        useAddItemForm(mockOnAdd, mockOnComplete, mockOnOpenChange)
      );

      await act(async () => {
        await result.current.handleMediaSelect({
          id: 1396,
          mediaType: "tv",
          title: "Breaking Bad",
          overview: "Test",
          posterPath: null,
          backdropPath: null,
          year: "2008",
        });
      });

      expect(result.current.displayTitle).toBe("Breaking Bad (2008)");
    });

    it("shows title without year when pending result has empty year", async () => {
      const { result } = renderHook(() =>
        useAddItemForm(mockOnAdd, mockOnComplete, mockOnOpenChange)
      );

      await act(async () => {
        await result.current.handleMediaSelect({
          id: 1396,
          mediaType: "tv",
          title: "Some Show",
          overview: "Test",
          posterPath: null,
          backdropPath: null,
          year: "",
        });
      });

      expect(result.current.displayTitle).toBe("Some Show");
    });
  });

  describe("currentValues", () => {
    it("returns (new item) as default name", () => {
      const { result } = renderHook(() =>
        useAddItemForm(mockOnAdd, mockOnComplete, mockOnOpenChange)
      );

      expect(result.current.currentValues).toEqual({
        name: "(new item)",
        description: null,
      });
    });

    it("returns current name and description", () => {
      const { result } = renderHook(() =>
        useAddItemForm(mockOnAdd, mockOnComplete, mockOnOpenChange)
      );

      act(() => {
        result.current.setName("My Item");
        result.current.setDescription("A description");
      });

      expect(result.current.currentValues).toEqual({
        name: "My Item",
        description: "A description",
      });
    });
  });

  describe("showArtworkSection for content types", () => {
    it("is false for episode content type", async () => {
      const { result } = renderHook(() =>
        useAddItemForm(mockOnAdd, mockOnComplete, mockOnOpenChange)
      );

      await act(async () => {
        await result.current.fetchPreviewAndOpenWizard(1396, "tv", {
          type: "episode",
          seasonNumber: 1,
          episodeNumber: 1,
        });
      });

      expect(result.current.showArtworkSection).toBe(false);
    });

    it("is true for season content type", async () => {
      const { result } = renderHook(() =>
        useAddItemForm(mockOnAdd, mockOnComplete, mockOnOpenChange)
      );

      await act(async () => {
        await result.current.fetchPreviewAndOpenWizard(1396, "tv", {
          type: "season",
          seasonNumber: 1,
        });
      });

      expect(result.current.showArtworkSection).toBe(true);
    });

    it("is true for show content type", async () => {
      const { result } = renderHook(() =>
        useAddItemForm(mockOnAdd, mockOnComplete, mockOnOpenChange)
      );

      await act(async () => {
        await result.current.fetchPreviewAndOpenWizard(1396, "tv");
      });

      expect(result.current.showArtworkSection).toBe(true);
    });
  });

  describe("file queue prepareFilesForUpload via handleSubmit", () => {
    it("marks first media file as primary", async () => {
      mockedCreateUploadSessions.mockResolvedValueOnce({
        success: true,
        sessions: [],
      });

      const { result } = renderHook(() =>
        useAddItemForm(mockOnAdd, mockOnComplete, mockOnOpenChange, true)
      );

      const mediaFile1 = createMockQueuedFile(
        "video1.mp4",
        "video/mp4",
        "MEDIA"
      );
      const mediaFile2 = createMockQueuedFile(
        "video2.mp4",
        "video/mp4",
        "MEDIA"
      );

      act(() => {
        result.current.setName("Test");
        result.current.updateCategory("media")([mediaFile1, mediaFile2]);
      });

      await act(async () => {
        await result.current.handleSubmit();
      });

      // mockedCreateUploadSessions is called with file metadata
      const callArgs = mockedCreateUploadSessions.mock.calls[0];
      const fileMetadata = callArgs[1] as unknown as Record<string, unknown>[];

      // First media file should be primary
      expect(fileMetadata[0].isPrimary).toBe(true);
      // Second media file should not be primary
      expect(fileMetadata[1].isPrimary).toBe(false);
    });

    it("marks first hero file as isHero", async () => {
      mockedCreateUploadSessions.mockResolvedValueOnce({
        success: true,
        sessions: [],
      });

      const { result } = renderHook(() =>
        useAddItemForm(mockOnAdd, mockOnComplete, mockOnOpenChange, true)
      );

      const heroFile = createMockQueuedFile(
        "hero.jpg",
        "image/jpeg",
        "ARTWORK"
      );

      act(() => {
        result.current.setName("Test");
        result.current.updateCategory("hero")([heroFile]);
      });

      await act(async () => {
        await result.current.handleSubmit();
      });

      const callArgs = mockedCreateUploadSessions.mock.calls[0];
      const fileMetadata = callArgs[1] as unknown as Record<string, unknown>[];
      expect(fileMetadata[0].isHero).toBe(true);
    });
  });

  describe("wizard context and selectedSeasonNumber", () => {
    it("selectedSeasonNumber is null for movies", async () => {
      const { result } = renderHook(() =>
        useAddItemForm(mockOnAdd, mockOnComplete, mockOnOpenChange)
      );

      await act(async () => {
        await result.current.fetchPreviewAndOpenWizard(550, "movie");
      });

      expect(result.current.selectedSeasonNumber).toBeNull();
    });

    it("selectedSeasonNumber is set for episodes", async () => {
      const { result } = renderHook(() =>
        useAddItemForm(mockOnAdd, mockOnComplete, mockOnOpenChange)
      );

      await act(async () => {
        await result.current.fetchPreviewAndOpenWizard(1396, "tv", {
          type: "episode",
          seasonNumber: 3,
          episodeNumber: 5,
        });
      });

      expect(result.current.selectedSeasonNumber).toBe(3);
    });

    it("selectedSeasonNumber is set for seasons", async () => {
      const { result } = renderHook(() =>
        useAddItemForm(mockOnAdd, mockOnComplete, mockOnOpenChange)
      );

      await act(async () => {
        await result.current.fetchPreviewAndOpenWizard(1396, "tv", {
          type: "season",
          seasonNumber: 2,
        });
      });

      expect(result.current.selectedSeasonNumber).toBe(2);
    });
  });

  describe("temp artwork skip setters", () => {
    it("setTempPosterSkipped updates temp poster skip state", () => {
      const { result } = renderHook(() =>
        useAddItemForm(mockOnAdd, mockOnComplete, mockOnOpenChange)
      );

      act(() => {
        result.current.setTempPosterSkipped(true);
      });

      expect(result.current.tempPosterSkipped).toBe(true);

      act(() => {
        result.current.setTempPosterSkipped(false);
      });

      expect(result.current.tempPosterSkipped).toBe(false);
    });

    it("setTempBackdropSkipped updates temp backdrop skip state", () => {
      const { result } = renderHook(() =>
        useAddItemForm(mockOnAdd, mockOnComplete, mockOnOpenChange)
      );

      act(() => {
        result.current.setTempBackdropSkipped(true);
      });

      expect(result.current.tempBackdropSkipped).toBe(true);

      act(() => {
        result.current.setTempBackdropSkipped(false);
      });

      expect(result.current.tempBackdropSkipped).toBe(false);
    });
  });

  describe("re-exported utilities", () => {
    it("exports getPosterUrl", () => {
      const { result } = renderHook(() =>
        useAddItemForm(mockOnAdd, mockOnComplete, mockOnOpenChange)
      );

      expect(result.current.getPosterUrl).toBeDefined();
      expect(result.current.getPosterUrl("/test.jpg")).toBe(
        "https://image.tmdb.org/t/p/w500/test.jpg"
      );
    });

    it("exports getBackdropUrl", () => {
      const { result } = renderHook(() =>
        useAddItemForm(mockOnAdd, mockOnComplete, mockOnOpenChange)
      );

      expect(result.current.getBackdropUrl).toBeDefined();
      expect(result.current.getBackdropUrl("/bg.jpg")).toBe(
        "https://image.tmdb.org/t/p/original/bg.jpg"
      );
    });

    it("exports formatBytes", () => {
      const { result } = renderHook(() =>
        useAddItemForm(mockOnAdd, mockOnComplete, mockOnOpenChange)
      );

      expect(result.current.formatBytes).toBeDefined();
    });
  });
});
