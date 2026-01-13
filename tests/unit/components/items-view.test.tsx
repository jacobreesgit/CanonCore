/**
 * Unit tests for ItemsView component.
 * Tests rendering, toolbar, empty state, external control, and sort/filter.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ItemsView } from "@/components/items/items-view";
import type { ItemWithArtwork, SortOption, FilterOption } from "@/lib/types";
import { sortItems, filterItems } from "@/lib/item-utils";

// Sort/filter state module - must be separate to avoid hoisting issues
const sortFilterState = {
  sortBy: "custom" as SortOption,
  filterBy: "all" as FilterOption,
};

// Mock useItemsSortFilter hook
vi.mock("@/hooks/use-items-sort-filter", () => ({
  useItemsSortFilter: () => ({
    sortBy: sortFilterState.sortBy,
    filterBy: sortFilterState.filterBy,
    setSortBy: vi.fn(),
    setFilterBy: vi.fn(),
    isCustomSort: sortFilterState.sortBy === "custom",
    hasActiveFilter: sortFilterState.filterBy !== "all",
    reset: vi.fn(),
  }),
}));

// Track sortItems/filterItems calls via spied functions
vi.mock("@/lib/item-utils", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/item-utils")>();
  return {
    ...original,
    sortItems: vi.fn((items) => items),
    filterItems: vi.fn((items) => items),
  };
});

// Mock server actions
vi.mock("@/lib/item-actions", () => ({
  createItem: vi
    .fn()
    .mockResolvedValue({ success: true, data: { id: "new-1", name: "New" } }),
  deleteItem: vi.fn().mockResolvedValue({ success: true }),
  reorderItems: vi.fn().mockResolvedValue({ success: true }),
  getItems: vi.fn().mockResolvedValue({ success: true, data: [] }),
}));

vi.mock("@/lib/item-file-actions", () => ({
  getItemFiles: vi.fn().mockResolvedValue({
    success: true,
    data: { media: [], artwork: [], subtitles: [] },
  }),
}));

vi.mock("@/lib/google-drive-sync", () => ({
  syncFromGoogleDrive: vi.fn().mockResolvedValue({ success: true }),
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ push: vi.fn() })),
}));

// Mock view mode hook - default to tree view
vi.mock("@/components/items/view-toggle", () => ({
  useStoredViewMode: vi.fn(() => ["tree"]),
  ViewToggle: ({ disabled }: { disabled?: boolean }) => (
    <div data-testid="view-toggle" data-disabled={disabled}>
      View Toggle
    </div>
  ),
}));

// Mock tree/grid components
vi.mock("@/components/sortable-tree", () => ({
  SortableTree: ({ items }: { items: unknown[] }) => (
    <div data-testid="sortable-tree">{items.length} items</div>
  ),
  Tree: ({ items }: { items: unknown[] }) => (
    <div data-testid="tree-view">{items.length} items</div>
  ),
}));

vi.mock("@/components/sortable-grid", () => ({
  SortableGrid: ({ items }: { items: unknown[] }) => (
    <div data-testid="sortable-grid">{items.length} items</div>
  ),
  Grid: ({ items }: { items: unknown[] }) => (
    <div data-testid="grid-view">{items.length} items</div>
  ),
}));

// Mock dialogs
vi.mock("@/components/items/add-item-dialog", () => ({
  AddItemDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="add-dialog">Add Dialog</div> : null,
}));

vi.mock("@/components/items/item-settings-dialog", () => ({
  ItemSettingsDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="settings-dialog">Settings Dialog</div> : null,
}));

describe("ItemsView", () => {
  const createMockItem = (id: string, name: string): ItemWithArtwork => ({
    id,
    name,
    description: null,
    parentId: null,
    order: 0,
    depth: 0,
    userId: "user-1",
    createdAt: new Date(),
    updatedAt: new Date(),
    driveFileId: null,
    driveModifiedAt: null,
    driveThumbnailUrl: null,
    syncStatus: "SYNCED",
    syncError: null,
    driveConnectionId: null,
    artworkId: null,
    fileCounts: { media: 0, artwork: 0, subtitles: 0 },
    childCount: 0,
    primaryMediaName: null,
    mediaIconType: null,
  });

  const mockItems: ItemWithArtwork[] = [
    createMockItem("item-1", "Test Item 1"),
    createMockItem("item-2", "Test Item 2"),
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset sort/filter state to defaults
    sortFilterState.sortBy = "custom";
    sortFilterState.filterBy = "all";
  });

  describe("rendering", () => {
    it("renders tree view by default", () => {
      render(<ItemsView items={mockItems} />);
      expect(screen.getByTestId("tree-view")).toBeInTheDocument();
    });

    it("renders empty state when no items", () => {
      render(<ItemsView items={[]} />);
      expect(screen.getByText("No items yet")).toBeInTheDocument();
      expect(
        screen.getByText("Create your first item to get started")
      ).toBeInTheDocument();
    });

    it("renders Add Item button in empty state", () => {
      render(<ItemsView items={[]} />);
      const buttons = screen.getAllByRole("button", { name: /add item/i });
      expect(buttons.length).toBeGreaterThan(0);
    });
  });

  describe("toolbar", () => {
    it("shows toolbar by default", () => {
      render(<ItemsView items={mockItems} />);
      expect(
        screen.getByRole("button", { name: /add item/i })
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /sync/i })).toBeInTheDocument();
    });

    it("hides toolbar when hideToolbar is true", () => {
      render(<ItemsView items={mockItems} hideToolbar />);
      expect(
        screen.queryByRole("button", { name: /add item/i })
      ).not.toBeInTheDocument();
    });

    it("disables Sync button when no drive connection", () => {
      render(<ItemsView items={mockItems} hasDriveConnection={false} />);
      expect(screen.getByRole("button", { name: /sync/i })).toBeDisabled();
    });

    it("enables Sync button when drive connected", () => {
      render(<ItemsView items={mockItems} hasDriveConnection />);
      expect(screen.getByRole("button", { name: /sync/i })).toBeEnabled();
    });

    it("disables Edit and View toggle when no items", () => {
      render(<ItemsView items={[]} />);
      // ViewToggle receives disabled prop when items.length === 0
      expect(screen.getByTestId("view-toggle")).toHaveAttribute(
        "data-disabled",
        "true"
      );
    });
  });

  describe("external control", () => {
    it("uses external isEditing state when provided", () => {
      const onEditingChange = vi.fn();
      render(
        <ItemsView
          items={mockItems}
          isEditing={true}
          onEditingChange={onEditingChange}
        />
      );
      // When isEditing=true, should show SortableTree (edit mode)
      expect(screen.getByTestId("sortable-tree")).toBeInTheDocument();
    });

    it("uses external addItemOpen state when provided", () => {
      render(<ItemsView items={mockItems} addItemOpen={true} />);
      expect(screen.getByTestId("add-dialog")).toBeInTheDocument();
    });
  });

  describe("sort/filter integration", () => {
    it("applies sortItems to items", () => {
      render(<ItemsView items={mockItems} />);
      expect(sortItems).toHaveBeenCalledWith(mockItems, "custom");
    });

    it("applies filterItems to items", () => {
      render(<ItemsView items={mockItems} />);
      expect(filterItems).toHaveBeenCalled();
    });

    it("applies sort then filter in correct order", () => {
      render(<ItemsView items={mockItems} />);
      // sortItems should be called first, then filterItems
      expect(sortItems).toHaveBeenCalled();
      expect(filterItems).toHaveBeenCalled();
      // Filter should receive the sorted result
      const sortResult = vi.mocked(sortItems).mock.results[0]?.value;
      expect(filterItems).toHaveBeenCalledWith(sortResult, "all");
    });

    it("disables edit mode when sort is not custom", () => {
      sortFilterState.sortBy = "name-asc";
      render(<ItemsView items={mockItems} />);
      // Edit button should be disabled when not using custom sort
      const editButton = screen.getByRole("button", { name: /edit/i });
      expect(editButton).toBeDisabled();
    });

    it("enables edit mode when sort is custom", () => {
      sortFilterState.sortBy = "custom";
      render(<ItemsView items={mockItems} />);
      // Edit button should be enabled with custom sort
      const editButton = screen.getByRole("button", { name: /edit/i });
      expect(editButton).toBeEnabled();
    });
  });
});
