/**
 * Unit tests for the ShowView component.
 * Tests rendering, keyboard navigation (roving tabindex), and accessibility.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ShowView } from "@/components/items/wizards/tv-picker/show-view";
import type { TMDBSearchResult, TMDBSeasonSummary } from "@/lib/tmdb-client";

const mockTmdbResult: TMDBSearchResult = {
  id: 1396,
  mediaType: "tv",
  title: "Breaking Bad",
  overview: "A chemistry teacher diagnosed with cancer...",
  posterPath: "/poster.jpg",
  backdropPath: "/backdrop.jpg",
  year: "2008",
};

const mockSeasons: TMDBSeasonSummary[] = [
  {
    id: 3572,
    season_number: 1,
    name: "Season 1",
    overview: "First season",
    poster_path: "/s1.jpg",
    episode_count: 7,
    air_date: "2008-01-20",
  },
  {
    id: 3573,
    season_number: 2,
    name: "Season 2",
    overview: "Second season",
    poster_path: "/s2.jpg",
    episode_count: 13,
    air_date: "2009-03-08",
  },
  {
    id: 3574,
    season_number: 3,
    name: "Season 3",
    overview: "Third season",
    poster_path: null,
    episode_count: 13,
    air_date: "2010-03-21",
  },
];

describe("ShowView", () => {
  describe("rendering", () => {
    it("renders show title with year", () => {
      render(
        <ShowView
          data={{ tmdbResult: mockTmdbResult, seasons: mockSeasons }}
          isLoading={false}
          error={null}
          onSeasonSelect={vi.fn()}
          focusedIndex={0}
          onFocusChange={vi.fn()}
        />
      );

      expect(screen.getByText("Breaking Bad (2008)")).toBeInTheDocument();
    });

    it("renders season count and episode count", () => {
      render(
        <ShowView
          data={{ tmdbResult: mockTmdbResult, seasons: mockSeasons }}
          isLoading={false}
          error={null}
          onSeasonSelect={vi.fn()}
          focusedIndex={0}
          onFocusChange={vi.fn()}
        />
      );

      expect(screen.getByText("3 Seasons • 33 Episodes")).toBeInTheDocument();
    });

    it("renders all season items", () => {
      render(
        <ShowView
          data={{ tmdbResult: mockTmdbResult, seasons: mockSeasons }}
          isLoading={false}
          error={null}
          onSeasonSelect={vi.fn()}
          focusedIndex={0}
          onFocusChange={vi.fn()}
        />
      );

      expect(screen.getByText("Season 1")).toBeInTheDocument();
      expect(screen.getByText("Season 2")).toBeInTheDocument();
      expect(screen.getByText("Season 3")).toBeInTheDocument();
    });

    it("renders episode counts for each season", () => {
      render(
        <ShowView
          data={{ tmdbResult: mockTmdbResult, seasons: mockSeasons }}
          isLoading={false}
          error={null}
          onSeasonSelect={vi.fn()}
          focusedIndex={0}
          onFocusChange={vi.fn()}
        />
      );

      expect(screen.getByText("7 episodes")).toBeInTheDocument();
      expect(screen.getAllByText("13 episodes")).toHaveLength(2);
    });

    it("renders loading state", () => {
      render(
        <ShowView
          data={{ tmdbResult: mockTmdbResult, seasons: [] }}
          isLoading={true}
          error={null}
          onSeasonSelect={vi.fn()}
          focusedIndex={0}
          onFocusChange={vi.fn()}
        />
      );

      expect(screen.getByText("Loading seasons…")).toBeInTheDocument();
    });

    it("renders error state", () => {
      render(
        <ShowView
          data={{ tmdbResult: mockTmdbResult, seasons: [] }}
          isLoading={false}
          error="Failed to load seasons"
          onSeasonSelect={vi.fn()}
          focusedIndex={0}
          onFocusChange={vi.fn()}
        />
      );

      expect(screen.getByText("Failed to load seasons")).toBeInTheDocument();
    });

    it("renders empty state when no seasons", () => {
      render(
        <ShowView
          data={{ tmdbResult: mockTmdbResult, seasons: [] }}
          isLoading={false}
          error={null}
          onSeasonSelect={vi.fn()}
          focusedIndex={0}
          onFocusChange={vi.fn()}
        />
      );

      expect(screen.getByText("No seasons available")).toBeInTheDocument();
    });
  });

  describe("accessibility", () => {
    it("renders listbox role for season list", () => {
      render(
        <ShowView
          data={{ tmdbResult: mockTmdbResult, seasons: mockSeasons }}
          isLoading={false}
          error={null}
          onSeasonSelect={vi.fn()}
          focusedIndex={0}
          onFocusChange={vi.fn()}
        />
      );

      expect(
        screen.getByRole("listbox", { name: "Seasons" })
      ).toBeInTheDocument();
    });

    it("renders option role for each season", () => {
      render(
        <ShowView
          data={{ tmdbResult: mockTmdbResult, seasons: mockSeasons }}
          isLoading={false}
          error={null}
          onSeasonSelect={vi.fn()}
          focusedIndex={0}
          onFocusChange={vi.fn()}
        />
      );

      expect(screen.getAllByRole("option")).toHaveLength(3);
    });

    it("marks focused item as selected", () => {
      render(
        <ShowView
          data={{ tmdbResult: mockTmdbResult, seasons: mockSeasons }}
          isLoading={false}
          error={null}
          onSeasonSelect={vi.fn()}
          focusedIndex={1}
          onFocusChange={vi.fn()}
        />
      );

      const options = screen.getAllByRole("option");
      expect(options[0]).toHaveAttribute("aria-selected", "false");
      expect(options[1]).toHaveAttribute("aria-selected", "true");
      expect(options[2]).toHaveAttribute("aria-selected", "false");
    });

    it("renders accessible labels with episode counts", () => {
      render(
        <ShowView
          data={{ tmdbResult: mockTmdbResult, seasons: mockSeasons }}
          isLoading={false}
          error={null}
          onSeasonSelect={vi.fn()}
          focusedIndex={0}
          onFocusChange={vi.fn()}
        />
      );

      const buttons = screen.getAllByRole("button");
      expect(buttons[0]).toHaveAccessibleName("Season 1, 7 episodes");
      expect(buttons[1]).toHaveAccessibleName("Season 2, 13 episodes");
    });
  });

  describe("roving tabindex", () => {
    it("sets tabIndex=0 on focused item", () => {
      render(
        <ShowView
          data={{ tmdbResult: mockTmdbResult, seasons: mockSeasons }}
          isLoading={false}
          error={null}
          onSeasonSelect={vi.fn()}
          focusedIndex={1}
          onFocusChange={vi.fn()}
        />
      );

      const buttons = screen.getAllByRole("button");
      expect(buttons[0]).toHaveAttribute("tabIndex", "-1");
      expect(buttons[1]).toHaveAttribute("tabIndex", "0");
      expect(buttons[2]).toHaveAttribute("tabIndex", "-1");
    });
  });

  describe("keyboard navigation", () => {
    it("calls onSeasonSelect when clicked", async () => {
      const user = userEvent.setup();
      const onSeasonSelect = vi.fn();

      render(
        <ShowView
          data={{ tmdbResult: mockTmdbResult, seasons: mockSeasons }}
          isLoading={false}
          error={null}
          onSeasonSelect={onSeasonSelect}
          focusedIndex={0}
          onFocusChange={vi.fn()}
        />
      );

      const buttons = screen.getAllByRole("button");
      await user.click(buttons[1]);

      expect(onSeasonSelect).toHaveBeenCalledWith(mockSeasons[1], 1);
    });

    it("calls onFocusChange when button receives focus", () => {
      const onFocusChange = vi.fn();

      render(
        <ShowView
          data={{ tmdbResult: mockTmdbResult, seasons: mockSeasons }}
          isLoading={false}
          error={null}
          onSeasonSelect={vi.fn()}
          focusedIndex={0}
          onFocusChange={onFocusChange}
        />
      );

      const buttons = screen.getAllByRole("button");
      // Programmatically focus the second button
      buttons[1].focus();

      expect(onFocusChange).toHaveBeenCalledWith(1);
    });
  });

  describe("singular/plural grammar", () => {
    it("uses singular 'episode' for 1 episode", () => {
      const singleEpisodeSeason: TMDBSeasonSummary[] = [
        { ...mockSeasons[0], episode_count: 1 },
      ];

      render(
        <ShowView
          data={{ tmdbResult: mockTmdbResult, seasons: singleEpisodeSeason }}
          isLoading={false}
          error={null}
          onSeasonSelect={vi.fn()}
          focusedIndex={0}
          onFocusChange={vi.fn()}
        />
      );

      expect(screen.getByText("1 episode")).toBeInTheDocument();
    });

    it("uses singular 'Season' for 1 season", () => {
      const singleSeason: TMDBSeasonSummary[] = [mockSeasons[0]];

      render(
        <ShowView
          data={{ tmdbResult: mockTmdbResult, seasons: singleSeason }}
          isLoading={false}
          error={null}
          onSeasonSelect={vi.fn()}
          focusedIndex={0}
          onFocusChange={vi.fn()}
        />
      );

      expect(screen.getByText("1 Season • 7 Episodes")).toBeInTheDocument();
    });
  });
});
