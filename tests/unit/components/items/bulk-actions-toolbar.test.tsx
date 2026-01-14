/**
 * Unit tests for BulkActionsToolbar component.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { BulkActionsToolbar } from "@/components/items/bulk-actions-toolbar";

describe("BulkActionsToolbar", () => {
  it("renders selection count", () => {
    render(
      <BulkActionsToolbar
        selectionCount={5}
        isAllSelected={false}
        isPartiallySelected={true}
        onToggleAll={() => {}}
        onDelete={() => {}}
        isDeleting={false}
      />
    );

    expect(screen.getByText("5 selected")).toBeInTheDocument();
  });

  it("renders select all checkbox", () => {
    render(
      <BulkActionsToolbar
        selectionCount={0}
        isAllSelected={false}
        isPartiallySelected={false}
        onToggleAll={() => {}}
        onDelete={() => {}}
        isDeleting={false}
      />
    );

    expect(screen.getByRole("checkbox")).toBeInTheDocument();
  });

  it("shows checkbox as checked when all selected", () => {
    render(
      <BulkActionsToolbar
        selectionCount={5}
        isAllSelected={true}
        isPartiallySelected={false}
        onToggleAll={() => {}}
        onDelete={() => {}}
        isDeleting={false}
      />
    );

    expect(screen.getByRole("checkbox")).toBeChecked();
  });

  it("shows checkbox as indeterminate when partially selected", () => {
    render(
      <BulkActionsToolbar
        selectionCount={2}
        isAllSelected={false}
        isPartiallySelected={true}
        onToggleAll={() => {}}
        onDelete={() => {}}
        isDeleting={false}
      />
    );

    expect(screen.getByRole("checkbox")).toHaveAttribute(
      "data-state",
      "indeterminate"
    );
  });

  it("calls onToggleAll when checkbox clicked", async () => {
    const onToggleAll = vi.fn();
    const user = userEvent.setup();
    render(
      <BulkActionsToolbar
        selectionCount={0}
        isAllSelected={false}
        isPartiallySelected={false}
        onToggleAll={onToggleAll}
        onDelete={() => {}}
        isDeleting={false}
      />
    );

    await user.click(screen.getByRole("checkbox"));

    expect(onToggleAll).toHaveBeenCalled();
  });

  it("renders delete button when items selected", () => {
    render(
      <BulkActionsToolbar
        selectionCount={3}
        isAllSelected={false}
        isPartiallySelected={true}
        onToggleAll={() => {}}
        onDelete={() => {}}
        isDeleting={false}
      />
    );

    expect(
      screen.getByRole("button", { name: /delete 3/i })
    ).toBeInTheDocument();
  });

  it("hides delete button when no items selected", () => {
    render(
      <BulkActionsToolbar
        selectionCount={0}
        isAllSelected={false}
        isPartiallySelected={false}
        onToggleAll={() => {}}
        onDelete={() => {}}
        isDeleting={false}
      />
    );

    expect(
      screen.queryByRole("button", { name: /delete/i })
    ).not.toBeInTheDocument();
  });

  it("calls onDelete when delete button clicked", async () => {
    const onDelete = vi.fn();
    const user = userEvent.setup();
    render(
      <BulkActionsToolbar
        selectionCount={2}
        isAllSelected={false}
        isPartiallySelected={true}
        onToggleAll={() => {}}
        onDelete={onDelete}
        isDeleting={false}
      />
    );

    await user.click(screen.getByRole("button", { name: /delete 2/i }));

    expect(onDelete).toHaveBeenCalled();
  });

  it("shows loading state when deleting", () => {
    render(
      <BulkActionsToolbar
        selectionCount={2}
        isAllSelected={false}
        isPartiallySelected={true}
        onToggleAll={() => {}}
        onDelete={() => {}}
        isDeleting={true}
      />
    );

    expect(screen.getByRole("button", { name: /deleting/i })).toBeDisabled();
  });
});
