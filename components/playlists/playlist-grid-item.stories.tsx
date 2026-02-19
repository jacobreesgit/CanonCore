/**
 * Stories for PlaylistGridItem component.
 * Poster layout adapts to count: 1=full-bleed, 2=side-by-side, 3=1-top+2-bottom, 4=2×2 grid.
 */

import type { Meta, StoryObj } from "@storybook/nextjs";

import { PlaylistGridItem } from "./playlist-grid-item";

const meta = {
  title: "Playlists/PlaylistGridItem",
  component: PlaylistGridItem,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Playlist card using the shared CardShell visual system. Renders a 2×2 poster collage from TMDB thumbnails, with hover overlay showing description and item count. Links to the playlist detail page.",
      },
    },
  },
  argTypes: {
    priority: {
      control: "boolean",
      description: "Whether to prioritise image loading (above-the-fold)",
    },
  },
  args: {
    username: "filmfan",
    priority: false,
  },
  decorators: [
    (Story) => (
      <div className="w-[180px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PlaylistGridItem>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 4 posters: 2×2 grid. */
export const FourPosters: Story = {
  args: {
    playlist: {
      id: "playlist-1",
      name: "Favourites",
      itemCount: 12,
      previewPosters: [
        { tmdbPosterPath: "/abc123.jpg", artworkId: null },
        { tmdbPosterPath: "/def456.jpg", artworkId: null },
        { tmdbPosterPath: "/ghi789.jpg", artworkId: null },
        { tmdbPosterPath: "/jkl012.jpg", artworkId: null },
      ],
    },
  },
};

/** 3 posters: 1 spanning top row + 2 on bottom. */
export const ThreePosters: Story = {
  args: {
    playlist: {
      id: "playlist-3",
      name: "Best of 2024",
      itemCount: 3,
      previewPosters: [
        { tmdbPosterPath: "/abc123.jpg", artworkId: null },
        { tmdbPosterPath: "/def456.jpg", artworkId: null },
        { tmdbPosterPath: null, artworkId: "art-1" },
      ],
    },
  },
};

/** 2 posters: side by side. */
export const TwoPosters: Story = {
  args: {
    playlist: {
      id: "playlist-2b",
      name: "Double Feature",
      itemCount: 2,
      previewPosters: [
        { tmdbPosterPath: "/abc123.jpg", artworkId: null },
        { tmdbPosterPath: "/def456.jpg", artworkId: null },
      ],
    },
  },
};

/** 1 poster: single full-bleed image. */
export const OnePoster: Story = {
  args: {
    playlist: {
      id: "playlist-2",
      name: "Watch Later",
      itemCount: 1,
      previewPosters: [{ tmdbPosterPath: "/abc123.jpg", artworkId: null }],
    },
  },
};

/** Card with no posters — shows ListMusic icon fallback. */
export const NoPosters: Story = {
  args: {
    playlist: {
      id: "playlist-4",
      name: "Empty Playlist",
      itemCount: 0,
      previewPosters: [],
    },
  },
};

/** Card with a long playlist name that truncates. */
export const LongName: Story = {
  args: {
    playlist: {
      id: "playlist-5",
      name: "My Very Long Playlist Name That Should Truncate Gracefully",
      itemCount: 42,
      previewPosters: [
        { tmdbPosterPath: "/abc123.jpg", artworkId: null },
        { tmdbPosterPath: "/def456.jpg", artworkId: null },
        { tmdbPosterPath: "/ghi789.jpg", artworkId: null },
        { tmdbPosterPath: "/jkl012.jpg", artworkId: null },
      ],
    },
  },
};

/** Singular item count label — "1 item" (also demonstrates single full-bleed poster). */
export const SingleItem: Story = {
  args: {
    playlist: {
      id: "playlist-6",
      name: "Solo",
      itemCount: 1,
      previewPosters: [{ tmdbPosterPath: "/abc123.jpg", artworkId: null }],
    },
  },
};

/** Owner mode — public playlist shows Eye icon. */
export const OwnerPublic: Story = {
  args: {
    playlist: {
      id: "playlist-7",
      name: "Public Playlist",
      itemCount: 5,
      previewPosters: [
        { tmdbPosterPath: "/abc123.jpg", artworkId: null },
        { tmdbPosterPath: "/def456.jpg", artworkId: null },
        { tmdbPosterPath: "/ghi789.jpg", artworkId: null },
        { tmdbPosterPath: "/jkl012.jpg", artworkId: null },
      ],
      isPublic: true,
    },
    isOwner: true,
  },
};

/** Owner mode — private playlist shows Lock icon. */
export const OwnerPrivate: Story = {
  args: {
    playlist: {
      id: "playlist-8",
      name: "Private Playlist",
      itemCount: 3,
      previewPosters: [{ tmdbPosterPath: "/abc123.jpg", artworkId: null }],
      isPublic: false,
    },
    isOwner: true,
  },
};

/** Card with custom uploaded artwork — shows full-bleed image. */
export const CustomArtwork: Story = {
  args: {
    playlist: {
      id: "playlist-9",
      name: "Custom Cover",
      itemCount: 10,
      previewPosters: [],
      hasArtwork: true,
    },
  },
};

/** Card with description visible in hover overlay. */
export const WithDescription: Story = {
  args: {
    playlist: {
      id: "playlist-10",
      name: "Cinematic Gems",
      description:
        "A curated selection of must-watch films from around the world.",
      itemCount: 15,
      previewPosters: [
        { tmdbPosterPath: "/abc123.jpg", artworkId: null },
        { tmdbPosterPath: "/def456.jpg", artworkId: null },
        { tmdbPosterPath: "/ghi789.jpg", artworkId: null },
        { tmdbPosterPath: "/jkl012.jpg", artworkId: null },
      ],
    },
  },
};
