/**
 * Storybook stories for the ViewToggle component.
 * Demonstrates grid/tree view mode switching with smooth transitions.
 */
import type { Meta, StoryObj } from "@storybook/nextjs";
import { fn } from "storybook/test";
import { ViewToggle } from "./view-toggle";

const meta = {
  title: "Items/Controls/ViewToggle",
  component: ViewToggle,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Segmented control for switching between grid and tree view modes. Features smooth sliding transitions.",
      },
    },
  },
  argTypes: {
    value: {
      control: "radio",
      options: ["grid", "tree"],
      description: "Current view mode",
    },
    disabled: { control: "boolean" },
  },
  args: {
    onChange: fn(),
  },
} satisfies Meta<typeof ViewToggle>;

export default meta;
type Story = StoryObj<typeof meta>;

// === STANDARD VARIANTS ===

export const Default: Story = {
  args: {
    value: "grid",
    disabled: false,
  },
};

export const TreeView: Story = {
  args: {
    value: "tree",
    disabled: false,
  },
  parameters: {
    docs: {
      description: {
        story: "Tree view shows items in a hierarchical list format.",
      },
    },
  },
};

export const Disabled: Story = {
  args: {
    value: "grid",
    disabled: true,
  },
  parameters: {
    docs: {
      description: {
        story: "Disabled state prevents interaction.",
      },
    },
  },
};
