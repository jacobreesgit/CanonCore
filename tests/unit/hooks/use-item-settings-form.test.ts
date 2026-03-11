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
import {
  updateTmdbDisplayOptions,
  applyMetadataAction,
  getMetadataPreviewAction,
  getEpisodePreviewAction,
} from "@/lib/tmdb-actions";
import { toast } from "sonner";
import type { TMDBSearchResult } from "@/lib/tmdb-client";
import type { TMDBWizardResult } from "@/components/items/wizards/tmdb-wizard/tmdb-wizard-types";
import type { TVPickerResult } from "@/components/items/wizards/tv-picker/tv-picker-types";

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
  tmdbLogoPath: null,
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

  describe("handleMediaSelect", () => {
    const movieResult: TMDBSearchResult = {
      id: 123,
      mediaType: "movie",
      title: "Test Movie",
      overview: "A test movie",
      posterPath: "/poster.jpg",
      backdropPath: "/backdrop.jpg",
      year: "2024",
    };

    const tvResult: TMDBSearchResult = {
      id: 456,
      mediaType: "tv",
      title: "Test TV Show",
      overview: "A test show",
      posterPath: "/poster.jpg",
      backdropPath: "/backdrop.jpg",
      year: "2023",
    };

    it("navigates to episode-picker for TV shows", async () => {
      const { result } = renderHook(() =>
        useItemSettingsForm(mockItem, mockFiles)
      );

      await act(async () => {
        await result.current.handleMediaSelect(tvResult);
      });

      expect(result.current.currentStep).toBe("episode-picker");
      expect(result.current.pendingTmdbResult).toEqual(tvResult);
    });

    it("fetches preview and opens wizard for movies", async () => {
      const { result } = renderHook(() =>
        useItemSettingsForm(mockItem, mockFiles)
      );

      await act(async () => {
        await result.current.handleMediaSelect(movieResult);
      });

      expect(getMetadataPreviewAction).toHaveBeenCalledWith(123, "movie");
      expect(result.current.currentStep).toBe("tmdb-wizard");
      expect(result.current.pendingTmdbResult).toEqual(movieResult);
    });
  });

  describe("fetchPreviewAndOpenWizard", () => {
    const movieResult: TMDBSearchResult = {
      id: 100,
      mediaType: "movie",
      title: "Preview Movie",
      overview: "Preview",
      posterPath: null,
      backdropPath: null,
      year: "2024",
    };

    it("fetches movie preview and sets content type to movie", async () => {
      const { result } = renderHook(() =>
        useItemSettingsForm(mockItem, mockFiles)
      );

      await act(async () => {
        await result.current.handleMediaSelect(movieResult);
      });

      expect(getMetadataPreviewAction).toHaveBeenCalledWith(100, "movie");
      expect(result.current.tmdbPreview).toEqual({
        name: "Test",
        description: "Desc",
      });
      expect(result.current.contentType).toBe("movie");
      expect(result.current.currentStep).toBe("tmdb-wizard");
    });

    it("fetches TV show preview and sets content type to show", async () => {
      const tvResult: TMDBSearchResult = {
        id: 200,
        mediaType: "tv",
        title: "TV Show",
        overview: "A show",
        posterPath: null,
        backdropPath: null,
        year: "2023",
      };

      const { result } = renderHook(() =>
        useItemSettingsForm(mockItem, mockFiles)
      );

      // TV shows go through episode picker, but handleTVPickerComplete
      // delegates to fetchPreviewAndOpenWizard with a show selection
      await act(async () => {
        await result.current.handleMediaSelect(tvResult);
      });

      // Now complete via TV picker with show selection
      await act(async () => {
        await result.current.handleTVPickerComplete({
          selection: { type: "show" },
          contentType: "show",
          tmdbResult: tvResult,
          selectedSeason: null,
          selectedEpisode: null,
        });
      });

      expect(getMetadataPreviewAction).toHaveBeenCalledWith(200, "tv");
      expect(result.current.contentType).toBe("show");
      expect(result.current.currentStep).toBe("tmdb-wizard");
    });

    it("fetches episode preview when episode selection provided", async () => {
      const tvResult: TMDBSearchResult = {
        id: 300,
        mediaType: "tv",
        title: "Episode Show",
        overview: "",
        posterPath: null,
        backdropPath: null,
        year: "2022",
      };

      const { result } = renderHook(() =>
        useItemSettingsForm(mockItem, mockFiles)
      );

      await act(async () => {
        await result.current.handleMediaSelect(tvResult);
      });

      await act(async () => {
        await result.current.handleTVPickerComplete({
          selection: {
            type: "episode",
            seasonNumber: 1,
            episodeNumber: 3,
          },
          contentType: "episode",
          tmdbResult: tvResult,
          selectedSeason: null,
          selectedEpisode: null,
        });
      });

      expect(getEpisodePreviewAction).toHaveBeenCalledWith(300, 1, 3);
      expect(result.current.contentType).toBe("episode");
      expect(result.current.currentStep).toBe("tmdb-wizard");
    });

    it("handles error from getMetadataPreviewAction", async () => {
      vi.mocked(getMetadataPreviewAction).mockResolvedValueOnce({
        success: false,
        error: "Preview failed",
      });

      const movieResult: TMDBSearchResult = {
        id: 999,
        mediaType: "movie",
        title: "Failing Movie",
        overview: "",
        posterPath: null,
        backdropPath: null,
        year: "2024",
      };

      const { result } = renderHook(() =>
        useItemSettingsForm(mockItem, mockFiles)
      );

      await act(async () => {
        await result.current.handleMediaSelect(movieResult);
      });

      expect(toast.error).toHaveBeenCalledWith("Preview failed");
      expect(result.current.currentStep).toBe("main");
    });

    it("handles error from getEpisodePreviewAction", async () => {
      vi.mocked(getEpisodePreviewAction).mockResolvedValueOnce({
        success: false,
        error: "Episode preview failed",
      });

      const tvResult: TMDBSearchResult = {
        id: 400,
        mediaType: "tv",
        title: "Failing Show",
        overview: "",
        posterPath: null,
        backdropPath: null,
        year: "2021",
      };

      const { result } = renderHook(() =>
        useItemSettingsForm(mockItem, mockFiles)
      );

      await act(async () => {
        await result.current.handleMediaSelect(tvResult);
      });

      await act(async () => {
        await result.current.handleTVPickerComplete({
          selection: {
            type: "episode",
            seasonNumber: 2,
            episodeNumber: 5,
          },
          contentType: "episode",
          tmdbResult: tvResult,
          selectedSeason: null,
          selectedEpisode: null,
        });
      });

      expect(toast.error).toHaveBeenCalledWith("Episode preview failed");
      expect(result.current.currentStep).toBe("main");
    });

    it("handles getMetadataPreviewAction success with no data", async () => {
      vi.mocked(getMetadataPreviewAction).mockResolvedValueOnce({
        success: true,
        data: undefined,
      } as never);

      const movieResult: TMDBSearchResult = {
        id: 888,
        mediaType: "movie",
        title: "No Data Movie",
        overview: "",
        posterPath: null,
        backdropPath: null,
        year: "2024",
      };

      const { result } = renderHook(() =>
        useItemSettingsForm(mockItem, mockFiles)
      );

      await act(async () => {
        await result.current.handleMediaSelect(movieResult);
      });

      expect(toast.error).toHaveBeenCalledWith("Could not fetch preview");
      expect(result.current.currentStep).toBe("main");
    });

    it("handles getEpisodePreviewAction success with no data", async () => {
      vi.mocked(getEpisodePreviewAction).mockResolvedValueOnce({
        success: true,
        data: undefined,
      } as never);

      const tvResult: TMDBSearchResult = {
        id: 777,
        mediaType: "tv",
        title: "No Data Show",
        overview: "",
        posterPath: null,
        backdropPath: null,
        year: "2024",
      };

      const { result } = renderHook(() =>
        useItemSettingsForm(mockItem, mockFiles)
      );

      await act(async () => {
        await result.current.handleMediaSelect(tvResult);
      });

      await act(async () => {
        await result.current.handleTVPickerComplete({
          selection: {
            type: "episode",
            seasonNumber: 1,
            episodeNumber: 1,
          },
          contentType: "episode",
          tmdbResult: tvResult,
          selectedSeason: null,
          selectedEpisode: null,
        });
      });

      expect(toast.error).toHaveBeenCalledWith(
        "Could not fetch episode preview"
      );
      expect(result.current.currentStep).toBe("main");
    });

    it("handles network exception during preview fetch", async () => {
      vi.mocked(getMetadataPreviewAction).mockRejectedValueOnce(
        new Error("Network error")
      );

      const movieResult: TMDBSearchResult = {
        id: 666,
        mediaType: "movie",
        title: "Error Movie",
        overview: "",
        posterPath: null,
        backdropPath: null,
        year: "2024",
      };

      const { result } = renderHook(() =>
        useItemSettingsForm(mockItem, mockFiles)
      );

      await act(async () => {
        await result.current.handleMediaSelect(movieResult);
      });

      expect(toast.error).toHaveBeenCalledWith(
        "Failed to fetch metadata preview"
      );
      expect(result.current.currentStep).toBe("main");
      expect(result.current.isLoadingPreview).toBe(false);
    });
  });

  describe("handleEpisodePickerCancel", () => {
    it("clears pending result, resets tvPickerLevel, goes to main", async () => {
      const tvResult: TMDBSearchResult = {
        id: 456,
        mediaType: "tv",
        title: "Test Show",
        overview: "",
        posterPath: null,
        backdropPath: null,
        year: "2023",
      };

      const { result } = renderHook(() =>
        useItemSettingsForm(mockItem, mockFiles)
      );

      // Navigate to episode picker
      await act(async () => {
        await result.current.handleMediaSelect(tvResult);
      });

      expect(result.current.currentStep).toBe("episode-picker");
      expect(result.current.pendingTmdbResult).toEqual(tvResult);

      // Cancel
      act(() => {
        result.current.handleEpisodePickerCancel();
      });

      expect(result.current.pendingTmdbResult).toBeNull();
      expect(result.current.tvPickerLevel).toBe("show");
      expect(result.current.currentStep).toBe("main");
    });
  });

  describe("handleEpisodePickerBack", () => {
    it("calls tvPickerBackRef at season level", async () => {
      const tvResult: TMDBSearchResult = {
        id: 456,
        mediaType: "tv",
        title: "Test Show",
        overview: "",
        posterPath: null,
        backdropPath: null,
        year: "2023",
      };

      const { result } = renderHook(() =>
        useItemSettingsForm(mockItem, mockFiles)
      );

      await act(async () => {
        await result.current.handleMediaSelect(tvResult);
      });

      // Set to season level and provide a back ref
      const backFn = vi.fn();
      act(() => {
        result.current.setTvPickerLevel("season");
        result.current.tvPickerBackRef.current = backFn;
      });

      act(() => {
        result.current.handleEpisodePickerBack();
      });

      expect(backFn).toHaveBeenCalled();
      // Should NOT have gone to main
      expect(result.current.currentStep).toBe("episode-picker");
    });

    it("cancels at show level", async () => {
      const tvResult: TMDBSearchResult = {
        id: 456,
        mediaType: "tv",
        title: "Test Show",
        overview: "",
        posterPath: null,
        backdropPath: null,
        year: "2023",
      };

      const { result } = renderHook(() =>
        useItemSettingsForm(mockItem, mockFiles)
      );

      await act(async () => {
        await result.current.handleMediaSelect(tvResult);
      });

      // tvPickerLevel defaults to "show"
      expect(result.current.tvPickerLevel).toBe("show");

      act(() => {
        result.current.handleEpisodePickerBack();
      });

      expect(result.current.pendingTmdbResult).toBeNull();
      expect(result.current.currentStep).toBe("main");
    });
  });

  describe("handleTVPickerComplete", () => {
    it("delegates to fetchPreviewAndOpenWizard with show selection", async () => {
      const tvResult: TMDBSearchResult = {
        id: 500,
        mediaType: "tv",
        title: "Complete Show",
        overview: "",
        posterPath: null,
        backdropPath: null,
        year: "2024",
      };

      const pickerResult: TVPickerResult = {
        selection: { type: "show" },
        contentType: "show",
        tmdbResult: tvResult,
        selectedSeason: null,
        selectedEpisode: null,
      };

      const { result } = renderHook(() =>
        useItemSettingsForm(mockItem, mockFiles)
      );

      await act(async () => {
        await result.current.handleTVPickerComplete(pickerResult);
      });

      expect(getMetadataPreviewAction).toHaveBeenCalledWith(500, "tv");
      expect(result.current.contentType).toBe("show");
      expect(result.current.currentStep).toBe("tmdb-wizard");
    });

    it("delegates to fetchPreviewAndOpenWizard with season selection", async () => {
      const tvResult: TMDBSearchResult = {
        id: 501,
        mediaType: "tv",
        title: "Season Show",
        overview: "",
        posterPath: null,
        backdropPath: null,
        year: "2024",
      };

      const pickerResult: TVPickerResult = {
        selection: { type: "season", seasonNumber: 2 },
        contentType: "season",
        tmdbResult: tvResult,
        selectedSeason: {
          id: 10,
          season_number: 2,
          name: "Season 2",
          overview: "",
          poster_path: null,
          episode_count: 10,
          air_date: null,
        },
        selectedEpisode: null,
      };

      const { result } = renderHook(() =>
        useItemSettingsForm(mockItem, mockFiles)
      );

      await act(async () => {
        await result.current.handleTVPickerComplete(pickerResult);
      });

      // Season selection goes through the movie/show path (not episode)
      expect(getMetadataPreviewAction).toHaveBeenCalledWith(501, "tv");
      expect(result.current.contentType).toBe("show");
      expect(result.current.currentStep).toBe("tmdb-wizard");
    });
  });

  describe("handleTMDBWizardComplete", () => {
    const wizardResult: TMDBWizardResult = {
      tmdbResult: {
        id: 123,
        mediaType: "movie",
        title: "Wizard Movie",
        overview: "",
        posterPath: "/poster.jpg",
        backdropPath: "/backdrop.jpg",
        year: "2024",
      },
      textOptions: {
        updateName: true,
        updateDescription: true,
      },
      preview: {
        name: "Wizard Movie",
        description: "Description",
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
    };

    it("calls applyMetadataAction and shows success toast", async () => {
      const onSettingsChange = vi.fn().mockResolvedValue(undefined);
      const { result } = renderHook(() =>
        useItemSettingsForm(mockItem, mockFiles, onSettingsChange)
      );

      await act(async () => {
        await result.current.handleTMDBWizardComplete(wizardResult);
      });

      expect(applyMetadataAction).toHaveBeenCalledWith(
        "item-1",
        123,
        "movie",
        {
          updateName: true,
          updateDescription: true,
          updatePoster: true,
          updateBackdrop: true,
        },
        wizardResult.displayOptions
      );
      expect(toast.success).toHaveBeenCalledWith(
        "Metadata applied successfully"
      );
      expect(onSettingsChange).toHaveBeenCalled();
    });

    it("resets state after completion", async () => {
      const { result } = renderHook(() =>
        useItemSettingsForm(mockItem, mockFiles)
      );

      // Set up some TMDB state first
      await act(async () => {
        await result.current.handleMediaSelect({
          id: 123,
          mediaType: "movie",
          title: "Test",
          overview: "",
          posterPath: null,
          backdropPath: null,
          year: "2024",
        });
      });

      await act(async () => {
        await result.current.handleTMDBWizardComplete(wizardResult);
      });

      expect(result.current.pendingTmdbResult).toBeNull();
      expect(result.current.tmdbPreview).toBeNull();
      expect(result.current.contentType).toBe("movie");
      expect(result.current.currentStep).toBe("main");
      expect(result.current.isApplyingMetadata).toBe(false);
    });

    it("shows error toast on applyMetadataAction failure", async () => {
      vi.mocked(applyMetadataAction).mockResolvedValueOnce({
        success: false,
        error: "Apply failed",
      });

      const { result } = renderHook(() =>
        useItemSettingsForm(mockItem, mockFiles)
      );

      await act(async () => {
        await result.current.handleTMDBWizardComplete(wizardResult);
      });

      expect(toast.error).toHaveBeenCalledWith("Apply failed");
      expect(result.current.currentStep).toBe("main");
    });

    it("shows fallback error toast when applyMetadataAction fails without error message", async () => {
      vi.mocked(applyMetadataAction).mockResolvedValueOnce({
        success: false,
        error: "",
      });

      const { result } = renderHook(() =>
        useItemSettingsForm(mockItem, mockFiles)
      );

      await act(async () => {
        await result.current.handleTMDBWizardComplete(wizardResult);
      });

      expect(toast.error).toHaveBeenCalledWith("Failed to apply metadata");
    });

    it("shows error toast on network exception", async () => {
      vi.mocked(applyMetadataAction).mockRejectedValueOnce(
        new Error("Network error")
      );

      const { result } = renderHook(() =>
        useItemSettingsForm(mockItem, mockFiles)
      );

      await act(async () => {
        await result.current.handleTMDBWizardComplete(wizardResult);
      });

      expect(toast.error).toHaveBeenCalledWith("Failed to apply metadata");
      expect(result.current.isApplyingMetadata).toBe(false);
      expect(result.current.currentStep).toBe("main");
    });

    it("correctly computes updatePoster and updateBackdrop flags", async () => {
      const resultWithSkippedArtwork: TMDBWizardResult = {
        ...wizardResult,
        poster: null,
        backdrop: { value: null, source: null },
      };

      const { result } = renderHook(() =>
        useItemSettingsForm(mockItem, mockFiles)
      );

      await act(async () => {
        await result.current.handleTMDBWizardComplete(resultWithSkippedArtwork);
      });

      expect(applyMetadataAction).toHaveBeenCalledWith(
        "item-1",
        123,
        "movie",
        {
          updateName: true,
          updateDescription: true,
          updatePoster: false,
          updateBackdrop: false,
        },
        resultWithSkippedArtwork.displayOptions
      );
    });
  });

  describe("handleWizardCancel", () => {
    it("clears pending result, preview, resets contentType and step", async () => {
      const movieResult: TMDBSearchResult = {
        id: 123,
        mediaType: "movie",
        title: "Test Movie",
        overview: "",
        posterPath: null,
        backdropPath: null,
        year: "2024",
      };

      const { result } = renderHook(() =>
        useItemSettingsForm(mockItem, mockFiles)
      );

      // Navigate to wizard first
      await act(async () => {
        await result.current.handleMediaSelect(movieResult);
      });

      expect(result.current.currentStep).toBe("tmdb-wizard");
      expect(result.current.pendingTmdbResult).not.toBeNull();

      // Cancel
      act(() => {
        result.current.handleWizardCancel();
      });

      expect(result.current.pendingTmdbResult).toBeNull();
      expect(result.current.tmdbPreview).toBeNull();
      expect(result.current.contentType).toBe("movie");
      expect(result.current.currentStep).toBe("main");
    });
  });

  describe("save with upload count", () => {
    it("shows different toast message when uploadCount > 0 (singular)", async () => {
      const { result } = renderHook(() =>
        useItemSettingsForm(mockItem, mockFiles)
      );

      await act(async () => {
        await result.current.handleUploadComplete(1);
      });

      act(() => {
        result.current.setName("New Name");
      });

      await act(async () => {
        await result.current.save();
      });

      expect(toast.success).toHaveBeenCalledWith(
        "Settings saved. 1 file uploaded."
      );
    });

    it("shows plural toast message when uploadCount > 1", async () => {
      const { result } = renderHook(() =>
        useItemSettingsForm(mockItem, mockFiles)
      );

      await act(async () => {
        await result.current.handleUploadComplete(3);
      });

      act(() => {
        result.current.setName("New Name");
      });

      await act(async () => {
        await result.current.save();
      });

      expect(toast.success).toHaveBeenCalledWith(
        "Settings saved. 3 files uploaded."
      );
    });
  });

  describe("save with description changes", () => {
    it("includes description in changes", async () => {
      const { result } = renderHook(() =>
        useItemSettingsForm(mockItem, mockFiles)
      );

      act(() => {
        result.current.setDescription("Updated description");
      });

      await act(async () => {
        await result.current.save();
      });

      expect(updateItemSettings).toHaveBeenCalledWith("item-1", {
        description: "Updated description",
      });
    });
  });

  describe("save with file selection changes", () => {
    it("includes primaryMediaId in changes", async () => {
      const { result } = renderHook(() =>
        useItemSettingsForm(mockItem, mockFiles)
      );

      act(() => {
        result.current.setPrimaryMediaId("new-media-id");
      });

      await act(async () => {
        await result.current.save();
      });

      expect(updateItemSettings).toHaveBeenCalledWith("item-1", {
        primaryMediaId: "new-media-id",
      });
    });

    it("includes primaryArtworkId in changes", async () => {
      const { result } = renderHook(() =>
        useItemSettingsForm(mockItem, mockFiles)
      );

      act(() => {
        result.current.setPrimaryArtworkId("new-artwork-id");
      });

      await act(async () => {
        await result.current.save();
      });

      expect(updateItemSettings).toHaveBeenCalledWith("item-1", {
        primaryArtworkId: "new-artwork-id",
      });
    });

    it("includes heroArtworkId in changes", async () => {
      const { result } = renderHook(() =>
        useItemSettingsForm(mockItem, mockFiles)
      );

      act(() => {
        result.current.setHeroArtworkId("new-hero-id");
      });

      await act(async () => {
        await result.current.save();
      });

      expect(updateItemSettings).toHaveBeenCalledWith("item-1", {
        heroArtworkId: "new-hero-id",
      });
    });

    it("includes logoArtworkId in changes", async () => {
      const { result } = renderHook(() =>
        useItemSettingsForm(mockItem, mockFiles)
      );

      act(() => {
        result.current.setLogoArtworkId("new-logo-id");
      });

      await act(async () => {
        await result.current.save();
      });

      expect(updateItemSettings).toHaveBeenCalledWith("item-1", {
        logoArtworkId: "new-logo-id",
      });
    });

    it("includes primarySubtitleId in changes", async () => {
      const { result } = renderHook(() =>
        useItemSettingsForm(mockItem, mockFiles)
      );

      act(() => {
        result.current.setPrimarySubtitleId("new-subtitle-id");
      });

      await act(async () => {
        await result.current.save();
      });

      expect(updateItemSettings).toHaveBeenCalledWith("item-1", {
        primarySubtitleId: "new-subtitle-id",
      });
    });

    it("includes multiple file selections in changes", async () => {
      const { result } = renderHook(() =>
        useItemSettingsForm(mockItem, mockFiles)
      );

      act(() => {
        result.current.setPrimaryMediaId("media-1");
        result.current.setPrimaryArtworkId("artwork-1");
        result.current.setHeroArtworkId("hero-1");
      });

      await act(async () => {
        await result.current.save();
      });

      expect(updateItemSettings).toHaveBeenCalledWith("item-1", {
        primaryMediaId: "media-1",
        primaryArtworkId: "artwork-1",
        heroArtworkId: "hero-1",
      });
    });
  });

  describe("save with parallel display options", () => {
    it("saves both field changes and display option changes in parallel", async () => {
      const { result } = renderHook(() =>
        useItemSettingsForm(mockItem, mockFiles)
      );

      act(() => {
        result.current.setName("New Name");
        result.current.handleDisplayOptionsChange({
          showTagline: false,
          showMetadata: true,
          showGenres: true,
          showCast: false,
          showProviders: true,
          showVideos: true,
          showRecommendations: true,
        });
      });

      await act(async () => {
        await result.current.save();
      });

      expect(updateItemSettings).toHaveBeenCalledWith("item-1", {
        name: "New Name",
      });
      expect(updateTmdbDisplayOptions).toHaveBeenCalledWith("item-1", {
        showTagline: false,
        showMetadata: true,
        showGenres: true,
        showCast: false,
        showProviders: true,
        showVideos: true,
        showRecommendations: true,
      });
    });

    it("shows error when display options save fails", async () => {
      vi.mocked(updateTmdbDisplayOptions).mockResolvedValueOnce({
        success: false,
        error: "Display options failed",
      });

      const { result } = renderHook(() =>
        useItemSettingsForm(mockItem, mockFiles)
      );

      act(() => {
        result.current.handleDisplayOptionsChange({
          ...result.current.displayOptions,
          showCast: false,
        });
      });

      await act(async () => {
        await result.current.save();
      });

      expect(toast.error).toHaveBeenCalledWith("Display options failed");
    });

    it("shows fallback error when both fail without error messages", async () => {
      vi.mocked(updateItemSettings).mockResolvedValueOnce({
        success: false,
        error: undefined,
      } as never);
      vi.mocked(updateTmdbDisplayOptions).mockResolvedValueOnce({
        success: false,
        error: undefined,
      } as never);

      const { result } = renderHook(() =>
        useItemSettingsForm(mockItem, mockFiles)
      );

      act(() => {
        result.current.setName("New Name");
        result.current.handleDisplayOptionsChange({
          ...result.current.displayOptions,
          showCast: false,
        });
      });

      await act(async () => {
        await result.current.save();
      });

      expect(toast.error).toHaveBeenCalledWith("Failed to save settings");
    });
  });

  describe("save exception handling", () => {
    it("shows error toast and resets isSaving on network exception", async () => {
      vi.mocked(updateItemSettings).mockRejectedValueOnce(
        new Error("Network failure")
      );

      const { result } = renderHook(() =>
        useItemSettingsForm(mockItem, mockFiles)
      );

      act(() => {
        result.current.setName("New Name");
      });

      await act(async () => {
        await result.current.save();
      });

      expect(toast.error).toHaveBeenCalledWith("Failed to save settings");
      expect(result.current.isSaving).toBe(false);
    });
  });

  describe("handleUploadComplete", () => {
    it("increments upload count", async () => {
      const { result } = renderHook(() =>
        useItemSettingsForm(mockItem, mockFiles)
      );

      expect(result.current.uploadCount).toBe(0);

      await act(async () => {
        await result.current.handleUploadComplete(2);
      });

      expect(result.current.uploadCount).toBe(2);

      await act(async () => {
        await result.current.handleUploadComplete(3);
      });

      expect(result.current.uploadCount).toBe(5);
    });

    it("calls onSettingsChange", async () => {
      const onSettingsChange = vi.fn().mockResolvedValue(undefined);
      const { result } = renderHook(() =>
        useItemSettingsForm(mockItem, mockFiles, onSettingsChange)
      );

      await act(async () => {
        await result.current.handleUploadComplete(1);
      });

      expect(onSettingsChange).toHaveBeenCalled();
    });
  });

  describe("handleFileDeleted", () => {
    it("calls onSettingsChange", async () => {
      const onSettingsChange = vi.fn().mockResolvedValue(undefined);
      const { result } = renderHook(() =>
        useItemSettingsForm(mockItem, mockFiles, onSettingsChange)
      );

      await act(async () => {
        await result.current.handleFileDeleted();
      });

      expect(onSettingsChange).toHaveBeenCalled();
    });

    it("does not throw when onSettingsChange is not provided", async () => {
      const { result } = renderHook(() =>
        useItemSettingsForm(mockItem, mockFiles)
      );

      await expect(
        act(async () => {
          await result.current.handleFileDeleted();
        })
      ).resolves.not.toThrow();
    });
  });

  describe("displayTitle", () => {
    it("shows title with year when available", async () => {
      const movieResult: TMDBSearchResult = {
        id: 123,
        mediaType: "movie",
        title: "Test Movie",
        overview: "",
        posterPath: null,
        backdropPath: null,
        year: "2024",
      };

      const { result } = renderHook(() =>
        useItemSettingsForm(mockItem, mockFiles)
      );

      await act(async () => {
        await result.current.handleMediaSelect(movieResult);
      });

      expect(result.current.displayTitle).toBe("Test Movie (2024)");
    });

    it("shows title only when no year", async () => {
      const movieResult: TMDBSearchResult = {
        id: 124,
        mediaType: "movie",
        title: "No Year Movie",
        overview: "",
        posterPath: null,
        backdropPath: null,
        year: "",
      };

      const { result } = renderHook(() =>
        useItemSettingsForm(mockItem, mockFiles)
      );

      await act(async () => {
        await result.current.handleMediaSelect(movieResult);
      });

      expect(result.current.displayTitle).toBe("No Year Movie");
    });

    it("is empty when no pending result", () => {
      const { result } = renderHook(() =>
        useItemSettingsForm(mockItem, mockFiles)
      );

      expect(result.current.displayTitle).toBe("");
    });
  });

  describe("currentValues", () => {
    it("reflects item name and description", () => {
      const { result } = renderHook(() =>
        useItemSettingsForm(mockItem, mockFiles)
      );

      expect(result.current.currentValues).toEqual({
        name: "Test Item",
        description: "Original description",
      });
    });

    it("reflects null description from item", () => {
      const itemWithNoDesc = { ...mockItem, description: null };
      const { result } = renderHook(() =>
        useItemSettingsForm(itemWithNoDesc, mockFiles)
      );

      expect(result.current.currentValues).toEqual({
        name: "Test Item",
        description: null,
      });
    });
  });

  describe("save calls onSettingsChange on success", () => {
    it("calls onSettingsChange after successful save", async () => {
      const onSettingsChange = vi.fn().mockResolvedValue(undefined);
      const { result } = renderHook(() =>
        useItemSettingsForm(mockItem, mockFiles, onSettingsChange)
      );

      act(() => {
        result.current.setName("New Name");
      });

      await act(async () => {
        await result.current.save();
      });

      expect(onSettingsChange).toHaveBeenCalled();
    });
  });

  describe("save with only display options dirty", () => {
    it("does not call updateItemSettings when only display options changed", async () => {
      const { result } = renderHook(() =>
        useItemSettingsForm(mockItem, mockFiles)
      );

      act(() => {
        result.current.handleDisplayOptionsChange({
          ...result.current.displayOptions,
          showVideos: false,
        });
      });

      await act(async () => {
        await result.current.save();
      });

      expect(updateItemSettings).not.toHaveBeenCalled();
      expect(updateTmdbDisplayOptions).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith("Settings saved");
    });
  });

  describe("isSaving state", () => {
    it("is false initially", () => {
      const { result } = renderHook(() =>
        useItemSettingsForm(mockItem, mockFiles)
      );

      expect(result.current.isSaving).toBe(false);
    });
  });

  describe("file selection initialization", () => {
    it("initializes file IDs from files with isPrimary", () => {
      const filesWithPrimary: ItemSettingsFormFiles = {
        media: [
          {
            id: "media-1",
            isPrimary: false,
            isHero: false,
            isLogo: false,
          } as never,
          {
            id: "media-2",
            isPrimary: true,
            isHero: false,
            isLogo: false,
          } as never,
        ],
        artwork: [
          {
            id: "art-1",
            isPrimary: true,
            isHero: true,
            isLogo: false,
          } as never,
          {
            id: "art-2",
            isPrimary: false,
            isHero: false,
            isLogo: true,
          } as never,
        ],
        subtitles: [
          {
            id: "sub-1",
            isPrimary: true,
            isHero: false,
            isLogo: false,
          } as never,
        ],
      };

      const { result } = renderHook(() =>
        useItemSettingsForm(mockItem, filesWithPrimary)
      );

      expect(result.current.primaryMediaId).toBe("media-2");
      expect(result.current.primaryArtworkId).toBe("art-1");
      expect(result.current.heroArtworkId).toBe("art-1");
      expect(result.current.logoArtworkId).toBe("art-2");
      expect(result.current.primarySubtitleId).toBe("sub-1");
    });
  });
});
