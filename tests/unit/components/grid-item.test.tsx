/**
 * Unit tests for GridItem component.
 */

import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { GridItem } from "@/components/sortable-grid/GridItem";

describe("GridItem", () => {
  it("should render artwork when showArtwork is true and artworkId exists", () => {
    const { container } = render(
      <GridItem
        id="1"
        name="Test Item"
        artworkId="artwork-123"
        showArtwork={true}
      />
    );

    const img = container.querySelector("img");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "/api/stream/artwork-123");
  });

  it("should render folder icon when showArtwork is false even with artworkId", () => {
    const { container } = render(
      <GridItem
        id="1"
        name="Test Item"
        artworkId="artwork-123"
        showArtwork={false}
      />
    );

    expect(container.querySelector("img")).not.toBeInTheDocument();
  });

  it("should default showArtwork to true", () => {
    const { container } = render(
      <GridItem id="1" name="Test Item" artworkId="artwork-123" />
    );

    const img = container.querySelector("img");
    expect(img).toBeInTheDocument();
  });

  it("should render folder icon when no artworkId", () => {
    const { container } = render(
      <GridItem id="1" name="Test Item" showArtwork={true} />
    );

    expect(container.querySelector("img")).not.toBeInTheDocument();
  });
});
