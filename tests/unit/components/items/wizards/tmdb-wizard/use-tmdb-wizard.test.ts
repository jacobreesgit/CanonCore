/**
 * Unit tests for the TMDB wizard hook.
 * Tests step navigation, data management, and loading states.
 */
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTMDBWizard } from "@/components/items/wizards/tmdb-wizard/use-tmdb-wizard";
import type { TMDBWizardInitialData } from "@/components/items/wizards/tmdb-wizard";

const mockInitialData: TMDBWizardInitialData = {
  tmdbResult: {
    id: 123,
    mediaType: "movie",
    title: "Test Movie",
    overview: "A test movie description",
    posterPath: "/test-poster.jpg",
    backdropPath: "/test-backdrop.jpg",
    year: "2024",
  },
  preview: {
    name: "Test Movie (2024)",
    description: "A test movie description",
  },
};

describe("useTMDBWizard", () => {
  describe("initialization", () => {
    it("initializes with text step as first step", () => {
      const { result } = renderHook(() => useTMDBWizard(mockInitialData));

      expect(result.current.currentStep).toBe("text");
      expect(result.current.canGoBack).toBe(false);
    });

    it("initializes with provided TMDB result", () => {
      const { result } = renderHook(() => useTMDBWizard(mockInitialData));

      expect(result.current.data.tmdbResult).toEqual(
        mockInitialData.tmdbResult
      );
      expect(result.current.data.preview).toEqual(mockInitialData.preview);
    });

    it("initializes text options with both enabled by default", () => {
      const { result } = renderHook(() => useTMDBWizard(mockInitialData));

      expect(result.current.data.textOptions).toEqual({
        updateName: true,
        updateDescription: true,
      });
    });

    it("initializes artwork selections as null and not skipped", () => {
      const { result } = renderHook(() => useTMDBWizard(mockInitialData));

      expect(result.current.data.poster).toEqual({
        value: null,
        source: null,
        skipped: false,
      });
      expect(result.current.data.backdrop).toEqual({
        value: null,
        source: null,
        skipped: false,
      });
    });

    it("respects contentType='episode' from initial data", () => {
      const episodeData: TMDBWizardInitialData = {
        ...mockInitialData,
        contentType: "episode",
      };

      const { result } = renderHook(() => useTMDBWizard(episodeData));

      expect(result.current.data.contentType).toBe("episode");
    });
  });

  describe("step navigation", () => {
    it("advances from text to poster step", () => {
      const { result } = renderHook(() => useTMDBWizard(mockInitialData));

      act(() => {
        result.current.goToStep("poster");
      });

      expect(result.current.currentStep).toBe("poster");
      expect(result.current.canGoBack).toBe(true);
    });

    it("advances from poster to hero step", () => {
      const { result } = renderHook(() => useTMDBWizard(mockInitialData));

      act(() => {
        result.current.goToStep("poster");
        result.current.goToStep("hero");
      });

      expect(result.current.currentStep).toBe("hero");
    });

    it("advances from hero to summary step", () => {
      const { result } = renderHook(() => useTMDBWizard(mockInitialData));

      act(() => {
        result.current.goToStep("poster");
        result.current.goToStep("hero");
        result.current.goToStep("summary");
      });

      expect(result.current.currentStep).toBe("summary");
    });

    it("goes back to previous step", () => {
      const { result } = renderHook(() => useTMDBWizard(mockInitialData));

      act(() => {
        result.current.goToStep("poster");
        result.current.goToStep("hero");
      });

      expect(result.current.currentStep).toBe("hero");

      act(() => {
        result.current.goBack();
      });

      expect(result.current.currentStep).toBe("poster");
    });

    it("resets wizard state", () => {
      const { result } = renderHook(() => useTMDBWizard(mockInitialData));

      act(() => {
        result.current.goToStep("poster");
        result.current.setData({
          poster: { value: "/selected.jpg", source: "tmdb", skipped: false },
        });
      });

      act(() => {
        result.current.reset();
      });

      // Reset clears all data and returns to initial step
      expect(result.current.currentStep).toBe("text");
      expect(result.current.canGoBack).toBe(false);
      // Data is cleared on reset (becomes empty object)
      expect(result.current.data.poster).toBeUndefined();
    });
  });

  describe("data management", () => {
    it("updates text options", () => {
      const { result } = renderHook(() => useTMDBWizard(mockInitialData));

      act(() => {
        result.current.setTextOptions({
          updateName: false,
          updateDescription: true,
        });
      });

      expect(result.current.data.textOptions).toEqual({
        updateName: false,
        updateDescription: true,
      });
    });

    it("updates poster selection", () => {
      const { result } = renderHook(() => useTMDBWizard(mockInitialData));

      act(() => {
        result.current.setPoster("/new-poster.jpg", "tmdb");
      });

      expect(result.current.data.poster).toEqual({
        value: "/new-poster.jpg",
        source: "tmdb",
        skipped: false,
      });
    });

    it("marks poster as skipped", () => {
      const { result } = renderHook(() => useTMDBWizard(mockInitialData));

      act(() => {
        result.current.skipPoster();
      });

      expect(result.current.data.poster).toEqual({
        value: null,
        source: null,
        skipped: true,
      });
    });

    it("updates backdrop selection", () => {
      const { result } = renderHook(() => useTMDBWizard(mockInitialData));

      act(() => {
        result.current.setBackdrop("/new-backdrop.jpg", "existing");
      });

      expect(result.current.data.backdrop).toEqual({
        value: "/new-backdrop.jpg",
        source: "existing",
        skipped: false,
      });
    });

    it("marks backdrop as skipped", () => {
      const { result } = renderHook(() => useTMDBWizard(mockInitialData));

      act(() => {
        result.current.skipBackdrop();
      });

      expect(result.current.data.backdrop).toEqual({
        value: null,
        source: null,
        skipped: true,
      });
    });

    it("sets TMDB images", () => {
      const { result } = renderHook(() => useTMDBWizard(mockInitialData));

      const mockImages = {
        posters: [
          {
            file_path: "/p1.jpg",
            vote_average: 8,
            iso_639_1: null,
            width: 500,
            height: 750,
          },
        ],
        backdrops: [
          {
            file_path: "/b1.jpg",
            vote_average: 9,
            iso_639_1: null,
            width: 1920,
            height: 1080,
          },
        ],
      };

      act(() => {
        result.current.setImages(mockImages);
      });

      expect(result.current.data.images).toEqual(mockImages);
    });

    it("preserves data when navigating between steps", () => {
      const { result } = renderHook(() => useTMDBWizard(mockInitialData));

      act(() => {
        result.current.setTextOptions({
          updateName: false,
          updateDescription: true,
        });
        result.current.goToStep("poster");
        result.current.setPoster("/poster.jpg", "tmdb");
        result.current.goToStep("hero");
        result.current.goBack();
      });

      expect(result.current.currentStep).toBe("poster");
      expect(result.current.data.textOptions?.updateName).toBe(false);
      expect(result.current.data.poster?.value).toBe("/poster.jpg");
    });
  });

  describe("loading states", () => {
    it("tracks preview loading state", () => {
      const { result } = renderHook(() => useTMDBWizard(mockInitialData));

      expect(result.current.isLoadingPreview).toBe(false);

      act(() => {
        result.current.setLoadingPreview(true);
      });

      expect(result.current.isLoadingPreview).toBe(true);

      act(() => {
        result.current.setLoadingPreview(false);
      });

      expect(result.current.isLoadingPreview).toBe(false);
    });

    it("tracks images loading state", () => {
      const { result } = renderHook(() => useTMDBWizard(mockInitialData));

      expect(result.current.isLoadingImages).toBe(false);

      act(() => {
        result.current.setLoadingImages(true);
      });

      expect(result.current.isLoadingImages).toBe(true);
    });

    it("tracks apply loading state", () => {
      const { result } = renderHook(() => useTMDBWizard(mockInitialData));

      expect(result.current.isLoadingApply).toBe(false);

      act(() => {
        result.current.setLoadingApply(true);
      });

      expect(result.current.isLoadingApply).toBe(true);
    });
  });

  describe("error handling", () => {
    it("sets and clears error", () => {
      const { result } = renderHook(() => useTMDBWizard(mockInitialData));

      expect(result.current.error).toBeNull();

      act(() => {
        result.current.setError("Something went wrong");
      });

      expect(result.current.error).toBe("Something went wrong");

      act(() => {
        result.current.setError(null);
      });

      expect(result.current.error).toBeNull();
    });

    it("clears error on navigation", () => {
      const { result } = renderHook(() => useTMDBWizard(mockInitialData));

      act(() => {
        result.current.setError("An error occurred");
        result.current.goToStep("poster");
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe("getResult", () => {
    it("returns complete wizard result", () => {
      const { result } = renderHook(() => useTMDBWizard(mockInitialData));

      act(() => {
        result.current.setTextOptions({
          updateName: true,
          updateDescription: false,
        });
        result.current.setPoster("/poster.jpg", "tmdb");
        result.current.setBackdrop("/backdrop.jpg", "existing");
      });

      const wizardResult = result.current.getResult();

      expect(wizardResult).toEqual({
        tmdbResult: mockInitialData.tmdbResult,
        textOptions: { updateName: true, updateDescription: false },
        preview: mockInitialData.preview,
        contentType: "movie",
        poster: { value: "/poster.jpg", source: "tmdb" },
        backdrop: { value: "/backdrop.jpg", source: "existing" },
        still: null,
        displayOptions: {
          showTagline: true,
          showMetadata: true,
          showGenres: true,
          showCast: true,
          showProviders: true,
          showRecommendations: true,
          showVideos: true,
        },
      });
    });

    it("returns null for skipped poster", () => {
      const { result } = renderHook(() => useTMDBWizard(mockInitialData));

      act(() => {
        result.current.skipPoster();
      });

      const wizardResult = result.current.getResult();

      expect(wizardResult.poster).toBeNull();
    });

    it("returns null for skipped backdrop", () => {
      const { result } = renderHook(() => useTMDBWizard(mockInitialData));

      act(() => {
        result.current.skipBackdrop();
      });

      const wizardResult = result.current.getResult();

      expect(wizardResult.backdrop).toBeNull();
    });
  });

  describe("episode mode", () => {
    it("sets contentType to episode when specified", () => {
      const episodeData: TMDBWizardInitialData = {
        ...mockInitialData,
        contentType: "episode",
      };

      const { result } = renderHook(() => useTMDBWizard(episodeData));

      expect(result.current.data.contentType).toBe("episode");
    });
  });

  describe("content type handling", () => {
    it("derives contentType='movie' from movie media type", () => {
      const movieData: TMDBWizardInitialData = {
        ...mockInitialData,
        tmdbResult: { ...mockInitialData.tmdbResult, mediaType: "movie" },
      };

      const { result } = renderHook(() => useTMDBWizard(movieData));

      expect(result.current.data.contentType).toBe("movie");
    });

    it("derives contentType='show' from tv media type without explicit contentType", () => {
      const showData: TMDBWizardInitialData = {
        ...mockInitialData,
        tmdbResult: { ...mockInitialData.tmdbResult, mediaType: "tv" },
      };

      const { result } = renderHook(() => useTMDBWizard(showData));

      expect(result.current.data.contentType).toBe("show");
    });

    it("uses explicit contentType='season' from initialData", () => {
      const seasonData: TMDBWizardInitialData = {
        ...mockInitialData,
        tmdbResult: { ...mockInitialData.tmdbResult, mediaType: "tv" },
        contentType: "season",
      };

      const { result } = renderHook(() => useTMDBWizard(seasonData));

      expect(result.current.data.contentType).toBe("season");
    });

    it("uses explicit contentType='episode' from initialData", () => {
      const episodeData: TMDBWizardInitialData = {
        ...mockInitialData,
        tmdbResult: { ...mockInitialData.tmdbResult, mediaType: "tv" },
        contentType: "episode",
      };

      const { result } = renderHook(() => useTMDBWizard(episodeData));

      expect(result.current.data.contentType).toBe("episode");
    });

    it("returns contentType in getResult for season", () => {
      const seasonData: TMDBWizardInitialData = {
        ...mockInitialData,
        tmdbResult: { ...mockInitialData.tmdbResult, mediaType: "tv" },
        contentType: "season",
      };

      const { result } = renderHook(() => useTMDBWizard(seasonData));
      const wizardResult = result.current.getResult();

      expect(wizardResult.contentType).toBe("season");
    });
  });

  describe("season images", () => {
    it("initializes seasonImages as null", () => {
      const { result } = renderHook(() => useTMDBWizard(mockInitialData));

      expect(result.current.data.seasonImages).toBeNull();
    });

    it("stores seasonImages via setData", () => {
      const seasonData: TMDBWizardInitialData = {
        ...mockInitialData,
        tmdbResult: { ...mockInitialData.tmdbResult, mediaType: "tv" },
        contentType: "season",
      };

      const { result } = renderHook(() => useTMDBWizard(seasonData));

      const mockSeasonImages = {
        posters: [
          {
            file_path: "/season-poster.jpg",
            vote_average: 8,
            iso_639_1: null,
            width: 500,
            height: 750,
          },
        ],
      };

      act(() => {
        result.current.setData({ seasonImages: mockSeasonImages });
      });

      expect(result.current.data.seasonImages).toEqual(mockSeasonImages);
    });
  });

  describe("episode images", () => {
    it("initializes episodeImages as null", () => {
      const { result } = renderHook(() => useTMDBWizard(mockInitialData));

      expect(result.current.data.episodeImages).toBeNull();
    });

    it("stores episodeImages via setData", () => {
      const episodeData: TMDBWizardInitialData = {
        ...mockInitialData,
        tmdbResult: { ...mockInitialData.tmdbResult, mediaType: "tv" },
        contentType: "episode",
      };

      const { result } = renderHook(() => useTMDBWizard(episodeData));

      const mockEpisodeImages = {
        stills: [
          {
            file_path: "/episode-still.jpg",
            vote_average: 7,
            iso_639_1: null,
            width: 1920,
            height: 1080,
          },
        ],
      };

      act(() => {
        result.current.setData({ episodeImages: mockEpisodeImages });
      });

      expect(result.current.data.episodeImages).toEqual(mockEpisodeImages);
    });
  });

  describe("still handling for episodes", () => {
    it("updates still selection", () => {
      const episodeData: TMDBWizardInitialData = {
        ...mockInitialData,
        contentType: "episode",
      };

      const { result } = renderHook(() => useTMDBWizard(episodeData));

      act(() => {
        result.current.setStill("/episode-still.jpg", "tmdb");
      });

      expect(result.current.data.still).toEqual({
        value: "/episode-still.jpg",
        source: "tmdb",
        skipped: false,
      });
    });

    it("marks still as skipped", () => {
      const episodeData: TMDBWizardInitialData = {
        ...mockInitialData,
        contentType: "episode",
      };

      const { result } = renderHook(() => useTMDBWizard(episodeData));

      act(() => {
        result.current.skipStill();
      });

      expect(result.current.data.still).toEqual({
        value: null,
        source: null,
        skipped: true,
      });
    });

    it("returns still in getResult for episodes", () => {
      const episodeData: TMDBWizardInitialData = {
        ...mockInitialData,
        contentType: "episode",
      };

      const { result } = renderHook(() => useTMDBWizard(episodeData));

      act(() => {
        result.current.setStill("/still.jpg", "tmdb");
      });

      const wizardResult = result.current.getResult();

      expect(wizardResult.still).toEqual({
        value: "/still.jpg",
        source: "tmdb",
      });
    });

    it("returns null still when skipped", () => {
      const episodeData: TMDBWizardInitialData = {
        ...mockInitialData,
        contentType: "episode",
      };

      const { result } = renderHook(() => useTMDBWizard(episodeData));

      act(() => {
        result.current.skipStill();
      });

      const wizardResult = result.current.getResult();

      expect(wizardResult.still).toBeNull();
    });
  });
});
