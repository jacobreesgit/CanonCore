/**
 * Stories for ProfilePage component.
 * Owner mode: Items/Playlists tabs with responsive desktop/mobile rendering.
 * Viewer mode: Read-only grid with pinned items and playlists section.
 */

import type { Meta, StoryObj } from "@storybook/nextjs";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { userEvent, within, expect } from "storybook/test";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";

import { ProfilePage } from "./profile-page";
import playbackReducer from "@/lib/store/playback-slice";
import uiPrefsReducer from "@/lib/store/ui-prefs-slice";
import type { ItemWithArtwork, PlaylistWithCount } from "@/lib/types";

// --- Mock data ---

const mockProfile = {
  id: "user-1",
  username: "filmfan",
  name: "Film Fan",
  hasImage: false,
  hasHeroImage: false,
  dominantColour: null,
  bio: null,
};

const createMockItem = (
  overrides: Partial<ItemWithArtwork> = {}
): ItemWithArtwork => ({
  id: `item-${Math.random().toString(36).slice(2, 8)}`,
  name: "Mock Item",
  description: null,
  parentId: null,
  order: 0,
  depth: 0,
  pinnedOrder: null,
  isPublic: false,
  inheritVisibility: false,
  userId: "user-1",
  createdAt: new Date(),
  updatedAt: new Date(),
  tmdbId: null,
  tmdbType: null,
  tmdbPosterPath: null,
  tmdbBackdropPath: null,
  tmdbLogoPath: null,
  dominantColour: null,
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
  ...overrides,
});

const mockItems: ItemWithArtwork[] = [
  createMockItem({ id: "item-1", name: "Inception", order: 0 }),
  createMockItem({ id: "item-2", name: "The Matrix", order: 1 }),
  createMockItem({ id: "item-3", name: "Interstellar", order: 2 }),
  createMockItem({ id: "item-4", name: "Blade Runner 2049", order: 3 }),
];

const mockOwnerPlaylists: PlaylistWithCount[] = [
  {
    id: "playlist-1",
    name: "Favourites",
    description: "My favourite films",
    isPublic: true,
    itemCount: 12,
    previewPosters: [
      { tmdbPosterPath: null, artworkId: null },
      { tmdbPosterPath: null, artworkId: null },
      { tmdbPosterPath: null, artworkId: null },
      { tmdbPosterPath: null, artworkId: null },
    ],
    hasArtwork: false,
    systemType: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    order: 0,
  },
  {
    id: "playlist-2",
    name: "Watch Later",
    description: null,
    isPublic: false,
    itemCount: 5,
    previewPosters: [
      { tmdbPosterPath: null, artworkId: null },
      { tmdbPosterPath: null, artworkId: null },
      { tmdbPosterPath: null, artworkId: null },
      { tmdbPosterPath: null, artworkId: null },
    ],
    hasArtwork: false,
    systemType: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    order: 1,
  },
];

const mockOwnerPlaylistsWithSmart: PlaylistWithCount[] = [
  {
    id: "playlist-smart-1",
    name: "Continue Watching",
    description: null,
    isPublic: false,
    itemCount: 3,
    previewPosters: [
      { tmdbPosterPath: null, artworkId: null },
      { tmdbPosterPath: null, artworkId: null },
      { tmdbPosterPath: null, artworkId: null },
      { tmdbPosterPath: null, artworkId: null },
    ],
    hasArtwork: false,
    systemType: "CONTINUE_WATCHING",
    createdAt: new Date(),
    updatedAt: new Date(),
    order: 0,
  },
  {
    id: "playlist-smart-2",
    name: "Watchlist",
    description: null,
    isPublic: false,
    itemCount: 7,
    previewPosters: [
      { tmdbPosterPath: null, artworkId: null },
      { tmdbPosterPath: null, artworkId: null },
      { tmdbPosterPath: null, artworkId: null },
      { tmdbPosterPath: null, artworkId: null },
    ],
    hasArtwork: false,
    systemType: "WATCHLIST",
    createdAt: new Date(),
    updatedAt: new Date(),
    order: 1,
  },
  {
    id: "playlist-user-1",
    name: "Favourites",
    description: "My favourite films",
    isPublic: true,
    itemCount: 12,
    previewPosters: [
      { tmdbPosterPath: null, artworkId: null },
      { tmdbPosterPath: null, artworkId: null },
      { tmdbPosterPath: null, artworkId: null },
      { tmdbPosterPath: null, artworkId: null },
    ],
    hasArtwork: false,
    systemType: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    order: 2,
  },
  {
    id: "playlist-user-2",
    name: "Watch Later",
    description: null,
    isPublic: false,
    itemCount: 5,
    previewPosters: [
      { tmdbPosterPath: null, artworkId: null },
      { tmdbPosterPath: null, artworkId: null },
      { tmdbPosterPath: null, artworkId: null },
      { tmdbPosterPath: null, artworkId: null },
    ],
    hasArtwork: false,
    systemType: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    order: 3,
  },
];

