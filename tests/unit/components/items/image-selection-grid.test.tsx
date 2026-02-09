/**
 * Unit tests for ImageSelectionGrid component.
 * Tests TMDB image gallery, existing files, selection states, and skip functionality.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  ImageSelectionGrid,
  type ExistingArtworkFile,
} from "@/components/items/wizards/tmdb-wizard/image-selection-grid";
import type { TMDBImage } from "@/lib/tmdb-client";

// Mock useIsMobile hook - default to desktop (false)
vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: vi.fn(() => false),
}));

// Mock next/image
vi.mock("next/image", () => ({
  default: ({
    src,
    alt,
    onError,
    ...props
  }: {
    src: string;
    alt: string;
    onError?: () => void;
    [key: string]: unknown;
  }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} onError={onError} data-testid="image" {...props} />
  ),
}));

// Mock tmdb-client
vi.mock("@/lib/tmdb-client", () => ({
  getPosterUrl: (path: string, size: string) =>
    `https://image.tmdb.org/t/p/${size}${path}`,
  getBackdropUrl: (path: string, size: string) =>
    `https://image.tmdb.org/t/p/${size}${path}`,
}));

/** Sample TMDB poster images */
const mockPosters: TMDBImage[] = [
  {
    file_path: "/poster1.jpg",
    vote_average: 8.5,
    iso_639_1: "en",
    width: 500,
    height: 750,
  },
  {
    file_path: "/poster2.jpg",
    vote_average: 7.0,
    iso_639_1: null,
    width: 500,
    height: 750,
  },
  {
    file_path: "/poster3.jpg",
    vote_average: 6.0,
    iso_639_1: "de",
    width: 342,
    height: 513,
  },
];

/** Sample TMDB backdrop images */
const mockBackdrops: TMDBImage[] = [
  {
    file_path: "/backdrop1.jpg",
    vote_average: 9.0,
    iso_639_1: null,
    width: 1920,
    height: 1080,
  },
  {
    file_path: "/backdrop2.jpg",
    vote_average: 7.5,
    iso_639_1: "en",
    width: 1280,
    height: 720,
  },
];

/** Sample existing artwork files */
const mockExistingFiles: ExistingArtworkFile[] = [
  {
    id: "file-1",
    filename: "custom-poster.jpg",
    driveFileId: "drive-abc123",
  },
  {
    id: "file-2",
    filename: "my-artwork.png",
    driveFileId: "drive-def456",
  },
];

