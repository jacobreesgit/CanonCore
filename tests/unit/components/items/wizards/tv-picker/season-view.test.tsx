/**
 * Unit tests for the SeasonView component.
 * Tests rendering, keyboard navigation (listbox pattern), and accessibility.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SeasonView } from "@/components/items/wizards/tv-picker/season-view";
import type { TMDBSeasonSummary, TMDBEpisode } from "@/lib/tmdb-client";

const mockSeason: TMDBSeasonSummary = {
  id: 3572,
  season_number: 1,
  name: "Season 1",
  overview: "Walter White's transformation begins...",
  poster_path: "/s1.jpg",
  episode_count: 7,
  air_date: "2008-01-20",
};

const mockEpisodes: TMDBEpisode[] = [
  {
    id: 62085,
    episode_number: 1,
    name: "Pilot",
    overview: "A chemistry teacher receives a diagnosis...",
    still_path: "/ep1.jpg",
  },
  {
    id: 62086,
    episode_number: 2,
    name: "Cat's in the Bag...",
    overview: "Walt and Jesse try to dispose of the bodies...",
    still_path: "/ep2.jpg",
  },
  {
    id: 62087,
    episode_number: 3,
    name: "...And the Bag's in the River",
    overview: "Walt must decide what to do...",
    still_path: null,
  },
];

describe("SeasonView", () => {
  describe("rendering", () => {
    it("renders season name in heading", () => {
      render(
        <SeasonView
          data={{ episodes: mockEpisodes }}
          selectedSeason={mockSeason}
          isLoading={false}
          error={null}
          onEpisodeSelect={vi.fn()}
        />
      );

      expect(
        screen.getByRole("heading", { name: "Season 1" })
      ).toBeInTheDocument();
    });

    it("renders episode count", () => {
      render(
        <SeasonView
          data={{ episodes: mockEpisodes }}
          selectedSeason={mockSeason}
          isLoading={false}
          error={null}
          onEpisodeSelect={vi.fn()}
        />
      );

      expect(screen.getByText("3 Episodes")).toBeInTheDocument();
    });

    it("renders season overview when available", () => {
      render(
        <SeasonView
          data={{ episodes: mockEpisodes }}
          selectedSeason={mockSeason}
          isLoading={false}
          error={null}
          onEpisodeSelect={vi.fn()}
        />
      );

      expect(
        screen.getByText("Walter White's transformation begins...")
      ).toBeInTheDocument();
    });

    it("renders all episode items", () => {
      render(
        <SeasonView
          data={{ episodes: mockEpisodes }}
          selectedSeason={mockSeason}
          isLoading={false}
          error={null}
          onEpisodeSelect={vi.fn()}
        />
      );

      expect(screen.getByText("Pilot")).toBeInTheDocument();
      expect(screen.getByText("Cat's in the Bag...")).toBeInTheDocument();
      expect(
        screen.getByText("...And the Bag's in the River")
      ).toBeInTheDocument();
    });

    it("renders padded episode numbers", () => {
      render(
        <SeasonView
          data={{ episodes: mockEpisodes }}
          selectedSeason={mockSeason}
          isLoading={false}
          error={null}
          onEpisodeSelect={vi.fn()}
        />
      );

      expect(screen.getByText("01")).toBeInTheDocument();
      expect(screen.getByText("02")).toBeInTheDocument();
      expect(screen.getByText("03")).toBeInTheDocument();
    });

    it("renders loading state", () => {
      render(
        <SeasonView
          data={{ episodes: [] }}
          selectedSeason={mockSeason}
          isLoading={true}
          error={null}
          onEpisodeSelect={vi.fn()}
        />
      );

      expect(screen.getByText("Loading episodes…")).toBeInTheDocument();
    });

    it("renders error state", () => {
      render(
        <SeasonView
          data={{ episodes: [] }}
          selectedSeason={mockSeason}
          isLoading={false}
          error="Failed to load episodes"
          onEpisodeSelect={vi.fn()}
        />
      );

      expect(screen.getByText("Failed to load episodes")).toBeInTheDocument();
    });

    it("renders empty state when no episodes", () => {
      render(
        <SeasonView
          data={{ episodes: [] }}
          selectedSeason={mockSeason}
          isLoading={false}
          error={null}
          onEpisodeSelect={vi.fn()}
        />
      );

      expect(screen.getByText("No episodes available")).toBeInTheDocument();
    });
  });

  describe("accessibility", () => {
    it("renders listbox role for episode list", () => {
      render(
        <SeasonView
          data={{ episodes: mockEpisodes }}
          selectedSeason={mockSeason}
          isLoading={false}
          error={null}
          onEpisodeSelect={vi.fn()}
        />
      );

      expect(
        screen.getByRole("listbox", { name: "Episodes" })
      ).toBeInTheDocument();
    });

    it("renders option role for each episode", () => {
      render(
        <SeasonView
          data={{ episodes: mockEpisodes }}
          selectedSeason={mockSeason}
          isLoading={false}
          error={null}
          onEpisodeSelect={vi.fn()}
        />
      );

      expect(screen.getAllByRole("option")).toHaveLength(3);
    });

    it("marks first item as selected by default", () => {
      render(
        <SeasonView
          data={{ episodes: mockEpisodes }}
          selectedSeason={mockSeason}
          isLoading={false}
          error={null}
          onEpisodeSelect={vi.fn()}
        />
      );

      const options = screen.getAllByRole("option");
      expect(options[0]).toHaveAttribute("aria-selected", "true");
      expect(options[1]).toHaveAttribute("aria-selected", "false");
    });

    it("renders accessible labels with episode info", () => {
      render(
        <SeasonView
          data={{ episodes: mockEpisodes }}
          selectedSeason={mockSeason}
          isLoading={false}
          error={null}
          onEpisodeSelect={vi.fn()}
        />
      );

      // Find options by their labels (role="option" inside listbox)
      expect(
        screen.getByRole("option", { name: "Episode 1, Pilot" })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("option", { name: "Episode 2, Cat's in the Bag..." })
      ).toBeInTheDocument();
    });

    it("renders heading with tabindex for focus management", () => {
      render(
        <SeasonView
          data={{ episodes: mockEpisodes }}
          selectedSeason={mockSeason}
          isLoading={false}
          error={null}
          onEpisodeSelect={vi.fn()}
        />
      );

      const heading = screen.getByRole("heading", { name: "Season 1" });
      expect(heading).toHaveAttribute("tabIndex", "-1");
    });
  });

  describe("roving tabindex", () => {
    it("sets tabIndex=0 on first item by default", () => {
      render(
        <SeasonView
          data={{ episodes: mockEpisodes }}
          selectedSeason={mockSeason}
          isLoading={false}
          error={null}
          onEpisodeSelect={vi.fn()}
        />
      );

      const options = screen.getAllByRole("option", { name: /Episode/ });
      expect(options[0]).toHaveAttribute("tabIndex", "0");
      expect(options[1]).toHaveAttribute("tabIndex", "-1");
      expect(options[2]).toHaveAttribute("tabIndex", "-1");
    });
  });

  describe("interactions", () => {
    it("calls onEpisodeSelect when episode clicked", async () => {
      const user = userEvent.setup();
      const onEpisodeSelect = vi.fn();

      render(
        <SeasonView
          data={{ episodes: mockEpisodes }}
          selectedSeason={mockSeason}
          isLoading={false}
          error={null}
          onEpisodeSelect={onEpisodeSelect}
        />
      );

      const options = screen.getAllByRole("option", { name: /Episode/ });
      await user.click(options[1]);

      expect(onEpisodeSelect).toHaveBeenCalledWith(mockEpisodes[1]);
    });
  });

  describe("singular/plural grammar", () => {
    it("uses singular 'Episode' for 1 episode", () => {
      const singleEpisode: TMDBEpisode[] = [mockEpisodes[0]];

      render(
        <SeasonView
          data={{ episodes: singleEpisode }}
          selectedSeason={mockSeason}
          isLoading={false}
          error={null}
          onEpisodeSelect={vi.fn()}
        />
      );

      expect(screen.getByText("1 Episode")).toBeInTheDocument();
    });
  });
});
