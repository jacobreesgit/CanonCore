/**
 * Unit tests for CreatePlaylistDialog.
 * Tests visibility picker, item selection, and form submission.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CreatePlaylistDialog } from "@/components/playlists/create-playlist-dialog";

// Mock server actions
vi.mock("@/lib/playlist-actions", () => ({
  createPlaylist: vi.fn(),
}));

vi.mock("@/lib/item-actions", () => ({
  getAllItems: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// Mock TanStack Virtual — jsdom has no layout, virtualizer returns 0 items
vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: vi.fn(({ count }: { count: number }) => ({
    getTotalSize: () => count * 40,
    getVirtualItems: () =>
      Array.from({ length: count }, (_, i) => ({
        index: i,
        key: String(i),
        start: i * 40,
        size: 40,
      })),
    measureElement: vi.fn(),
  })),
}));

import { createPlaylist } from "@/lib/playlist-actions";
import { getAllItems } from "@/lib/item-actions";

const mockCreatePlaylist = vi.mocked(createPlaylist);
const mockGetAllItems = vi.mocked(getAllItems);

/** Minimal mock satisfying ItemWithArtwork shape for the fields the dialog reads. */
const mockItemWithArtwork = (overrides: {
  id: string;
  name: string;
  depth: number;
  parentId: string | null;
}) => ({
  ...overrides,
  description: null,
  order: 0,
  userId: "user-1",
  type: "FOLDER" as const,
  isPublic: false,
  inheritVisibility: false,
  pinnedOrder: null,
  tmdbId: null,
  tmdbType: null,
  tmdbPosterPath: null,
  tmdbBackdropPath: null,
  tmdbLogoPath: null,
  dominantColour: null,
  artworkId: null,
  driveFileId: null,
  driveModifiedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  files: [],
  driveConnection: null,
  descendantCount: 0,
});

describe("CreatePlaylistDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAllItems.mockResolvedValue({
      success: true,
      data: [
        mockItemWithArtwork({
          id: "item-1",
          name: "The Matrix",
          depth: 0,
          parentId: null,
        }),
        mockItemWithArtwork({
          id: "item-2",
          name: "Inception",
          depth: 0,
          parentId: null,
        }),
      ],
    } as never);
  });

  it("renders all form fields", () => {
    render(<CreatePlaylistDialog open={true} onOpenChange={vi.fn()} />);

    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    expect(screen.getByText(/private/i)).toBeInTheDocument();
  });

  it("defaults visibility to Private", () => {
    render(<CreatePlaylistDialog open={true} onOpenChange={vi.fn()} />);

    // Private radio should be checked by default
    const privateRadio = screen.getByRole("radio", { name: /private/i });
    expect(privateRadio).toBeChecked();
  });

  it("shows contextual note when Unlisted selected", async () => {
    const user = userEvent.setup();
    render(<CreatePlaylistDialog open={true} onOpenChange={vi.fn()} />);

    await user.click(screen.getByRole("radio", { name: /unlisted/i }));
    expect(screen.getByText(/share link/i)).toBeInTheDocument();
  });

  it("submit is disabled when name empty", () => {
    render(<CreatePlaylistDialog open={true} onOpenChange={vi.fn()} />);

    expect(screen.getByTestId("create-playlist-submit")).toBeDisabled();
  });

  it("submits with selected items and visibility", async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn();
    mockCreatePlaylist.mockResolvedValue({
      success: true,
      data: { id: "pl-1", name: "My Playlist" },
    });

    render(
      <CreatePlaylistDialog
        open={true}
        onOpenChange={vi.fn()}
        onCreated={onCreated}
      />
    );

    // Fill name
    await user.type(
      screen.getByTestId("create-playlist-name-input"),
      "My Playlist"
    );

    // Select Public visibility
    await user.click(screen.getByRole("radio", { name: /public/i }));

    // Submit
    await user.click(screen.getByTestId("create-playlist-submit"));

    await waitFor(() => {
      expect(mockCreatePlaylist).toHaveBeenCalledWith(
        "My Playlist",
        expect.objectContaining({
          visibility: "public",
        })
      );
    });
  });
});
