/**
 * Unit tests for the TMDB wizard summary step component.
 * Tests rendering, apply action, and edit navigation.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TMDBSummaryStep } from "@/components/items/wizards/tmdb-wizard/summary-step";
import type { TMDBWizardData } from "@/components/items/wizards/tmdb-wizard";

const mockData: Partial<TMDBWizardData> = {
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
    description: "A test movie description from TMDB",
  },
  textOptions: {
    updateName: true,
    updateDescription: true,
  },
  poster: {
    value: "/selected-poster.jpg",
    source: "tmdb",
    skipped: false,
  },
  backdrop: {
    value: "/selected-backdrop.jpg",
    source: "tmdb",
    skipped: false,
  },
  images: {
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
  },
};

const mockCurrentValues = {
  name: "Old Name",
  description: "Old description",
};

describe("TMDBSummaryStep", () => {
  describe("rendering", () => {
    it("renders step title", () => {
      render(
        <TMDBSummaryStep
          data={mockData}
          currentValues={mockCurrentValues}
          isLoading={false}
          error={null}
          canGoBack={true}
          onNext={vi.fn()}
          onBack={vi.fn()}
          onDataChange={vi.fn()}
          onLoadingChange={vi.fn()}
          onError={vi.fn()}
          onEditStep={vi.fn()}
          onApply={vi.fn()}
        />
      );

      expect(screen.getByText("Review Changes")).toBeInTheDocument();
    });

    it("displays name change preview", () => {
      render(
        <TMDBSummaryStep
          data={mockData}
          currentValues={mockCurrentValues}
          isLoading={false}
          error={null}
          canGoBack={true}
          onNext={vi.fn()}
          onBack={vi.fn()}
          onDataChange={vi.fn()}
          onLoadingChange={vi.fn()}
          onError={vi.fn()}
          onEditStep={vi.fn()}
          onApply={vi.fn()}
        />
      );

      // Text is split across nodes, use a regex matcher
      expect(screen.getByText(/Test Movie \(2024\)/)).toBeInTheDocument();
    });

    it("shows poster selection summary", () => {
      render(
        <TMDBSummaryStep
          data={mockData}
          currentValues={mockCurrentValues}
          isLoading={false}
          error={null}
          canGoBack={true}
          onNext={vi.fn()}
          onBack={vi.fn()}
          onDataChange={vi.fn()}
          onLoadingChange={vi.fn()}
          onError={vi.fn()}
          onEditStep={vi.fn()}
          onApply={vi.fn()}
        />
      );

      expect(screen.getByText(/poster/i)).toBeInTheDocument();
    });

    it("shows hero selection summary", () => {
      render(
        <TMDBSummaryStep
          data={mockData}
          currentValues={mockCurrentValues}
          isLoading={false}
          error={null}
          canGoBack={true}
          onNext={vi.fn()}
          onBack={vi.fn()}
          onDataChange={vi.fn()}
          onLoadingChange={vi.fn()}
          onError={vi.fn()}
          onEditStep={vi.fn()}
          onApply={vi.fn()}
        />
      );

      expect(screen.getByText(/hero/i)).toBeInTheDocument();
    });
  });

  describe("navigation", () => {
    it("renders Apply button", () => {
      render(
        <TMDBSummaryStep
          data={mockData}
          currentValues={mockCurrentValues}
          isLoading={false}
          error={null}
          canGoBack={true}
          onNext={vi.fn()}
          onBack={vi.fn()}
          onDataChange={vi.fn()}
          onLoadingChange={vi.fn()}
          onError={vi.fn()}
          onEditStep={vi.fn()}
          onApply={vi.fn()}
        />
      );

      expect(
        screen.getByRole("button", { name: /apply/i })
      ).toBeInTheDocument();
    });

    it("renders Back button", () => {
      render(
        <TMDBSummaryStep
          data={mockData}
          currentValues={mockCurrentValues}
          isLoading={false}
          error={null}
          canGoBack={true}
          onNext={vi.fn()}
          onBack={vi.fn()}
          onDataChange={vi.fn()}
          onLoadingChange={vi.fn()}
          onError={vi.fn()}
          onEditStep={vi.fn()}
          onApply={vi.fn()}
        />
      );

      expect(screen.getByRole("button", { name: /back/i })).toBeInTheDocument();
    });

    it("calls onApply when Apply button is clicked", async () => {
      const user = userEvent.setup();
      const onApply = vi.fn();

      render(
        <TMDBSummaryStep
          data={mockData}
          currentValues={mockCurrentValues}
          isLoading={false}
          error={null}
          canGoBack={true}
          onNext={vi.fn()}
          onBack={vi.fn()}
          onDataChange={vi.fn()}
          onLoadingChange={vi.fn()}
          onError={vi.fn()}
          onEditStep={vi.fn()}
          onApply={onApply}
        />
      );

      await user.click(screen.getByRole("button", { name: /apply/i }));

      expect(onApply).toHaveBeenCalled();
    });

    it("calls onBack when Back button is clicked", async () => {
      const user = userEvent.setup();
      const onBack = vi.fn();

      render(
        <TMDBSummaryStep
          data={mockData}
          currentValues={mockCurrentValues}
          isLoading={false}
          error={null}
          canGoBack={true}
          onNext={vi.fn()}
          onBack={onBack}
          onDataChange={vi.fn()}
          onLoadingChange={vi.fn()}
          onError={vi.fn()}
          onEditStep={vi.fn()}
          onApply={vi.fn()}
        />
      );

      await user.click(screen.getByRole("button", { name: /back/i }));

      expect(onBack).toHaveBeenCalled();
    });
  });

  describe("skipped values", () => {
    it("shows skipped indicator for poster when skipped", () => {
      const skippedData: Partial<TMDBWizardData> = {
        ...mockData,
        poster: {
          value: null,
          source: null,
          skipped: true,
        },
      };

      render(
        <TMDBSummaryStep
          data={skippedData}
          currentValues={mockCurrentValues}
          isLoading={false}
          error={null}
          canGoBack={true}
          onNext={vi.fn()}
          onBack={vi.fn()}
          onDataChange={vi.fn()}
          onLoadingChange={vi.fn()}
          onError={vi.fn()}
          onEditStep={vi.fn()}
          onApply={vi.fn()}
        />
      );

      expect(screen.getByText(/skipped/i)).toBeInTheDocument();
    });
  });

  describe("loading state", () => {
    it("disables Apply button when loading", () => {
      render(
        <TMDBSummaryStep
          data={mockData}
          currentValues={mockCurrentValues}
          isLoading={true}
          error={null}
          canGoBack={true}
          onNext={vi.fn()}
          onBack={vi.fn()}
          onDataChange={vi.fn()}
          onLoadingChange={vi.fn()}
          onError={vi.fn()}
          onEditStep={vi.fn()}
          onApply={vi.fn()}
        />
      );

      expect(screen.getByRole("button", { name: /apply/i })).toBeDisabled();
    });
  });

  describe("error state", () => {
    it("displays error message", () => {
      render(
        <TMDBSummaryStep
          data={mockData}
          currentValues={mockCurrentValues}
          isLoading={false}
          error="Failed to apply metadata"
          canGoBack={true}
          onNext={vi.fn()}
          onBack={vi.fn()}
          onDataChange={vi.fn()}
          onLoadingChange={vi.fn()}
          onError={vi.fn()}
          onEditStep={vi.fn()}
          onApply={vi.fn()}
        />
      );

      expect(screen.getByText("Failed to apply metadata")).toBeInTheDocument();
    });
  });
});
