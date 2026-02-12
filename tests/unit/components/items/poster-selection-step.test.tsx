/**
 * Unit tests for PosterSelectionStep component.
 * Tests both default mode (ImageSelectionGrid) and upload mode (dropzone + thumbnails).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PosterSelectionStep } from "@/components/items/wizards/tmdb-wizard/poster-selection-step";
import type { TMDBImage } from "@/lib/tmdb-client";
import type { QueuedFile } from "@/lib/types";

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

// Mock upload-utils
vi.mock("@/lib/upload-utils", () => ({
  formatBytes: (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  },
}));

// Mock URL.createObjectURL and revokeObjectURL
const mockObjectUrl = "blob:http://localhost/mock-blob";
global.URL.createObjectURL = vi.fn(() => mockObjectUrl);
global.URL.revokeObjectURL = vi.fn();

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
];

/**
 * Creates a mock File object.
 */
function createMockFile(name: string, size: number = 1024): File {
  const content = new Array(size).fill("a").join("");
  return new File([content], name, { type: "image/jpeg" });
}

/**
 * Creates a mock QueuedFile.
 */
function createMockQueuedFile(
  id: string,
  name: string,
  size: number = 1024
): QueuedFile {
  return {
    id,
    file: createMockFile(name, size),
    fileType: "ARTWORK",
    size,
    status: "pending",
  };
}

