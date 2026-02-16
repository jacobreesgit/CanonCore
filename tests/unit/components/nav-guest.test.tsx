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
    <button role="button" data-active={isActive}>
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

    const getHelpButton = screen.getByRole("button", { name: /get help/i });
    expect(getHelpButton).toHaveAttribute("data-active", "true");
  });

  it("renders Get Help as active on /docs/getting-started", () => {
    mockPathname.mockReturnValue("/docs/getting-started");
    render(<AuthButtons />);

    const getHelpButton = screen.getByRole("button", { name: /get help/i });
    expect(getHelpButton).toHaveAttribute("data-active", "true");
  });

  it("renders Get Help as inactive on /", () => {
    mockPathname.mockReturnValue("/");
    render(<AuthButtons />);

    const getHelpButton = screen.getByRole("button", { name: /get help/i });
    expect(getHelpButton).toHaveAttribute("data-active", "false");
  });

  it("renders Get Started as active on /sign-in", () => {
    mockPathname.mockReturnValue("/sign-in");
    render(<AuthButtons />);

    const getStartedButton = screen.getByRole("button", {
      name: /get started/i,
    });
    expect(getStartedButton).toHaveAttribute("data-active", "true");
  });

  it("renders Get Started as inactive on /", () => {
    mockPathname.mockReturnValue("/");
    render(<AuthButtons />);

    const getStartedButton = screen.getByRole("button", {
      name: /get started/i,
    });
    expect(getStartedButton).toHaveAttribute("data-active", "false");
  });

  it("renders Get Started as inactive on /sign-up", () => {
    mockPathname.mockReturnValue("/sign-up");
    render(<AuthButtons />);

    const getStartedButton = screen.getByRole("button", {
      name: /get started/i,
    });
    expect(getStartedButton).toHaveAttribute("data-active", "false");
  });
});
