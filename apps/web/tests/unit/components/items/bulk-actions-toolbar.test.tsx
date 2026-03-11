/**
 * Unit tests for BulkActionsToolbar component.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { BulkActionsToolbar } from "@/components/items/bulk-actions-toolbar";

describe("BulkActionsToolbar", () => {
  const defaultProps = {
    selectionCount: 0,
    isAllSelected: false,
    onSelectAll: () => {},
    onDeselectAll: () => {},
    onDelete: () => {},
    isDeleting: false,
  };

  it("renders selection count when items selected", () => {
    render(<BulkActionsToolbar {...defaultProps} selectionCount={5} />);

    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("items selected")).toBeInTheDocument();
  });

  it("renders 'Select items' when no items selected", () => {
    render(<BulkActionsToolbar {...defaultProps} />);

    expect(screen.getByText("Select items")).toBeInTheDocument();
  });

  it("renders Select All button", () => {
    render(<BulkActionsToolbar {...defaultProps} />);

    expect(
      screen.getByRole("button", { name: "Select All" })
    ).toBeInTheDocument();
  });

  it("shows Deselect All button when all selected", () => {
    render(
      <BulkActionsToolbar {...defaultProps} selectionCount={5} isAllSelected />
    );

    expect(
      screen.getByRole("button", { name: "Deselect All" })
    ).toBeInTheDocument();
  });

  it("calls onSelectAll when Select All button clicked", async () => {
    const onSelectAll = vi.fn();
    const user = userEvent.setup();
    render(<BulkActionsToolbar {...defaultProps} onSelectAll={onSelectAll} />);

    await user.click(screen.getByRole("button", { name: "Select All" }));

    expect(onSelectAll).toHaveBeenCalled();
  });

  it("calls onDeselectAll when Deselect All button clicked", async () => {
    const onDeselectAll = vi.fn();
    const user = userEvent.setup();
    render(
      <BulkActionsToolbar
        {...defaultProps}
        selectionCount={5}
        isAllSelected
        onDeselectAll={onDeselectAll}
      />
    );

    await user.click(screen.getByRole("button", { name: "Deselect All" }));

    expect(onDeselectAll).toHaveBeenCalled();
  });

  it("renders delete button when items selected", () => {
    render(<BulkActionsToolbar {...defaultProps} selectionCount={3} />);

    const deleteButton = screen.getByRole("button", { name: /delete/i });
    expect(deleteButton).toBeInTheDocument();
    expect(deleteButton).not.toBeDisabled();
  });

  it("disables delete button when no items selected", () => {
    render(<BulkActionsToolbar {...defaultProps} />);

    expect(screen.getByRole("button", { name: /delete/i })).toBeDisabled();
  });

  it("calls onDelete when delete button clicked", async () => {
    const onDelete = vi.fn();
    const user = userEvent.setup();
    render(
      <BulkActionsToolbar
        {...defaultProps}
        selectionCount={2}
        onDelete={onDelete}
      />
    );

    await user.click(screen.getByRole("button", { name: /delete/i }));

    expect(onDelete).toHaveBeenCalled();
  });

  it("shows loading state when deleting", () => {
    render(
      <BulkActionsToolbar {...defaultProps} selectionCount={2} isDeleting />
    );

    expect(screen.getByRole("button", { name: /deleting/i })).toBeDisabled();
  });
});
