/**
 * Unit tests for ItemStats component.
 * Tests icon selection based on mediaIconType and stat display.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { ItemStats } from "@/components/items/item-stats";

// Mock @fortawesome/react-fontawesome with distinguishable aria-labels
// Maps FA icon names to test-friendly aria-labels
const iconNameToLabel: Record<string, string> = {
  film: "film-icon",
  music: "music-icon",
  "folder-open": "folder-open-icon",
  folder: "folder-icon",
  image: "image-icon",
  "file-lines": "file-lines-icon",
};

vi.mock("@fortawesome/react-fontawesome", () => ({
  FontAwesomeIcon: (props: {
    icon: { iconName: string };
    className?: string;
  }) => {
    const label = iconNameToLabel[props.icon.iconName] ?? props.icon.iconName;
    return <svg className={props.className ?? ""} aria-label={label} />;
  },
}));

describe("ItemStats", () => {
  describe("mediaIconType icon selection", () => {
    it("renders Film icon when mediaIconType is 'film'", () => {
      render(
        <ItemStats
          fileCounts={{ media: 2, artwork: 0, subtitles: 0 }}
          mediaIconType="film"
        />
      );

      expect(screen.getByLabelText("film-icon")).toBeInTheDocument();
    });

    it("renders Music icon when mediaIconType is 'music'", () => {
      render(
        <ItemStats
          fileCounts={{ media: 3, artwork: 0, subtitles: 0 }}
          mediaIconType="music"
        />
      );

      expect(screen.getByLabelText("music-icon")).toBeInTheDocument();
      expect(screen.queryByLabelText("film-icon")).not.toBeInTheDocument();
    });

    it("renders FolderOpen icon when mediaIconType is 'mixed'", () => {
      render(
        <ItemStats
          fileCounts={{ media: 4, artwork: 0, subtitles: 0 }}
          mediaIconType="mixed"
        />
      );

      expect(screen.getByLabelText("folder-open-icon")).toBeInTheDocument();
      expect(screen.queryByLabelText("film-icon")).not.toBeInTheDocument();
    });

    it("renders Film icon when mediaIconType is null (default)", () => {
      render(
        <ItemStats
          fileCounts={{ media: 1, artwork: 0, subtitles: 0 }}
          mediaIconType={null}
        />
      );

      expect(screen.getByLabelText("film-icon")).toBeInTheDocument();
    });

    it("renders Film icon when mediaIconType is undefined", () => {
      render(<ItemStats fileCounts={{ media: 1, artwork: 0, subtitles: 0 }} />);

      expect(screen.getByLabelText("film-icon")).toBeInTheDocument();
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

    it("shows media count next to media icon", () => {
      render(<ItemStats fileCounts={{ media: 3, artwork: 0, subtitles: 0 }} />);

      // The count "3" is next to the film icon - verify via sibling relationship
      const filmIcon = screen.getByLabelText("film-icon");
      const mediaSpan = filmIcon.closest("span")!;
      expect(within(mediaSpan).getByText("3")).toBeInTheDocument();
    });

    it("shows artwork count next to image icon", () => {
      render(<ItemStats fileCounts={{ media: 0, artwork: 2, subtitles: 0 }} />);

      const imageIcon = screen.getByLabelText("image-icon");
      const artworkSpan = imageIcon.closest("span")!;
      expect(within(artworkSpan).getByText("2")).toBeInTheDocument();
    });

    it("shows subtitle count next to file lines icon", () => {
      render(<ItemStats fileCounts={{ media: 0, artwork: 0, subtitles: 4 }} />);

      const fileTextIcon = screen.getByLabelText("file-lines-icon");
      const subtitleSpan = fileTextIcon.closest("span")!;
      expect(within(subtitleSpan).getByText("4")).toBeInTheDocument();
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
