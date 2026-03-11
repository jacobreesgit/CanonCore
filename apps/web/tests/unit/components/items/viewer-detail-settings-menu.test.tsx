/**
 * Unit tests for ViewerDetailSettingsMenu component.
 * Verifies viewer actions (fork, add to playlist) behind Settings gear.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ViewerDetailSettingsMenu } from "@/components/items/viewer-detail-settings-menu";

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

// Mock Radix DropdownMenu to render content without needing ref forwarding
vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuTrigger: ({
    children,
    asChild: _asChild,
  }: {
    children: React.ReactNode;
    asChild?: boolean;
  }) => <div>{children}</div>,
  DropdownMenuContent: ({
    children,
  }: {
    children: React.ReactNode;
    align?: string;
    className?: string;
  }) => <div role="menu">{children}</div>,
  DropdownMenuItem: ({
    children,
    onClick,
    disabled,
    className: _className,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    className?: string;
  }) => (
    <div
      role="menuitem"
      onClick={disabled ? undefined : onClick}
      aria-disabled={disabled || undefined}
    >
      {children}
    </div>
  ),
}));

describe("ViewerDetailSettingsMenu", () => {
  const defaultProps = {
    itemId: "item-1",
    itemName: "Test Item",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a Settings gear button", () => {
    render(<ViewerDetailSettingsMenu {...defaultProps} />);
    expect(
      screen.getByRole("button", { name: /settings/i })
    ).toBeInTheDocument();
  });

  it("shows Fork to Library when onFork provided and not forked", () => {
    render(
      <ViewerDetailSettingsMenu
        {...defaultProps}
        onFork={vi.fn()}
        isForked={false}
        isGuest={false}
      />
    );
    expect(
      screen.getByRole("menuitem", { name: /fork to library/i })
    ).toBeInTheDocument();
  });

  it("shows In Your Library when already forked", () => {
    render(
      <ViewerDetailSettingsMenu
        {...defaultProps}
        isForked={true}
        isGuest={false}
      />
    );
    expect(screen.getByText("In Your Library")).toBeInTheDocument();
  });

  it("shows Sign in to Fork for guests", () => {
    render(<ViewerDetailSettingsMenu {...defaultProps} isGuest={true} />);
    expect(
      screen.getByRole("menuitem", { name: /sign in to fork/i })
    ).toBeInTheDocument();
  });

  it("shows Add to Playlist when showAddToPlaylist is true", () => {
    render(
      <ViewerDetailSettingsMenu
        {...defaultProps}
        showAddToPlaylist
        isGuest={false}
      />
    );
    expect(screen.getByText("Add to Playlist")).toBeInTheDocument();
  });
});
