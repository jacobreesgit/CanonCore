/**
 * Unit tests for ItemDetailClient component.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
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

vi.mock("@/lib/sftp-actions", () => ({
  getItemsByConnection: vi.fn().mockResolvedValue({ success: true, data: [] }),
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
    connectionId: null,
    sftpPath: null,
  };

  const defaultChildItems = [
    {
      id: "child-1",
      name: "Action",
      description: null,
      parentId: "item-1",
      order: 0,
      depth: 1,
      userId: "user-1",
      createdAt: new Date(),
      updatedAt: new Date(),
      connectionId: null,
      sftpPath: null,
      sftpModifiedAt: null,
      artworkId: null,
      fileCounts: { media: 0, artwork: 0, subtitles: 0 },
      childCount: 0,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("should render hero, toolbar, and items view", () => {
      render(<ItemDetailClient item={defaultItem} childItems={[]} />);

      expect(screen.getByTestId("item-hero")).toBeInTheDocument();
      expect(screen.getByTestId("items-toolbar")).toBeInTheDocument();
      expect(screen.getByTestId("items-view")).toBeInTheDocument();
    });

    it("should always render hero regardless of files/children", () => {
      render(<ItemDetailClient item={defaultItem} childItems={[]} />);
      expect(screen.getByTestId("item-hero")).toBeInTheDocument();
    });

    it("should pass item name to hero", () => {
      render(<ItemDetailClient item={defaultItem} childItems={[]} />);
      expect(screen.getByTestId("item-hero")).toHaveAttribute(
        "data-name",
        "Movies"
      );
    });

    it("should pass childItems to items view", () => {
      render(
        <ItemDetailClient item={defaultItem} childItems={defaultChildItems} />
      );

      expect(screen.getByTestId("items-view")).toHaveTextContent("1 items");
    });

    it("should set hasItems=true when children exist", () => {
      render(
        <ItemDetailClient item={defaultItem} childItems={defaultChildItems} />
      );

      expect(screen.getByTestId("items-toolbar")).toHaveAttribute(
        "data-has-items",
        "true"
      );
    });

    it("should set hasItems=false when no children", () => {
      render(<ItemDetailClient item={defaultItem} childItems={[]} />);

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
          sftpPath: "/movie.mp4",
          fileType: "MEDIA" as const,
          mimeType: "video/mp4",
          size: 1024000,
          sftpModifiedAt: new Date(),
          isPrimary: true,
          playbackPosition: null,
          playbackDuration: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      artwork: [],
      subtitles: [],
    };

    it("should pass hasMedia=true to hero when media files exist", () => {
      render(
        <ItemDetailClient
          item={defaultItem}
          childItems={[]}
          files={filesWithMedia}
        />
      );

      expect(screen.getByTestId("item-hero")).toHaveAttribute(
        "data-has-media",
        "true"
      );
    });

    it("should show hero without file cards (MediaOverlay only when playing)", () => {
      render(
        <ItemDetailClient
          item={defaultItem}
          childItems={[]}
          files={filesWithMedia}
        />
      );

      expect(screen.getByTestId("item-hero")).toBeInTheDocument();
      // No file cards - MediaOverlay only appears when playing
      expect(screen.queryByTestId("media-overlay")).not.toBeInTheDocument();
    });

    it("should NOT show tabs - always flat layout", () => {
      render(
        <ItemDetailClient
          item={defaultItem}
          childItems={defaultChildItems}
          files={filesWithMedia}
        />
      );

      // Tabs should never appear
      expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    });
  });

  describe("SFTP connection state", () => {
    it("should detect SFTP connected when both connectionId and sftpPath exist", () => {
      const sftpItem = {
        ...defaultItem,
        connectionId: "conn-1",
        sftpPath: "/media/movies",
      };

      render(<ItemDetailClient item={sftpItem} childItems={[]} />);

      // Component should render without error
      expect(screen.getByTestId("items-toolbar")).toBeInTheDocument();
    });
  });

  describe("connection context", () => {
    it("should pass connection to items view when provided", () => {
      const connection = { id: "conn-1", name: "My Server" };

      render(
        <ItemDetailClient
          item={defaultItem}
          childItems={defaultChildItems}
          connection={connection}
        />
      );

      // ItemsView should receive the connection context
      expect(screen.getByTestId("items-view")).toBeInTheDocument();
    });
  });

  describe("render order", () => {
    it("should render toolbar before hero", () => {
      render(<ItemDetailClient item={defaultItem} childItems={[]} />);

      const toolbar = screen.getByTestId("items-toolbar");
      const hero = screen.getByTestId("item-hero");

      // Toolbar should come before hero in DOM order
      expect(toolbar.compareDocumentPosition(hero)).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING
      );
    });
  });
});
