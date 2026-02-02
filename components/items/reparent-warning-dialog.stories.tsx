/**
 * Storybook stories for the ReparentWarningDialog component.
 * Demonstrates visibility change warnings when moving items between parents.
 */
import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs";
import { fn, userEvent, within } from "storybook/test";

import { Button } from "@/components/ui/button";
import { ReparentWarningDialog } from "./reparent-warning-dialog";

/**
 * Wrapper component that provides a trigger button for the dialog.
 */
function DialogWithTrigger(
  props: Omit<
    React.ComponentProps<typeof ReparentWarningDialog>,
    "open" | "onOpenChange"
  > & {
    buttonLabel?: string;
  }
) {
  const [open, setOpen] = useState(false);
  const { buttonLabel = "Move Item", ...dialogProps } = props;

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        data-testid="dialog-trigger"
      >
        {buttonLabel}
      </Button>
      <ReparentWarningDialog
        {...dialogProps}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}

const meta = {
  title: "Items/Dialogs/ReparentWarningDialog",
  component: DialogWithTrigger,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Warning dialog shown when moving an inheriting item to a new parent, alerting users to visibility changes.",
      },
    },
  },
  argTypes: {
    itemName: { control: "text" },
    oldParentName: { control: "text" },
    newParentName: { control: "text" },
    willBecomePublic: { control: "boolean" },
    willBecomePrivate: { control: "boolean" },
    isLoading: { control: "boolean" },
    buttonLabel: { control: "text" },
  },
  args: {
    onConfirm: fn(),
  },
} satisfies Meta<typeof DialogWithTrigger>;

export default meta;
type Story = StoryObj<typeof meta>;

// === STANDARD VARIANTS ===

export const Default: Story = {
  args: {
    itemName: "Episode 1: Pilot",
    oldParentName: "Season 1",
    newParentName: "Season 2",
    willBecomePublic: false,
    willBecomePrivate: false,
    isLoading: false,
    buttonLabel: "Move Episode",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByTestId("dialog-trigger");
    await userEvent.click(trigger);
    await canvas.findByRole("alertdialog");
  },
};

export const WillBecomePublic: Story = {
  args: {
    itemName: "Breaking Bad",
    oldParentName: "Private Collection",
    newParentName: "Public TV Shows",
    willBecomePublic: true,
    willBecomePrivate: false,
    isLoading: false,
    buttonLabel: "Move to Public",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByTestId("dialog-trigger");
    await userEvent.click(trigger);
    await canvas.findByRole("alertdialog");
  },
  parameters: {
    docs: {
      description: {
        story:
          "Warning when moving an item to a public parent, making it visible to others.",
      },
    },
  },
};

export const WillBecomePrivate: Story = {
  args: {
    itemName: "The Office",
    oldParentName: "Shared Collection",
    newParentName: "Private Archive",
    willBecomePublic: false,
    willBecomePrivate: true,
    isLoading: false,
    buttonLabel: "Move to Private",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByTestId("dialog-trigger");
    await userEvent.click(trigger);
    await canvas.findByRole("alertdialog");
  },
  parameters: {
    docs: {
      description: {
        story:
          "Warning when moving an item to a private parent, hiding it from others.",
      },
    },
  },
};

export const MovingFromRoot: Story = {
  args: {
    itemName: "Inception",
    oldParentName: null,
    newParentName: "Movies Collection",
    willBecomePublic: false,
    willBecomePrivate: false,
    isLoading: false,
    buttonLabel: "Move from Root",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByTestId("dialog-trigger");
    await userEvent.click(trigger);
    await canvas.findByRole("alertdialog");
  },
  parameters: {
    docs: {
      description: {
        story: "Moving an item from root level to a folder.",
      },
    },
  },
};

export const MovingToRoot: Story = {
  args: {
    itemName: "Interstellar",
    oldParentName: "Sci-Fi Collection",
    newParentName: null,
    willBecomePublic: false,
    willBecomePrivate: false,
    isLoading: false,
    buttonLabel: "Move to Root",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByTestId("dialog-trigger");
    await userEvent.click(trigger);
    await canvas.findByRole("alertdialog");
  },
  parameters: {
    docs: {
      description: {
        story: "Moving an item from a folder to root level.",
      },
    },
  },
};

export const Loading: Story = {
  args: {
    itemName: "Episode 1: Pilot",
    oldParentName: "Season 1",
    newParentName: "Season 2",
    willBecomePublic: false,
    willBecomePrivate: false,
    isLoading: true,
    buttonLabel: "Test Loading",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByTestId("dialog-trigger");
    await userEvent.click(trigger);
    await canvas.findByRole("alertdialog");
  },
  parameters: {
    docs: {
      description: {
        story: "Shows loading state while the move operation is in progress.",
      },
    },
  },
};
