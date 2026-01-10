/**
 * Unit tests for EditModeToggle component.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EditModeToggle } from "@/components/items/edit-mode-toggle";

describe("EditModeToggle", () => {
  it("should show 'Edit Mode' when not editing", () => {
    render(<EditModeToggle isEditing={false} onToggle={() => {}} />);

    expect(screen.getByRole("button")).toHaveTextContent("Edit Mode");
  });

  it("should show 'View Mode' when editing", () => {
    render(<EditModeToggle isEditing={true} onToggle={() => {}} />);

    expect(screen.getByRole("button")).toHaveTextContent("View Mode");
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
      "Enter edit mode"
    );

    rerender(<EditModeToggle isEditing={true} onToggle={() => {}} />);

    expect(screen.getByRole("button")).toHaveAttribute(
      "aria-label",
      "Exit edit mode"
    );
  });

  it("should be disabled when disabled prop is true", () => {
    render(
      <EditModeToggle isEditing={false} onToggle={() => {}} disabled={true} />
    );

    expect(screen.getByRole("button")).toBeDisabled();
  });
});
