/**
 * Unit tests for Grid component (view-only mode).
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Grid } from "@/components/sortable-grid/grid";
import type { ItemWithArtwork } from "@/lib/types";

// Mock hooks and components to prevent Vitest worker shutdown issues with module resolution
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

// Mock ItemContextMenu to prevent deep import chain during shutdown
vi.mock("@/components/items/item-context-menu", () => ({
  ItemContextMenu: ({ children }: { children: React.ReactNode }) => children,
  renderMenuItems: () => null,
}));

const mockItems: ItemWithArtwork[] = [
  {
    id: "1",
    name: "Item 1",
    description: null,
    parentId: null,
    order: 0,
    depth: 0,
    pinnedOrder: null,
    isPublic: false,
    inheritVisibility: false,
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
    tmdbPosterPath: null,
    tmdbBackdropPath: null,
    artworkId: "artwork-1",
    fileCounts: { media: 2, artwork: 1, subtitles: 0 },
    childCount: 3,
    primaryMediaName: "movie.mp4",
    mediaIconType: "film",
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
  },
  {
    id: "2",
    name: "Item 2",
    description: "A test description",
    parentId: null,
    order: 1,
    depth: 0,
    pinnedOrder: null,
    isPublic: false,
    inheritVisibility: false,
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
    tmdbPosterPath: null,
    tmdbBackdropPath: null,
    artworkId: null,
    fileCounts: { media: 0, artwork: 0, subtitles: 1 },
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
  },
];

describe("Grid", () => {
  it("should render all items", () => {
    render(<Grid items={mockItems} />);

    // Title appears twice (default view + hover view), so use getAllByText
    expect(screen.getAllByText("Item 1").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Item 2").length).toBeGreaterThanOrEqual(1);
  });

  it("should call onItemClick when item is clicked", () => {
    const onItemClick = vi.fn();
    render(<Grid items={mockItems} onItemClick={onItemClick} />);

    // Title appears twice (default view + hover view), click the first one
    fireEvent.click(screen.getAllByText("Item 1")[0]);
    expect(onItemClick).toHaveBeenCalledWith("1");
  });

  it("should render artwork for items with artworkId", () => {
    const { container } = render(<Grid items={mockItems} />);

    const images = container.querySelectorAll("img");
    expect(images.length).toBeGreaterThanOrEqual(1);
    expect(images[0]).toHaveAttribute("src", "/api/artwork/artwork-1");
  });

  it("should render empty grid when no items provided", () => {
    const { container } = render(<Grid items={[]} />);

    const grid = container.firstElementChild as HTMLElement;
    expect(grid).toBeInTheDocument();
    expect(grid.children).toHaveLength(0);
  });

  it("should render grid layout with correct CSS classes", () => {
    const { container } = render(<Grid items={mockItems} />);

    const grid = container.firstElementChild as HTMLElement;
    expect(grid).toBeInTheDocument();
    expect(grid).toHaveClass("grid");
    expect(grid).toHaveClass("grid-cols-1");
  });
});