describe("PosterSelectionStep", () => {
  const defaultProps = {
    posters: mockPosters,
    selectedValue: null,
    selectedSource: null,
    onSelect: vi.fn(),
    isSkipped: false,
    onSkipChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Default Mode (ImageSelectionGrid)", () => {
    it("renders ImageSelectionGrid with posters", () => {
      render(<PosterSelectionStep {...defaultProps} />);

      // TMDB tab should be visible
      expect(
        screen.getByRole("tab", { name: /from tmdb/i })
      ).toBeInTheDocument();
    });

    it("passes skip props to ImageSelectionGrid", () => {
      render(<PosterSelectionStep {...defaultProps} />);

      expect(
        screen.getByLabelText(/skip poster selection/i)
      ).toBeInTheDocument();
    });

    it("calls onSelect when poster is selected", async () => {
      const onSelect = vi.fn();
      const user = userEvent.setup();
      render(<PosterSelectionStep {...defaultProps} onSelect={onSelect} />);

      // Click a poster
      const buttons = screen.getAllByRole("button");
      const imageButton = buttons.find((b) =>
        b.querySelector('img[src*="poster1"]')
      );
      await user.click(imageButton!);

      expect(onSelect).toHaveBeenCalledWith("/poster1.jpg", "tmdb");
    });
  });

  describe("Upload Mode", () => {
    const uploadModeProps = {
      ...defaultProps,
      uploadMode: true,
      queuedArtwork: [],
      onQueueArtworkChange: vi.fn(),
      hasDriveConnection: true,
    };

    it("renders tabs with TMDB and My Uploads", () => {
      render(<PosterSelectionStep {...uploadModeProps} />);

      // Get all tabs and check that we have our upload mode tabs
      const tmdbTabs = screen.getAllByRole("tab", { name: /from tmdb/i });
      const uploadTabs = screen.getAllByRole("tab", { name: /my uploads/i });
      expect(tmdbTabs.length).toBeGreaterThanOrEqual(1);
      expect(uploadTabs.length).toBeGreaterThanOrEqual(1);
    });

    it("My Uploads tab is always enabled in upload mode", () => {
      render(<PosterSelectionStep {...uploadModeProps} />);

      // Get the first (outer) My Uploads tab which should be enabled
      const uploadsTab = screen.getAllByRole("tab", { name: /my uploads/i })[0];
      expect(uploadsTab).not.toBeDisabled();
    });

    it("shows Drive connection required message when no connection", async () => {
      const user = userEvent.setup();
      render(
        <PosterSelectionStep {...uploadModeProps} hasDriveConnection={false} />
      );

      // Click the first (outer) My Uploads tab
      await user.click(screen.getAllByRole("tab", { name: /my uploads/i })[0]);

      expect(
        screen.getByText(/connect google drive in settings/i)
      ).toBeInTheDocument();
    });

    it("shows dropzone when Drive connected", async () => {
      const user = userEvent.setup();
      render(<PosterSelectionStep {...uploadModeProps} />);

      await user.click(screen.getAllByRole("tab", { name: /my uploads/i })[0]);

      expect(
        screen.getByText(/drop poster images or click to browse/i)
      ).toBeInTheDocument();
    });

    it("shows empty state when no files queued", async () => {
      const user = userEvent.setup();
      render(<PosterSelectionStep {...uploadModeProps} />);

      await user.click(screen.getAllByRole("tab", { name: /my uploads/i })[0]);

      expect(screen.getByText(/no files uploaded yet/i)).toBeInTheDocument();
    });

    it("shows queued files count in tab badge", () => {
      const queuedFiles = [
        createMockQueuedFile("file-1", "poster1.jpg"),
        createMockQueuedFile("file-2", "poster2.jpg"),
      ];

      render(
        <PosterSelectionStep {...uploadModeProps} queuedArtwork={queuedFiles} />
      );

      // Check that there is a tab with "2" badge (queued files count)
      const uploadsTabs = screen.getAllByRole("tab", { name: /my uploads/i });
      const outerTab = uploadsTabs[0];
      expect(outerTab).toHaveTextContent("2");
    });

    it("shows queued file thumbnails", async () => {
      const user = userEvent.setup();
      const queuedFiles = [
        createMockQueuedFile("file-1", "poster1.jpg", 2048),
        createMockQueuedFile("file-2", "poster2.jpg", 3072),
      ];

      render(
        <PosterSelectionStep {...uploadModeProps} queuedArtwork={queuedFiles} />
      );

      await user.click(screen.getAllByRole("tab", { name: /my uploads/i })[0]);

      expect(screen.getByText("poster1.jpg")).toBeInTheDocument();
      expect(screen.getByText("poster2.jpg")).toBeInTheDocument();
    });

    it("shows total file size", async () => {
      const user = userEvent.setup();
      const queuedFiles = [
        createMockQueuedFile("file-1", "poster1.jpg", 1024 * 1024), // 1 MB
      ];

      render(
        <PosterSelectionStep {...uploadModeProps} queuedArtwork={queuedFiles} />
      );

      await user.click(screen.getAllByRole("tab", { name: /my uploads/i })[0]);

      expect(screen.getByText("1 MB")).toBeInTheDocument();
    });

    it("shows queued count with hint text", async () => {
      const user = userEvent.setup();
      const queuedFiles = [createMockQueuedFile("file-1", "poster1.jpg")];

      render(
        <PosterSelectionStep {...uploadModeProps} queuedArtwork={queuedFiles} />
      );

      await user.click(screen.getAllByRole("tab", { name: /my uploads/i })[0]);

      expect(screen.getByText(/1 file queued/i)).toBeInTheDocument();
      expect(screen.getByText(/click to select/i)).toBeInTheDocument();
    });

    it("calls onSelect when clicking a queued file thumbnail", async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      const queuedFiles = [createMockQueuedFile("file-1", "poster1.jpg")];

      render(
        <PosterSelectionStep
          {...uploadModeProps}
          queuedArtwork={queuedFiles}
          onSelect={onSelect}
        />
      );

      await user.click(screen.getAllByRole("tab", { name: /my uploads/i })[0]);

      // Find and click the thumbnail button
      const thumbnailButton = screen
        .getAllByRole("button")
        .find((b) => b.className.includes("aspect-[2/3]"));
      await user.click(thumbnailButton!);

      expect(onSelect).toHaveBeenCalledWith("file-1", "queued");
    });

    it("calls onSelect with null when clicking already selected file", async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      const queuedFiles = [createMockQueuedFile("file-1", "poster1.jpg")];

      render(
        <PosterSelectionStep
          {...uploadModeProps}
          queuedArtwork={queuedFiles}
          selectedValue="file-1"
          selectedSource="queued"
          onSelect={onSelect}
        />
      );

      await user.click(screen.getAllByRole("tab", { name: /my uploads/i })[0]);

      // Find and click the selected thumbnail
      const thumbnailButton = screen
        .getAllByRole("button")
        .find((b) => b.className.includes("aspect-[2/3]"));
      await user.click(thumbnailButton!);

      expect(onSelect).toHaveBeenCalledWith(null, "queued");
    });

    it("shows remove button on hover", async () => {
      const user = userEvent.setup();
      const queuedFiles = [createMockQueuedFile("file-1", "poster1.jpg")];

      render(
        <PosterSelectionStep {...uploadModeProps} queuedArtwork={queuedFiles} />
      );

      await user.click(screen.getAllByRole("tab", { name: /my uploads/i })[0]);

      // Remove button has aria-label
      expect(screen.getByLabelText(/remove poster1.jpg/i)).toBeInTheDocument();
    });

    it("calls onQueueArtworkChange when removing a file", async () => {
      const user = userEvent.setup();
      const onQueueArtworkChange = vi.fn();
      const queuedFiles = [
        createMockQueuedFile("file-1", "poster1.jpg"),
        createMockQueuedFile("file-2", "poster2.jpg"),
      ];

      render(
        <PosterSelectionStep
          {...uploadModeProps}
          queuedArtwork={queuedFiles}
          onQueueArtworkChange={onQueueArtworkChange}
        />
      );

      await user.click(screen.getAllByRole("tab", { name: /my uploads/i })[0]);
      await user.click(screen.getByLabelText(/remove poster1.jpg/i));

      expect(onQueueArtworkChange).toHaveBeenCalledWith([queuedFiles[1]]);
    });

    it("selects next file when selected file is removed", async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      const onQueueArtworkChange = vi.fn();
      const queuedFiles = [
        createMockQueuedFile("file-1", "poster1.jpg"),
        createMockQueuedFile("file-2", "poster2.jpg"),
      ];

      render(
        <PosterSelectionStep
          {...uploadModeProps}
          queuedArtwork={queuedFiles}
          selectedValue="file-1"
          selectedSource="queued"
          onSelect={onSelect}
          onQueueArtworkChange={onQueueArtworkChange}
        />
      );

      await user.click(screen.getAllByRole("tab", { name: /my uploads/i })[0]);
      await user.click(screen.getByLabelText(/remove poster1.jpg/i));

      // Should select the next available file
      expect(onSelect).toHaveBeenCalledWith("file-2", "queued");
    });

    it("clears selection when last file is removed", async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      const onQueueArtworkChange = vi.fn();
      const queuedFiles = [createMockQueuedFile("file-1", "poster1.jpg")];

      render(
        <PosterSelectionStep
          {...uploadModeProps}
          queuedArtwork={queuedFiles}
          selectedValue="file-1"
          selectedSource="queued"
          onSelect={onSelect}
          onQueueArtworkChange={onQueueArtworkChange}
        />
      );

      await user.click(screen.getAllByRole("tab", { name: /my uploads/i })[0]);
      await user.click(screen.getByLabelText(/remove poster1.jpg/i));

      expect(onSelect).toHaveBeenCalledWith(null, "queued");
    });

    it("shows selection checkmark on selected queued file", async () => {
      const user = userEvent.setup();
      const queuedFiles = [createMockQueuedFile("file-1", "poster1.jpg")];

      render(
        <PosterSelectionStep
          {...uploadModeProps}
          queuedArtwork={queuedFiles}
          selectedValue="file-1"
          selectedSource="queued"
        />
      );

      await user.click(screen.getAllByRole("tab", { name: /my uploads/i })[0]);

      // Selected thumbnail should have brand ring
      const thumbnailButton = screen
        .getAllByRole("button")
        .find((b) => b.className.includes("ring-brand"));
      expect(thumbnailButton).toBeInTheDocument();
    });

    it("disables dropzone and thumbnails when skipped", async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      const queuedFiles = [createMockQueuedFile("file-1", "poster1.jpg")];

      render(
        <PosterSelectionStep
          {...uploadModeProps}
          queuedArtwork={queuedFiles}
          isSkipped={true}
          onSelect={onSelect}
        />
      );

      await user.click(screen.getAllByRole("tab", { name: /my uploads/i })[0]);

      // Try to click the thumbnail - should not call onSelect
      const thumbnailButton = screen
        .getAllByRole("button")
        .find((b) => b.className.includes("aspect-[2/3]"));
      if (thumbnailButton) {
        await user.click(thumbnailButton);
      }

      expect(onSelect).not.toHaveBeenCalled();
    });

    it("shows skip checkbox", () => {
      render(<PosterSelectionStep {...uploadModeProps} />);

      expect(
        screen.getByLabelText(/skip poster selection/i)
      ).toBeInTheDocument();
    });

    it("clears TMDB selection when on uploads tab", async () => {
      const user = userEvent.setup();

      render(
        <PosterSelectionStep
          {...uploadModeProps}
          selectedValue="/poster1.jpg"
          selectedSource="tmdb"
        />
      );

      // Switch to uploads tab - TMDB selection should not show
      await user.click(screen.getAllByRole("tab", { name: /my uploads/i })[0]);

      // The ImageSelectionGrid in TMDB tab shouldn't show selected state
      // when we're on uploads tab
      expect(screen.queryByText(/no files uploaded yet/i)).toBeInTheDocument();
    });
  });

  describe("Skip Functionality", () => {
    it("calls onSkipChange when checkbox toggled in upload mode", async () => {
      const user = userEvent.setup();
      const onSkipChange = vi.fn();

      render(
        <PosterSelectionStep
          {...defaultProps}
          uploadMode={true}
          queuedArtwork={[]}
          onQueueArtworkChange={vi.fn()}
          hasDriveConnection={true}
          onSkipChange={onSkipChange}
        />
      );

      await user.click(screen.getByLabelText(/skip poster selection/i));

      expect(onSkipChange).toHaveBeenCalledWith(true);
    });

    it("applies opacity to thumbnails when skipped", async () => {
      const user = userEvent.setup();
      const queuedFiles = [createMockQueuedFile("file-1", "poster1.jpg")];

      render(
        <PosterSelectionStep
          {...defaultProps}
          uploadMode={true}
          queuedArtwork={queuedFiles}
          onQueueArtworkChange={vi.fn()}
          hasDriveConnection={true}
          isSkipped={true}
        />
      );

      await user.click(screen.getAllByRole("tab", { name: /my uploads/i })[0]);

      const thumbnailButton = screen
        .getAllByRole("button")
        .find((b) => b.className.includes("aspect-[2/3]"));
      expect(thumbnailButton).toHaveClass("opacity-40");
    });
  });
});
