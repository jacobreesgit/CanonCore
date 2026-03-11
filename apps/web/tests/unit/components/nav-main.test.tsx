/**
 * Unit tests for NavMain component.
 * Tests navigation item active state styling and search button.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NavMain } from "@/components/nav-main";
import { faFolder } from "@fortawesome/free-solid-svg-icons";

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
    <div>{children}</div>
  ),
  SidebarGroupContent: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => <div className={className}>{children}</div>,
  SidebarMenu: ({ children }: { children: React.ReactNode }) => (
    <ul>{children}</ul>
  ),
  SidebarMenuItem: ({ children }: { children: React.ReactNode }) => (
    <li>{children}</li>
  ),
  SidebarMenuButton: ({
    children,
    isActive,
    tooltip: _tooltip,
    className: _className,
    onClick,
    asChild: _asChild,
    ...rest
  }: {
    children: React.ReactNode;
    isActive?: boolean;
    tooltip?: string;
    asChild?: boolean;
    className?: string;
    onClick?: () => void;
    "data-testid"?: string;
  }) => (
    <button
      role="button"
      data-active={isActive}
      onClick={onClick}
      aria-current={isActive ? "page" : undefined}
      {...rest}
    >
      {children}
    </button>
  ),
  SidebarMenuAction: ({ children }: { children: React.ReactNode }) => (
    <button>{children}</button>
  ),
  SidebarMenuSub: ({ children }: { children: React.ReactNode }) => (
    <ul>{children}</ul>
  ),
  SidebarMenuSubItem: ({ children }: { children: React.ReactNode }) => (
    <li>{children}</li>
  ),
  SidebarMenuSubButton: ({
    children,
    isActive,
  }: {
    children: React.ReactNode;
    isActive?: boolean;
    asChild?: boolean;
  }) => <a data-active={isActive}>{children}</a>,
}));

// Mock collapsible
vi.mock("@/components/ui/collapsible", () => ({
  Collapsible: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  CollapsibleTrigger: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  CollapsibleContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

// Test items with dynamic URL (simulating what app-sidebar builds)
const testUsername = "testuser";
const testItems = [
  { title: "My Items", url: `/u/${testUsername}`, icon: faFolder },
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

    const button = screen.getByRole("button", { name: /my items/i });
    expect(button).toHaveAttribute("data-active", "true");
  });

  it("renders My Items button as active on nested path /u/username/abc123", () => {
    mockPathname.mockReturnValue("/u/testuser/abc123");
    render(<NavMain items={testItems} username={testUsername} />);

    const button = screen.getByRole("button", { name: /my items/i });
    expect(button).toHaveAttribute("data-active", "true");
  });

  it("renders My Items button as active on /u/username/connections", () => {
    mockPathname.mockReturnValue("/u/testuser/connections");
    render(<NavMain items={testItems} username={testUsername} />);

    const button = screen.getByRole("button", { name: /my items/i });
    expect(button).toHaveAttribute("data-active", "true");
  });

  it("renders My Items button as inactive on /docs", () => {
    mockPathname.mockReturnValue("/docs");
    render(<NavMain items={testItems} username={testUsername} />);

    const button = screen.getByRole("button", { name: /my items/i });
    expect(button).toHaveAttribute("data-active", "false");
  });

  it("renders My Items button as inactive on /", () => {
    mockPathname.mockReturnValue("/");
    render(<NavMain items={testItems} username={testUsername} />);

    const button = screen.getByRole("button", { name: /my items/i });
    expect(button).toHaveAttribute("data-active", "false");
  });

  it("renders My Items button as inactive on /u/otherusername (different user)", () => {
    // Edge case: viewing another user's profile should not highlight My Items
    mockPathname.mockReturnValue("/u/otherusername");
    render(<NavMain items={testItems} username={testUsername} />);

    const button = screen.getByRole("button", { name: /my items/i });
    expect(button).toHaveAttribute("data-active", "false");
  });

  it("renders My Items button as active on deeply nested path /u/username/abc/def/ghi", () => {
    mockPathname.mockReturnValue("/u/testuser/abc/def/ghi");
    render(<NavMain items={testItems} username={testUsername} />);

    const button = screen.getByRole("button", { name: /my items/i });
    expect(button).toHaveAttribute("data-active", "true");
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

      const searchButton = screen.getByTestId("nav-search-button");
      expect(searchButton).toBeInTheDocument();
    });

    it("does not render search button when outside spotlight context", () => {
      mockPathname.mockReturnValue("/u/testuser");
      mockSpotlightContext.mockReturnValue(null);

      render(<NavMain items={testItems} username={testUsername} />);

      expect(
        screen.queryByRole("button", { name: /search/i })
      ).not.toBeInTheDocument();
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

      const searchButton = screen.getByTestId("nav-search-button");
      await user.click(searchButton);

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

      const allButtons = screen.getAllByRole("button");
      const searchIdx = allButtons.findIndex((btn) =>
        btn.textContent?.includes("Search")
      );
      const myItemsIdx = allButtons.findIndex((btn) =>
        btn.textContent?.includes("My Items")
      );
      expect(searchIdx).toBeLessThan(myItemsIdx);
    });
  });

  describe("aria-current accessibility", () => {
    it("sets aria-current='page' when active for accessibility", () => {
      mockPathname.mockReturnValue("/u/testuser");
      render(<NavMain items={testItems} username={testUsername} />);

      const button = screen.getByRole("button", { name: /my items/i });
      expect(button).toHaveAttribute("aria-current", "page");
    });

    it("does not set aria-current when inactive", () => {
      mockPathname.mockReturnValue("/docs");
      render(<NavMain items={testItems} username={testUsername} />);

      const button = screen.getByRole("button", { name: /my items/i });
      expect(button).not.toHaveAttribute("aria-current");
    });
  });

  describe("Explore navigation", () => {
    const exploreItems = [
      { title: "Explore", url: "/explore", icon: faFolder },
    ];

    it("renders Explore button as active on /explore", () => {
      mockPathname.mockReturnValue("/explore");
      render(<NavMain items={exploreItems} />);

      const button = screen.getByRole("button", { name: /explore/i });
      expect(button).toHaveAttribute("data-active", "true");
    });

    it("renders Explore button as active on /u/username when viewing others", () => {
      // When no username prop (guest or viewing other users), /u paths highlight Explore
      mockPathname.mockReturnValue("/u/john_doe");
      render(<NavMain items={exploreItems} />);

      const button = screen.getByRole("button", { name: /explore/i });
      expect(button).toHaveAttribute("data-active", "true");
    });

    it("renders Explore button as active on /u/username/itemId when viewing others", () => {
      mockPathname.mockReturnValue("/u/john_doe/abc123");
      render(<NavMain items={exploreItems} />);

      const button = screen.getByRole("button", { name: /explore/i });
      expect(button).toHaveAttribute("data-active", "true");
    });

    it("renders Explore button as active on deeply nested /u/username/item/child/grandchild when viewing others", () => {
      mockPathname.mockReturnValue("/u/john_doe/abc123/def456/ghi789");
      render(<NavMain items={exploreItems} />);

      const button = screen.getByRole("button", { name: /explore/i });
      expect(button).toHaveAttribute("data-active", "true");
    });

    it("renders Explore button as inactive on own profile /u/username", () => {
      // When current user is viewing their own profile, Explore should not be highlighted
      mockPathname.mockReturnValue("/u/testuser");
      render(<NavMain items={exploreItems} username={testUsername} />);

      const button = screen.getByRole("button", { name: /explore/i });
      expect(button).toHaveAttribute("data-active", "false");
    });
  });
});
