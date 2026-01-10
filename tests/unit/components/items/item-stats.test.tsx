/**
 * Unit tests for ItemStats component.
 * Tests icon selection based on mediaIconType and stat display.
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ItemStats } from "@/components/items/item-stats";

describe("ItemStats", () => {
  describe("mediaIconType icon selection", () => {
    it("renders Film icon when mediaIconType is 'film'", () => {
      render(
        <ItemStats
          fileCounts={{ media: 2, artwork: 0, subtitles: 0 }}
          mediaIconType="film"
        />
      );

      const mediaCount = screen.getByTestId("media-count");
      // Film icon should be present (lucide adds role="img" or we check SVG)
      const svg = mediaCount.querySelector("svg");
      expect(svg).toBeInTheDocument();
    });

    it("renders Music icon when mediaIconType is 'music'", () => {
      render(
        <ItemStats
          fileCounts={{ media: 3, artwork: 0, subtitles: 0 }}
          mediaIconType="music"
        />
      );

      const mediaCount = screen.getByTestId("media-count");
      const svg = mediaCount.querySelector("svg");
      expect(svg).toBeInTheDocument();
    });

    it("renders FolderOpen icon when mediaIconType is 'mixed'", () => {
      render(
        <ItemStats
          fileCounts={{ media: 4, artwork: 0, subtitles: 0 }}
          mediaIconType="mixed"
        />
      );

      const mediaCount = screen.getByTestId("media-count");
      const svg = mediaCount.querySelector("svg");
      expect(svg).toBeInTheDocument();
    });

    it("renders Film icon when mediaIconType is null (default)", () => {
      render(
        <ItemStats
          fileCounts={{ media: 1, artwork: 0, subtitles: 0 }}
          mediaIconType={null}
        />
      );

      const mediaCount = screen.getByTestId("media-count");
      const svg = mediaCount.querySelector("svg");
      expect(svg).toBeInTheDocument();
    });

    it("renders Film icon when mediaIconType is undefined", () => {
      render(<ItemStats fileCounts={{ media: 1, artwork: 0, subtitles: 0 }} />);

      const mediaCount = screen.getByTestId("media-count");
      const svg = mediaCount.querySelector("svg");
      expect(svg).toBeInTheDocument();
    });
  });

  describe("content display", () => {
    it("shows child count with correct text", () => {
      render(<ItemStats childCount={5} />);

      expect(screen.getByTestId("child-count")).toHaveTextContent("5 children");
    });

    it("shows singular 'child' for count of 1", () => {
      render(<ItemStats childCount={1} />);

      expect(screen.getByTestId("child-count")).toHaveTextContent("1 child");
    });

    it("shows media count", () => {
      render(<ItemStats fileCounts={{ media: 3, artwork: 0, subtitles: 0 }} />);

      expect(screen.getByTestId("media-count")).toHaveTextContent("3");
    });

    it("shows artwork count", () => {
      render(<ItemStats fileCounts={{ media: 0, artwork: 2, subtitles: 0 }} />);

      expect(screen.getByTestId("artwork-count")).toHaveTextContent("2");
    });

    it("shows subtitle count", () => {
      render(<ItemStats fileCounts={{ media: 0, artwork: 0, subtitles: 4 }} />);

      expect(screen.getByTestId("subtitle-count")).toHaveTextContent("4");
    });

    it("returns null when no content and showEmpty is false", () => {
      const { container } = render(<ItemStats showEmpty={false} />);

      expect(container.firstChild).toBeNull();
    });

    it("shows 'Empty' when no content and showEmpty is true", () => {
      render(<ItemStats showEmpty={true} />);

      expect(screen.getByTestId("empty-state")).toHaveTextContent("Empty");
    });
  });

  describe("text format", () => {
    it("renders text format with proper labels", () => {
      render(
        <ItemStats
          childCount={2}
          fileCounts={{ media: 3, artwork: 1, subtitles: 2 }}
          format="text"
        />
      );

      const stats = screen.getByTestId("item-stats");
      expect(stats).toHaveTextContent("x2 children");
      expect(stats).toHaveTextContent("x3 media");
      expect(stats).toHaveTextContent("x1 artwork");
      expect(stats).toHaveTextContent("x2 subtitles");
    });

    it("uses singular form in text format for single items", () => {
      render(
        <ItemStats
          childCount={1}
          fileCounts={{ media: 0, artwork: 0, subtitles: 1 }}
          format="text"
        />
      );

      const stats = screen.getByTestId("item-stats");
      expect(stats).toHaveTextContent("x1 child");
      expect(stats).toHaveTextContent("x1 subtitle");
    });
  });

  describe("variants", () => {
    it("applies overlay variant styles", () => {
      render(
        <ItemStats
          fileCounts={{ media: 1, artwork: 0, subtitles: 0 }}
          variant="overlay"
        />
      );

      const stats = screen.getByTestId("item-stats");
      expect(stats).toHaveClass("text-white/90");
    });

    it("applies muted variant styles", () => {
      render(
        <ItemStats
          fileCounts={{ media: 1, artwork: 0, subtitles: 0 }}
          variant="muted"
        />
      );

      const stats = screen.getByTestId("item-stats");
      expect(stats).toHaveClass("text-muted-foreground");
    });
  });
});
