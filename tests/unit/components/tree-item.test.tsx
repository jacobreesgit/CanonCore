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
});
