/**
 * Unit tests for ItemTreePicker — extracted virtualised tree list.
 * Tests search filtering, selection modes, and depth indentation.
 *
 * Note: useVirtualizer is mocked because jsdom has no layout engine —
 * scroll containers report zero dimensions, so the virtualizer would
 * render nothing. The mock returns all items as virtual rows.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  ItemTreePicker,
  type PickerItem,
} from "@/components/items/item-tree-picker";

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

const MOCK_ITEMS: PickerItem[] = [
  { id: "1", name: "The Matrix", depth: 0, hasChildren: true },
  { id: "2", name: "Iron Man", depth: 1, hasChildren: false },
  { id: "3", name: "Avengers", depth: 1, hasChildren: false },
  { id: "4", name: "Inception", depth: 0, hasChildren: false },
];

describe("ItemTreePicker", () => {
  it("renders flat list of items", () => {
    render(
      <ItemTreePicker
        items={MOCK_ITEMS}
        selectedIds={new Set()}
        onToggle={vi.fn()}
      />
    );

    expect(screen.getByText("The Matrix")).toBeInTheDocument();
    expect(screen.getByText("Iron Man")).toBeInTheDocument();
    expect(screen.getByText("Avengers")).toBeInTheDocument();
    expect(screen.getByText("Inception")).toBeInTheDocument();
  });

  it("filters items by search query", async () => {
    const user = userEvent.setup();
    render(
      <ItemTreePicker
        items={MOCK_ITEMS}
        selectedIds={new Set()}
        onToggle={vi.fn()}
      />
    );

    const searchInput = screen.getByPlaceholderText(/search/i);
    await user.type(searchInput, "Matrix");

    expect(screen.getByText("The Matrix")).toBeInTheDocument();
    expect(screen.queryByText("Inception")).not.toBeInTheDocument();
  });

  it("calls onToggle in multi-select mode", async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();
    render(
      <ItemTreePicker
        items={MOCK_ITEMS}
        selectedIds={new Set()}
        onToggle={onToggle}
        multiSelect
      />
    );

    await user.click(screen.getByText("The Matrix"));
    expect(onToggle).toHaveBeenCalledWith("1");
  });

  it("calls onToggle in single-select mode", async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();
    render(
      <ItemTreePicker
        items={MOCK_ITEMS}
        selectedIds={new Set()}
        onToggle={onToggle}
      />
    );

    await user.click(screen.getByText("The Matrix"));
    expect(onToggle).toHaveBeenCalledWith("1");
  });

  it("shows selected state for items in selectedIds", () => {
    render(
      <ItemTreePicker
        items={MOCK_ITEMS}
        selectedIds={new Set(["1"])}
        onToggle={vi.fn()}
        multiSelect
      />
    );

    // The selected item button should have the selected class
    const matrixButton = screen.getByText("The Matrix").closest("button");
    expect(matrixButton?.className).toContain("bg-white/20");
  });
});
