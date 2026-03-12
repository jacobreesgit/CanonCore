/**
 * Tests for ReparentWarningDialog component.
 * Verifies warning messages and user interactions.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { ReparentWarningDialog } from "@/components/items/reparent-warning-dialog";

describe("ReparentWarningDialog", () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    itemName: "Season 1",
    oldParentName: "Breaking Bad",
    newParentName: "Movies",
    willBecomePublic: false,
    willBecomePrivate: true,
    onConfirm: vi.fn(),
  };

  it("shows warning when item will become private", () => {
    render(<ReparentWarningDialog {...defaultProps} />);

    expect(screen.getByText(/will make it private/i)).toBeInTheDocument();
    expect(screen.getByText(/"Movies"/)).toBeInTheDocument();
  });

  it("shows warning when item will become public", () => {
    render(
      <ReparentWarningDialog
        {...defaultProps}
        willBecomePublic={true}
        willBecomePrivate={false}
      />
    );

    expect(
      screen.getByText(/will make it publicly visible/i)
    ).toBeInTheDocument();
  });

  it("shows generic message when visibility change is unclear", () => {
    render(
      <ReparentWarningDialog
        {...defaultProps}
        willBecomePublic={false}
        willBecomePrivate={false}
      />
    );

    expect(screen.getByText(/may affect its visibility/i)).toBeInTheDocument();
  });

  it("shows item name in message", () => {
    render(<ReparentWarningDialog {...defaultProps} />);

    expect(screen.getByText(/"Season 1"/)).toBeInTheDocument();
  });

  it("calls onConfirm when Move anyway clicked", async () => {
    const onConfirm = vi.fn();
    render(<ReparentWarningDialog {...defaultProps} onConfirm={onConfirm} />);

    await userEvent.click(screen.getByRole("button", { name: /move anyway/i }));

    expect(onConfirm).toHaveBeenCalled();
  });

  it("calls onOpenChange when Cancel clicked", async () => {
    const onOpenChange = vi.fn();
    render(
      <ReparentWarningDialog {...defaultProps} onOpenChange={onOpenChange} />
    );

    await userEvent.click(screen.getByRole("button", { name: /cancel/i }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("handles null newParentName gracefully", () => {
    render(
      <ReparentWarningDialog
        {...defaultProps}
        newParentName={null}
        willBecomePrivate={true}
      />
    );

    // When newParentName is null, message shows "to root"
    expect(screen.getByText(/to root/)).toBeInTheDocument();
  });

  it("does not render when open is false", () => {
    render(<ReparentWarningDialog {...defaultProps} open={false} />);

    expect(
      screen.queryByText(/Visibility will change/)
    ).not.toBeInTheDocument();
  });

  it("displays title with warning icon", () => {
    render(<ReparentWarningDialog {...defaultProps} />);

    expect(screen.getByText("Visibility will change")).toBeInTheDocument();
  });

  it("displays explanation about inheritance", () => {
    render(<ReparentWarningDialog {...defaultProps} />);

    expect(
      screen.getByText(/This item inherits visibility from its parent/)
    ).toBeInTheDocument();
  });
});