describe("ImageSelectionGrid", () => {
  const defaultProps = {
    type: "poster" as const,
    tmdbImages: mockPosters,
    existingFiles: [],
    selectedValue: null,
    onSelect: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Basic Rendering", () => {
    it("renders TMDB tab with image count", () => {
      render(<ImageSelectionGrid {...defaultProps} />);

      expect(
        screen.getByRole("tab", { name: /from tmdb/i })
      ).toBeInTheDocument();
      expect(screen.getByText("3")).toBeInTheDocument(); // 3 posters
    });

    it("renders My Uploads tab disabled when no existing files", () => {
      render(<ImageSelectionGrid {...defaultProps} />);

      const uploadsTab = screen.getByRole("tab", { name: /my uploads/i });
      expect(uploadsTab).toBeDisabled();
    });

    it("renders My Uploads tab enabled with file count", () => {
      render(
        <ImageSelectionGrid
          {...defaultProps}
          existingFiles={mockExistingFiles}
        />
      );

      const uploadsTab = screen.getByRole("tab", { name: /my uploads/i });
      expect(uploadsTab).not.toBeDisabled();
      expect(screen.getByText("2")).toBeInTheDocument(); // 2 existing files
    });

    it("shows empty state when no TMDB images", () => {
      render(<ImageSelectionGrid {...defaultProps} tmdbImages={[]} />);

      expect(
        screen.getByText("No images available from TMDB")
      ).toBeInTheDocument();
    });

    it("renders image thumbnails with dimension badges", () => {
      render(<ImageSelectionGrid {...defaultProps} />);

      // Two posters have 500x750 dimensions
      expect(screen.getAllByText("500x750")).toHaveLength(2);
      expect(screen.getByText("342x513")).toBeInTheDocument();
    });

    it("marks textless images with badge", () => {
      render(<ImageSelectionGrid {...defaultProps} />);

      // poster2 has iso_639_1: null (textless)
      expect(screen.getByText("Textless")).toBeInTheDocument();
    });
  });

  describe("Tab Switching", () => {
    it("switches to My Uploads tab", async () => {
      const user = userEvent.setup();
      render(
        <ImageSelectionGrid
          {...defaultProps}
          existingFiles={mockExistingFiles}
        />
      );

      await user.click(screen.getByRole("tab", { name: /my uploads/i }));

      expect(screen.getByText("custom-poster.jpg")).toBeInTheDocument();
      expect(screen.getByText("my-artwork.png")).toBeInTheDocument();
    });

    it("shows empty state for uploads tab when empty", () => {
      render(
        <ImageSelectionGrid
          {...defaultProps}
          existingFiles={[]}
          tmdbImages={[
            {
              file_path: "/p.jpg",
              vote_average: 5,
              iso_639_1: null,
              width: 500,
              height: 750,
            },
          ]}
        />
      );

      // Tab is disabled when no files, so we can't click it
      expect(screen.getByRole("tab", { name: /my uploads/i })).toBeDisabled();
    });
  });

  describe("Image Selection", () => {
    it("calls onSelect when clicking a TMDB image", async () => {
      const onSelect = vi.fn();
      const user = userEvent.setup();
      render(<ImageSelectionGrid {...defaultProps} onSelect={onSelect} />);

      // Click the first poster
      const buttons = screen.getAllByRole("button");
      const imageButton = buttons.find((b) =>
        b.querySelector('img[src*="poster1"]')
      );
      await user.click(imageButton!);

      expect(onSelect).toHaveBeenCalledWith("/poster1.jpg", "tmdb");
    });

    it("calls onSelect when clicking an existing file", async () => {
      const onSelect = vi.fn();
      const user = userEvent.setup();
      render(
        <ImageSelectionGrid
          {...defaultProps}
          existingFiles={mockExistingFiles}
          onSelect={onSelect}
        />
      );

      // Switch to uploads tab
      await user.click(screen.getByRole("tab", { name: /my uploads/i }));

      // Click the first existing file
      const buttons = screen.getAllByRole("button");
      const fileButton = buttons.find((b) =>
        b.textContent?.includes("custom-poster.jpg")
      );
      await user.click(fileButton!);

      expect(onSelect).toHaveBeenCalledWith("file-1", "existing");
    });

    it("deselects when clicking already selected image", async () => {
      const onSelect = vi.fn();
      const user = userEvent.setup();
      render(
        <ImageSelectionGrid
          {...defaultProps}
          selectedValue="/poster1.jpg"
          onSelect={onSelect}
        />
      );

      // Click the already selected poster
      const buttons = screen.getAllByRole("button");
      const imageButton = buttons.find((b) =>
        b.querySelector('img[src*="poster1"]')
      );
      await user.click(imageButton!);

      expect(onSelect).toHaveBeenCalledWith(null, "tmdb");
    });

    it("shows selection checkmark on selected image", () => {
      render(
        <ImageSelectionGrid {...defaultProps} selectedValue="/poster1.jpg" />
      );

      // Check icon should be visible for the selected image
      const selectedButton = screen
        .getAllByRole("button")
        .find((b) => b.className.includes("ring-amber-500"));
      expect(selectedButton).toBeInTheDocument();
    });
  });

  describe("Skip Functionality", () => {
    it("renders skip checkbox when onSkipChange provided", () => {
      render(<ImageSelectionGrid {...defaultProps} onSkipChange={vi.fn()} />);

      expect(
        screen.getByLabelText(/skip poster selection/i)
      ).toBeInTheDocument();
    });

    it("does not render skip checkbox when onSkipChange not provided", () => {
      render(<ImageSelectionGrid {...defaultProps} />);

      expect(
        screen.queryByLabelText(/skip poster selection/i)
      ).not.toBeInTheDocument();
    });

    it("calls onSkipChange when checkbox toggled", async () => {
      const onSkipChange = vi.fn();
      const user = userEvent.setup();
      render(
        <ImageSelectionGrid {...defaultProps} onSkipChange={onSkipChange} />
      );

      await user.click(screen.getByLabelText(/skip poster selection/i));

      expect(onSkipChange).toHaveBeenCalledWith(true);
    });

    it("disables image selection when skipped", async () => {
      const onSelect = vi.fn();
      const user = userEvent.setup();
      render(
        <ImageSelectionGrid
          {...defaultProps}
          isSkipped={true}
          onSelect={onSelect}
        />
      );

      // Try to click an image
      const buttons = screen.getAllByRole("button");
      const imageButton = buttons.find((b) =>
        b.querySelector('img[src*="poster1"]')
      );

      if (imageButton) {
        await user.click(imageButton);
      }

      // Selection should not change when skipped
      expect(onSelect).not.toHaveBeenCalled();
    });

    it("applies reduced opacity when skipped", () => {
      render(<ImageSelectionGrid {...defaultProps} isSkipped={true} />);

      const buttons = screen.getAllByRole("button");
      const imageButton = buttons.find((b) =>
        b.querySelector('img[src*="poster1"]')
      );
      expect(imageButton).toHaveClass("opacity-40");
    });
  });

  describe("Show More Functionality", () => {
    it("shows limited images by default", () => {
      const manyPosters: TMDBImage[] = Array.from({ length: 20 }, (_, i) => ({
        file_path: `/poster${i}.jpg`,
        vote_average: 5,
        iso_639_1: null,
        width: 500,
        height: 750,
      }));

      render(
        <ImageSelectionGrid
          {...defaultProps}
          tmdbImages={manyPosters}
          initialLimit={12}
        />
      );

      // Should show "Show 8 more images" button (20 - 12 = 8)
      expect(screen.getByText("Show 8 more images")).toBeInTheDocument();
    });

    it("shows all images after clicking show more", async () => {
      const manyPosters: TMDBImage[] = Array.from({ length: 15 }, (_, i) => ({
        file_path: `/poster${i}.jpg`,
        vote_average: 5,
        iso_639_1: null,
        width: 500,
        height: 750,
      }));

      const user = userEvent.setup();
      render(
        <ImageSelectionGrid
          {...defaultProps}
          tmdbImages={manyPosters}
          initialLimit={10}
        />
      );

      await user.click(screen.getByText("Show 5 more images"));

      // Button should disappear after clicking
      expect(screen.queryByText(/show.*more images/i)).not.toBeInTheDocument();
    });

    it("does not show more button when all images fit", () => {
      render(<ImageSelectionGrid {...defaultProps} initialLimit={12} />);

      // Only 3 posters, so no "show more" button
      expect(screen.queryByText(/show.*more images/i)).not.toBeInTheDocument();
    });
  });

  describe("Backdrop Type", () => {
    it("renders backdrop grid with correct aspect ratio class", () => {
      render(
        <ImageSelectionGrid
          {...defaultProps}
          type="backdrop"
          tmdbImages={mockBackdrops}
        />
      );

      // Backdrop should use aspect-video class
      const buttons = screen.getAllByRole("button");
      const imageButton = buttons.find((b) =>
        b.querySelector('img[src*="backdrop1"]')
      );
      expect(imageButton).toHaveClass("aspect-video");
    });

    it("shows backdrop dimensions in badge", () => {
      render(
        <ImageSelectionGrid
          {...defaultProps}
          type="backdrop"
          tmdbImages={mockBackdrops}
        />
      );

      expect(screen.getByText("1920x1080")).toBeInTheDocument();
      expect(screen.getByText("1280x720")).toBeInTheDocument();
    });
  });

  describe("Disabled State", () => {
    it("disables all interactions when disabled", async () => {
      const onSelect = vi.fn();
      const user = userEvent.setup();
      render(
        <ImageSelectionGrid
          {...defaultProps}
          disabled={true}
          onSelect={onSelect}
        />
      );

      // Try clicking an image
      const buttons = screen.getAllByRole("button");
      const imageButton = buttons.find((b) =>
        b.querySelector('img[src*="poster1"]')
      );

      if (imageButton) {
        await user.click(imageButton);
      }

      expect(onSelect).not.toHaveBeenCalled();
    });

    it("disables tabs when disabled", () => {
      render(<ImageSelectionGrid {...defaultProps} disabled={true} />);

      expect(screen.getByRole("tab", { name: /from tmdb/i })).toBeDisabled();
    });

    it("disables skip checkbox when disabled", () => {
      render(
        <ImageSelectionGrid
          {...defaultProps}
          disabled={true}
          onSkipChange={vi.fn()}
        />
      );

      const checkbox = screen.getByRole("checkbox");
      expect(checkbox).toBeDisabled();
    });
  });

  describe("Existing File Thumbnails", () => {
    it("streams images from artwork API", async () => {
      const user = userEvent.setup();
      render(
        <ImageSelectionGrid
          {...defaultProps}
          existingFiles={mockExistingFiles}
        />
      );

      await user.click(screen.getByRole("tab", { name: /my uploads/i }));

      const images = screen.getAllByTestId("image");
      const existingImage = images.find((img) =>
        (img as HTMLImageElement).src.includes("/api/artwork/")
      );
      expect(existingImage).toBeInTheDocument();
    });

    it("shows filename on existing file thumbnails", async () => {
      const user = userEvent.setup();
      render(
        <ImageSelectionGrid
          {...defaultProps}
          existingFiles={mockExistingFiles}
        />
      );

      await user.click(screen.getByRole("tab", { name: /my uploads/i }));

      expect(screen.getByText("custom-poster.jpg")).toBeInTheDocument();
      expect(screen.getByText("my-artwork.png")).toBeInTheDocument();
    });
  });
});
