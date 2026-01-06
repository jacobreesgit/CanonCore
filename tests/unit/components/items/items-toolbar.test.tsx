/**
 * Unit tests for ItemsToolbar component.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ItemsToolbar } from "@/components/items/items-toolbar";
import { getItemFiles } from "@/lib/item-file-actions";

// Mock next/navigation
const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

// Mock server actions
vi.mock("@/lib/item-actions", () => ({
  updateItem: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("@/lib/item-file-actions", () => ({
  getItemFiles: vi.fn().mockResolvedValue({
    success: true,
    data: { media: [], artwork: [], subtitles: [] },
  }),
}));

// Mock sftp components
vi.mock("@/components/sftp", () => ({
  SyncButton: ({ connectionId }: { connectionId: string }) => (
    <button data-testid="sync-connection-button">
      Sync Connection ({connectionId})
    </button>
  ),
  SyncAllButton: ({ connectionCount }: { connectionCount: number }) => (
    <button data-testid="sync-all-button">Sync All ({connectionCount})</button>
  ),
  ItemSyncButton: ({
    itemId,
    itemName,
  }: {
    itemId: string;
    itemName: string;
  }) => (
    <button data-testid="item-sync-button">
      Sync {itemName} ({itemId})
    </button>
  ),
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("ItemsToolbar", () => {
  const defaultProps = {
    hasItems: false,
  };

  const mockItem = {
    id: "item-1",
    name: "Movies",
    description: "My movie collection",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("should render without crashing with minimal props", () => {
      render(<ItemsToolbar {...defaultProps} />);
      // Component should render
      expect(document.body).toBeDefined();
    });

    it("should not render Add/Edit/View controls when hasItems is false", () => {
      render(<ItemsToolbar {...defaultProps} />);

      expect(
        screen.queryByRole("button", { name: /add item/i })
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /edit/i })
      ).not.toBeInTheDocument();
    });

    it("should render Add/Edit/View controls when hasItems is true", () => {
      const onEditToggle = vi.fn();
      const onAddItem = vi.fn();

      render(
        <ItemsToolbar
          hasItems={true}
          isEditing={false}
          onEditToggle={onEditToggle}
          onAddItem={onAddItem}
        />
      );

      expect(
        screen.getByRole("button", { name: /add item/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /edit items/i })
      ).toBeInTheDocument();
    });
  });

  describe("Settings button", () => {
    it("should render Settings button when item is provided", () => {
      render(<ItemsToolbar {...defaultProps} item={mockItem} />);

      const settingsButton = screen.getByRole("button", {
        name: "Item Settings",
      });
      expect(settingsButton).toBeInTheDocument();
    });

    it("should not render Settings button when item is not provided", () => {
      render(<ItemsToolbar {...defaultProps} />);

      expect(
        screen.queryByRole("button", { name: "Item Settings" })
      ).not.toBeInTheDocument();
    });

    it("should open settings dialog and fetch files when Settings clicked", async () => {
      const user = userEvent.setup();

      render(<ItemsToolbar {...defaultProps} item={mockItem} />);

      const settingsButton = screen.getByRole("button", {
        name: "Item Settings",
      });
      await user.click(settingsButton);

      // Dialog should appear
      expect(await screen.findByRole("dialog")).toBeInTheDocument();

      // Verify getItemFiles was called with correct item ID
      expect(getItemFiles).toHaveBeenCalledWith("item-1");

      // Verify dialog shows item name in input
      expect(screen.getByLabelText("Name")).toHaveValue("Movies");
    });

    it("should handle null description in settings dialog", async () => {
      const user = userEvent.setup();
      const itemWithNullDescription = {
        ...mockItem,
        id: "item-2",
        name: "TV Shows",
        description: null,
      };

      render(<ItemsToolbar {...defaultProps} item={itemWithNullDescription} />);

      const settingsButton = screen.getByRole("button", {
        name: "Item Settings",
      });
      await user.click(settingsButton);

      expect(await screen.findByRole("dialog")).toBeInTheDocument();
      expect(screen.getByLabelText("Name")).toHaveValue("TV Shows");
    });
  });

  describe("Sync buttons", () => {
    it("should render ItemSyncButton when item is SFTP connected", () => {
      render(
        <ItemsToolbar
          {...defaultProps}
          item={mockItem}
          isSftpConnected={true}
        />
      );

      expect(screen.getByTestId("item-sync-button")).toBeInTheDocument();
    });

    it("should not render ItemSyncButton when not SFTP connected", () => {
      render(
        <ItemsToolbar
          {...defaultProps}
          item={mockItem}
          isSftpConnected={false}
        />
      );

      expect(screen.queryByTestId("item-sync-button")).not.toBeInTheDocument();
    });

    it("should render SyncAllButton when connections exist and no filter selected", () => {
      const connections = [
        { id: "conn-1", name: "Server 1" },
        { id: "conn-2", name: "Server 2" },
      ];
      const onConnectionChange = vi.fn();

      render(
        <ItemsToolbar
          {...defaultProps}
          connections={connections}
          selectedConnectionId={null}
          onConnectionChange={onConnectionChange}
        />
      );

      expect(screen.getByTestId("sync-all-button")).toBeInTheDocument();
      expect(
        screen.queryByTestId("sync-connection-button")
      ).not.toBeInTheDocument();
    });

    it("should render SyncButton when filtered to specific connection", () => {
      const connections = [
        { id: "conn-1", name: "Server 1" },
        { id: "conn-2", name: "Server 2" },
      ];
      const onConnectionChange = vi.fn();

      render(
        <ItemsToolbar
          {...defaultProps}
          connections={connections}
          selectedConnectionId="conn-1"
          onConnectionChange={onConnectionChange}
        />
      );

      expect(screen.getByTestId("sync-connection-button")).toBeInTheDocument();
      expect(screen.queryByTestId("sync-all-button")).not.toBeInTheDocument();
    });

    it("should auto-select single connection", () => {
      const connections = [{ id: "conn-1", name: "Server 1" }];
      const onConnectionChange = vi.fn();

      render(
        <ItemsToolbar
          {...defaultProps}
          connections={connections}
          selectedConnectionId={null}
          onConnectionChange={onConnectionChange}
        />
      );

      // With single connection, should show SyncButton (auto-selected), not SyncAllButton
      expect(screen.getByTestId("sync-connection-button")).toBeInTheDocument();
      expect(screen.queryByTestId("sync-all-button")).not.toBeInTheDocument();
    });
  });

  describe("Add Item button", () => {
    it("should call onAddItem when Add Item clicked", async () => {
      const user = userEvent.setup();
      const onAddItem = vi.fn();

      render(
        <ItemsToolbar
          hasItems={true}
          isEditing={false}
          onEditToggle={vi.fn()}
          onAddItem={onAddItem}
        />
      );

      await user.click(screen.getByRole("button", { name: /add item/i }));
      expect(onAddItem).toHaveBeenCalledTimes(1);
    });
  });

  describe("Edit toggle", () => {
    it("should call onEditToggle when Edit clicked", async () => {
      const user = userEvent.setup();
      const onEditToggle = vi.fn();

      render(
        <ItemsToolbar
          hasItems={true}
          isEditing={false}
          onEditToggle={onEditToggle}
          onAddItem={vi.fn()}
        />
      );

      await user.click(screen.getByRole("button", { name: /edit items/i }));
      expect(onEditToggle).toHaveBeenCalledTimes(1);
    });

    it("should show Done button when isEditing is true", () => {
      render(
        <ItemsToolbar
          hasItems={true}
          isEditing={true}
          onEditToggle={vi.fn()}
          onAddItem={vi.fn()}
        />
      );

      expect(
        screen.getByRole("button", { name: /done editing/i })
      ).toBeInTheDocument();
    });
  });
});
