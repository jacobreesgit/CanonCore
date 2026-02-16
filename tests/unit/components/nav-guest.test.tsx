/**
 * Unit tests for NavGuest (AuthButtons) component.
 * Tests navigation item active state styling.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { AuthButtons } from "@/components/nav-guest";

// Mock next/navigation
const mockPathname = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
}));

// Mock sidebar components
vi.mock("@/components/ui/sidebar", () => ({
  SidebarMenu: ({ children }: { children: React.ReactNode }) => (
    <ul role="list">{children}</ul>
  ),
  SidebarMenuItem: ({ children }: { children: React.ReactNode }) => (
    <li>{children}</li>
  ),
  SidebarMenuButton: ({
    children,
    isActive,
  }: {
    children: React.ReactNode;
    isActive?: boolean;
    asChild?: boolean;
  }) => (
    <button className="sidebar-menu-button" data-active={isActive}>
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
    const { container } = render(<AuthButtons />);

    const buttons = container.querySelectorAll(".sidebar-menu-button");
    const getHelpButton = buttons[0];
    expect(getHelpButton.getAttribute("data-active")).toBe("true");
  });

  it("renders Get Help as active on /docs/getting-started", () => {
    mockPathname.mockReturnValue("/docs/getting-started");
    const { container } = render(<AuthButtons />);

    const buttons = container.querySelectorAll(".sidebar-menu-button");
    const getHelpButton = buttons[0];
    expect(getHelpButton.getAttribute("data-active")).toBe("true");
  });

  it("renders Get Help as inactive on /", () => {
    mockPathname.mockReturnValue("/");
    const { container } = render(<AuthButtons />);

    const buttons = container.querySelectorAll(".sidebar-menu-button");
    const getHelpButton = buttons[0];
    expect(getHelpButton.getAttribute("data-active")).toBe("false");
  });

  it("renders Get Started as active on /sign-in", () => {
    mockPathname.mockReturnValue("/sign-in");
    const { container } = render(<AuthButtons />);

    const buttons = container.querySelectorAll(".sidebar-menu-button");
    const getStartedButton = buttons[1];
    expect(getStartedButton.getAttribute("data-active")).toBe("true");
  });

  it("renders Get Started as inactive on /", () => {
    mockPathname.mockReturnValue("/");
    const { container } = render(<AuthButtons />);

    const buttons = container.querySelectorAll(".sidebar-menu-button");
    const getStartedButton = buttons[1];
    expect(getStartedButton.getAttribute("data-active")).toBe("false");
  });

  it("renders Get Started as inactive on /sign-up", () => {
    mockPathname.mockReturnValue("/sign-up");
    const { container } = render(<AuthButtons />);

    const buttons = container.querySelectorAll(".sidebar-menu-button");
    const getStartedButton = buttons[1];
    expect(getStartedButton.getAttribute("data-active")).toBe("false");
  });
});
