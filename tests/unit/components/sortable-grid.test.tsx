/**
 * Unit tests for SortableGrid container.
 * Tests item rendering, grid layout, and prop updates.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { SortableGrid } from "@/components/sortable-grid/SortableGrid";
import type { ItemWithArtwork } from "@/lib/types";

// Mock SortableGridItem to simplify testing
vi.mock("@/components/sortable-grid/SortableGridItem", () => ({
  SortableGridItem: ({
    id,
    name,
    onClick,
  }: {
    id: string;
    name: string;
    onClick?: () => void;
  }) => (
    <div data-testid={`sortable-item-${id}`} onClick={onClick}>
      {name}
    </div>
  ),
}));

// Mock GridItem for DragOverlay
vi.mock("@/components/sortable-grid/GridItem", () => ({
  GridItem: ({ id, name }: { id: string; name: string }) => (
    <div data-testid={`overlay-item-${id}`}>{name}</div>
  ),
}));

describe("SortableGrid", () => {
  const createMockItem = (
    id: string,
    name: string,
    order: number
  ): ItemWithArtwork => ({
    id,
    name,
    description: null,
    parentId: null,
    order,
    depth: 0,
    pinnedOrder: null,
    userId: "user-1",
    createdAt: new Date(),
    updatedAt: new Date(),
    driveFileId: null,
    driveModifiedAt: null,
    driveThumbnailUrl: null,
    syncStatus: "SYNCED",
    syncError: null,
    driveConnectionId: null,
    artworkId: null,
    fileCounts: { media: 0, artwork: 0, subtitles: 0 },
    childCount: 0,
    primaryMediaName: null,
    mediaIconType: null,
    progress: null,
  });

  const mockItems: ItemWithArtwork[] = [
    createMockItem("item-1", "Item 1", 0),
    createMockItem("item-2", "Item 2", 1),
    createMockItem("item-3", "Item 3", 2),
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders grid container with correct testid", () => {
    render(<SortableGrid items={mockItems} />);
    expect(screen.getByTestId("items-grid-view")).toBeInTheDocument();
  });

  it("renders all items", () => {
    render(<SortableGrid items={mockItems} />);
    expect(screen.getByTestId("sortable-item-item-1")).toBeInTheDocument();
    expect(screen.getByTestId("sortable-item-item-2")).toBeInTheDocument();
    expect(screen.getByTestId("sortable-item-item-3")).toBeInTheDocument();
  });

  it("renders correct number of items", () => {
    render(<SortableGrid items={mockItems} />);
    expect(screen.getAllByTestId(/^sortable-item-/)).toHaveLength(3);
  });

  it("syncs with external items on prop change", () => {
    const { rerender } = render(<SortableGrid items={mockItems} />);
    expect(screen.getAllByTestId(/^sortable-item-/)).toHaveLength(3);

    const newItems = [...mockItems, createMockItem("item-4", "Item 4", 3)];
    rerender(<SortableGrid items={newItems} />);
    expect(screen.getAllByTestId(/^sortable-item-/)).toHaveLength(4);
  });

  it("renders empty grid when no items", () => {
    render(<SortableGrid items={[]} />);
    expect(screen.getByTestId("items-grid-view")).toBeInTheDocument();
    expect(screen.queryAllByTestId(/^sortable-item-/)).toHaveLength(0);
  });

  it("applies grid layout classes", () => {
    render(<SortableGrid items={mockItems} />);
    const grid = screen.getByTestId("items-grid-view");
    expect(grid).toHaveClass("grid");
    expect(grid).toHaveClass("grid-cols-2");
  });
});
