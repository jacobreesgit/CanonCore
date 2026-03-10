/**
 * Unit tests for ItemContextMenu component.
 * Tests context menu options including Drive link and pin/unpin.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ItemContextMenu } from "@/components/items/item-context-menu";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

describe("ItemContextMenu", () => {
  const defaultProps = {
    itemName: "Test Item",
    driveFileId: null as string | null,
    onSettings: vi.fn(),
    onDelete: vi.fn().mockResolvedValue(undefined),
    onAddChild: vi.fn().mockResolvedValue(undefined),
    children: <button>Trigger</button>,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Open in Drive option", () => {
    it("should show Open in Drive when item has driveFileId", async () => {
      render(
        <ItemContextMenu {...defaultProps} driveFileId="drive-folder-123" />
      );

      // Right-click to open context menu
      fireEvent.contextMenu(screen.getByRole("button", { name: /trigger/i }));

      const driveOption = screen.getByRole("menuitem", {
        name: /open in drive/i,
      });
      expect(driveOption).toBeInTheDocument();
    });

    it("should not show Open in Drive when item has no driveFileId", async () => {
      render(<ItemContextMenu {...defaultProps} driveFileId={null} />);

      // Right-click to open context menu
      fireEvent.contextMenu(screen.getByRole("button", { name: /trigger/i }));

      expect(
        screen.queryByRole("menuitem", { name: /open in drive/i })
      ).not.toBeInTheDocument();
    });

    it("should have correct Drive folder link href", async () => {
      render(
        <ItemContextMenu {...defaultProps} driveFileId="drive-folder-123" />
      );

      // Right-click to open context menu
      fireEvent.contextMenu(screen.getByRole("button", { name: /trigger/i }));

      // ContextMenuItem with asChild wrapping <a> renders as menuitem with link properties
      const menuItem = screen.getByRole("menuitem", { name: /open in drive/i });
      expect(menuItem).toHaveAttribute(
        "href",
        "https://drive.google.com/drive/folders/drive-folder-123"
      );
      expect(menuItem).toHaveAttribute("target", "_blank");
      expect(menuItem).toHaveAttribute("rel", "noopener noreferrer");
    });
  });

  describe("Pin/Unpin options", () => {
    it("should show Pin to Sidebar when item is not pinned and onPin provided", async () => {
      const onPin = vi.fn().mockResolvedValue(undefined);
      render(
        <ItemContextMenu
          {...defaultProps}
          isPinned={false}
          onPin={onPin}
          onUnpin={vi.fn()}
        />
      );

      fireEvent.contextMenu(screen.getByRole("button", { name: /trigger/i }));

      expect(
        screen.getByRole("menuitem", { name: /pin to sidebar/i })
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("menuitem", { name: /unpin from sidebar/i })
      ).not.toBeInTheDocument();
    });

    it("should show Unpin from Sidebar when item is pinned and onUnpin provided", async () => {
      const onUnpin = vi.fn().mockResolvedValue(undefined);
      render(
        <ItemContextMenu
          {...defaultProps}
          isPinned={true}
          onPin={vi.fn()}
          onUnpin={onUnpin}
        />
      );

      fireEvent.contextMenu(screen.getByRole("button", { name: /trigger/i }));

      expect(
        screen.getByRole("menuitem", { name: /unpin from sidebar/i })
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("menuitem", { name: /pin to sidebar/i })
      ).not.toBeInTheDocument();
    });

    it("should not show pin options when callbacks not provided", async () => {
      render(<ItemContextMenu {...defaultProps} />);

      fireEvent.contextMenu(screen.getByRole("button", { name: /trigger/i }));

      expect(
        screen.queryByRole("menuitem", { name: /pin to sidebar/i })
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("menuitem", { name: /unpin from sidebar/i })
      ).not.toBeInTheDocument();
    });

    it("should call onPin when Pin to Sidebar is clicked", async () => {
      const onPin = vi.fn().mockResolvedValue(undefined);
      render(
        <ItemContextMenu
          {...defaultProps}
          isPinned={false}
          onPin={onPin}
          onUnpin={vi.fn()}
        />
      );

      fireEvent.contextMenu(screen.getByRole("button", { name: /trigger/i }));
      fireEvent.click(
        screen.getByRole("menuitem", { name: /pin to sidebar/i })
      );

      expect(onPin).toHaveBeenCalledTimes(1);
    });

    it("should call onUnpin when Unpin from Sidebar is clicked", async () => {
      const onUnpin = vi.fn().mockResolvedValue(undefined);
      render(
        <ItemContextMenu
          {...defaultProps}
          isPinned={true}
          onPin={vi.fn()}
          onUnpin={onUnpin}
        />
      );

      fireEvent.contextMenu(screen.getByRole("button", { name: /trigger/i }));
      fireEvent.click(
        screen.getByRole("menuitem", { name: /unpin from sidebar/i })
      );

      expect(onUnpin).toHaveBeenCalledTimes(1);
    });
  });

  describe("Edit Item option", () => {
    it("should show Edit Item when onSettings is provided", () => {
      render(<ItemContextMenu {...defaultProps} />);

      fireEvent.contextMenu(screen.getByRole("button", { name: /trigger/i }));

      expect(
        screen.getByRole("menuitem", { name: /edit item/i })
      ).toBeInTheDocument();
    });

    it("should not show Edit Item when onSettings is not provided", () => {
      const { onSettings: _onSettings, ...propsWithoutSettings } = defaultProps;
      render(<ItemContextMenu {...propsWithoutSettings} />);

      fireEvent.contextMenu(screen.getByRole("button", { name: /trigger/i }));

      expect(
        screen.queryByRole("menuitem", { name: /edit item/i })
      ).not.toBeInTheDocument();
    });

    it("should call onSettings when Edit Item is clicked", () => {
      render(<ItemContextMenu {...defaultProps} />);

      fireEvent.contextMenu(screen.getByRole("button", { name: /trigger/i }));
      fireEvent.click(screen.getByRole("menuitem", { name: /edit item/i }));

      expect(defaultProps.onSettings).toHaveBeenCalledTimes(1);
    });
  });

  describe("Play action", () => {
    it("shows Play when hasMedia and onGetTracks are provided", () => {
      render(
        <ItemContextMenu
          {...defaultProps}
          hasMedia
          onGetTracks={vi.fn().mockResolvedValue([])}
          onPlay={vi.fn()}
          onPlayNext={vi.fn()}
          onAddToQueue={vi.fn()}
        />
      );
      fireEvent.contextMenu(screen.getByRole("button", { name: /trigger/i }));
      expect(screen.getByText("Play")).toBeInTheDocument();
    });

    it("does not show Play when hasMedia is false", () => {
      render(
        <ItemContextMenu
          {...defaultProps}
          hasMedia={false}
          onGetTracks={vi.fn()}
          onPlay={vi.fn()}
        />
      );
      fireEvent.contextMenu(screen.getByRole("button", { name: /trigger/i }));
      expect(screen.queryByText("Play")).not.toBeInTheDocument();
    });
  });

  describe("Copy Link action", () => {
    it("shows Copy Link when username and itemId are provided", () => {
      render(
        <ItemContextMenu
          {...defaultProps}
          username="testuser"
          itemId="item-123"
        />
      );
      fireEvent.contextMenu(screen.getByRole("button", { name: /trigger/i }));
      expect(screen.getByText("Copy Link")).toBeInTheDocument();
    });

    it("does not show Copy Link when username is not provided", () => {
      render(<ItemContextMenu {...defaultProps} itemId="item-123" />);
      fireEvent.contextMenu(screen.getByRole("button", { name: /trigger/i }));
      expect(screen.queryByText("Copy Link")).not.toBeInTheDocument();
    });

    it("copies link to clipboard when Copy Link is clicked", async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { clipboard: { writeText } });

      render(
        <ItemContextMenu
          {...defaultProps}
          username="testuser"
          itemId="item-123"
        />
      );
      fireEvent.contextMenu(screen.getByRole("button", { name: /trigger/i }));
      fireEvent.click(screen.getByText("Copy Link"));

      await vi.waitFor(() => {
        expect(writeText).toHaveBeenCalledWith(
          expect.stringContaining("/u/testuser/item-123")
        );
      });
    });
  });

  describe("Move to action", () => {
    it("shows Move to when onMoveToOpen is provided", () => {
      render(<ItemContextMenu {...defaultProps} onMoveToOpen={vi.fn()} />);
      fireEvent.contextMenu(screen.getByRole("button", { name: /trigger/i }));
      expect(screen.getByText("Move to…")).toBeInTheDocument();
    });

    it("does not show Move to when onMoveToOpen is not provided", () => {
      render(<ItemContextMenu {...defaultProps} />);
      fireEvent.contextMenu(screen.getByRole("button", { name: /trigger/i }));
      expect(screen.queryByText("Move to…")).not.toBeInTheDocument();
    });

    it("calls onMoveToOpen when clicked", () => {
      const onMoveToOpen = vi.fn();
      render(<ItemContextMenu {...defaultProps} onMoveToOpen={onMoveToOpen} />);
      fireEvent.contextMenu(screen.getByRole("button", { name: /trigger/i }));
      fireEvent.click(screen.getByText("Move to…"));
      expect(onMoveToOpen).toHaveBeenCalledTimes(1);
    });
  });

  describe("Add to Playlist", () => {
    it("shows Add to Playlist when showAddToPlaylist is true", () => {
      render(
        <ItemContextMenu {...defaultProps} showAddToPlaylist itemId="item-1">
          <button>Trigger</button>
        </ItemContextMenu>
      );
      fireEvent.contextMenu(screen.getByText("Trigger"));
      expect(screen.getByText("Add to Playlist")).toBeInTheDocument();
    });

    it("hides Add to Playlist when showAddToPlaylist is false", () => {
      render(<ItemContextMenu {...defaultProps} />);
      fireEvent.contextMenu(screen.getByRole("button", { name: /trigger/i }));
      expect(screen.queryByText("Add to Playlist")).not.toBeInTheDocument();
    });
  });
});
