/**
 * Unit tests for SiteHeader component.
 * Tests breadcrumb rendering and navigation.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SiteHeader } from "@/components/site-header";

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

    const link = screen.getByTestId("site-header-breadcrumb-root");
    expect(link).toBeDefined();
    expect(link.textContent).toBe("My Items");
    expect(link.getAttribute("href")).toBe("/");
  });

  it("renders custom title and href", () => {
    render(
      <SiteHeader title="Connections" titleHref="/u/testuser/connections" />
    );

    const link = screen.getByTestId("site-header-breadcrumb-root");
    expect(link.textContent).toBe("Connections");
    expect(link.getAttribute("href")).toBe("/u/testuser/connections");
  });

  it("renders title only when no breadcrumbs provided", () => {
    render(<SiteHeader title="My Items" />);

    const root = screen.getByTestId("site-header-breadcrumb-root");
    expect(root).toBeDefined();

    // Should have font-medium class (current location styling)
    expect(root.className).toContain("font-medium");

    // No breadcrumb items should exist
    const items = screen.queryAllByTestId("site-header-breadcrumb-item");
    expect(items.length).toBe(0);
  });

  it("renders breadcrumb items when provided", () => {
    const breadcrumbs = [
      { id: "1", name: "Movies", href: "/u/testuser/1" },
      { id: "2", name: "Action", href: "/u/testuser/2" },
    ];

    render(<SiteHeader title="My Items" breadcrumbs={breadcrumbs} />);

    const items = screen.getAllByTestId("site-header-breadcrumb-item");
    expect(items.length).toBe(2);

    expect(items[0].textContent).toBe("Movies");
    expect(items[0].getAttribute("href")).toBe("/u/testuser/1");

    expect(items[1].textContent).toBe("Action");
    expect(items[1].getAttribute("href")).toBe("/u/testuser/2");
  });

  it("applies muted styling to root when breadcrumbs exist", () => {
    const breadcrumbs = [{ id: "1", name: "Movies", href: "/u/testuser/1" }];

    render(<SiteHeader title="My Items" breadcrumbs={breadcrumbs} />);

    const root = screen.getByTestId("site-header-breadcrumb-root");
    // Root should have muted styling when not the current page
    expect(root.className).toContain("text-muted-foreground");
  });

  it("applies current page styling to last breadcrumb", () => {
    const breadcrumbs = [
      { id: "1", name: "Movies", href: "/u/testuser/1" },
      { id: "2", name: "Action", href: "/u/testuser/2" },
    ];

    render(<SiteHeader title="My Items" breadcrumbs={breadcrumbs} />);

    const items = screen.getAllByTestId("site-header-breadcrumb-item");
    const lastItem = items[items.length - 1];

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
});
