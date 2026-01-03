/**
 * Unit tests for EditModeToggle component.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EditModeToggle } from "@/components/items/edit-mode-toggle";

describe("EditModeToggle", () => {
  it("should show 'Edit' when not editing", () => {
    render(<EditModeToggle isEditing={false} onToggle={() => {}} />);

    expect(screen.getByRole("button")).toHaveTextContent("Edit");
  });

  it("should show 'Done' when editing", () => {
    render(<EditModeToggle isEditing={true} onToggle={() => {}} />);

    expect(screen.getByRole("button")).toHaveTextContent("Done");
  });

  it("should call onToggle when clicked", () => {
    const onToggle = vi.fn();
    render(<EditModeToggle isEditing={false} onToggle={onToggle} />);

    fireEvent.click(screen.getByRole("button"));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("should have correct aria-label", () => {
    const { rerender } = render(
      <EditModeToggle isEditing={false} onToggle={() => {}} />
    );

    expect(screen.getByRole("button")).toHaveAttribute(
      "aria-label",
      "Edit items"
    );

    rerender(<EditModeToggle isEditing={true} onToggle={() => {}} />);

    expect(screen.getByRole("button")).toHaveAttribute(
      "aria-label",
      "Done editing"
    );
  });

  it("should be hidden when disabled", () => {
    render(
      <EditModeToggle isEditing={false} onToggle={() => {}} disabled={true} />
    );

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
