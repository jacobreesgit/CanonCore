/**
 * Stories for AddToPlaylistDialog component.
 * Dialog for managing an item's playlist memberships with checkboxes.
 */

import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs";
import { userEvent, within } from "storybook/test";

import { Button } from "@/components/ui/button";
import { AddToPlaylistDialog } from "./add-to-playlist-dialog";

/**
 * Wrapper component that provides a trigger button for the dialog.
 */
function DialogWithTrigger(
  props: Omit<
    React.ComponentProps<typeof AddToPlaylistDialog>,
    "open" | "onOpenChange"
  > & {
    buttonLabel?: string;
  }
) {
  const [open, setOpen] = useState(false);
  const { buttonLabel = "Add to Playlist", ...dialogProps } = props;

  return (
    <>
      <Button onClick={() => setOpen(true)}>{buttonLabel}</Button>
      <AddToPlaylistDialog
        {...dialogProps}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}

const meta = {
  title: "Playlists/Dialogs/AddToPlaylistDialog",
  component: DialogWithTrigger,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: `
Dialog for adding an item to playlists.

## Features

- **Searchable List** — Filter playlists by name
- **Checkbox Membership** — Toggle item membership with optimistic updates
- **Inline Creation** — Create a new playlist without leaving the dialog
- **Loading State** — Shows spinner while fetching playlists
- **Empty State** — Prompt to create first playlist when none exist
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

/** Default — opens with a list of playlists and their membership checkboxes. */
export const Default: Story = {
  args: {
    itemId: "item-123",
    buttonLabel: "Add to Playlist",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button");
    await userEvent.click(trigger);
    const body = within(document.body);
    await body.findByTestId("playlist-list");
  },
  parameters: {
    docs: {
      description: {
        story:
          "Default state. Opens dialog and loads playlists from mock data. The mock returns 3 playlists: Favourites (member), Watch Later (not member), Best of 2024 (not member).",
      },
    },
  },
};
