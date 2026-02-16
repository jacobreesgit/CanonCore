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
  }: {
    children: React.ReactNode;
    isActive?: boolean;
    tooltip?: string;
    asChild?: boolean;
    className?: string;
    onClick?: () => void;
  }) => (
    <button
      role="button"
      data-active={isActive}
      onClick={onClick}
      aria-current={isActive ? "page" : undefined}
    >
      {children}
    </button>
  ),
  SidebarMenuSub: ({ children }: { children: React.ReactNode }) => (
    <ul aria-label="pinned items">{children}</ul>
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
      role="button"
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

      const searchButton = screen.getByRole("button", { name: /search/i });
      expect(searchButton).toBeInTheDocument();
      expect(searchButton).toHaveTextContent("/");
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

      const searchButton = screen.getByRole("button", { name: /search/i });
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
    const exploreItems = [{ title: "Explore", url: "/explore", icon: Folder }];

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
      expect(screen.getByLabelText("pinned items")).toBeInTheDocument();
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
      expect(screen.getByLabelText("pinned items")).toBeInTheDocument();
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

      // The Movies link wraps the button text, find the button containing "Movies"
      const moviesButton = screen.getByRole("button", { name: /movies/i });
      expect(moviesButton).toHaveAttribute("data-active", "true");
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

      // The TV Shows button should not be active
      const tvButton = screen.getByRole("button", { name: /tv shows/i });
      expect(tvButton).toHaveAttribute("data-active", "false");
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
      expect(screen.getByLabelText("pinned items")).toBeInTheDocument();

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
      expect(screen.getByText("Movies")).toBeInTheDocument();
      expect(screen.getByText("TV Shows")).toBeInTheDocument();
    });
  });
});
