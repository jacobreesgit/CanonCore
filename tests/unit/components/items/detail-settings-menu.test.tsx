/**
 * Unit tests for DetailSettingsMenu component.
 * Verifies the Settings gear button opens a dropdown with all item actions.
 *
 * Radix DropdownMenu with `asChild` requires ref forwarding and pointer events
 * that jsdom cannot fully simulate. We mock the Radix primitives to render
 * a simple open/close toggle, matching the pattern used by ItemContextMenu tests
 * (which also test renderMenuItems in a Radix wrapper).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState, type ReactNode } from "react";
import { DetailSettingsMenu } from "@/components/items/detail-settings-menu";

// Mock isMobile to always return false (desktop) for dropdown tests
vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

/**
 * Mock the Radix DropdownMenu primitives so that click on the trigger
 * toggles visibility of the content — no pointer events / ref forwarding needed.
 */
vi.mock("@/components/ui/dropdown-menu", () => {
  function MockDropdownMenu({ children }: { children: ReactNode }) {
    const [open, setOpen] = useState(false);
    return (
      <div data-testid="mock-dropdown" data-open={open}>
        {typeof children === "function"
          ? children
          : // Pass the toggle via context-like prop injection
            // by cloning children with an extra data attribute
            (Array.isArray(children) ? children : [children]).map(
              (child, i) => {
                if (child && typeof child === "object" && "props" in child) {
                  // Trigger or Content
                  if (child.type === MockDropdownMenuTrigger) {
                    return (
                      <child.type
                        key={i}
                        {...child.props}
                        __onToggle={() => setOpen((p) => !p)}
                      />
                    );
                  }
                  if (child.type === MockDropdownMenuContent) {
                    return open ? (
                      <child.type key={i} {...child.props} />
                    ) : null;
                  }
                }
                return child;
              }
            )}
      </div>
    );
  }

  function MockDropdownMenuTrigger({
    asChild: _asChild,
    children,
    __onToggle,
  }: {
    asChild?: boolean;
    children: ReactNode;
    __onToggle?: () => void;
  }) {
    return <div onClick={__onToggle}>{children}</div>;
  }

  function MockDropdownMenuContent({
    children,
  }: {
    children: ReactNode;
    align?: string;
    className?: string;
  }) {
    return <div role="menu">{children}</div>;
  }

  function MockDropdownMenuItem({
    children,
    onClick,
    className: _className,
    asChild,
  }: {
    children: ReactNode;
    onClick?: () => void;
    className?: string;
    asChild?: boolean;
  }) {
    if (asChild) {
      // For asChild items (like the Drive link), render children directly with role
      return <div role="menuitem">{children}</div>;
    }
    return (
      <div role="menuitem" onClick={onClick}>
        {children}
      </div>
    );
  }

  function MockDropdownMenuSeparator({
    className: _className,
  }: {
    className?: string;
  }) {
    return <hr role="separator" />;
  }

  return {
    DropdownMenu: MockDropdownMenu,
    DropdownMenuTrigger: MockDropdownMenuTrigger,
    DropdownMenuContent: MockDropdownMenuContent,
    DropdownMenuItem: MockDropdownMenuItem,
    DropdownMenuSeparator: MockDropdownMenuSeparator,
  };
});

describe("DetailSettingsMenu", () => {
  const defaultProps = {
    itemName: "Test Item",
    onSettings: vi.fn(),
    onDelete: vi.fn().mockResolvedValue(undefined),
    onAddChild: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a Settings gear button", () => {
    render(<DetailSettingsMenu {...defaultProps} />);
    expect(
      screen.getByRole("button", { name: /settings/i })
    ).toBeInTheDocument();
  });

  it("opens dropdown menu on click with Edit Item option", async () => {
    const user = userEvent.setup();
    render(<DetailSettingsMenu {...defaultProps} />);
    await user.click(screen.getByRole("button", { name: /settings/i }));
    expect(
      within(document.body).getByRole("menuitem", { name: /edit item/i })
    ).toBeInTheDocument();
  });

  it("calls onSettings when Edit Item is clicked", async () => {
    const user = userEvent.setup();
    render(<DetailSettingsMenu {...defaultProps} />);
    await user.click(screen.getByRole("button", { name: /settings/i }));
    await user.click(
      within(document.body).getByRole("menuitem", { name: /edit item/i })
    );
    expect(defaultProps.onSettings).toHaveBeenCalledTimes(1);
  });

  it("shows Delete option with confirmation", async () => {
    const user = userEvent.setup();
    render(<DetailSettingsMenu {...defaultProps} />);
    await user.click(screen.getByRole("button", { name: /settings/i }));
    expect(
      within(document.body).getByRole("menuitem", { name: /delete/i })
    ).toBeInTheDocument();
  });

  it("shows Add Child Item when onAddChild provided", async () => {
    const user = userEvent.setup();
    render(<DetailSettingsMenu {...defaultProps} showAddChild />);
    await user.click(screen.getByRole("button", { name: /settings/i }));
    expect(
      within(document.body).getByRole("menuitem", { name: /add child item/i })
    ).toBeInTheDocument();
  });

  it("shows Add to Playlist when showAddToPlaylist is true", async () => {
    const user = userEvent.setup();
    render(
      <DetailSettingsMenu {...defaultProps} showAddToPlaylist itemId="item-1" />
    );
    await user.click(screen.getByRole("button", { name: /settings/i }));
    expect(
      within(document.body).getByText("Add to Playlist")
    ).toBeInTheDocument();
  });

  it("shows delete confirmation dialog when Delete is clicked", async () => {
    const user = userEvent.setup();
    render(<DetailSettingsMenu {...defaultProps} />);
    await user.click(screen.getByRole("button", { name: /settings/i }));
    await user.click(
      within(document.body).getByRole("menuitem", { name: /delete/i })
    );
    expect(
      within(document.body).getByText(/are you sure you want to delete/i)
    ).toBeInTheDocument();
  });

  it("calls onDelete when delete is confirmed", async () => {
    const user = userEvent.setup();
    render(<DetailSettingsMenu {...defaultProps} />);
    await user.click(screen.getByRole("button", { name: /settings/i }));
    await user.click(
      within(document.body).getByRole("menuitem", { name: /delete/i })
    );
    await user.click(
      within(document.body).getByRole("button", { name: /^delete$/i })
    );
    expect(defaultProps.onDelete).toHaveBeenCalledTimes(1);
  });
});
