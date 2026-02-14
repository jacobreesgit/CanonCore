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
      const { container } = render(
        <ItemStats
          fileCounts={{ media: 2, artwork: 0, subtitles: 0 }}
          mediaIconType="film"
        />
      );

      // Media stat span has an SVG icon
      const svg = container.querySelector("svg");
      expect(svg).toBeInTheDocument();
    });

    it("renders Music icon when mediaIconType is 'music'", () => {
      const { container } = render(
        <ItemStats
          fileCounts={{ media: 3, artwork: 0, subtitles: 0 }}
          mediaIconType="music"
        />
      );

      const svg = container.querySelector("svg");
      expect(svg).toBeInTheDocument();
    });

    it("renders FolderOpen icon when mediaIconType is 'mixed'", () => {
      const { container } = render(
        <ItemStats
          fileCounts={{ media: 4, artwork: 0, subtitles: 0 }}
          mediaIconType="mixed"
        />
      );

      const svg = container.querySelector("svg");
      expect(svg).toBeInTheDocument();
    });

    it("renders Film icon when mediaIconType is null (default)", () => {
      const { container } = render(
        <ItemStats
          fileCounts={{ media: 1, artwork: 0, subtitles: 0 }}
          mediaIconType={null}
        />
      );

      const svg = container.querySelector("svg");
      expect(svg).toBeInTheDocument();
    });

    it("renders Film icon when mediaIconType is undefined", () => {
      const { container } = render(
        <ItemStats fileCounts={{ media: 1, artwork: 0, subtitles: 0 }} />
      );

      const svg = container.querySelector("svg");
      expect(svg).toBeInTheDocument();
    });
  });

  describe("content display", () => {
    it("shows child count with correct text", () => {
      render(<ItemStats childCount={5} />);

      expect(screen.getByText("5 children")).toBeInTheDocument();
    });

    it("shows singular 'child' for count of 1", () => {
      render(<ItemStats childCount={1} />);

      expect(screen.getByText("1 child")).toBeInTheDocument();
    });

    it("shows media count", () => {
      render(<ItemStats fileCounts={{ media: 3, artwork: 0, subtitles: 0 }} />);

      expect(screen.getByText("3")).toBeInTheDocument();
    });

    it("shows artwork count", () => {
      render(<ItemStats fileCounts={{ media: 0, artwork: 2, subtitles: 0 }} />);

      expect(screen.getByText("2")).toBeInTheDocument();
    });

    it("shows subtitle count", () => {
      render(<ItemStats fileCounts={{ media: 0, artwork: 0, subtitles: 4 }} />);

      expect(screen.getByText("4")).toBeInTheDocument();
    });

    it("returns null when no content and showEmpty is false", () => {
      const { container } = render(<ItemStats showEmpty={false} />);

      expect(container.firstChild).toBeNull();
    });

    it("shows 'Empty' when no content and showEmpty is true", () => {
      render(<ItemStats showEmpty={true} />);

      expect(screen.getByText("Empty")).toBeInTheDocument();
    });
  });

  describe("text format", () => {
    it("renders text format with proper labels", () => {
      const { container } = render(
        <ItemStats
          childCount={2}
          fileCounts={{ media: 3, artwork: 1, subtitles: 2 }}
          format="text"
        />
      );

      const stats = container.firstChild as HTMLElement;
      expect(stats).toHaveTextContent("x2 children");
      expect(stats).toHaveTextContent("x3 media");
      expect(stats).toHaveTextContent("x1 artwork");
      expect(stats).toHaveTextContent("x2 subtitles");
    });

    it("uses singular form in text format for single items", () => {
      const { container } = render(
        <ItemStats
          childCount={1}
          fileCounts={{ media: 0, artwork: 0, subtitles: 1 }}
          format="text"
        />
      );

      const stats = container.firstChild as HTMLElement;
      expect(stats).toHaveTextContent("x1 child");
      expect(stats).toHaveTextContent("x1 subtitle");
    });
  });

  describe("variants", () => {
    it("applies overlay variant styles", () => {
      const { container } = render(
        <ItemStats
          fileCounts={{ media: 1, artwork: 0, subtitles: 0 }}
          variant="overlay"
        />
      );

      const stats = container.firstChild as HTMLElement;
      expect(stats).toHaveClass("text-white/90");
    });

    it("applies muted variant styles", () => {
      const { container } = render(
        <ItemStats
          fileCounts={{ media: 1, artwork: 0, subtitles: 0 }}
          variant="muted"
        />
      );

      const stats = container.firstChild as HTMLElement;
      expect(stats).toHaveClass("text-muted-foreground");
    });
  });
});
