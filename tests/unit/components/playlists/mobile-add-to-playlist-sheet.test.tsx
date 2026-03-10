import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MobileAddToPlaylistSheet } from "@/components/playlists/mobile-add-to-playlist-sheet";

// Mock server actions
vi.mock("@/lib/playlist-actions", () => ({
  getPlaylistsForItem: vi.fn().mockResolvedValue({
    success: true,
    data: [
      { id: "pl-1", name: "My Playlist", isMember: false },
      { id: "pl-2", name: "Favourites", isMember: true },
    ],
  }),
  addItemToPlaylists: vi.fn(),
  removeItemFromPlaylist: vi.fn(),
}));

// Mock useReducedMotion (used by MobileBottomSheet)
vi.mock("@/hooks/use-reduced-motion", () => ({
  useReducedMotion: () => ({ reducedMotion: true }),
}));

describe("MobileAddToPlaylistSheet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders search input and header when open", () => {
    render(
      <MobileAddToPlaylistSheet
        open={true}
        onOpenChange={vi.fn()}
        itemId="item-1"
      />
    );

    expect(
      screen.getByPlaceholderText(/search playlists/i)
    ).toBeInTheDocument();
    expect(screen.getAllByText("Add to Playlist").length).toBeGreaterThan(0);
  });

  it("does not render when closed", () => {
    render(
      <MobileAddToPlaylistSheet
        open={false}
        onOpenChange={vi.fn()}
        itemId="item-1"
      />
    );

    expect(
      screen.queryByPlaceholderText(/search playlists/i)
    ).not.toBeInTheDocument();
  });

  it("renders create playlist button when onCreatePlaylist is provided", async () => {
    render(
      <MobileAddToPlaylistSheet
        open={true}
        onOpenChange={vi.fn()}
        itemId="item-1"
        onCreatePlaylist={vi.fn()}
      />
    );

    // Wait for playlists to load
    const button = await screen.findByText("Create new playlist");
    expect(button).toBeInTheDocument();
  });
});
