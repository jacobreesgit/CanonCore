/**
 * Unit tests for GridItem component.
 * Tests artwork display, file counts, and accessibility.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { GridItem } from "@/components/sortable-grid/GridItem";

describe("GridItem", () => {
  describe("artwork display", () => {
    it("should render img element when artworkId provided", () => {
      const { container } = render(
        <GridItem id="1" name="Test Item" artworkId="artwork-123" showArtwork />
      );

      const img = container.querySelector("img");
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute("src", "/api/artwork/artwork-123");
    });

    it("should show img with correct src when artworkId provided", () => {
      const { container } = render(
        <GridItem id="1" name="Test Item" artworkId="artwork-123" showArtwork />
      );

      const img = container.querySelector("img");
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute("src", "/api/artwork/artwork-123");
      // Image starts with opacity-0, transitions to opacity-100 on load
      expect(img).toHaveClass("opacity-0");
    });

    it("should show fallback when image fails to load", () => {
      const { container } = render(
        <GridItem id="1" name="Test Item" artworkId="artwork-123" showArtwork />
      );

      // Simulate image error
      const img = container.querySelector("img");
      fireEvent.error(img!);

      // After error, fallback should show (folder icon) and img should be gone
      const fallback = container.querySelector('[class*="bg-gradient-to-br"]');
      expect(fallback).toBeInTheDocument();

      // Image should no longer be rendered after error
      const imgAfterError = container.querySelector("img");
      expect(imgAfterError).not.toBeInTheDocument();
    });

    it("should show fallback when showArtwork is false", () => {
      const { container } = render(
        <GridItem
          id="1"
          name="Test Item"
          artworkId="artwork-123"
          showArtwork={false}
        />
      );

      const fallback = document.querySelector('[class*="bg-gradient-to-br"]');
      expect(fallback).toBeInTheDocument();

      // Should not render hidden img
      expect(container.querySelector("img")).not.toBeInTheDocument();
    });

    it("should show fallback when no artworkId", () => {
      const { container } = render(
        <GridItem id="1" name="Test Item" showArtwork />
      );

      const fallback = document.querySelector('[class*="bg-gradient-to-br"]');
      expect(fallback).toBeInTheDocument();

      // Should not render hidden img
      expect(container.querySelector("img")).not.toBeInTheDocument();
    });
  });

  describe("file counts", () => {
    it("should render media count when fileCounts.media > 0", () => {
      render(
        <GridItem
          id="1"
          name="Test Item"
          fileCounts={{ media: 5, artwork: 0, subtitles: 0 }}
        />
      );

      const mediaCount = screen.getByTestId("media-count");
      expect(mediaCount).toBeInTheDocument();
      expect(mediaCount).toHaveTextContent("5");
    });

    it("should render artwork count when fileCounts.artwork > 0", () => {
      render(
        <GridItem
          id="1"
          name="Test Item"
          fileCounts={{ media: 0, artwork: 3, subtitles: 0 }}
        />
      );

      const artworkCount = screen.getByTestId("artwork-count");
      expect(artworkCount).toBeInTheDocument();
      expect(artworkCount).toHaveTextContent("3");
    });

    it("should render subtitle count when fileCounts.subtitles > 0", () => {
      render(
        <GridItem
          id="1"
          name="Test Item"
          fileCounts={{ media: 0, artwork: 0, subtitles: 2 }}
        />
      );

      const subtitleCount = screen.getByTestId("subtitle-count");
      expect(subtitleCount).toBeInTheDocument();
      expect(subtitleCount).toHaveTextContent("2");
    });

    it("should render all counts when all > 0", () => {
      render(
        <GridItem
          id="1"
          name="Test Item"
          fileCounts={{ media: 4, artwork: 2, subtitles: 1 }}
        />
      );

      expect(screen.getByTestId("media-count")).toHaveTextContent("4");
      expect(screen.getByTestId("artwork-count")).toHaveTextContent("2");
      expect(screen.getByTestId("subtitle-count")).toHaveTextContent("1");
    });

    it("should not render zero counts", () => {
      render(
        <GridItem
          id="1"
          name="Test Item"
          fileCounts={{ media: 0, artwork: 0, subtitles: 0 }}
        />
      );

      expect(screen.queryByTestId("media-count")).not.toBeInTheDocument();
      expect(screen.queryByTestId("artwork-count")).not.toBeInTheDocument();
      expect(screen.queryByTestId("subtitle-count")).not.toBeInTheDocument();
    });
  });

  describe("child count", () => {
    it("should render child count when childCount > 0", () => {
      render(<GridItem id="1" name="Test Item" childCount={7} />);

      const childCount = screen.getByTestId("child-count");
      expect(childCount).toBeInTheDocument();
      expect(childCount).toHaveTextContent("7");
    });

    it("should not render child count when childCount is 0", () => {
      render(<GridItem id="1" name="Test Item" childCount={0} />);

      expect(screen.queryByTestId("child-count")).not.toBeInTheDocument();
    });

    it("should not render child count when undefined", () => {
      render(<GridItem id="1" name="Test Item" />);

      expect(screen.queryByTestId("child-count")).not.toBeInTheDocument();
    });
  });

  describe("showCounts prop", () => {
    it("should show stats section by default", () => {
      render(
        <GridItem
          id="1"
          name="Test Item"
          fileCounts={{ media: 1, artwork: 0, subtitles: 0 }}
        />
      );

      expect(screen.getByTestId("grid-item-stats")).toBeInTheDocument();
    });

    it("should hide stats section when showCounts is false", () => {
      render(
        <GridItem
          id="1"
          name="Test Item"
          fileCounts={{ media: 1, artwork: 0, subtitles: 0 }}
          showCounts={false}
        />
      );

      expect(screen.queryByTestId("grid-item-stats")).not.toBeInTheDocument();
    });
  });

  describe("empty state", () => {
    it("should show 'Empty' when no files and no children", () => {
      render(
        <GridItem
          id="1"
          name="Test Item"
          fileCounts={{ media: 0, artwork: 0, subtitles: 0 }}
          childCount={0}
        />
      );

      expect(screen.getByTestId("empty-state")).toHaveTextContent("Empty");
    });

    it("should show 'Empty' when fileCounts is undefined", () => {
      render(<GridItem id="1" name="Test Item" />);

      expect(screen.getByTestId("empty-state")).toHaveTextContent("Empty");
    });

    it("should not show 'Empty' when has content", () => {
      render(<GridItem id="1" name="Test Item" childCount={1} />);

      expect(screen.queryByTestId("empty-state")).not.toBeInTheDocument();
    });
  });

  describe("accessibility", () => {
    it("should have role button", () => {
      render(<GridItem id="1" name="Test Item" />);

      expect(screen.getByRole("button")).toBeInTheDocument();
    });

    it("should have aria-label with name", () => {
      render(<GridItem id="1" name="My Folder" />);

      expect(screen.getByRole("button")).toHaveAttribute(
        "aria-label",
        "My Folder"
      );
    });

    it("should be focusable", () => {
      render(<GridItem id="1" name="Test Item" />);

      const element = screen.getByRole("button");
      expect(element).toHaveAttribute("tabIndex", "0");
    });

    it("should trigger onClick on Enter key", () => {
      const handleClick = vi.fn();
      render(<GridItem id="1" name="Test Item" onClick={handleClick} />);

      const element = screen.getByRole("button");
      fireEvent.keyDown(element, { key: "Enter" });

      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("should trigger onClick on Space key", () => {
      const handleClick = vi.fn();
      render(<GridItem id="1" name="Test Item" onClick={handleClick} />);

      const element = screen.getByRole("button");
      fireEvent.keyDown(element, { key: " " });

      expect(handleClick).toHaveBeenCalledTimes(1);
    });
  });

  describe("description", () => {
    it("should render description when provided and showDescription is true", () => {
      render(
        <GridItem
          id="1"
          name="Test Item"
          description="This is a test description"
          showDescription
        />
      );

      expect(
        screen.getByText("This is a test description")
      ).toBeInTheDocument();
    });

    it("should not render description when showDescription is false", () => {
      render(
        <GridItem
          id="1"
          name="Test Item"
          description="This is a test description"
          showDescription={false}
        />
      );

      expect(
        screen.queryByText("This is a test description")
      ).not.toBeInTheDocument();
    });

    it("should not render description when null", () => {
      render(
        <GridItem id="1" name="Test Item" description={null} showDescription />
      );

      // Only name should be present in the content area
      const content = document.querySelector(".z-20 p");
      expect(content).not.toBeInTheDocument();
    });
  });

  describe("sync status", () => {
    it("should not show sync icon when status is SYNCED", () => {
      render(<GridItem id="1" name="Test" syncStatus="SYNCED" />);
      // SyncIcon only renders for non-SYNCED states (line 189-191 of GridItem.tsx)
      // When SYNCED, no SyncIcon is rendered
      const syncContainer = document.querySelector(".flex-shrink-0");
      // The flex-shrink-0 class is on the SyncIcon, which shouldn't be present
      expect(syncContainer).toBeNull();
    });

    it("should show sync icon when status is PENDING", () => {
      render(<GridItem id="1" name="Test" syncStatus="PENDING" />);
      // SyncIcon renders a Circle with size-2 for PENDING
      const pendingIcon = document.querySelector('[class*="size-2"]');
      expect(pendingIcon).toBeInTheDocument();
    });

    it("should show sync icon when status is ERROR", () => {
      render(
        <GridItem
          id="1"
          name="Test"
          syncStatus="ERROR"
          syncError="Sync failed"
        />
      );
      // SyncIcon renders with destructive color for ERROR
      const errorIcon = document.querySelector('[class*="text-destructive"]');
      expect(errorIcon).toBeInTheDocument();
    });

    it("should show sync icon when status is SYNCING", () => {
      render(<GridItem id="1" name="Test" syncStatus="SYNCING" />);
      // SyncIcon renders with animate-spin for SYNCING
      const animatedElement = document.querySelector('[class*="animate-spin"]');
      expect(animatedElement).toBeInTheDocument();
    });
  });

  describe("drag handle", () => {
    it("should show drag handle when handleProps provided", () => {
      const handleProps = { onPointerDown: vi.fn() };
      render(<GridItem id="1" name="Test" handleProps={handleProps} />);
      expect(screen.getByLabelText("Drag handle")).toBeInTheDocument();
    });

    it("should not show drag handle when handleProps not provided", () => {
      render(<GridItem id="1" name="Test" />);
      expect(screen.queryByLabelText("Drag handle")).not.toBeInTheDocument();
    });

    it("should apply handleProps to drag handle button", () => {
      const handleProps = { onPointerDown: vi.fn(), "data-test": "handle" };
      render(<GridItem id="1" name="Test" handleProps={handleProps} />);
      const handle = screen.getByLabelText("Drag handle");
      expect(handle).toHaveAttribute("data-test", "handle");
    });
  });

  describe("primary media", () => {
    it("should show primary media name when provided and not in edit mode", () => {
      render(<GridItem id="1" name="Test" primaryMediaName="movie.mkv" />);
      expect(screen.getByText("movie.mkv")).toBeInTheDocument();
    });

    it("should hide primary media name in edit mode (when handleProps present)", () => {
      const handleProps = { onPointerDown: vi.fn() };
      render(
        <GridItem
          id="1"
          name="Test"
          primaryMediaName="movie.mkv"
          handleProps={handleProps}
        />
      );
      expect(screen.queryByText("movie.mkv")).not.toBeInTheDocument();
    });

    it("should show play icon with primary media name", () => {
      render(<GridItem id="1" name="Test" primaryMediaName="movie.mkv" />);
      // Play icon is rendered with the primary media name
      const mediaContainer = screen.getByText("movie.mkv").closest("span");
      expect(mediaContainer).toBeInTheDocument();
    });
  });

  describe("drag states", () => {
    it("should apply isDragging styles", () => {
      const { container } = render(<GridItem id="1" name="Test" isDragging />);
      const element = container.firstChild;
      expect(element).toHaveClass("opacity-40");
      expect(element).toHaveClass("scale-[0.98]");
    });

    it("should apply isOverlay styles", () => {
      const { container } = render(<GridItem id="1" name="Test" isOverlay />);
      const element = container.firstChild;
      expect(element).toHaveClass("shadow-2xl");
      expect(element).toHaveClass("scale-[1.03]");
    });

    it("should not apply drag styles when not dragging", () => {
      const { container } = render(<GridItem id="1" name="Test" />);
      const element = container.firstChild;
      expect(element).not.toHaveClass("opacity-40");
      expect(element).not.toHaveClass("shadow-2xl");
    });
  });
});
