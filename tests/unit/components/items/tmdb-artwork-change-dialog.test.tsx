/**
 * Unit tests for TmdbArtworkChangeDialog.
 * Tests dialog open/close, wizard step rendering, and apply/cancel flows.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TmdbArtworkChangeDialog } from "@/components/items/tmdb-artwork-change-dialog";

// Mock the TMDB image-fetching actions
vi.mock("@/lib/tmdb-actions", () => ({
  getImagesAction: vi.fn().mockResolvedValue({
    success: true,
    data: { posters: [], backdrops: [] },
  }),
  getSeasonImagesAction: vi.fn().mockResolvedValue({
    success: true,
    data: { posters: [] },
  }),
  getEpisodeImagesAction: vi.fn().mockResolvedValue({
    success: true,
    data: { stills: [] },
  }),
  applyMetadataAction: vi.fn().mockResolvedValue({ success: true }),
}));

import { getImagesAction } from "@/lib/tmdb-actions";

describe("TmdbArtworkChangeDialog", () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    itemId: "item-123",
    tmdbId: 155,
    tmdbType: "movie" as const,
    artworkType: "poster" as const,
    onComplete: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders dialog when open", () => {
    render(<TmdbArtworkChangeDialog {...defaultProps} />);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("does not render when closed", () => {
    render(<TmdbArtworkChangeDialog {...defaultProps} open={false} />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("fetches images on mount for movie poster", () => {
    render(<TmdbArtworkChangeDialog {...defaultProps} />);

    expect(getImagesAction).toHaveBeenCalledWith(155, "movie");
  });

  it("calls onOpenChange(false) when Cancel is clicked", async () => {
    const user = userEvent.setup();
    render(<TmdbArtworkChangeDialog {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: /cancel/i }));

    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("shows actionable error message when image fetch fails", async () => {
    vi.mocked(getImagesAction).mockResolvedValueOnce({
      success: false,
      error: "Failed to fetch images",
    });

    render(<TmdbArtworkChangeDialog {...defaultProps} />);

    await waitFor(() => {
      expect(
        screen.getByText(/try closing and reopening/i)
      ).toBeInTheDocument();
    });
  });

  it("disables Apply button when no image is selected", () => {
    render(<TmdbArtworkChangeDialog {...defaultProps} />);

    expect(screen.getByRole("button", { name: /apply/i })).toBeDisabled();
  });
});
