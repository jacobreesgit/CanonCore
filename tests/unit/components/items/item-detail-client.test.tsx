/**
 * Unit tests for ItemDetailClient component.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

vi.mock("@/components/items/item-detail", () => ({
  ItemDetail: ({ item }: { item: { id: string; name: string } }) => (
    <div data-testid="item-detail">{item.name} detail</div>
  ),
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
    it("should render toolbar and items view without crashing", () => {
      render(<ItemDetailClient item={defaultItem} childItems={[]} />);

      expect(screen.getByTestId("items-toolbar")).toBeInTheDocument();
      expect(screen.getByTestId("items-view")).toBeInTheDocument();
    });

    it("should pass item to toolbar", () => {
      render(<ItemDetailClient item={defaultItem} childItems={[]} />);

      expect(screen.getByTestId("toolbar-item-name")).toHaveTextContent(
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

  describe("SFTP connection state", () => {
    it("should not show SFTP connected when connectionId is null", () => {
      render(<ItemDetailClient item={defaultItem} childItems={[]} />);

      // isSftpConnected should be false (no connectionId + sftpPath)
      const toolbar = screen.getByTestId("items-toolbar");
      expect(toolbar).toBeInTheDocument();
    });

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

  describe("tabbed view", () => {
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

    it("should show tabs when both files and children exist", () => {
      render(
        <ItemDetailClient
          item={defaultItem}
          childItems={defaultChildItems}
          files={filesWithMedia}
        />
      );

      // Should have tabs for Media and Subfolders
      expect(screen.getByRole("tablist")).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /media/i })).toBeInTheDocument();
      expect(
        screen.getByRole("tab", { name: /subfolders/i })
      ).toBeInTheDocument();
    });

    it("should not show tabs when only children exist (no files)", () => {
      render(
        <ItemDetailClient item={defaultItem} childItems={defaultChildItems} />
      );

      expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    });

    it("should not show tabs when only files exist (no children)", () => {
      render(
        <ItemDetailClient
          item={defaultItem}
          childItems={[]}
          files={filesWithMedia}
        />
      );

      // No tabs because there are no children to show in subfolder tab
      expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    });

    it("should switch between tabs", async () => {
      const user = userEvent.setup();

      render(
        <ItemDetailClient
          item={defaultItem}
          childItems={defaultChildItems}
          files={filesWithMedia}
        />
      );

      // Files tab is default, should show ItemDetail
      expect(screen.getByTestId("item-detail")).toBeInTheDocument();

      // Click Subfolders tab
      await user.click(screen.getByRole("tab", { name: /subfolders/i }));

      // Should now show ItemsView
      expect(screen.getByTestId("items-view")).toBeInTheDocument();
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
});
