/**
 * Mock for lib/playlist-actions.ts
 * Prevents Prisma from being imported in Storybook's browser build.
 */

import { fn } from "storybook/test";

type ItemResult<T = void> =
  | { success: true; data?: T; error?: undefined }
  | { success?: false; error: string; data?: undefined };

interface PlaylistWithCount {
  id: string;
  name: string;
  description: string | null;
  order: number;
  isPublic: boolean;
  artworkUrl: string | null;
  itemCount: number;
  previewArtworkIds: (string | null)[];
  createdAt: Date;
  updatedAt: Date;
}

interface PlaylistMembership {
  id: string;
  name: string;
  isMember: boolean;
}

export const createPlaylist = fn(
  async (): Promise<ItemResult<{ id: string; name: string }>> => ({
    success: true,
    data: { id: "playlist-new", name: "New Playlist" },
  })
);

export const getPlaylist = fn(
  async (): Promise<
    ItemResult<{
      id: string;
      name: string;
      description: string | null;
      isPublic: boolean;
      items: never[];
    }>
  > => ({
    success: true,
    data: {
      id: "playlist-1",
      name: "Mock Playlist",
      description: null,
      isPublic: true,
      items: [],
    },
  })
);

export const getUserPlaylists = fn(
  async (): Promise<ItemResult<PlaylistWithCount[]>> => ({
    success: true,
    data: [
      {
        id: "playlist-1",
        name: "Favourites",
        description: "My favourite films",
        order: 0,
        isPublic: true,
        artworkUrl: null,
        itemCount: 12,
        previewArtworkIds: ["art-1", "art-2", "art-3", "art-4"],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "playlist-2",
        name: "Watch Later",
        description: null,
        order: 1,
        isPublic: false,
        artworkUrl: null,
        itemCount: 5,
        previewArtworkIds: ["art-5", null, null, null],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
  })
);

export const updatePlaylist = fn(
  async (): Promise<ItemResult> => ({
    success: true,
  })
);

export const deletePlaylist = fn(
  async (): Promise<ItemResult> => ({
    success: true,
  })
);

export const reorderPlaylists = fn(
  async (): Promise<ItemResult> => ({
    success: true,
  })
);

export const addItemToPlaylists = fn(
  async (): Promise<ItemResult> => ({
    success: true,
  })
);

export const removeItemFromPlaylist = fn(
  async (): Promise<ItemResult> => ({
    success: true,
  })
);

export const removeItemsFromPlaylist = fn(
  async (): Promise<ItemResult> => ({
    success: true,
  })
);

export const reorderPlaylistItems = fn(
  async (): Promise<ItemResult> => ({
    success: true,
  })
);

export const getPlaylistsForItem = fn(
  async (): Promise<ItemResult<PlaylistMembership[]>> => ({
    success: true,
    data: [
      { id: "playlist-1", name: "Favourites", isMember: true },
      { id: "playlist-2", name: "Watch Later", isMember: false },
      { id: "playlist-3", name: "Best of 2024", isMember: false },
    ],
  })
);
