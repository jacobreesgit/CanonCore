/**
 * Stories for PlaylistContextMenu and PlaylistItemContextMenu components.
 * Right-click context menus with glassmorphism styling and delete confirmation.
 */

import type { Meta, StoryObj } from "@storybook/nextjs";
import { fn, userEvent, within, expect } from "storybook/test";

import {
  PlaylistContextMenu,
  PlaylistItemContextMenu,
} from "./playlist-context-menu";

// === PlaylistContextMenu (card-level) ===

const cardMeta = {
  title: "Playlists/Menus/PlaylistContextMenu",
  component: PlaylistContextMenu,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Context menu for playlist card actions. Right-click to open a glassmorphism menu with rename, visibility toggle, and delete options. Delete shows a confirmation dialog.",
      },
    },
  },
  args: {
    children: null,
    playlistName: "Favourites",
    isPublic: true,
    onRename: fn(),
    onToggleVisibility: fn(async () => {}),
    onDelete: fn(async () => {}),
  },
} satisfies Meta<typeof PlaylistContextMenu>;

export default cardMeta;
type CardStory = StoryObj<typeof cardMeta>;

/** Default — right-click the card to open. Shows rename, make private, and delete. */
export const Default: CardStory = {
  render: (args) => (
    <PlaylistContextMenu {...args}>
      <div className="text-muted-foreground flex h-48 w-64 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-sm">
        Right-click me
      </div>
    </PlaylistContextMenu>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const target = canvas.getByText("Right-click me");
    await userEvent.pointer({ keys: "[MouseRight]", target });
    const body = within(document.body);
    await expect(await body.findByText("Rename")).toBeInTheDocument();
    await expect(await body.findByText("Make Private")).toBeInTheDocument();
    await expect(await body.findByText("Delete")).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          "Public playlist context menu showing rename, make private, and delete options.",
      },
    },
  },
};

/** Private playlist — shows "Make Public" instead of "Make Private". */
export const PrivatePlaylist: CardStory = {
  args: {
    playlistName: "Watch Later",
    isPublic: false,
  },
  render: (args) => (
    <PlaylistContextMenu {...args}>
      <div className="text-muted-foreground flex h-48 w-64 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-sm">
        Right-click me
      </div>
    </PlaylistContextMenu>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const target = canvas.getByText("Right-click me");
    await userEvent.pointer({ keys: "[MouseRight]", target });
    const body = within(document.body);
    await expect(await body.findByText("Make Public")).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story: 'Private playlist shows "Make Public" toggle.',
      },
    },
  },
};

/** Minimal menu — only delete action, no rename or visibility. */
export const DeleteOnly: CardStory = {
  args: {
    playlistName: "Temporary",
    isPublic: true,
    onRename: undefined,
    onToggleVisibility: undefined,
    onDelete: fn(async () => {}),
  },
  render: (args) => (
    <PlaylistContextMenu {...args}>
      <div className="text-muted-foreground flex h-48 w-64 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-sm">
        Right-click me
      </div>
    </PlaylistContextMenu>
  ),
  parameters: {
    docs: {
      description: {
        story: "Minimal context menu with only the delete option.",
      },
    },
  },
};

// === PlaylistItemContextMenu ===

export const ItemInPlaylist: StoryObj<typeof PlaylistItemContextMenu> = {
  render: () => (
    <PlaylistItemContextMenu
      itemName="Inception"
      itemHref="/u/filmfan/item-1"
      onRemove={fn(async () => {})}
    >
      <div className="text-muted-foreground flex h-48 w-64 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-sm">
        Right-click me
      </div>
    </PlaylistItemContextMenu>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const target = canvas.getByText("Right-click me");
    await userEvent.pointer({ keys: "[MouseRight]", target });
    const body = within(document.body);
    await expect(await body.findByText("Go to Item")).toBeInTheDocument();
    await expect(await body.findByText("Open in New Tab")).toBeInTheDocument();
    await expect(
      await body.findByText("Remove from Playlist")
    ).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          "Context menu for an item within a playlist. Shows go to item, open in new tab, and remove options.",
      },
    },
  },
};

/** Viewer mode — no remove action available. */
export const ItemInPlaylistViewerMode: StoryObj<
  typeof PlaylistItemContextMenu
> = {
  render: () => (
    <PlaylistItemContextMenu itemName="Inception" itemHref="/u/filmfan/item-1">
      <div className="text-muted-foreground flex h-48 w-64 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-sm">
        Right-click me
      </div>
    </PlaylistItemContextMenu>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const target = canvas.getByText("Right-click me");
    await userEvent.pointer({ keys: "[MouseRight]", target });
    const body = within(document.body);
    await expect(await body.findByText("Go to Item")).toBeInTheDocument();
    await expect(await body.findByText("Open in New Tab")).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story: "Viewer mode — no remove option, only navigation actions.",
      },
    },
  },
};
