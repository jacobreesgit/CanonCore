/**
 * Unit tests for MobileFooterNav component.
 * Tests footer visibility, navigation, and sheet triggers.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Compass, Library, User, HelpCircle } from "lucide-react";
import {
  MobileFooterNav,
  MobileFooterContainer,
  getAuthenticatedFooterItems,
  getGuestFooterItems,
} from "@/components/mobile/mobile-footer-nav";

// Mock next/navigation
const mockPathname = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
}));

// Mock useIsMobile hook
const mockIsMobile = vi.fn();
vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => mockIsMobile(),
}));

describe("MobileFooterNav", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname.mockReturnValue("/");
    mockIsMobile.mockReturnValue(true);
  });

  describe("Visibility", () => {
    it("renders on mobile viewport", () => {
      mockIsMobile.mockReturnValue(true);

      render(
        <MobileFooterNav
          items={[
            {
              label: "Test",
              icon: <Compass className="h-5 w-5" />,
              ariaLabel: "Test",
              href: "/test",
            },
          ]}
        />
      );

      expect(
        screen.getByRole("navigation", { name: /mobile navigation/i })
      ).toBeInTheDocument();
    });

    it("does not render on desktop viewport", () => {
      mockIsMobile.mockReturnValue(false);

      render(
        <MobileFooterNav
          items={[
            {
              label: "Test",
              icon: <Compass className="h-5 w-5" />,
              ariaLabel: "Test",
              href: "/test",
            },
          ]}
        />
      );

      expect(
        screen.queryByRole("navigation", { name: /mobile navigation/i })
      ).not.toBeInTheDocument();
    });
  });

  describe("Navigation Links", () => {
    it("renders navigation links with correct hrefs", () => {
      render(
        <MobileFooterNav
          items={[
            {
              label: "Explore",
              icon: <Compass className="h-5 w-5" />,
              ariaLabel: "Explore",
              href: "/explore",
            },
          ]}
        />
      );

      const link = screen.getByRole("link", { name: /explore/i });
      expect(link).toHaveAttribute("href", "/explore");
    });

    it("marks active link with aria-current='page'", () => {
      mockPathname.mockReturnValue("/explore");

      render(
        <MobileFooterNav
          items={[
            {
              label: "Explore",
              icon: <Compass className="h-5 w-5" />,
              ariaLabel: "Explore",
              href: "/explore",
            },
          ]}
        />
      );

      const link = screen.getByRole("link", { name: /explore/i });
      expect(link).toHaveAttribute("aria-current", "page");
    });

    it("matches nested routes as active", () => {
      mockPathname.mockReturnValue("/u/johndoe/item123");

      render(
        <MobileFooterNav
          items={[
            {
              label: "My Items",
              icon: <Library className="h-5 w-5" />,
              ariaLabel: "My Items",
              href: "/u/johndoe",
            },
          ]}
        />
      );

      const link = screen.getByRole("link", { name: /my items/i });
      expect(link).toHaveAttribute("aria-current", "page");
    });

    it("respects explicit isActive prop", () => {
      mockPathname.mockReturnValue("/other");

      render(
        <MobileFooterNav
          items={[
            {
              label: "Explore",
              icon: <Compass className="h-5 w-5" />,
              ariaLabel: "Explore",
              href: "/explore",
              isActive: true,
            },
          ]}
        />
      );

      const link = screen.getByRole("link", { name: /explore/i });
      expect(link).toHaveAttribute("aria-current", "page");
    });
  });

  describe("Sheet Triggers", () => {
    it("calls onSheetOpen when sheet trigger is clicked", async () => {
      const user = userEvent.setup();
      const onSheetOpen = vi.fn();

      render(
        <MobileFooterNav
          items={[
            {
              label: "Account",
              icon: <User className="h-5 w-5" />,
              ariaLabel: "Account menu",
              sheet: "user",
            },
          ]}
          onSheetOpen={onSheetOpen}
        />
      );

      const button = screen.getByRole("button", { name: /account menu/i });
      await user.click(button);

      expect(onSheetOpen).toHaveBeenCalledWith("user");
    });

    it("calls onSheetOpen with correct sheet type for help", async () => {
      const user = userEvent.setup();
      const onSheetOpen = vi.fn();

      render(
        <MobileFooterNav
          items={[
            {
              label: "Help",
              icon: <HelpCircle className="h-5 w-5" />,
              ariaLabel: "Help",
              sheet: "help",
            },
          ]}
          onSheetOpen={onSheetOpen}
        />
      );

      const button = screen.getByRole("button", { name: /help/i });
      await user.click(button);

      expect(onSheetOpen).toHaveBeenCalledWith("help");
    });
  });

  describe("User Avatar", () => {
    it("renders Avatar component when userAvatar is provided", () => {
      render(
        <MobileFooterNav
          items={[
            {
              label: "Account",
              icon: <User className="h-5 w-5" />,
              ariaLabel: "Account menu",
              sheet: "user",
            },
          ]}
          userAvatar="https://example.com/avatar.jpg"
          userName="John Doe"
        />
      );

      // Avatar component renders with data-slot="avatar"
      const avatar = document.querySelector('[data-slot="avatar"]');
      expect(avatar).toBeInTheDocument();
    });

    it("shows icon instead of avatar when no userAvatar provided", () => {
      render(
        <MobileFooterNav
          items={[
            {
              label: "Account",
              icon: <User className="h-5 w-5" />,
              ariaLabel: "Account menu",
              sheet: "user",
            },
          ]}
          userName="John Doe"
        />
      );

      // Should render the icon, not the Avatar component
      const avatar = document.querySelector('[data-slot="avatar"]');
      expect(avatar).not.toBeInTheDocument();

      // Icon should be rendered (User icon from lucide)
      const button = screen.getByRole("button", { name: /account menu/i });
      expect(button.querySelector("svg")).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("has correct aria-label on navigation landmark", () => {
      render(
        <MobileFooterNav
          items={[
            {
              label: "Explore",
              icon: <Compass className="h-5 w-5" />,
              ariaLabel: "Explore",
              href: "/explore",
            },
          ]}
        />
      );

      expect(
        screen.getByRole("navigation", { name: /mobile navigation/i })
      ).toBeInTheDocument();
    });

    it("all buttons have aria-label", () => {
      render(
        <MobileFooterNav
          items={[
            {
              label: "Account",
              icon: <User className="h-5 w-5" />,
              ariaLabel: "Account menu",
              sheet: "user",
            },
          ]}
        />
      );

      const button = screen.getByRole("button", { name: /account menu/i });
      expect(button).toHaveAttribute("aria-label", "Account menu");
    });
  });
});

describe("getAuthenticatedFooterItems", () => {
  it("returns 5 items for authenticated users", () => {
    const items = getAuthenticatedFooterItems("johndoe");
    expect(items).toHaveLength(5);
  });

  it("includes My Items, Explore, Search, Help, and Account", () => {
    const items = getAuthenticatedFooterItems("johndoe");
    const labels = items.map((item) => item.label);

    expect(labels).toContain("My Items");
    expect(labels).toContain("Explore");
    expect(labels).toContain("Search");
    expect(labels).toContain("Help");
    expect(labels).toContain("Account");
  });

  it("builds correct My Items URL with username", () => {
    const items = getAuthenticatedFooterItems("johndoe");
    const myItemsItem = items.find((item) => item.label === "My Items");

    expect(myItemsItem?.href).toBe("/u/johndoe");
  });

  it("falls back to sign-in for My Items when no username", () => {
    const items = getAuthenticatedFooterItems(null);
    const myItemsItem = items.find((item) => item.label === "My Items");

    expect(myItemsItem?.href).toBe("/sign-in");
  });
});

describe("getGuestFooterItems", () => {
  it("returns 4 items for guest users", () => {
    const items = getGuestFooterItems();
    expect(items).toHaveLength(4);
  });

  it("includes Explore, Search, Help, and Sign In", () => {
    const items = getGuestFooterItems();
    const labels = items.map((item) => item.label);

    expect(labels).toContain("Explore");
    expect(labels).toContain("Search");
    expect(labels).toContain("Help");
    expect(labels).toContain("Sign In");
  });

  it("does not include My Items, Account, or Settings", () => {
    const items = getGuestFooterItems();
    const labels = items.map((item) => item.label);

    expect(labels).not.toContain("My Items");
    expect(labels).not.toContain("Account");
    expect(labels).not.toContain("Settings");
  });

  it("has correct Sign In href", () => {
    const items = getGuestFooterItems();
    const signInItem = items.find((item) => item.label === "Sign In");

    expect(signInItem?.href).toBe("/sign-in");
  });
});

describe("MobileFooterContainer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname.mockReturnValue("/");
    mockIsMobile.mockReturnValue(true);
  });

  it("renders authenticated items when user is provided", () => {
    render(
      <MobileFooterContainer
        user={{
          name: "John Doe",
          username: "johndoe",
        }}
      />
    );

    expect(screen.getByText("My Items")).toBeInTheDocument();
    expect(screen.getByText("Account")).toBeInTheDocument();
  });

  it("renders guest items when user is null", () => {
    render(<MobileFooterContainer user={null} />);

    expect(screen.getByText("Sign In")).toBeInTheDocument();
    expect(screen.getByText("Help")).toBeInTheDocument();
  });

  it("calls onUserOpen when Account button is clicked", async () => {
    const user = userEvent.setup();
    const onUserOpen = vi.fn();

    render(
      <MobileFooterContainer
        user={{
          name: "John Doe",
          username: "johndoe",
        }}
        onUserOpen={onUserOpen}
      />
    );

    const accountButton = screen.getByRole("button", { name: /account menu/i });
    await user.click(accountButton);

    expect(onUserOpen).toHaveBeenCalled();
  });

  it("calls onHelpOpen when Help button is clicked", async () => {
    const user = userEvent.setup();
    const onHelpOpen = vi.fn();

    render(
      <MobileFooterContainer
        user={{
          name: "John Doe",
          username: "johndoe",
        }}
        onHelpOpen={onHelpOpen}
      />
    );

    const helpButton = screen.getByRole("button", { name: /help/i });
    await user.click(helpButton);

    expect(onHelpOpen).toHaveBeenCalled();
  });

  it("calls onSearchOpen when Search button is clicked", async () => {
    const user = userEvent.setup();
    const onSearchOpen = vi.fn();

    render(
      <MobileFooterContainer
        user={{
          name: "John Doe",
          username: "johndoe",
        }}
        onSearchOpen={onSearchOpen}
      />
    );

    const searchButton = screen.getByRole("button", { name: /search/i });
    await user.click(searchButton);

    expect(onSearchOpen).toHaveBeenCalled();
  });

  it("calls onSearchOpen when Search button is clicked (guest)", async () => {
    const user = userEvent.setup();
    const onSearchOpen = vi.fn();

    render(<MobileFooterContainer user={null} onSearchOpen={onSearchOpen} />);

    const searchButton = screen.getByRole("button", { name: /search/i });
    await user.click(searchButton);

    expect(onSearchOpen).toHaveBeenCalled();
  });
});
