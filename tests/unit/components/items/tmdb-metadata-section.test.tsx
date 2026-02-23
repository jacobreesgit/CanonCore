/**
 * Unit tests for TmdbMetadataSection component.
 * Tests section rendering by content type and per-field actions.
 * Detach flow tests are in tmdb-source-field.test.tsx.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { TmdbMetadataSection } from "@/components/items/tmdb-metadata-section";

// Mock server actions
vi.mock("@/lib/tmdb-actions", () => ({
  clearTmdbFieldAction: vi.fn().mockResolvedValue({ success: true }),
  getImagesAction: vi.fn().mockResolvedValue({
    success: true,
    data: { posters: [], backdrops: [] },
  }),
  getSeasonImagesAction: vi
    .fn()
    .mockResolvedValue({ success: true, data: { posters: [] } }),
  getEpisodeImagesAction: vi
    .fn()
    .mockResolvedValue({ success: true, data: { stills: [] } }),
  applyMetadataAction: vi.fn().mockResolvedValue({ success: true }),
}));

describe("TmdbMetadataSection", () => {
  const movieItem = {
    id: "item-123",
    tmdbId: 155,
    tmdbType: "movie",
    tmdbPosterPath: "/poster.jpg",
    tmdbBackdropPath: "/backdrop.jpg",
    name: "The Dark Knight",
    description: "When the menace...",
  };

  const displayOptions = {
    showTagline: true,
    showMetadata: true,
    showGenres: true,
    showCast: true,
    showProviders: true,
    showVideos: true,
    showRecommendations: false,
  };

  const defaultProps = {
    item: movieItem,
    displayOptions,
    onDisplayOptionsChange: vi.fn(),
    onSettingsChange: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders poster and backdrop sections for movie", () => {
    render(<TmdbMetadataSection {...defaultProps} />);

    expect(screen.getByText("Poster")).toBeInTheDocument();
    expect(screen.getByText("Backdrop")).toBeInTheDocument();
  });

  it("renders poster but not backdrop for season", () => {
    render(
      <TmdbMetadataSection
        {...defaultProps}
        item={{ ...movieItem, tmdbType: "tv" }}
        contentType="season"
      />
    );

    expect(screen.getByText("Poster")).toBeInTheDocument();
    expect(screen.queryByText("Backdrop")).not.toBeInTheDocument();
  });

  it("renders still section for episode", () => {
    render(
      <TmdbMetadataSection
        {...defaultProps}
        item={{ ...movieItem, tmdbType: "tv" }}
        contentType="episode"
      />
    );

    expect(screen.getByText("Still")).toBeInTheDocument();
    expect(screen.queryByText("Poster")).not.toBeInTheDocument();
    expect(screen.queryByText("Backdrop")).not.toBeInTheDocument();
  });

  it("renders display options editor", () => {
    render(<TmdbMetadataSection {...defaultProps} />);

    expect(screen.getByText("Detail Page Display")).toBeInTheDocument();
  });
});
