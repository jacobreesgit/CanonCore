/**
 * Unit tests for FilterDropdown component.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { FilterDropdown } from "@/components/items/filter-dropdown";

describe("FilterDropdown", () => {
  it("renders with current filter option", () => {
    render(<FilterDropdown value="all" onChange={() => {}} />);

    expect(screen.getByRole("button")).toHaveTextContent("All Items");
  });

  it("shows all filter options in dropdown", async () => {
    const user = userEvent.setup();
    render(<FilterDropdown value="all" onChange={() => {}} />);

    await user.click(screen.getByRole("button"));

    expect(screen.getByText("Has Files")).toBeInTheDocument();
    expect(screen.getByText("No Files")).toBeInTheDocument();
    expect(screen.getByText("Synced")).toBeInTheDocument();
    expect(screen.getByText("Pending Sync")).toBeInTheDocument();
    expect(screen.getByText("Sync Error")).toBeInTheDocument();
  });

  it("calls onChange when option is selected", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<FilterDropdown value="all" onChange={onChange} />);

    await user.click(screen.getByRole("button"));
    await user.click(screen.getByText("Has Files"));

    expect(onChange).toHaveBeenCalledWith("has-files");
  });

  it("shows visual indicator when filter is active", () => {
    render(<FilterDropdown value="has-files" onChange={() => {}} />);

    const button = screen.getByRole("button");
    expect(button).toHaveTextContent("Has Files");
    // Active filter should have dot indicator
    expect(button.querySelector('[data-active="true"]')).toBeInTheDocument();
  });

  it("does not show indicator when filter is 'all'", () => {
    render(<FilterDropdown value="all" onChange={() => {}} />);

    const button = screen.getByRole("button");
    expect(
      button.querySelector('[data-active="true"]')
    ).not.toBeInTheDocument();
  });

  it("displays Filter icon", () => {
    render(<FilterDropdown value="all" onChange={() => {}} />);

    expect(screen.getByRole("button").querySelector("svg")).toBeInTheDocument();
  });

  it("is disabled when disabled prop is true", () => {
    render(<FilterDropdown value="all" onChange={() => {}} disabled />);

    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("displays correct label for each filter option", () => {
    const { rerender } = render(
      <FilterDropdown value="no-files" onChange={() => {}} />
    );
    expect(screen.getByRole("button")).toHaveTextContent("No Files");

    rerender(<FilterDropdown value="synced" onChange={() => {}} />);
    expect(screen.getByRole("button")).toHaveTextContent("Synced");

    rerender(<FilterDropdown value="error" onChange={() => {}} />);
    expect(screen.getByRole("button")).toHaveTextContent("Sync Error");
  });
});
