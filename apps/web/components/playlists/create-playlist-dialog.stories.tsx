/**
 * Stories for CreatePlaylistDialog component.
 * Simple dialog with name input, loading state, and validation.
 */

import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs";
import { fn, userEvent, within, expect, waitFor } from "storybook/test";

import { Button } from "@/components/ui/button";
import { CreatePlaylistDialog } from "./create-playlist-dialog";

/**
 * Wrapper component that provides a trigger button for the dialog.
 */
function DialogWithTrigger(
  props: Omit<
    React.ComponentProps<typeof CreatePlaylistDialog>,
    "open" | "onOpenChange"
  > & {
    buttonLabel?: string;
  }
) {
  const [open, setOpen] = useState(false);
  const { buttonLabel = "Create Playlist", ...dialogProps } = props;

  return (
    <>
      <Button onClick={() => setOpen(true)}>{buttonLabel}</Button>
      <CreatePlaylistDialog
        {...dialogProps}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}

const meta = {
  title: "Playlists/Dialogs/CreatePlaylistDialog",
  component: DialogWithTrigger,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: `
Dialog for creating a new playlist.

## Features

- **Name Input** — Required, validates on submit
- **Loading State** — Shows spinner while creating
- **Inline Validation** — "Name is required" error shown when empty
- **Reset on Close** — Form resets when dialog closes
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

/** Default — click button to open dialog. */
export const Default: Story = {
  args: {
    onCreated: fn(),
    buttonLabel: "Create Playlist",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button");
    await userEvent.click(trigger);
    const body = within(document.body);
    await body.findByLabelText(/name/i);
  },
  parameters: {
    docs: {
      description: {
        story: "Default dialog. Click the button to open.",
      },
    },
  },
};

/** Form interaction — type a name and verify submit button enables. */
export const FormInteraction: Story = {
  args: {
    onCreated: fn(),
    buttonLabel: "Create Playlist",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button");
    await userEvent.click(trigger);
    const body = within(document.body);
    const input = await body.findByTestId("create-playlist-name-input");
    const submitButton = body.getByTestId("create-playlist-submit");
    await expect(submitButton).toBeDisabled();
    await userEvent.type(input, "My New Playlist");
    await waitFor(() => expect(submitButton).toBeEnabled());
  },
  parameters: {
    docs: {
      description: {
        story: "Submit button is disabled until a name is entered.",
      },
    },
  },
};
