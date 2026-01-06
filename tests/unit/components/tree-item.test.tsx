/**
 * Unit tests for TreeItem component.
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TreeItem } from "@/components/sortable-tree/components/TreeItem/TreeItem";

describe("TreeItem", () => {
  const defaultProps = {
    id: "1",
    value: "Test Item",
    depth: 0,
    indentationWidth: 20,
  };

  it("should render artwork when showArtwork is true and artworkId exists", () => {
    const { container } = render(
      <TreeItem {...defaultProps} artworkId="artwork-123" showArtwork={true} />
    );

    const img = container.querySelector("img");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "/api/artwork/artwork-123");
  });

  it("should render folder icon when showArtwork is false", () => {
    const { container } = render(
      <TreeItem {...defaultProps} artworkId="artwork-123" showArtwork={false} />
    );

    const img = container.querySelector("img");
    expect(img).not.toBeInTheDocument();
  });

  it("should hide drag handle when showDragHandle is false", () => {
    render(<TreeItem {...defaultProps} showDragHandle={false} />);

    const dragHandle = screen.queryByRole("button", { name: "Drag handle" });
    expect(dragHandle).not.toBeInTheDocument();
  });

  it("should show drag handle by default", () => {
    render(<TreeItem {...defaultProps} />);

    const dragHandle = screen.getByRole("button", { name: "Drag handle" });
    expect(dragHandle).toBeInTheDocument();
  });

  describe("showConnectionBadge prop", () => {
    it("should show connection badge by default when connectionName provided", () => {
      render(<TreeItem {...defaultProps} connectionName="Server" />);
      expect(screen.getByText("Server")).toBeInTheDocument();
    });

    it("should show connection badge when showConnectionBadge is true", () => {
      render(
        <TreeItem
          {...defaultProps}
          connectionName="Server"
          showConnectionBadge
        />
      );
      expect(screen.getByText("Server")).toBeInTheDocument();
    });

    it("should hide connection badge when showConnectionBadge is false", () => {
      render(
        <TreeItem
          {...defaultProps}
          connectionName="Server"
          showConnectionBadge={false}
        />
      );
      expect(screen.queryByText("Server")).not.toBeInTheDocument();
    });
  });
});
