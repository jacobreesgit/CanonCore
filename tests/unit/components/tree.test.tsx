/**
 * Unit tests for Tree component (view-only mode).
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Tree } from "@/components/sortable-tree/Tree";
import type { TreeItems } from "@/lib/types";

const mockItems: TreeItems = [
  {
    id: "1",
    name: "Parent",
    order: 0,
    depth: 0,
    parentId: null,
    sftpPath: null,
    artworkId: "artwork-1",
    children: [
      {
        id: "1-1",
        name: "Child",
        order: 0,
        depth: 1,
        parentId: "1",
        sftpPath: null,
        artworkId: null,
        children: [],
      },
    ],
  },
];

describe("Tree", () => {
  it("should render all items", () => {
    render(<Tree items={mockItems} />);

    expect(screen.getByText("Parent")).toBeInTheDocument();
    expect(screen.getByText("Child")).toBeInTheDocument();
  });

  it("should call onItemClick when item is clicked", () => {
    const onItemClick = vi.fn();
    render(<Tree items={mockItems} onItemClick={onItemClick} />);

    fireEvent.click(screen.getByText("Parent"));
    expect(onItemClick).toHaveBeenCalledWith("1");
  });

  it("should hide drag handles in view mode", () => {
    render(<Tree items={mockItems} />);

    const dragHandles = screen.queryAllByLabelText("Drag handle");
    expect(dragHandles).toHaveLength(0);
  });

  it("should support collapse/expand", () => {
    render(<Tree items={mockItems} />);

    expect(screen.getByText("Child")).toBeInTheDocument();

    const collapseButton = screen.getByRole("button", {
      name: "Collapse item",
    });
    fireEvent.click(collapseButton);

    expect(screen.queryByText("Child")).not.toBeInTheDocument();

    const expandButton = screen.getByRole("button", { name: "Expand item" });
    fireEvent.click(expandButton);

    expect(screen.getByText("Child")).toBeInTheDocument();
  });
});
