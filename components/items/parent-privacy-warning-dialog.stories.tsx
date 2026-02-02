/**
 * Storybook stories for the ParentPrivacyWarningDialog component.
 * Demonstrates warning when making a parent item private affects children.
 */
import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs";
import { fn, userEvent, within } from "storybook/test";

import { Button } from "@/components/ui/button";
import { ParentPrivacyWarningDialog } from "./parent-privacy-warning-dialog";

/**
 * Wrapper component that provides a trigger button for the dialog.
 */
function DialogWithTrigger(
  props: Omit<
    React.ComponentProps<typeof ParentPrivacyWarningDialog>,
    "open" | "onOpenChange"
  > & {
    buttonLabel?: string;
  }
) {
  const [open, setOpen] = useState(false);
  const { buttonLabel = "Make Private", ...dialogProps } = props;

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        data-testid="dialog-trigger"
      >
        {buttonLabel}
      </Button>
      <ParentPrivacyWarningDialog
        {...dialogProps}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}

const meta = {
  title: "Items/Dialogs/ParentPrivacyWarningDialog",
  component: DialogWithTrigger,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Warning dialog shown when making a parent item private, alerting users that inheriting children will also become private.",
      },
    },
  },
  argTypes: {
    itemName: { control: "text" },
    affectedChildCount: { control: "number" },
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
    itemName: "TV Shows",
    affectedChildCount: 5,
    isLoading: false,
    buttonLabel: "Make Private (5 children)",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByTestId("dialog-trigger");
    await userEvent.click(trigger);
    await canvas.findByText(/will also become private/i);
  },
};

export const SingleChild: Story = {
  args: {
    itemName: "Breaking Bad",
    affectedChildCount: 1,
    isLoading: false,
    buttonLabel: "Make Private (1 child)",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByTestId("dialog-trigger");
    await userEvent.click(trigger);
    await canvas.findByText(/will also become private/i);
  },
  parameters: {
    docs: {
      description: {
        story: "Uses singular grammar when only one child item is affected.",
      },
    },
  },
};

export const ManyChildren: Story = {
  args: {
    itemName: "Movie Collection",
    affectedChildCount: 47,
    isLoading: false,
    buttonLabel: "Make Private (47 children)",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByTestId("dialog-trigger");
    await userEvent.click(trigger);
    await canvas.findByText(/will also become private/i);
  },
  parameters: {
    docs: {
      description: {
        story: "Shows plural grammar for multiple affected children.",
      },
    },
  },
};

export const Loading: Story = {
  args: {
    itemName: "TV Shows",
    affectedChildCount: 5,
    isLoading: true,
    buttonLabel: "Test Loading State",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByTestId("dialog-trigger");
    await userEvent.click(trigger);
    await canvas.findByText(/will also become private/i);
  },
  parameters: {
    docs: {
      description: {
        story:
          "Shows loading state while the privacy update operation is in progress.",
      },
    },
  },
};
