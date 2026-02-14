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
  NavMain: () => <div>NavMain</div>,
}));

vi.mock("@/components/nav-user", () => ({
  NavUser: () => <div>NavUser</div>,
}));

vi.mock("@/components/nav-docs", () => ({
  NavDocs: () => <div>NavDocs</div>,
}));

vi.mock("@/components/nav-guest", () => ({
  AuthButtons: () => <div>AuthButtons</div>,
}));

// Mock sidebar components
vi.mock("@/components/ui/sidebar", () => ({
  Sidebar: ({ children }: { children: React.ReactNode }) => (
    <aside>{children}</aside>
  ),
  SidebarHeader: ({ children }: { children: React.ReactNode }) => (
    <header>{children}</header>
  ),
  SidebarContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  SidebarFooter: ({ children }: { children: React.ReactNode }) => (
    <footer role="contentinfo">{children}</footer>
  ),
  SidebarMenu: ({ children }: { children: React.ReactNode }) => (
    <ul>{children}</ul>
  ),
  SidebarMenuItem: ({ children }: { children: React.ReactNode }) => (
    <li>{children}</li>
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
      className={`sidebar-menu-button ${className || ""}`}
      data-active={isActive}
      data-tooltip={tooltip}
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

      const footer = screen.getByRole("contentinfo");
      const buttons = footer.querySelectorAll(".sidebar-menu-button");

      // Get Help is the only footer nav button
      const getHelpButton = buttons[0];
      expect(getHelpButton.getAttribute("data-active")).toBe("true");
    });

    it("renders Get Help as active on /docs/getting-started", () => {
      mockPathname.mockReturnValue("/docs/getting-started");
      render(<AppSidebar user={mockUser} context="my-items" />);

      const footer = screen.getByRole("contentinfo");
      const buttons = footer.querySelectorAll(".sidebar-menu-button");

      const getHelpButton = buttons[0];
      expect(getHelpButton.getAttribute("data-active")).toBe("true");
    });

    it("renders Get Help as inactive on /u/testuser", () => {
      mockPathname.mockReturnValue("/u/testuser");
      render(<AppSidebar user={mockUser} context="my-items" />);

      const footer = screen.getByRole("contentinfo");
      const buttons = footer.querySelectorAll(".sidebar-menu-button");

      const getHelpButton = buttons[0];
      expect(getHelpButton.getAttribute("data-active")).toBe("false");
    });
  });
});
