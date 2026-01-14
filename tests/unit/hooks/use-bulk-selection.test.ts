/**
 * Unit tests for useBulkSelection hook.
 */

import { renderHook, act } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { useBulkSelection } from "@/hooks/use-bulk-selection";

describe("useBulkSelection", () => {
  const mockItems = [
    { id: "1", name: "Item 1" },
    { id: "2", name: "Item 2" },
    { id: "3", name: "Item 3" },
  ];

  it("starts with empty selection", () => {
    const { result } = renderHook(() => useBulkSelection(mockItems));

    expect(result.current.selectedIds.size).toBe(0);
    expect(result.current.selectionCount).toBe(0);
  });

  it("toggles single item selection", () => {
    const { result } = renderHook(() => useBulkSelection(mockItems));

    act(() => {
      result.current.toggleItem("1");
    });

    expect(result.current.selectedIds.has("1")).toBe(true);
    expect(result.current.selectionCount).toBe(1);

    act(() => {
      result.current.toggleItem("1");
    });

    expect(result.current.selectedIds.has("1")).toBe(false);
    expect(result.current.selectionCount).toBe(0);
  });

  it("selects all items", () => {
    const { result } = renderHook(() => useBulkSelection(mockItems));

    act(() => {
      result.current.selectAll();
    });

    expect(result.current.selectionCount).toBe(3);
    expect(result.current.isAllSelected).toBe(true);
  });

  it("deselects all items", () => {
    const { result } = renderHook(() => useBulkSelection(mockItems));

    act(() => {
      result.current.selectAll();
    });

    act(() => {
      result.current.deselectAll();
    });

    expect(result.current.selectionCount).toBe(0);
    expect(result.current.isAllSelected).toBe(false);
  });

  it("returns isSelected helper", () => {
    const { result } = renderHook(() => useBulkSelection(mockItems));

    act(() => {
      result.current.toggleItem("2");
    });

    expect(result.current.isSelected("1")).toBe(false);
    expect(result.current.isSelected("2")).toBe(true);
  });

  it("toggles all when some selected", () => {
    const { result } = renderHook(() => useBulkSelection(mockItems));

    act(() => {
      result.current.toggleItem("1");
    });

    expect(result.current.isPartiallySelected).toBe(true);

    act(() => {
      result.current.toggleAll();
    });

    // When partially selected, toggleAll should select all
    expect(result.current.isAllSelected).toBe(true);

    act(() => {
      result.current.toggleAll();
    });

    // When all selected, toggleAll should deselect all
    expect(result.current.selectionCount).toBe(0);
  });

  it("clears selection when items change", () => {
    const { result, rerender } = renderHook(
      ({ items }) => useBulkSelection(items),
      { initialProps: { items: mockItems } }
    );

    act(() => {
      result.current.selectAll();
    });

    expect(result.current.selectionCount).toBe(3);

    rerender({ items: [{ id: "4", name: "Item 4" }] });

    expect(result.current.selectionCount).toBe(0);
  });

  it("returns selectedItems array", () => {
    const { result } = renderHook(() => useBulkSelection(mockItems));

    act(() => {
      result.current.toggleItem("1");
      result.current.toggleItem("3");
    });

    expect(result.current.selectedItems).toHaveLength(2);
    expect(result.current.selectedItems.map((i) => i.id)).toEqual(["1", "3"]);
  });
});
