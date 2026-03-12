import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MobileCreatePlaylistSheet } from "@/components/playlists/mobile-create-playlist-sheet";

// Mock server actions
vi.mock("@/lib/playlist-actions", () => ({
  createPlaylist: vi.fn(),
}));

// Mock getAllItems
vi.mock("@/lib/item-actions", () => ({
  getAllItems: vi.fn().mockResolvedValue({ success: true, data: [] }),
}));

// Mock useReducedMotion (used by MobileBottomSheet)
vi.mock("@/hooks/use-reduced-motion", () => ({
  useReducedMotion: () => ({ reducedMotion: true }),
}));

describe("MobileCreatePlaylistSheet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders name input, visibility radio, and create button", () => {
    render(<MobileCreatePlaylistSheet open={true} onOpenChange={vi.fn()} />);

    expect(screen.getByPlaceholderText(/my playlist/i)).toBeInTheDocument();
    expect(screen.getByText("Private")).toBeInTheDocument();
    expect(screen.getByText("Create")).toBeInTheDocument();
  });

  it("renders description textarea", () => {
    render(<MobileCreatePlaylistSheet open={true} onOpenChange={vi.fn()} />);

    expect(
      screen.getByPlaceholderText(/add a description/i)
    ).toBeInTheDocument();
  });

  it("renders all visibility options", () => {
    render(<MobileCreatePlaylistSheet open={true} onOpenChange={vi.fn()} />);

    expect(screen.getByText("Private")).toBeInTheDocument();
    expect(screen.getByText("Unlisted")).toBeInTheDocument();
    expect(screen.getByText("Public")).toBeInTheDocument();
  });

  it("does not render when closed", () => {
    render(<MobileCreatePlaylistSheet open={false} onOpenChange={vi.fn()} />);

    expect(screen.queryByText("Create")).not.toBeInTheDocument();
  });
});
