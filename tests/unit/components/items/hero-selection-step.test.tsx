/**
 * Unit tests for HeroSelectionStep component.
 * Tests both default mode (ImageSelectionGrid) and upload mode (dropzone + thumbnails).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HeroSelectionStep } from "@/components/items/wizards/tmdb-wizard/hero-selection-step";
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

describe("HeroSelectionStep", () => {
  const defaultProps = {
    backdrops: mockBackdrops,
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
    it("renders ImageSelectionGrid with backdrops", () => {
      render(<HeroSelectionStep {...defaultProps} />);

      // TMDB tab should be visible
      expect(
        screen.getByRole("tab", { name: /from tmdb/i })
      ).toBeInTheDocument();
    });

    it("passes skip props to ImageSelectionGrid", () => {
      render(<HeroSelectionStep {...defaultProps} />);

      expect(
        screen.getByLabelText(/skip (hero|backdrop) selection/i)
      ).toBeInTheDocument();
    });

    it("calls onSelect when backdrop is selected", async () => {
      const onSelect = vi.fn();
      const user = userEvent.setup();
      render(<HeroSelectionStep {...defaultProps} onSelect={onSelect} />);

      // Click a backdrop
      const buttons = screen.getAllByRole("button");
      const imageButton = buttons.find((b) =>
        b.querySelector('img[src*="backdrop1"]')
      );
      await user.click(imageButton!);

      expect(onSelect).toHaveBeenCalledWith("/backdrop1.jpg", "tmdb");
    });
  });

  describe("Upload Mode", () => {
    const uploadModeProps = {
      ...defaultProps,
      uploadMode: true,
      queuedHero: [],
      onQueueHeroChange: vi.fn(),
      hasDriveConnection: true,
    };

    it("renders tabs with TMDB and My Uploads", () => {
      render(<HeroSelectionStep {...uploadModeProps} />);

      // Get all tabs and check that we have our upload mode tabs
      const tmdbTabs = screen.getAllByRole("tab", { name: /from tmdb/i });
      const uploadTabs = screen.getAllByRole("tab", { name: /my uploads/i });
      expect(tmdbTabs.length).toBeGreaterThanOrEqual(1);
      expect(uploadTabs.length).toBeGreaterThanOrEqual(1);
    });

    it("My Uploads tab is always enabled in upload mode", () => {
      render(<HeroSelectionStep {...uploadModeProps} />);

      const uploadsTab = screen.getAllByRole("tab", { name: /my uploads/i })[0];
      expect(uploadsTab).not.toBeDisabled();
    });

    it("shows Drive connection required message when no connection", async () => {
      const user = userEvent.setup();
      render(
        <HeroSelectionStep {...uploadModeProps} hasDriveConnection={false} />
      );

      await user.click(screen.getAllByRole("tab", { name: /my uploads/i })[0]);

      expect(
        screen.getByText(/connect google drive in settings/i)
      ).toBeInTheDocument();
    });

    it("shows dropzone when Drive connected", async () => {
      const user = userEvent.setup();
      render(<HeroSelectionStep {...uploadModeProps} />);

      await user.click(screen.getAllByRole("tab", { name: /my uploads/i })[0]);

      expect(
        screen.getByText(/drop hero images or click to browse/i)
      ).toBeInTheDocument();
    });

    it("shows empty state when no files queued", async () => {
      const user = userEvent.setup();
      render(<HeroSelectionStep {...uploadModeProps} />);

      await user.click(screen.getAllByRole("tab", { name: /my uploads/i })[0]);

      expect(screen.getByText(/no files uploaded yet/i)).toBeInTheDocument();
    });

    it("shows queued files count in tab badge", () => {
      const queuedFiles = [
        createMockQueuedFile("file-1", "hero1.jpg"),
        createMockQueuedFile("file-2", "hero2.jpg"),
      ];

      render(
        <HeroSelectionStep {...uploadModeProps} queuedHero={queuedFiles} />
      );

      // Check that there is a tab with "2" badge (queued files count)
      const uploadsTabs = screen.getAllByRole("tab", { name: /my uploads/i });
      const outerTab = uploadsTabs[0];
      expect(outerTab).toHaveTextContent("2");
    });

    it("shows queued file thumbnails with 16:9 aspect ratio", async () => {
      const user = userEvent.setup();
      const queuedFiles = [createMockQueuedFile("file-1", "hero1.jpg")];

      render(
        <HeroSelectionStep {...uploadModeProps} queuedHero={queuedFiles} />
      );

      await user.click(screen.getAllByRole("tab", { name: /my uploads/i })[0]);

      // Find thumbnail with aspect-video class (16:9)
      const thumbnailButton = screen
        .getAllByRole("button")
        .find((b) => b.className.includes("aspect-video"));
      expect(thumbnailButton).toBeInTheDocument();
    });

    it("shows total file size", async () => {
      const user = userEvent.setup();
      const queuedFiles = [
        createMockQueuedFile("file-1", "hero1.jpg", 1024 * 1024), // 1 MB
      ];

      render(
        <HeroSelectionStep {...uploadModeProps} queuedHero={queuedFiles} />
      );

      await user.click(screen.getAllByRole("tab", { name: /my uploads/i })[0]);

      expect(screen.getByText("1 MB")).toBeInTheDocument();
    });

    it("shows queued count with hint text", async () => {
      const user = userEvent.setup();
      const queuedFiles = [createMockQueuedFile("file-1", "hero1.jpg")];

      render(
        <HeroSelectionStep {...uploadModeProps} queuedHero={queuedFiles} />
      );

      await user.click(screen.getAllByRole("tab", { name: /my uploads/i })[0]);

      expect(screen.getByText(/1 file queued/i)).toBeInTheDocument();
      expect(screen.getByText(/click to select/i)).toBeInTheDocument();
    });

    it("calls onSelect when clicking a queued file thumbnail", async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      const queuedFiles = [createMockQueuedFile("file-1", "hero1.jpg")];

      render(
        <HeroSelectionStep
          {...uploadModeProps}
          queuedHero={queuedFiles}
          onSelect={onSelect}
        />
      );

      await user.click(screen.getAllByRole("tab", { name: /my uploads/i })[0]);

      // Find and click the thumbnail button
      const thumbnailButton = screen
        .getAllByRole("button")
        .find((b) => b.className.includes("aspect-video"));
      await user.click(thumbnailButton!);

      expect(onSelect).toHaveBeenCalledWith("file-1", "queued");
    });

    it("calls onSelect with null when clicking already selected file", async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      const queuedFiles = [createMockQueuedFile("file-1", "hero1.jpg")];

      render(
        <HeroSelectionStep
          {...uploadModeProps}
          queuedHero={queuedFiles}
          selectedValue="file-1"
          selectedSource="queued"
          onSelect={onSelect}
        />
      );

      await user.click(screen.getAllByRole("tab", { name: /my uploads/i })[0]);

      // Find and click the selected thumbnail
      const thumbnailButton = screen
        .getAllByRole("button")
        .find((b) => b.className.includes("aspect-video"));
      await user.click(thumbnailButton!);

      expect(onSelect).toHaveBeenCalledWith(null, "queued");
    });

    it("shows remove button on hover", async () => {
      const user = userEvent.setup();
      const queuedFiles = [createMockQueuedFile("file-1", "hero1.jpg")];

      render(
        <HeroSelectionStep {...uploadModeProps} queuedHero={queuedFiles} />
      );

      await user.click(screen.getAllByRole("tab", { name: /my uploads/i })[0]);

      // Remove button has aria-label
      expect(screen.getByLabelText(/remove hero1.jpg/i)).toBeInTheDocument();
    });

    it("calls onQueueHeroChange when removing a file", async () => {
      const user = userEvent.setup();
      const onQueueHeroChange = vi.fn();
      const queuedFiles = [
        createMockQueuedFile("file-1", "hero1.jpg"),
        createMockQueuedFile("file-2", "hero2.jpg"),
      ];

      render(
        <HeroSelectionStep
          {...uploadModeProps}
          queuedHero={queuedFiles}
          onQueueHeroChange={onQueueHeroChange}
        />
      );

      await user.click(screen.getAllByRole("tab", { name: /my uploads/i })[0]);
      await user.click(screen.getByLabelText(/remove hero1.jpg/i));

      expect(onQueueHeroChange).toHaveBeenCalledWith([queuedFiles[1]]);
    });

    it("selects next file when selected file is removed", async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      const onQueueHeroChange = vi.fn();
      const queuedFiles = [
        createMockQueuedFile("file-1", "hero1.jpg"),
        createMockQueuedFile("file-2", "hero2.jpg"),
      ];

      render(
        <HeroSelectionStep
          {...uploadModeProps}
          queuedHero={queuedFiles}
          selectedValue="file-1"
          selectedSource="queued"
          onSelect={onSelect}
          onQueueHeroChange={onQueueHeroChange}
        />
      );

      await user.click(screen.getAllByRole("tab", { name: /my uploads/i })[0]);
      await user.click(screen.getByLabelText(/remove hero1.jpg/i));

      // Should select the next available file
      expect(onSelect).toHaveBeenCalledWith("file-2", "queued");
    });

    it("clears selection when last file is removed", async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      const onQueueHeroChange = vi.fn();
      const queuedFiles = [createMockQueuedFile("file-1", "hero1.jpg")];

      render(
        <HeroSelectionStep
          {...uploadModeProps}
          queuedHero={queuedFiles}
          selectedValue="file-1"
          selectedSource="queued"
          onSelect={onSelect}
          onQueueHeroChange={onQueueHeroChange}
        />
      );

      await user.click(screen.getAllByRole("tab", { name: /my uploads/i })[0]);
      await user.click(screen.getByLabelText(/remove hero1.jpg/i));

      expect(onSelect).toHaveBeenCalledWith(null, "queued");
    });

    it("shows selection checkmark on selected queued file", async () => {
      const user = userEvent.setup();
      const queuedFiles = [createMockQueuedFile("file-1", "hero1.jpg")];

      render(
        <HeroSelectionStep
          {...uploadModeProps}
          queuedHero={queuedFiles}
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
      const queuedFiles = [createMockQueuedFile("file-1", "hero1.jpg")];

      render(
        <HeroSelectionStep
          {...uploadModeProps}
          queuedHero={queuedFiles}
          isSkipped={true}
          onSelect={onSelect}
        />
      );

      await user.click(screen.getAllByRole("tab", { name: /my uploads/i })[0]);

      // Try to click the thumbnail - should not call onSelect
      const thumbnailButton = screen
        .getAllByRole("button")
        .find((b) => b.className.includes("aspect-video"));
      if (thumbnailButton) {
        await user.click(thumbnailButton);
      }

      expect(onSelect).not.toHaveBeenCalled();
    });

    it("shows skip checkbox", () => {
      render(<HeroSelectionStep {...uploadModeProps} />);

      expect(screen.getByLabelText(/skip hero selection/i)).toBeInTheDocument();
    });
  });

  describe("Skip Functionality", () => {
    it("calls onSkipChange when checkbox toggled in upload mode", async () => {
      const user = userEvent.setup();
      const onSkipChange = vi.fn();

      render(
        <HeroSelectionStep
          {...defaultProps}
          uploadMode={true}
          queuedHero={[]}
          onQueueHeroChange={vi.fn()}
          hasDriveConnection={true}
          onSkipChange={onSkipChange}
        />
      );

      await user.click(screen.getByLabelText(/skip hero selection/i));

      expect(onSkipChange).toHaveBeenCalledWith(true);
    });

    it("applies opacity to thumbnails when skipped", async () => {
      const user = userEvent.setup();
      const queuedFiles = [createMockQueuedFile("file-1", "hero1.jpg")];

      render(
        <HeroSelectionStep
          {...defaultProps}
          uploadMode={true}
          queuedHero={queuedFiles}
          onQueueHeroChange={vi.fn()}
          hasDriveConnection={true}
          isSkipped={true}
        />
      );

      await user.click(screen.getAllByRole("tab", { name: /my uploads/i })[0]);

      const thumbnailButton = screen
        .getAllByRole("button")
        .find((b) => b.className.includes("aspect-video"));
      expect(thumbnailButton).toHaveClass("opacity-40");
    });
  });

  describe("Aspect Ratio", () => {
    it("uses 16:9 aspect ratio for hero thumbnails", async () => {
      const user = userEvent.setup();
      const queuedFiles = [createMockQueuedFile("file-1", "hero1.jpg")];

      render(
        <HeroSelectionStep
          {...defaultProps}
          uploadMode={true}
          queuedHero={queuedFiles}
          onQueueHeroChange={vi.fn()}
          hasDriveConnection={true}
        />
      );

      await user.click(screen.getAllByRole("tab", { name: /my uploads/i })[0]);

      // Hero thumbnails should have aspect-video class (16:9)
      const thumbnailButton = screen
        .getAllByRole("button")
        .find((b) => b.className.includes("aspect-video"));
      expect(thumbnailButton).toBeInTheDocument();
    });

    it("uses 2-column grid for hero thumbnails", async () => {
      const user = userEvent.setup();
      const queuedFiles = [
        createMockQueuedFile("file-1", "hero1.jpg"),
        createMockQueuedFile("file-2", "hero2.jpg"),
      ];

      render(
        <HeroSelectionStep
          {...defaultProps}
          uploadMode={true}
          queuedHero={queuedFiles}
          onQueueHeroChange={vi.fn()}
          hasDriveConnection={true}
        />
      );

      await user.click(screen.getAllByRole("tab", { name: /my uploads/i })[0]);

      // Grid should have grid-cols-2 class
      const grid = document.querySelector(".grid-cols-2");
      expect(grid).toBeInTheDocument();
    });
  });
});
