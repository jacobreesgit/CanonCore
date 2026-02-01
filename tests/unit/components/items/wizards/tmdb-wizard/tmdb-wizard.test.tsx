/**
 * Unit tests for the TMDB wizard orchestrator component.
 * Tests content type handling, image fetching, and step navigation.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TMDBWizard } from "@/components/items/wizards/tmdb-wizard/tmdb-wizard";
import type { TMDBWizardInitialData } from "@/components/items/wizards/tmdb-wizard";
import * as tmdbActions from "@/lib/tmdb-actions";

// Mock TMDB actions
vi.mock("@/lib/tmdb-actions", () => ({
  getImagesAction: vi.fn(),
  getSeasonImagesAction: vi.fn(),
  getEpisodeImagesAction: vi.fn(),
}));

// Mock motion/react to avoid animation issues in tests
vi.mock("motion/react", () => ({
  motion: {
    div: ({ children, ...props }: React.PropsWithChildren<object>) => (
      <div {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
  useReducedMotion: () => false,
}));

const mockTmdbResult = {
  id: 1399,
  mediaType: "tv" as const,
  title: "Game of Thrones",
  overview: "A fantasy drama series",
  posterPath: "/poster.jpg",
  backdropPath: "/backdrop.jpg",
  year: "2011",
};

const mockPreview = {
  name: "Game of Thrones (2011)",
  description: "A fantasy drama series",
};

const mockCurrentValues = {
  name: "Existing Item",
  description: "Existing description",
};

const mockMovieImages = {
  posters: [
    {
      file_path: "/movie-poster.jpg",
      vote_average: 8,
      iso_639_1: null,
      width: 500,
      height: 750,
    },
  ],
  backdrops: [
    {
      file_path: "/movie-backdrop.jpg",
      vote_average: 9,
      iso_639_1: null,
      width: 1920,
      height: 1080,
    },
  ],
};

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

describe("TMDBWizard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("visible steps based on content type", () => {
    it("shows text, poster, hero, summary steps for movies with Drive", async () => {
      const movieData: TMDBWizardInitialData = {
        tmdbResult: { ...mockTmdbResult, mediaType: "movie" },
        preview: mockPreview,
        contentType: "movie",
      };

      vi.mocked(tmdbActions.getImagesAction).mockResolvedValue({
        success: true,
        data: mockMovieImages,
      });

      render(
        <TMDBWizard
          initialData={movieData}
          currentValues={mockCurrentValues}
          uploadMode={false}
          hasDriveConnection={true}
          onComplete={vi.fn()}
        />
      );

      // Should show step indicator with all 4 steps (text appears twice: indicator + heading)
      expect(screen.getAllByText("Title & Description")).toHaveLength(2);
      // Poster and Hero appear only in step indicator at text step
      expect(screen.getByText("Poster")).toBeInTheDocument();
      expect(screen.getByText("Hero Image")).toBeInTheDocument();
      expect(screen.getByText("Review")).toBeInTheDocument();
    });

    it("shows text, poster, hero, summary steps for shows with Drive", async () => {
      const showData: TMDBWizardInitialData = {
        tmdbResult: mockTmdbResult,
        preview: mockPreview,
        contentType: "show",
      };

      vi.mocked(tmdbActions.getImagesAction).mockResolvedValue({
        success: true,
        data: mockMovieImages,
      });

      render(
        <TMDBWizard
          initialData={showData}
          currentValues={mockCurrentValues}
          uploadMode={false}
          hasDriveConnection={true}
          onComplete={vi.fn()}
        />
      );

      // Should show step indicator with all 4 steps
      expect(screen.getAllByText("Title & Description")).toHaveLength(2);
      expect(screen.getByText("Poster")).toBeInTheDocument();
      expect(screen.getByText("Hero Image")).toBeInTheDocument();
      expect(screen.getByText("Review")).toBeInTheDocument();
    });

    it("shows text, poster, summary steps for seasons with Drive (NO hero)", async () => {
      const seasonData: TMDBWizardInitialData & { seasonNumber: number } = {
        tmdbResult: mockTmdbResult,
        preview: { name: "Season 1", description: "First season" },
        contentType: "season",
        seasonNumber: 1,
      };

      vi.mocked(tmdbActions.getSeasonImagesAction).mockResolvedValue({
        success: true,
        data: mockSeasonImages,
      });

      render(
        <TMDBWizard
          initialData={seasonData}
          currentValues={mockCurrentValues}
          uploadMode={false}
          hasDriveConnection={true}
          onComplete={vi.fn()}
        />
      );

      // Should show step indicator with 3 steps (no hero)
      expect(screen.getAllByText("Title & Description")).toHaveLength(2);
      expect(screen.getByText("Poster")).toBeInTheDocument();
      expect(screen.queryByText("Hero Image")).not.toBeInTheDocument();
      expect(screen.getByText("Review")).toBeInTheDocument();
    });

    it("shows text, still, summary steps for episodes with Drive", async () => {
      const episodeData: TMDBWizardInitialData & {
        seasonNumber: number;
        episodeNumber: number;
      } = {
        tmdbResult: mockTmdbResult,
        preview: { name: "Pilot", description: "First episode" },
        contentType: "episode",
        seasonNumber: 1,
        episodeNumber: 1,
      };

      vi.mocked(tmdbActions.getEpisodeImagesAction).mockResolvedValue({
        success: true,
        data: mockEpisodeImages,
      });

      render(
        <TMDBWizard
          initialData={episodeData}
          currentValues={mockCurrentValues}
          uploadMode={false}
          hasDriveConnection={true}
          onComplete={vi.fn()}
        />
      );

      // Should show step indicator with 3 steps (still instead of poster)
      expect(screen.getAllByText("Title & Description")).toHaveLength(2);
      expect(screen.queryByText("Poster")).not.toBeInTheDocument();
      expect(screen.getByText("Still Image")).toBeInTheDocument();
      expect(screen.getByText("Review")).toBeInTheDocument();
    });

    it("shows only text and summary steps without Drive connection", async () => {
      const movieData: TMDBWizardInitialData = {
        tmdbResult: { ...mockTmdbResult, mediaType: "movie" },
        preview: mockPreview,
        contentType: "movie",
      };

      render(
        <TMDBWizard
          initialData={movieData}
          currentValues={mockCurrentValues}
          uploadMode={false}
          hasDriveConnection={false}
          onComplete={vi.fn()}
        />
      );

      // Should show step indicator with only 2 steps
      expect(screen.getAllByText("Title & Description")).toHaveLength(2);
      expect(screen.queryByText("Poster")).not.toBeInTheDocument();
      expect(screen.queryByText("Hero Image")).not.toBeInTheDocument();
      expect(screen.getByText("Review")).toBeInTheDocument();
    });
  });

  describe("image fetching based on content type", () => {
    it("fetches getImagesAction for movies when entering poster step", async () => {
      const user = userEvent.setup();
      const movieData: TMDBWizardInitialData = {
        tmdbResult: { ...mockTmdbResult, mediaType: "movie" },
        preview: mockPreview,
        contentType: "movie",
      };

      vi.mocked(tmdbActions.getImagesAction).mockResolvedValue({
        success: true,
        data: mockMovieImages,
      });

      render(
        <TMDBWizard
          initialData={movieData}
          currentValues={mockCurrentValues}
          uploadMode={false}
          hasDriveConnection={true}
          onComplete={vi.fn()}
        />
      );

      // Navigate to poster step
      await user.click(screen.getByRole("button", { name: /next/i }));

      await waitFor(() => {
        expect(tmdbActions.getImagesAction).toHaveBeenCalledWith(
          mockTmdbResult.id,
          "movie"
        );
      });
    });

    it("fetches getImagesAction for shows when entering poster step", async () => {
      const user = userEvent.setup();
      const showData: TMDBWizardInitialData = {
        tmdbResult: mockTmdbResult,
        preview: mockPreview,
        contentType: "show",
      };

      vi.mocked(tmdbActions.getImagesAction).mockResolvedValue({
        success: true,
        data: mockMovieImages,
      });

      render(
        <TMDBWizard
          initialData={showData}
          currentValues={mockCurrentValues}
          uploadMode={false}
          hasDriveConnection={true}
          onComplete={vi.fn()}
        />
      );

      // Navigate to poster step
      await user.click(screen.getByRole("button", { name: /next/i }));

      await waitFor(() => {
        expect(tmdbActions.getImagesAction).toHaveBeenCalledWith(
          mockTmdbResult.id,
          "tv"
        );
      });
    });

    it("fetches getSeasonImagesAction for seasons when entering poster step", async () => {
      const user = userEvent.setup();
      const seasonData: TMDBWizardInitialData & { seasonNumber: number } = {
        tmdbResult: mockTmdbResult,
        preview: { name: "Season 1", description: "First season" },
        contentType: "season",
        seasonNumber: 1,
      };

      vi.mocked(tmdbActions.getSeasonImagesAction).mockResolvedValue({
        success: true,
        data: mockSeasonImages,
      });

      render(
        <TMDBWizard
          initialData={seasonData}
          currentValues={mockCurrentValues}
          uploadMode={false}
          hasDriveConnection={true}
          onComplete={vi.fn()}
        />
      );

      // Navigate to poster step
      await user.click(screen.getByRole("button", { name: /next/i }));

      await waitFor(() => {
        expect(tmdbActions.getSeasonImagesAction).toHaveBeenCalledWith(
          mockTmdbResult.id,
          1 // season number
        );
      });
    });

    it("fetches getEpisodeImagesAction for episodes when entering still step", async () => {
      const user = userEvent.setup();
      const episodeData: TMDBWizardInitialData & {
        seasonNumber: number;
        episodeNumber: number;
      } = {
        tmdbResult: mockTmdbResult,
        preview: { name: "Pilot", description: "First episode" },
        contentType: "episode",
        seasonNumber: 1,
        episodeNumber: 1,
      };

      vi.mocked(tmdbActions.getEpisodeImagesAction).mockResolvedValue({
        success: true,
        data: mockEpisodeImages,
      });

      render(
        <TMDBWizard
          initialData={episodeData}
          currentValues={mockCurrentValues}
          uploadMode={false}
          hasDriveConnection={true}
          onComplete={vi.fn()}
        />
      );

      // Navigate to still step
      await user.click(screen.getByRole("button", { name: /next/i }));

      await waitFor(() => {
        expect(tmdbActions.getEpisodeImagesAction).toHaveBeenCalledWith(
          mockTmdbResult.id,
          1, // season number
          1 // episode number
        );
      });
    });

    it("does not fetch regular images for seasons", async () => {
      const user = userEvent.setup();
      const seasonData: TMDBWizardInitialData & { seasonNumber: number } = {
        tmdbResult: mockTmdbResult,
        preview: { name: "Season 1", description: "First season" },
        contentType: "season",
        seasonNumber: 1,
      };

      vi.mocked(tmdbActions.getSeasonImagesAction).mockResolvedValue({
        success: true,
        data: mockSeasonImages,
      });

      render(
        <TMDBWizard
          initialData={seasonData}
          currentValues={mockCurrentValues}
          uploadMode={false}
          hasDriveConnection={true}
          onComplete={vi.fn()}
        />
      );

      // Navigate to poster step
      await user.click(screen.getByRole("button", { name: /next/i }));

      await waitFor(() => {
        expect(tmdbActions.getSeasonImagesAction).toHaveBeenCalled();
      });

      // Should NOT call getImagesAction for seasons
      expect(tmdbActions.getImagesAction).not.toHaveBeenCalled();
    });
  });

  describe("season poster selection flow", () => {
    it("displays season posters from seasonImages data", async () => {
      const user = userEvent.setup();
      const seasonData: TMDBWizardInitialData & { seasonNumber: number } = {
        tmdbResult: mockTmdbResult,
        preview: { name: "Season 1", description: "First season" },
        contentType: "season",
        seasonNumber: 1,
      };

      vi.mocked(tmdbActions.getSeasonImagesAction).mockResolvedValue({
        success: true,
        data: mockSeasonImages,
      });

      render(
        <TMDBWizard
          initialData={seasonData}
          currentValues={mockCurrentValues}
          uploadMode={false}
          hasDriveConnection={true}
          onComplete={vi.fn()}
        />
      );

      // Navigate to poster step
      await user.click(screen.getByRole("button", { name: /next/i }));

      // Wait for images to load
      await waitFor(() => {
        expect(tmdbActions.getSeasonImagesAction).toHaveBeenCalled();
      });

      // Should display poster selection step
      expect(screen.getByText("Select Poster")).toBeInTheDocument();
    });

    it("completes season wizard with poster selection", async () => {
      const user = userEvent.setup();
      const onComplete = vi.fn();
      const seasonData: TMDBWizardInitialData & { seasonNumber: number } = {
        tmdbResult: mockTmdbResult,
        preview: { name: "Season 1", description: "First season" },
        contentType: "season",
        seasonNumber: 1,
      };

      vi.mocked(tmdbActions.getSeasonImagesAction).mockResolvedValue({
        success: true,
        data: mockSeasonImages,
      });

      render(
        <TMDBWizard
          initialData={seasonData}
          currentValues={mockCurrentValues}
          uploadMode={false}
          hasDriveConnection={true}
          onComplete={onComplete}
        />
      );

      // Navigate through wizard: text -> poster -> summary -> apply
      // Step 1: Text (Next)
      await user.click(screen.getByRole("button", { name: /next/i }));

      // Wait for images to load
      await waitFor(() => {
        expect(tmdbActions.getSeasonImagesAction).toHaveBeenCalled();
      });

      // Step 2: Poster (Next)
      await user.click(screen.getByRole("button", { name: /next/i }));

      // Step 3: Summary (Apply)
      await waitFor(() => {
        expect(screen.getByText("Review Changes")).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: /apply/i }));

      // Verify completion
      expect(onComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          contentType: "season",
        })
      );
    });
  });

  describe("error handling", () => {
    it("shows error when season image fetch fails", async () => {
      const user = userEvent.setup();
      const seasonData: TMDBWizardInitialData & { seasonNumber: number } = {
        tmdbResult: mockTmdbResult,
        preview: { name: "Season 1", description: "First season" },
        contentType: "season",
        seasonNumber: 1,
      };

      vi.mocked(tmdbActions.getSeasonImagesAction).mockResolvedValue({
        success: false,
        error: "Failed to load season images",
      });

      render(
        <TMDBWizard
          initialData={seasonData}
          currentValues={mockCurrentValues}
          uploadMode={false}
          hasDriveConnection={true}
          onComplete={vi.fn()}
        />
      );

      // Navigate to poster step
      await user.click(screen.getByRole("button", { name: /next/i }));

      // Wait for error to be displayed
      await waitFor(() => {
        expect(
          screen.getByText("Failed to load season images")
        ).toBeInTheDocument();
      });
    });
  });

  describe("content type derivation", () => {
    it("derives movie content type from movie media type", () => {
      const movieData: TMDBWizardInitialData = {
        tmdbResult: { ...mockTmdbResult, mediaType: "movie" },
        preview: mockPreview,
      };

      vi.mocked(tmdbActions.getImagesAction).mockResolvedValue({
        success: true,
        data: mockMovieImages,
      });

      render(
        <TMDBWizard
          initialData={movieData}
          currentValues={mockCurrentValues}
          uploadMode={false}
          hasDriveConnection={true}
          onComplete={vi.fn()}
        />
      );

      // Should show movie steps (including hero)
      expect(screen.getByText("Hero Image")).toBeInTheDocument();
    });

    it("derives show content type from tv media type without explicit contentType", () => {
      const showData: TMDBWizardInitialData = {
        tmdbResult: mockTmdbResult, // mediaType: "tv"
        preview: mockPreview,
        // No explicit contentType - should derive "show" from tv
      };

      vi.mocked(tmdbActions.getImagesAction).mockResolvedValue({
        success: true,
        data: mockMovieImages,
      });

      render(
        <TMDBWizard
          initialData={showData}
          currentValues={mockCurrentValues}
          uploadMode={false}
          hasDriveConnection={true}
          onComplete={vi.fn()}
        />
      );

      // Should show show steps (including hero)
      expect(screen.getByText("Hero Image")).toBeInTheDocument();
    });

    it("uses explicit season contentType over media type derivation", () => {
      const seasonData: TMDBWizardInitialData & { seasonNumber: number } = {
        tmdbResult: mockTmdbResult, // mediaType: "tv"
        preview: mockPreview,
        contentType: "season", // Explicit override
        seasonNumber: 1,
      };

      vi.mocked(tmdbActions.getSeasonImagesAction).mockResolvedValue({
        success: true,
        data: mockSeasonImages,
      });

      render(
        <TMDBWizard
          initialData={seasonData}
          currentValues={mockCurrentValues}
          uploadMode={false}
          hasDriveConnection={true}
          onComplete={vi.fn()}
        />
      );

      // Should NOT show hero for seasons
      expect(screen.queryByText("Hero Image")).not.toBeInTheDocument();
    });

    it("uses isEpisodeMode as fallback for episode content type", () => {
      const episodeData: TMDBWizardInitialData & {
        seasonNumber: number;
        episodeNumber: number;
      } = {
        tmdbResult: mockTmdbResult,
        preview: mockPreview,
        isEpisodeMode: true, // Legacy flag
        seasonNumber: 1,
        episodeNumber: 1,
      };

      vi.mocked(tmdbActions.getEpisodeImagesAction).mockResolvedValue({
        success: true,
        data: mockEpisodeImages,
      });

      render(
        <TMDBWizard
          initialData={episodeData}
          currentValues={mockCurrentValues}
          uploadMode={false}
          hasDriveConnection={true}
          onComplete={vi.fn()}
        />
      );

      // Should show still instead of poster for episodes
      expect(screen.getByText("Still Image")).toBeInTheDocument();
      expect(screen.queryByText("Poster")).not.toBeInTheDocument();
    });
  });
});
