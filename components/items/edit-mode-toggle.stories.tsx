/**
 * Storybook stories for the EditModeToggle component.
 * Demonstrates view/edit mode switching with tooltip states.
 */
import type { Meta, StoryObj } from "@storybook/nextjs";
import { fn } from "storybook/test";
import { EditModeToggle } from "./edit-mode-toggle";

const meta = {
  title: "Items/Controls/EditModeToggle",
  component: EditModeToggle,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Toggle button for switching between view and edit modes. In edit mode, items can be reordered via drag-and-drop.",
      },
    },
  },
  argTypes: {
    isEditing: { control: "boolean" },
    disabled: { control: "boolean" },
    disabledReason: { control: "text" },
  },
  args: {
    onToggle: fn(),
  },
} satisfies Meta<typeof EditModeToggle>;

export default meta;
type Story = StoryObj<typeof meta>;

// === STANDARD VARIANTS ===

export const Default: Story = {
  args: {
    isEditing: false,
    disabled: false,
  },
};

export const EditMode: Story = {
  args: {
    isEditing: true,
    disabled: false,
  },
  parameters: {
    docs: {
      description: {
        story: 'Shows "Done" button with checkmark when in edit mode.',
      },
    },
  },
};

export const DisabledWithReason: Story = {
  args: {
    isEditing: false,
    disabled: true,
    disabledReason: "Add items to enable editing",
  },
  parameters: {
    docs: {
      description: {
        story:
          "Shows tooltip on hover explaining why the button is disabled. On mobile, shows helper text below the button.",
      },
    },
  },
};
