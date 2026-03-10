import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MobileEditPlaylistSheet } from "@/components/playlists/mobile-edit-playlist-sheet";

// Mock server actions
vi.mock("@/lib/playlist-actions", () => ({
  updatePlaylist: vi.fn(),
  updatePlaylistArtwork: vi.fn(),
  removePlaylistArtwork: vi.fn(),
  regenerateShareToken: vi.fn(),
}));

// Mock useReducedMotion (used by MobileBottomSheet)
vi.mock("@/hooks/use-reduced-motion", () => ({
  useReducedMotion: () => ({ reducedMotion: true }),
}));

const mockPlaylist = {
  id: "pl-1",
  name: "Test Playlist",
  description: "A test description",
  isPublic: true,
  hasArtwork: false,
  shareToken: null,
};

describe("MobileEditPlaylistSheet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders name input with current value and save button", () => {
    render(
      <MobileEditPlaylistSheet
        open={true}
        onOpenChange={vi.fn()}
        playlist={mockPlaylist}
      />
    );

    const nameInput = screen.getByDisplayValue("Test Playlist");
    expect(nameInput).toBeInTheDocument();
    expect(screen.getByText("Save")).toBeInTheDocument();
  });

  it("renders description with current value", () => {
    render(
      <MobileEditPlaylistSheet
        open={true}
        onOpenChange={vi.fn()}
        playlist={mockPlaylist}
      />
    );

    expect(screen.getByDisplayValue("A test description")).toBeInTheDocument();
  });

  it("renders visibility toggle", () => {
    render(
      <MobileEditPlaylistSheet
        open={true}
        onOpenChange={vi.fn()}
        playlist={mockPlaylist}
      />
    );

    expect(screen.getByText("Public")).toBeInTheDocument();
    expect(
      screen.getByText("Visible on your public profile")
    ).toBeInTheDocument();
  });

  it("does not render when closed", () => {
    render(
      <MobileEditPlaylistSheet
        open={false}
        onOpenChange={vi.fn()}
        playlist={mockPlaylist}
      />
    );

    expect(screen.queryByText("Save")).not.toBeInTheDocument();
  });
});
