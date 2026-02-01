/**
 * Unit tests for the useTVPicker hook.
 * Tests state management and navigation logic.
 */
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTVPicker } from "@/components/items/wizards/tv-picker/use-tv-picker";
import type {
  TMDBSearchResult,
  TMDBSeasonSummary,
  TMDBEpisode,
} from "@/lib/tmdb-client";

const mockTmdbResult: TMDBSearchResult = {
  id: 1396,
  mediaType: "tv",
  title: "Breaking Bad",
  overview: "A chemistry teacher diagnosed with cancer...",
  posterPath: "/poster.jpg",
  backdropPath: "/backdrop.jpg",
  year: "2008",
};

const mockSeason: TMDBSeasonSummary = {
  id: 3572,
  season_number: 1,
  name: "Season 1",
  overview: "First season",
  poster_path: "/s1.jpg",
  episode_count: 7,
  air_date: "2008-01-20",
};

const mockEpisode: TMDBEpisode = {
  id: 62085,
  episode_number: 1,
  name: "Pilot",
  overview: "First episode",
  still_path: "/ep1.jpg",
};

describe("useTVPicker", () => {
  describe("initial state", () => {
    it("starts at show level", () => {
      const { result } = renderHook(() =>
        useTVPicker({ tmdbResult: mockTmdbResult })
      );

      expect(result.current.currentLevel).toBe("show");
    });

    it("stores initial tmdbResult", () => {
      const { result } = renderHook(() =>
        useTVPicker({ tmdbResult: mockTmdbResult })
      );

      expect(result.current.data.tmdbResult).toEqual(mockTmdbResult);
    });

    it("has empty seasons initially", () => {
      const { result } = renderHook(() =>
        useTVPicker({ tmdbResult: mockTmdbResult })
      );

      expect(result.current.data.seasons).toEqual([]);
    });

    it("has no selected season initially", () => {
      const { result } = renderHook(() =>
        useTVPicker({ tmdbResult: mockTmdbResult })
      );

      expect(result.current.data.selectedSeason).toBeNull();
    });

    it("has focused season index at 0", () => {
      const { result } = renderHook(() =>
        useTVPicker({ tmdbResult: mockTmdbResult })
      );

      expect(result.current.focusedSeasonIndex).toBe(0);
    });
  });

  describe("setSeasons", () => {
    it("updates seasons list", () => {
      const { result } = renderHook(() =>
        useTVPicker({ tmdbResult: mockTmdbResult })
      );

      act(() => {
        result.current.setSeasons([mockSeason]);
      });

      expect(result.current.data.seasons).toHaveLength(1);
      expect(result.current.data.seasons[0].name).toBe("Season 1");
    });
  });

  describe("navigateToSeason", () => {
    it("changes level to season", () => {
      const { result } = renderHook(() =>
        useTVPicker({ tmdbResult: mockTmdbResult })
      );

      act(() => {
        result.current.navigateToSeason(mockSeason, 0);
      });

      expect(result.current.currentLevel).toBe("season");
    });

    it("sets selected season", () => {
      const { result } = renderHook(() =>
        useTVPicker({ tmdbResult: mockTmdbResult })
      );

      act(() => {
        result.current.navigateToSeason(mockSeason, 0);
      });

      expect(result.current.data.selectedSeason).toEqual(mockSeason);
    });

    it("stores previous focus index for restoration", () => {
      const { result } = renderHook(() =>
        useTVPicker({ tmdbResult: mockTmdbResult })
      );

      act(() => {
        result.current.setFocusedSeasonIndex(2);
      });

      act(() => {
        result.current.navigateToSeason(mockSeason, 2);
      });

      expect(result.current.data.previouslyFocusedSeasonIndex).toBe(2);
    });
  });

  describe("goBack", () => {
    it("returns to show level from season", () => {
      const { result } = renderHook(() =>
        useTVPicker({ tmdbResult: mockTmdbResult })
      );

      act(() => {
        result.current.navigateToSeason(mockSeason, 0);
      });

      expect(result.current.currentLevel).toBe("season");

      act(() => {
        result.current.goBack();
      });

      expect(result.current.currentLevel).toBe("show");
    });

    it("clears episodes when going back", () => {
      const { result } = renderHook(() =>
        useTVPicker({ tmdbResult: mockTmdbResult })
      );

      act(() => {
        result.current.navigateToSeason(mockSeason, 0);
        result.current.setEpisodes([mockEpisode]);
      });

      expect(result.current.data.episodes).toHaveLength(1);

      act(() => {
        result.current.goBack();
      });

      expect(result.current.data.episodes).toHaveLength(0);
    });

    it("restores focus index", () => {
      const { result } = renderHook(() =>
        useTVPicker({ tmdbResult: mockTmdbResult })
      );

      act(() => {
        result.current.setFocusedSeasonIndex(2);
        result.current.navigateToSeason(mockSeason, 2);
      });

      act(() => {
        result.current.goBack();
      });

      expect(result.current.focusedSeasonIndex).toBe(2);
    });
  });

  describe("setEpisodes", () => {
    it("updates episodes list", () => {
      const { result } = renderHook(() =>
        useTVPicker({ tmdbResult: mockTmdbResult })
      );

      act(() => {
        result.current.setEpisodes([mockEpisode]);
      });

      expect(result.current.data.episodes).toHaveLength(1);
      expect(result.current.data.episodes[0].name).toBe("Pilot");
    });
  });

  describe("loading states", () => {
    it("tracks season loading state", () => {
      const { result } = renderHook(() =>
        useTVPicker({ tmdbResult: mockTmdbResult })
      );

      expect(result.current.isLoadingSeasons).toBe(false);

      act(() => {
        result.current.setLoadingSeasons(true);
      });

      expect(result.current.isLoadingSeasons).toBe(true);
    });

    it("tracks episode loading state", () => {
      const { result } = renderHook(() =>
        useTVPicker({ tmdbResult: mockTmdbResult })
      );

      expect(result.current.isLoadingEpisodes).toBe(false);

      act(() => {
        result.current.setLoadingEpisodes(true);
      });

      expect(result.current.isLoadingEpisodes).toBe(true);
    });
  });

  describe("error state", () => {
    it("tracks error messages", () => {
      const { result } = renderHook(() =>
        useTVPicker({ tmdbResult: mockTmdbResult })
      );

      expect(result.current.error).toBeNull();

      act(() => {
        result.current.setError("Network error");
      });

      expect(result.current.error).toBe("Network error");
    });

    it("clears error", () => {
      const { result } = renderHook(() =>
        useTVPicker({ tmdbResult: mockTmdbResult })
      );

      act(() => {
        result.current.setError("Network error");
        result.current.setError(null);
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe("getResult", () => {
    it("returns show result for show selection", () => {
      const { result } = renderHook(() =>
        useTVPicker({ tmdbResult: mockTmdbResult })
      );

      const pickerResult = result.current.getResult({ type: "show" });

      expect(pickerResult.selection.type).toBe("show");
      expect(pickerResult.contentType).toBe("show");
      expect(pickerResult.tmdbResult).toEqual(mockTmdbResult);
      expect(pickerResult.selectedSeason).toBeNull();
      expect(pickerResult.selectedEpisode).toBeNull();
    });

    it("returns season result with selected season", () => {
      const { result } = renderHook(() =>
        useTVPicker({ tmdbResult: mockTmdbResult })
      );

      act(() => {
        result.current.navigateToSeason(mockSeason, 0);
      });

      const pickerResult = result.current.getResult({
        type: "season",
        seasonNumber: 1,
      });

      expect(pickerResult.selection.type).toBe("season");
      expect(pickerResult.contentType).toBe("season");
      expect(pickerResult.selectedSeason).toEqual(mockSeason);
      expect(pickerResult.selectedEpisode).toBeNull();
    });

    it("returns episode result with selected episode", () => {
      const { result } = renderHook(() =>
        useTVPicker({ tmdbResult: mockTmdbResult })
      );

      act(() => {
        result.current.navigateToSeason(mockSeason, 0);
        result.current.setEpisodes([mockEpisode]);
      });

      const pickerResult = result.current.getResult(
        { type: "episode", seasonNumber: 1, episodeNumber: 1 },
        mockEpisode
      );

      expect(pickerResult.selection.type).toBe("episode");
      expect(pickerResult.contentType).toBe("episode");
      expect(pickerResult.selectedSeason).toEqual(mockSeason);
      expect(pickerResult.selectedEpisode).toEqual(mockEpisode);
    });
  });

  describe("focus management", () => {
    it("updates focused season index", () => {
      const { result } = renderHook(() =>
        useTVPicker({ tmdbResult: mockTmdbResult })
      );

      act(() => {
        result.current.setFocusedSeasonIndex(3);
      });

      expect(result.current.focusedSeasonIndex).toBe(3);
    });
  });
});
