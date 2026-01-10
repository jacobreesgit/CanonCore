/**
 * Unit tests for Grid component (view-only mode).
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Grid } from "@/components/sortable-grid/Grid";
import type { ItemWithArtwork } from "@/lib/types";

const mockItems: ItemWithArtwork[] = [
  {
    id: "1",
    name: "Item 1",
    description: null,
    parentId: null,
    order: 0,
    depth: 0,
    userId: "user-1",
    createdAt: new Date(),
    updatedAt: new Date(),
    // Google Drive fields
    driveFileId: null,
    driveModifiedAt: null,
    driveThumbnailUrl: null,
    syncStatus: "SYNCED",
    syncError: null,
    driveConnectionId: null,
    artworkId: "artwork-1",
    fileCounts: { media: 2, artwork: 1, subtitles: 0 },
    childCount: 3,
    primaryMediaName: "movie.mp4",
    mediaIconType: "film",
  },
  {
    id: "2",
    name: "Item 2",
    description: "A test description",
    parentId: null,
    order: 1,
    depth: 0,
    userId: "user-1",
    createdAt: new Date(),
    updatedAt: new Date(),
    // Google Drive fields
    driveFileId: "drive-file-456",
    driveModifiedAt: null,
    driveThumbnailUrl: null,
    syncStatus: "SYNCED",
    syncError: null,
    driveConnectionId: "drive-conn-1",
    artworkId: null,
    fileCounts: { media: 0, artwork: 0, subtitles: 1 },
    childCount: 0,
    primaryMediaName: null,
    mediaIconType: null,
  },
];

describe("Grid", () => {
  it("should render all items", () => {
    render(<Grid items={mockItems} />);

    expect(screen.getByText("Item 1")).toBeInTheDocument();
    expect(screen.getByText("Item 2")).toBeInTheDocument();
  });

  it("should call onItemClick when item is clicked", () => {
    const onItemClick = vi.fn();
    render(<Grid items={mockItems} onItemClick={onItemClick} />);

    fireEvent.click(screen.getByText("Item 1"));
    expect(onItemClick).toHaveBeenCalledWith("1");
  });

  it("should render artwork for items with artworkId", () => {
    const { container } = render(<Grid items={mockItems} />);

    const images = container.querySelectorAll("img");
    expect(images.length).toBeGreaterThanOrEqual(1);
    expect(images[0]).toHaveAttribute("src", "/api/artwork/artwork-1");
  });

  it("should render empty grid when no items provided", () => {
    render(<Grid items={[]} />);

    const grid = screen.getByTestId("items-grid-view");
    expect(grid).toBeInTheDocument();
    expect(grid.children).toHaveLength(0);
  });

  it("should render grid layout with correct CSS classes", () => {
    render(<Grid items={mockItems} />);

    const grid = screen.getByTestId("items-grid-view");
    expect(grid).toHaveClass("grid");
    expect(grid).toHaveClass("grid-cols-2");
  });
});
