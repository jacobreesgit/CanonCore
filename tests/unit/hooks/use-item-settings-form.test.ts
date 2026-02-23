/**
 * Unit tests for useItemSettingsForm hook.
 */

import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useItemSettingsForm } from "@/hooks/use-item-settings-form";
import type {
  ItemSettingsFormItem,
  ItemSettingsFormFiles,
} from "@/hooks/use-item-settings-form";
import { updateItemSettings } from "@/lib/item-file-actions";
import { updateTmdbDisplayOptions } from "@/lib/tmdb-actions";
import { toast } from "sonner";

vi.mock("@/lib/item-file-actions", () => ({
  updateItemSettings: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("@/lib/tmdb-actions", () => ({
  applyMetadataAction: vi.fn().mockResolvedValue({ success: true }),
  getMetadataPreviewAction: vi.fn().mockResolvedValue({
    success: true,
    data: { name: "Test", description: "Desc" },
  }),
  getEpisodePreviewAction: vi.fn().mockResolvedValue({
    success: true,
    data: { name: "Ep", description: "Desc" },
  }),
  updateTmdbDisplayOptions: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const mockItem: ItemSettingsFormItem = {
  id: "item-1",
  name: "Test Item",
  description: "Original description",
  isPublic: false,
  inheritVisibility: false,
  hasParent: false,
  hasChildren: false,
  tmdbId: null,
  tmdbType: null,
  tmdbPosterPath: null,
  tmdbBackdropPath: null,
  tmdbShowTagline: true,
  tmdbShowMetadata: true,
  tmdbShowGenres: true,
  tmdbShowCast: true,
  tmdbShowProviders: true,
  tmdbShowVideos: true,
  tmdbShowRecommendations: true,
};

const mockFiles: ItemSettingsFormFiles = {
  media: [],
  artwork: [],
  subtitles: [],
};

describe("useItemSettingsForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("dirty tracking", () => {
    it("starts not dirty", () => {
      const { result } = renderHook(() =>
        useItemSettingsForm(mockItem, mockFiles)
      );

      expect(result.current.isDirty).toBe(false);
    });

    it("is dirty when name changes", () => {
      const { result } = renderHook(() =>
        useItemSettingsForm(mockItem, mockFiles)
      );

      act(() => {
        result.current.setName("New");
      });

      expect(result.current.isDirty).toBe(true);
    });

    it("is not dirty when name reverts", () => {
      const { result } = renderHook(() =>
        useItemSettingsForm(mockItem, mockFiles)
      );

      act(() => {
        result.current.setName("New");
      });

      expect(result.current.isDirty).toBe(true);

      act(() => {
        result.current.setName("Test Item");
      });

      expect(result.current.isDirty).toBe(false);
    });

    it("is dirty when description changes", () => {
      const { result } = renderHook(() =>
        useItemSettingsForm(mockItem, mockFiles)
      );

      act(() => {
        result.current.setDescription("Something new");
      });

      expect(result.current.isDirty).toBe(true);
    });

    it("is dirty when file selection changes", () => {
      const { result } = renderHook(() =>
        useItemSettingsForm(mockItem, mockFiles)
      );

      act(() => {
        result.current.setPrimaryMediaId("new-media-id");
      });

      expect(result.current.isDirty).toBe(true);
    });
  });

  describe("save", () => {
    it("calls updateItemSettings with changed fields only", async () => {
      const { result } = renderHook(() =>
        useItemSettingsForm(mockItem, mockFiles)
      );

      act(() => {
        result.current.setName("New Name");
      });

      await act(async () => {
        await result.current.save();
      });

      expect(updateItemSettings).toHaveBeenCalledWith("item-1", {
        name: "New Name",
      });
    });

    it("shows success toast on save", async () => {
      const { result } = renderHook(() =>
        useItemSettingsForm(mockItem, mockFiles)
      );

      act(() => {
        result.current.setName("New Name");
      });

      await act(async () => {
        await result.current.save();
      });

      expect(toast.success).toHaveBeenCalledWith("Settings saved");
    });

    it("shows error toast on failure", async () => {
      vi.mocked(updateItemSettings).mockResolvedValueOnce({
        success: false,
        error: "Failed",
      });

      const { result } = renderHook(() =>
        useItemSettingsForm(mockItem, mockFiles)
      );

      act(() => {
        result.current.setName("New Name");
      });

      await act(async () => {
        await result.current.save();
      });

      expect(toast.error).toHaveBeenCalledWith("Failed");
    });

    it("calls onClose after successful save", async () => {
      const onClose = vi.fn();
      const { result } = renderHook(() =>
        useItemSettingsForm(mockItem, mockFiles, undefined, onClose)
      );

      act(() => {
        result.current.setName("New Name");
      });

      await act(async () => {
        await result.current.save();
      });

      expect(onClose).toHaveBeenCalled();
    });

    it("does not save when name is empty", async () => {
      const { result } = renderHook(() =>
        useItemSettingsForm(mockItem, mockFiles)
      );

      act(() => {
        result.current.setName("");
      });

      await act(async () => {
        await result.current.save();
      });

      expect(toast.error).toHaveBeenCalledWith("Name is required");
      expect(updateItemSettings).not.toHaveBeenCalled();
    });
  });

  describe("cancel", () => {
    it("reverts all fields to original values", () => {
      const { result } = renderHook(() =>
        useItemSettingsForm(mockItem, mockFiles)
      );

      act(() => {
        result.current.setName("Changed Name");
        result.current.setDescription("Changed Description");
      });

      expect(result.current.name).toBe("Changed Name");
      expect(result.current.description).toBe("Changed Description");

      act(() => {
        result.current.cancel();
      });

      expect(result.current.name).toBe("Test Item");
      expect(result.current.description).toBe("Original description");
    });

    it("calls onClose", () => {
      const onClose = vi.fn();
      const { result } = renderHook(() =>
        useItemSettingsForm(mockItem, mockFiles, undefined, onClose)
      );

      act(() => {
        result.current.cancel();
      });

      expect(onClose).toHaveBeenCalled();
    });
  });

  describe("step navigation", () => {
    it("starts at main step", () => {
      const { result } = renderHook(() =>
        useItemSettingsForm(mockItem, mockFiles)
      );

      expect(result.current.currentStep).toBe("main");
    });

    it("can set step to episode-picker", () => {
      const { result } = renderHook(() =>
        useItemSettingsForm(mockItem, mockFiles)
      );

      act(() => {
        result.current.setCurrentStep("episode-picker");
      });

      expect(result.current.currentStep).toBe("episode-picker");
    });

    it("can set step to tmdb-wizard", () => {
      const { result } = renderHook(() =>
        useItemSettingsForm(mockItem, mockFiles)
      );

      act(() => {
        result.current.setCurrentStep("tmdb-wizard");
      });

      expect(result.current.currentStep).toBe("tmdb-wizard");
    });

    it("handleOpenTmdbSearch sets step to tmdb-search", () => {
      const { result } = renderHook(() =>
        useItemSettingsForm(mockItem, mockFiles)
      );

      act(() => {
        result.current.handleOpenTmdbSearch();
      });

      expect(result.current.currentStep).toBe("tmdb-search");
    });

    it("handleTmdbSearchBack sets step to main", () => {
      const { result } = renderHook(() =>
        useItemSettingsForm(mockItem, mockFiles)
      );

      act(() => {
        result.current.handleOpenTmdbSearch();
      });
      expect(result.current.currentStep).toBe("tmdb-search");

      act(() => {
        result.current.handleTmdbSearchBack();
      });
      expect(result.current.currentStep).toBe("main");
    });
  });

  describe("TMDB display options", () => {
    it("initializes from item props", () => {
      const { result } = renderHook(() =>
        useItemSettingsForm(mockItem, mockFiles)
      );

      expect(result.current.displayOptions.showTagline).toBe(true);
      expect(result.current.displayOptions.showMetadata).toBe(true);
      expect(result.current.displayOptions.showGenres).toBe(true);
      expect(result.current.displayOptions.showCast).toBe(true);
      expect(result.current.displayOptions.showProviders).toBe(true);
      expect(result.current.displayOptions.showVideos).toBe(true);
      expect(result.current.displayOptions.showRecommendations).toBe(true);
    });

    it("is dirty when display options change", () => {
      const { result } = renderHook(() =>
        useItemSettingsForm(mockItem, mockFiles)
      );

      expect(result.current.isDirty).toBe(false);

      act(() => {
        result.current.handleDisplayOptionsChange({
          ...result.current.displayOptions,
          showCast: false,
        });
      });

      expect(result.current.isDirty).toBe(true);
    });

    it("cancel reverts display options", () => {
      const { result } = renderHook(() =>
        useItemSettingsForm(mockItem, mockFiles)
      );

      act(() => {
        result.current.handleDisplayOptionsChange({
          ...result.current.displayOptions,
          showCast: false,
        });
      });

      expect(result.current.displayOptions.showCast).toBe(false);

      act(() => {
        result.current.cancel();
      });

      expect(result.current.displayOptions.showCast).toBe(true);
    });

    it("calls updateTmdbDisplayOptions on save when options changed", async () => {
      const { result } = renderHook(() =>
        useItemSettingsForm(mockItem, mockFiles)
      );

      const newOptions = {
        showTagline: false,
        showMetadata: true,
        showGenres: true,
        showCast: true,
        showProviders: true,
        showVideos: true,
        showRecommendations: true,
      };

      act(() => {
        result.current.handleDisplayOptionsChange(newOptions);
      });

      // Not called yet — requires explicit save
      expect(updateTmdbDisplayOptions).not.toHaveBeenCalled();

      await act(async () => {
        await result.current.save();
      });

      expect(updateTmdbDisplayOptions).toHaveBeenCalledWith(
        "item-1",
        newOptions
      );
    });

    it("does not call updateTmdbDisplayOptions when options unchanged", async () => {
      const { result } = renderHook(() =>
        useItemSettingsForm(mockItem, mockFiles)
      );

      // Change name to make form dirty (so save proceeds)
      act(() => {
        result.current.setName("New Name");
      });

      await act(async () => {
        await result.current.save();
      });

      expect(updateTmdbDisplayOptions).not.toHaveBeenCalled();
    });
  });

  describe("resetForm", () => {
    it("resets step to main", () => {
      const { result } = renderHook(() =>
        useItemSettingsForm(mockItem, mockFiles)
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

    it("resets upload count to 0", async () => {
      const { result } = renderHook(() =>
        useItemSettingsForm(mockItem, mockFiles)
      );

      await act(async () => {
        await result.current.handleUploadComplete(3);
      });

      expect(result.current.uploadCount).toBe(3);

      act(() => {
        result.current.resetForm();
      });

      expect(result.current.uploadCount).toBe(0);
    });
  });
});
