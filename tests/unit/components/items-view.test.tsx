/**
 * Unit tests for ItemsView component.
 * Tests rendering, toolbar, empty state, external control, and sort/filter.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ItemsView } from "@/components/items/items-view";
import type {
  ItemWithArtwork,
  SortOption,
  ContentFilter,
  ViewMode,
} from "@/lib/types";
import { sortItems, filterItems } from "@/lib/item-utils";

// URL state module - must be separate to avoid hoisting issues
const urlState = {
  sortBy: "custom" as SortOption,
  filters: [] as ContentFilter[],
  viewMode: "tree" as ViewMode,
};

// Mock useItemsUrlState hook
vi.mock("@/hooks/use-items-url-state", () => ({
  useItemsUrlState: () => ({
    sortBy: urlState.sortBy,
    setSortBy: vi.fn(),
    filters: urlState.filters,
    toggleFilter: vi.fn(),
    clearFilters: vi.fn(),
    hasActiveFilters: urlState.filters.length > 0,
    viewMode: urlState.viewMode,
    setViewMode: vi.fn(),
    tab: null,
    setTab: vi.fn(),
    isCustomSort: urlState.sortBy === "custom",
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
  deleteItems: vi
    .fn()
    .mockResolvedValue({ success: true, data: { deleted: 2, skipped: 0 } }),
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

// Mock tree/grid components
vi.mock("@/components/sortable-tree", () => ({
  SortableTree: ({ items }: { items: unknown[] }) => (
    <div aria-label="sortable tree">{items.length} items</div>
  ),
  Tree: ({ items }: { items: unknown[] }) => (
    <div aria-label="tree view">{items.length} items</div>
  ),
}));

vi.mock("@/components/sortable-grid", () => ({
  SortableGrid: ({ items }: { items: unknown[] }) => (
    <div aria-label="sortable grid">{items.length} items</div>
  ),
  Grid: ({ items }: { items: unknown[] }) => (
    <div aria-label="grid view">{items.length} items</div>
  ),
}));

// Mock dialogs
vi.mock("@/components/items/add-item-dialog", () => ({
  AddItemDialog: ({ open }: { open: boolean }) =>
    open ? <div>Add Dialog</div> : null,
}));

vi.mock("@/components/items/item-settings-dialog", () => ({
  ItemSettingsDialog: ({ open }: { open: boolean }) =>
    open ? <div>Settings Dialog</div> : null,
}));

describe("ItemsView", () => {
  const createMockItem = (id: string, name: string): ItemWithArtwork => ({
    id,
    name,
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
    driveFileId: null,
    driveModifiedAt: null,
    driveThumbnailUrl: null,
    syncStatus: "SYNCED",
    syncError: null,
    driveConnectionId: null,
    tmdbPosterPath: null,
    tmdbBackdropPath: null,
    artworkId: null,
    fileCounts: { media: 0, artwork: 0, subtitles: 0 },
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
  });

  const mockItems: ItemWithArtwork[] = [
    createMockItem("item-1", "Test Item 1"),
    createMockItem("item-2", "Test Item 2"),
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset URL state to defaults
    urlState.sortBy = "custom";
    urlState.filters = [];
    urlState.viewMode = "tree";
  });

  describe("rendering", () => {
    it("renders tree view by default", () => {
      render(<ItemsView items={mockItems} />);
      expect(screen.getByLabelText("tree view")).toBeInTheDocument();
    });

    it("renders empty state when no items", () => {
      render(<ItemsView items={[]} />);
      expect(screen.getByText("No items yet")).toBeInTheDocument();
      expect(screen.getByText(/create your first item/i)).toBeInTheDocument();
    });
  });

  describe("external control", () => {
    it("uses external isEditing state when provided", async () => {
      const onEditingChange = vi.fn();
      render(
        <ItemsView
          items={mockItems}
          isEditing={true}
          onEditingChange={onEditingChange}
        />
      );
      // When isEditing=true, SortableTree is dynamically imported
      // Wait for it to appear
      await waitFor(() => {
        expect(screen.getByLabelText("sortable tree")).toBeInTheDocument();
      });
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
      // Filter should receive the sorted result with empty filters array
      const sortResult = vi.mocked(sortItems).mock.results[0]?.value;
      expect(filterItems).toHaveBeenCalledWith(sortResult, []);
    });
  });

  describe("empty states", () => {
    it("shows first-time empty state when no items and no filter", () => {
      urlState.filters = [];
      render(
        <ItemsView items={[]} parentId={null} hasDriveConnection={false} />
      );

      expect(screen.getByText("No items yet")).toBeInTheDocument();
      expect(screen.getByText(/create your first item/i)).toBeInTheDocument();
    });

    it("shows no-children empty state on detail page with no children", () => {
      urlState.filters = [];
      render(
        <ItemsView
          items={[]}
          parentId="parent-123"
          hasDriveConnection={false}
        />
      );

      expect(screen.getByText("No child items")).toBeInTheDocument();
    });

    it("shows filter-empty state when filter active and no results", () => {
      urlState.filters = ["has-files"];
      render(
        <ItemsView items={[]} parentId={null} hasDriveConnection={false} />
      );

      expect(screen.getByText("No matching items")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /clear filter/i })
      ).toBeInTheDocument();
    });
  });

  describe("bulk delete", () => {
    it("shows bulk actions toolbar in edit mode", () => {
      render(<ItemsView items={mockItems} isEditing={true} />);

      // Toolbar should be visible with Select All button (no checkbox)
      expect(
        screen.getByRole("button", { name: /select all/i })
      ).toBeInTheDocument();
    });

    it("shows confirmation dialog when delete button clicked", async () => {
      const user = userEvent.setup();
      render(<ItemsView items={mockItems} isEditing={true} />);

      // Select all items via Select All button
      const selectAllButton = screen.getByRole("button", {
        name: /select all/i,
      });
      await user.click(selectAllButton);

      // Click delete button
      const deleteButton = screen.getByRole("button", { name: /delete/i });
      await user.click(deleteButton);

      // Confirmation dialog should appear
      await waitFor(() => {
        expect(screen.getByText("Delete Items")).toBeInTheDocument();
        expect(
          screen.getByText(/are you sure you want to delete 2 items/i)
        ).toBeInTheDocument();
      });
    });

    it("closes confirmation dialog when cancel clicked", async () => {
      const user = userEvent.setup();
      render(<ItemsView items={mockItems} isEditing={true} />);

      // Select all and click delete
      await user.click(screen.getByRole("button", { name: /select all/i }));
      await user.click(screen.getByRole("button", { name: /delete/i }));

      // Wait for dialog
      await waitFor(() => {
        expect(screen.getByText("Delete Items")).toBeInTheDocument();
      });

      // Click cancel
      await user.click(screen.getByRole("button", { name: /cancel/i }));

      // Dialog should close
      await waitFor(() => {
        expect(screen.queryByText("Delete Items")).not.toBeInTheDocument();
      });
    });

    it("executes delete when confirmed in dialog", async () => {
      const { deleteItems } = await import("@/lib/item-actions");
      const user = userEvent.setup();
      render(<ItemsView items={mockItems} isEditing={true} />);

      // Select all and click delete
      await user.click(screen.getByRole("button", { name: /select all/i }));
      await user.click(screen.getByRole("button", { name: /delete/i }));

      // Wait for dialog and confirm
      await waitFor(() => {
        expect(screen.getByText("Delete Items")).toBeInTheDocument();
      });

      // Click the confirm Delete button in the dialog
      const dialogDeleteButton = screen.getByRole("button", { name: "Delete" });
      await user.click(dialogDeleteButton);

      // deleteItems should be called
      await waitFor(() => {
        expect(deleteItems).toHaveBeenCalledWith(["item-1", "item-2"]);
      });
    });
  });
});
