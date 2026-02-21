/**
 * Unit tests for AppSidebar component.
 * Tests that navigation items are correctly passed to NavMain.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { AppSidebar } from "@/components/app-sidebar";

// Mock next/navigation
const mockPathname = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
}));

// Capture NavMain props to verify items configuration
const mockNavMain = vi.fn();
vi.mock("@/components/nav-main", () => ({
  NavMain: (props: Record<string, unknown>) => {
    mockNavMain(props);
    return <div data-testid="nav-main">NavMain</div>;
  },
}));

vi.mock("@/components/nav-user", () => ({
  NavUser: () => <div>NavUser</div>,
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

describe("AppSidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("navigation items", () => {
    it("passes Get Help nav item with /docs URL to NavMain", () => {
      mockPathname.mockReturnValue("/docs");
      render(<AppSidebar user={mockUser} />);

      expect(mockNavMain).toHaveBeenCalled();
      const { items } = mockNavMain.mock.calls[0][0] as {
        items: Array<{ title: string; url: string }>;
      };
      const getHelpItem = items.find(
        (item: { title: string }) => item.title === "Get Help"
      );
      expect(getHelpItem).toBeDefined();
      expect(getHelpItem!.url).toBe("/docs");
    });

    it("includes all expected nav items for authenticated users", () => {
      mockPathname.mockReturnValue("/");
      render(<AppSidebar user={{ ...mockUser, username: "testuser" }} />);

      const { items } = mockNavMain.mock.calls[0][0] as {
        items: Array<{ title: string; url: string }>;
      };
      const titles = items.map((item: { title: string }) => item.title);
      expect(titles).toContain("Home");
      expect(titles).toContain("My Items");
      expect(titles).toContain("Explore");
      expect(titles).toContain("Get Help");
    });

    it("renders NavMain", () => {
      mockPathname.mockReturnValue("/u/testuser");
      render(<AppSidebar user={mockUser} />);

      expect(screen.getByTestId("nav-main")).toBeInTheDocument();
    });
  });

  describe("footer", () => {
    it("always renders footer", () => {
      mockPathname.mockReturnValue("/");
      render(<AppSidebar user={mockUser} />);

      expect(screen.getByRole("contentinfo")).toBeInTheDocument();
    });
  });

  describe("pinned items", () => {
    const pinnedItems = [
      { id: "item-1", name: "Movies", pinnedOrder: 0 },
      { id: "item-2", name: "TV Shows", pinnedOrder: 1 },
    ];

    it("passes pinnedItems to NavMain", () => {
      mockPathname.mockReturnValue("/");
      render(<AppSidebar user={mockUser} pinnedItems={pinnedItems} />);

      expect(mockNavMain).toHaveBeenCalled();
      const props = mockNavMain.mock.calls[0][0] as {
        pinnedItems: typeof pinnedItems;
      };
      expect(props.pinnedItems).toEqual(pinnedItems);
    });

    it("passes undefined pinnedItems to NavMain when not provided", () => {
      mockPathname.mockReturnValue("/");
      render(<AppSidebar user={mockUser} />);

      expect(mockNavMain).toHaveBeenCalled();
      const props = mockNavMain.mock.calls[0][0] as {
        pinnedItems?: typeof pinnedItems;
      };
      expect(props.pinnedItems).toBeUndefined();
    });
  });
});
