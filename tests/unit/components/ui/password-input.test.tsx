/**
 * Unit tests for PasswordInput component.
 * Tests visibility toggle and input behavior.
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PasswordInput } from "@/components/ui/password-input";

describe("PasswordInput", () => {
  it("renders with password type by default", () => {
    render(<PasswordInput placeholder="Password" />);

    const input = screen.getByPlaceholderText("Password");
    expect(input).toHaveAttribute("type", "password");
  });

  it("toggles visibility when button is clicked", async () => {
    const user = userEvent.setup();
    render(<PasswordInput placeholder="Password" />);

    const input = screen.getByPlaceholderText("Password");
    const toggleButton = screen.getByRole("button", { name: /show password/i });

    // Initially password is hidden
    expect(input).toHaveAttribute("type", "password");

    // Click to show password
    await user.click(toggleButton);
    expect(input).toHaveAttribute("type", "text");
    expect(
      screen.getByRole("button", { name: /hide password/i })
    ).toBeInTheDocument();

    // Click to hide password again
    await user.click(toggleButton);
    expect(input).toHaveAttribute("type", "password");
  });

  it("forwards ref correctly", () => {
    const ref = { current: null as HTMLInputElement | null };
    render(<PasswordInput ref={ref} />);

    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });

  it("passes through input props", () => {
    render(
      <PasswordInput
        placeholder="Enter password"
        required
        disabled
        aria-describedby="help-text"
      />
    );

    const input = screen.getByPlaceholderText("Enter password");
    expect(input).toBeRequired();
    expect(input).toBeDisabled();
    expect(input).toHaveAttribute("aria-describedby", "help-text");
  });

  it("applies custom className", () => {
    render(<PasswordInput className="custom-class" placeholder="Password" />);

    const input = screen.getByPlaceholderText("Password");
    expect(input).toHaveClass("custom-class");
  });

  it("handles value changes", async () => {
    const user = userEvent.setup();
    render(<PasswordInput placeholder="Password" />);

    const input = screen.getByPlaceholderText("Password");
    await user.type(input, "secret123");

    expect(input).toHaveValue("secret123");
  });
});
