/**
 * Stories for EditPlaylistDialog component.
 * Dialog for editing playlist name, description, and visibility.
 */

import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs";
import { fn, userEvent, within, expect, waitFor } from "storybook/test";

import { Button } from "@/components/ui/button";
import { EditPlaylistDialog } from "./edit-playlist-dialog";

/**
 * Wrapper component that provides a trigger button for the dialog.
 */
function DialogWithTrigger(
  props: Omit<
    React.ComponentProps<typeof EditPlaylistDialog>,
    "open" | "onOpenChange"
  > & {
    buttonLabel?: string;
  }
) {
  const [open, setOpen] = useState(false);
  const { buttonLabel = "Edit Playlist", ...dialogProps } = props;

  return (
    <>
      <Button onClick={() => setOpen(true)}>{buttonLabel}</Button>
      <EditPlaylistDialog {...dialogProps} open={open} onOpenChange={setOpen} />
    </>
  );
}

const meta = {
  title: "Playlists/Dialogs/EditPlaylistDialog",
  component: DialogWithTrigger,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: `
Dialog for editing an existing playlist.

## Features

- **Name Input** — Required, pre-filled with current name
- **Description** — Optional textarea for playlist description
- **Visibility Toggle** — Public/private switch
- **Loading State** — Shows spinner while saving
- **Validation** — "Name is required" error when empty
        `,
      },
    },
  },
  argTypes: {
    buttonLabel: {
      control: "text",
      description: "Label for the trigger button",
    },
  },
} satisfies Meta<typeof DialogWithTrigger>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default — click button to open dialog with pre-filled data. */
export const Default: Story = {
  args: {
    playlist: {
      id: "playlist-1",
      name: "Favourites",
      description: "My favourite films of all time.",
      isPublic: true,
      hasArtwork: false,
      shareToken: null,
    },
    username: "filmfan",
    onUpdated: fn(),
    buttonLabel: "Edit Playlist",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button");
    await userEvent.click(trigger);
    const body = within(document.body);
    const nameInput = await body.findByTestId("edit-playlist-name-input");
    await expect(nameInput).toHaveValue("Favourites");
  },
  parameters: {
    docs: {
      description: {
        story: "Default dialog with pre-filled name and description.",
      },
    },
  },
};

/** Private playlist with no description. */
export const PrivateNoDescription: Story = {
  args: {
    playlist: {
      id: "playlist-2",
      name: "Watch Later",
      description: null,
      isPublic: false,
      hasArtwork: false,
      shareToken: null,
    },
    username: "filmfan",
    onUpdated: fn(),
    buttonLabel: "Edit Private Playlist",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button");
    await userEvent.click(trigger);
    const body = within(document.body);
    await body.findByTestId("edit-playlist-name-input");
  },
  parameters: {
    docs: {
      description: {
        story:
          "Private playlist with no description. Visibility switch is off.",
      },
    },
  },
};

/** Form interaction — clear name shows disabled submit. */
export const FormValidation: Story = {
  args: {
    playlist: {
      id: "playlist-1",
      name: "Favourites",
      description: null,
      isPublic: true,
      hasArtwork: false,
      shareToken: null,
    },
    username: "filmfan",
    onUpdated: fn(),
    buttonLabel: "Test Validation",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button");
    await userEvent.click(trigger);
    const body = within(document.body);
    const nameInput = await body.findByTestId("edit-playlist-name-input");
    const submitButton = body.getByTestId("edit-playlist-submit");
    await expect(submitButton).toBeEnabled();
    await userEvent.clear(nameInput);
    await waitFor(() => expect(submitButton).toBeDisabled());
  },
  parameters: {
    docs: {
      description: {
        story: "Clearing the name disables the Save button.",
      },
    },
  },
};

/** Long description approaching the character limit. */
export const LongDescription: Story = {
  args: {
    playlist: {
      id: "playlist-3",
      name: "Cinematic Masterpieces",
      description:
        "A curated collection of the finest films ever made, spanning genres from noir to new wave, featuring directors like Kubrick, Kurosawa, Bergman, and Tarkovsky. Each film represents a pinnacle of the art form and deserves repeated viewings to fully appreciate the craft involved.",
      isPublic: true,
      hasArtwork: false,
      shareToken: null,
    },
    username: "filmfan",
    onUpdated: fn(),
    buttonLabel: "Edit (Long Description)",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button");
    await userEvent.click(trigger);
    const body = within(document.body);
    await body.findByTestId("edit-playlist-name-input");
  },
  parameters: {
    docs: {
      description: {
        story: "Playlist with a long description near the character limit.",
      },
    },
  },
};

/** Playlist with existing artwork — shows artwork preview and remove option. */
export const WithArtwork: Story = {
  args: {
    playlist: {
      id: "playlist-4",
      name: "Film Noir Classics",
      description: "The best of the genre.",
      isPublic: true,
      hasArtwork: true,
      shareToken: null,
    },
    username: "filmfan",
    onUpdated: fn(),
    buttonLabel: "Edit (With Artwork)",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button");
    await userEvent.click(trigger);
    const body = within(document.body);
    await body.findByTestId("edit-playlist-name-input");
  },
  parameters: {
    docs: {
      description: {
        story:
          "Playlist with existing uploaded artwork. Shows artwork preview and remove button in the artwork section.",
      },
    },
  },
};

/** Playlist with shareable link active — shows share URL and copy/regenerate buttons. */
export const WithShareLink: Story = {
  args: {
    playlist: {
      id: "playlist-5",
      name: "Shared Collection",
      description: "A collection shared via link.",
      isPublic: false,
      hasArtwork: false,
      shareToken: "abc123def456ghi789jkl",
    },
    username: "filmfan",
    onUpdated: fn(),
    buttonLabel: "Edit (With Share Link)",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button");
    await userEvent.click(trigger);
    const body = within(document.body);
    await body.findByTestId("edit-playlist-name-input");
  },
  parameters: {
    docs: {
      description: {
        story:
          "Private playlist with an active share link. Shows the shareable URL with copy and regenerate buttons.",
      },
    },
  },
};
