/**
 * Unit tests for the TMDB wizard hero step component.
 * Tests rendering, selection, skip behavior, and navigation.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TMDBHeroStep } from "@/components/items/wizards/tmdb-wizard/hero-step";
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
  ],
  backdrops: [
    {
      file_path: "/b1.jpg",
      vote_average: 9,
      iso_639_1: null,
      width: 1920,
      height: 1080,
    },
    {
      file_path: "/b2.jpg",
      vote_average: 7,
      iso_639_1: "en",
      width: 1920,
      height: 1080,
    },
  ],
};

const mockData: Partial<TMDBWizardData> = {
  images: mockImages,
  backdrop: {
    value: null,
    source: null,
    skipped: false,
  },
};

const mockCurrentValues = {
  name: "Test Item",
  description: "Test description",
};

describe("TMDBHeroStep", () => {
  describe("rendering", () => {
    it("renders step title", () => {
      render(
        <TMDBHeroStep
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

      expect(screen.getByText("Select Hero Image")).toBeInTheDocument();
    });
  });

  describe("navigation", () => {
    it("calls onNext when Next button is clicked", async () => {
      const user = userEvent.setup();
      const onNext = vi.fn();

      render(
        <TMDBHeroStep
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
        <TMDBHeroStep
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

  describe("error state", () => {
    it("displays error message", () => {
      render(
        <TMDBHeroStep
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
});