const meta = {
  title: "Profile/ProfilePage",
  component: ProfilePage,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component: `
Profile page content component with responsive tabbed layout.

## Owner Mode

- **Items tab** — ContentToolbar with sort/filter/sync + ItemsView grid with editing
- **Playlists tab** — PlaylistSection with create/edit/delete actions
- Desktop: \`UnderlineTabs\` with click navigation
- Mobile: \`SwipeableUnderlineTabs\` with swipe gestures (disabled during edit mode)

## Viewer Mode

- Read-only grid with pinned items section
- Sort by recently updated, name, etc.
- Public playlists section (hidden when empty)
        `,
      },
    },
  },
  decorators: [
    (Story) => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      const store = configureStore({
        reducer: {
          playback: playbackReducer,
          uiPrefs: uiPrefsReducer,
        },
      });
      return (
        <Provider store={store}>
          <QueryClientProvider client={queryClient}>
            <NuqsTestingAdapter>
              <div className="bg-background flex min-h-screen flex-col">
                <Story />
              </div>
            </NuqsTestingAdapter>
          </QueryClientProvider>
        </Provider>
      );
    },
  ],
} satisfies Meta<typeof ProfilePage>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Owner mode with items and playlists — default Items tab active. */
export const OwnerWithItems: Story = {
  args: {
    profile: mockProfile,
    items: mockItems,
    isOwner: true,
    hasDriveConnection: false,
    ownerPlaylists: mockOwnerPlaylists,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Items tab should be active by default
    const itemsTab = canvas.getByRole("tab", { name: "Items" });
    const playlistsTab = canvas.getByRole("tab", { name: "Playlists" });

    await expect(itemsTab).toHaveAttribute("aria-selected", "true");
    await expect(playlistsTab).toHaveAttribute("aria-selected", "false");

    // Switch to Playlists tab
    await userEvent.click(playlistsTab);
    await expect(playlistsTab).toHaveAttribute("aria-selected", "true");
    await expect(itemsTab).toHaveAttribute("aria-selected", "false");

    // Switch back to Items tab
    await userEvent.click(itemsTab);
    await expect(itemsTab).toHaveAttribute("aria-selected", "true");
  },
  parameters: {
    docs: {
      description: {
        story:
          "Owner mode with 4 items and 2 playlists. Click tabs to switch between Items and Playlists views.",
      },
    },
  },
};

/** Owner mode with empty library — shows empty state in Items tab. */
export const OwnerEmpty: Story = {
  args: {
    profile: mockProfile,
    items: [],
    isOwner: true,
    hasDriveConnection: false,
    ownerPlaylists: [],
  },
  parameters: {
    docs: {
      description: {
        story:
          "Owner mode with no items or playlists. Items tab shows empty state, Playlists tab shows create action.",
      },
    },
  },
};

/** Owner mode with Google Drive connected — shows sync button in toolbar. */
export const OwnerWithDrive: Story = {
  args: {
    profile: mockProfile,
    items: mockItems,
    isOwner: true,
    hasDriveConnection: true,
    ownerPlaylists: mockOwnerPlaylists,
    libraryProgress: {
      watchedItems: 2,
      itemsWithMedia: 4,
      percentage: 50,
      totalItems: 4,
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          "Owner mode with Google Drive connected and 50% library progress. Sync button visible in toolbar.",
      },
    },
  },
};

/** Owner mode with smart playlists and user playlists — shows split sections. */
export const OwnerWithSmartPlaylists: Story = {
  args: {
    profile: mockProfile,
    items: mockItems,
    isOwner: true,
    hasDriveConnection: false,
    ownerPlaylists: mockOwnerPlaylistsWithSmart,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Switch to Playlists tab to see both sections
    const playlistsTab = canvas.getByRole("tab", { name: "Playlists" });
    await userEvent.click(playlistsTab);
    await expect(playlistsTab).toHaveAttribute("aria-selected", "true");
  },
  parameters: {
    docs: {
      description: {
        story:
          "Owner mode with 2 smart playlists (Continue Watching, Watchlist) and 2 user playlists. Playlists tab shows split sections: Smart Playlists (no context menu) and Playlists (with context menu).",
      },
    },
  },
};

/** Owner mode — keyboard navigation between tabs. */
export const OwnerKeyboardNavigation: Story = {
  args: {
    profile: mockProfile,
    items: mockItems,
    isOwner: true,
    ownerPlaylists: mockOwnerPlaylists,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const itemsTab = canvas.getByRole("tab", { name: "Items" });

    // Focus Items tab and navigate with arrow keys
    await userEvent.click(itemsTab);
    await userEvent.keyboard("{ArrowRight}");

    const playlistsTab = canvas.getByRole("tab", { name: "Playlists" });
    await expect(playlistsTab).toHaveAttribute("aria-selected", "true");

    // Wraps around back to Items
    await userEvent.keyboard("{ArrowRight}");
    await expect(itemsTab).toHaveAttribute("aria-selected", "true");
  },
  parameters: {
    docs: {
      description: {
        story:
          "Arrow keys cycle between Items and Playlists tabs. ArrowRight wraps from last to first.",
      },
    },
  },
};

/** Viewer mode with items and playlists. */
export const ViewerWithItems: Story = {
  args: {
    profile: { ...mockProfile, username: "cinephile", name: "Cinephile" },
    items: mockItems.map((item) => ({
      ...item,
      isPublic: true,
    })),
    isOwner: false,
    publicPlaylists: [
      {
        id: "playlist-1",
        name: "Favourites",
        description: "My favourite films",
        itemCount: 12,
        previewPosters: [
          { tmdbPosterPath: null, artworkId: null },
          { tmdbPosterPath: null, artworkId: null },
          { tmdbPosterPath: null, artworkId: null },
          { tmdbPosterPath: null, artworkId: null },
        ],
        hasArtwork: false,
        updatedAt: new Date(),
      },
    ],
  },
  parameters: {
    docs: {
      description: {
        story:
          "Viewer mode with public items and one public playlist. No tabs — items and playlists render as sections.",
      },
    },
  },
};

/** Viewer mode with empty profile. */
export const ViewerEmpty: Story = {
  args: {
    profile: { ...mockProfile, username: "newuser", name: null },
    items: [],
    isOwner: false,
    publicPlaylists: [],
  },
  parameters: {
    docs: {
      description: {
        story:
          "Viewer mode with no public items or playlists. Shows empty state message.",
      },
    },
  },
};
