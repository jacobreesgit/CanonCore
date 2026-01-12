/**
 * Unit tests for MetadataWizardModal component.
 * Tests wizard navigation, step content, selection state, and completion flow.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MetadataWizardModal } from "@/components/items/metadata-wizard-modal";
import type {
  CurrentTextValues,
  TextPreviewData,
} from "@/components/items/title-description-step";
import type { ExistingArtworkFile } from "@/components/items/image-selection-grid";
import type { TMDBImages } from "@/lib/tmdb-client";

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

/** Sample current values */
const mockCurrentValues: CurrentTextValues = {
  name: "Old Title",
  description: "Old description",
};

/** Sample TMDB text preview */
const mockTextPreview: TextPreviewData = {
  name: "New Movie (2024)",
  description: "A fantastic new movie about adventure and discovery.",
};

/** Sample TMDB images */
const mockImages: TMDBImages = {
  posters: [
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
  ],
  backdrops: [
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
  ],
};

/** Sample existing artwork files */
const mockExistingArtwork: ExistingArtworkFile[] = [
  { id: "file-1", filename: "custom-poster.jpg", driveFileId: "drive-abc" },
  { id: "file-2", filename: "custom-backdrop.jpg", driveFileId: "drive-def" },
];

describe("MetadataWizardModal", () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    currentValues: mockCurrentValues,
    textPreview: mockTextPreview,
    images: mockImages,
    isLoadingImages: false,
    existingArtwork: mockExistingArtwork,
    isApplying: false,
    onComplete: vi.fn(),
    onCancel: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Initial Render", () => {
    it("renders dialog when open", () => {
      render(<MetadataWizardModal {...defaultProps} />);

      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByText("Apply Metadata")).toBeInTheDocument();
    });

    it("does not render content when closed", () => {
      render(<MetadataWizardModal {...defaultProps} open={false} />);

      expect(screen.queryByText("Apply Metadata")).not.toBeInTheDocument();
    });

    it("shows step 1 by default", () => {
      render(<MetadataWizardModal {...defaultProps} />);

      expect(screen.getByText(/step 1 of 3/i)).toBeInTheDocument();
      // "Title & Description" appears twice - in header description and step heading
      expect(screen.getAllByText(/title & description/i)).toHaveLength(2);
    });

    it("shows text preview content on step 1", () => {
      render(<MetadataWizardModal {...defaultProps} />);

      expect(screen.getByText(mockTextPreview.name)).toBeInTheDocument();
      expect(
        screen.getByText(mockTextPreview.description!)
      ).toBeInTheDocument();
    });

    it("shows progress indicator", () => {
      render(<MetadataWizardModal {...defaultProps} />);

      // Three progress bar segments
      const progressSegments = document.querySelectorAll(
        ".h-1.flex-1.rounded-full"
      );
      expect(progressSegments).toHaveLength(3);
    });
  });

  describe("Navigation", () => {
    it("navigates to step 2 when clicking Next", async () => {
      const user = userEvent.setup();
      render(<MetadataWizardModal {...defaultProps} />);

      await user.click(screen.getByRole("button", { name: /next/i }));

      expect(screen.getByText(/step 2 of 3/i)).toBeInTheDocument();
      // "Select Poster" appears in header description
      expect(
        screen.getByText(/step 2 of 3:.*select poster/i)
      ).toBeInTheDocument();
    });

    it("navigates to step 3 when clicking Next twice", async () => {
      const user = userEvent.setup();
      render(<MetadataWizardModal {...defaultProps} />);

      await user.click(screen.getByRole("button", { name: /next/i }));
      await user.click(screen.getByRole("button", { name: /next/i }));

      expect(screen.getByText(/step 3 of 3/i)).toBeInTheDocument();
      // "Select Hero" appears in header description
      expect(
        screen.getByText(/step 3 of 3:.*select hero/i)
      ).toBeInTheDocument();
    });

    it("shows Back button on step 2", async () => {
      const user = userEvent.setup();
      render(<MetadataWizardModal {...defaultProps} />);

      await user.click(screen.getByRole("button", { name: /next/i }));

      expect(screen.getByRole("button", { name: /back/i })).toBeInTheDocument();
    });

    it("navigates back to step 1 from step 2", async () => {
      const user = userEvent.setup();
      render(<MetadataWizardModal {...defaultProps} />);

      await user.click(screen.getByRole("button", { name: /next/i }));
      await user.click(screen.getByRole("button", { name: /back/i }));

      expect(screen.getByText(/step 1 of 3/i)).toBeInTheDocument();
    });

    it("hides Back button on step 1", () => {
      render(<MetadataWizardModal {...defaultProps} />);

      expect(
        screen.queryByRole("button", { name: /back/i })
      ).not.toBeInTheDocument();
    });

    it("shows Apply button on final step", async () => {
      const user = userEvent.setup();
      render(<MetadataWizardModal {...defaultProps} />);

      await user.click(screen.getByRole("button", { name: /next/i }));
      await user.click(screen.getByRole("button", { name: /next/i }));

      expect(
        screen.getByRole("button", { name: /apply/i })
      ).toBeInTheDocument();
    });

    it("hides Skip All button on final step", async () => {
      const user = userEvent.setup();
      render(<MetadataWizardModal {...defaultProps} />);

      await user.click(screen.getByRole("button", { name: /next/i }));
      await user.click(screen.getByRole("button", { name: /next/i }));

      expect(
        screen.queryByRole("button", { name: /skip all/i })
      ).not.toBeInTheDocument();
    });
  });

  describe("Completion", () => {
    it("calls onComplete with selections on Apply", async () => {
      const onComplete = vi.fn();
      const user = userEvent.setup();
      render(<MetadataWizardModal {...defaultProps} onComplete={onComplete} />);

      // Navigate through all steps
      await user.click(screen.getByRole("button", { name: /next/i }));
      await user.click(screen.getByRole("button", { name: /next/i }));
      await user.click(screen.getByRole("button", { name: /apply/i }));

      expect(onComplete).toHaveBeenCalledTimes(1);
      const result = onComplete.mock.calls[0][0];

      // Should have text options
      expect(result.textOptions).toEqual({
        updateName: true,
        updateDescription: true,
      });

      // Should have pre-selected first poster and backdrop
      expect(result.posterPath).toBe("/poster1.jpg");
      expect(result.backdropPath).toBe("/backdrop1.jpg");
      expect(result.posterSkipped).toBe(false);
      expect(result.backdropSkipped).toBe(false);
    });

    it("calls onComplete with skipped flags when Skip All clicked from step 1", async () => {
      const onComplete = vi.fn();
      const user = userEvent.setup();
      render(<MetadataWizardModal {...defaultProps} onComplete={onComplete} />);

      await user.click(screen.getByRole("button", { name: /skip all/i }));

      expect(onComplete).toHaveBeenCalledTimes(1);
      const result = onComplete.mock.calls[0][0];

      expect(result.posterSkipped).toBe(true);
      expect(result.backdropSkipped).toBe(true);
    });

    it("calls onComplete with skipped backdrop when Skip All clicked from step 2", async () => {
      const onComplete = vi.fn();
      const user = userEvent.setup();
      render(<MetadataWizardModal {...defaultProps} onComplete={onComplete} />);

      await user.click(screen.getByRole("button", { name: /next/i }));
      await user.click(screen.getByRole("button", { name: /skip all/i }));

      expect(onComplete).toHaveBeenCalledTimes(1);
      const result = onComplete.mock.calls[0][0];

      // Poster should be selected (pre-selected first one)
      expect(result.posterPath).toBe("/poster1.jpg");
      expect(result.posterSkipped).toBe(false);
      // Backdrop should be skipped
      expect(result.backdropSkipped).toBe(true);
    });
  });

  describe("Cancel", () => {
    it("calls onCancel and onOpenChange when Cancel clicked", async () => {
      const onCancel = vi.fn();
      const onOpenChange = vi.fn();
      const user = userEvent.setup();
      render(
        <MetadataWizardModal
          {...defaultProps}
          onCancel={onCancel}
          onOpenChange={onOpenChange}
        />
      );

      await user.click(screen.getByRole("button", { name: /cancel/i }));

      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  describe("Loading State", () => {
    it("shows loading state when images are loading on step 2", async () => {
      const user = userEvent.setup();
      render(<MetadataWizardModal {...defaultProps} isLoadingImages={true} />);

      await user.click(screen.getByRole("button", { name: /next/i }));

      expect(screen.getByText(/loading poster options/i)).toBeInTheDocument();
    });

    it("shows loading state when images are loading on step 3", async () => {
      const user = userEvent.setup();
      render(<MetadataWizardModal {...defaultProps} isLoadingImages={true} />);

      await user.click(screen.getByRole("button", { name: /next/i }));
      await user.click(screen.getByRole("button", { name: /next/i }));

      expect(screen.getByText(/loading backdrop options/i)).toBeInTheDocument();
    });
  });

  describe("Applying State", () => {
    it("shows loading spinner when applying on final step", async () => {
      const user = userEvent.setup();
      const { rerender } = render(<MetadataWizardModal {...defaultProps} />);

      // Navigate to final step
      await user.click(screen.getByRole("button", { name: /next/i }));
      await user.click(screen.getByRole("button", { name: /next/i }));

      // Re-render with isApplying true while on final step
      rerender(<MetadataWizardModal {...defaultProps} isApplying={true} />);

      // Check for applying state
      expect(screen.getByText("Applying...")).toBeInTheDocument();
    });

    it("disables buttons when applying", () => {
      render(<MetadataWizardModal {...defaultProps} isApplying={true} />);

      expect(screen.getByRole("button", { name: /cancel/i })).toBeDisabled();
      expect(screen.getByRole("button", { name: /skip all/i })).toBeDisabled();
    });
  });

  describe("Text Options", () => {
    it("allows unchecking name update", async () => {
      const onComplete = vi.fn();
      const user = userEvent.setup();
      render(<MetadataWizardModal {...defaultProps} onComplete={onComplete} />);

      // Uncheck the name checkbox (labeled "Name" in the step)
      const nameCheckbox = screen.getByLabelText("Name");
      await user.click(nameCheckbox);

      // Navigate to end and complete
      await user.click(screen.getByRole("button", { name: /next/i }));
      await user.click(screen.getByRole("button", { name: /next/i }));
      await user.click(screen.getByRole("button", { name: /apply/i }));

      const result = onComplete.mock.calls[0][0];
      expect(result.textOptions.updateName).toBe(false);
      expect(result.textOptions.updateDescription).toBe(true);
    });

    it("allows unchecking description update", async () => {
      const onComplete = vi.fn();
      const user = userEvent.setup();
      render(<MetadataWizardModal {...defaultProps} onComplete={onComplete} />);

      // Uncheck the description checkbox (labeled "Description" in the step)
      const descCheckbox = screen.getByLabelText("Description");
      await user.click(descCheckbox);

      // Navigate to end and complete
      await user.click(screen.getByRole("button", { name: /next/i }));
      await user.click(screen.getByRole("button", { name: /next/i }));
      await user.click(screen.getByRole("button", { name: /apply/i }));

      const result = onComplete.mock.calls[0][0];
      expect(result.textOptions.updateName).toBe(true);
      expect(result.textOptions.updateDescription).toBe(false);
    });
  });

  describe("Image Pre-selection", () => {
    it("pre-selects first poster and backdrop when images provided", async () => {
      const onComplete = vi.fn();
      const user = userEvent.setup();

      // Render with images available from the start
      render(<MetadataWizardModal {...defaultProps} onComplete={onComplete} />);

      // Complete wizard without changing selections
      await user.click(screen.getByRole("button", { name: /next/i }));
      await user.click(screen.getByRole("button", { name: /next/i }));
      await user.click(screen.getByRole("button", { name: /apply/i }));

      const result = onComplete.mock.calls[0][0];
      // First images should be pre-selected
      expect(result.posterPath).toBe("/poster1.jpg");
      expect(result.backdropPath).toBe("/backdrop1.jpg");
    });
  });

  describe("Skip Functionality", () => {
    it("allows skipping poster selection", async () => {
      const onComplete = vi.fn();
      const user = userEvent.setup();
      render(<MetadataWizardModal {...defaultProps} onComplete={onComplete} />);

      // Go to poster step
      await user.click(screen.getByRole("button", { name: /next/i }));

      // Check skip poster
      const skipCheckbox = screen.getByRole("checkbox", {
        name: /skip poster/i,
      });
      await user.click(skipCheckbox);

      // Complete wizard
      await user.click(screen.getByRole("button", { name: /next/i }));
      await user.click(screen.getByRole("button", { name: /apply/i }));

      const result = onComplete.mock.calls[0][0];
      expect(result.posterSkipped).toBe(true);
    });

    it("allows skipping hero/backdrop selection", async () => {
      const onComplete = vi.fn();
      const user = userEvent.setup();
      render(<MetadataWizardModal {...defaultProps} onComplete={onComplete} />);

      // Go to hero step
      await user.click(screen.getByRole("button", { name: /next/i }));
      await user.click(screen.getByRole("button", { name: /next/i }));

      // Check skip backdrop (labeled "Skip backdrop selection" in ImageSelectionGrid)
      const skipCheckbox = screen.getByRole("checkbox", {
        name: /skip backdrop/i,
      });
      await user.click(skipCheckbox);

      // Complete wizard
      await user.click(screen.getByRole("button", { name: /apply/i }));

      const result = onComplete.mock.calls[0][0];
      expect(result.backdropSkipped).toBe(true);
    });
  });

  describe("Empty Images", () => {
    it("handles no posters gracefully", async () => {
      const user = userEvent.setup();
      const emptyImages: TMDBImages = {
        posters: [],
        backdrops: mockImages.backdrops,
      };
      render(<MetadataWizardModal {...defaultProps} images={emptyImages} />);

      await user.click(screen.getByRole("button", { name: /next/i }));

      expect(
        screen.getByText(/no images available from tmdb/i)
      ).toBeInTheDocument();
    });

    it("handles no backdrops gracefully", async () => {
      const user = userEvent.setup();
      const emptyImages: TMDBImages = {
        posters: mockImages.posters,
        backdrops: [],
      };
      render(<MetadataWizardModal {...defaultProps} images={emptyImages} />);

      await user.click(screen.getByRole("button", { name: /next/i }));
      await user.click(screen.getByRole("button", { name: /next/i }));

      expect(
        screen.getByText(/no images available from tmdb/i)
      ).toBeInTheDocument();
    });

    it("handles null images gracefully", async () => {
      const user = userEvent.setup();
      render(<MetadataWizardModal {...defaultProps} images={null} />);

      await user.click(screen.getByRole("button", { name: /next/i }));

      expect(
        screen.getByText(/no images available from tmdb/i)
      ).toBeInTheDocument();
    });
  });
});
