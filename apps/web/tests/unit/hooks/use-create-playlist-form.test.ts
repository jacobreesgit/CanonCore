/**
 * Unit tests for useCreatePlaylistForm hook.
 * Tests form state management, validation, submission, and reset.
 */

import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useCreatePlaylistForm } from "@/hooks/use-create-playlist-form";

vi.mock("@/lib/playlist-actions", () => ({
  createPlaylist: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { createPlaylist } from "@/lib/playlist-actions";

const mockCreatePlaylist = vi.mocked(createPlaylist);

describe("useCreatePlaylistForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts with empty state", () => {
    const { result } = renderHook(() => useCreatePlaylistForm());

    expect(result.current.name).toBe("");
    expect(result.current.description).toBe("");
    expect(result.current.visibility).toBe("private");
    expect(result.current.selectedItemIds.size).toBe(0);
    expect(result.current.error).toBeNull();
    expect(result.current.isCreating).toBe(false);
  });

  it("updates name", () => {
    const { result } = renderHook(() => useCreatePlaylistForm());

    act(() => {
      result.current.setName("My Playlist");
    });

    expect(result.current.name).toBe("My Playlist");
  });

  it("updates description", () => {
    const { result } = renderHook(() => useCreatePlaylistForm());

    act(() => {
      result.current.setDescription("A great playlist");
    });

    expect(result.current.description).toBe("A great playlist");
  });

  it("updates visibility", () => {
    const { result } = renderHook(() => useCreatePlaylistForm());

    act(() => {
      result.current.setVisibility("public");
    });

    expect(result.current.visibility).toBe("public");
  });

  it("toggles item selection", () => {
    const { result } = renderHook(() => useCreatePlaylistForm());

    act(() => {
      result.current.toggleItemId("item-1");
    });

    expect(result.current.selectedItemIds.has("item-1")).toBe(true);

    act(() => {
      result.current.toggleItemId("item-1");
    });

    expect(result.current.selectedItemIds.has("item-1")).toBe(false);
  });

  it("sets error when name is empty on submit", async () => {
    const { result } = renderHook(() => useCreatePlaylistForm());

    await act(async () => {
      await result.current.handleSubmit({
        preventDefault: vi.fn(),
      } as unknown as React.FormEvent);
    });

    expect(result.current.error).toBe("Name is required");
    expect(mockCreatePlaylist).not.toHaveBeenCalled();
  });

  it("calls createPlaylist with correct args on submit", async () => {
    mockCreatePlaylist.mockResolvedValue({
      success: true,
      data: { id: "pl-1", name: "Test" },
    });

    const onCreated = vi.fn();
    const { result } = renderHook(() => useCreatePlaylistForm(onCreated));

    act(() => {
      result.current.setName("Test");
      result.current.setDescription("Desc");
      result.current.setVisibility("public");
      result.current.toggleItemId("item-1");
    });

    await act(async () => {
      await result.current.handleSubmit({
        preventDefault: vi.fn(),
      } as unknown as React.FormEvent);
    });

    expect(mockCreatePlaylist).toHaveBeenCalledWith("Test", {
      description: "Desc",
      visibility: "public",
      itemIds: ["item-1"],
    });
    expect(onCreated).toHaveBeenCalledWith({ id: "pl-1", name: "Test" });
  });

  it("calls onClose after successful creation", async () => {
    mockCreatePlaylist.mockResolvedValue({
      success: true,
      data: { id: "pl-1", name: "Test" },
    });

    const onClose = vi.fn();
    const { result } = renderHook(() =>
      useCreatePlaylistForm(undefined, onClose)
    );

    act(() => {
      result.current.setName("Test");
    });

    await act(async () => {
      await result.current.handleSubmit({
        preventDefault: vi.fn(),
      } as unknown as React.FormEvent);
    });

    expect(onClose).toHaveBeenCalled();
  });

  it("sets error on server error", async () => {
    mockCreatePlaylist.mockResolvedValue({ error: "Server error" });

    const { result } = renderHook(() => useCreatePlaylistForm());

    act(() => {
      result.current.setName("Test");
    });

    await act(async () => {
      await result.current.handleSubmit({
        preventDefault: vi.fn(),
      } as unknown as React.FormEvent);
    });

    expect(result.current.error).toBe("Server error");
    expect(result.current.isCreating).toBe(false);
  });

  it("resets form state", () => {
    const { result } = renderHook(() => useCreatePlaylistForm());

    act(() => {
      result.current.setName("Test");
      result.current.setDescription("Desc");
      result.current.setVisibility("public");
      result.current.toggleItemId("item-1");
      result.current.setError("Some error");
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.name).toBe("");
    expect(result.current.description).toBe("");
    expect(result.current.visibility).toBe("private");
    expect(result.current.selectedItemIds.size).toBe(0);
    expect(result.current.error).toBeNull();
    expect(result.current.isCreating).toBe(false);
  });
});
