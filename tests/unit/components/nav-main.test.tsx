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
const mockRouter = { push: vi.fn(), refresh: vi.fn() };
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
  useRouter: () => mockRouter,
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
      aria-current={isActive ? "page" : undefined}
    >
      {children}
    </button>
  ),
}));

// Test items with dynamic URL (simulating what app-sidebar builds)
const testUsername = "testuser";
const testItems = [
  { title: "My Items", url: `/u/${testUsername}`, icon: Folder },
];

describe("NavMain", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no spotlight context (outside protected routes)
    mockSpotlightContext.mockReturnValue(null);
  });

  it("renders My Items button as active on /u/username", () => {
    mockPathname.mockReturnValue("/u/testuser");
    render(<NavMain items={testItems} username={testUsername} />);

    const button = screen.getByTestId("sidebar-menu-button");
    expect(button.getAttribute("data-active")).toBe("true");
  });

  it("renders My Items button as active on nested path /u/username/abc123", () => {
    mockPathname.mockReturnValue("/u/testuser/abc123");
    render(<NavMain items={testItems} username={testUsername} />);

    const button = screen.getByTestId("sidebar-menu-button");
    expect(button.getAttribute("data-active")).toBe("true");
  });

  it("renders My Items button as active on /u/username/connections", () => {
    mockPathname.mockReturnValue("/u/testuser/connections");
    render(<NavMain items={testItems} username={testUsername} />);

    const button = screen.getByTestId("sidebar-menu-button");
    expect(button.getAttribute("data-active")).toBe("true");
  });

  it("renders My Items button as inactive on /docs", () => {
    mockPathname.mockReturnValue("/docs");
    render(<NavMain items={testItems} username={testUsername} />);

    const button = screen.getByTestId("sidebar-menu-button");
    expect(button.getAttribute("data-active")).toBe("false");
  });

  it("renders My Items button as inactive on /", () => {
    mockPathname.mockReturnValue("/");
    render(<NavMain items={testItems} username={testUsername} />);

    const button = screen.getByTestId("sidebar-menu-button");
    expect(button.getAttribute("data-active")).toBe("false");
  });

  it("renders My Items button as inactive on /u/otherusername (different user)", () => {
    // Edge case: viewing another user's profile should not highlight My Items
    mockPathname.mockReturnValue("/u/otherusername");
    render(<NavMain items={testItems} username={testUsername} />);

    const button = screen.getByTestId("sidebar-menu-button");
    expect(button.getAttribute("data-active")).toBe("false");
  });

  it("renders My Items button as active on deeply nested path /u/username/abc/def/ghi", () => {
    mockPathname.mockReturnValue("/u/testuser/abc/def/ghi");
    render(<NavMain items={testItems} username={testUsername} />);

    const button = screen.getByTestId("sidebar-menu-button");
    expect(button.getAttribute("data-active")).toBe("true");
  });

  describe("Spotlight search button", () => {
    it("renders search button with keyboard shortcut when spotlight context available", () => {
      mockPathname.mockReturnValue("/u/testuser");
      mockSpotlightContext.mockReturnValue({
        isOpen: false,
        openSpotlight: mockOpenSpotlight,
        closeSpotlight: vi.fn(),
      });

      render(<NavMain items={testItems} username={testUsername} />);

      // Should have search button with "/" shortcut
      const buttons = screen.getAllByTestId("sidebar-menu-button");
      const searchButton = buttons.find((btn) =>
        btn.textContent?.includes("Search")
      );
      expect(searchButton).toBeDefined();
      expect(searchButton?.textContent).toContain("/");
    });

    it("does not render search button when outside spotlight context", () => {
      mockPathname.mockReturnValue("/u/testuser");
      mockSpotlightContext.mockReturnValue(null);

      render(<NavMain items={testItems} username={testUsername} />);

      const buttons = screen.getAllByTestId("sidebar-menu-button");
      const searchButton = buttons.find((btn) =>
        btn.textContent?.includes("Search")
      );
      expect(searchButton).toBeUndefined();
    });

    it("calls openSpotlight when search button clicked", async () => {
      const user = userEvent.setup();
      mockPathname.mockReturnValue("/u/testuser");
      mockSpotlightContext.mockReturnValue({
        isOpen: false,
        openSpotlight: mockOpenSpotlight,
        closeSpotlight: vi.fn(),
      });

      render(<NavMain items={testItems} username={testUsername} />);

      const buttons = screen.getAllByTestId("sidebar-menu-button");
      const searchButton = buttons.find((btn) =>
        btn.textContent?.includes("Search")
      );

      await user.click(searchButton!);

      expect(mockOpenSpotlight).toHaveBeenCalledTimes(1);
    });

    it("renders search button before other nav items", () => {
      mockPathname.mockReturnValue("/u/testuser");
      mockSpotlightContext.mockReturnValue({
        isOpen: false,
        openSpotlight: mockOpenSpotlight,
        closeSpotlight: vi.fn(),
      });

      render(<NavMain items={testItems} username={testUsername} />);

      const buttons = screen.getAllByTestId("sidebar-menu-button");
      expect(buttons[0].textContent).toContain("Search");
      expect(buttons[1].textContent).toContain("My Items");
    });
  });

  describe("aria-current accessibility", () => {
    it("sets aria-current='page' when active for accessibility", () => {
      mockPathname.mockReturnValue("/u/testuser");
      render(<NavMain items={testItems} username={testUsername} />);

      const button = screen.getByTestId("sidebar-menu-button");
      expect(button.getAttribute("aria-current")).toBe("page");
    });

    it("does not set aria-current when inactive", () => {
      mockPathname.mockReturnValue("/docs");
      render(<NavMain items={testItems} username={testUsername} />);

      const button = screen.getByTestId("sidebar-menu-button");
      expect(button.getAttribute("aria-current")).toBeNull();
    });
  });

  describe("Explore navigation", () => {
    const exploreItems = [{ title: "Explore", url: "/explore", icon: Folder }];

    it("renders Explore button as active on /explore", () => {
      mockPathname.mockReturnValue("/explore");
      render(<NavMain items={exploreItems} />);

      const button = screen.getByTestId("sidebar-menu-button");
      expect(button.getAttribute("data-active")).toBe("true");
    });

    it("renders Explore button as active on /u/username when viewing others", () => {
      // When no username prop (guest or viewing other users), /u paths highlight Explore
      mockPathname.mockReturnValue("/u/john_doe");
      render(<NavMain items={exploreItems} />);

      const button = screen.getByTestId("sidebar-menu-button");
      expect(button.getAttribute("data-active")).toBe("true");
    });

    it("renders Explore button as active on /u/username/itemId when viewing others", () => {
      mockPathname.mockReturnValue("/u/john_doe/abc123");
      render(<NavMain items={exploreItems} />);

      const button = screen.getByTestId("sidebar-menu-button");
      expect(button.getAttribute("data-active")).toBe("true");
    });

    it("renders Explore button as active on deeply nested /u/username/item/child/grandchild when viewing others", () => {
      mockPathname.mockReturnValue("/u/john_doe/abc123/def456/ghi789");
      render(<NavMain items={exploreItems} />);

      const button = screen.getByTestId("sidebar-menu-button");
      expect(button.getAttribute("data-active")).toBe("true");
    });

    it("renders Explore button as inactive on own profile /u/username", () => {
      // When current user is viewing their own profile, Explore should not be highlighted
      mockPathname.mockReturnValue("/u/testuser");
      render(<NavMain items={exploreItems} username={testUsername} />);

      const button = screen.getByTestId("sidebar-menu-button");
      expect(button.getAttribute("data-active")).toBe("false");
    });
  });
});
