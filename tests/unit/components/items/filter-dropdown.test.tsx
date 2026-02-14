/**
 * Unit tests for FilterDropdown component.
 * Tests multi-select checkbox dropdown with grouped filters.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { FilterDropdown } from "@/components/items/filter-dropdown";
import type { ContentFilter } from "@/lib/types";

describe("FilterDropdown", () => {
  const defaultProps = {
    filters: [] as ContentFilter[],
    toggleFilter: vi.fn(),
    clearFilters: vi.fn(),
  };

  it("renders trigger with 'Filter' text when no filters active", () => {
    render(<FilterDropdown {...defaultProps} />);

    expect(screen.getByRole("button")).toHaveTextContent("Filter");
  });

  it("shows active count badge when filters are active", () => {
    render(
      <FilterDropdown {...defaultProps} filters={["has-files", "synced"]} />
    );

    expect(screen.getByRole("button")).toHaveTextContent("Filter (2)");
  });

  it("shows active dot indicator when filters are active", () => {
    render(<FilterDropdown {...defaultProps} filters={["has-files"]} />);

    const button = screen.getByRole("button");
    expect(button.querySelector('[data-active="true"]')).toBeInTheDocument();
  });

  it("does not show indicator when no filters active", () => {
    render(<FilterDropdown {...defaultProps} />);

    const button = screen.getByRole("button");
    expect(
      button.querySelector('[data-active="true"]')
    ).not.toBeInTheDocument();
  });

  it("shows grouped filter options in dropdown", async () => {
    const user = userEvent.setup();
    render(<FilterDropdown {...defaultProps} />);

    await user.click(screen.getByRole("button"));

    // Group headers
    expect(screen.getByText("File Status")).toBeInTheDocument();
    expect(screen.getByText("Sync Status")).toBeInTheDocument();

    // Options
    expect(screen.getByText("Has Files")).toBeInTheDocument();
    expect(screen.getByText("No Files")).toBeInTheDocument();
    expect(screen.getByText("Synced")).toBeInTheDocument();
    expect(screen.getByText("Pending Sync")).toBeInTheDocument();
    expect(screen.getByText("Sync Error")).toBeInTheDocument();
  });

  it("calls toggleFilter when checkbox option is clicked", async () => {
    const toggleFilter = vi.fn();
    const user = userEvent.setup();
    render(<FilterDropdown {...defaultProps} toggleFilter={toggleFilter} />);

    await user.click(screen.getByRole("button"));
    await user.click(screen.getByText("Has Files"));

    expect(toggleFilter).toHaveBeenCalledWith("has-files");
  });

  it("shows checked state for active filters", async () => {
    const user = userEvent.setup();
    render(<FilterDropdown {...defaultProps} filters={["has-files"]} />);

    await user.click(screen.getByRole("button"));

    // The checkbox item for "Has Files" should be checked
    const hasFilesItem = screen.getByRole("menuitemcheckbox", {
      name: "Has Files",
    });
    expect(hasFilesItem).toHaveAttribute("aria-checked", "true");
  });

  it("shows clear filters button when filters are active", async () => {
    const user = userEvent.setup();
    render(<FilterDropdown {...defaultProps} filters={["has-files"]} />);

    await user.click(screen.getByRole("button"));

    expect(
      screen.getByRole("button", { name: "Clear all filters" })
    ).toBeInTheDocument();
  });

  it("does not show clear filters button when no filters active", async () => {
    const user = userEvent.setup();
    render(<FilterDropdown {...defaultProps} />);

    await user.click(screen.getByRole("button"));

    expect(
      screen.queryByRole("button", { name: "Clear all filters" })
    ).not.toBeInTheDocument();
  });

  it("calls clearFilters when clear button is clicked", async () => {
    const clearFilters = vi.fn();
    const user = userEvent.setup();
    render(
      <FilterDropdown
        {...defaultProps}
        filters={["has-files"]}
        clearFilters={clearFilters}
      />
    );

    await user.click(screen.getByRole("button"));
    await user.click(screen.getByRole("button", { name: "Clear all filters" }));

    expect(clearFilters).toHaveBeenCalled();
  });

  it("sets correct aria-label with active count", () => {
    render(
      <FilterDropdown {...defaultProps} filters={["has-files", "synced"]} />
    );

    expect(
      screen.getByRole("button", { name: "Filter, 2 active" })
    ).toBeInTheDocument();
  });

  it("sets correct aria-label with no filters", () => {
    render(<FilterDropdown {...defaultProps} />);

    expect(screen.getByRole("button", { name: "Filter" })).toBeInTheDocument();
  });

  it("displays Filter icon", () => {
    render(<FilterDropdown {...defaultProps} />);

    expect(screen.getByRole("button").querySelector("svg")).toBeInTheDocument();
  });

  it("is disabled when disabled prop is true", () => {
    render(<FilterDropdown {...defaultProps} disabled />);

    expect(screen.getByRole("button")).toBeDisabled();
  });
});
