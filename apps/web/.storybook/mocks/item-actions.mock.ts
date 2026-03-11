/**
 * Mock for lib/item-actions.ts
 * Prevents googleapis (via google-drive-client) from being imported in Storybook's browser build.
 */

import { fn } from "storybook/test";

// Types (simplified for mocking)
type ItemResult<T = void> = { success: true; data?: T } | { error: string };

interface Item {
  id: string;
  name: string;
  description: string | null;
  parentId: string | null;
  order: number;
  depth: number;
  pinnedOrder: number | null;
  isPublic: boolean;
  inheritVisibility: boolean;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  tmdbId: number | null;
  tmdbType: string | null;
  tmdbPosterPath: string | null;
  tmdbBackdropPath: string | null;
  driveFileId: string | null;
  driveModifiedAt: Date | null;
  driveThumbnailUrl: string | null;
  syncStatus: string;
  syncError: string | null;
  driveConnectionId: string | null;
  tmdbShowTagline: boolean;
  tmdbShowMetadata: boolean;
  tmdbShowGenres: boolean;
  tmdbShowCast: boolean;
  tmdbShowProviders: boolean;
  tmdbShowVideos: boolean;
  tmdbShowRecommendations: boolean;
}

interface ItemWithArtwork extends Item {
  tmdbPosterPath: string | null;
  tmdbBackdropPath: string | null;
  artworkId: string | null;
  fileCounts: { media: number; artwork: number; subtitles: number };
  childCount: number;
  primaryMediaName: string | null;
  mediaIconType: "film" | "music" | "mixed" | null;
  progress: {
    watchedItems: number;
    itemsWithMedia: number;
    percentage: number | null;
    totalItems: number;
  } | null;
}

interface ItemProgress {
  watchedItems: number;
  itemsWithMedia: number;
  percentage: number | null;
  totalItems: number;
}

interface BreadcrumbItem {
  id: string;
  name: string;
}

interface SearchableItem {
  id: string;
  name: string;
  parentId: string | null;
  depth: number;
  description: string | null;
  tmdbPosterPath: string | null;
  artworkId: string | null;
  breadcrumb: string | null;
  ownerUsername: string | null;
}

interface PinnedItem {
  id: string;
  name: string;
  pinnedOrder: number;
}

interface NextItem {
  id: string;
  name: string;
}

export interface CreateItemMetadataOptions {
  tmdbId: number;
  mediaType: "movie" | "tv";
  options: {
    updateName: boolean;
    updateDescription: boolean;
    updatePoster: boolean;
    updateBackdrop: boolean;
  };
}

export interface ProfileItemsResult {
  items: ItemWithArtwork[];
  isOwner: boolean;
  profile: {
    id: string;
    username: string;
    name: string | null;
    hasImage: boolean;
    hasHeroImage: boolean;
  };
}

export interface ProfileChildrenResult {
  items: ItemWithArtwork[];
  isOwner: boolean;
  parent: {
    id: string;
    name: string;
    parentId: string | null;
  };
}

// Mock data factory
const createMockItem = (overrides: Partial<Item> = {}): Item => ({
  id: "mock-item-id",
  name: "Mock Item",
  description: null,
  parentId: null,
  order: 0,
  depth: 0,
  pinnedOrder: null,
  isPublic: false,
  inheritVisibility: false,
  userId: "mock-user-id",
  createdAt: new Date(),
  updatedAt: new Date(),
  tmdbId: null,
  tmdbType: null,
  tmdbPosterPath: null,
  tmdbBackdropPath: null,
  driveFileId: null,
  driveModifiedAt: null,
  driveThumbnailUrl: null,
  syncStatus: "SYNCED",
  syncError: null,
  driveConnectionId: null,
  tmdbShowTagline: true,
  tmdbShowMetadata: true,
  tmdbShowGenres: true,
  tmdbShowCast: true,
  tmdbShowProviders: true,
  tmdbShowVideos: true,
  tmdbShowRecommendations: true,
  ...overrides,
});

// Mock functions
export const getItemProgress = fn(
  async (): Promise<ItemProgress | null> => null
);

export const getLibraryProgress = fn(
  async (): Promise<ItemProgress | null> => ({
    watchedItems: 5,
    itemsWithMedia: 10,
    percentage: 50,
    totalItems: 20,
  })
);

export const getFirstIncompleteItem = fn(
  async (): Promise<ItemResult<NextItem | null>> => ({
    success: true,
    data: null,
  })
);

