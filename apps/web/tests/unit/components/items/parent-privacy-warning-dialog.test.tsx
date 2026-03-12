/**
 * Tests for ParentPrivacyWarningDialog component.
 * Verifies warning messages and user interactions.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { ParentPrivacyWarningDialog } from "@/components/items/parent-privacy-warning-dialog";

describe("ParentPrivacyWarningDialog", () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    itemName: "Breaking Bad",
    affectedChildCount: 5,
    onConfirm: vi.fn(),
  };

  it("shows count of affected children", () => {
    render(<ParentPrivacyWarningDialog {...defaultProps} />);

    expect(screen.getByText(/5 child items/)).toBeInTheDocument();
  });

  it("uses singular form for 1 child", () => {
    render(
      <ParentPrivacyWarningDialog {...defaultProps} affectedChildCount={1} />
    );

    expect(screen.getByText(/1 child item/)).toBeInTheDocument();
  });

  it("shows item name in message", () => {
    render(<ParentPrivacyWarningDialog {...defaultProps} />);

    expect(screen.getByText(/"Breaking Bad"/)).toBeInTheDocument();
  });

  it("calls onConfirm when Make private clicked", async () => {
    const onConfirm = vi.fn();
    render(
      <ParentPrivacyWarningDialog {...defaultProps} onConfirm={onConfirm} />
    );

    await userEvent.click(
      screen.getByRole("button", { name: /make private/i })
    );

    expect(onConfirm).toHaveBeenCalled();
  });

  it("calls onOpenChange when Cancel clicked", async () => {
    const onOpenChange = vi.fn();
    render(
      <ParentPrivacyWarningDialog
        {...defaultProps}
        onOpenChange={onOpenChange}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: /cancel/i }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("does not render when open is false", () => {
    render(<ParentPrivacyWarningDialog {...defaultProps} open={false} />);

    expect(
      screen.queryByText(/This will affect child items/)
    ).not.toBeInTheDocument();
  });

  it("displays title with warning icon", () => {
    render(<ParentPrivacyWarningDialog {...defaultProps} />);

    expect(
      screen.getByText("This will affect child items")
    ).toBeInTheDocument();
  });

  it("displays explanation about inheriting visibility", () => {
    render(<ParentPrivacyWarningDialog {...defaultProps} />);

    expect(screen.getByText(/inherit visibility from it/)).toBeInTheDocument();
  });

  it("explains how to restore visibility", () => {
    render(<ParentPrivacyWarningDialog {...defaultProps} />);

    expect(
      screen.getByText(/change their visibility settings individually/)
    ).toBeInTheDocument();
  });

  it("handles zero affected children", () => {
    render(
      <ParentPrivacyWarningDialog {...defaultProps} affectedChildCount={0} />
    );

    // Still renders but shows 0 child items
    expect(screen.getByText(/0 child items/)).toBeInTheDocument();
  });
});
