/**
 * Storybook stories for the SortableGrid component.
 * Covers grid views, drag-and-drop, and interaction states.
 */
import type { Meta, StoryObj } from "@storybook/nextjs";
import { fn } from "storybook/test";
import { SortableGrid } from "./sortable-grid-component";
import type { ItemWithArtwork } from "@/lib/types";

/**
 * Sortable grid component for flat item reordering.
 *
 * ## Features
 * - Responsive grid layout (2/3/5 columns)
 * - Drag-and-drop reordering with keyboard support
 * - Movie poster card design with artwork thumbnails
 * - Context menu for Settings, Pin, Delete
 * - Selection checkboxes for bulk operations
 *
 * ## Keyboard Navigation
 * - `Arrow keys` - Navigate between items
 * - `Space/Enter` - Select item
 * - `Tab` - Move focus between items
 */
const meta = {
  title: "Layout/SortableGrid",
  component: SortableGrid,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Responsive grid with drag-and-drop reordering via dnd-kit. Movie poster card design with artwork thumbnails and context menu.",
      },
    },
  },
  argTypes: {
    items: {
      description: "Items to display in grid",
    },
    hasDriveConnection: {
      control: "boolean",
      description: "Whether user has Google Drive connected",
    },
  },
  args: {
    onItemsChange: fn(),
    onItemClick: fn(),
    onOpenSettings: fn(),
    onDeleteItem: fn(),
    onPinItem: fn(),
    onUnpinItem: fn(),
    isItemSelected: () => false,
    onItemSelectChange: fn(),
  },
  decorators: [
    (Story) => (
      <div className="p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SortableGrid>;

export default meta;
type Story = StoryObj<typeof meta>;

// Base date for mock data
const baseDate = new Date("2024-01-15T10:00:00Z");

// Helper to create grid items
function createGridItem(
  id: string,
  name: string,
  options: Partial<ItemWithArtwork> = {}
): ItemWithArtwork {
  return {
    id,
    name,
    description: null,
    parentId: null,
    order: 0,
    depth: 0,
    pinnedOrder: null,
    isPublic: false,
    inheritVisibility: false,
    userId: "user-1",
    createdAt: baseDate,
    updatedAt: baseDate,
    driveFileId: null,
    driveModifiedAt: null,
    driveThumbnailUrl: null,
    syncStatus: "SYNCED",
    syncError: null,
    driveConnectionId: null,
    artworkId: null,
    fileCounts: { media: 0, artwork: 0, subtitles: 0 },
    childCount: 0,
    primaryMediaName: null,
    mediaIconType: null,
    progress: null,
    tmdbId: null,
    tmdbType: null,
    tmdbShowTagline: true,
    tmdbShowMetadata: true,
    tmdbShowGenres: true,
    tmdbShowCast: true,
    tmdbShowProviders: true,
    tmdbShowVideos: true,
    tmdbShowRecommendations: true,
    ...options,
  };
}

// Mock movie grid items
const mockMovies: ItemWithArtwork[] = [
  createGridItem("godfather", "The Godfather", {
    order: 0,
    artworkId: "artwork-gf",
    description: "The aging patriarch of an organized crime dynasty...",
    fileCounts: { media: 1, artwork: 2, subtitles: 3 },
    mediaIconType: "film",
    progress: {
      percentage: 100,
      watchedItems: 1,
      itemsWithMedia: 1,
      totalItems: 1,
    },
  }),
  createGridItem("dark-knight", "The Dark Knight", {
    order: 1,
    artworkId: "artwork-dk",
    fileCounts: { media: 1, artwork: 1, subtitles: 1 },
    mediaIconType: "film",
    progress: {
      percentage: 75,
      watchedItems: 0,
      itemsWithMedia: 1,
      totalItems: 1,
    },
  }),
  createGridItem("pulp-fiction", "Pulp Fiction", {
    order: 2,
    artworkId: "artwork-pf",
    fileCounts: { media: 1, artwork: 1, subtitles: 0 },
    mediaIconType: "film",
    progress: {
      percentage: 0,
      watchedItems: 0,
      itemsWithMedia: 1,
      totalItems: 1,
    },
  }),
  createGridItem("inception", "Inception", {
    order: 3,
    artworkId: "artwork-inc",
    pinnedOrder: 0,
    fileCounts: { media: 1, artwork: 1, subtitles: 2 },
    mediaIconType: "film",
  }),
  createGridItem("fight-club", "Fight Club", {
    order: 4,
    artworkId: "artwork-fc",
    fileCounts: { media: 1, artwork: 1, subtitles: 1 },
    mediaIconType: "film",
  }),
  createGridItem("matrix", "The Matrix", {
    order: 5,
    artworkId: "artwork-mx",
    fileCounts: { media: 1, artwork: 1, subtitles: 1 },
    mediaIconType: "film",
  }),
];

// Items without artwork
const noArtworkItems: ItemWithArtwork[] = [
  createGridItem("folder-1", "Action Movies", { order: 0, childCount: 12 }),
  createGridItem("folder-2", "Comedy", { order: 1, childCount: 8 }),
  createGridItem("folder-3", "Drama", { order: 2, childCount: 15 }),
  createGridItem("folder-4", "Sci-Fi", { order: 3, childCount: 6 }),
];

/**
 * Default grid with movie posters.
 * Shows responsive layout with artwork thumbnails.
 */
export const Default: Story = {
  args: {
    items: mockMovies,
  },
};

/**
 * Grid without artwork.
 * Shows placeholder cards for folders/items without images.
 */
export const NoArtwork: Story = {
  args: {
    items: noArtworkItems,
  },
};

/**
 * Single item grid.
 * Edge case with minimal content.
 */
export const SingleItem: Story = {
  args: {
    items: [mockMovies[0]],
  },
};

/**
 * Mixed media types.
 * Shows different media icons for video, audio, mixed.
 */
export const MixedMediaTypes: Story = {
  args: {
    items: [
      createGridItem("video", "Video File", {
        order: 0,
        artworkId: "art-v",
        mediaIconType: "film",
      }),
      createGridItem("audio", "Audio Album", {
        order: 1,
        artworkId: "art-a",
        mediaIconType: "music",
      }),
      createGridItem("mixed", "Mixed Folder", {
        order: 2,
        artworkId: "art-m",
        mediaIconType: "mixed",
      }),
    ],
  },
};

// Pinned items for homepage demo (matching PinnedItemsSection TMDB data)
const pinnedMovies: ItemWithArtwork[] = [
  createGridItem("godfather", "The Godfather", {
    order: 0,
    artworkId: "artwork-gf",
    pinnedOrder: 0,
    fileCounts: { media: 1, artwork: 2, subtitles: 3 },
    mediaIconType: "film",
  }),
  createGridItem("dark-knight", "The Dark Knight", {
    order: 1,
    artworkId: "artwork-dk",
    pinnedOrder: 1,
    fileCounts: { media: 1, artwork: 1, subtitles: 1 },
    mediaIconType: "film",
  }),
  createGridItem("inception", "Inception", {
    order: 2,
    artworkId: "artwork-inc",
    pinnedOrder: 2,
    fileCounts: { media: 1, artwork: 1, subtitles: 2 },
    mediaIconType: "film",
  }),
];

// Library items (unpinned - different from pinned movies)
const libraryMovies: ItemWithArtwork[] = [
  createGridItem("pulp-fiction", "Pulp Fiction", {
    order: 0,
    artworkId: "artwork-pf",
    fileCounts: { media: 1, artwork: 1, subtitles: 0 },
    mediaIconType: "film",
  }),
  createGridItem("matrix", "The Matrix", {
    order: 1,
    artworkId: "artwork-mx",
    fileCounts: { media: 1, artwork: 1, subtitles: 1 },
    mediaIconType: "film",
  }),
  createGridItem("fight-club", "Fight Club", {
    order: 2,
    artworkId: "artwork-fc",
    fileCounts: { media: 1, artwork: 1, subtitles: 1 },
    mediaIconType: "film",
  }),
  createGridItem("forrest-gump", "Forrest Gump", {
    order: 3,
    artworkId: "artwork-fg",
    fileCounts: { media: 1, artwork: 1, subtitles: 2 },
    mediaIconType: "film",
  }),
];

/**
 * Homepage layout with Pinned and Library sections.
 * Shows how items are organized on the profile page.
 */
export const Homepage: Story = {
  args: {
    items: libraryMovies,
  },
  render: (args) => (
    <div className="flex flex-col gap-6 p-4">
      {/* Pinned Section */}
      <section aria-label="Pinned items">
        <h2 className="text-muted-foreground mb-3 flex items-center gap-2 text-xs font-medium tracking-wider uppercase">
          <svg
            className="size-3.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
            />
          </svg>
          <span>Pinned</span>
        </h2>
        <SortableGrid
          items={pinnedMovies}
          onItemsChange={args.onItemsChange}
          onItemClick={args.onItemClick}
          onOpenSettings={args.onOpenSettings}
          onDeleteItem={args.onDeleteItem}
          onPinItem={args.onPinItem}
          onUnpinItem={args.onUnpinItem}
          isItemSelected={args.isItemSelected}
          onItemSelectChange={args.onItemSelectChange}
        />
      </section>

      {/* Library Section */}
      <section aria-label="Library">
        <h2 className="text-muted-foreground mb-3 flex items-center gap-2 text-xs font-medium tracking-wider uppercase">
          <svg
            className="size-3.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            />
          </svg>
          <span>Library</span>
        </h2>
        <SortableGrid {...args} />
      </section>
    </div>
  ),
};