export const getItems = fn(
  async (): Promise<ItemResult<ItemWithArtwork[]>> => ({
    success: true,
    data: [],
  })
);

// Mock folder items for ForkDestinationDialog
const mockFolderItems: ItemWithArtwork[] = [
  {
    id: "folder-movies",
    name: "Movies",
    description: "My movie collection",
    parentId: null,
    order: 0,
    depth: 0,
    pinnedOrder: 0,
    isPublic: false,
    inheritVisibility: false,
    userId: "mock-user-id",
    createdAt: new Date(),
    updatedAt: new Date(),
    tmdbId: null,
    tmdbType: null,
    tmdbPosterPath: null,
    tmdbBackdropPath: null,
    driveFileId: null,
    driveModifiedAt: null,
    driveThumbnailUrl: null,
    syncStatus: "SYNCED",
    syncError: null,
    driveConnectionId: null,
    tmdbShowTagline: true,
    tmdbShowMetadata: true,
    tmdbShowGenres: true,
    tmdbShowCast: true,
    tmdbShowProviders: true,
    tmdbShowVideos: true,
    tmdbShowRecommendations: true,
    artworkId: null,
    fileCounts: { media: 0, artwork: 0, subtitles: 0 },
    childCount: 5,
    primaryMediaName: null,
    mediaIconType: null,
    progress: null,
  },
  {
    id: "folder-tv",
    name: "TV Shows",
    description: "My TV show collection",
    parentId: null,
    order: 1,
    depth: 0,
    pinnedOrder: 1,
    isPublic: false,
    inheritVisibility: false,
    userId: "mock-user-id",
    createdAt: new Date(),
    updatedAt: new Date(),
    tmdbId: null,
    tmdbType: null,
    tmdbPosterPath: null,
    tmdbBackdropPath: null,
    driveFileId: null,
    driveModifiedAt: null,
    driveThumbnailUrl: null,
    syncStatus: "SYNCED",
    syncError: null,
    driveConnectionId: null,
    tmdbShowTagline: true,
    tmdbShowMetadata: true,
    tmdbShowGenres: true,
    tmdbShowCast: true,
    tmdbShowProviders: true,
    tmdbShowVideos: true,
    tmdbShowRecommendations: true,
    artworkId: null,
    fileCounts: { media: 0, artwork: 0, subtitles: 0 },
    childCount: 3,
    primaryMediaName: null,
    mediaIconType: null,
    progress: null,
  },
  {
    id: "folder-action",
    name: "Action",
    description: "Action movies",
    parentId: "folder-movies",
    order: 0,
    depth: 1,
    pinnedOrder: null,
    isPublic: false,
    inheritVisibility: true,
    userId: "mock-user-id",
    createdAt: new Date(),
    updatedAt: new Date(),
    tmdbId: null,
    tmdbType: null,
    tmdbPosterPath: null,
    tmdbBackdropPath: null,
    driveFileId: null,
    driveModifiedAt: null,
    driveThumbnailUrl: null,
    syncStatus: "SYNCED",
    syncError: null,
    driveConnectionId: null,
    tmdbShowTagline: true,
    tmdbShowMetadata: true,
    tmdbShowGenres: true,
    tmdbShowCast: true,
    tmdbShowProviders: true,
    tmdbShowVideos: true,
    tmdbShowRecommendations: true,
    artworkId: null,
    fileCounts: { media: 0, artwork: 0, subtitles: 0 },
    childCount: 2,
    primaryMediaName: null,
    mediaIconType: null,
    progress: null,
  },
  {
    id: "folder-comedy",
    name: "Comedy",
    description: "Comedy movies",
    parentId: "folder-movies",
    order: 1,
    depth: 1,
    pinnedOrder: null,
    isPublic: false,
    inheritVisibility: true,
    userId: "mock-user-id",
    createdAt: new Date(),
    updatedAt: new Date(),
    tmdbId: null,
    tmdbType: null,
    tmdbPosterPath: null,
    tmdbBackdropPath: null,
    driveFileId: null,
    driveModifiedAt: null,
    driveThumbnailUrl: null,
    syncStatus: "SYNCED",
    syncError: null,
    driveConnectionId: null,
    tmdbShowTagline: true,
    tmdbShowMetadata: true,
    tmdbShowGenres: true,
    tmdbShowCast: true,
    tmdbShowProviders: true,
    tmdbShowVideos: true,
    tmdbShowRecommendations: true,
    artworkId: null,
    fileCounts: { media: 0, artwork: 0, subtitles: 0 },
    childCount: 0,
    primaryMediaName: null,
    mediaIconType: null,
    progress: null,
  },
  {
    id: "folder-drama",
    name: "Drama",
    description: "Drama TV shows",
    parentId: "folder-tv",
    order: 0,
    depth: 1,
    pinnedOrder: null,
    isPublic: false,
    inheritVisibility: true,
    userId: "mock-user-id",
    createdAt: new Date(),
    updatedAt: new Date(),
    tmdbId: null,
    tmdbType: null,
    tmdbPosterPath: null,
    tmdbBackdropPath: null,
    driveFileId: null,
    driveModifiedAt: null,
    driveThumbnailUrl: null,
    syncStatus: "SYNCED",
    syncError: null,
    driveConnectionId: null,
    tmdbShowTagline: true,
    tmdbShowMetadata: true,
    tmdbShowGenres: true,
    tmdbShowCast: true,
    tmdbShowProviders: true,
    tmdbShowVideos: true,
    tmdbShowRecommendations: true,
    artworkId: null,
    fileCounts: { media: 0, artwork: 0, subtitles: 0 },
    childCount: 0,
    primaryMediaName: null,
    mediaIconType: null,
    progress: null,
  },
];

