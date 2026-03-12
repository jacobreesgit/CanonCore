/**
 * Unit tests for MoveToDialog component.
 * Tests item loading, descendant exclusion, root option, move action, and error states.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MoveToDialog } from "@/components/items/move-to-dialog";

// Mock useIsMobile — default to desktop
vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: vi.fn(() => false),
}));

// Mock server actions
vi.mock("@/lib/item-actions", () => ({
  getAllItems: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/config/items", () => ({
  MAX_ITEM_DEPTH: 5,
}));

// Mock TanStack Virtual — jsdom has no layout, virtualizer returns 0 items
vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: vi.fn(({ count }: { count: number }) => ({
    getTotalSize: () => count * 40,
    getVirtualItems: () =>
      Array.from({ length: count }, (_, i) => ({
        index: i,
        key: String(i),
        start: i * 40,
        size: 40,
      })),
    measureElement: vi.fn(),
  })),
}));

import { getAllItems } from "@/lib/item-actions";
import { toast } from "sonner";

const mockGetAllItems = vi.mocked(getAllItems);
const mockToast = vi.mocked(toast);

/** Minimal mock satisfying ItemWithArtwork shape for the fields the dialog reads. */
const mockItem = (overrides: {
  id: string;
  name: string;
  depth: number;
  parentId: string | null;
}) => ({
  ...overrides,
  description: null,
  order: 0,
  userId: "user-1",
  isPublic: false,
  inheritVisibility: false,
  pinnedOrder: null,
  tmdbId: null,
  tmdbType: null,
  tmdbPosterPath: null,
  tmdbBackdropPath: null,
  tmdbLogoPath: null,
  tmdbShowTagline: true,
  tmdbShowMetadata: true,
  tmdbShowGenres: true,
  tmdbShowCast: true,
  tmdbShowProviders: true,
  tmdbShowVideos: true,
  tmdbShowRecommendations: true,
  dominantColour: null,
  artworkId: null,
  driveFileId: null,
  driveModifiedAt: null,
  driveThumbnailUrl: null,
  syncStatus: "SYNCED" as const,
  syncError: null,
  driveConnectionId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  fileCounts: { media: 0, artwork: 0, subtitles: 0 },
  childCount: 0,
  primaryMediaName: null,
  mediaIconType: null,
  progress: null,
  primaryDurationMs: null,
  primaryHeight: null,
});

const baseProps = {
  open: true,
  onOpenChange: vi.fn(),
  itemId: "item-1",
  itemName: "Test Item",
  currentParentId: null,
  onMove: vi.fn(),
};

describe("MoveToDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAllItems.mockResolvedValue({
      success: true,
      data: [
        mockItem({ id: "item-1", name: "Test Item", depth: 0, parentId: null }),
        mockItem({
          id: "folder-a",
          name: "Folder A",
          depth: 0,
          parentId: null,
        }),
        mockItem({
          id: "folder-b",
          name: "Folder B",
          depth: 0,
          parentId: null,
        }),
        mockItem({
          id: "child-1",
          name: "Child of Test",
          depth: 1,
          parentId: "item-1",
        }),
      ],
    });
  });

  it("renders dialog title with item name", async () => {
    render(<MoveToDialog {...baseProps} />);

    expect(screen.getByText(/Test Item/)).toBeInTheDocument();
    expect(
      screen.getByText("Choose a new location for this item.")
    ).toBeInTheDocument();
  });

  it("shows root option and available folders after loading", async () => {
    render(<MoveToDialog {...baseProps} />);

    await waitFor(() => {
      expect(screen.getByText("My Items (Root)")).toBeInTheDocument();
    });

    // Folder A and B should be visible (not self or descendant)
    expect(screen.getByText("Folder A")).toBeInTheDocument();
    expect(screen.getByText("Folder B")).toBeInTheDocument();
  });

  it("excludes self and descendants from the picker", async () => {
    render(<MoveToDialog {...baseProps} />);

    await waitFor(() => {
      expect(screen.getByText("Folder A")).toBeInTheDocument();
    });

    // "Test Item" and "Child of Test" should not appear as selectable options
    expect(screen.queryByText("Child of Test")).not.toBeInTheDocument();
  });

  it("closes dialog without calling onMove when destination unchanged", async () => {
    const user = userEvent.setup();
    const onMove = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <MoveToDialog
        {...baseProps}
        onMove={onMove}
        onOpenChange={onOpenChange}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("My Items (Root)")).toBeInTheDocument();
    });

    // currentParentId is null, selectedId defaults to null — no change
    await user.click(screen.getByRole("button", { name: /^Move$/ }));

    expect(onMove).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("calls onMove with selected folder ID", async () => {
    const user = userEvent.setup();
    const onMove = vi.fn().mockResolvedValue({ success: true });

    render(<MoveToDialog {...baseProps} onMove={onMove} />);

    await waitFor(() => {
      expect(screen.getByText("Folder A")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Folder A"));
    await user.click(screen.getByRole("button", { name: /^Move$/ }));

    expect(onMove).toHaveBeenCalledWith("folder-a");
  });

  it("shows success toast on successful move", async () => {
    const user = userEvent.setup();
    const onMove = vi.fn().mockResolvedValue({ success: true });

    render(<MoveToDialog {...baseProps} onMove={onMove} />);

    await waitFor(() => {
      expect(screen.getByText("Folder A")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Folder A"));
    await user.click(screen.getByRole("button", { name: /^Move$/ }));

    await waitFor(() => {
      expect(mockToast.success).toHaveBeenCalledWith('Moved "Test Item"');
    });
  });

  it("shows error toast on failed move", async () => {
    const user = userEvent.setup();
    const onMove = vi.fn().mockResolvedValue({ error: "Permission denied" });

    render(<MoveToDialog {...baseProps} onMove={onMove} />);

    await waitFor(() => {
      expect(screen.getByText("Folder A")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Folder A"));
    await user.click(screen.getByRole("button", { name: /^Move$/ }));

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Permission denied");
    });
  });

  it("shows error state when fetch fails", async () => {
    mockGetAllItems.mockResolvedValue({
      error: "Failed to load",
    });

    render(<MoveToDialog {...baseProps} />);

    await waitFor(() => {
      expect(screen.getByText("Failed to load")).toBeInTheDocument();
    });
  });

  it("closes dialog on cancel click", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    render(<MoveToDialog {...baseProps} onOpenChange={onOpenChange} />);

    await waitFor(() => {
      expect(screen.getByText("My Items (Root)")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
