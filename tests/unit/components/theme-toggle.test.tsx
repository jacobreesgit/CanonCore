/**
 * Unit tests for ThemeToggle component.
 * Tests theme cycling between light and dark modes.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ThemeToggle } from "@/components/theme-toggle";

// Mock next-themes
const mockSetTheme = vi.fn();
let mockTheme = "light";

vi.mock("next-themes", () => ({
  useTheme: () => ({
    theme: mockTheme,
    setTheme: mockSetTheme,
  }),
}));

describe("ThemeToggle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTheme = "light";
  });

  it("renders theme toggle button", async () => {
    render(<ThemeToggle />);

    // Wait for component to mount and button to be enabled
    await waitFor(() => {
      const button = screen.getByTestId("theme-toggle");
      expect(button).not.toBeDisabled();
    });

    const button = screen.getByTestId("theme-toggle");
    expect(button).toBeDefined();
  });

  it("has accessible label", async () => {
    render(<ThemeToggle />);

    await waitFor(() => {
      expect(screen.getByTestId("theme-toggle")).not.toBeDisabled();
    });

    const label = screen.getByText("Toggle theme");
    expect(label).toBeDefined();
  });

  it("toggles from light to dark theme", async () => {
    mockTheme = "light";
    render(<ThemeToggle />);

    await waitFor(() => {
      expect(screen.getByTestId("theme-toggle")).not.toBeDisabled();
    });

    const button = screen.getByTestId("theme-toggle");
    fireEvent.click(button);

    expect(mockSetTheme).toHaveBeenCalledWith("dark");
  });

  it("toggles from dark to light theme", async () => {
    mockTheme = "dark";
    render(<ThemeToggle />);

    await waitFor(() => {
      expect(screen.getByTestId("theme-toggle")).not.toBeDisabled();
    });

    const button = screen.getByTestId("theme-toggle");
    fireEvent.click(button);

    expect(mockSetTheme).toHaveBeenCalledWith("light");
  });

  it("renders sun and moon icons after mount", async () => {
    render(<ThemeToggle />);

    await waitFor(() => {
      expect(screen.getByTestId("theme-toggle")).not.toBeDisabled();
    });

    const button = screen.getByTestId("theme-toggle");
    // Check that SVG elements (icons) are present
    const svgs = button.querySelectorAll("svg");
    expect(svgs.length).toBe(2);
  });
});
