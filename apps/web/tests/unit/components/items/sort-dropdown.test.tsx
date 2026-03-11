/**
 * Unit tests for SortDropdown component.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { SortDropdown } from "@/components/items/sort-dropdown";

describe("SortDropdown", () => {
  it("renders with current sort option", () => {
    render(<SortDropdown value="custom" onChange={() => {}} />);

    expect(screen.getByRole("button")).toHaveTextContent("Custom Order");
  });

  it("shows all sort options in dropdown", async () => {
    const user = userEvent.setup();
    render(<SortDropdown value="custom" onChange={() => {}} />);

    await user.click(screen.getByRole("button"));

    expect(screen.getByText("Name A-Z")).toBeInTheDocument();
    expect(screen.getByText("Name Z-A")).toBeInTheDocument();
    expect(screen.getByText("Newest First")).toBeInTheDocument();
    expect(screen.getByText("Oldest First")).toBeInTheDocument();
    expect(screen.getByText("Recently Updated")).toBeInTheDocument();
  });

  it("calls onChange when option is selected", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<SortDropdown value="custom" onChange={onChange} />);

    await user.click(screen.getByRole("button"));
    await user.click(screen.getByText("Name A-Z"));

    expect(onChange).toHaveBeenCalledWith("name-asc");
  });

  it("shows check mark on selected option", async () => {
    const user = userEvent.setup();
    render(<SortDropdown value="name-asc" onChange={() => {}} />);

    await user.click(screen.getByRole("button"));

    // Get all radio items and find the checked one
    const radioItems = screen.getAllByRole("menuitemradio");
    const checkedItem = radioItems.find(
      (item) => item.getAttribute("data-state") === "checked"
    );
    expect(checkedItem).toHaveTextContent("Name A-Z");
  });

  it("displays ArrowUpDown icon", () => {
    render(<SortDropdown value="custom" onChange={() => {}} />);

    expect(screen.getByRole("button").querySelector("svg")).toBeInTheDocument();
  });

  it("is disabled when disabled prop is true", () => {
    render(<SortDropdown value="custom" onChange={() => {}} disabled />);

    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("displays correct label for each sort option", () => {
    const { rerender } = render(
      <SortDropdown value="name-desc" onChange={() => {}} />
    );
    expect(screen.getByRole("button")).toHaveTextContent("Name Z-A");

    rerender(<SortDropdown value="created-desc" onChange={() => {}} />);
    expect(screen.getByRole("button")).toHaveTextContent("Newest First");

    rerender(<SortDropdown value="updated-desc" onChange={() => {}} />);
    expect(screen.getByRole("button")).toHaveTextContent("Recently Updated");
  });
});
