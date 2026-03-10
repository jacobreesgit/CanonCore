import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MediaBadges } from "@/components/ui/media-badges";

describe("MediaBadges", () => {
  it("renders duration badge", () => {
    render(<MediaBadges durationMs={6120000} />);
    expect(screen.getByText("1h 42m")).toBeInTheDocument();
  });

  it("renders resolution badge", () => {
    render(<MediaBadges height={1080} />);
    expect(screen.getByText("1080p")).toBeInTheDocument();
  });

  it("renders both badges", () => {
    render(<MediaBadges durationMs={6120000} height={2160} />);
    expect(screen.getByText("1h 42m")).toBeInTheDocument();
    expect(screen.getByText("4K")).toBeInTheDocument();
  });

  it("renders nothing when no metadata", () => {
    const { container } = render(<MediaBadges />);
    expect(container.firstChild).toBeNull();
  });
});
