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
vi.mock("@/components/items/items-toolbar", () => ({
  ItemsToolbar: ({
    hasItems,
    isEditing,
    item,
  }: {
    hasItems: boolean;
    isEditing: boolean;
    item?: { id: string; name: string };
  }) => (
    <div
      data-testid="items-toolbar"
      data-has-items={hasItems}
      data-editing={isEditing}
    >
      {item && <span data-testid="toolbar-item-name">{item.name}</span>}
    </div>
  ),
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
      data-testid="items-view"
      data-parent-id={parentId}
      data-editing={isEditing}
    >
      {items.length} items
    </div>
  ),
}));

vi.mock("@/components/items/item-hero", () => ({
  ItemHero: ({ name, hasMedia }: { name: string; hasMedia?: boolean }) => (
    <div data-testid="item-hero" data-name={name} data-has-media={hasMedia}>
      {name} hero
    </div>
  ),
}));

vi.mock("@/components/media/media-overlay", () => ({
  MediaOverlay: () => <div data-testid="media-overlay">Media overlay</div>,
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

      expect(screen.getByTestId("item-hero")).toBeInTheDocument();
      expect(screen.getByTestId("items-toolbar")).toBeInTheDocument();
      expect(screen.getByTestId("items-view")).toBeInTheDocument();
    });

    it("should always render hero regardless of files/children", async () => {
      render(<ItemDetailClient item={defaultItem} childItems={[]} />);
      await waitForLoading();
      expect(screen.getByTestId("item-hero")).toBeInTheDocument();
    });

    it("should pass item name to hero", async () => {
      render(<ItemDetailClient item={defaultItem} childItems={[]} />);
      await waitForLoading();
      expect(screen.getByTestId("item-hero")).toHaveAttribute(
        "data-name",
        "Movies"
      );
    });

    it("should pass childItems to items view", async () => {
      render(
        <ItemDetailClient item={defaultItem} childItems={defaultChildItems} />
      );
      await waitForLoading();

      expect(screen.getByTestId("items-view")).toHaveTextContent("1 items");
    });

    it("should set hasItems=true when children exist", async () => {
      render(
        <ItemDetailClient item={defaultItem} childItems={defaultChildItems} />
      );
      await waitForLoading();

      expect(screen.getByTestId("items-toolbar")).toHaveAttribute(
        "data-has-items",
        "true"
      );
    });

    it("should set hasItems=false when no children", async () => {
      render(<ItemDetailClient item={defaultItem} childItems={[]} />);
      await waitForLoading();

      expect(screen.getByTestId("items-toolbar")).toHaveAttribute(
        "data-has-items",
        "false"
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

    it("should pass hasMedia=true to hero when media files exist", async () => {
      render(
        <ItemDetailClient
          item={defaultItem}
          childItems={[]}
          files={filesWithMedia}
        />
      );
      await waitForLoading();

      expect(screen.getByTestId("item-hero")).toHaveAttribute(
        "data-has-media",
        "true"
      );
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

      expect(screen.getByTestId("item-hero")).toBeInTheDocument();
      // No file cards - MediaOverlay only appears when playing
      expect(screen.queryByTestId("media-overlay")).not.toBeInTheDocument();
    });

    it("should NOT show tabs - always flat layout", async () => {
      render(
        <ItemDetailClient
          item={defaultItem}
          childItems={defaultChildItems}
          files={filesWithMedia}
        />
      );
      await waitForLoading();

      // Tabs should never appear
      expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
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
      expect(screen.getByTestId("items-toolbar")).toBeInTheDocument();
    });
  });

  describe("render order", () => {
    it("should render toolbar after hero", async () => {
      render(<ItemDetailClient item={defaultItem} childItems={[]} />);
      await waitForLoading();

      const toolbar = screen.getByTestId("items-toolbar");
      const hero = screen.getByTestId("item-hero");

      // Toolbar should come after hero in DOM order
      expect(toolbar.compareDocumentPosition(hero)).toBe(
        Node.DOCUMENT_POSITION_PRECEDING
      );
    });
  });
});
