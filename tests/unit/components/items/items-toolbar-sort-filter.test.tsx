/**
 * Unit tests for ItemsToolbar sort/filter functionality.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ItemsToolbar } from "@/components/items/items-toolbar";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

// Mock server actions
vi.mock("@/lib/item-file-actions", () => ({
  getItemFiles: vi.fn().mockResolvedValue({
    success: true,
    data: { media: [], artwork: [], subtitles: [] },
  }),
}));

vi.mock("@/lib/google-drive-sync", () => ({
  syncFromGoogleDrive: vi.fn().mockResolvedValue({ success: true }),
}));

describe("ItemsToolbar Sort/Filter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders sort dropdown when props are provided", () => {
    render(
      <ItemsToolbar
        hasItems={true}
        sortBy="custom"
        onSortChange={() => {}}
        filterBy="all"
        onFilterChange={() => {}}
      />
    );

    expect(screen.getByText("Custom Order")).toBeInTheDocument();
  });

  it("renders filter dropdown when props are provided", () => {
    render(
      <ItemsToolbar
        hasItems={true}
        sortBy="custom"
        onSortChange={() => {}}
        filterBy="all"
        onFilterChange={() => {}}
      />
    );

    expect(screen.getByText("All Items")).toBeInTheDocument();
  });

  it("calls onSortChange when sort option is selected", async () => {
    const onSortChange = vi.fn();
    const user = userEvent.setup();

    render(
      <ItemsToolbar
        hasItems={true}
        sortBy="custom"
        onSortChange={onSortChange}
        filterBy="all"
        onFilterChange={() => {}}
      />
    );

    // Open sort dropdown
    await user.click(screen.getByText("Custom Order"));
    // Select different option
    await user.click(screen.getByText("Name A-Z"));

    expect(onSortChange).toHaveBeenCalledWith("name-asc");
  });

  it("calls onFilterChange when filter option is selected", async () => {
    const onFilterChange = vi.fn();
    const user = userEvent.setup();

    render(
      <ItemsToolbar
        hasItems={true}
        sortBy="custom"
        onSortChange={() => {}}
        filterBy="all"
        onFilterChange={onFilterChange}
      />
    );

    // Open filter dropdown
    await user.click(screen.getByText("All Items"));
    // Select different option
    await user.click(screen.getByText("Has Files"));

    expect(onFilterChange).toHaveBeenCalledWith("has-files");
  });

  it("disables edit mode toggle when sort is not custom", () => {
    render(
      <ItemsToolbar
        hasItems={true}
        isEditing={false}
        onEditToggle={() => {}}
        sortBy="name-asc"
        onSortChange={() => {}}
        filterBy="all"
        onFilterChange={() => {}}
      />
    );

    // Edit button should be disabled when not using custom sort
    const editButton = screen.getByRole("button", { name: /edit/i });
    expect(editButton).toBeDisabled();
  });

  it("enables edit mode toggle when sort is custom", () => {
    render(
      <ItemsToolbar
        hasItems={true}
        isEditing={false}
        onEditToggle={() => {}}
        sortBy="custom"
        onSortChange={() => {}}
        filterBy="all"
        onFilterChange={() => {}}
      />
    );

    // Edit button should be enabled with custom sort
    const editButton = screen.getByRole("button", { name: /edit/i });
    expect(editButton).not.toBeDisabled();
  });

  it("disables sort dropdown when no items", () => {
    render(
      <ItemsToolbar
        hasItems={false}
        sortBy="custom"
        onSortChange={() => {}}
        filterBy="all"
        onFilterChange={() => {}}
      />
    );

    // Sort dropdown button should be disabled
    expect(screen.getByText("Custom Order").closest("button")).toBeDisabled();
  });
});
