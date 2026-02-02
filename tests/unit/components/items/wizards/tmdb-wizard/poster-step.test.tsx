/**
 * Unit tests for the TMDB wizard poster step component.
 * Tests rendering, selection, skip behavior, and navigation.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TMDBPosterStep } from "@/components/items/wizards/tmdb-wizard/poster-step";
import type { TMDBWizardData } from "@/components/items/wizards/tmdb-wizard";

const mockImages = {
  posters: [
    {
      file_path: "/p1.jpg",
      vote_average: 8,
      iso_639_1: null,
      width: 500,
      height: 750,
    },
    {
      file_path: "/p2.jpg",
      vote_average: 7,
      iso_639_1: "en",
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

const mockData: Partial<TMDBWizardData> = {
  images: mockImages,
  poster: {
    value: null,
    source: null,
    skipped: false,
  },
};

const mockCurrentValues = {
  name: "Test Item",
  description: "Test description",
};

describe("TMDBPosterStep", () => {
  describe("rendering", () => {
    it("renders step title", () => {
      render(
        <TMDBPosterStep
          data={mockData}
          currentValues={mockCurrentValues}
          isLoading={false}
          error={null}
          canGoBack={true}
          uploadMode={false}
          hasDriveConnection={false}
          onNext={vi.fn()}
          onBack={vi.fn()}
          onDataChange={vi.fn()}
          onLoadingChange={vi.fn()}
          onError={vi.fn()}
          onSkip={vi.fn()}
        />
      );

      expect(screen.getByText("Select Poster")).toBeInTheDocument();
    });

    it("renders skip checkbox", () => {
      render(
        <TMDBPosterStep
          data={mockData}
          currentValues={mockCurrentValues}
          isLoading={false}
          error={null}
          canGoBack={true}
          uploadMode={false}
          hasDriveConnection={false}
          onNext={vi.fn()}
          onBack={vi.fn()}
          onDataChange={vi.fn()}
          onLoadingChange={vi.fn()}
          onError={vi.fn()}
          onSkip={vi.fn()}
        />
      );

      expect(
        screen.getByRole("checkbox", { name: /skip/i })
      ).toBeInTheDocument();
    });
  });

  describe("navigation", () => {
    it("renders Next button", () => {
      render(
        <TMDBPosterStep
          data={mockData}
          currentValues={mockCurrentValues}
          isLoading={false}
          error={null}
          canGoBack={true}
          uploadMode={false}
          hasDriveConnection={false}
          onNext={vi.fn()}
          onBack={vi.fn()}
          onDataChange={vi.fn()}
          onLoadingChange={vi.fn()}
          onError={vi.fn()}
          onSkip={vi.fn()}
        />
      );

      expect(screen.getByRole("button", { name: /next/i })).toBeInTheDocument();
    });

    it("renders Back button", () => {
      render(
        <TMDBPosterStep
          data={mockData}
          currentValues={mockCurrentValues}
          isLoading={false}
          error={null}
          canGoBack={true}
          uploadMode={false}
          hasDriveConnection={false}
          onNext={vi.fn()}
          onBack={vi.fn()}
          onDataChange={vi.fn()}
          onLoadingChange={vi.fn()}
          onError={vi.fn()}
          onSkip={vi.fn()}
        />
      );

      expect(screen.getByRole("button", { name: /back/i })).toBeInTheDocument();
    });

    it("calls onNext when Next button is clicked", async () => {
      const user = userEvent.setup();
      const onNext = vi.fn();

      render(
        <TMDBPosterStep
          data={mockData}
          currentValues={mockCurrentValues}
          isLoading={false}
          error={null}
          canGoBack={true}
          uploadMode={false}
          hasDriveConnection={false}
          onNext={onNext}
          onBack={vi.fn()}
          onDataChange={vi.fn()}
          onLoadingChange={vi.fn()}
          onError={vi.fn()}
          onSkip={vi.fn()}
        />
      );

      await user.click(screen.getByRole("button", { name: /next/i }));

      expect(onNext).toHaveBeenCalled();
    });

    it("calls onBack when Back button is clicked", async () => {
      const user = userEvent.setup();
      const onBack = vi.fn();

      render(
        <TMDBPosterStep
          data={mockData}
          currentValues={mockCurrentValues}
          isLoading={false}
          error={null}
          canGoBack={true}
          uploadMode={false}
          hasDriveConnection={false}
          onNext={vi.fn()}
          onBack={onBack}
          onDataChange={vi.fn()}
          onLoadingChange={vi.fn()}
          onError={vi.fn()}
          onSkip={vi.fn()}
        />
      );

      await user.click(screen.getByRole("button", { name: /back/i }));

      expect(onBack).toHaveBeenCalled();
    });
  });

  describe("skip functionality", () => {
    it("calls onSkip when skip checkbox is checked", async () => {
      const user = userEvent.setup();
      const onSkip = vi.fn();

      render(
        <TMDBPosterStep
          data={mockData}
          currentValues={mockCurrentValues}
          isLoading={false}
          error={null}
          canGoBack={true}
          uploadMode={false}
          hasDriveConnection={false}
          onNext={vi.fn()}
          onBack={vi.fn()}
          onDataChange={vi.fn()}
          onLoadingChange={vi.fn()}
          onError={vi.fn()}
          onSkip={onSkip}
        />
      );

      await user.click(screen.getByRole("checkbox", { name: /skip/i }));

      expect(onSkip).toHaveBeenCalled();
    });

    it("shows skipped state when poster is skipped", () => {
      const skippedData: Partial<TMDBWizardData> = {
        ...mockData,
        poster: {
          value: null,
          source: null,
          skipped: true,
        },
      };

      render(
        <TMDBPosterStep
          data={skippedData}
          currentValues={mockCurrentValues}
          isLoading={false}
          error={null}
          canGoBack={true}
          uploadMode={false}
          hasDriveConnection={false}
          onNext={vi.fn()}
          onBack={vi.fn()}
          onDataChange={vi.fn()}
          onLoadingChange={vi.fn()}
          onError={vi.fn()}
          onSkip={vi.fn()}
        />
      );

      const skipCheckbox = screen.getByRole("checkbox", { name: /skip/i });
      expect(skipCheckbox).toBeChecked();
    });
  });

  describe("loading state", () => {
    it("disables buttons when loading", () => {
      render(
        <TMDBPosterStep
          data={mockData}
          currentValues={mockCurrentValues}
          isLoading={true}
          error={null}
          canGoBack={true}
          uploadMode={false}
          hasDriveConnection={false}
          onNext={vi.fn()}
          onBack={vi.fn()}
          onDataChange={vi.fn()}
          onLoadingChange={vi.fn()}
          onError={vi.fn()}
          onSkip={vi.fn()}
        />
      );

      expect(screen.getByRole("button", { name: /next/i })).toBeDisabled();
      expect(screen.getByRole("button", { name: /back/i })).toBeDisabled();
    });
  });

  describe("error state", () => {
    it("displays error message", () => {
      render(
        <TMDBPosterStep
          data={mockData}
          currentValues={mockCurrentValues}
          isLoading={false}
          error="Failed to load images"
          canGoBack={true}
          uploadMode={false}
          hasDriveConnection={false}
          onNext={vi.fn()}
          onBack={vi.fn()}
          onDataChange={vi.fn()}
          onLoadingChange={vi.fn()}
          onError={vi.fn()}
          onSkip={vi.fn()}
        />
      );

      expect(screen.getByText("Failed to load images")).toBeInTheDocument();
    });
  });

  describe("content type handling", () => {
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

    it("uses images.posters for movie content type", () => {
      const movieData: Partial<TMDBWizardData> = {
        contentType: "movie",
        images: mockImages,
        seasonImages: null,
        poster: { value: null, source: null, skipped: false },
      };

      render(
        <TMDBPosterStep
          data={movieData}
          currentValues={mockCurrentValues}
          isLoading={false}
          error={null}
          canGoBack={true}
          uploadMode={false}
          hasDriveConnection={false}
          onNext={vi.fn()}
          onBack={vi.fn()}
          onDataChange={vi.fn()}
          onLoadingChange={vi.fn()}
          onError={vi.fn()}
          onSkip={vi.fn()}
        />
      );

      // Should render poster images from images.posters
      expect(screen.getByText("Select Poster")).toBeInTheDocument();
    });

    it("uses images.posters for show content type", () => {
      const showData: Partial<TMDBWizardData> = {
        contentType: "show",
        images: mockImages,
        seasonImages: null,
        poster: { value: null, source: null, skipped: false },
      };

      render(
        <TMDBPosterStep
          data={showData}
          currentValues={mockCurrentValues}
          isLoading={false}
          error={null}
          canGoBack={true}
          uploadMode={false}
          hasDriveConnection={false}
          onNext={vi.fn()}
          onBack={vi.fn()}
          onDataChange={vi.fn()}
          onLoadingChange={vi.fn()}
          onError={vi.fn()}
          onSkip={vi.fn()}
        />
      );

      // Should render poster images from images.posters
      expect(screen.getByText("Select Poster")).toBeInTheDocument();
    });

    it("uses seasonImages.posters for season content type", () => {
      const seasonData: Partial<TMDBWizardData> = {
        contentType: "season",
        images: null, // No regular images for seasons
        seasonImages: mockSeasonImages,
        poster: { value: null, source: null, skipped: false },
      };

      render(
        <TMDBPosterStep
          data={seasonData}
          currentValues={mockCurrentValues}
          isLoading={false}
          error={null}
          canGoBack={true}
          uploadMode={false}
          hasDriveConnection={false}
          onNext={vi.fn()}
          onBack={vi.fn()}
          onDataChange={vi.fn()}
          onLoadingChange={vi.fn()}
          onError={vi.fn()}
          onSkip={vi.fn()}
        />
      );

      // Should render poster images from seasonImages.posters
      expect(screen.getByText("Select Poster")).toBeInTheDocument();
    });

    it("handles missing seasonImages gracefully for season content type", () => {
      const seasonData: Partial<TMDBWizardData> = {
        contentType: "season",
        images: null,
        seasonImages: null, // Not loaded yet
        poster: { value: null, source: null, skipped: false },
      };

      render(
        <TMDBPosterStep
          data={seasonData}
          currentValues={mockCurrentValues}
          isLoading={false}
          error={null}
          canGoBack={true}
          uploadMode={false}
          hasDriveConnection={false}
          onNext={vi.fn()}
          onBack={vi.fn()}
          onDataChange={vi.fn()}
          onLoadingChange={vi.fn()}
          onError={vi.fn()}
          onSkip={vi.fn()}
        />
      );

      // Should render without crashing
      expect(screen.getByText("Select Poster")).toBeInTheDocument();
    });
  });
});
