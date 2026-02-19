/**
 * Stories for PlaylistSection component.
 * Grid of PlaylistCards for owner and viewer modes on profile pages.
 */

import type { Meta, StoryObj } from "@storybook/nextjs";

import { PlaylistSection } from "./playlist-section";
import type { PublicPlaylistCard } from "@/lib/types";

// Mock viewer playlists
const mockPlaylists: PublicPlaylistCard[] = [
  {
    id: "playlist-1",
    name: "Favourites",
    description: "My favourite films of all time",
    itemCount: 12,
    previewPosters: [
      { tmdbPosterPath: "/poster1.jpg", artworkId: null },
      { tmdbPosterPath: "/poster2.jpg", artworkId: null },
      { tmdbPosterPath: "/poster3.jpg", artworkId: null },
      { tmdbPosterPath: "/poster4.jpg", artworkId: null },
    ],
    hasArtwork: false,
    updatedAt: new Date(),
  },
  {
    id: "playlist-2",
    name: "Watch Later",
    description: null,
    itemCount: 5,
    previewPosters: [
      { tmdbPosterPath: "/poster5.jpg", artworkId: null },
      { tmdbPosterPath: null, artworkId: null },
      { tmdbPosterPath: null, artworkId: null },
      { tmdbPosterPath: null, artworkId: null },
    ],
    hasArtwork: false,
    updatedAt: new Date(),
  },
  {
    id: "playlist-3",
    name: "Best of 2024",
    description: "Top picks from 2024",
    itemCount: 8,
    previewPosters: [
      { tmdbPosterPath: "/poster6.jpg", artworkId: null },
      { tmdbPosterPath: "/poster7.jpg", artworkId: null },
      { tmdbPosterPath: "/poster8.jpg", artworkId: null },
      { tmdbPosterPath: "/poster9.jpg", artworkId: null },
    ],
    hasArtwork: false,
    updatedAt: new Date(),
  },
  {
    id: "playlist-4",
    name: "Documentary Collection",
    description: "Essential documentaries",
    itemCount: 3,
    previewPosters: [
      { tmdbPosterPath: "/poster10.jpg", artworkId: null },
      { tmdbPosterPath: "/poster11.jpg", artworkId: null },
      { tmdbPosterPath: null, artworkId: null },
      { tmdbPosterPath: null, artworkId: null },
    ],
    hasArtwork: false,
    updatedAt: new Date(),
  },
];

/**
 * Wrapper to flatten the discriminated union into simple props for Storybook args.
 */
function PlaylistSectionStory({
  mode,
  username,
  playlists,
}: {
  mode: "owner" | "viewer";
  username: string;
  playlists?: PublicPlaylistCard[];
}) {
  if (mode === "viewer") {
    return (
      <PlaylistSection
        mode="viewer"
        username={username}
        playlists={playlists ?? []}
      />
    );
  }
  return <PlaylistSection mode="owner" username={username} />;
}

const meta = {
  title: "Playlists/PlaylistSection",
  component: PlaylistSectionStory,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component: `
Grid of playlist cards for profile pages.

## Modes

- **Owner mode** — Fetches playlists client-side via \`getUserPlaylists\`. Shows empty state with create action when no playlists exist.
- **Viewer mode** — Receives playlists as props. Hidden when empty.

## Features

- Responsive grid: 2 columns mobile, 3 tablet, 4 desktop
- Stagger grid animation on load
- Each card shows 2x2 artwork collage and item count
        `,
      },
    },
  },
  argTypes: {
    mode: {
      control: "select",
      options: ["owner", "viewer"],
      description: 'Display mode: "owner" or "viewer"',
    },
  },
  args: {
    username: "filmfan",
  },
  decorators: [
    (Story) => (
      <div className="bg-background p-8">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PlaylistSectionStory>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Viewer mode with multiple playlists. */
export const ViewerMode: Story = {
  args: {
    mode: "viewer",
    username: "filmfan",
    playlists: mockPlaylists,
  },
  parameters: {
    docs: {
      description: {
        story: "Viewer mode with 4 public playlists in a responsive grid.",
      },
    },
  },
};

/** Viewer mode with no playlists (renders nothing). */
export const ViewerEmpty: Story = {
  args: {
    mode: "viewer",
    username: "filmfan",
    playlists: [],
  },
  parameters: {
    docs: {
      description: {
        story: "Viewer mode with no playlists. Section is hidden entirely.",
      },
    },
  },
};

/** Viewer mode with a single playlist. */
export const ViewerSingle: Story = {
  args: {
    mode: "viewer",
    username: "filmfan",
    playlists: [mockPlaylists[0]],
  },
  parameters: {
    docs: {
      description: {
        story: "Viewer mode with a single public playlist.",
      },
    },
  },
};

/**
 * Owner mode — fetches playlists from mock getUserPlaylists.
 * The mock returns 2 playlists (Favourites and Watch Later).
 */
export const OwnerMode: Story = {
  args: {
    mode: "owner",
    username: "mockuser",
  },
  parameters: {
    docs: {
      description: {
        story:
          "Owner mode fetches playlists client-side. Mock returns 2 playlists with artwork.",
      },
    },
  },
};
