/**
 * Unit tests for NavGuest (AuthButtons) component.
 * Tests navigation item active state styling.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { AuthButtons } from "@/components/nav-guest";

// Mock next/navigation
const mockPathname = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
}));

// Mock sidebar components
vi.mock("@/components/ui/sidebar", () => ({
  SidebarMenu: ({ children }: { children: React.ReactNode }) => (
    <ul data-testid="sidebar-menu">{children}</ul>
  ),
  SidebarMenuItem: ({ children }: { children: React.ReactNode }) => (
    <li data-testid="sidebar-menu-item">{children}</li>
  ),
  SidebarMenuButton: ({
    children,
    isActive,
  }: {
    children: React.ReactNode;
    isActive?: boolean;
    asChild?: boolean;
  }) => (
    <button data-testid="sidebar-menu-button" data-active={isActive}>
      {children}
    </button>
  ),
}));

describe("AuthButtons", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders Get Help as active on /docs", () => {
    mockPathname.mockReturnValue("/docs");
    render(<AuthButtons />);

    const buttons = screen.getAllByTestId("sidebar-menu-button");
    const getHelpButton = buttons[0];
    expect(getHelpButton.getAttribute("data-active")).toBe("true");
  });

  it("renders Get Help as active on /docs/getting-started", () => {
    mockPathname.mockReturnValue("/docs/getting-started");
    render(<AuthButtons />);

    const buttons = screen.getAllByTestId("sidebar-menu-button");
    const getHelpButton = buttons[0];
    expect(getHelpButton.getAttribute("data-active")).toBe("true");
  });

  it("renders Get Help as inactive on /", () => {
    mockPathname.mockReturnValue("/");
    render(<AuthButtons />);

    const buttons = screen.getAllByTestId("sidebar-menu-button");
    const getHelpButton = buttons[0];
    expect(getHelpButton.getAttribute("data-active")).toBe("false");
  });

  it("renders Get Started as active on /sign-in", () => {
    mockPathname.mockReturnValue("/sign-in");
    render(<AuthButtons />);

    const buttons = screen.getAllByTestId("sidebar-menu-button");
    const getStartedButton = buttons[1];
    expect(getStartedButton.getAttribute("data-active")).toBe("true");
  });

  it("renders Get Started as inactive on /", () => {
    mockPathname.mockReturnValue("/");
    render(<AuthButtons />);

    const buttons = screen.getAllByTestId("sidebar-menu-button");
    const getStartedButton = buttons[1];
    expect(getStartedButton.getAttribute("data-active")).toBe("false");
  });

  it("renders Get Started as inactive on /sign-up", () => {
    mockPathname.mockReturnValue("/sign-up");
    render(<AuthButtons />);

    const buttons = screen.getAllByTestId("sidebar-menu-button");
    const getStartedButton = buttons[1];
    expect(getStartedButton.getAttribute("data-active")).toBe("false");
  });
});