export const getAllItems = fn(
  async (): Promise<ItemResult<ItemWithArtwork[]>> => ({
    success: true,
    data: mockFolderItems,
  })
);

export const getDescendants = fn(
  async (): Promise<ItemResult<ItemWithArtwork[]>> => ({
    success: true,
    data: [],
  })
);

export const getItem = fn(
  async (): Promise<
    ItemResult<{ item: Item; ancestors: BreadcrumbItem[] }>
  > => ({
    success: true,
    data: {
      item: createMockItem(),
      ancestors: [],
    },
  })
);

export const createItem = fn(
  async (): Promise<ItemResult<Item>> => ({
    success: true,
    data: createMockItem(),
  })
);

export const updateItem = fn(
  async (): Promise<ItemResult> => ({
    success: true,
  })
);

export const deleteItem = fn(
  async (): Promise<ItemResult> => ({
    success: true,
  })
);

export const reorderItems = fn(
  async (): Promise<ItemResult> => ({
    success: true,
  })
);

export const getSearchableItems = fn(
  async (): Promise<ItemResult<SearchableItem[]>> => ({
    success: true,
    data: [],
  })
);

export const deleteItems = fn(
  async (): Promise<ItemResult<{ deleted: number; skipped: number }>> => ({
    success: true,
    data: { deleted: 0, skipped: 0 },
  })
);

export const createItemWithMetadata = fn(
  async (): Promise<ItemResult<Item>> => ({
    success: true,
    data: createMockItem(),
  })
);

export const pinItem = fn(
  async (): Promise<ItemResult> => ({
    success: true,
  })
);

export const unpinItem = fn(
  async (): Promise<ItemResult> => ({
    success: true,
  })
);

export const getPinnedItems = fn(
  async (): Promise<ItemResult<PinnedItem[]>> => ({
    success: true,
    data: [],
  })
);

export const setItemVisibility = fn(
  async (): Promise<ItemResult<{ affectedCount: number }>> => ({
    success: true,
    data: { affectedCount: 0 },
  })
);

export const getItemVisibility = fn(
  async (): Promise<ItemResult<{ isPublic: boolean }>> => ({
    success: true,
    data: { isPublic: false },
  })
);

export const setInheritVisibility = fn(
  async (): Promise<ItemResult<void>> => ({
    success: true,
  })
);

export const countInheritingChildren = fn(async (): Promise<number> => 0);

export const getItemsForProfile = fn(
  async (): Promise<ProfileItemsResult> => ({
    items: [],
    isOwner: true,
    profile: {
      id: "mock-user-id",
      username: "mockuser",
      name: "Mock User",
      hasImage: false,
      hasHeroImage: false,
    },
  })
);

export const getItemChildrenForProfile = fn(
  async (): Promise<ItemResult<ProfileChildrenResult>> => ({
    success: true,
    data: {
      items: [],
      isOwner: true,
      parent: {
        id: "mock-parent-id",
        name: "Mock Parent",
        parentId: null,
      },
    },
  })
);
