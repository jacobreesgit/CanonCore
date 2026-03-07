/**
 * Unit tests for SiteHeader component.
 * Tests breadcrumb rendering, navigation, and banners.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SiteHeader } from "@/components/site-header";
import { DRIVE_MESSAGES } from "@/lib/constants/messages";

vi.mock("@/hooks/use-google-drive-reconnect", () => ({
  useGoogleDriveReconnect: () => ({
    isReconnecting: false,
    handleReconnect: vi.fn(),
  }),
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: () => "/u/testuser",
}));

// Mock UI components that require context
vi.mock("@/components/ui/sidebar", () => ({
  SidebarTrigger: ({ className, ...props }: { className?: string }) => (
    <button className={className} {...props}>
      Toggle Sidebar
    </button>
  ),
}));

describe("SiteHeader", () => {
  it("renders title with default values", () => {
    render(<SiteHeader />);

    const nav = screen.getByRole("navigation", { name: "Breadcrumb" });
    const rootLink = nav.querySelector("a");
    expect(rootLink).toBeDefined();
    expect(rootLink!.textContent).toBe("My Items");
    expect(rootLink!.getAttribute("href")).toBe("/");
  });

  it("renders custom title and href", () => {
    render(
      <SiteHeader title="Connections" titleHref="/u/testuser/connections" />
    );

    const nav = screen.getByRole("navigation", { name: "Breadcrumb" });
    const rootLink = nav.querySelector("a");
    expect(rootLink!.textContent).toBe("Connections");
    expect(rootLink!.getAttribute("href")).toBe("/u/testuser/connections");
  });

  it("renders title only when no breadcrumbs provided", () => {
    render(<SiteHeader title="My Items" />);

    const nav = screen.getByRole("navigation", { name: "Breadcrumb" });
    const rootLink = nav.querySelector("a");
    expect(rootLink).toBeDefined();

    // Should have font-medium class (current location styling)
    expect(rootLink!.className).toContain("font-medium");

    // Only the root link should exist (no breadcrumb items)
    const allLinks = nav.querySelectorAll("a");
    expect(allLinks.length).toBe(1);
  });

  it("renders breadcrumb items when provided", () => {
    const breadcrumbs = [
      { id: "1", name: "Movies", href: "/u/testuser/1" },
      { id: "2", name: "Action", href: "/u/testuser/2" },
    ];

    render(<SiteHeader title="My Items" breadcrumbs={breadcrumbs} />);

    const nav = screen.getByRole("navigation", { name: "Breadcrumb" });
    // All links: root + 2 breadcrumb items
    const allLinks = nav.querySelectorAll("a");
    expect(allLinks.length).toBe(3);

    // Breadcrumb links (skip root at index 0)
    expect(allLinks[1].textContent).toBe("Movies");
    expect(allLinks[1].getAttribute("href")).toBe("/u/testuser/1");

    expect(allLinks[2].textContent).toBe("Action");
    expect(allLinks[2].getAttribute("href")).toBe("/u/testuser/2");
  });

  it("applies muted styling to root when breadcrumbs exist", () => {
    const breadcrumbs = [{ id: "1", name: "Movies", href: "/u/testuser/1" }];

    render(<SiteHeader title="My Items" breadcrumbs={breadcrumbs} />);

    const nav = screen.getByRole("navigation", { name: "Breadcrumb" });
    const rootLink = nav.querySelector("a");
    // Root should have muted styling when not the current page
    expect(rootLink!.className).toContain("text-muted-foreground");
  });

  it("applies current page styling to last breadcrumb", () => {
    const breadcrumbs = [
      { id: "1", name: "Movies", href: "/u/testuser/1" },
      { id: "2", name: "Action", href: "/u/testuser/2" },
    ];

    render(<SiteHeader title="My Items" breadcrumbs={breadcrumbs} />);

    const nav = screen.getByRole("navigation", { name: "Breadcrumb" });
    const allLinks = nav.querySelectorAll("a");
    const lastItem = allLinks[allLinks.length - 1];

    // Last item should have font-medium and aria-current
    expect(lastItem.className).toContain("font-medium");
    expect(lastItem.getAttribute("aria-current")).toBe("page");
  });

  it("renders breadcrumb nav with accessible label", () => {
    render(<SiteHeader />);

    const nav = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(nav).toBeDefined();
  });

  it("renders chevron separators between breadcrumb items", () => {
    const breadcrumbs = [
      { id: "1", name: "Movies", href: "/u/testuser/1" },
      { id: "2", name: "Action", href: "/u/testuser/2" },
    ];

    render(<SiteHeader title="My Items" breadcrumbs={breadcrumbs} />);

    // ChevronRight icons should be present (one per breadcrumb item)
    const nav = screen.getByRole("navigation", { name: "Breadcrumb" });
    const svgs = nav.querySelectorAll("svg");
    // 2 breadcrumb items = 2 chevrons
    expect(svgs.length).toBe(2);
  });

  describe("Drive Reconnect Banner", () => {
    it("should render reconnect banner when driveNeedsReauth is true", () => {
      render(<SiteHeader driveNeedsReauth={true} />);

      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(
        screen.getByText(DRIVE_MESSAGES.DISCONNECTED_BANNER)
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /reconnect/i })
      ).toBeInTheDocument();
    });

    it("should NOT render reconnect banner when driveNeedsReauth is false", () => {
      render(<SiteHeader driveNeedsReauth={false} />);

      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("should NOT render reconnect banner when driveNeedsReauth is undefined", () => {
      render(<SiteHeader />);

      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("banner should have correct accessibility attributes", () => {
      render(<SiteHeader driveNeedsReauth={true} />);

      const banner = screen.getByRole("alert");
      expect(banner).toHaveAttribute("aria-live", "assertive");
    });

    it("should prioritise drive banner over email banner when both are true", () => {
      render(<SiteHeader driveNeedsReauth={true} emailUnverified={true} />);

      // Drive banner shown
      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(
        screen.getByText(DRIVE_MESSAGES.DISCONNECTED_BANNER)
      ).toBeInTheDocument();
      // Email banner NOT shown (only one at a time)
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });
  });
});
