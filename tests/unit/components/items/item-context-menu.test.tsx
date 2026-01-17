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
});
