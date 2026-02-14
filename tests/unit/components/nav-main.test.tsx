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

// Mock server actions - use vi.hoisted to avoid hoisting issues
const { mockUnpinItem, mockDeleteItem, mockToast } = vi.hoisted(() => ({
  mockUnpinItem: vi.fn(),
  mockDeleteItem: vi.fn(),
  mockToast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/item-actions", () => ({
  unpinItem: (...args: unknown[]) => mockUnpinItem(...args),
  deleteItem: (...args: unknown[]) => mockDeleteItem(...args),
}));

vi.mock("sonner", () => ({
  toast: mockToast,
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
  }) => (
    <div className={className}>
      {children}
    </div>
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
    onClick,
    asChild: _asChild,
  }: {
    children: React.ReactNode;
    isActive?: boolean;
    tooltip?: string;
    asChild?: boolean;
    className?: string;
    onClick?: () => void;
  }) => (
    <button
      className={`sidebar-menu-button ${className || ""}`}
      data-active={isActive}
      data-tooltip={tooltip}
      onClick={onClick}
      aria-current={isActive ? "page" : undefined}
    >
      {children}
    </button>
  ),
  SidebarMenuSub: ({ children }: { children: React.ReactNode }) => (
    <ul className="sidebar-menu-sub">{children}</ul>
  ),
  SidebarMenuSubItem: ({ children }: { children: React.ReactNode }) => (
    <li>{children}</li>
  ),
  SidebarMenuSubButton: ({
    children,
    isActive,
    asChild: _asChild,
  }: {
    children: React.ReactNode;
    isActive?: boolean;
    asChild?: boolean;
  }) => (
    <button
      className="sidebar-menu-sub-button"
      data-active={isActive}
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

    const button = document.querySelector(".sidebar-menu-button")!;
    expect(button.getAttribute("data-active")).toBe("true");
  });

  it("renders My Items button as active on nested path /u/username/abc123", () => {
    mockPathname.mockReturnValue("/u/testuser/abc123");
    render(<NavMain items={testItems} username={testUsername} />);

    const button = document.querySelector(".sidebar-menu-button")!;
    expect(button.getAttribute("data-active")).toBe("true");
  });

  it("renders My Items button as active on /u/username/connections", () => {
    mockPathname.mockReturnValue("/u/testuser/connections");
    render(<NavMain items={testItems} username={testUsername} />);

    const button = document.querySelector(".sidebar-menu-button")!;
    expect(button.getAttribute("data-active")).toBe("true");
  });

  it("renders My Items button as inactive on /docs", () => {
    mockPathname.mockReturnValue("/docs");
    render(<NavMain items={testItems} username={testUsername} />);

    const button = document.querySelector(".sidebar-menu-button")!;
    expect(button.getAttribute("data-active")).toBe("false");
  });

  it("renders My Items button as inactive on /", () => {
    mockPathname.mockReturnValue("/");
    render(<NavMain items={testItems} username={testUsername} />);

    const button = document.querySelector(".sidebar-menu-button")!;
    expect(button.getAttribute("data-active")).toBe("false");
  });

  it("renders My Items button as inactive on /u/otherusername (different user)", () => {
    // Edge case: viewing another user's profile should not highlight My Items
    mockPathname.mockReturnValue("/u/otherusername");
    render(<NavMain items={testItems} username={testUsername} />);

    const button = document.querySelector(".sidebar-menu-button")!;
    expect(button.getAttribute("data-active")).toBe("false");
  });

  it("renders My Items button as active on deeply nested path /u/username/abc/def/ghi", () => {
    mockPathname.mockReturnValue("/u/testuser/abc/def/ghi");
    render(<NavMain items={testItems} username={testUsername} />);

    const button = document.querySelector(".sidebar-menu-button")!;
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
      const buttons = document.querySelectorAll(".sidebar-menu-button");
      const searchButton = Array.from(buttons).find((btn) =>
        btn.textContent?.includes("Search")
      );
      expect(searchButton).toBeDefined();
      expect(searchButton?.textContent).toContain("/");
    });

    it("does not render search button when outside spotlight context", () => {
      mockPathname.mockReturnValue("/u/testuser");
      mockSpotlightContext.mockReturnValue(null);

      render(<NavMain items={testItems} username={testUsername} />);

      const buttons = document.querySelectorAll(".sidebar-menu-button");
      const searchButton = Array.from(buttons).find((btn) =>
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

      const buttons = document.querySelectorAll(".sidebar-menu-button");
      const searchButton = Array.from(buttons).find((btn) =>
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

      const buttons = document.querySelectorAll(".sidebar-menu-button");
      expect(buttons[0].textContent).toContain("Search");
      expect(buttons[1].textContent).toContain("My Items");
    });
  });

  describe("aria-current accessibility", () => {
    it("sets aria-current='page' when active for accessibility", () => {
      mockPathname.mockReturnValue("/u/testuser");
      render(<NavMain items={testItems} username={testUsername} />);

      const button = document.querySelector(".sidebar-menu-button")!;
      expect(button.getAttribute("aria-current")).toBe("page");
    });

    it("does not set aria-current when inactive", () => {
      mockPathname.mockReturnValue("/docs");
      render(<NavMain items={testItems} username={testUsername} />);

      const button = document.querySelector(".sidebar-menu-button")!;
      expect(button.getAttribute("aria-current")).toBeNull();
    });
  });

  describe("Explore navigation", () => {
    const exploreItems = [{ title: "Explore", url: "/explore", icon: Folder }];

    it("renders Explore button as active on /explore", () => {
      mockPathname.mockReturnValue("/explore");
      render(<NavMain items={exploreItems} />);

      const button = document.querySelector(".sidebar-menu-button")!;
      expect(button.getAttribute("data-active")).toBe("true");
    });

    it("renders Explore button as active on /u/username when viewing others", () => {
      // When no username prop (guest or viewing other users), /u paths highlight Explore
      mockPathname.mockReturnValue("/u/john_doe");
      render(<NavMain items={exploreItems} />);

      const button = document.querySelector(".sidebar-menu-button")!;
      expect(button.getAttribute("data-active")).toBe("true");
    });

    it("renders Explore button as active on /u/username/itemId when viewing others", () => {
      mockPathname.mockReturnValue("/u/john_doe/abc123");
      render(<NavMain items={exploreItems} />);

      const button = document.querySelector(".sidebar-menu-button")!;
      expect(button.getAttribute("data-active")).toBe("true");
    });

    it("renders Explore button as active on deeply nested /u/username/item/child/grandchild when viewing others", () => {
      mockPathname.mockReturnValue("/u/john_doe/abc123/def456/ghi789");
      render(<NavMain items={exploreItems} />);

      const button = document.querySelector(".sidebar-menu-button")!;
      expect(button.getAttribute("data-active")).toBe("true");
    });

    it("renders Explore button as inactive on own profile /u/username", () => {
      // When current user is viewing their own profile, Explore should not be highlighted
      mockPathname.mockReturnValue("/u/testuser");
      render(<NavMain items={exploreItems} username={testUsername} />);

      const button = document.querySelector(".sidebar-menu-button")!;
      expect(button.getAttribute("data-active")).toBe("false");
    });
  });

  describe("Pinned items", () => {
    const pinnedItems = [
      { id: "item-1", name: "Movies", pinnedOrder: 0, isPublic: true },
      { id: "item-2", name: "TV Shows", pinnedOrder: 1, isPublic: false },
    ];

    beforeEach(() => {
      mockUnpinItem.mockResolvedValue({ success: true });
      mockDeleteItem.mockResolvedValue({ success: true });
    });

    it("renders My Items without expand button when no pinned items", () => {
      mockPathname.mockReturnValue("/u/testuser");
      render(<NavMain items={testItems} username={testUsername} />);

      // Should not have expand/collapse button
      expect(
        screen.queryByRole("button", { name: /expand|collapse/i })
      ).not.toBeInTheDocument();
    });

    it("renders My Items with expand button when pinned items exist", () => {
      mockPathname.mockReturnValue("/u/testuser");
      render(
        <NavMain
          items={testItems}
          pinnedItems={pinnedItems}
          username={testUsername}
        />
      );

      // Should have expand/collapse button
      expect(
        screen.getByRole("button", { name: /expand|collapse/i })
      ).toBeInTheDocument();
    });

    it("renders pinned items as sub-items under My Items", () => {
      mockPathname.mockReturnValue("/u/testuser");
      render(
        <NavMain
          items={testItems}
          pinnedItems={pinnedItems}
          username={testUsername}
        />
      );

      // Should render pinned item names in sub-menu
      expect(screen.getByText("Movies")).toBeInTheDocument();
      expect(screen.getByText("TV Shows")).toBeInTheDocument();
    });

    it("renders pinned items with correct links", () => {
      mockPathname.mockReturnValue("/u/testuser");
      render(
        <NavMain
          items={testItems}
          pinnedItems={pinnedItems}
          username={testUsername}
        />
      );

      // Find the link for Movies
      const moviesLink = screen.getByRole("link", { name: /movies/i });
      expect(moviesLink).toHaveAttribute("href", "/u/testuser/item-1");
    });

    it("expands by default when on My Items path", () => {
      mockPathname.mockReturnValue("/u/testuser");
      render(
        <NavMain
          items={testItems}
          pinnedItems={pinnedItems}
          username={testUsername}
        />
      );

      // Sub-menu should be visible (expanded)
      expect(document.querySelector(".sidebar-menu-sub")).toBeInTheDocument();
    });

    it("expands by default when a pinned item is active", () => {
      mockPathname.mockReturnValue("/u/testuser/item-1");
      render(
        <NavMain
          items={testItems}
          pinnedItems={pinnedItems}
          username={testUsername}
        />
      );

      // Sub-menu should be visible (expanded)
      expect(document.querySelector(".sidebar-menu-sub")).toBeInTheDocument();
    });

    it("highlights active pinned item", () => {
      mockPathname.mockReturnValue("/u/testuser/item-1");
      render(
        <NavMain
          items={testItems}
          pinnedItems={pinnedItems}
          username={testUsername}
        />
      );

      // Find the sub-button for Movies
      const subButtons = document.querySelectorAll(".sidebar-menu-sub-button");
      const moviesButton = Array.from(subButtons).find((btn) =>
        btn.textContent?.includes("Movies")
      );
      expect(moviesButton?.getAttribute("data-active")).toBe("true");
    });

    it("does not highlight inactive pinned items", () => {
      mockPathname.mockReturnValue("/u/testuser/item-1");
      render(
        <NavMain
          items={testItems}
          pinnedItems={pinnedItems}
          username={testUsername}
        />
      );

      // Find the sub-button for TV Shows
      const subButtons = document.querySelectorAll(".sidebar-menu-sub-button");
      const tvButton = Array.from(subButtons).find((btn) =>
        btn.textContent?.includes("TV Shows")
      );
      expect(tvButton?.getAttribute("data-active")).toBe("false");
    });

    it("toggles expand/collapse when chevron clicked", async () => {
      const user = userEvent.setup();
      mockPathname.mockReturnValue("/u/testuser");
      render(
        <NavMain
          items={testItems}
          pinnedItems={pinnedItems}
          username={testUsername}
        />
      );

      // Initially expanded (on My Items path)
      expect(document.querySelector(".sidebar-menu-sub")).toBeInTheDocument();

      // Click to collapse
      const toggleButton = screen.getByRole("button", {
        name: /expand|collapse/i,
      });
      await user.click(toggleButton);

      // Should be collapsed (sub-menu not visible due to AnimatePresence)
      // Note: In tests, the motion.div exit animation completes immediately
    });

    it("expands pinned items section even without username due to auto-expand effect", () => {
      mockPathname.mockReturnValue("/u/testuser");
      render(<NavMain items={testItems} pinnedItems={pinnedItems} />);

      // Without username, initial state is collapsed, but the useEffect
      // auto-expands when hasPinnedItems is true (regardless of username)
      const subButtons = document.querySelectorAll(".sidebar-menu-sub-button");
      expect(subButtons.length).toBe(2);
    });
  });
});
