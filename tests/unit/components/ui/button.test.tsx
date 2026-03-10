import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button } from "@/components/ui/button";

describe("Button", () => {
  it("renders children normally", () => {
    render(<Button>Click me</Button>);
    expect(
      screen.getByRole("button", { name: "Click me" })
    ).toBeInTheDocument();
  });

  it("shows loading state with spinner and loadingText", () => {
    render(
      <Button loading loadingText="Saving...">
        Save
      </Button>
    );
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent("Saving...");
    expect(button.querySelector("[role='status']")).toBeInTheDocument();
  });

  it("shows loading state with default text when no loadingText", () => {
    render(<Button loading>Save</Button>);
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent("Save");
    expect(button.querySelector("[role='status']")).toBeInTheDocument();
  });

  it("disables button when loading", () => {
    render(<Button loading>Save</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });
});
