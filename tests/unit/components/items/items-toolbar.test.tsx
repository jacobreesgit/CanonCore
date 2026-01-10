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

// Mock auth to avoid next-auth module resolution issues
vi.mock("@/lib/auth", () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: "test-user" } }),
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

    it("should disable Add/Edit/View controls when hasItems is false", () => {
      render(<ItemsToolbar {...defaultProps} />);

      // Controls are rendered but disabled
      expect(screen.getByRole("button", { name: /add item/i })).toBeDisabled();
      expect(
        screen.getByRole("button", { name: /enter edit mode/i })
      ).toBeDisabled();
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
        screen.getByRole("button", { name: /enter edit mode/i })
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

      await user.click(
        screen.getByRole("button", { name: /enter edit mode/i })
      );
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
        screen.getByRole("button", { name: /exit edit mode/i })
      ).toBeInTheDocument();
    });
  });
});
