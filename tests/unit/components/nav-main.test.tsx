/**
 * Unit tests for NavMain component.
 * Tests navigation item active state styling.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { NavMain } from "@/components/nav-main";
import { Folder } from "lucide-react";

// Mock next/navigation
const mockPathname = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
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
});
