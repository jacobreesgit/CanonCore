/**
 * Unit tests for AppSidebar component.
 * Tests footer navigation item active state styling.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { AppSidebar } from "@/components/app-sidebar";

// Mock next/navigation
const mockPathname = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
}));

// Mock child components
vi.mock("@/components/nav-main", () => ({
  NavMain: () => <div data-testid="nav-main">NavMain</div>,
}));

vi.mock("@/components/nav-user", () => ({
  NavUser: () => <div data-testid="nav-user">NavUser</div>,
}));

vi.mock("@/components/nav-docs", () => ({
  NavDocs: () => <div data-testid="nav-docs">NavDocs</div>,
}));

vi.mock("@/components/nav-guest", () => ({
  AuthButtons: () => <div data-testid="auth-buttons">AuthButtons</div>,
}));

// Mock sidebar components
vi.mock("@/components/ui/sidebar", () => ({
  Sidebar: ({ children }: { children: React.ReactNode }) => (
    <aside data-testid="sidebar">{children}</aside>
  ),
  SidebarHeader: ({ children }: { children: React.ReactNode }) => (
    <header data-testid="sidebar-header">{children}</header>
  ),
  SidebarContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sidebar-content">{children}</div>
  ),
  SidebarFooter: ({ children }: { children: React.ReactNode }) => (
    <footer data-testid="sidebar-footer">{children}</footer>
  ),
  SidebarMenu: ({ children }: { children: React.ReactNode }) => (
    <ul data-testid="sidebar-menu">{children}</ul>
  ),
  SidebarMenuItem: ({ children }: { children: React.ReactNode }) => (
    <li data-testid="sidebar-menu-item">{children}</li>
  ),
  SidebarMenuButton: ({
    children,
    isActive,
    tooltip,
    className,
  }: {
    children: React.ReactNode;
    isActive?: boolean;
    tooltip?: string;
    asChild?: boolean;
    className?: string;
  }) => (
    <button
      data-testid="sidebar-menu-button"
      data-active={isActive}
      data-tooltip={tooltip}
      className={className}
    >
      {children}
    </button>
  ),
}));

const mockUser = {
  id: "user-1",
  name: "Test User",
  email: "test@example.com",
};

describe("AppSidebar footer active state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("when authenticated on my-items context", () => {
    it("renders Get Help as active on /docs", () => {
      mockPathname.mockReturnValue("/docs");
      render(<AppSidebar user={mockUser} context="my-items" />);

      const footer = screen.getByTestId("sidebar-footer");
      const buttons = footer.querySelectorAll(
        '[data-testid="sidebar-menu-button"]'
      );

      // Get Help is the only footer nav button
      const getHelpButton = buttons[0];
      expect(getHelpButton.getAttribute("data-active")).toBe("true");
    });

    it("renders Get Help as active on /docs/getting-started", () => {
      mockPathname.mockReturnValue("/docs/getting-started");
      render(<AppSidebar user={mockUser} context="my-items" />);

      const footer = screen.getByTestId("sidebar-footer");
      const buttons = footer.querySelectorAll(
        '[data-testid="sidebar-menu-button"]'
      );

      const getHelpButton = buttons[0];
      expect(getHelpButton.getAttribute("data-active")).toBe("true");
    });

    it("renders Get Help as inactive on /my-items", () => {
      mockPathname.mockReturnValue("/my-items");
      render(<AppSidebar user={mockUser} context="my-items" />);

      const footer = screen.getByTestId("sidebar-footer");
      const buttons = footer.querySelectorAll(
        '[data-testid="sidebar-menu-button"]'
      );

      const getHelpButton = buttons[0];
      expect(getHelpButton.getAttribute("data-active")).toBe("false");
    });
  });
});
