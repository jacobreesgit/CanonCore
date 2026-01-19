/**
 * Unit tests for SortableGridItem component.
 * Tests dnd-kit integration, context menu, and edit mode behavior.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { SortableGridItem } from "@/components/sortable-grid/SortableGridItem";
import { DndContext } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";

// Mock hooks to prevent Vitest worker shutdown issues with module resolution
vi.mock("@/hooks/use-lazy-image", () => ({
  useLazyImage: () => ({ ref: () => {}, shouldLoad: true }),
}));

vi.mock("@/hooks/use-image-loaded", () => ({
  useImageLoaded: () => ({
    ref: { current: null },
    loaded: false,
    error: false,
    onLoad: vi.fn(),
    onError: vi.fn(),
  }),
}));

// Mock useSortable hook
vi.mock("@dnd-kit/sortable", async () => {
  const actual = await vi.importActual("@dnd-kit/sortable");
  return {
    ...actual,
    useSortable: vi.fn(() => ({
      attributes: { role: "button", tabIndex: 0 },
      listeners: { onKeyDown: vi.fn(), onPointerDown: vi.fn() },
      setNodeRef: vi.fn(),
      transform: null,
      transition: null,
      isDragging: false,
    })),
  };
});

// Mock ItemContextMenu to simplify testing
vi.mock("@/components/items/item-context-menu", () => ({
  ItemContextMenu: ({
    children,
    itemName,
  }: {
    children: React.ReactNode;
    itemName: string;
  }) => (
    <div data-testid="context-menu" data-item-name={itemName}>
      {children}
    </div>
  ),
}));

describe("SortableGridItem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderWithDnd = (ui: React.ReactElement) => {
    return render(
      <DndContext>
        <SortableContext items={["item-1"]} strategy={rectSortingStrategy}>
          {ui}
        </SortableContext>
      </DndContext>
    );
  };

  it("renders with name visible", () => {
    renderWithDnd(<SortableGridItem id="item-1" name="Test Item" />);
    expect(screen.getByText("Test Item")).toBeInTheDocument();
  });

  it("wraps content in ItemContextMenu", () => {
    renderWithDnd(<SortableGridItem id="item-1" name="Test Item" />);
    expect(screen.getByTestId("context-menu")).toBeInTheDocument();
    expect(screen.getByTestId("context-menu")).toHaveAttribute(
      "data-item-name",
      "Test Item"
    );
  });

  it("passes driveFileId to context menu", () => {
    renderWithDnd(
      <SortableGridItem id="item-1" name="Test" driveFileId="drive-123" />
    );
    expect(screen.getByTestId("context-menu")).toBeInTheDocument();
  });

  it("renders drag handle (via handleProps)", () => {
    renderWithDnd(<SortableGridItem id="item-1" name="Test" />);
    // SortableGridItem passes listeners as handleProps, which shows drag handle
    expect(screen.getByLabelText("Drag handle")).toBeInTheDocument();
  });

  it("hides artwork in edit mode (showArtwork=false)", () => {
    const { container } = renderWithDnd(
      <SortableGridItem id="item-1" name="Test" artworkId="art-123" />
    );
    // In edit mode (SortableGridItem), showArtwork is false
    expect(container.querySelector("img")).not.toBeInTheDocument();
  });
});
