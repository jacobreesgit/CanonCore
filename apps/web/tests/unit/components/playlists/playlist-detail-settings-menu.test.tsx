/**
 * Unit tests for PlaylistDetailSettingsMenu component.
 * Verifies Settings gear opens menu with Edit Playlist and Delete.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PlaylistDetailSettingsMenu } from "@/components/playlists/playlist-detail-settings-menu";

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
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
  DropdownMenuSeparator: ({
    className: _className,
  }: {
    className?: string;
  }) => <hr />,
}));

// Mock Radix AlertDialog to render content directly
vi.mock("@/components/ui/alert-dialog", () => ({
  AlertDialog: ({
    children,
    open,
  }: {
    children: React.ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
  }) => (open ? <div>{children}</div> : null),
  AlertDialogContent: ({
    children,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h2>{children}</h2>
  ),
  AlertDialogDescription: ({
    children,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => <p>{children}</p>,
  AlertDialogFooter: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogCancel: ({
    children,
    disabled,
    className: _className,
  }: {
    children: React.ReactNode;
    disabled?: boolean;
    className?: string;
  }) => (
    <button type="button" disabled={disabled}>
      {children}
    </button>
  ),
  AlertDialogAction: ({
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
    <button type="button" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

describe("PlaylistDetailSettingsMenu", () => {
  const defaultProps = {
    playlistName: "My Playlist",
    onEdit: vi.fn(),
    onDelete: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a Settings gear button", () => {
    render(<PlaylistDetailSettingsMenu {...defaultProps} />);
    expect(
      screen.getByRole("button", { name: /settings/i })
    ).toBeInTheDocument();
  });

  it("shows Edit Playlist option on click", () => {
    render(<PlaylistDetailSettingsMenu {...defaultProps} />);
    expect(
      screen.getByRole("menuitem", { name: /edit playlist/i })
    ).toBeInTheDocument();
  });

  it("calls onEdit when Edit Playlist is clicked", () => {
    render(<PlaylistDetailSettingsMenu {...defaultProps} />);
    fireEvent.click(screen.getByRole("menuitem", { name: /edit playlist/i }));
    expect(defaultProps.onEdit).toHaveBeenCalledTimes(1);
  });

  it("shows Delete option", () => {
    render(<PlaylistDetailSettingsMenu {...defaultProps} />);
    expect(
      screen.getByRole("menuitem", { name: /delete/i })
    ).toBeInTheDocument();
  });

  it("shows delete confirmation dialog when Delete is clicked", () => {
    render(<PlaylistDetailSettingsMenu {...defaultProps} />);
    fireEvent.click(screen.getByRole("menuitem", { name: /delete/i }));
    expect(
      screen.getByText(/are you sure you want to delete/i)
    ).toBeInTheDocument();
  });
});
