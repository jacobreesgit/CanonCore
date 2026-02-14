/**
 * Unit tests for ContentToolbar sort/filter functionality.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ContentToolbar } from "@/components/ui/content-toolbar";
import type { ContentFilter } from "@/lib/types";

// Mock MobileOptionsSheet to simplify tests
vi.mock("@/components/items/mobile-options-sheet", () => ({
  MobileOptionsSheet: () => (
    <div data-testid="mobile-options-sheet">Mobile Sheet</div>
  ),
}));

describe("ContentToolbar Sort/Filter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders sort dropdown when props are provided", () => {
    render(
      <ContentToolbar
        sortBy="custom"
        onSortChange={() => {}}
        filters={[] as ContentFilter[]}
        toggleFilter={() => {}}
        clearFilters={() => {}}
      />
    );

    expect(screen.getByText("Custom Order")).toBeInTheDocument();
  });

  it("renders filter dropdown when props are provided", () => {
    render(
      <ContentToolbar
        sortBy="custom"
        onSortChange={() => {}}
        filters={[] as ContentFilter[]}
        toggleFilter={() => {}}
        clearFilters={() => {}}
      />
    );

    expect(screen.getByText("Filter")).toBeInTheDocument();
  });

  it("calls onSortChange when sort option is selected", async () => {
    const onSortChange = vi.fn();
    const user = userEvent.setup();

    render(
      <ContentToolbar
        sortBy="custom"
        onSortChange={onSortChange}
        filters={[] as ContentFilter[]}
        toggleFilter={() => {}}
        clearFilters={() => {}}
      />
    );

    // Open sort dropdown
    await user.click(screen.getByText("Custom Order"));
    // Select different option
    await user.click(screen.getByText("Name A-Z"));

    expect(onSortChange).toHaveBeenCalledWith("name-asc");
  });

  it("calls toggleFilter when filter checkbox is toggled", async () => {
    const toggleFilter = vi.fn();
    const user = userEvent.setup();

    render(
      <ContentToolbar
        sortBy="custom"
        onSortChange={() => {}}
        filters={[] as ContentFilter[]}
        toggleFilter={toggleFilter}
        clearFilters={() => {}}
      />
    );

    // Open filter dropdown
    await user.click(screen.getByText("Filter"));
    // Click a checkbox item
    await user.click(screen.getByText("Has Files"));

    expect(toggleFilter).toHaveBeenCalledWith("has-files");
  });

  it("disables sort dropdown when no items", () => {
    render(
      <ContentToolbar
        sortBy="custom"
        onSortChange={() => {}}
        filters={[] as ContentFilter[]}
        toggleFilter={() => {}}
        clearFilters={() => {}}
        disabled
      />
    );

    // Sort dropdown button should be disabled
    expect(screen.getByText("Custom Order").closest("button")).toBeDisabled();
  });
});
