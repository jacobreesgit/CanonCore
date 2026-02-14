/**
 * Unit tests for ItemDetailClient component.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { ItemDetailClient } from "@/components/items/item-detail-client";

// Mock next/navigation
const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

// Mock server actions
vi.mock("@/lib/item-actions", () => ({
  getItems: vi.fn().mockResolvedValue({ success: true, data: [] }),
  updateItem: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("@/lib/item-file-actions", () => ({
  getItemFiles: vi.fn().mockResolvedValue({
    success: true,
    data: { media: [], artwork: [], subtitles: [] },
  }),
  updatePlaybackPosition: vi.fn().mockResolvedValue({ success: true }),
}));

// Mock child components to simplify tests
vi.mock("@/components/ui/content-toolbar", () => ({
  ContentToolbar: ({
    disabled,
    actions,
  }: {
    disabled?: boolean;
    actions?: React.ReactNode;
  }) => (
    <div className="content-toolbar" data-disabled={disabled}>
      {actions && <div className="toolbar-actions">{actions}</div>}
    </div>
  ),
  ToolbarDivider: () => <div />,
}));

vi.mock("@/components/items/items-view", () => ({
  ItemsView: ({
    items,
    parentId,
    isEditing,
  }: {
    items: Array<{ id: string }>;
    parentId: string;
    isEditing: boolean;
  }) => (
    <div
      className="items-view"
      data-parent-id={parentId}
      data-editing={isEditing}
    >
      {items.length} items
    </div>
  ),
}));

vi.mock("@/components/hero", () => ({
  CinematicHero: ({
    slides,
    actions,
  }: {
    slides: Array<{ id: string; name: string }>;
    actions?: React.ReactNode;
  }) => {
    const slide = slides[0];
    return (
      <div className="hero-carousel" data-name={slide?.name}>
        {slide?.name} hero
        {actions && <div className="hero-actions">{actions}</div>}
      </div>
    );
  },
}));

vi.mock("@/components/media/media-overlay", () => ({
  MediaOverlay: () => <div className="media-overlay">Media overlay</div>,
}));

// Mock useItemsUrlState (uses nuqs which requires adapter in tests)
vi.mock("@/hooks/use-items-url-state", () => ({
  useItemsUrlState: () => ({
    sortBy: "custom",
    setSortBy: vi.fn(),
    filters: [],
    toggleFilter: vi.fn(),
    clearFilters: vi.fn(),
    hasActiveFilters: false,
    viewMode: "grid",
    setViewMode: vi.fn(),
    tab: null,
    setTab: vi.fn(),
    isCustomSort: true,
  }),
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("ItemDetailClient", () => {
  const defaultItem = {
    id: "item-1",
    name: "Movies",
    description: "My movie collection",
    driveConnectionId: null,
    driveFileId: null,
    isPublic: false,
    inheritVisibility: false,
    parentId: null,
    childCount: 0,
    tmdbId: null,
    tmdbType: null,
    tmdbPosterPath: null,
    tmdbBackdropPath: null,
    tmdbShowTagline: true,
    tmdbShowMetadata: true,
    tmdbShowGenres: true,
    tmdbShowCast: true,
    tmdbShowProviders: true,
    tmdbShowVideos: true,
    tmdbShowRecommendations: true,
  };

  const defaultChildItems = [
    {
      id: "child-1",
      name: "Action",
      description: null,
      parentId: "item-1",
      order: 0,
      depth: 1,
      pinnedOrder: null,
      isPublic: false,
      inheritVisibility: false,
      userId: "user-1",
      createdAt: new Date(),
      updatedAt: new Date(),
      // TMDB metadata
      tmdbId: null,
      tmdbType: null,
      tmdbPosterPath: null,
      tmdbBackdropPath: null,
      tmdbShowTagline: true,
      tmdbShowMetadata: true,
      tmdbShowGenres: true,
      tmdbShowCast: true,
      tmdbShowProviders: true,
      tmdbShowVideos: true,
      tmdbShowRecommendations: true,
      // Google Drive fields
      driveFileId: null,
      driveModifiedAt: null,
      driveThumbnailUrl: null,
      syncStatus: "SYNCED" as const,
      syncError: null,
      driveConnectionId: null,
      artworkId: null,
      fileCounts: { media: 0, artwork: 0, subtitles: 0 },
      childCount: 0,
      primaryMediaName: null,
      mediaIconType: null,
      progress: null,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * Helper to wait for loading state to complete.
   * Component shows spinner for 300ms min duration + hydration.
   */
  async function waitForLoading() {
    await act(async () => {
      vi.advanceTimersByTime(350);
    });
  }

  describe("rendering", () => {
    it("should render hero, toolbar, and items view", async () => {
      render(<ItemDetailClient item={defaultItem} childItems={[]} />);
      await waitForLoading();

      expect(document.querySelector(".hero-carousel")).toBeInTheDocument();
      expect(document.querySelector(".content-toolbar")).toBeInTheDocument();
      expect(document.querySelector(".items-view")).toBeInTheDocument();
    });

    it("should always render hero regardless of files/children", async () => {
      render(<ItemDetailClient item={defaultItem} childItems={[]} />);
      await waitForLoading();
      expect(document.querySelector(".hero-carousel")).toBeInTheDocument();
    });

    it("should pass item name to hero", async () => {
      render(<ItemDetailClient item={defaultItem} childItems={[]} />);
      await waitForLoading();
      expect(document.querySelector(".hero-carousel")).toHaveAttribute(
        "data-name",
        "Movies"
      );
    });

    it("should pass childItems to items view", async () => {
      render(
        <ItemDetailClient item={defaultItem} childItems={defaultChildItems} />
      );
      await waitForLoading();

      expect(document.querySelector(".items-view")).toHaveTextContent("1 items");
    });

    it("should disable toolbar when no children", async () => {
      render(<ItemDetailClient item={defaultItem} childItems={[]} />);
      await waitForLoading();

      expect(document.querySelector(".content-toolbar")).toHaveAttribute(
        "data-disabled",
        "true"
      );
    });
  });

  describe("hero with files", () => {
    const filesWithMedia = {
      media: [
        {
          id: "file-1",
          itemId: "item-1",
          filename: "movie.mp4",
          driveFileId: "drive-file-123",
          fileType: "MEDIA" as const,
          mimeType: "video/mp4",
          size: 1024000,
          syncStatus: "SYNCED" as const,
          syncError: null,
          isPrimary: true,
          isHero: false,
          playbackPosition: null,
          playbackDuration: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      artwork: [],
      subtitles: [],
    };

    it("should render Play button in hero when media files exist", async () => {
      render(
        <ItemDetailClient
          item={defaultItem}
          childItems={[]}
          files={filesWithMedia}
        />
      );
      await waitForLoading();

      expect(document.querySelector(".hero-actions")).toBeInTheDocument();
      expect(screen.getByText("Play")).toBeInTheDocument();
    });

    it("should show hero without file cards (MediaOverlay only when playing)", async () => {
      render(
        <ItemDetailClient
          item={defaultItem}
          childItems={[]}
          files={filesWithMedia}
        />
      );
      await waitForLoading();

      expect(document.querySelector(".hero-carousel")).toBeInTheDocument();
      // No file cards - MediaOverlay only appears when playing
      expect(document.querySelector(".media-overlay")).not.toBeInTheDocument();
    });

    it("should show Contents/About tabs when children exist", async () => {
      render(
        <ItemDetailClient
          item={defaultItem}
          childItems={defaultChildItems}
          files={filesWithMedia}
        />
      );
      await waitForLoading();

      // Tabs appear when there are children or TMDB data
      expect(screen.getByRole("tablist")).toBeInTheDocument();
    });
  });

  describe("Google Drive connection state", () => {
    it("should detect Drive connected when both driveConnectionId and driveFileId exist", async () => {
      const driveItem = {
        ...defaultItem,
        driveConnectionId: "drive-conn-1",
        driveFileId: "drive-file-456",
      };

      render(<ItemDetailClient item={driveItem} childItems={[]} />);
      await waitForLoading();

      // Component should render without error
      expect(document.querySelector(".content-toolbar")).toBeInTheDocument();
    });
  });

  describe("render order", () => {
    it("should render toolbar after hero", async () => {
      render(<ItemDetailClient item={defaultItem} childItems={[]} />);
      await waitForLoading();

      const toolbar = document.querySelector(".content-toolbar")!;
      const hero = document.querySelector(".hero-carousel")!;

      // Toolbar should come after hero in DOM order
      expect(toolbar.compareDocumentPosition(hero)).toBe(
        Node.DOCUMENT_POSITION_PRECEDING
      );
    });
  });
});
