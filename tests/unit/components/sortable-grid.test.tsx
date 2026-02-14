/**
 * Unit tests for SortableGrid container.
 * Tests item rendering, grid layout, and prop updates.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { SortableGrid } from "@/components/sortable-grid/sortable-grid-component";
import type { ItemWithArtwork } from "@/lib/types";

// Mock hooks to prevent Vitest worker shutdown issues with module resolution
vi.mock("@/hooks/use-lazy-image", () => ({
  useLazyImage: () => ({ ref: () => {}, shouldLoad: true }),
}));

vi.mock("@/hooks/use-image-loaded", () => ({
  useImageLoaded: () => ({
    ref: { current: null },
    loaded: false,
    error: false,
    onLoad: vi.fn(),
    onError: vi.fn(),
  }),
}));

// Mock SortableGridItem to simplify testing
vi.mock("@/components/sortable-grid/sortable-grid-item", () => ({
  SortableGridItem: ({
    id,
    name,
    onClick,
  }: {
    id: string;
    name: string;
    onClick?: () => void;
  }) => (
    <div className="sortable-item" data-item-id={id} onClick={onClick}>
      {name}
    </div>
  ),
}));

// Mock GridItem for DragOverlay
vi.mock("@/components/sortable-grid/grid-item", () => ({
  GridItem: ({ id, name }: { id: string; name: string }) => (
    <div data-item-id={id}>{name}</div>
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
    isPublic: false,
    inheritVisibility: false,
    userId: "user-1",
    createdAt: new Date(),
    updatedAt: new Date(),
    driveFileId: null,
    driveModifiedAt: null,
    driveThumbnailUrl: null,
    syncStatus: "SYNCED",
    syncError: null,
    driveConnectionId: null,
    tmdbPosterPath: null,
    tmdbBackdropPath: null,
    artworkId: null,
    fileCounts: { media: 0, artwork: 0, subtitles: 0 },
    childCount: 0,
    primaryMediaName: null,
    mediaIconType: null,
    progress: null,
    tmdbId: null,
    tmdbType: null,
    tmdbShowTagline: true,
    tmdbShowMetadata: true,
    tmdbShowGenres: true,
    tmdbShowCast: true,
    tmdbShowProviders: true,
    tmdbShowVideos: true,
    tmdbShowRecommendations: true,
  });

  const mockItems: ItemWithArtwork[] = [
    createMockItem("item-1", "Item 1", 0),
    createMockItem("item-2", "Item 2", 1),
    createMockItem("item-3", "Item 3", 2),
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders grid container", () => {
    const { container } = render(<SortableGrid items={mockItems} />);
    expect(container.querySelector(".grid")).toBeInTheDocument();
  });

  it("renders all items", () => {
    render(<SortableGrid items={mockItems} />);
    expect(screen.getByText("Item 1")).toBeInTheDocument();
    expect(screen.getByText("Item 2")).toBeInTheDocument();
    expect(screen.getByText("Item 3")).toBeInTheDocument();
  });

  it("renders correct number of items", () => {
    const { container } = render(<SortableGrid items={mockItems} />);
    expect(container.querySelectorAll(".sortable-item")).toHaveLength(3);
  });

  it("syncs with external items on prop change", () => {
    const { rerender, container } = render(<SortableGrid items={mockItems} />);
    expect(container.querySelectorAll(".sortable-item")).toHaveLength(3);

    const newItems = [...mockItems, createMockItem("item-4", "Item 4", 3)];
    rerender(<SortableGrid items={newItems} />);
    expect(container.querySelectorAll(".sortable-item")).toHaveLength(4);
  });

  it("renders empty grid when no items", () => {
    const { container } = render(<SortableGrid items={[]} />);
    expect(container.querySelector(".grid")).toBeInTheDocument();
    expect(container.querySelectorAll(".sortable-item")).toHaveLength(0);
  });

  it("applies grid layout classes", () => {
    const { container } = render(<SortableGrid items={mockItems} />);
    const grid = container.querySelector(".grid");
    expect(grid).toHaveClass("grid");
    expect(grid).toHaveClass("grid-cols-2");
  });
});
