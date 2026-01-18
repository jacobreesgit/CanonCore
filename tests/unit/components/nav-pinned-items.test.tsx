/**
 * Unit tests for NavPinnedItems component.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { usePathname } from "next/navigation";
import { NavPinnedItems } from "@/components/nav-pinned-items";
import type { PinnedItem } from "@/lib/types";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/my-items"),
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    refresh: vi.fn(),
  })),
}));

// Mock server actions
vi.mock("@/lib/item-actions", () => ({
  unpinItem: vi.fn().mockResolvedValue({ success: true }),
  deleteItem: vi.fn().mockResolvedValue({ success: true }),
}));

// Mock context menu components
vi.mock("@/components/ui/context-menu", () => ({
  ContextMenu: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  ContextMenuTrigger: ({
    children,
    asChild,
  }: {
    children: React.ReactNode;
    asChild?: boolean;
  }) => <div data-aschild={asChild}>{children}</div>,
  ContextMenuContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  ContextMenuItem: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  ContextMenuSeparator: () => <hr />,
}));

// Mock dialog components
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogDescription: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogFooter: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

// Mock button component
vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    ...props
  }: {
    children: React.ReactNode;
    variant?: string;
    onClick?: () => void;
    disabled?: boolean;
  }) => <button {...props}>{children}</button>,
}));

// Mock sidebar components to simplify testing
vi.mock("@/components/ui/sidebar", () => ({
  SidebarGroup: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sidebar-group">{children}</div>
  ),
  SidebarGroupLabel: ({ children }: { children: React.ReactNode }) => (
    <span data-testid="sidebar-group-label">{children}</span>
  ),
  SidebarGroupContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  SidebarMenu: ({ children }: { children: React.ReactNode }) => (
    <ul role="menu">{children}</ul>
  ),
  SidebarMenuButton: ({
    children,
    isActive,
    ...props
  }: {
    children: React.ReactNode;
    isActive?: boolean;
    asChild?: boolean;
    tooltip?: string;
  }) => (
    <div data-active={isActive} {...props}>
      {children}
    </div>
  ),
  SidebarMenuItem: ({ children }: { children: React.ReactNode }) => (
    <li role="menuitem">{children}</li>
  ),
}));

describe("NavPinnedItems", () => {
  beforeEach(() => {
    vi.mocked(usePathname).mockReturnValue("/my-items");
  });

  it("renders nothing when no pinned items", () => {
    const { container } = render(<NavPinnedItems items={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders pinned items with names", () => {
    const items: PinnedItem[] = [
      { id: "1", name: "Movies", pinnedOrder: 0 },
      { id: "2", name: "TV Shows", pinnedOrder: 1 },
    ];

    render(<NavPinnedItems items={items} />);

    expect(screen.getByText("Movies")).toBeInTheDocument();
    expect(screen.getByText("TV Shows")).toBeInTheDocument();
  });

  it("renders with Pinned label", () => {
    const items: PinnedItem[] = [{ id: "1", name: "Movies", pinnedOrder: 0 }];

    render(<NavPinnedItems items={items} />);

    expect(screen.getByText("Pinned")).toBeInTheDocument();
  });

  it("links to item detail pages", () => {
    const items: PinnedItem[] = [
      { id: "item-123", name: "Movies", pinnedOrder: 0 },
    ];

    render(<NavPinnedItems items={items} />);

    const link = screen.getByRole("link", { name: /movies/i });
    expect(link).toHaveAttribute("href", "/my-items/item-123");
  });

  it("shows active state for current item", () => {
    vi.mocked(usePathname).mockReturnValue("/my-items/item-123");

    const items: PinnedItem[] = [
      { id: "item-123", name: "Movies", pinnedOrder: 0 },
    ];

    render(<NavPinnedItems items={items} />);

    // Find the parent div with data-active attribute
    const menuButton = screen.getByText("Movies").closest("[data-active]");
    expect(menuButton).toHaveAttribute("data-active", "true");
  });

  it("shows active state for nested paths under pinned item", () => {
    vi.mocked(usePathname).mockReturnValue("/my-items/item-123/child-456");

    const items: PinnedItem[] = [
      { id: "item-123", name: "Movies", pinnedOrder: 0 },
    ];

    render(<NavPinnedItems items={items} />);

    const menuButton = screen.getByText("Movies").closest("[data-active]");
    expect(menuButton).toHaveAttribute("data-active", "true");
  });

  it("does not show active state for different items", () => {
    vi.mocked(usePathname).mockReturnValue("/my-items/item-999");

    const items: PinnedItem[] = [
      { id: "item-123", name: "Movies", pinnedOrder: 0 },
    ];

    render(<NavPinnedItems items={items} />);

    const menuButton = screen.getByText("Movies").closest("[data-active]");
    expect(menuButton).toHaveAttribute("data-active", "false");
  });

  it("renders folder icon for all pinned items", () => {
    const items: PinnedItem[] = [{ id: "1", name: "Movies", pinnedOrder: 0 }];

    render(<NavPinnedItems items={items} />);

    // Check for Folder icon - it should have aria-hidden="true"
    const folderIcon = document.querySelector('[aria-hidden="true"]');
    expect(folderIcon).toBeInTheDocument();
  });
});
