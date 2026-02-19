/**
 * Stories for PlaylistCard component.
 * Card with 2x2 artwork collage, name, and item count.
 */

import type { Meta, StoryObj } from "@storybook/nextjs";

import { PlaylistCard } from "./playlist-card";

const meta = {
  title: "Playlists/PlaylistCard",
  component: PlaylistCard,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Playlist card with 2x2 artwork collage, name, and item count. Links to the playlist detail page. Shows a placeholder icon when no artwork is available.",
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
      <div className="w-[200px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PlaylistCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default card with 4 artwork thumbnails in a 2x2 grid. */
export const Default: Story = {
  args: {
    playlist: {
      id: "playlist-1",
      name: "Favourites",
      itemCount: 12,
      previewArtworkIds: ["art-1", "art-2", "art-3", "art-4"],
    },
  },
  parameters: {
    docs: {
      description: {
        story: "Full 2x2 collage with all four artwork slots filled.",
      },
    },
  },
};

/** Card with a single artwork (full-bleed image). */
export const SingleArtwork: Story = {
  args: {
    playlist: {
      id: "playlist-2",
      name: "Watch Later",
      itemCount: 1,
      previewArtworkIds: ["art-1"],
    },
  },
  parameters: {
    docs: {
      description: {
        story: "Single artwork fills the entire card area.",
      },
    },
  },
};

/** Card with partial artworks (2 of 4 slots filled). */
export const PartialArtworks: Story = {
  args: {
    playlist: {
      id: "playlist-3",
      name: "Best of 2024",
      itemCount: 2,
      previewArtworkIds: ["art-1", "art-2", null, null],
    },
  },
  parameters: {
    docs: {
      description: {
        story: "2x2 grid with placeholder slots for missing artwork.",
      },
    },
  },
};

/** Card with no artwork (shows ListMusic icon). */
export const NoArtwork: Story = {
  args: {
    playlist: {
      id: "playlist-4",
      name: "Empty Playlist",
      itemCount: 0,
      previewArtworkIds: [],
    },
  },
  parameters: {
    docs: {
      description: {
        story: "Empty playlist with no artwork shows a music icon placeholder.",
      },
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
      previewArtworkIds: ["art-1", "art-2", "art-3", "art-4"],
    },
  },
  parameters: {
    docs: {
      description: {
        story: "Long playlist name is clamped to a single line.",
      },
    },
  },
};

/** Singular item count label. */
export const SingleItem: Story = {
  args: {
    playlist: {
      id: "playlist-6",
      name: "Solo",
      itemCount: 1,
      previewArtworkIds: ["art-1"],
    },
  },
  parameters: {
    docs: {
      description: {
        story: 'Shows "1 item" (singular) instead of "items".',
      },
    },
  },
};

/** Owner mode with visibility badge — public playlist shows Eye icon. */
export const OwnerPublic: Story = {
  args: {
    playlist: {
      id: "playlist-7",
      name: "Public Playlist",
      itemCount: 5,
      previewArtworkIds: ["art-1", "art-2", "art-3", "art-4"],
      isPublic: true,
    },
    isOwner: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Owner mode shows a visibility badge. Public playlists show an Eye icon.",
      },
    },
  },
};

/** Owner mode with visibility badge — private playlist shows Lock icon. */
export const OwnerPrivate: Story = {
  args: {
    playlist: {
      id: "playlist-8",
      name: "Private Playlist",
      itemCount: 3,
      previewArtworkIds: ["art-1", null, null, null],
      isPublic: false,
    },
    isOwner: true,
  },
  parameters: {
    docs: {
      description: {
        story: "Private playlist shows a Lock icon badge in owner mode.",
      },
    },
  },
};

/** Card with custom artwork (hasArtwork shows uploaded image instead of collage). */
export const CustomArtwork: Story = {
  args: {
    playlist: {
      id: "playlist-9",
      name: "Custom Cover",
      itemCount: 10,
      previewArtworkIds: [],
      hasArtwork: true,
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          "Playlist with custom uploaded artwork. Shows full-bleed image from the artwork API.",
      },
    },
  },
};

/** Card with description shown on hover overlay. */
export const WithDescription: Story = {
  args: {
    playlist: {
      id: "playlist-10",
      name: "Cinematic Gems",
      description:
        "A curated selection of must-watch films from around the world.",
      itemCount: 15,
      previewArtworkIds: ["art-1", "art-2", "art-3", "art-4"],
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          "Hover over the card to see the description overlay with glassmorphism effect.",
      },
    },
  },
};
