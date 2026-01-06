/**
 * Unit tests for GridItem component.
 * Tests artwork display, connection badges, file counts, and accessibility.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { GridItem } from "@/components/sortable-grid/GridItem";

describe("GridItem", () => {
  describe("artwork display", () => {
    it("should render hidden img for error detection when artworkId provided", () => {
      const { container } = render(
        <GridItem id="1" name="Test Item" artworkId="artwork-123" showArtwork />
      );

      const img = container.querySelector("img");
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute("src", "/api/artwork/artwork-123");
      expect(img).toHaveClass("hidden");
    });

    it("should show artwork background when artworkId provided", () => {
      const { container } = render(
        <GridItem id="1" name="Test Item" artworkId="artwork-123" showArtwork />
      );

      const element = container.firstChild as HTMLElement;
      // Browser normalizes to include quotes around URL
      expect(element.style.backgroundImage).toContain(
        "/api/artwork/artwork-123"
      );
    });

    it("should show fallback when image fails to load", () => {
      const { container } = render(
        <GridItem id="1" name="Test Item" artworkId="artwork-123" showArtwork />
      );

      // Simulate image error
      const img = container.querySelector("img");
      fireEvent.error(img!);

      // After error, fallback should show and background should be removed
      const fallback = document.querySelector('[class*="bg-gradient-to-br"]');
      expect(fallback).toBeInTheDocument();

      const element = container.firstChild as HTMLElement;
      expect(element.style.backgroundImage).toBe("");
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

  describe("connection badge", () => {
    it("should render connection badge when connectionName provided", () => {
      render(
        <GridItem id="1" name="Test Item" connectionName="My SFTP Server" />
      );

      expect(screen.getByText("My SFTP Server")).toBeInTheDocument();
    });

    it("should not render badge when connectionName is null", () => {
      render(<GridItem id="1" name="Test Item" connectionName={null} />);

      expect(screen.queryByText(/server/i)).not.toBeInTheDocument();
    });

    it("should not render badge when connectionName is undefined", () => {
      render(<GridItem id="1" name="Test Item" />);

      // Only the name should be present
      expect(screen.getByText("Test Item")).toBeInTheDocument();
    });
  });

  describe("showConnectionBadge prop", () => {
    it("should show connection badge by default when connectionName provided", () => {
      render(<GridItem id="1" name="Test Item" connectionName="Server" />);
      expect(screen.getByText("Server")).toBeInTheDocument();
    });

    it("should show connection badge when showConnectionBadge is true", () => {
      render(
        <GridItem
          id="1"
          name="Test Item"
          connectionName="Server"
          showConnectionBadge
        />
      );
      expect(screen.getByText("Server")).toBeInTheDocument();
    });

    it("should hide connection badge when showConnectionBadge is false", () => {
      render(
        <GridItem
          id="1"
          name="Test Item"
          connectionName="Server"
          showConnectionBadge={false}
        />
      );
      expect(screen.queryByText("Server")).not.toBeInTheDocument();
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

    it("should include connection name in aria-label", () => {
      render(
        <GridItem id="1" name="My Folder" connectionName="Remote Server" />
      );

      expect(screen.getByRole("button")).toHaveAttribute(
        "aria-label",
        "My Folder, synced from Remote Server"
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
});
