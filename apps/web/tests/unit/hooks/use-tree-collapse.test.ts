/**
 * Unit tests for useTreeCollapse hook.
 */

import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTreeCollapse } from "@/hooks/use-tree-collapse";
import type { TreeItems } from "@/lib/types";

const mockItems: TreeItems = [
  {
    id: "1",
    name: "Parent 1",
    order: 0,
    depth: 0,
    parentId: null,
    children: [
      {
        id: "1-1",
        name: "Child 1",
        order: 0,
        depth: 1,
        parentId: "1",
        children: [],
      },
    ],
  },
  {
    id: "2",
    name: "Parent 2",
    order: 1,
    depth: 0,
    parentId: null,
    children: [],
  },
];

describe("useTreeCollapse", () => {
  it("should return isCollapsed as false by default", () => {
    const { result } = renderHook(() => useTreeCollapse(mockItems));
    expect(result.current.isCollapsed("1")).toBe(false);
  });

  it("should toggle collapse state", () => {
    const { result } = renderHook(() => useTreeCollapse(mockItems));

    act(() => {
      result.current.toggleCollapse("1");
    });

    expect(result.current.isCollapsed("1")).toBe(true);

    act(() => {
      result.current.toggleCollapse("1");
    });

    expect(result.current.isCollapsed("1")).toBe(false);
  });

  it("should collapse all items with children", () => {
    const { result } = renderHook(() => useTreeCollapse(mockItems));

    act(() => {
      result.current.collapseAll();
    });

    expect(result.current.isCollapsed("1")).toBe(true);
    expect(result.current.isCollapsed("2")).toBe(false); // No children
  });

  it("should expand all items", () => {
    const { result } = renderHook(() => useTreeCollapse(mockItems));

    act(() => {
      result.current.collapseAll();
    });

    act(() => {
      result.current.expandAll();
    });

    expect(result.current.isCollapsed("1")).toBe(false);
  });
});
