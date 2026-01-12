/**
 * Unit tests for EpisodePicker component.
 * Tests season/episode drill-down navigation, loading states, error handling,
 * and selection callbacks.
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EpisodePicker } from "@/components/items/episode-picker";

// Mock TMDB actions
vi.mock("@/lib/tmdb-actions", () => ({
  getSeasonsAction: vi.fn(),
  getEpisodesAction: vi.fn(),
}));

import { getSeasonsAction, getEpisodesAction } from "@/lib/tmdb-actions";

const mockSeasons = [
  {
    id: 1,
    season_number: 1,
    name: "Season 1",
    overview: "First season",
    poster_path: "/season1.jpg",
    episode_count: 8,
    air_date: "2020-01-01",
  },
  {
    id: 2,
    season_number: 2,
    name: "Season 2",
    overview: "Second season",
    poster_path: null,
    episode_count: 1,
    air_date: "2021-01-01",
  },
];

const mockEpisodes = [
  {
    id: 101,
    episode_number: 1,
    name: "Pilot",
    overview: "The first episode",
    still_path: "/ep1.jpg",
  },
  {
    id: 102,
    episode_number: 2,
    name: "Second Episode",
    overview: "",
    still_path: null,
  },
];

const defaultProps = {
  open: true,
  onOpenChange: vi.fn(),
  tvId: 1396,
  showTitle: "Breaking Bad",
  showYear: "2008",
  onSelect: vi.fn(),
  onCancel: vi.fn(),
};

describe("EpisodePicker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSeasonsAction).mockResolvedValue({
      success: true,
      data: mockSeasons,
    });
    vi.mocked(getEpisodesAction).mockResolvedValue({
      success: true,
      data: mockEpisodes,
    });
  });

  describe("Basic Rendering", () => {
    it("renders dialog when open", async () => {
      render(<EpisodePicker {...defaultProps} />);

      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByText("Select Season")).toBeInTheDocument();
    });

    it("does not render when closed", () => {
      render(<EpisodePicker {...defaultProps} open={false} />);

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("shows show title with year in description", async () => {
      render(<EpisodePicker {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Breaking Bad (2008)")).toBeInTheDocument();
      });
    });

    it("shows show title without year when year is not provided", async () => {
      render(<EpisodePicker {...defaultProps} showYear={undefined} />);

      await waitFor(() => {
        expect(screen.getByText("Breaking Bad")).toBeInTheDocument();
      });
    });
  });

  describe("Seasons View", () => {
    it("shows loading state while fetching seasons", async () => {
      vi.mocked(getSeasonsAction).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      render(<EpisodePicker {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Loading seasons...")).toBeInTheDocument();
      });
    });

    it("shows seasons list after successful fetch", async () => {
      render(<EpisodePicker {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Season 1")).toBeInTheDocument();
        expect(screen.getByText("Season 2")).toBeInTheDocument();
      });
    });

    it("shows episode count for each season", async () => {
      render(<EpisodePicker {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("8 episodes")).toBeInTheDocument();
        expect(screen.getByText("1 episode")).toBeInTheDocument(); // Singular
      });
    });

    it("shows error state on fetch failure", async () => {
      vi.mocked(getSeasonsAction).mockResolvedValue({
        success: false,
        error: "Network error",
      });

      render(<EpisodePicker {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Network error")).toBeInTheDocument();
      });
    });

    it("shows generic error when data is missing", async () => {
      vi.mocked(getSeasonsAction).mockResolvedValue({
        success: true,
        data: undefined,
      });

      render(<EpisodePicker {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Failed to load seasons")).toBeInTheDocument();
      });
    });

    it("fetches seasons with correct tvId", async () => {
      render(<EpisodePicker {...defaultProps} tvId={550} />);

      await waitFor(() => {
        expect(getSeasonsAction).toHaveBeenCalledWith(550);
      });
    });
  });

  describe("Episodes View", () => {
    it("transitions to episodes view when season clicked", async () => {
      const user = userEvent.setup();
      render(<EpisodePicker {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Season 1")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Season 1"));

      await waitFor(() => {
        expect(screen.getByText("Select Episode")).toBeInTheDocument();
      });
    });

    it("shows season name in description when in episodes view", async () => {
      const user = userEvent.setup();
      render(<EpisodePicker {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Season 1")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Season 1"));

      await waitFor(() => {
        // Season name appears in the dialog description
        const description = screen.getByText("Season 1", { selector: "p" });
        expect(description).toBeInTheDocument();
      });
    });

    it("shows loading state while fetching episodes", async () => {
      const user = userEvent.setup();
      vi.mocked(getEpisodesAction).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      render(<EpisodePicker {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Season 1")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Season 1"));

      await waitFor(() => {
        expect(screen.getByText("Loading episodes...")).toBeInTheDocument();
      });
    });

    it("shows episodes list after successful fetch", async () => {
      const user = userEvent.setup();
      render(<EpisodePicker {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Season 1")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Season 1"));

      await waitFor(() => {
        expect(screen.getByText("Pilot")).toBeInTheDocument();
        expect(screen.getByText("Second Episode")).toBeInTheDocument();
      });
    });

    it("shows episode numbers padded to 2 digits", async () => {
      const user = userEvent.setup();
      render(<EpisodePicker {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Season 1")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Season 1"));

      await waitFor(() => {
        expect(screen.getByText("01")).toBeInTheDocument();
        expect(screen.getByText("02")).toBeInTheDocument();
      });
    });

    it("shows episode overview when available", async () => {
      const user = userEvent.setup();
      render(<EpisodePicker {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Season 1")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Season 1"));

      await waitFor(() => {
        expect(screen.getByText("The first episode")).toBeInTheDocument();
      });
    });

    it("shows error state on episodes fetch failure", async () => {
      const user = userEvent.setup();
      vi.mocked(getEpisodesAction).mockResolvedValue({
        success: false,
        error: "Episode fetch failed",
      });

      render(<EpisodePicker {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Season 1")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Season 1"));

      await waitFor(() => {
        expect(screen.getByText("Episode fetch failed")).toBeInTheDocument();
      });
    });

    it("fetches episodes with correct tvId and season number", async () => {
      const user = userEvent.setup();
      render(<EpisodePicker {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Season 2")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Season 2"));

      await waitFor(() => {
        expect(getEpisodesAction).toHaveBeenCalledWith(1396, 2);
      });
    });
  });

  describe("Breadcrumb Navigation", () => {
    it("shows breadcrumb in episodes view", async () => {
      const user = userEvent.setup();
      render(<EpisodePicker {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Season 1")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Season 1"));

      await waitFor(() => {
        // Breadcrumb shows truncated show title
        expect(
          screen.getByRole("button", { name: /Breaking Bad/i })
        ).toBeInTheDocument();
      });
    });

    it("clicking breadcrumb returns to seasons view", async () => {
      const user = userEvent.setup();
      render(<EpisodePicker {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Season 1")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Season 1"));

      await waitFor(() => {
        expect(screen.getByText("Select Episode")).toBeInTheDocument();
      });

      // Click breadcrumb to go back
      await user.click(screen.getByRole("button", { name: /Breaking Bad/i }));

      await waitFor(() => {
        expect(screen.getByText("Select Season")).toBeInTheDocument();
      });
    });
  });

  describe("Selection Callbacks", () => {
    it("calls onSelect with show type when Use Show clicked", async () => {
      const onSelect = vi.fn();
      render(<EpisodePicker {...defaultProps} onSelect={onSelect} />);

      await waitFor(() => {
        expect(screen.getByText("Season 1")).toBeInTheDocument();
      });

      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: /use show/i }));

      expect(onSelect).toHaveBeenCalledWith({ type: "show" });
    });

    it("calls onSelect with season type when Use Season clicked", async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      render(<EpisodePicker {...defaultProps} onSelect={onSelect} />);

      await waitFor(() => {
        expect(screen.getByText("Season 1")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Season 1"));

      await waitFor(() => {
        expect(screen.getByText("Select Episode")).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: /use season/i }));

      expect(onSelect).toHaveBeenCalledWith({
        type: "season",
        seasonNumber: 1,
      });
    });

    it("calls onSelect with episode type when episode clicked", async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      render(<EpisodePicker {...defaultProps} onSelect={onSelect} />);

      await waitFor(() => {
        expect(screen.getByText("Season 1")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Season 1"));

      await waitFor(() => {
        expect(screen.getByText("Pilot")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Pilot"));

      expect(onSelect).toHaveBeenCalledWith({
        type: "episode",
        seasonNumber: 1,
        episodeNumber: 1,
      });
    });

    it("calls onCancel and onOpenChange when Cancel clicked", async () => {
      const user = userEvent.setup();
      const onCancel = vi.fn();
      const onOpenChange = vi.fn();
      render(
        <EpisodePicker
          {...defaultProps}
          onCancel={onCancel}
          onOpenChange={onOpenChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByText("Season 1")).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: /cancel/i }));

      expect(onCancel).toHaveBeenCalled();
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  describe("State Reset", () => {
    it("resets to seasons view when dialog reopens", async () => {
      const user = userEvent.setup();
      const { rerender } = render(<EpisodePicker {...defaultProps} />);

      // Navigate to episodes view
      await waitFor(() => {
        expect(screen.getByText("Season 1")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Season 1"));

      await waitFor(() => {
        expect(screen.getByText("Select Episode")).toBeInTheDocument();
      });

      // Close and reopen dialog
      rerender(<EpisodePicker {...defaultProps} open={false} />);
      rerender(<EpisodePicker {...defaultProps} open={true} />);

      await waitFor(() => {
        expect(screen.getByText("Select Season")).toBeInTheDocument();
      });
    });
  });
});
