/**
 * Storybook stories for the ForkDestinationDialog component.
 * Demonstrates folder selection with virtualization for large item lists.
 */
import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs";
import { fn, userEvent, within } from "storybook/test";

import { Button } from "@/components/ui/button";
import { ForkDestinationDialog } from "./fork-destination-dialog";
import { getAllItems } from "@/lib/item-actions";

/**
 * Wrapper component that provides a trigger button for the dialog.
 */
function DialogWithTrigger(
  props: Omit<
    React.ComponentProps<typeof ForkDestinationDialog>,
    "open" | "onOpenChange"
  > & {
    buttonLabel?: string;
  }
) {
  const [open, setOpen] = useState(false);
  const { buttonLabel = "Choose Destination", ...dialogProps } = props;

  return (
    <>
      <Button onClick={() => setOpen(true)} data-testid="dialog-trigger">
        {buttonLabel}
      </Button>
      <ForkDestinationDialog
        {...dialogProps}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}

const meta = {
  title: "Items/Dialogs/ForkDestinationDialog",
  component: DialogWithTrigger,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Dialog for selecting where to place a forked item in the user's library. Features virtualization for large item lists.",
      },
    },
  },
  argTypes: {
    itemName: { control: "text" },
    isForking: { control: "boolean" },
    buttonLabel: { control: "text" },
  },
  args: {
    onConfirm: fn(),
  },
} satisfies Meta<typeof DialogWithTrigger>;

export default meta;
type Story = StoryObj<typeof meta>;

// === STANDARD VARIANTS ===

/**
 * Default with folders to choose from.
 */
export const Default: Story = {
  args: {
    itemName: "Inception (2010)",
    isForking: false,
    buttonLabel: "Fork to Library",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByTestId("dialog-trigger");
    await userEvent.click(trigger);
    await canvas.findByText(/choose.*destination/i);
  },
};

/**
 * Empty library - only root option available.
 */
export const RootOnly: Story = {
  args: {
    itemName: "The Dark Knight (2008)",
    isForking: false,
    buttonLabel: "Fork (Empty Library)",
  },
  beforeEach: () => {
    (getAllItems as ReturnType<typeof fn>).mockResolvedValue({
      success: true,
      data: [],
    });
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByTestId("dialog-trigger");
    await userEvent.click(trigger);
    await canvas.findByText(/choose.*destination/i);
  },
};
