/**
 * Unit tests for useEditPlaylistForm hook.
 * Tests form state management, artwork handling, share token management,
 * validation, submission, and reset.
 */

import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useEditPlaylistForm } from "@/hooks/use-edit-playlist-form";

vi.mock("@/lib/playlist-actions", () => ({
  updatePlaylist: vi.fn(),
  updatePlaylistArtwork: vi.fn(),
  removePlaylistArtwork: vi.fn(),
  regenerateShareToken: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import {
  updatePlaylist,
  updatePlaylistArtwork,
  removePlaylistArtwork,
  regenerateShareToken,
} from "@/lib/playlist-actions";

const mockUpdatePlaylist = vi.mocked(updatePlaylist);
const mockUpdateArtwork = vi.mocked(updatePlaylistArtwork);
const mockRemoveArtwork = vi.mocked(removePlaylistArtwork);
const mockRegenerateToken = vi.mocked(regenerateShareToken);

const mockPlaylist = {
  id: "pl-1",
  name: "Test Playlist",
  description: "A description",
  isPublic: true,
  hasArtwork: false,
  shareToken: null,
};

describe("useEditPlaylistForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("initialises with playlist data", () => {
    const { result } = renderHook(() => useEditPlaylistForm(mockPlaylist));

    expect(result.current.name).toBe("Test Playlist");
    expect(result.current.description).toBe("A description");
    expect(result.current.visibility).toBe("public");
    expect(result.current.error).toBeNull();
    expect(result.current.isSubmitting).toBe(false);
    expect(result.current.artworkFile).toBeNull();
    expect(result.current.shareToken).toBeNull();
  });

  it("updates name", () => {
    const { result } = renderHook(() => useEditPlaylistForm(mockPlaylist));

    act(() => {
      result.current.setName("Updated Name");
    });

    expect(result.current.name).toBe("Updated Name");
  });

  it("updates description", () => {
    const { result } = renderHook(() => useEditPlaylistForm(mockPlaylist));

    act(() => {
      result.current.setDescription("New desc");
    });

    expect(result.current.description).toBe("New desc");
  });

  it("updates visibility", () => {
    const { result } = renderHook(() => useEditPlaylistForm(mockPlaylist));

    act(() => {
      result.current.setVisibility("private");
    });

    expect(result.current.visibility).toBe("private");
  });

  it("sets error when name is empty on submit", async () => {
    const { result } = renderHook(() => useEditPlaylistForm(mockPlaylist));

    act(() => {
      result.current.setName("   ");
    });

    await act(async () => {
      await result.current.handleSubmit({
        preventDefault: vi.fn(),
      } as unknown as React.FormEvent);
    });

    expect(result.current.error).toBe("Name is required");
    expect(mockUpdatePlaylist).not.toHaveBeenCalled();
  });

  it("calls updatePlaylist with form data on submit", async () => {
    mockUpdatePlaylist.mockResolvedValue({ success: true });

    const onUpdated = vi.fn();
    const onClose = vi.fn();
    const { result } = renderHook(() =>
      useEditPlaylistForm(mockPlaylist, "testuser", onUpdated, onClose)
    );

    act(() => {
      result.current.setName("Updated");
      result.current.setDescription("New desc");
    });

    await act(async () => {
      await result.current.setVisibility("private");
    });

    await act(async () => {
      await result.current.handleSubmit({
        preventDefault: vi.fn(),
      } as unknown as React.FormEvent);
    });

    expect(mockUpdatePlaylist).toHaveBeenCalledWith("pl-1", {
      name: "Updated",
      description: "New desc",
      isPublic: false,
    });
    expect(onUpdated).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Updated",
        description: "New desc",
        isPublic: false,
      })
    );
    expect(onClose).toHaveBeenCalled();
  });

  it("sets error on server error", async () => {
    mockUpdatePlaylist.mockResolvedValue({ error: "Server error" });

    const { result } = renderHook(() => useEditPlaylistForm(mockPlaylist));

    await act(async () => {
      await result.current.handleSubmit({
        preventDefault: vi.fn(),
      } as unknown as React.FormEvent);
    });

    expect(result.current.error).toBe("Server error");
    expect(result.current.isSubmitting).toBe(false);
  });

  it("resets form state to playlist values", async () => {
    const { result } = renderHook(() => useEditPlaylistForm(mockPlaylist));

    await act(async () => {
      result.current.setName("Changed");
      result.current.setDescription("Changed");
      await result.current.setVisibility("private");
      result.current.setError("Some error");
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.name).toBe("Test Playlist");
    expect(result.current.description).toBe("A description");
    expect(result.current.visibility).toBe("public");
    expect(result.current.error).toBeNull();
    expect(result.current.isSubmitting).toBe(false);
  });

  describe("artwork handling", () => {
    it("computes artworkSrc from playlist when hasArtwork", () => {
      const { result } = renderHook(() =>
        useEditPlaylistForm({ ...mockPlaylist, hasArtwork: true })
      );

      expect(result.current.artworkSrc).toBe(
        "/api/playlist/artwork?playlistId=pl-1"
      );
    });

    it("returns null artworkSrc when no artwork", () => {
      const { result } = renderHook(() => useEditPlaylistForm(mockPlaylist));

      expect(result.current.artworkSrc).toBeNull();
    });

    it("sets removeArt flag on handleRemoveArtwork", () => {
      const { result } = renderHook(() =>
        useEditPlaylistForm({ ...mockPlaylist, hasArtwork: true })
      );

      act(() => {
        result.current.handleRemoveArtwork();
      });

      expect(result.current.removeArt).toBe(true);
      expect(result.current.artworkSrc).toBeNull();
    });

    it("uploads artwork on submit when artworkFile set", async () => {
      mockUpdatePlaylist.mockResolvedValue({ success: true });
      mockUpdateArtwork.mockResolvedValue({ success: true });

      const onUpdated = vi.fn();
      const { result } = renderHook(() =>
        useEditPlaylistForm(mockPlaylist, undefined, onUpdated)
      );

      act(() => {
        result.current.handleArtworkDrop([
          new File(["test"], "art.jpg", { type: "image/jpeg" }),
        ]);
      });

      expect(result.current.artworkFile).not.toBeNull();

      await act(async () => {
        await result.current.handleSubmit({
          preventDefault: vi.fn(),
        } as unknown as React.FormEvent);
      });

      expect(mockUpdateArtwork).toHaveBeenCalledWith(
        "pl-1",
        expect.any(FormData)
      );
      expect(onUpdated).toHaveBeenCalledWith(
        expect.objectContaining({ hasArtwork: true })
      );
    });

    it("removes artwork on submit when removeArt is set", async () => {
      mockUpdatePlaylist.mockResolvedValue({ success: true });
      mockRemoveArtwork.mockResolvedValue({ success: true });

      const onUpdated = vi.fn();
      const { result } = renderHook(() =>
        useEditPlaylistForm(
          { ...mockPlaylist, hasArtwork: true },
          undefined,
          onUpdated
        )
      );

      act(() => {
        result.current.handleRemoveArtwork();
      });

      await act(async () => {
        await result.current.handleSubmit({
          preventDefault: vi.fn(),
        } as unknown as React.FormEvent);
      });

      expect(mockRemoveArtwork).toHaveBeenCalledWith("pl-1");
      expect(onUpdated).toHaveBeenCalledWith(
        expect.objectContaining({ hasArtwork: false })
      );
    });
  });

  describe("share token management", () => {
    it("initialises with existing share token", () => {
      const { result } = renderHook(() =>
        useEditPlaylistForm({ ...mockPlaylist, shareToken: "abc123" })
      );

      expect(result.current.shareToken).toBe("abc123");
    });

    it("generates share token when switching to unlisted", async () => {
      mockRegenerateToken.mockResolvedValue({
        success: true,
        data: { shareToken: "new-token" },
      });

      const { result } = renderHook(() => useEditPlaylistForm(mockPlaylist));

      await act(async () => {
        await result.current.setVisibility("unlisted");
      });

      expect(result.current.shareToken).toBe("new-token");
    });

    it("disables sharing when switching to private", async () => {
      mockUpdatePlaylist.mockResolvedValue({ success: true });

      const { result } = renderHook(() =>
        useEditPlaylistForm({ ...mockPlaylist, shareToken: "abc123" })
      );

      await act(async () => {
        await result.current.setVisibility("private");
      });

      expect(result.current.shareToken).toBeNull();
    });

    it("regenerates share token", async () => {
      mockRegenerateToken.mockResolvedValue({
        success: true,
        data: { shareToken: "regenerated" },
      });

      const { result } = renderHook(() =>
        useEditPlaylistForm({ ...mockPlaylist, shareToken: "old-token" })
      );

      await act(async () => {
        await result.current.handleRegenerate();
      });

      expect(result.current.shareToken).toBe("regenerated");
      expect(result.current.isRegenerating).toBe(false);
    });
  });
});
