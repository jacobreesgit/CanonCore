/**
 * Unit tests for useSettingsDialog hook.
 * Tests dialog open/close/refresh lifecycle and file fetching.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSettingsDialog } from "@/hooks/use-settings-dialog";
import { getItemFiles } from "@/lib/item-file-actions";
import type { ItemWithArtwork } from "@/lib/types";

// Mock item-file-actions
vi.mock("@/lib/item-file-actions", () => ({
  getItemFiles: vi.fn(),
}));

// --- Mock data ---

const mockFiles = {
  media: [{ id: "file-1", filename: "video.mp4" }],
  artwork: [{ id: "file-2", filename: "poster.jpg" }],
  subtitles: [],
};

const mockItem = {
  id: "item-1",
  name: "Test Item",
  description: "A test item",
  parentId: null,
  order: 0,
  depth: 0,
  pinnedOrder: null,
  isPublic: true,
  inheritVisibility: false,
  userId: "user-1",
  createdAt: new Date(),
  updatedAt: new Date(),
  tmdbId: 12345,
  tmdbType: "movie",
  tmdbPosterPath: "/poster.jpg",
  tmdbBackdropPath: "/backdrop.jpg",
  tmdbLogoPath: null,
  dominantColour: null,
  tmdbShowTagline: true,
  tmdbShowMetadata: true,
  tmdbShowGenres: true,
  tmdbShowCast: false,
  tmdbShowProviders: false,
  tmdbShowVideos: false,
  tmdbShowRecommendations: false,
  driveFileId: null,
  driveModifiedAt: null,
  driveThumbnailUrl: null,
  syncStatus: "IDLE",
  syncError: null,
  driveConnectionId: null,
  artworkId: null,
  fileCounts: { media: 1, artwork: 1, subtitles: 0 },
  childCount: 0,
  primaryMediaName: "video.mp4",
  primaryDurationMs: null,
  primaryHeight: null,
  mediaIconType: "film" as const,
  progress: null,
} as unknown as ItemWithArtwork;

describe("useSettingsDialog", () => {
  let itemsRef: { current: ItemWithArtwork[] };
  let refetchItems: ReturnType<typeof vi.fn<() => Promise<void>>>;

  beforeEach(() => {
    vi.clearAllMocks();
    itemsRef = { current: [mockItem] };
    refetchItems = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
  });

  it("initial state is null", () => {
    const { result } = renderHook(() =>
      useSettingsDialog({ itemsRef, refetchItems })
    );

    expect(result.current.settingsDialog).toBeNull();
  });

  it("openSettings fetches files and sets dialog state", async () => {
    vi.mocked(getItemFiles).mockResolvedValue({
      success: true,
      data: mockFiles,
    } as unknown as Awaited<ReturnType<typeof getItemFiles>>);

    const { result } = renderHook(() =>
      useSettingsDialog({ itemsRef, refetchItems })
    );

    await act(async () => {
      await result.current.openSettings("item-1");
    });

    expect(getItemFiles).toHaveBeenCalledWith("item-1");
    expect(result.current.settingsDialog).not.toBeNull();
    expect(result.current.settingsDialog!.item.id).toBe("item-1");
    expect(result.current.settingsDialog!.item.name).toBe("Test Item");
    expect(result.current.settingsDialog!.item.description).toBe("A test item");
    expect(result.current.settingsDialog!.item.isPublic).toBe(true);
    expect(result.current.settingsDialog!.item.inheritVisibility).toBe(false);
    expect(result.current.settingsDialog!.item.hasParent).toBe(false);
    expect(result.current.settingsDialog!.item.hasChildren).toBe(false);
    expect(result.current.settingsDialog!.item.tmdbId).toBe(12345);
    expect(result.current.settingsDialog!.item.tmdbType).toBe("movie");
    expect(result.current.settingsDialog!.files).toEqual(mockFiles);
  });

  it("openSettings does nothing if item not found in ref", async () => {
    vi.mocked(getItemFiles).mockResolvedValue({
      success: true,
      data: mockFiles,
    } as unknown as Awaited<ReturnType<typeof getItemFiles>>);

    const { result } = renderHook(() =>
      useSettingsDialog({ itemsRef, refetchItems })
    );

    await act(async () => {
      await result.current.openSettings("nonexistent-id");
    });

    expect(getItemFiles).not.toHaveBeenCalled();
    expect(result.current.settingsDialog).toBeNull();
  });

  it("openSettings uses empty files on fetch failure", async () => {
    vi.mocked(getItemFiles).mockResolvedValue({
      success: false,
      error: "Unauthorized",
    } as unknown as Awaited<ReturnType<typeof getItemFiles>>);

    const { result } = renderHook(() =>
      useSettingsDialog({ itemsRef, refetchItems })
    );

    await act(async () => {
      await result.current.openSettings("item-1");
    });

    expect(result.current.settingsDialog).not.toBeNull();
    expect(result.current.settingsDialog!.files).toEqual({
      media: [],
      artwork: [],
      subtitles: [],
    });
  });

  it("closeSettings sets state to null", async () => {
    vi.mocked(getItemFiles).mockResolvedValue({
      success: true,
      data: mockFiles,
    } as unknown as Awaited<ReturnType<typeof getItemFiles>>);

    const { result } = renderHook(() =>
      useSettingsDialog({ itemsRef, refetchItems })
    );

    // Open first
    await act(async () => {
      await result.current.openSettings("item-1");
    });

    expect(result.current.settingsDialog).not.toBeNull();

    // Close
    act(() => {
      result.current.closeSettings();
    });

    expect(result.current.settingsDialog).toBeNull();
  });

  it("refreshSettings calls refetchItems and updates dialog", async () => {
    const updatedItem = {
      ...mockItem,
      name: "Updated Item",
      description: "Updated description",
    };

    const updatedFiles = {
      media: [{ id: "file-3", filename: "new-video.mp4" }],
      artwork: [],
      subtitles: [],
    };

    vi.mocked(getItemFiles)
      .mockResolvedValueOnce({
        success: true,
        data: mockFiles,
      } as unknown as Awaited<ReturnType<typeof getItemFiles>>)
      .mockResolvedValueOnce({
        success: true,
        data: updatedFiles,
      } as unknown as Awaited<ReturnType<typeof getItemFiles>>);

    refetchItems.mockImplementation(async () => {
      // Simulate items being updated after refetch
      itemsRef.current = [updatedItem];
    });

    const { result } = renderHook(() =>
      useSettingsDialog({ itemsRef, refetchItems })
    );

    // Open dialog
    await act(async () => {
      await result.current.openSettings("item-1");
    });

    expect(result.current.settingsDialog!.item.name).toBe("Test Item");

    // Refresh
    await act(async () => {
      await result.current.refreshSettings();
    });

    expect(refetchItems).toHaveBeenCalledTimes(1);
    expect(getItemFiles).toHaveBeenCalledTimes(2);
    expect(result.current.settingsDialog!.item.name).toBe("Updated Item");
    expect(result.current.settingsDialog!.item.description).toBe(
      "Updated description"
    );
    expect(result.current.settingsDialog!.files).toEqual(updatedFiles);
  });

  it("refreshSettings does nothing if dialog was closed during refetch", async () => {
    vi.mocked(getItemFiles).mockResolvedValue({
      success: true,
      data: mockFiles,
    } as unknown as Awaited<ReturnType<typeof getItemFiles>>);

    const { result } = renderHook(() =>
      useSettingsDialog({ itemsRef, refetchItems })
    );

    // Open dialog
    await act(async () => {
      await result.current.openSettings("item-1");
    });

    expect(result.current.settingsDialog).not.toBeNull();

    // Close dialog, then attempt refresh
    // The refetchItems call will resolve, but dialogRef.current is null
    refetchItems.mockImplementation(async () => {
      // Dialog was closed before refetch completes — simulate by closing synchronously
      // In the real flow, closeSettings would have been called before this resolves
    });

    // Close the dialog first
    act(() => {
      result.current.closeSettings();
    });

    // Now refresh — should bail out because dialog is closed
    await act(async () => {
      await result.current.refreshSettings();
    });

    // getItemFiles should only have been called once (during openSettings)
    // refreshSettings should not call it again since dialog was already closed
    expect(getItemFiles).toHaveBeenCalledTimes(1);
    expect(result.current.settingsDialog).toBeNull();
  });
});
