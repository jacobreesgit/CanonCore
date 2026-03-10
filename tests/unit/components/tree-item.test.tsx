/**
 * Unit tests for TreeItem component.
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TreeItem } from "@/components/sortable-tree/components/tree-item/tree-item";

describe("TreeItem", () => {
  const defaultProps = {
    id: "1",
    value: "Test Item",
    depth: 0,
    indentationWidth: 20,
  };

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

  it("displays duration and resolution inline when metadata present", () => {
    render(
      <TreeItem
        {...defaultProps}
        showDragHandle={false}
        primaryDurationMs={6120000}
        primaryHeight={1080}
      />
    );

    expect(screen.getByText("1h 42m")).toBeInTheDocument();
    expect(screen.getByText("1080p")).toBeInTheDocument();
  });

  it("does not display badges when no metadata", () => {
    render(<TreeItem {...defaultProps} showDragHandle={false} />);

    expect(screen.queryByText(/[0-9]+[hm]/)).not.toBeInTheDocument();
  });
});
