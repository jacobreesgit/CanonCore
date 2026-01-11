/**
 * Unit tests for NavMain component.
 * Tests navigation item active state styling and search button.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NavMain } from "@/components/nav-main";
import { Folder } from "lucide-react";

// Mock next/navigation
const mockPathname = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
}));

// Mock spotlight context
const mockOpenSpotlight = vi.fn();
const mockSpotlightContext = vi.fn();
vi.mock("@/contexts/spotlight-context", () => ({
  useSpotlightOptional: () => mockSpotlightContext(),
}));

// Mock sidebar context
vi.mock("@/components/ui/sidebar", () => ({
  SidebarGroup: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sidebar-group">{children}</div>
  ),
  SidebarGroupContent: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => (
    <div data-testid="sidebar-group-content" className={className}>
      {children}
    </div>
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
    onClick,
  }: {
    children: React.ReactNode;
    isActive?: boolean;
    tooltip?: string;
    asChild?: boolean;
    className?: string;
    onClick?: () => void;
  }) => (
    <button
      data-testid="sidebar-menu-button"
      data-active={isActive}
      data-tooltip={tooltip}
      className={className}
      onClick={onClick}
    >
      {children}
    </button>
  ),
}));

const testItems = [{ title: "My Items", url: "/my-items", icon: Folder }];

describe("NavMain", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no spotlight context (outside protected routes)
    mockSpotlightContext.mockReturnValue(null);
  });

  it("renders My Items button as active on /my-items", () => {
    mockPathname.mockReturnValue("/my-items");
    render(<NavMain items={testItems} />);

    const button = screen.getByTestId("sidebar-menu-button");
    expect(button.getAttribute("data-active")).toBe("true");
  });

  it("renders My Items button as active on nested path /my-items/123", () => {
    mockPathname.mockReturnValue("/my-items/abc123");
    render(<NavMain items={testItems} />);

    const button = screen.getByTestId("sidebar-menu-button");
    expect(button.getAttribute("data-active")).toBe("true");
  });

  it("renders My Items button as active on /my-items/connections", () => {
    mockPathname.mockReturnValue("/my-items/connections");
    render(<NavMain items={testItems} />);

    const button = screen.getByTestId("sidebar-menu-button");
    expect(button.getAttribute("data-active")).toBe("true");
  });

  it("renders My Items button as inactive on /docs", () => {
    mockPathname.mockReturnValue("/docs");
    render(<NavMain items={testItems} />);

    const button = screen.getByTestId("sidebar-menu-button");
    expect(button.getAttribute("data-active")).toBe("false");
  });

  it("renders My Items button as inactive on /", () => {
    mockPathname.mockReturnValue("/");
    render(<NavMain items={testItems} />);

    const button = screen.getByTestId("sidebar-menu-button");
    expect(button.getAttribute("data-active")).toBe("false");
  });

  it("renders My Items button as inactive on /my-items-other (no false positive)", () => {
    // Edge case: paths that START with /my-items but are NOT children
    // The trailing slash in startsWith() prevents this false positive
    mockPathname.mockReturnValue("/my-items-other");
    render(<NavMain items={testItems} />);

    const button = screen.getByTestId("sidebar-menu-button");
    expect(button.getAttribute("data-active")).toBe("false");
  });

  describe("Spotlight search button", () => {
    it("renders search button with keyboard shortcut when spotlight context available", () => {
      mockPathname.mockReturnValue("/my-items");
      mockSpotlightContext.mockReturnValue({
        isOpen: false,
        openSpotlight: mockOpenSpotlight,
        closeSpotlight: vi.fn(),
      });

      render(<NavMain items={testItems} />);

      // Should have search button with "/" shortcut
      const buttons = screen.getAllByTestId("sidebar-menu-button");
      const searchButton = buttons.find((btn) =>
        btn.textContent?.includes("Search")
      );
      expect(searchButton).toBeDefined();
      expect(searchButton?.textContent).toContain("/");
    });

    it("does not render search button when outside spotlight context", () => {
      mockPathname.mockReturnValue("/my-items");
      mockSpotlightContext.mockReturnValue(null);

      render(<NavMain items={testItems} />);

      const buttons = screen.getAllByTestId("sidebar-menu-button");
      const searchButton = buttons.find((btn) =>
        btn.textContent?.includes("Search")
      );
      expect(searchButton).toBeUndefined();
    });

    it("calls openSpotlight when search button clicked", async () => {
      const user = userEvent.setup();
      mockPathname.mockReturnValue("/my-items");
      mockSpotlightContext.mockReturnValue({
        isOpen: false,
        openSpotlight: mockOpenSpotlight,
        closeSpotlight: vi.fn(),
      });

      render(<NavMain items={testItems} />);

      const buttons = screen.getAllByTestId("sidebar-menu-button");
      const searchButton = buttons.find((btn) =>
        btn.textContent?.includes("Search")
      );

      await user.click(searchButton!);

      expect(mockOpenSpotlight).toHaveBeenCalledTimes(1);
    });

    it("renders search button before other nav items", () => {
      mockPathname.mockReturnValue("/my-items");
      mockSpotlightContext.mockReturnValue({
        isOpen: false,
        openSpotlight: mockOpenSpotlight,
        closeSpotlight: vi.fn(),
      });

      render(<NavMain items={testItems} />);

      const buttons = screen.getAllByTestId("sidebar-menu-button");
      expect(buttons[0].textContent).toContain("Search");
      expect(buttons[1].textContent).toContain("My Items");
    });
  });
});
